// SPDX-License-Identifier: AGPL-3.0-or-later

import { createHash } from "node:crypto";
import { getAddress } from "ethers";

import {
  canonicalImmutableReferences,
} from "./ethereum_bytecode.mjs";
import {
  ETHEREUM_LIVE_CONTRACTS,
  ETHEREUM_LIVE_ROLES,
  RESERVE_VAULT_TEMPLATE,
  requireExactKeys,
} from "./ethereum_contract_set.mjs";
import {
  ROBINHOOD_GENERIC_TESTNET_CAIP2,
  ROBINHOOD_GENERIC_TESTNET_CHAIN_ID,
  ROBINHOOD_GENERIC_TESTNET_MINIMUM_FINAL_CONFIRMATIONS,
} from "./robinhood_generic_core_guard.mjs";

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
  "runtimeBytecodeSha256",
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
const INTERMEDIATE_FIELDS = [
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
  "settlementAsset",
  "liveContracts",
  "contractTemplates",
  "verified",
  "qualificationStatus",
  "qualificationReportSha256",
  "releaseApprovalSha256",
  "verificationEvidenceSha256",
];
const RUNTIME_EVIDENCE_FIELDS = [
  "factoryReceiptFinalized",
  "factoryDerivedAddressesVerified",
  "coreDeploymentFactoryVerified",
  "immutableCrossBindingsVerified",
  "runtimeBytecodeVerified",
  "blockscoutContractsVerified",
  "sourcifyMatchesVerified",
  "reserveVaultTemplateVerified",
];

function requireCondition(condition, message) {
  if (!condition) throw new Error(message);
}

function normalizedAddress(value, field) {
  requireCondition(
    typeof value === "string" && ADDRESS_PATTERN.test(value),
    `${field} must be an address`
  );
  const result = getAddress(value);
  requireCondition(
    result !== getAddress("0x0000000000000000000000000000000000000000"),
    `${field} cannot be zero`
  );
  return result;
}

function requireBytes32(value, field) {
  requireCondition(
    typeof value === "string" && BYTES32_PATTERN.test(value),
    `${field} must be a 32-byte hash`
  );
  return value.toLowerCase();
}

function requireSha256(value, field) {
  requireCondition(
    typeof value === "string" && SHA256_PATTERN.test(value),
    `${field} must be a lowercase SHA-256 digest`
  );
  return value;
}

function sameImmutableReferences(left, right, field) {
  const normalizedLeft = canonicalImmutableReferences(left);
  const normalizedRight = canonicalImmutableReferences(right);
  requireCondition(
    JSON.stringify(normalizedLeft) === JSON.stringify(normalizedRight),
    `${field} immutable references do not match the approved artifact`
  );
  return normalizedLeft;
}

function validateLiveContract(role, contract, release) {
  requireExactKeys(contract, LIVE_CONTRACT_FIELDS, `${role} deployment`);
  const identity = ETHEREUM_LIVE_CONTRACTS[role];
  const approved = release.contracts[identity.contractName];
  requireCondition(
    contract.contractName === identity.contractName &&
      contract.deploymentKind === identity.deploymentKind &&
      contract.factoryNonce === identity.factoryNonce,
    `${role} deployment identity is invalid`
  );
  requireCondition(contract.verification === null, `${role} must be unverified`);
  requireCondition(
    contract.creationBytecodeHash === approved.creationBytecodeHash &&
      contract.creationBytecodeBytes === approved.creationBytecodeBytes &&
      contract.runtimeBytecodeTemplateHash ===
        approved.runtimeBytecodeTemplateHash &&
      contract.runtimeBytecodeBytes === approved.runtimeBytecodeBytes &&
      contract.abiSha256 === approved.abiSha256,
    `${role} deployment does not match the approved artifact`
  );
  sameImmutableReferences(
    contract.immutableReferences,
    approved.immutableReferences,
    role
  );
  requireBytes32(contract.runtimeBytecodeHash, `${role}.runtimeBytecodeHash`);
  requireSha256(
    contract.runtimeBytecodeSha256,
    `${role}.runtimeBytecodeSha256`
  );
  return {
    ...contract,
    address: normalizedAddress(contract.address, `${role}.address`),
  };
}

function validateReserveVaultTemplate(template, release) {
  requireExactKeys(template, TEMPLATE_FIELDS, "reserveVault template");
  const approved = release.contracts.ReserveVault;
  requireCondition(
    template.contractName === RESERVE_VAULT_TEMPLATE.contractName &&
      template.deploymentKind === RESERVE_VAULT_TEMPLATE.deploymentKind &&
      template.saltDerivation === RESERVE_VAULT_TEMPLATE.saltDerivation,
    "reserveVault template identity is invalid"
  );
  requireCondition(
    template.creationBytecodeHash === approved.creationBytecodeHash &&
      template.creationBytecodeBytes === approved.creationBytecodeBytes &&
      template.runtimeBytecodeTemplateHash ===
        approved.runtimeBytecodeTemplateHash &&
      template.runtimeBytecodeBytes === approved.runtimeBytecodeBytes &&
      template.abiSha256 === approved.abiSha256,
    "reserveVault template does not match the approved artifact"
  );
  sameImmutableReferences(
    template.immutableReferences,
    approved.immutableReferences,
    "reserveVault"
  );
  return template;
}

