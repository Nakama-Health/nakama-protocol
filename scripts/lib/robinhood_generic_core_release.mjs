// SPDX-License-Identifier: AGPL-3.0-or-later

import { runReleasePreflight } from "./ethereum_release_preflight.mjs";
import {
  validateRobinhoodGenericTestnetReleaseManifest,
  validateRobinhoodTestnetSettlementAssetConfiguration,
} from "./robinhood_generic_core_guard.mjs";

export const ROBINHOOD_GENERIC_TESTNET_RELEASE_PATH =
  "deployments/robinhood-testnet/generic-core.release.json";

export function buildRobinhoodGenericCorePromotionConfig(
  releaseManifest,
  env = process.env
) {
  return {
    sourceCommit: releaseManifest.sourceCommit,
    expectedDeployer: releaseManifest.expectedDeployer,
    qualificationReportSha256: releaseManifest.qualificationReportSha256,
    releaseApprovalSha256: releaseManifest.releaseApprovalSha256,
    settlementAsset:
      validateRobinhoodTestnetSettlementAssetConfiguration(env),
  };
}

export async function runRobinhoodGenericCoreReleasePreflight(
  config,
  root = process.cwd()
) {
  return runReleasePreflight(config, root, {
    releaseManifestRelativePath: ROBINHOOD_GENERIC_TESTNET_RELEASE_PATH,
    missingReleaseManifestMessage:
      "Missing ignored deployments/robinhood-testnet/generic-core.release.json; populate it only after testnet qualification review and release approval",
    validateManifest: validateRobinhoodGenericTestnetReleaseManifest,
  });
}
