// SPDX-License-Identifier: AGPL-3.0-or-later

import { getAddress } from "ethers";

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

function validateCommonDeploymentFields(deployment) {
  requireCondition(deployment?.schemaVersion === 1, "Deployment schemaVersion must be 1");
  requireCondition(deployment.chainId === 1, "Deployment chainId must be 1");
  requireCondition(deployment.caip2 === "eip155:1", "Deployment caip2 must be eip155:1");
  requireCondition(
    deployment.contractName === "NakamaCoverageProtocol",
    "Deployment contractName must be NakamaCoverageProtocol",
  );
  const protocolAddress = normalizedAddress(deployment.protocolAddress, "protocolAddress");
  const deployer = normalizedAddress(deployment.deployer, "deployer");
  requireCondition(
    typeof deployment.deploymentTransaction === "string"
      && BYTES32_PATTERN.test(deployment.deploymentTransaction),
    "deploymentTransaction must be a 32-byte transaction hash",
  );
  requireCondition(
    Number.isSafeInteger(deployment.deploymentBlock) && deployment.deploymentBlock > 0,
    "deploymentBlock must be a positive safe integer",
  );
  requireCondition(
    Number.isSafeInteger(deployment.confirmations) && deployment.confirmations >= 12,
    "confirmations must be a safe integer of at least 12",
  );
  requireCondition(
    typeof deployment.sourceCommit === "string" && SOURCE_COMMIT_PATTERN.test(deployment.sourceCommit),
    "sourceCommit must be a lowercase 40-character commit hash",
  );
  requireCondition(
    typeof deployment.runtimeBytecodeHash === "string"
      && BYTES32_PATTERN.test(deployment.runtimeBytecodeHash),
    "runtimeBytecodeHash must be a 32-byte hash",
  );
  return { protocolAddress, deployer };
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
    deployment.runtimeBytecodeHash === release.protocolRuntimeBytecodeHash,
    "Intermediate runtimeBytecodeHash does not match the approved runtime",
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
  return { ...deployment, ...normalized };
}

export function validateSourceVerificationEvidence(evidence, deployment) {
  requireCondition(evidence?.schemaVersion === 1, "Verification evidence schemaVersion must be 1");
  requireCondition(evidence.status === "verified", "Source verification evidence status must be verified");
  requireCondition(evidence.chainId === 1, "Source verification evidence chainId must be 1");
  requireCondition(evidence.caip2 === "eip155:1", "Source verification evidence caip2 must be eip155:1");
  requireCondition(
    evidence.contractName === "NakamaCoverageProtocol",
    "Source verification evidence contractName must be NakamaCoverageProtocol",
  );
  requireCondition(
    normalizedAddress(evidence.protocolAddress, "verification protocolAddress")
      === deployment.protocolAddress,
    "Source verification evidence protocolAddress does not match the deployment",
  );
  requireCondition(
    evidence.deploymentTransaction === deployment.deploymentTransaction,
    "Source verification evidence transaction does not match the deployment",
  );
  requireCondition(
    evidence.sourceCommit === deployment.sourceCommit,
    "Source verification evidence sourceCommit does not match the deployment",
  );
  requireCondition(
    evidence.runtimeBytecodeHash === deployment.runtimeBytecodeHash,
    "Source verification evidence runtime hash does not match the deployment",
  );
  requireCondition(
    typeof evidence.verificationProvider === "string" && evidence.verificationProvider.trim() !== "",
    "Source verification evidence must name its provider",
  );
  let verificationUrl;
  try {
    verificationUrl = new URL(evidence.verificationUrl);
  } catch {
    throw new Error("Source verification evidence must include a valid verificationUrl");
  }
  requireCondition(
    verificationUrl.protocol === "https:",
    "Source verification evidence verificationUrl must use https",
  );
  requireCondition(
    typeof evidence.verifiedAt === "string" && Number.isFinite(Date.parse(evidence.verifiedAt)),
    "Source verification evidence must include an ISO-compatible verifiedAt timestamp",
  );
  return evidence;
}

export function buildPublishedDeploymentManifest(
  deployment,
  verificationEvidence,
  { abiSha256, verificationEvidenceSha256 },
) {
  requireCondition(SHA256_PATTERN.test(abiSha256), "abiSha256 must be a lowercase SHA-256 digest");
  requireCondition(
    SHA256_PATTERN.test(verificationEvidenceSha256),
    "verificationEvidenceSha256 must be a lowercase SHA-256 digest",
  );
  return {
    schemaVersion: 1,
    status: "deployed",
    chainId: 1,
    caip2: "eip155:1",
    contractName: "NakamaCoverageProtocol",
    protocolAddress: deployment.protocolAddress,
    deployer: deployment.deployer,
    deploymentTransaction: deployment.deploymentTransaction,
    deploymentBlock: deployment.deploymentBlock,
    confirmations: deployment.confirmations,
    sourceCommit: deployment.sourceCommit,
    runtimeBytecodeHash: deployment.runtimeBytecodeHash,
    abiArtifact: FINAL_SDK_ABI_ARTIFACT,
    abiSha256,
    verified: true,
    auditStatus: "audited",
    auditReportSha256: deployment.auditReportSha256,
    releaseApprovalSha256: deployment.releaseApprovalSha256,
    protocolArtifactSha256: deployment.protocolArtifactSha256,
    verificationProvider: verificationEvidence.verificationProvider,
    verificationUrl: verificationEvidence.verificationUrl,
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
    typeof manifest.verificationProvider === "string" && manifest.verificationProvider.trim() !== "",
    "Published deployment must name its verificationProvider",
  );
  let verificationUrl;
  try {
    verificationUrl = new URL(manifest.verificationUrl);
  } catch {
    throw new Error("Published deployment must include a valid verificationUrl");
  }
  requireCondition(verificationUrl.protocol === "https:", "Published verificationUrl must use https");
  return manifest;
}
