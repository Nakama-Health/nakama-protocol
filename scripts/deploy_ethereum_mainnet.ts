// SPDX-License-Identifier: AGPL-3.0-or-later

import { network } from "hardhat";
import { resolve } from "node:path";

import {
  EIP7825_TRANSACTION_GAS_LIMIT,
  validateDeploymentEnvironment,
  validateDeploymentRuntime,
} from "./lib/ethereum_deploy_guard.mjs";
import { runReleasePreflight } from "./lib/ethereum_release_preflight.mjs";
import {
  runtimeBytecodeBytes as bytecodeBytes,
  runtimeBytecodeTemplateHash,
} from "./lib/ethereum_bytecode.mjs";
import {
  ETHEREUM_LIVE_CONTRACTS,
  RESERVE_VAULT_TEMPLATE,
  protocolAbiPath,
} from "./lib/ethereum_contract_set.mjs";
import {
  assertPathAbsent,
  createDeploymentIntent,
  replaceDeploymentJournal,
  writeExclusiveDeploymentRecord,
} from "./lib/ethereum_deployment_journal.mjs";

const config = validateDeploymentEnvironment();
const release = await runReleasePreflight(config);
const broadcastPath = resolve(
  process.cwd(),
  "deployments/ethereum-mainnet.broadcast.json"
);
const pendingPath = resolve(
  process.cwd(),
  "deployments/ethereum-mainnet.pending.json"
);
await assertPathAbsent(pendingPath);
const { ethers } = await network.create("mainnet");
const [deployer] = await ethers.getSigners();
const [
  providerNetwork,
  balance,
  latestNonce,
  pendingNonce,
  latestBlock,
  estimatedFactoryDeploymentGas,
] = await Promise.all([
  ethers.provider.getNetwork(),
  ethers.provider.getBalance(deployer.address),
  ethers.provider.getTransactionCount(deployer.address, "latest"),
  ethers.provider.getTransactionCount(deployer.address, "pending"),
  ethers.provider.getBlock("latest"),
  ethers.provider.estimateGas({
    from: deployer.address,
    data: release.factoryCreationBytecode,
  }),
]);
const contractRuntimeSizes = Object.fromEntries(
  Object.entries(release.contracts).map(([name, contract]) => [
    name,
    contract.runtimeBytecodeBytes,
  ])
);
const contractCreationSizes = Object.fromEntries(
  Object.entries(release.contracts).map(([name, contract]) => [
    name,
    contract.creationBytecodeBytes,
  ])
);

const runtime = validateDeploymentRuntime(config, {
  chainId: providerNetwork.chainId,
  deployer: deployer.address,
  balanceWei: balance,
  latestNonce,
  pendingNonce,
  latestBlockNumber: latestBlock?.number,
  latestBlockGasLimit: latestBlock?.gasLimit,
  estimatedFactoryDeploymentGas,
  runtimeBytecodeBytes: contractRuntimeSizes,
  creationBytecodeBytes: contractCreationSizes,
});
const deploymentNonce = runtime.pendingNonce;
const factoryAddress = ethers.getCreateAddress({
  from: deployer.address,
  nonce: deploymentNonce,
});
const policyRegistryAddress = ethers.getCreateAddress({
  from: factoryAddress,
  nonce: 1,
});
const protocolAddress = ethers.getCreateAddress({
  from: factoryAddress,
  nonce: 2,
});
const factoryCreationBytecodeHash =
  release.contracts.NakamaProtocolFactory.creationBytecodeHash;
const deploymentPreflight = {
  latestNonce: runtime.latestNonce,
  pendingNonce: runtime.pendingNonce,
  latestBlockNumber: runtime.latestBlockNumber,
  latestBlockGasLimit: runtime.latestBlockGasLimit.toString(),
  estimatedFactoryDeploymentGas:
    runtime.estimatedFactoryDeploymentGas.toString(),
  eip7825TransactionGasLimit: EIP7825_TRANSACTION_GAS_LIMIT.toString(),
};
await createDeploymentIntent(broadcastPath, {
  schemaVersion: 3,
  status: "intent",
  chainId: 1,
  caip2: "eip155:1",
  entryContract: "NakamaProtocolFactory",
  expectedDeployer: config.expectedDeployer,
  deploymentNonce,
  liveContractAddresses: {
    factory: factoryAddress,
    policyRegistry: policyRegistryAddress,
    protocol: protocolAddress,
  },
  factoryCreationBytecodeHash,
  deploymentPreflight,
  protocolArtifactSha256: release.protocolArtifactSha256,
  sourceCommit: config.sourceCommit,
});

const factoryContractFactory = await ethers.getContractFactory(
  "NakamaProtocolFactory",
  deployer
);
const factory = await factoryContractFactory.deploy({
  nonce: deploymentNonce,
  gasLimit: runtime.estimatedFactoryDeploymentGas,
});
const deploymentTransaction = factory.deploymentTransaction();
if (deploymentTransaction === null)
  throw new Error("Deployment transaction was not created");
