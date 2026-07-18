// SPDX-License-Identifier: AGPL-3.0-or-later

import { getAddress } from "ethers";

import { canonicalImmutableReferences } from "./ethereum_bytecode.mjs";
import { sourcifyLookupUrl } from "./ethereum_chain_verification.mjs";

export const FINAL_SDK_ABI_ARTIFACT = "contracts/ethereum/NakamaCoverageProtocol.abi.json";

const ADDRESS_PATTERN = /^0x[0-9a-fA-F]{40}$/;
const BYTES32_PATTERN = /^0x[0-9a-fA-F]{64}$/;
const SHA256_PATTERN = /^[0-9a-f]{64}$/;
const SOURCE_COMMIT_PATTERN = /^[0-9a-f]{40}$/;

function requireCondition(condition, message) {
  if (!condition) throw new Error(message);
}

function normalizedAddress(value, field) {
  requireCondition(typeof value === "string" && ADDRESS_PATTERN.test(value), `${field} must be an address`);
  const address = getAddress(value);
  requireCondition(address !== "0x0000000000000000000000000000000000000000", `${field} cannot be zero`);
  return address;
}

function equalReferences(candidate, approved) {
  const normalizedCandidate = canonicalImmutableReferences(candidate);
  const normalizedApproved = canonicalImmutableReferences(approved);
  requireCondition(
    JSON.stringify(normalizedCandidate) === JSON.stringify(normalizedApproved),
    "immutableReferences must exactly match the approved generated artifact",
  );
  return normalizedApproved;
}

function validateCommonDeploymentFields(deployment) {
  requireCondition(deployment?.schemaVersion === 2, "Deployment schemaVersion must be 2");
  requireCondition(deployment.chainId === 1, "Deployment chainId must be 1");
  requireCondition(deployment.caip2 === "eip155:1", "Deployment caip2 must be eip155:1");
  requireCondition(
    deployment.contractName === "NakamaCoverageProtocol",
    "Deployment contractName must be NakamaCoverageProtocol",
  );
  const protocolAddress = normalizedAddress(deployment.protocolAddress, "protocolAddress");
  const deployer = normalizedAddress(deployment.deployer, "deployer");
  for (const field of [
    "deploymentTransaction",
    "deploymentBlockHash",
    "creationBytecodeHash",
    "runtimeBytecodeHash",
    "runtimeBytecodeTemplateHash",
  ]) {
    requireCondition(
      typeof deployment[field] === "string" && BYTES32_PATTERN.test(deployment[field]),
      `${field} must be a 32-byte hash`,
    );
  }
  requireCondition(
    Number.isSafeInteger(deployment.deploymentBlock) && deployment.deploymentBlock > 0,
    "deploymentBlock must be a positive safe integer",
  );
  requireCondition(
    Number.isSafeInteger(deployment.confirmations) && deployment.confirmations >= 12,
    "confirmations must be a safe integer of at least 12",
  );
  requireCondition(
    Number.isSafeInteger(deployment.runtimeBytecodeBytes)
      && deployment.runtimeBytecodeBytes > 0
      && deployment.runtimeBytecodeBytes <= 24_576,
    "runtimeBytecodeBytes must be a positive safe integer within the EIP-170 limit",
  );
  requireCondition(
    typeof deployment.sourceCommit === "string" && SOURCE_COMMIT_PATTERN.test(deployment.sourceCommit),
    "sourceCommit must be a lowercase 40-character commit hash",
  );
  const immutableReferences = canonicalImmutableReferences(deployment.immutableReferences);
  return { protocolAddress, deployer, immutableReferences };
}

function canonicalJson(value) {
  if (Array.isArray(value)) return value.map(canonicalJson);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonicalJson(value[key])]),
    );
  }
  return value;
}

export function validateSdkAbi(sdkAbi, approvedProtocolAbi) {
  requireCondition(Array.isArray(sdkAbi), "The SDK ABI artifact must contain a top-level JSON ABI array");
  requireCondition(
    Array.isArray(approvedProtocolAbi),
    "The approved protocol artifact does not contain a canonical ABI array",
  );
  requireCondition(
    JSON.stringify(canonicalJson(sdkAbi)) === JSON.stringify(canonicalJson(approvedProtocolAbi)),
    "The SDK ABI does not structurally match the approved NakamaCoverageProtocol ABI",
  );
  return sdkAbi;
}

