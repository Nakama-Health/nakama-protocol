// SPDX-License-Identifier: AGPL-3.0-or-later

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { getAddress } from "ethers";

import {
  buildPublishedDeploymentManifest,
  validateIntermediateDeployment,
  validatePublishedDeploymentManifest,
  validateSdkAbis,
} from "./lib/ethereum_manifest_promotion.mjs";
import {
  attestEthereumMainnetDeployment,
  verifySourcifyExactMatch,
} from "./lib/ethereum_chain_verification.mjs";
import { validateMainnetRpcUrl } from "./lib/ethereum_deploy_guard.mjs";
import { runReleasePreflight } from "./lib/ethereum_release_preflight.mjs";
import {
  ETHEREUM_CONTRACT_NAMES,
  ETHEREUM_LIVE_ROLES,
} from "./lib/ethereum_contract_set.mjs";

function argument(name) {
  const index = process.argv.indexOf(name);
  if (
    index === -1 ||
    !process.argv[index + 1] ||
    process.argv[index + 1].startsWith("--")
  ) {
    throw new Error(`Missing required argument: ${name}`);
  }
  return resolve(process.argv[index + 1]);
}

const deploymentPath = argument("--deployment");
const sdkAbiDirectory = argument("--sdk-abi-dir");
const rpcUrl = validateMainnetRpcUrl(
  process.env.ETHEREUM_MAINNET_RPC_URL?.trim() ?? ""
);
const localReleaseManifest = JSON.parse(
  await readFile(
    resolve(process.cwd(), "deployments/ethereum-mainnet.release.json"),
    "utf8"
  ).catch(() => {
    throw new Error(
      "Missing ignored deployments/ethereum-mainnet.release.json"
    );
  })
);
const release = await runReleasePreflight({
  sourceCommit: localReleaseManifest.sourceCommit,
  expectedDeployer: getAddress(localReleaseManifest.expectedDeployer),
  auditReportSha256: localReleaseManifest.auditReportSha256,
  releaseApprovalSha256: localReleaseManifest.releaseApprovalSha256,
});
const [deploymentRaw, ...sdkAbiRaw] = await Promise.all([
  readFile(deploymentPath, "utf8"),
  ...ETHEREUM_CONTRACT_NAMES.map((contractName) =>
    readFile(join(sdkAbiDirectory, `${contractName}.abi.json`), "utf8")
  ),
]);
const deployment = validateIntermediateDeployment(
  JSON.parse(deploymentRaw),
  release
);
const canonicalDeployment = await attestEthereumMainnetDeployment(
  deployment,
  release,
  { rpcUrl }
);
const sourceVerifications = Object.fromEntries(
  await Promise.all(
    ETHEREUM_LIVE_ROLES.map(async (role) => [
      role,
      await verifySourcifyExactMatch(
        canonicalDeployment.liveContracts[role].address
      ),
    ])
  )
);
const sdkAbis = Object.fromEntries(
  ETHEREUM_CONTRACT_NAMES.map((contractName, index) => [
    contractName,
    JSON.parse(sdkAbiRaw[index]),
  ])
);
validateSdkAbis(sdkAbis, release.contracts);
const abiSha256ByContract = Object.fromEntries(
  ETHEREUM_CONTRACT_NAMES.map((contractName, index) => [
    contractName,
    createHash("sha256").update(sdkAbiRaw[index]).digest("hex"),
  ])
);
const verificationEvidenceSha256 = createHash("sha256")
  .update(`${JSON.stringify(sourceVerifications, null, 2)}\n`)
  .digest("hex");
const manifest = buildPublishedDeploymentManifest(
  canonicalDeployment,
  sourceVerifications,
  {
    abiSha256ByContract,
    verificationEvidenceSha256,
  }
);
validatePublishedDeploymentManifest(manifest);
console.log(JSON.stringify(manifest, null, 2));