if ((await factory.getAddress()) !== factoryAddress) {
  throw new Error(
    "Factory address does not match the durably journaled signer nonce"
  );
}
const broadcastReceipt = {
  schemaVersion: 3,
  status: "broadcast",
  chainId: 1,
  caip2: "eip155:1",
  entryContract: "NakamaProtocolFactory",
  liveContractAddresses: {
    factory: factoryAddress,
    policyRegistry: policyRegistryAddress,
    protocol: protocolAddress,
  },
  deployer: deployer.address,
  deploymentNonce,
  deploymentTransaction: deploymentTransaction.hash,
  factoryCreationBytecodeHash,
  deploymentPreflight,
  protocolArtifactSha256: release.protocolArtifactSha256,
  sourceCommit: config.sourceCommit,
};
console.error(
  `[ethereum-mainnet:broadcast] ${JSON.stringify(broadcastReceipt)}`
);
await replaceDeploymentJournal(broadcastPath, broadcastReceipt);

const receipt = await deploymentTransaction.wait(config.confirmations);
if (receipt === null || receipt.status !== 1)
  throw new Error("Deployment transaction did not succeed");
await factory.waitForDeployment();

const [factoryRegistry, factoryProtocol] = await Promise.all([
  factory.policyRegistry(),
  factory.protocol(),
]);
if (
  factoryRegistry !== policyRegistryAddress ||
  factoryProtocol !== protocolAddress
) {
  throw new Error(
    "Factory child getters do not match CREATE nonce one and two addresses"
  );
}
const [policyRegistry, protocol] = await Promise.all([
  ethers.getContractAt("NakamaPolicyRegistry", policyRegistryAddress, deployer),
  ethers.getContractAt("NakamaCoverageProtocol", protocolAddress, deployer),
]);
const [registryCore, protocolRegistry, protocolFactory] = await Promise.all([
  policyRegistry.core(),
  protocol.policyRegistry(),
  protocol.deploymentFactory(),
]);
if (
  registryCore !== protocolAddress ||
  protocolRegistry !== policyRegistryAddress ||
  protocolFactory !== factoryAddress
) {
  throw new Error(
    "Factory, registry, and protocol immutable cross-bindings do not match"
  );
}

async function checkedLiveContract(role, address) {
  const identity = ETHEREUM_LIVE_CONTRACTS[role];
  const approved = release.contracts[identity.contractName];
  const runtimeCode = await ethers.provider.getCode(address);
  if (runtimeCode === "0x")
    throw new Error(`No runtime bytecode found for ${identity.contractName}`);
  const runtimeBytecodeHash = ethers.keccak256(runtimeCode);
  if (bytecodeBytes(runtimeCode) !== approved.runtimeBytecodeBytes) {
    throw new Error(
      `${identity.contractName} runtime bytecode length does not match the approved artifact`
    );
  }
  const runtimeTemplateHash = runtimeBytecodeTemplateHash(
    runtimeCode,
    approved.immutableReferences
  );
  if (runtimeTemplateHash !== approved.runtimeBytecodeTemplateHash) {
    throw new Error(
      `${identity.contractName} runtime bytecode does not match the approved template`
    );
  }
  return {
    contractName: identity.contractName,
    address,
    deploymentKind: identity.deploymentKind,
    factoryNonce: identity.factoryNonce,
    creationBytecodeHash: approved.creationBytecodeHash,
    creationBytecodeBytes: approved.creationBytecodeBytes,
    runtimeBytecodeHash,
    runtimeBytecodeTemplateHash: runtimeTemplateHash,
    runtimeBytecodeBytes: approved.runtimeBytecodeBytes,
    immutableReferences: approved.immutableReferences,
    abiArtifact: protocolAbiPath(identity.contractName),
    abiSha256: approved.abiSha256,
    verification: null,
  };
}

const liveContracts = {
  factory: await checkedLiveContract("factory", factoryAddress),
  policyRegistry: await checkedLiveContract(
    "policyRegistry",
    policyRegistryAddress
  ),
  protocol: await checkedLiveContract("protocol", protocolAddress),
};
const reserveVault = release.contracts.ReserveVault;
const intermediateReceipt = {
  schemaVersion: 3,
  status: "deployed-unverified",
  chainId: 1,
  caip2: "eip155:1",
  entryContract: "NakamaProtocolFactory",
  deployer: deployer.address,
  deploymentTransaction: receipt.hash,
  deploymentBlock: receipt.blockNumber,
  deploymentBlockHash: receipt.blockHash,
  confirmations: config.confirmations,
  sourceCommit: config.sourceCommit,
  protocolArtifactSha256: release.protocolArtifactSha256,
  liveContracts,
  contractTemplates: {
    reserveVault: {
      ...RESERVE_VAULT_TEMPLATE,
      creationBytecodeHash: reserveVault.creationBytecodeHash,
      creationBytecodeBytes: reserveVault.creationBytecodeBytes,
      runtimeBytecodeTemplateHash: reserveVault.runtimeBytecodeTemplateHash,
      runtimeBytecodeBytes: reserveVault.runtimeBytecodeBytes,
      immutableReferences: reserveVault.immutableReferences,
      abiArtifact: protocolAbiPath("ReserveVault"),
      abiSha256: reserveVault.abiSha256,
    },
  },
  verified: false,
  auditStatus: "audited",
  auditReportSha256: config.auditReportSha256,
  releaseApprovalSha256: config.releaseApprovalSha256,
  verificationEvidenceSha256: null,
};
await writeExclusiveDeploymentRecord(pendingPath, intermediateReceipt);
console.log(JSON.stringify(intermediateReceipt, null, 2));
