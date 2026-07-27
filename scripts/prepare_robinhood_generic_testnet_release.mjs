// SPDX-License-Identifier: AGPL-3.0-or-later

import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { promisify } from "node:util";
import { getAddress } from "ethers";

import { ETHEREUM_CONTRACT_NAMES } from "./lib/ethereum_contract_set.mjs";
import {
  ROBINHOOD_GENERIC_TESTNET_CAIP2,
  ROBINHOOD_GENERIC_TESTNET_CHAIN_ID,
  ROBINHOOD_TESTNET_SETTLEMENT_ASSET_CLASSIFICATION,
  ROBINHOOD_TESTNET_SETTLEMENT_ASSET_CONTRACT,
} from "./lib/robinhood_generic_core_guard.mjs";

const execFileAsync = promisify(execFile);
const RELEASE_CONFIRMATION =
  "DEPLOY_IMMUTABLE_NAKAMA_GENERIC_CORE_TO_ROBINHOOD_TESTNET";

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

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

async function readJson(path, label) {
  let raw;
  try {
    raw = await readFile(path, "utf8");
  } catch {
    throw new Error(`${label} is missing`);
  }
  let value;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new Error(`${label} is not valid JSON`);
  }
  return { raw, value };
}

function requireCondition(condition, message) {
  if (!condition) throw new Error(message);
}

const assetPath = argument("--asset");
const qualificationPath = argument("--qualification");
const approvalPath = argument("--approval");
const outputPath = argument("--output");
const root = process.cwd();

const [
  { stdout: headCommit },
  { stdout: statusPorcelain },
  asset,
  qualification,
  approval,
  protocolArtifact,
] = await Promise.all([
  execFileAsync("git", ["rev-parse", "HEAD"], { cwd: root }),
  execFileAsync("git", ["status", "--porcelain=v1", "--untracked-files=all"], {
    cwd: root,
  }),
  readJson(assetPath, "Robinhood test settlement-asset receipt"),
  readJson(qualificationPath, "Robinhood testnet qualification record"),
  readJson(approvalPath, "Robinhood testnet approval record"),
  readJson(
    resolve(root, "shared/ethereum/protocol_contract.json"),
    "generated Ethereum protocol artifact"
  ),
]);

const sourceCommit = headCommit.trim();
requireCondition(
  /^[0-9a-f]{40}$/.test(sourceCommit),
  "HEAD must be a lowercase 40-character commit hash"
);
requireCondition(
  statusPorcelain.trim() === "",
  "Robinhood testnet release preparation requires a clean checkout"
);

const assetRecord = asset.value;
const expectedDeployer = getAddress(assetRecord.deployer);
requireCondition(
  assetRecord.schemaVersion === 1 &&
    assetRecord.status === "deployed-unverified" &&
    assetRecord.chainId === Number(ROBINHOOD_GENERIC_TESTNET_CHAIN_ID) &&
    assetRecord.caip2 === ROBINHOOD_GENERIC_TESTNET_CAIP2 &&
    assetRecord.contractName === ROBINHOOD_TESTNET_SETTLEMENT_ASSET_CONTRACT &&
    assetRecord.classification ===
      ROBINHOOD_TESTNET_SETTLEMENT_ASSET_CLASSIFICATION &&
    assetRecord.canonical === false &&
    assetRecord.blockscoutSourceVerified === false &&
    assetRecord.sourcifyExactMatchVerified === false &&
    assetRecord.productionEnabled === false &&
    assetRecord.sourceCommit === sourceCommit,
  "Settlement-asset receipt is not the expected disabled Robinhood testnet deployment"
);

