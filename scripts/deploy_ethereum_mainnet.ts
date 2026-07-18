// SPDX-License-Identifier: AGPL-3.0-or-later

import { network } from "hardhat";

import {
  validateDeploymentEnvironment,
  validateDeploymentRuntime,
} from "./lib/ethereum_deploy_guard.mjs";
import { runReleasePreflight } from "./lib/ethereum_release_preflight.mjs";

const config = validateDeploymentEnvironment();
const release = await runReleasePreflight(config);
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

const protocol = await factory.deploy();
const deploymentTransaction = protocol.deploymentTransaction();
if (deploymentTransaction === null) throw new Error("Deployment transaction was not created");
const receipt = await deploymentTransaction.wait(config.confirmations);
if (receipt === null || receipt.status !== 1) throw new Error("Deployment transaction did not succeed");
await protocol.waitForDeployment();

const protocolAddress = await protocol.getAddress();
const runtimeCode = await ethers.provider.getCode(protocolAddress);
if (runtimeCode === "0x") throw new Error("No runtime bytecode found at the deployed address");
const runtimeBytecodeHash = ethers.keccak256(runtimeCode);
if (runtimeBytecodeHash !== release.protocolRuntimeBytecodeHash) {
  throw new Error("Deployed runtime bytecode does not match the approved release artifact");
}

console.log(
  JSON.stringify(
    {
      schemaVersion: 1,
      status: "deployed-unverified",
      chainId: 1,
      caip2: "eip155:1",
      contractName: "NakamaCoverageProtocol",
      protocolAddress,
      deployer: deployer.address,
      deploymentTransaction: receipt.hash,
      deploymentBlock: receipt.blockNumber,
      confirmations: config.confirmations,
      sourceCommit: config.sourceCommit,
      auditReportSha256: config.auditReportSha256,
      releaseApprovalSha256: config.releaseApprovalSha256,
      protocolArtifactSha256: release.protocolArtifactSha256,
      runtimeBytecodeHash,
      abiArtifact: "shared/ethereum/protocol_contract.json",
      verified: false,
      auditStatus: "audited",
    },
    null,
    2,
  ),
);
