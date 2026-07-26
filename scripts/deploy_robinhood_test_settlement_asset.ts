// SPDX-License-Identifier: AGPL-3.0-or-later

import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { promisify } from "node:util";
import { JsonRpcProvider } from "ethers";
import { network } from "hardhat";

import {
  createDeploymentIntent,
  replaceDeploymentJournal,
  writeExclusiveDeploymentRecord,
} from "./lib/ethereum_deployment_journal.mjs";
import {
  ROBINHOOD_GENERIC_TESTNET_CAIP2,
  ROBINHOOD_GENERIC_TESTNET_CHAIN_ID,
  ROBINHOOD_TESTNET_SETTLEMENT_ASSET_CLASSIFICATION,
  ROBINHOOD_TESTNET_SETTLEMENT_ASSET_CONTRACT,
} from "./lib/robinhood_generic_core_guard.mjs";
import { verifyRobinhoodTestnetSettlementAsset } from "./lib/robinhood_generic_core_verification.mjs";
import { validateRobinhoodTestAssetDeploymentEnvironment } from "./lib/robinhood_test_asset_guard.mjs";

const execFileAsync = promisify(execFile);
const config = validateRobinhoodTestAssetDeploymentEnvironment();
const root = process.cwd();
const [{ stdout: headCommit }, { stdout: statusPorcelain }] =
  await Promise.all([
    execFileAsync("git", ["rev-parse", "HEAD"], { cwd: root }),
    execFileAsync(
      "git",
      ["status", "--porcelain=v1", "--untracked-files=all"],
      { cwd: root }
    ),
  ]);
if (
  headCommit.trim() !== config.sourceCommit ||
  statusPorcelain.trim() !== ""
) {
  throw new Error(
    "Robinhood test-asset deployment requires the exact approved clean source commit"
  );
}

const broadcastPath = resolve(
  root,
  "deployments/robinhood-testnet/test-settlement-asset.broadcast.json"
);
const pendingPath = resolve(
  root,
  "deployments/robinhood-testnet/test-settlement-asset.pending.json"
);
const fallbackProvider = new JsonRpcProvider(config.fallbackRpcUrl);
const { ethers } = await network.create("robinhoodTestnet");
const [deployer] = await ethers.getSigners();
const tokenFactory = await ethers.getContractFactory(
  ROBINHOOD_TESTNET_SETTLEMENT_ASSET_CONTRACT,
  deployer
);
const deployRequest = await tokenFactory.getDeployTransaction(
  config.initialHolder,
  config.initialSupply
);
if (!deployRequest.data) {
  throw new Error("NakamaTestUsd deployment initcode is unavailable");
}

const [
  primaryNetwork,
  fallbackNetwork,
  balance,
  latestNonce,
  pendingNonce,
  latestBlock,
  estimatedGas,
] = await Promise.all([
  ethers.provider.getNetwork(),
  fallbackProvider.getNetwork(),
  ethers.provider.getBalance(deployer.address),
  ethers.provider.getTransactionCount(deployer.address, "latest"),
  ethers.provider.getTransactionCount(deployer.address, "pending"),
  ethers.provider.getBlock("latest"),
  ethers.provider.estimateGas({
    from: deployer.address,
    data: deployRequest.data,
  }),
]);
if (
  primaryNetwork.chainId !== ROBINHOOD_GENERIC_TESTNET_CHAIN_ID ||
  fallbackNetwork.chainId !== ROBINHOOD_GENERIC_TESTNET_CHAIN_ID
) {
  throw new Error("Both RPC providers must report Robinhood testnet chain 46630");
}
if (deployer.address !== config.expectedDeployer) {
  throw new Error("Test-asset signer does not match the approved deployer");
}
if (balance < config.minimumBalanceWei) {
  throw new Error("Test-asset deployer balance is below the minimum");
}
if (latestNonce !== pendingNonce) {
  throw new Error(
    "Test-asset deployer has pending transactions; reconcile them first"
  );
}
if (
  !latestBlock ||
  estimatedGas <= 0n ||
  estimatedGas > latestBlock.gasLimit
) {
  throw new Error(
    "Test-asset deployment gas is unavailable or exceeds the latest block gas limit"
  );
}

