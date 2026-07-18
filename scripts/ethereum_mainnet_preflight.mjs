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
const [network, balance] = await Promise.all([
  provider.getNetwork(),
  provider.getBalance(signer.address),
]);

const runtime = validateDeploymentRuntime(config, {
  chainId: network.chainId,
  deployer: signer.address,
  balanceWei: balance,
  runtimeBytecodeBytes: release.runtimeBytecodeBytes,
});

console.log(
  JSON.stringify(
    buildEthereumPreflightReport(config, release, runtime, network.chainId),
    null,
    2,
  ),
);
