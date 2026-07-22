// SPDX-License-Identifier: AGPL-3.0-or-later

import { getAddress } from "ethers";

import { canonicalImmutableReferences } from "./ethereum_bytecode.mjs";
import { sourcifyLookupUrl } from "./ethereum_chain_verification.mjs";
import {
  ETHEREUM_CONTRACT_NAMES,
  ETHEREUM_LIVE_CONTRACTS,
  ETHEREUM_LIVE_ROLES,
  RESERVE_VAULT_TEMPLATE,
  protocolAbiPath,
  requireExactKeys,
} from "./ethereum_contract_set.mjs";

export const FINAL_SDK_ABI_PREFIX = "contracts/ethereum";

const ADDRESS_PATTERN = /^0x[0-9a-fA-F]{40}$/;
const BYTES32_PATTERN = /^0x[0-9a-fA-F]{64}$/;
const SHA256_PATTERN = /^[0-9a-f]{64}$/;
const SOURCE_COMMIT_PATTERN = /^[0-9a-f]{40}$/;
const LIVE_CONTRACT_FIELDS = [
  "contractName",
  "address",
  "deploymentKind",
  "factoryNonce",
  "creationBytecodeHash",
  "creationBytecodeBytes",
  "runtimeBytecodeHash",
  "runtimeBytecodeTemplateHash",
  "runtimeBytecodeBytes",
  "immutableReferences",
  "abiArtifact",
  "abiSha256",
  "verification",
];
const TEMPLATE_FIELDS = [
  "contractName",
  "deploymentKind",
  "saltDerivation",
  "creationBytecodeHash",
  "creationBytecodeBytes",
  "runtimeBytecodeTemplateHash",
  "runtimeBytecodeBytes",
  "immutableReferences",
  "abiArtifact",
  "abiSha256",
];
const DEPLOYMENT_FIELDS = [
  "schemaVersion",
  "status",
  "chainId",
  "caip2",
  "entryContract",
  "deployer",
  "deploymentTransaction",
  "deploymentBlock",
  "deploymentBlockHash",
  "confirmations",
  "sourceCommit",
  "protocolArtifactSha256",
  "liveContracts",
  "contractTemplates",
  "verified",
  "auditStatus",
  "auditReportSha256",
  "releaseApprovalSha256",
  "verificationEvidenceSha256",
];

function requireCondition(condition, message) {
  if (!condition) throw new Error(message);
}

function normalizedAddress(value, field) {
  requireCondition(
    typeof value === "string" && ADDRESS_PATTERN.test(value),
    `${field} must be an address`
  );
  const address = getAddress(value);
  requireCondition(
    address !== "0x0000000000000000000000000000000000000000",
    `${field} cannot be zero`
  );
  return address;
}

function requireHash(value, field) {
  requireCondition(
    typeof value === "string" && BYTES32_PATTERN.test(value),
    `${field} must be a 32-byte hash`
  );
  return value;
}

function requireSha256(value, field) {
  requireCondition(
    typeof value === "string" && SHA256_PATTERN.test(value),
    `${field} must be a lowercase SHA-256 digest`
  );
  return value;
}

function equalReferences(candidate, approved, label) {
  const normalizedCandidate = canonicalImmutableReferences(candidate);
  const normalizedApproved = canonicalImmutableReferences(approved);
  requireCondition(
    JSON.stringify(normalizedCandidate) === JSON.stringify(normalizedApproved),
    `${label} immutableReferences must exactly match the approved generated artifact`
  );
  return normalizedApproved;
}

function canonicalJson(value) {
  if (Array.isArray(value)) return value.map(canonicalJson);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonicalJson(value[key])])
    );
  }
  return value;
}

export function validateSdkAbi(sdkAbi, approvedAbi, contractName = "contract") {
  requireCondition(
    Array.isArray(sdkAbi),
    `${contractName} SDK ABI artifact must contain a top-level JSON ABI array`
  );
  requireCondition(
    Array.isArray(approvedAbi),
    `Approved ${contractName} artifact does not contain a canonical ABI array`
  );
  requireCondition(
    JSON.stringify(canonicalJson(sdkAbi)) ===
      JSON.stringify(canonicalJson(approvedAbi)),
    `The SDK ABI does not structurally match the approved ${contractName} ABI`
  );
  return sdkAbi;
}

