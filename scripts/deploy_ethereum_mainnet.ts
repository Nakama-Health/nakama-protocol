// SPDX-License-Identifier: AGPL-3.0-or-later

import { network } from "hardhat";
import { resolve } from "node:path";

import {
  validateDeploymentEnvironment,
  validateDeploymentRuntime,
} from "./lib/ethereum_deploy_guard.mjs";
import { runReleasePreflight } from "./lib/ethereum_release_preflight.mjs";
import {
  runtimeBytecodeBytes as bytecodeBytes,
  runtimeBytecodeTemplateHash,
} from "./lib/ethereum_bytecode.mjs";
import {
  assertPathAbsent,
  createDeploymentIntent,
  replaceDeploymentJournal,
  writeExclusiveDeploymentRecord,
} from "./lib/ethereum_deployment_journal.mjs";

const config = validateDeploymentEnvironment();
const release = await runReleasePreflight(config);
const broadcastPath = resolve(process.cwd(), "deployments/ethereum-mainnet.broadcast.json");
const pendingPath = resolve(process.cwd(), "deployments/ethereum-mainnet.pending.json");
await assertPathAbsent(pendingPath);
const { ethers } = await network.create("mainnet");
const providerNetwork = await ethers.provider.getNetwork();
const [deployer] = await ethers.getSigners();
const balance = await ethers.provider.getBalance(deployer.address);
const factory = await ethers.getContractFactory("NakamaCoverageProtocol", deployer);
const runtimeBytecodeBytes = release.runtimeBytecodeBytes;

validateDeploymentRuntime(config, {
  chainId: providerNetwork.chainId,
  deployer: deployer.address,
  balanceWei: balance,
  runtimeBytecodeBytes,
});
await createDeploymentIntent(broadcastPath, {
  schemaVersion: 2,
  status: "intent",
  chainId: 1,
  caip2: "eip155:1",
  contractName: "NakamaCoverageProtocol",
  expectedDeployer: config.expectedDeployer,
  sourceCommit: config.sourceCommit,
});

const protocol = await factory.deploy();
const deploymentTransaction = protocol.deploymentTransaction();
if (deploymentTransaction === null) throw new Error("Deployment transaction was not created");
const protocolAddress = await protocol.getAddress();
const broadcastReceipt = {
  schemaVersion: 2,
  status: "broadcast",
  chainId: 1,
  caip2: "eip155:1",
  contractName: "NakamaCoverageProtocol",
  protocolAddress,
  deployer: deployer.address,
  deploymentTransaction: deploymentTransaction.hash,
  sourceCommit: config.sourceCommit,
};
console.error(`[ethereum-mainnet:broadcast] ${JSON.stringify(broadcastReceipt)}`);
await replaceDeploymentJournal(broadcastPath, broadcastReceipt);

const receipt = await deploymentTransaction.wait(config.confirmations);
if (receipt === null || receipt.status !== 1) throw new Error("Deployment transaction did not succeed");
await protocol.waitForDeployment();

const runtimeCode = await ethers.provider.getCode(protocolAddress);
if (runtimeCode === "0x") throw new Error("No runtime bytecode found at the deployed address");
const runtimeBytecodeHash = ethers.keccak256(runtimeCode);
if (bytecodeBytes(runtimeCode) !== release.runtimeBytecodeBytes) {
  throw new Error("Deployed runtime bytecode length does not match the approved release artifact");
}
const runtimeTemplateHash = runtimeBytecodeTemplateHash(
  runtimeCode,
  release.protocolImmutableReferences,
);
if (runtimeTemplateHash !== release.protocolRuntimeBytecodeTemplateHash) {
  throw new Error("Normalized deployed runtime bytecode does not match the approved release template");
}

const intermediateReceipt = {
      schemaVersion: 2,
      status: "deployed-unverified",
      chainId: 1,
      caip2: "eip155:1",
      contractName: "NakamaCoverageProtocol",
      protocolAddress,
      deployer: deployer.address,
      deploymentTransaction: receipt.hash,
      deploymentBlock: receipt.blockNumber,
      deploymentBlockHash: receipt.blockHash,
      confirmations: config.confirmations,
      sourceCommit: config.sourceCommit,
      auditReportSha256: config.auditReportSha256,
      releaseApprovalSha256: config.releaseApprovalSha256,
      protocolArtifactSha256: release.protocolArtifactSha256,
      creationBytecodeHash: release.protocolCreationBytecodeHash,
      runtimeBytecodeHash,
      runtimeBytecodeTemplateHash: runtimeTemplateHash,
      runtimeBytecodeBytes: release.runtimeBytecodeBytes,
      immutableReferences: release.protocolImmutableReferences,
      abiArtifact: "shared/ethereum/protocol_contract.json",
      verified: false,
      auditStatus: "audited",
};
await writeExclusiveDeploymentRecord(pendingPath, intermediateReceipt);
console.log(JSON.stringify(intermediateReceipt, null, 2));
