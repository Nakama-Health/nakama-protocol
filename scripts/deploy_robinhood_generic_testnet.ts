// SPDX-License-Identifier: AGPL-3.0-or-later

import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { network } from "hardhat";

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
import {
  ROBINHOOD_GENERIC_TESTNET_CAIP2,
  ROBINHOOD_GENERIC_TESTNET_CHAIN_ID,
  validateRobinhoodGenericTestnetEnvironment,
  validateRobinhoodGenericTestnetRuntime,
} from "./lib/robinhood_generic_core_guard.mjs";
import { runRobinhoodGenericCoreReleasePreflight } from "./lib/robinhood_generic_core_release.mjs";
import { verifyRobinhoodTestnetSettlementAsset } from "./lib/robinhood_generic_core_verification.mjs";

const config = validateRobinhoodGenericTestnetEnvironment();
const release = await runRobinhoodGenericCoreReleasePreflight(config);
const broadcastPath = resolve(
  process.cwd(),
  "deployments/robinhood-testnet/generic-core.broadcast.json"
);
const pendingPath = resolve(
  process.cwd(),
  "deployments/robinhood-testnet/generic-core.pending.json"
);
await assertPathAbsent(pendingPath);

const [primarySettlementAsset, fallbackSettlementAsset] = await Promise.all([
  verifyRobinhoodTestnetSettlementAsset(
    config.rpcUrl,
    config.settlementAsset
  ),
  verifyRobinhoodTestnetSettlementAsset(
    config.fallbackRpcUrl,
    config.settlementAsset
  ),
]);
if (
  JSON.stringify(primarySettlementAsset) !==
  JSON.stringify(fallbackSettlementAsset)
) {
  throw new Error(
    "Independent Robinhood testnet providers disagree on the settlement asset"
  );
}

const { ethers } = await network.create("robinhoodTestnet");
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

const runtime = validateRobinhoodGenericTestnetRuntime(config, {
  chainId: providerNetwork.chainId,
  deployer: deployer.address,
  balanceWei: balance,
  latestNonce,
  pendingNonce,
  latestBlockNumber: latestBlock?.number,
  latestBlockGasLimit: latestBlock?.gasLimit,
  estimatedFactoryDeploymentGas,
  runtimeBytecodeBytes: Object.fromEntries(
    Object.entries(release.contracts).map(([name, contract]) => [
      name,
      contract.runtimeBytecodeBytes,
    ])
  ),
  creationBytecodeBytes: Object.fromEntries(
    Object.entries(release.contracts).map(([name, contract]) => [
      name,
      contract.creationBytecodeBytes,
    ])
  ),
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
  primaryRpcHostname: new URL(config.rpcUrl).hostname.toLowerCase(),
  fallbackRpcHostname: new URL(config.fallbackRpcUrl).hostname.toLowerCase(),
  latestNonce: runtime.latestNonce,
  pendingNonce: runtime.pendingNonce,
  latestBlockNumber: runtime.latestBlockNumber,
  latestBlockGasLimit: runtime.latestBlockGasLimit.toString(),
  estimatedFactoryDeploymentGas:
    runtime.estimatedFactoryDeploymentGas.toString(),
  settlementAsset: primarySettlementAsset,
};
await createDeploymentIntent(broadcastPath, {
  schemaVersion: 3,
  status: "intent",
  chainId: Number(ROBINHOOD_GENERIC_TESTNET_CHAIN_ID),
  caip2: ROBINHOOD_GENERIC_TESTNET_CAIP2,
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
if (deploymentTransaction === null) {
  throw new Error("Robinhood testnet deployment transaction was not created");
}
if ((await factory.getAddress()) !== factoryAddress) {
  throw new Error(
    "Factory address does not match the durably journaled signer nonce"
  );
}

const broadcastReceipt = {
  schemaVersion: 3,
  status: "broadcast",
  chainId: Number(ROBINHOOD_GENERIC_TESTNET_CHAIN_ID),
  caip2: ROBINHOOD_GENERIC_TESTNET_CAIP2,
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
  `[robinhood-generic-testnet:broadcast] ${JSON.stringify(broadcastReceipt)}`
);
await replaceDeploymentJournal(broadcastPath, broadcastReceipt);

const receipt = await deploymentTransaction.wait(config.confirmations);
if (receipt === null || receipt.status !== 1) {
  throw new Error("Robinhood testnet deployment transaction did not succeed");
}
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

async function checkedLiveContract(
  role: keyof typeof ETHEREUM_LIVE_CONTRACTS,
  address: string
) {
  const identity = ETHEREUM_LIVE_CONTRACTS[role];
  const approved = release.contracts[identity.contractName];
  const runtimeCode = await ethers.provider.getCode(address);
  if (runtimeCode === "0x") {
    throw new Error(`No runtime bytecode found for ${identity.contractName}`);
  }
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
    runtimeBytecodeSha256: createHash("sha256")
      .update(Buffer.from(runtimeCode.slice(2), "hex"))
      .digest("hex"),
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
  chainId: Number(ROBINHOOD_GENERIC_TESTNET_CHAIN_ID),
  caip2: ROBINHOOD_GENERIC_TESTNET_CAIP2,
  entryContract: "NakamaProtocolFactory",
  deployer: deployer.address,
  deploymentTransaction: receipt.hash,
  deploymentBlock: receipt.blockNumber,
  deploymentBlockHash: receipt.blockHash,
  confirmations: config.confirmations,
  sourceCommit: config.sourceCommit,
  protocolArtifactSha256: release.protocolArtifactSha256,
  settlementAsset: primarySettlementAsset,
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
  qualificationStatus: "approved-for-testnet",
  qualificationReportSha256: config.qualificationReportSha256,
  releaseApprovalSha256: config.releaseApprovalSha256,
  verificationEvidenceSha256: null,
};
await writeExclusiveDeploymentRecord(pendingPath, intermediateReceipt);
console.log(JSON.stringify(intermediateReceipt, null, 2));