const qualificationRecord = qualification.value;
requireCondition(
  qualificationRecord.schemaVersion === 1 &&
    qualificationRecord.status === "qualified-testnet" &&
    qualificationRecord.chainId ===
      Number(ROBINHOOD_GENERIC_TESTNET_CHAIN_ID) &&
    qualificationRecord.caip2 === ROBINHOOD_GENERIC_TESTNET_CAIP2 &&
    qualificationRecord.sourceCommit === sourceCommit &&
    getAddress(qualificationRecord.deployer) === expectedDeployer &&
    qualificationRecord.testsPassed === true &&
    qualificationRecord.productionEnabled === false &&
    Array.isArray(qualificationRecord.providers) &&
    qualificationRecord.providers.length === 2 &&
    new Set(
      qualificationRecord.providers.map((provider) =>
        String(provider.hostname).toLowerCase()
      )
    ).size === 2,
  "Qualification record is not an independent, passing, disabled testnet qualification"
);

const approvalRecord = approval.value;
requireCondition(
  approvalRecord.schemaVersion === 1 &&
    approvalRecord.status === "approved-for-testnet" &&
    approvalRecord.scope === "robinhood-testnet-only" &&
    approvalRecord.sourceCommit === sourceCommit &&
    getAddress(approvalRecord.deployer) === expectedDeployer &&
    approvalRecord.confirmation === RELEASE_CONFIRMATION &&
    approvalRecord.productionEnabled === false &&
    typeof approvalRecord.authorizedBy === "string" &&
    approvalRecord.authorizedBy.trim() !== "" &&
    typeof approvalRecord.authorizedAt === "string" &&
    Number.isFinite(Date.parse(approvalRecord.authorizedAt)),
  "Approval record does not authorize this exact disabled Robinhood testnet release"
);

const protocol = protocolArtifact.value;
requireCondition(
  protocol.schemaVersion === 3 &&
    protocol.chainFamily === "eip155" &&
    protocol.canonicalChain === "eip155:1",
  "Generated protocol artifact is not the canonical EVM schema-v3 artifact"
);

const contracts = Object.fromEntries(
  ETHEREUM_CONTRACT_NAMES.map((contractName) => {
    const contract = protocol.contracts?.[contractName];
    requireCondition(
      /^0x[0-9a-fA-F]{64}$/.test(contract?.creationBytecodeHash) &&
        /^0x[0-9a-fA-F]{64}$/.test(contract?.runtimeBytecodeTemplateHash),
      `${contractName} artifact hashes are missing`
    );
    return [
      contractName,
      {
        creationBytecodeHash: contract.creationBytecodeHash,
        runtimeBytecodeTemplateHash: contract.runtimeBytecodeTemplateHash,
      },
    ];
  })
);

const release = {
  schemaVersion: 3,
  status: "approved-for-testnet",
  chainId: Number(ROBINHOOD_GENERIC_TESTNET_CHAIN_ID),
  caip2: ROBINHOOD_GENERIC_TESTNET_CAIP2,
  sourceCommit,
  expectedDeployer,
  qualificationReportSha256: sha256(qualification.raw),
  releaseApprovalSha256: sha256(approval.raw),
  protocolArtifactSha256: sha256(protocolArtifact.raw),
  settlementAsset: {
    address: getAddress(assetRecord.address),
    contractName: assetRecord.contractName,
    name: assetRecord.name,
    symbol: assetRecord.symbol,
    decimals: assetRecord.decimals,
    deploymentTransaction: assetRecord.deploymentTransaction.toLowerCase(),
    classification: assetRecord.classification,
    canonical: false,
  },
  contracts,
  qualificationReviewCompleted: true,
  releaseApproved: true,
};

await writeFile(outputPath, `${JSON.stringify(release, null, 2)}\n`, {
  encoding: "utf8",
  flag: "wx",
  mode: 0o600,
});

console.log(
  JSON.stringify(
    {
      status: release.status,
      sourceCommit,
      expectedDeployer,
      settlementAsset: release.settlementAsset,
      qualificationReportSha256: release.qualificationReportSha256,
      releaseApprovalSha256: release.releaseApprovalSha256,
      protocolArtifactSha256: release.protocolArtifactSha256,
      outputPath,
      productionEnabled: false,
    },
    null,
    2
  )
);
