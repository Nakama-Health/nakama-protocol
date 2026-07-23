// SPDX-License-Identifier: AGPL-3.0-or-later

import { JsonRpcProvider, Wallet } from "ethers";

import {
  validateDeploymentEnvironment,
  validateDeploymentRuntime,
} from "./lib/ethereum_deploy_guard.mjs";
import { runReleasePreflight } from "./lib/ethereum_release_preflight.mjs";
import { buildEthereumPreflightReport } from "./lib/ethereum_preflight_report.mjs";

const config = validateDeploymentEnvironment();
const release = await runReleasePreflight(config);
const provider = new JsonRpcProvider(config.rpcUrl);
const signer = new Wallet(config.privateKey, provider);
const [
  network,
  balance,
  latestNonce,
  pendingNonce,
  latestBlock,
  estimatedFactoryDeploymentGas,
] = await Promise.all([
  provider.getNetwork(),
  provider.getBalance(signer.address),
  provider.getTransactionCount(signer.address, "latest"),
  provider.getTransactionCount(signer.address, "pending"),
  provider.getBlock("latest"),
  provider.estimateGas({
    from: signer.address,
    data: release.factoryCreationBytecode,
  }),
]);

const runtimeBytecodeBytes = Object.fromEntries(
  Object.entries(release.contracts).map(([name, contract]) => [
    name,
    contract.runtimeBytecodeBytes,
  ])
);
const creationBytecodeBytes = Object.fromEntries(
  Object.entries(release.contracts).map(([name, contract]) => [
    name,
    contract.creationBytecodeBytes,
  ])
);

const runtime = validateDeploymentRuntime(config, {
  chainId: network.chainId,
  deployer: signer.address,
  balanceWei: balance,
  latestNonce,
  pendingNonce,
  latestBlockNumber: latestBlock?.number,
  latestBlockGasLimit: latestBlock?.gasLimit,
  estimatedFactoryDeploymentGas,
  runtimeBytecodeBytes,
  creationBytecodeBytes,
});

console.log(
  JSON.stringify(
    buildEthereumPreflightReport(config, release, runtime, network.chainId),
    null,
    2
  )
);