export function validateIntermediateDeployment(deployment, release) {
  const normalized = validateCommonDeploymentFields(deployment);
  requireCondition(deployment.status === "deployed-unverified", "Intermediate status must be deployed-unverified");
  requireCondition(deployment.verified === false, "Intermediate deployment must remain unverified");
  requireCondition(deployment.auditStatus === "audited", "Intermediate auditStatus must be audited");
  requireCondition(
    deployment.abiArtifact === "shared/ethereum/protocol_contract.json",
    "Intermediate abiArtifact must name the protocol repository artifact",
  );
  requireCondition(
    deployment.sourceCommit === release.headCommit,
    "Intermediate sourceCommit does not match the release checkout",
  );
  requireCondition(
    normalized.deployer === normalizedAddress(release.releaseManifest.expectedDeployer, "expectedDeployer"),
    "Intermediate deployer does not match the approved release",
  );
  requireCondition(
    deployment.runtimeBytecodeTemplateHash === release.protocolRuntimeBytecodeTemplateHash,
    "Intermediate runtimeBytecodeTemplateHash does not match the approved runtime template",
  );
  requireCondition(
    deployment.creationBytecodeHash === release.protocolCreationBytecodeHash,
    "Intermediate creationBytecodeHash does not match the approved artifact",
  );
  requireCondition(
    deployment.runtimeBytecodeBytes === release.runtimeBytecodeBytes,
    "Intermediate runtimeBytecodeBytes does not match the approved artifact",
  );
  const immutableReferences = equalReferences(
    normalized.immutableReferences,
    release.protocolImmutableReferences,
  );
  requireCondition(
    deployment.protocolArtifactSha256 === release.protocolArtifactSha256,
    "Intermediate protocolArtifactSha256 does not match the approved artifact",
  );
  requireCondition(
    deployment.auditReportSha256 === release.releaseManifest.auditReportSha256,
    "Intermediate auditReportSha256 does not match the approved release",
  );
  requireCondition(
    deployment.releaseApprovalSha256 === release.releaseManifest.releaseApprovalSha256,
    "Intermediate releaseApprovalSha256 does not match the approved release",
  );
  return { ...deployment, ...normalized, immutableReferences };
}

export function buildPublishedDeploymentManifest(
  deployment,
  sourceVerification,
  { abiSha256, verificationEvidenceSha256 },
) {
  requireCondition(SHA256_PATTERN.test(abiSha256), "abiSha256 must be a lowercase SHA-256 digest");
  requireCondition(
    SHA256_PATTERN.test(verificationEvidenceSha256),
    "verificationEvidenceSha256 must be a lowercase SHA-256 digest",
  );
  return {
    schemaVersion: 2,
    status: "deployed",
    chainId: 1,
    caip2: "eip155:1",
    contractName: "NakamaCoverageProtocol",
    protocolAddress: deployment.protocolAddress,
    deployer: deployment.deployer,
    deploymentTransaction: deployment.deploymentTransaction,
    deploymentBlock: deployment.deploymentBlock,
    deploymentBlockHash: deployment.deploymentBlockHash,
    confirmations: deployment.confirmations,
    sourceCommit: deployment.sourceCommit,
    creationBytecodeHash: deployment.creationBytecodeHash,
    runtimeBytecodeHash: deployment.runtimeBytecodeHash,
    runtimeBytecodeTemplateHash: deployment.runtimeBytecodeTemplateHash,
    runtimeBytecodeBytes: deployment.runtimeBytecodeBytes,
    immutableReferences: deployment.immutableReferences,
    abiArtifact: FINAL_SDK_ABI_ARTIFACT,
    abiSha256,
    verified: true,
    auditStatus: "audited",
    auditReportSha256: deployment.auditReportSha256,
    releaseApprovalSha256: deployment.releaseApprovalSha256,
    protocolArtifactSha256: deployment.protocolArtifactSha256,
    verificationProvider: sourceVerification.verificationProvider,
    verificationUrl: sourceVerification.verificationUrl,
    sourceVerifiedAt: sourceVerification.sourceVerifiedAt,
    sourcifyMatchId: sourceVerification.sourcifyMatchId,
    creationMatch: sourceVerification.creationMatch,
    runtimeMatch: sourceVerification.runtimeMatch,
    verificationEvidenceSha256,
  };
}

export function validatePublishedDeploymentManifest(manifest) {
  validateCommonDeploymentFields(manifest);
  requireCondition(manifest.status === "deployed", "Published deployment status must be deployed");
  requireCondition(manifest.verified === true, "Published deployment must be verified");
  requireCondition(manifest.auditStatus === "audited", "Published deployment auditStatus must be audited");
  requireCondition(
    manifest.abiArtifact === FINAL_SDK_ABI_ARTIFACT,
    `Published abiArtifact must be ${FINAL_SDK_ABI_ARTIFACT}`,
  );
  for (const field of [
    "abiSha256",
    "auditReportSha256",
    "releaseApprovalSha256",
    "protocolArtifactSha256",
    "verificationEvidenceSha256",
  ]) {
    requireCondition(
      typeof manifest[field] === "string" && SHA256_PATTERN.test(manifest[field]),
      `${field} must be a lowercase SHA-256 digest`,
    );
  }
  requireCondition(
    manifest.verificationProvider === "sourcify-v2",
    "Published verificationProvider must be sourcify-v2",
  );
  requireCondition(
    manifest.verificationUrl === sourcifyLookupUrl(manifest.protocolAddress),
    "Published verificationUrl must be the canonical Sourcify v2 lookup",
  );
  requireCondition(manifest.creationMatch === "exact_match", "Published creationMatch must be exact_match");
  requireCondition(manifest.runtimeMatch === "exact_match", "Published runtimeMatch must be exact_match");
  requireCondition(
    typeof manifest.sourceVerifiedAt === "string" && Number.isFinite(Date.parse(manifest.sourceVerifiedAt)),
    "Published sourceVerifiedAt must be an ISO-compatible timestamp",
  );
  requireCondition(
    typeof manifest.sourcifyMatchId === "string" && manifest.sourcifyMatchId.trim() !== "",
    "Published Sourcify matchId is required",
  );
  return manifest;
}
