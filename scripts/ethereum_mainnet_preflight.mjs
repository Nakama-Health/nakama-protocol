// SPDX-License-Identifier: AGPL-3.0-or-later

import { JsonRpcProvider, Wallet } from "ethers";

import {
  validateDeploymentEnvironment,
  validateDeploymentRuntime,
} from "./lib/ethereum_deploy_guard.mjs";
import { runReleasePreflight } from "./lib/ethereum_release_preflight.mjs";

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
    {
      ok: true,
      mode: "preflight-only-no-transaction",
      chainId: Number(network.chainId),
      caip2: "eip155:1",
      deployer: runtime.deployer,
      balanceRequirementMet: true,
      runtimeBytecodeBytes: runtime.runtimeBytecodeBytes,
      sourceCommit: config.sourceCommit,
      auditReportSha256: config.auditReportSha256,
      releaseApprovalSha256: config.releaseApprovalSha256,
      runtimeBytecodeHash: release.protocolRuntimeBytecodeHash,
      protocolArtifactSha256: release.protocolArtifactSha256,
      confirmations: config.confirmations,
    },
    null,
    2,
  ),
);