export function validateRobinhoodGenericCoreIntermediate(deployment, release) {
  requireExactKeys(
    deployment,
    INTERMEDIATE_FIELDS,
    "Robinhood generic-core intermediate deployment"
  );
  requireCondition(
    deployment.schemaVersion === 3 &&
      deployment.status === "deployed-unverified" &&
      deployment.chainId === Number(ROBINHOOD_GENERIC_TESTNET_CHAIN_ID) &&
      deployment.caip2 === ROBINHOOD_GENERIC_TESTNET_CAIP2 &&
      deployment.entryContract === "NakamaProtocolFactory",
    "Intermediate deployment is not the Robinhood generic-core testnet release"
  );
  const deployer = normalizedAddress(deployment.deployer, "deployer");
  requireBytes32(deployment.deploymentTransaction, "deploymentTransaction");
  requireBytes32(deployment.deploymentBlockHash, "deploymentBlockHash");
  requireCondition(
    Number.isSafeInteger(deployment.deploymentBlock) &&
      deployment.deploymentBlock > 0 &&
      Number.isSafeInteger(deployment.confirmations) &&
      deployment.confirmations >=
        ROBINHOOD_GENERIC_TESTNET_MINIMUM_FINAL_CONFIRMATIONS,
    "Intermediate deployment block or confirmations are invalid"
  );
  requireCondition(
    SOURCE_COMMIT_PATTERN.test(deployment.sourceCommit) &&
      deployment.sourceCommit === release.headCommit,
    "Intermediate sourceCommit does not match the release checkout"
  );
  requireSha256(
    deployment.protocolArtifactSha256,
    "protocolArtifactSha256"
  );
  requireCondition(
    deployment.protocolArtifactSha256 === release.protocolArtifactSha256 &&
      deployer === getAddress(release.releaseManifest.expectedDeployer),
    "Intermediate deployment is outside the approved release"
  );
  requireExactKeys(
    deployment.settlementAsset,
    [
      "contractName",
      "address",
      "name",
      "symbol",
      "decimals",
      "deploymentTransaction",
      "runtimeBytecodeSha256",
      "classification",
      "canonical",
    ],
    "settlementAsset"
  );
  requireCondition(
    deployment.settlementAsset.contractName === "NakamaTestUsd" &&
      deployment.settlementAsset.classification === "test-only-mock" &&
      deployment.settlementAsset.canonical === false &&
      deployment.settlementAsset.name !== "Global Dollar" &&
      deployment.settlementAsset.symbol.toUpperCase() !== "USDG" &&
      /^t[A-Za-z0-9]+$/.test(deployment.settlementAsset.symbol) &&
      Number.isSafeInteger(deployment.settlementAsset.decimals) &&
      deployment.settlementAsset.decimals >= 0 &&
      deployment.settlementAsset.decimals <= 255,
    "Settlement asset must be an explicitly labeled test-only token, never canonical USDG"
  );
  const settlementAsset = {
    ...deployment.settlementAsset,
    address: normalizedAddress(
      deployment.settlementAsset.address,
      "settlementAsset.address"
    ),
    runtimeBytecodeSha256: requireSha256(
      deployment.settlementAsset.runtimeBytecodeSha256,
      "settlementAsset.runtimeBytecodeSha256"
    ),
    deploymentTransaction: requireBytes32(
      deployment.settlementAsset.deploymentTransaction,
      "settlementAsset.deploymentTransaction"
    ),
  };
  const approvedSettlementAsset = release.releaseManifest.settlementAsset;
  requireCondition(
    approvedSettlementAsset.contractName === settlementAsset.contractName &&
      getAddress(approvedSettlementAsset.address) ===
        settlementAsset.address &&
      approvedSettlementAsset.name === settlementAsset.name &&
      approvedSettlementAsset.symbol === settlementAsset.symbol &&
      approvedSettlementAsset.decimals === settlementAsset.decimals &&
      approvedSettlementAsset.deploymentTransaction.toLowerCase() ===
        settlementAsset.deploymentTransaction &&
      approvedSettlementAsset.classification ===
        settlementAsset.classification &&
      approvedSettlementAsset.canonical === settlementAsset.canonical,
    "Intermediate settlement asset does not match the approved release"
  );
  requireExactKeys(
    deployment.liveContracts,
    ETHEREUM_LIVE_ROLES,
    "liveContracts"
  );
  const liveContracts = Object.fromEntries(
    ETHEREUM_LIVE_ROLES.map((role) => [
      role,
      validateLiveContract(role, deployment.liveContracts[role], release),
    ])
  );
  requireCondition(
    new Set(
      ETHEREUM_LIVE_ROLES.map((role) =>
        liveContracts[role].address.toLowerCase()
      )
    ).size === ETHEREUM_LIVE_ROLES.length &&
      !ETHEREUM_LIVE_ROLES.some(
        (role) =>
          liveContracts[role].address.toLowerCase() ===
          settlementAsset.address.toLowerCase()
      ),
    "Live contracts and settlement asset must use distinct addresses"
  );
  requireExactKeys(
    deployment.contractTemplates,
    ["reserveVault"],
    "contractTemplates"
  );
  const reserveVault = validateReserveVaultTemplate(
    deployment.contractTemplates.reserveVault,
    release
  );
  requireCondition(
    deployment.verified === false &&
      deployment.qualificationStatus === "approved-for-testnet" &&
      deployment.verificationEvidenceSha256 === null,
    "Intermediate deployment must remain unverified and testnet-only"
  );
  requireCondition(
    deployment.qualificationReportSha256 ===
      release.releaseManifest.qualificationReportSha256 &&
      deployment.releaseApprovalSha256 ===
        release.releaseManifest.releaseApprovalSha256,
    "Intermediate qualification evidence does not match the release"
  );
  return {
    ...deployment,
    deployer,
    settlementAsset,
    liveContracts,
    contractTemplates: { reserveVault },
  };
}

