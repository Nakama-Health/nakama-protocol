// SPDX-License-Identifier: AGPL-3.0-or-later

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  buildPublishedDeploymentManifest,
  validateIntermediateDeployment,
  validatePublishedDeploymentManifest,
  validateSdkAbi,
  validateSourceVerificationEvidence,
} from "./lib/ethereum_manifest_promotion.mjs";
import { runReleasePreflight } from "./lib/ethereum_release_preflight.mjs";

function argument(name) {
  const index = process.argv.indexOf(name);
  if (index === -1 || !process.argv[index + 1] || process.argv[index + 1].startsWith("--")) {
    throw new Error(`Missing required argument: ${name}`);
  }
  return resolve(process.argv[index + 1]);
}

const deploymentPath = argument("--deployment");
const verificationPath = argument("--verification");
const sdkAbiPath = argument("--sdk-abi");
const localReleaseManifest = JSON.parse(
  await readFile(resolve(process.cwd(), "deployments/ethereum-mainnet.release.json"), "utf8").catch(() => {
    throw new Error("Missing ignored deployments/ethereum-mainnet.release.json");
  }),
);
const release = await runReleasePreflight({
  sourceCommit: localReleaseManifest.sourceCommit,
  auditReportSha256: localReleaseManifest.auditReportSha256,
  releaseApprovalSha256: localReleaseManifest.releaseApprovalSha256,
});
const [deploymentRaw, verificationRaw, sdkAbiRaw] = await Promise.all([
  readFile(deploymentPath, "utf8"),
  readFile(verificationPath, "utf8"),
  readFile(sdkAbiPath, "utf8"),
]);
const deployment = validateIntermediateDeployment(JSON.parse(deploymentRaw), release);
const verificationEvidence = validateSourceVerificationEvidence(
  JSON.parse(verificationRaw),
  deployment,
);
const sdkAbi = JSON.parse(sdkAbiRaw);
validateSdkAbi(sdkAbi, release.protocolAbi);
const abiSha256 = createHash("sha256").update(sdkAbiRaw).digest("hex");
const verificationEvidenceSha256 = createHash("sha256").update(verificationRaw).digest("hex");
const manifest = buildPublishedDeploymentManifest(deployment, verificationEvidence, {
  abiSha256,
  verificationEvidenceSha256,
});
validatePublishedDeploymentManifest(manifest);
console.log(JSON.stringify(manifest, null, 2));