export function validateSdkAbis(sdkAbis, approvedContracts) {
  requireExactKeys(sdkAbis, ETHEREUM_CONTRACT_NAMES, "SDK ABI map");
  for (const contractName of ETHEREUM_CONTRACT_NAMES) {
    validateSdkAbi(
      sdkAbis[contractName],
      approvedContracts[contractName]?.abi,
      contractName
    );
  }
  return sdkAbis;
}

function validateLiveContract(role, contract, expectedAbiPrefix) {
  const identity = ETHEREUM_LIVE_CONTRACTS[role];
  requireExactKeys(contract, LIVE_CONTRACT_FIELDS, `${role} deployment`);
  requireCondition(
    contract.contractName === identity.contractName,
    `${role} contractName must be ${identity.contractName}`
  );
  requireCondition(
    contract.deploymentKind === identity.deploymentKind,
    `${role} deploymentKind is invalid`
  );
  requireCondition(
    contract.factoryNonce === identity.factoryNonce,
    `${role} factoryNonce is invalid`
  );
  const address = normalizedAddress(contract.address, `${role}.address`);
  for (const field of [
    "creationBytecodeHash",
    "runtimeBytecodeHash",
    "runtimeBytecodeTemplateHash",
  ]) {
    requireHash(contract[field], `${role}.${field}`);
  }
  requireCondition(
    Number.isSafeInteger(contract.creationBytecodeBytes) &&
      contract.creationBytecodeBytes > 0 &&
      contract.creationBytecodeBytes <= 49_152,
    `${role}.creationBytecodeBytes must be within the EIP-3860 limit`
  );
  requireCondition(
    Number.isSafeInteger(contract.runtimeBytecodeBytes) &&
      contract.runtimeBytecodeBytes > 0 &&
      contract.runtimeBytecodeBytes <= 24_576,
    `${role}.runtimeBytecodeBytes must be within the EIP-170 limit`
  );
  const immutableReferences = canonicalImmutableReferences(
    contract.immutableReferences
  );
  requireCondition(
    contract.abiArtifact ===
      protocolAbiPath(identity.contractName, expectedAbiPrefix),
    `${role}.abiArtifact is not canonical`
  );
  requireSha256(contract.abiSha256, `${role}.abiSha256`);
  return { ...contract, address, immutableReferences };
}

function validateReserveVaultTemplate(template, expectedAbiPrefix) {
  requireExactKeys(template, TEMPLATE_FIELDS, "reserveVault template");
  requireCondition(
    template.contractName === RESERVE_VAULT_TEMPLATE.contractName,
    "reserveVault contractName is invalid"
  );
  requireCondition(
    template.deploymentKind === RESERVE_VAULT_TEMPLATE.deploymentKind,
    "reserveVault deploymentKind is invalid"
  );
  requireCondition(
    template.saltDerivation === RESERVE_VAULT_TEMPLATE.saltDerivation,
    "reserveVault saltDerivation is invalid"
  );
  requireHash(
    template.creationBytecodeHash,
    "reserveVault.creationBytecodeHash"
  );
  requireHash(
    template.runtimeBytecodeTemplateHash,
    "reserveVault.runtimeBytecodeTemplateHash"
  );
  requireCondition(
    Number.isSafeInteger(template.creationBytecodeBytes) &&
      template.creationBytecodeBytes > 0 &&
      template.creationBytecodeBytes <= 49_152,
    "reserveVault.creationBytecodeBytes must be within the EIP-3860 limit"
  );
  requireCondition(
    Number.isSafeInteger(template.runtimeBytecodeBytes) &&
      template.runtimeBytecodeBytes > 0 &&
      template.runtimeBytecodeBytes <= 24_576,
    "reserveVault.runtimeBytecodeBytes must be within the EIP-170 limit"
  );
  const immutableReferences = canonicalImmutableReferences(
    template.immutableReferences
  );
  requireCondition(
    template.abiArtifact === protocolAbiPath("ReserveVault", expectedAbiPrefix),
    "reserveVault.abiArtifact is not canonical"
  );
  requireSha256(template.abiSha256, "reserveVault.abiSha256");
  return { ...template, immutableReferences };
}