function canonicalJson(value) {
  if (Array.isArray(value)) return value.map(canonicalJson);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonicalJson(value[key])])
    );
  }
  return value;
}

export function canonicalSha256(value) {
  return createHash("sha256")
    .update(`${JSON.stringify(canonicalJson(value))}\n`)
    .digest("hex");
}

export function buildRobinhoodRuntimeManifest(
  deployment,
  runtimeBytecodeSha256ByRole
) {
  requireExactKeys(
    runtimeBytecodeSha256ByRole,
    ETHEREUM_LIVE_ROLES,
    "runtime bytecode SHA-256 map"
  );
  for (const role of ETHEREUM_LIVE_ROLES) {
    requireSha256(
      runtimeBytecodeSha256ByRole[role],
      `${role} runtime bytecode SHA-256`
    );
    requireCondition(
      runtimeBytecodeSha256ByRole[role] ===
        deployment.liveContracts[role].runtimeBytecodeSha256,
      `${role} runtime bytecode SHA-256 differs from the deployment receipt`
    );
  }
  return {
    schemaVersion: 3,
    chainId: ROBINHOOD_GENERIC_TESTNET_CAIP2,
    factoryAddress: deployment.liveContracts.factory.address.toLowerCase(),
    protocolContractAddress:
      deployment.liveContracts.protocol.address.toLowerCase(),
    policyRegistryAddress:
      deployment.liveContracts.policyRegistry.address.toLowerCase(),
    runtimeBytecodeSha256: {
      factory: runtimeBytecodeSha256ByRole.factory,
      protocol: runtimeBytecodeSha256ByRole.protocol,
      policyRegistry: runtimeBytecodeSha256ByRole.policyRegistry,
    },
    evidence: {
      factoryReceiptFinalized: true,
      factoryDerivedAddressesVerified: true,
      coreDeploymentFactoryVerified: true,
      immutableCrossBindingsVerified: true,
      runtimeBytecodeVerified: true,
      blockscoutContractsVerified: true,
      sourcifyMatchesVerified: true,
      reserveVaultTemplateVerified: true,
    },
  };
}

export function validateRobinhoodRuntimeManifest(manifest) {
  requireExactKeys(
    manifest,
    [
      "schemaVersion",
      "chainId",
      "factoryAddress",
      "protocolContractAddress",
      "policyRegistryAddress",
      "runtimeBytecodeSha256",
      "evidence",
    ],
    "Robinhood runtime manifest"
  );
  requireCondition(
    manifest.schemaVersion === 3 &&
      manifest.chainId === ROBINHOOD_GENERIC_TESTNET_CAIP2,
    "Runtime manifest must target Robinhood testnet schema v3"
  );
  const factoryAddress = normalizedAddress(
    manifest.factoryAddress,
    "factoryAddress"
  );
  const protocolAddress = normalizedAddress(
    manifest.protocolContractAddress,
    "protocolContractAddress"
  );
  const policyRegistryAddress = normalizedAddress(
    manifest.policyRegistryAddress,
    "policyRegistryAddress"
  );
  requireCondition(
    new Set(
      [factoryAddress, protocolAddress, policyRegistryAddress].map((value) =>
        value.toLowerCase()
      )
    ).size === 3,
    "Runtime manifest contract addresses must be distinct"
  );
  requireExactKeys(
    manifest.runtimeBytecodeSha256,
    ETHEREUM_LIVE_ROLES,
    "runtimeBytecodeSha256"
  );
  for (const role of ETHEREUM_LIVE_ROLES) {
    requireSha256(
      manifest.runtimeBytecodeSha256[role],
      `runtimeBytecodeSha256.${role}`
    );
  }
  requireExactKeys(manifest.evidence, RUNTIME_EVIDENCE_FIELDS, "evidence");
  requireCondition(
    Object.values(manifest.evidence).every((value) => value === true),
    "Every runtime-manifest evidence gate must be true"
  );
  return manifest;
}