const predictedAddress = ethers.getCreateAddress({
  from: deployer.address,
  nonce: pendingNonce,
});
const initcodeSha256 = createHash("sha256")
  .update(Buffer.from(String(deployRequest.data).slice(2), "hex"))
  .digest("hex");
await createDeploymentIntent(broadcastPath, {
  schemaVersion: 1,
  status: "intent",
  chainId: Number(ROBINHOOD_GENERIC_TESTNET_CHAIN_ID),
  caip2: ROBINHOOD_GENERIC_TESTNET_CAIP2,
  contractName: ROBINHOOD_TESTNET_SETTLEMENT_ASSET_CONTRACT,
  deployer: deployer.address,
  deploymentNonce: pendingNonce,
  predictedAddress,
  initialHolder: config.initialHolder,
  initialSupply: config.initialSupply.toString(),
  initcodeSha256,
  sourceCommit: config.sourceCommit,
  primaryRpcHostname: new URL(config.rpcUrl).hostname.toLowerCase(),
  fallbackRpcHostname: new URL(
    config.fallbackRpcUrl
  ).hostname.toLowerCase(),
});

const token = await tokenFactory.deploy(
  config.initialHolder,
  config.initialSupply,
  {
    nonce: pendingNonce,
    gasLimit: estimatedGas,
  }
);
const deploymentTransaction = token.deploymentTransaction();
if (!deploymentTransaction) {
  throw new Error("NakamaTestUsd deployment transaction was not created");
}
if ((await token.getAddress()) !== predictedAddress) {
  throw new Error("Test-asset address differs from the journaled CREATE address");
}
await replaceDeploymentJournal(broadcastPath, {
  schemaVersion: 1,
  status: "broadcast",
  chainId: Number(ROBINHOOD_GENERIC_TESTNET_CHAIN_ID),
  caip2: ROBINHOOD_GENERIC_TESTNET_CAIP2,
  contractName: ROBINHOOD_TESTNET_SETTLEMENT_ASSET_CONTRACT,
  deployer: deployer.address,
  deploymentNonce: pendingNonce,
  predictedAddress,
  initialHolder: config.initialHolder,
  initialSupply: config.initialSupply.toString(),
  initcodeSha256,
  sourceCommit: config.sourceCommit,
  deploymentTransaction: deploymentTransaction.hash,
});

const receipt = await deploymentTransaction.wait(config.confirmations);
if (!receipt || receipt.status !== 1) {
  throw new Error("NakamaTestUsd deployment transaction did not succeed");
}
const expectedAsset = {
  contractName: ROBINHOOD_TESTNET_SETTLEMENT_ASSET_CONTRACT,
  address: predictedAddress,
  name: "Nakama Test USD",
  symbol: "tUSDG",
  decimals: 6,
  deploymentTransaction: receipt.hash,
  classification: ROBINHOOD_TESTNET_SETTLEMENT_ASSET_CLASSIFICATION,
  canonical: false,
};
const [primaryAsset, fallbackAsset] = await Promise.all([
  verifyRobinhoodTestnetSettlementAsset(config.rpcUrl, expectedAsset),
  verifyRobinhoodTestnetSettlementAsset(
    config.fallbackRpcUrl,
    expectedAsset
  ),
]);
if (JSON.stringify(primaryAsset) !== JSON.stringify(fallbackAsset)) {
  throw new Error(
    "Independent Robinhood testnet providers disagree on the deployed test asset"
  );
}

const record = {
  schemaVersion: 1,
  status: "deployed-unverified",
  chainId: Number(ROBINHOOD_GENERIC_TESTNET_CHAIN_ID),
  caip2: ROBINHOOD_GENERIC_TESTNET_CAIP2,
  ...primaryAsset,
  deployer: deployer.address,
  initialHolder: config.initialHolder,
  initialSupply: config.initialSupply.toString(),
  deploymentBlock: receipt.blockNumber,
  deploymentBlockHash: receipt.blockHash,
  confirmations: config.confirmations,
  sourceCommit: config.sourceCommit,
  blockscoutSourceVerified: false,
  sourcifyExactMatchVerified: false,
  productionEnabled: false,
};
await writeExclusiveDeploymentRecord(pendingPath, record);
console.log(JSON.stringify(record, null, 2));
