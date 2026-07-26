// SPDX-License-Identifier: AGPL-3.0-or-later

import { JsonRpcProvider, Wallet } from "ethers";

import {
  validateRobinhoodGenericTestnetEnvironment,
  validateRobinhoodGenericTestnetRuntime,
} from "./lib/robinhood_generic_core_guard.mjs";
import { runRobinhoodGenericCoreReleasePreflight } from "./lib/robinhood_generic_core_release.mjs";
import { verifyRobinhoodTestnetSettlementAsset } from "./lib/robinhood_generic_core_verification.mjs";

const config = validateRobinhoodGenericTestnetEnvironment();
const release = await runRobinhoodGenericCoreReleasePreflight(config);
const primaryProvider = new JsonRpcProvider(config.rpcUrl);
const fallbackProvider = new JsonRpcProvider(config.fallbackRpcUrl);
const signer = new Wallet(config.privateKey, primaryProvider);

const [
  primaryNetwork,
  fallbackNetwork,
  balance,
  latestNonce,
  pendingNonce,
  latestBlock,
  estimatedFactoryDeploymentGas,
  primarySettlementAsset,
  fallbackSettlementAsset,
] = await Promise.all([
  primaryProvider.getNetwork(),
  fallbackProvider.getNetwork(),
  primaryProvider.getBalance(signer.address),
  primaryProvider.getTransactionCount(signer.address, "latest"),
  primaryProvider.getTransactionCount(signer.address, "pending"),
  primaryProvider.getBlock("latest"),
  primaryProvider.estimateGas({
    from: signer.address,
    data: release.factoryCreationBytecode,
  }),
  verifyRobinhoodTestnetSettlementAsset(
    config.rpcUrl,
    config.settlementAsset
  ),
  verifyRobinhoodTestnetSettlementAsset(
    config.fallbackRpcUrl,
    config.settlementAsset
  ),
]);
if (primaryNetwork.chainId !== fallbackNetwork.chainId) {
  throw new Error("Independent Robinhood testnet RPCs disagree on chain ID");
}
if (
  JSON.stringify(primarySettlementAsset) !==
  JSON.stringify(fallbackSettlementAsset)
) {
  throw new Error(
    "Independent Robinhood testnet RPCs disagree on the settlement asset"
  );
}

const runtime = validateRobinhoodGenericTestnetRuntime(config, {
  chainId: primaryNetwork.chainId,
  deployer: signer.address,
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

console.log(
  JSON.stringify(
    {
      schemaVersion: 1,
      status: "ready-for-explicit-testnet-deployment",
      chainId: Number(primaryNetwork.chainId),
      caip2: "eip155:46630",
      sourceCommit: config.sourceCommit,
      deployer: runtime.deployer,
      deployerBalanceSufficient: balance >= config.minimumBalanceWei,
      signerNonce: runtime.pendingNonce,
      latestBlockNumber: runtime.latestBlockNumber,
      estimatedFactoryDeploymentGas:
        runtime.estimatedFactoryDeploymentGas.toString(),
      primaryRpcHostname: new URL(config.rpcUrl).hostname.toLowerCase(),
      fallbackRpcHostname: new URL(
        config.fallbackRpcUrl
      ).hostname.toLowerCase(),
      independentRpcProviders: true,
      settlementAsset: primarySettlementAsset,
      releaseApprovalBound: true,
      transactionSubmitted: false,
    },
    null,
    2
  )
);
