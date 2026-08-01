// SPDX-License-Identifier: AGPL-3.0-or-later

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { getAddress } from "ethers";

import {
  attestEvmFactoryDeployment,
  verifySourcifyExactMatch,
} from "./lib/ethereum_chain_verification.mjs";
import {
  ETHEREUM_LIVE_ROLES,
} from "./lib/ethereum_contract_set.mjs";
import {
  writeExclusiveDeploymentRecord,
} from "./lib/ethereum_deployment_journal.mjs";
import {
  ROBINHOOD_GENERIC_TESTNET_CAIP2,
  ROBINHOOD_GENERIC_TESTNET_CHAIN_ID,
  ROBINHOOD_GENERIC_TESTNET_MINIMUM_FINAL_CONFIRMATIONS,
  validateIndependentRobinhoodRpcUrls,
  validateRobinhoodTestnetRpcUrl,
} from "./lib/robinhood_generic_core_guard.mjs";
import {
  buildRobinhoodRuntimeManifest,
  canonicalSha256,
  validateRobinhoodGenericCoreIntermediate,
  validateRobinhoodRuntimeManifest,
} from "./lib/robinhood_generic_core_manifest.mjs";
import {
  buildRobinhoodGenericCorePromotionConfig,
  ROBINHOOD_GENERIC_TESTNET_RELEASE_PATH,
  runRobinhoodGenericCoreReleasePreflight,
} from "./lib/robinhood_generic_core_release.mjs";
import {
  observeRobinhoodRuntimeBytecode,
  providerEvidence,
  requireMatchingRuntimeObservations,
  robinhoodDeploymentConsensusFingerprint,
  verifyRobinhoodBlockscoutContract,
  verifyRobinhoodBlockscoutSource,
  verifyRobinhoodTestnetSettlementAsset,
} from "./lib/robinhood_generic_core_verification.mjs";

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
const runtimeOutputPath = argument("--runtime-output");
const evidenceOutputPath = argument("--evidence-output");
const primaryRpcUrl = validateRobinhoodTestnetRpcUrl(
  process.env.ROBINHOOD_TESTNET_RPC_URL?.trim() ?? "",
  "ROBINHOOD_TESTNET_RPC_URL"
);
const fallbackRpcUrl = validateRobinhoodTestnetRpcUrl(
  process.env.ROBINHOOD_TESTNET_RPC_FALLBACK_URL?.trim() ?? "",
  "ROBINHOOD_TESTNET_RPC_FALLBACK_URL"
);
validateIndependentRobinhoodRpcUrls(primaryRpcUrl, fallbackRpcUrl);

const releaseManifest = JSON.parse(
  await readFile(
    resolve(process.cwd(), ROBINHOOD_GENERIC_TESTNET_RELEASE_PATH),
    "utf8"
  )
);
const release = await runRobinhoodGenericCoreReleasePreflight({
  ...buildRobinhoodGenericCorePromotionConfig(releaseManifest),
  expectedDeployer: getAddress(releaseManifest.expectedDeployer),
});
const deployment = validateRobinhoodGenericCoreIntermediate(
  JSON.parse(await readFile(deploymentPath, "utf8")),
  release
);

const attestationOptions = {
  expectedChainId: ROBINHOOD_GENERIC_TESTNET_CHAIN_ID,
  expectedCaip2: ROBINHOOD_GENERIC_TESTNET_CAIP2,
  minimumFinalConfirmations:
    ROBINHOOD_GENERIC_TESTNET_MINIMUM_FINAL_CONFIRMATIONS,
  chainLabel: "Robinhood Chain Testnet",
};
const primaryAttestation = await attestEvmFactoryDeployment(
  deployment,
  release,
  { rpcUrl: primaryRpcUrl, ...attestationOptions }
);
const fallbackAttestation = await attestEvmFactoryDeployment(
  deployment,
  release,
  { rpcUrl: fallbackRpcUrl, ...attestationOptions }
);
const primaryRuntime = await observeRobinhoodRuntimeBytecode(
  primaryRpcUrl,
  deployment.liveContracts
);
const fallbackRuntime = await observeRobinhoodRuntimeBytecode(
  fallbackRpcUrl,
  deployment.liveContracts
);
const primarySettlementAsset = await verifyRobinhoodTestnetSettlementAsset(
  primaryRpcUrl,
  deployment.settlementAsset
);
const fallbackSettlementAsset = await verifyRobinhoodTestnetSettlementAsset(
  fallbackRpcUrl,
  deployment.settlementAsset
);
if (
  robinhoodDeploymentConsensusFingerprint(primaryAttestation) !==
  robinhoodDeploymentConsensusFingerprint(fallbackAttestation)
) {
  throw new Error(
    "Independent Robinhood testnet providers disagree on the deployment"
  );
}
if (
  JSON.stringify(primarySettlementAsset) !==
    JSON.stringify(fallbackSettlementAsset) ||
  JSON.stringify(primarySettlementAsset) !==
    JSON.stringify(deployment.settlementAsset)
) {
  throw new Error(
    "Independent Robinhood testnet providers disagree on the settlement asset"
  );
}
const runtimeBytecodeSha256 = requireMatchingRuntimeObservations(
  deployment,
  primaryRuntime,
  fallbackRuntime
);