function validateCommonDeploymentFields(deployment, expectedAbiPrefix) {
  requireExactKeys(deployment, DEPLOYMENT_FIELDS, "Deployment manifest");
  requireCondition(
    deployment.schemaVersion === 3,
    "Deployment schemaVersion must be 3"
  );
  requireCondition(deployment.chainId === 1, "Deployment chainId must be 1");
  requireCondition(
    deployment.caip2 === "eip155:1",
    "Deployment caip2 must be eip155:1"
  );
  requireCondition(
    deployment.entryContract === "NakamaProtocolFactory",
    "Deployment entryContract must be NakamaProtocolFactory"
  );
  const deployer = normalizedAddress(deployment.deployer, "deployer");
  requireHash(deployment.deploymentTransaction, "deploymentTransaction");
  requireHash(deployment.deploymentBlockHash, "deploymentBlockHash");
  requireCondition(
    Number.isSafeInteger(deployment.deploymentBlock) &&
      deployment.deploymentBlock > 0,
    "deploymentBlock must be a positive safe integer"
  );
  requireCondition(
    Number.isSafeInteger(deployment.confirmations) &&
      deployment.confirmations >= 12,
    "confirmations must be a safe integer of at least 12"
  );
  requireCondition(
    typeof deployment.sourceCommit === "string" &&
      SOURCE_COMMIT_PATTERN.test(deployment.sourceCommit),
    "sourceCommit must be a lowercase 40-character commit hash"
  );
  requireSha256(deployment.protocolArtifactSha256, "protocolArtifactSha256");
  requireExactKeys(
    deployment.liveContracts,
    ETHEREUM_LIVE_ROLES,
    "liveContracts"
  );
  const liveContracts = Object.fromEntries(
    ETHEREUM_LIVE_ROLES.map((role) => [
      role,
      validateLiveContract(
        role,
        deployment.liveContracts[role],
        expectedAbiPrefix
      ),
    ])
  );
  requireExactKeys(
    deployment.contractTemplates,
    ["reserveVault"],
    "contractTemplates"
  );
  const reserveVault = validateReserveVaultTemplate(
    deployment.contractTemplates.reserveVault,
    expectedAbiPrefix
  );
  return {
    ...deployment,
    deployer,
    liveContracts,
    contractTemplates: { reserveVault },
  };
}

export function validateIntermediateDeployment(deployment, release) {
  const normalized = validateCommonDeploymentFields(
    deployment,
    "shared/ethereum"
  );
  requireCondition(
    deployment.status === "deployed-unverified",
    "Intermediate status must be deployed-unverified"
  );
  requireCondition(
    deployment.verified === false,
    "Intermediate deployment must remain unverified"
  );
  requireCondition(
    deployment.auditStatus === "audited",
    "Intermediate auditStatus must be audited"
  );
  requireCondition(
    deployment.verificationEvidenceSha256 === null,
    "Intermediate verification evidence must be null"
  );
  requireCondition(
    deployment.sourceCommit === release.headCommit,
    "Intermediate sourceCommit does not match the release checkout"
  );
  requireCondition(
    normalized.deployer ===
      normalizedAddress(
        release.releaseManifest.expectedDeployer,
        "expectedDeployer"
      ),
    "Intermediate deployer does not match the approved release"
  );
  requireCondition(
    deployment.protocolArtifactSha256 === release.protocolArtifactSha256,
    "Intermediate protocolArtifactSha256 does not match the approved artifact"
  );
  requireCondition(
    deployment.auditReportSha256 === release.releaseManifest.auditReportSha256,
    "Intermediate auditReportSha256 does not match the approved release"
  );
  requireCondition(
    deployment.releaseApprovalSha256 ===
      release.releaseManifest.releaseApprovalSha256,
    "Intermediate releaseApprovalSha256 does not match the approved release"
  );
  for (const role of ETHEREUM_LIVE_ROLES) {
    const identity = ETHEREUM_LIVE_CONTRACTS[role];
    const actual = normalized.liveContracts[role];
    const approved = release.contracts[identity.contractName];
    requireCondition(
      actual.verification === null,
      `${role} intermediate verification must be null`
    );
    requireCondition(
      actual.creationBytecodeHash === approved.creationBytecodeHash,
      `${role} creationBytecodeHash does not match the approved artifact`
    );
    requireCondition(
      actual.creationBytecodeBytes === approved.creationBytecodeBytes,
      `${role} creationBytecodeBytes does not match the approved artifact`
    );
    requireCondition(
      actual.runtimeBytecodeTemplateHash ===
        approved.runtimeBytecodeTemplateHash,
      `${role} runtimeBytecodeTemplateHash does not match the approved artifact`
    );
    requireCondition(
      actual.runtimeBytecodeBytes === approved.runtimeBytecodeBytes,
      `${role} runtimeBytecodeBytes does not match the approved artifact`
    );
    requireCondition(
      actual.abiSha256 === approved.abiSha256,
      `${role} abiSha256 does not match the approved artifact`
    );
    equalReferences(
      actual.immutableReferences,
      approved.immutableReferences,
      role
    );
  }
  const template = normalized.contractTemplates.reserveVault;
  const approvedVault = release.contracts.ReserveVault;
  for (const field of [
    "creationBytecodeHash",
    "creationBytecodeBytes",
    "runtimeBytecodeTemplateHash",
    "runtimeBytecodeBytes",
    "abiSha256",
  ]) {
    requireCondition(
      template[field] === approvedVault[field],
      `reserveVault ${field} does not match the approved artifact`
    );
  }
  equalReferences(
    template.immutableReferences,
    approvedVault.immutableReferences,
    "reserveVault"
  );
  return normalized;
}

