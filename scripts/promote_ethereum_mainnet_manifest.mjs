// SPDX-License-Identifier: AGPL-3.0-or-later

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { getAddress } from "ethers";

import {
  buildPublishedDeploymentManifest,
  validateIntermediateDeployment,
  validatePublishedDeploymentManifest,
  validateSdkAbi,
} from "./lib/ethereum_manifest_promotion.mjs";
import {
  attestEthereumMainnetDeployment,
  verifySourcifyExactMatch,
} from "./lib/ethereum_chain_verification.mjs";
import { validateMainnetRpcUrl } from "./lib/ethereum_deploy_guard.mjs";
import { runReleasePreflight } from "./lib/ethereum_release_preflight.mjs";

function argument(name) {
  const index = process.argv.indexOf(name);
  if (index === -1 || !process.argv[index + 1] || process.argv[index + 1].startsWith("--")) {
    throw new Error(`Missing required argument: ${name}`);
  }
  return resolve(process.argv[index + 1]);
}

const deploymentPath = argument("--deployment");
const sdkAbiPath = argument("--sdk-abi");
const rpcUrl = validateMainnetRpcUrl(process.env.ETHEREUM_MAINNET_RPC_URL?.trim() ?? "");
const localReleaseManifest = JSON.parse(
  await readFile(resolve(process.cwd(), "deployments/ethereum-mainnet.release.json"), "utf8").catch(() => {
    throw new Error("Missing ignored deployments/ethereum-mainnet.release.json");
  }),
);
const release = await runReleasePreflight({
  sourceCommit: localReleaseManifest.sourceCommit,
  expectedDeployer: getAddress(localReleaseManifest.expectedDeployer),
  auditReportSha256: localReleaseManifest.auditReportSha256,
  releaseApprovalSha256: localReleaseManifest.releaseApprovalSha256,
});
const [deploymentRaw, sdkAbiRaw] = await Promise.all([
  readFile(deploymentPath, "utf8"),
  readFile(sdkAbiPath, "utf8"),
]);
const deployment = validateIntermediateDeployment(JSON.parse(deploymentRaw), release);
const canonicalDeployment = await attestEthereumMainnetDeployment(
  deployment,
  release,
  { rpcUrl },
);
const sourceVerification = await verifySourcifyExactMatch(canonicalDeployment.protocolAddress);
const sdkAbi = JSON.parse(sdkAbiRaw);
validateSdkAbi(sdkAbi, release.protocolAbi);
const abiSha256 = createHash("sha256").update(sdkAbiRaw).digest("hex");
const verificationEvidenceSha256 = createHash("sha256")
  .update(`${JSON.stringify(sourceVerification, null, 2)}\n`)
  .digest("hex");
const manifest = buildPublishedDeploymentManifest(canonicalDeployment, sourceVerification, {
  abiSha256,
  verificationEvidenceSha256,
});
validatePublishedDeploymentManifest(manifest);
console.log(JSON.stringify(manifest, null, 2));