const sourceVerification = Object.fromEntries(
  await Promise.all(
    ETHEREUM_LIVE_ROLES.map(async (role) => {
      const contract = deployment.liveContracts[role];
      const [blockscout, sourcify] = await Promise.all([
        verifyRobinhoodBlockscoutContract(role, contract),
        verifySourcifyExactMatch(contract.address, {
          chainId: Number(ROBINHOOD_GENERIC_TESTNET_CHAIN_ID),
          chainLabel: "Robinhood Chain Testnet",
        }),
      ]);
      return [role, { blockscout, sourcify }];
    })
  )
);
const [settlementAssetBlockscout, settlementAssetSourcify] =
  await Promise.all([
    verifyRobinhoodBlockscoutSource(
      deployment.settlementAsset.address,
      deployment.settlementAsset.contractName
    ),
    verifySourcifyExactMatch(deployment.settlementAsset.address, {
      chainId: Number(ROBINHOOD_GENERIC_TESTNET_CHAIN_ID),
      chainLabel: "Robinhood Chain Testnet",
    }),
  ]);
const providers = [
  providerEvidence(primaryRpcUrl, primaryAttestation, primaryRuntime),
  providerEvidence(fallbackRpcUrl, fallbackAttestation, fallbackRuntime),
];
if (
  providers[0].providerHostname === providers[1].providerHostname ||
  providers[0].rpcUrlSha256 === providers[1].rpcUrlSha256
) {
  throw new Error(
    "Runtime qualification requires two independent Robinhood RPC providers"
  );
}

const runtimeManifest = validateRobinhoodRuntimeManifest(
  buildRobinhoodRuntimeManifest(deployment, runtimeBytecodeSha256)
);
const runtimeManifestBytes = `${JSON.stringify(runtimeManifest, null, 2)}\n`;
const runtimeManifestSha256 = createHash("sha256")
  .update(runtimeManifestBytes)
  .digest("hex");
const verificationEvidence = {
  schemaVersion: 1,
  status: "verified-testnet",
  chainId: Number(ROBINHOOD_GENERIC_TESTNET_CHAIN_ID),
  caip2: ROBINHOOD_GENERIC_TESTNET_CAIP2,
  sourceCommit: deployment.sourceCommit,
  protocolArtifactSha256: deployment.protocolArtifactSha256,
  qualificationReportSha256: deployment.qualificationReportSha256,
  releaseApprovalSha256: deployment.releaseApprovalSha256,
  releaseManifestSha256: canonicalSha256(releaseManifest),
  deploymentTransaction: deployment.deploymentTransaction,
  deploymentBlock: deployment.deploymentBlock,
  deploymentBlockHash: deployment.deploymentBlockHash,
  deployer: deployment.deployer,
  settlementAsset: deployment.settlementAsset,
  liveContracts: Object.fromEntries(
    ETHEREUM_LIVE_ROLES.map((role) => [
      role,
      {
        contractName: deployment.liveContracts[role].contractName,
        address: deployment.liveContracts[role].address,
        runtimeBytecodeSha256:
          deployment.liveContracts[role].runtimeBytecodeSha256,
      },
    ])
  ),
  providers,
  sourceVerification,
  settlementAssetSourceVerification: {
    blockscout: settlementAssetBlockscout,
    sourcify: settlementAssetSourcify,
  },
  runtimeManifestSha256,
  productionEnabled: false,
};
const verificationEvidenceSha256 = canonicalSha256(verificationEvidence);
const evidenceRecord = {
  ...verificationEvidence,
  verificationEvidenceSha256,
};

await writeExclusiveDeploymentRecord(runtimeOutputPath, runtimeManifest);
await writeExclusiveDeploymentRecord(evidenceOutputPath, evidenceRecord);
console.log(
  JSON.stringify(
    {
      status: "verified-testnet",
      runtimeManifestPath: runtimeOutputPath,
      runtimeManifestSha256,
      evidencePath: evidenceOutputPath,
      verificationEvidenceSha256,
      productionEnabled: false,
    },
    null,
    2
  )
);