export function buildPublishedDeploymentManifest(
  deployment,
  sourceVerifications,
  { abiSha256ByContract, verificationEvidenceSha256 }
) {
  requireExactKeys(
    sourceVerifications,
    ETHEREUM_LIVE_ROLES,
    "Sourcify verification map"
  );
  requireExactKeys(
    abiSha256ByContract,
    ETHEREUM_CONTRACT_NAMES,
    "SDK ABI digest map"
  );
  requireSha256(verificationEvidenceSha256, "verificationEvidenceSha256");
  const liveContracts = Object.fromEntries(
    ETHEREUM_LIVE_ROLES.map((role) => {
      const contract = deployment.liveContracts[role];
      const contractName = ETHEREUM_LIVE_CONTRACTS[role].contractName;
      return [
        role,
        {
          ...contract,
          abiArtifact: protocolAbiPath(contractName, FINAL_SDK_ABI_PREFIX),
          abiSha256: requireSha256(
            abiSha256ByContract[contractName],
            `${contractName} abiSha256`
          ),
          verification: sourceVerifications[role],
        },
      ];
    })
  );
  const reserveVault = deployment.contractTemplates.reserveVault;
  return {
    ...deployment,
    schemaVersion: 3,
    status: "deployed",
    liveContracts,
    contractTemplates: {
      reserveVault: {
        ...reserveVault,
        abiArtifact: protocolAbiPath("ReserveVault", FINAL_SDK_ABI_PREFIX),
        abiSha256: requireSha256(
          abiSha256ByContract.ReserveVault,
          "ReserveVault abiSha256"
        ),
      },
    },
    verified: true,
    auditStatus: "audited",
    verificationEvidenceSha256,
  };
}

function validateSourceVerification(role, contract) {
  const verification = requireExactKeys(
    contract.verification,
    [
      "verificationProvider",
      "verificationUrl",
      "sourceVerifiedAt",
      "sourcifyMatchId",
      "creationMatch",
      "runtimeMatch",
    ],
    `${role} verification`
  );
  requireCondition(
    verification.verificationProvider === "sourcify-v2",
    `${role} verificationProvider must be sourcify-v2`
  );
  requireCondition(
    verification.verificationUrl === sourcifyLookupUrl(contract.address),
    `${role} verificationUrl must be the canonical Sourcify v2 lookup`
  );
  requireCondition(
    verification.creationMatch === "exact_match",
    `${role} creationMatch must be exact_match`
  );
  requireCondition(
    verification.runtimeMatch === "exact_match",
    `${role} runtimeMatch must be exact_match`
  );
  requireCondition(
    typeof verification.sourceVerifiedAt === "string" &&
      Number.isFinite(Date.parse(verification.sourceVerifiedAt)),
    `${role} sourceVerifiedAt must be an ISO-compatible timestamp`
  );
  requireCondition(
    typeof verification.sourcifyMatchId === "string" &&
      verification.sourcifyMatchId.trim() !== "",
    `${role} Sourcify matchId is required`
  );
}

export function validatePublishedDeploymentManifest(manifest) {
  const normalized = validateCommonDeploymentFields(
    manifest,
    FINAL_SDK_ABI_PREFIX
  );
  requireCondition(
    manifest.status === "deployed",
    "Published deployment status must be deployed"
  );
  requireCondition(
    manifest.verified === true,
    "Published deployment must be verified"
  );
  requireCondition(
    manifest.auditStatus === "audited",
    "Published deployment auditStatus must be audited"
  );
  for (const field of [
    "auditReportSha256",
    "releaseApprovalSha256",
    "protocolArtifactSha256",
    "verificationEvidenceSha256",
  ]) {
    requireSha256(manifest[field], field);
  }
  for (const role of ETHEREUM_LIVE_ROLES) {
    validateSourceVerification(role, normalized.liveContracts[role]);
  }
  return normalized;
}
