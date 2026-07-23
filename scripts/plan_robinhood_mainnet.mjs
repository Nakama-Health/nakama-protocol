#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-or-later

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import {
  AbiCoder,
  ZeroAddress,
  concat,
  getAddress,
  getCreate2Address,
  getCreateAddress,
  id,
  keccak256,
} from "ethers";

import { assertRobinhoodSourceCommit } from "./lib/robinhood_source_provenance.mjs";

export const ROBINHOOD_MAINNET_CHAIN_ID = 4663;
export const ROBINHOOD_MAINNET_CAIP2 = "eip155:4663";
export const ROBINHOOD_MAINNET_USDG =
  "0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168";

const PROGRAM_ID_NAMESPACE = id("NAKAMA_ROBINHOOD_PROGRAM_V1");
const MAX_UINT32 = 0xffff_ffffn;
const MAX_UINT64 = 0xffff_ffff_ffff_ffffn;
const MAX_INT256 = (1n << 255n) - 1n;
const MAX_REVIEW_WINDOW = 30n * 24n * 60n * 60n;
const COMPONENTS = Object.freeze([
  ["program", "ProtectionProgram"],
  ["vault", "PoolVault"],
  ["membershipRegistry", "MembershipRegistry"],
  ["decisionModule", "DecisionModule"],
  ["requestManager", "ClaimManager"],
  ["settlementModule", "SettlementModule"],
  ["agentAuthorizationRegistry", "AgentAuthorizationRegistry"],
  ["safetyGuardian", "SafetyGuardian"],
]);
const ALL_CONTRACT_ARTIFACTS = Object.freeze({
  AssetRegistry:
    "contracts/robinhood/registry/AssetRegistry.sol/AssetRegistry.json",
  TemplateRegistry:
    "contracts/robinhood/registry/TemplateRegistry.sol/TemplateRegistry.json",
  PoolRegistry:
    "contracts/robinhood/registry/PoolRegistry.sol/PoolRegistry.json",
  NakamaFactory:
    "contracts/robinhood/factory/NakamaFactory.sol/NakamaFactory.json",
  ProtectionProgram:
    "contracts/robinhood/program/ProtectionProgram.sol/ProtectionProgram.json",
  PoolVault: "contracts/robinhood/finance/PoolVault.sol/PoolVault.json",
  MembershipRegistry:
    "contracts/robinhood/program/MembershipRegistry.sol/MembershipRegistry.json",
  DecisionModule:
    "contracts/robinhood/authority/DecisionModule.sol/DecisionModule.json",
  ClaimManager:
    "contracts/robinhood/program/ClaimManager.sol/ClaimManager.json",
  SettlementModule:
    "contracts/robinhood/finance/SettlementModule.sol/SettlementModule.json",
  AgentAuthorizationRegistry:
    "contracts/robinhood/authority/AgentAuthorizationRegistry.sol/AgentAuthorizationRegistry.json",
  SafetyGuardian:
    "contracts/robinhood/authority/SafetyGuardian.sol/SafetyGuardian.json",
});

const coder = AbiCoder.defaultAbiCoder();
const PROGRAM_CONFIG_TYPE =
  "tuple(bytes32,bytes32,bytes32,bytes32,bytes32,bytes32,address,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint256,uint256,uint32)";
const ROLE_CONFIG_TYPE =
  "tuple(address,address,address,address,address,address,address)";

export function parseRobinhoodMainnetPlanArgs(args) {
  if (args.includes("--broadcast")) {
    throw new Error(
      "Robinhood mainnet planning is offline-only; --broadcast is forbidden."
    );
  }
  const values = {};
  for (let index = 0; index < args.length; index += 1) {
    const flag = args[index];
    if (flag !== "--config" && flag !== "--evidence") {
      throw new Error(`Unknown Robinhood mainnet planning argument: ${flag}`);
    }
    const value = args[index + 1];
    if (typeof value !== "string" || value.startsWith("--")) {
      throw new Error(`${flag} requires one file path.`);
    }
    const key = flag.slice(2);
    if (values[key] != null) throw new Error(`${flag} may appear only once.`);
    values[key] = value;
    index += 1;
  }
  if (values.config == null || values.evidence == null) {
    throw new Error("Both --config and --evidence are required.");
  }
  return values;
}

export async function loadRobinhoodMainnetPlanningInputs(root = process.cwd()) {
  const artifactPath = resolve(root, "shared/robinhood/protocol_contract.json");
  const artifactRaw = await readFile(artifactPath, "utf8");
  const bytecodes = {};
  for (const [name, relativePath] of Object.entries(ALL_CONTRACT_ARTIFACTS)) {
    const raw = await readFile(
      resolve(root, "artifacts/hardhat", relativePath),
      "utf8"
    );
    const parsed = JSON.parse(raw);
    if (typeof parsed.bytecode !== "string" || parsed.bytecode === "0x") {
      throw new Error(`${name} compiled creation bytecode is unavailable.`);
    }
    bytecodes[name] = parsed.bytecode;
  }
  return { artifactRaw, bytecodes };
}

export function buildRobinhoodMainnetDryRunPlan({
  artifactRaw,
  bytecodes,
  config: inputConfig,
  evidence: inputEvidence,
}) {
  if (typeof artifactRaw !== "string") {
    throw new Error("Canonical Robinhood artifact bytes are required.");
  }
  const artifact = requireObject(JSON.parse(artifactRaw), "protocol artifact");
  const sourceCommit = assertRobinhoodSourceCommit(artifact.sourceCommit);
  const artifactSha256 = sha256(artifactRaw);
  const deploymentPlan = requireObject(
    artifact.deploymentPlan,
    "protocol artifact deploymentPlan"
  );
  const deploymentCodeCommitment = requireBytes32(
    "deploymentCodeCommitment",
    deploymentPlan.deploymentCodeCommitment
  );
  const componentHashes = requireArray(
    deploymentPlan.componentCreationCodeHashes,
    "componentCreationCodeHashes"
  );
  if (
    artifact.schemaVersion !== 2 ||
    artifact.protocolSuiteMajor !== 2 ||
    artifact.economicEventSchemaVersion !== 2 ||
    artifact.chainFamily !== "eip155" ||
    !requireArray(artifact.supportedChains, "supportedChains").some(
      (chain) =>
        chain?.chainId === ROBINHOOD_MAINNET_CHAIN_ID &&
        chain?.caip2 === ROBINHOOD_MAINNET_CAIP2
    ) ||
    artifact.fundingAsset?.mainnetAddress !== ROBINHOOD_MAINNET_USDG ||
    artifact.fundingAsset?.name !== "Global Dollar" ||
    artifact.fundingAsset?.symbol !== "USDG" ||
    artifact.fundingAsset?.decimals !== 6
  ) {
    throw new Error(
      "Protocol artifact does not bind the major-v2 Robinhood USDG suite."
    );
  }

  const config = validateProgramConfig(inputConfig);
  const evidence = validateReleaseEvidence(inputEvidence, {
    sourceCommit,
    artifactSha256,
    deploymentCodeCommitment,
    sponsor: config.roles.sponsor,
  });
  validateBytecodeParity({
    artifact,
    bytecodes,
    componentHashes,
    deploymentCodeCommitment,
  });

  const deployer = evidence.expectedDeployer;
  const deployerNonce = evidence.expectedDeployerNonce;
  const assetRegistry = getCreateAddress({
    from: deployer,
    nonce: deployerNonce,
  });
  const templateRegistry = getCreateAddress({
    from: deployer,
    nonce: deployerNonce + 1n,
  });
  const factory = getCreateAddress({
    from: deployer,
    nonce: deployerNonce + 3n,
  });
  const poolRegistry = getCreateAddress({ from: factory, nonce: 1 });
  const create2Deployer = getCreateAddress({ from: factory, nonce: 2 });
  const programId = keccak256(
    coder.encode(
      ["bytes32", "uint256", "address", "address", "bytes32", "bytes32"],
      [
        PROGRAM_ID_NAMESPACE,
        ROBINHOOD_MAINNET_CHAIN_ID,
        factory,
        config.roles.sponsor,
        config.suiteId,
        config.salt,
      ]
    )
  );
  const programConfig = [
    config.programConfig.sponsorLegalEntityCommitment,
    config.programConfig.metadataCommitment,
    config.programConfig.termsCommitment,
    config.programConfig.privacyCommitment,
    config.programConfig.operationsCommitment,
    config.programConfig.activationChecklistCommitment,
    ROBINHOOD_MAINNET_USDG,
    config.programConfig.enrollmentOpensAt,
    config.programConfig.activeAt,
    config.programConfig.runoffAt,
    config.programConfig.closesAt,
    config.programConfig.appealWindow,
    config.programConfig.initialDecisionWindow,
    config.programConfig.appealDecisionWindow,
    config.programConfig.perMemberCap,
    config.programConfig.aggregateCap,
    config.programConfig.maxMembers,
  ];
  const roles = Object.values(config.roles);
  const contracts = {};
  const initCode = (name, types, values) =>
    concat([bytecodes[name], coder.encode(types, values)]);
  const predict = (index, code) =>
    getCreate2Address(
      create2Deployer,
      keccak256(coder.encode(["bytes32", "uint8"], [programId, index])),
      keccak256(code)
    );

  contracts.program = predict(
    0,
    initCode(
      "ProtectionProgram",
      ["address", "bytes32", "bytes32", PROGRAM_CONFIG_TYPE, ROLE_CONFIG_TYPE],
      [factory, programId, config.suiteId, programConfig, roles]
    )
  );
  contracts.vault = predict(
    1,
    initCode(
      "PoolVault",
      ["address", "address", "address", "address", "bytes32", "uint256"],
      [
        factory,
        contracts.program,
        config.roles.sponsor,
        ROBINHOOD_MAINNET_USDG,
        programId,
        config.programConfig.aggregateCap,
      ]
    )
  );
  contracts.membershipRegistry = predict(
    2,
    initCode(
      "MembershipRegistry",
      ["address", "address", "address"],
      [factory, contracts.program, contracts.vault]
    )
  );
  contracts.decisionModule = predict(
    3,
    initCode(
      "DecisionModule",
      ["address", "address"],
      [factory, contracts.program]
    )
  );
  contracts.requestManager = predict(
    4,
    initCode(
      "ClaimManager",
      ["address", "address", "address", "address", "address"],
      [
        factory,
        contracts.program,
        contracts.vault,
        contracts.membershipRegistry,
        contracts.decisionModule,
      ]
    )
  );
  contracts.settlementModule = predict(
    5,
    initCode(
      "SettlementModule",
      ["address", "address", "address"],
      [contracts.program, contracts.vault, contracts.requestManager]
    )
  );
  contracts.agentAuthorizationRegistry = predict(
    6,
    initCode(
      "AgentAuthorizationRegistry",
      ["address", "address", "address", "address", "address"],
      [
        factory,
        contracts.program,
        contracts.vault,
        contracts.decisionModule,
        contracts.settlementModule,
      ]
    )
  );
  contracts.safetyGuardian = predict(
    7,
    initCode(
      "SafetyGuardian",
      ["address", "address"],
      [contracts.program, contracts.agentAuthorizationRegistry]
    )
  );

  const addresses = {
    assetRegistry,
    templateRegistry,
    poolRegistry,
    factory,
    create2Deployer,
    ...contracts,
  };
  if (
    Object.values(addresses).some((address) => address === ZeroAddress) ||
    new Set(Object.values(addresses).map((address) => address.toLowerCase()))
      .size !== Object.keys(addresses).length
  ) {
    throw new Error(
      "Dry-run address plan contains zero or duplicate addresses."
    );
  }

  const transactionPlan = [
    [0n, "deploy AssetRegistry"],
    [1n, "deploy TemplateRegistry"],
    [2n, "register canonical USDG"],
    [3n, "deploy NakamaFactory"],
    [4n, "register reviewed suite"],
    [5n, "deploy unfunded program suite"],
  ];
  if (config.governanceAuthority !== deployer) {
    transactionPlan.push(
      [6n, "begin AssetRegistry authority transfer"],
      [7n, "begin TemplateRegistry authority transfer"]
    );
  }

  return {
    schemaVersion: 1,
    mode: "dry-run",
    broadcast: false,
    warning:
      "This is an offline deterministic plan. Supplied evidence is structurally checked, not independently authenticated, and cannot authorize deployment.",
    chainId: ROBINHOOD_MAINNET_CHAIN_ID,
    caip2: ROBINHOOD_MAINNET_CAIP2,
    sourceCommit,
    protocolArtifactSha256: artifactSha256,
    deploymentCodeCommitment,
    releaseEvidence: {
      status: evidence.status,
      auditReportSha256: evidence.audit.reportSha256,
      releaseApprovalSha256: evidence.releaseApproval.recordSha256,
      legalApprovalSha256: evidence.legalApproval.recordSha256,
    },
    deployer,
    expectedDeployerNonce: deployerNonce.toString(10),
    governanceAuthority: config.governanceAuthority,
    authorityHandoff:
      config.governanceAuthority === deployer
        ? "not-required"
        : "requires-two-deployer-begin-transactions-and-two-governance-acceptance-transactions",
    usdG: evidence.usdG,
    suiteId: config.suiteId,
    suiteVersion: config.suiteVersion,
    templateCommitment: config.templateCommitment,
    reviewCommitment: config.reviewCommitment,
    roles: config.roles,
    programConfig: config.programConfig,
    programId,
    addresses,
    transactionPlan: transactionPlan.map(([offset, action]) => ({
      nonce: (deployerNonce + offset).toString(10),
      action,
    })),
    remainingExternalGates: [
      "Authenticate audit, legal, and release approvals outside this JSON packet.",
      "Independently verify Robinhood chain ID, finalized deployer nonce, signer balance, and threshold-controlled role ownership.",
      "Verify USDG metadata, runtime, implementation, admin, and upgrade configuration through independent RPC and authoritative sources.",
      "Rebuild from the sourceCommit and compare every initcode hash immediately before any separately reviewed deployment implementation.",
      "After deployment, require finalized receipts, exact source verification, runtime/readback parity, and an independently promoted SDK manifest before any funding.",
    ],
  };
}

function validateProgramConfig(input) {
  const raw = requireObject(input, "program config");
  const suiteId = requireBytes32("suiteId", raw.suiteId);
  const salt = requireBytes32("salt", raw.salt);
  const templateCommitment = requireBytes32(
    "templateCommitment",
    raw.templateCommitment
  );
  const reviewCommitment = requireBytes32(
    "reviewCommitment",
    raw.reviewCommitment
  );
  const governanceAuthority = requireAddress(
    "governanceAuthority",
    raw.governanceAuthority
  );
  const version = requireObject(raw.suiteVersion, "suiteVersion");
  const suiteVersion = {
    major: Number(
      requireUnsigned("suiteVersion.major", version.major, MAX_UINT32)
    ),
    minor: Number(
      requireUnsigned("suiteVersion.minor", version.minor, MAX_UINT32)
    ),
    patch: Number(
      requireUnsigned("suiteVersion.patch", version.patch, MAX_UINT32)
    ),
  };
  if (suiteVersion.major !== 2) {
    throw new Error(
      `suiteVersion.major must be 2 for the canonical EconomicActivity schema; received ${suiteVersion.major}.`
    );
  }
  const rawRoles = requireObject(raw.roles, "roles");
  const roleNames = [
    "sponsor",
    "operator",
    "initialReviewer",
    "appealReviewer",
    "settlement",
    "guardian",
    "eligibilityAttestor",
  ];
  const roles = Object.fromEntries(
    roleNames.map((name) => [
      name,
      requireAddress(`roles.${name}`, rawRoles[name]),
    ])
  );
  const separated = roleNames.slice(0, 6).map((name) => roles[name]);
  if (new Set(separated).size !== separated.length) {
    throw new Error(
      "Sponsor, operator, reviewers, settlement, and guardian must be distinct."
    );
  }
  if (
    [
      roles.initialReviewer,
      roles.appealReviewer,
      roles.settlement,
      roles.guardian,
    ].includes(roles.eligibilityAttestor)
  ) {
    throw new Error("Eligibility attestor conflicts with a protected role.");
  }
  if (Object.values(roles).includes(ROBINHOOD_MAINNET_USDG)) {
    throw new Error("Canonical USDG cannot hold a program role.");
  }

  const rawProgram = requireObject(raw.programConfig, "programConfig");
  const commitmentNames = [
    "sponsorLegalEntityCommitment",
    "metadataCommitment",
    "termsCommitment",
    "privacyCommitment",
    "operationsCommitment",
    "activationChecklistCommitment",
  ];
  const programConfig = Object.fromEntries(
    commitmentNames.map((name) => [
      name,
      requireBytes32(`programConfig.${name}`, rawProgram[name]),
    ])
  );
  for (const name of [
    "enrollmentOpensAt",
    "activeAt",
    "runoffAt",
    "closesAt",
    "appealWindow",
    "initialDecisionWindow",
    "appealDecisionWindow",
  ]) {
    programConfig[name] = requireUnsigned(
      `programConfig.${name}`,
      rawProgram[name],
      MAX_UINT64
    );
  }
  programConfig.perMemberCap = requireUnsigned(
    "programConfig.perMemberCap",
    rawProgram.perMemberCap,
    MAX_INT256
  );
  programConfig.aggregateCap = requireUnsigned(
    "programConfig.aggregateCap",
    rawProgram.aggregateCap,
    MAX_INT256
  );
  programConfig.maxMembers = requireUnsigned(
    "programConfig.maxMembers",
    rawProgram.maxMembers,
    MAX_UINT32
  );
  if (
    !(
      programConfig.enrollmentOpensAt < programConfig.activeAt &&
      programConfig.activeAt < programConfig.runoffAt &&
      programConfig.runoffAt < programConfig.closesAt
    ) ||
    programConfig.appealWindow === 0n ||
    programConfig.initialDecisionWindow === 0n ||
    programConfig.appealDecisionWindow === 0n ||
    programConfig.appealWindow > MAX_REVIEW_WINDOW ||
    programConfig.initialDecisionWindow > MAX_REVIEW_WINDOW ||
    programConfig.appealDecisionWindow > MAX_REVIEW_WINDOW ||
    programConfig.perMemberCap === 0n ||
    programConfig.aggregateCap < programConfig.perMemberCap ||
    programConfig.maxMembers === 0n ||
    programConfig.maxMembers * programConfig.perMemberCap >
      programConfig.aggregateCap
  ) {
    throw new Error(
      "Program timing, review, member, or liability bounds are invalid."
    );
  }
  return {
    suiteId,
    suiteVersion,
    salt,
    templateCommitment,
    reviewCommitment,
    governanceAuthority,
    roles,
    programConfig,
  };
}

function validateReleaseEvidence(input, expected) {
  const evidence = requireObject(input, "release evidence");
  if (
    evidence.schemaVersion !== 1 ||
    evidence.status !== "approved-for-dry-run" ||
    evidence.chainId !== ROBINHOOD_MAINNET_CHAIN_ID ||
    evidence.caip2 !== ROBINHOOD_MAINNET_CAIP2 ||
    evidence.sourceCommit !== expected.sourceCommit ||
    evidence.protocolArtifactSha256 !== expected.artifactSha256 ||
    evidence.deploymentCodeCommitment !== expected.deploymentCodeCommitment
  ) {
    throw new Error(
      "Release evidence does not match the canonical dry-run target."
    );
  }
  const expectedDeployer = requireAddress(
    "expectedDeployer",
    evidence.expectedDeployer
  );
  if (expectedDeployer !== expected.sponsor) {
    throw new Error("Expected deployer must be the configured sponsor.");
  }
  const expectedDeployerNonce = requireUnsigned(
    "expectedDeployerNonce",
    evidence.expectedDeployerNonce
  );
  const usdG = requireObject(evidence.usdG, "usdG evidence");
  if (
    requireAddress("usdG.address", usdG.address) !== ROBINHOOD_MAINNET_USDG ||
    typeof usdG.verificationUrl !== "string" ||
    !usdG.verificationUrl.startsWith("https://")
  ) {
    throw new Error(
      "USDG evidence must bind the canonical address and HTTPS source."
    );
  }
  const runtimeCodeHash = requireBytes32(
    "usdG.runtimeCodeHash",
    usdG.runtimeCodeHash
  );
  const audit = validateApproval("audit", evidence.audit, "reportSha256");
  const releaseApproval = validateApproval(
    "releaseApproval",
    evidence.releaseApproval,
    "recordSha256"
  );
  const legalApproval = validateApproval(
    "legalApproval",
    evidence.legalApproval,
    "recordSha256"
  );
  const reviewers = [
    expectedDeployer,
    audit.reviewer,
    releaseApproval.approver,
    legalApproval.approver,
  ];
  if (new Set(reviewers).size !== reviewers.length) {
    throw new Error(
      "Deployer, auditor, release approver, and legal approver must be distinct."
    );
  }
  return {
    status: evidence.status,
    expectedDeployer,
    expectedDeployerNonce,
    usdG: {
      address: ROBINHOOD_MAINNET_USDG,
      name: "Global Dollar",
      symbol: "USDG",
      decimals: 6,
      runtimeCodeHash,
      verificationUrl: usdG.verificationUrl,
    },
    audit,
    releaseApproval,
    legalApproval,
  };
}

function validateApproval(label, value, digestField) {
  const approval = requireObject(value, label);
  const actorField = label === "audit" ? "reviewer" : "approver";
  return {
    [digestField]: requireSha256(
      `${label}.${digestField}`,
      approval[digestField]
    ),
    [actorField]: requireAddress(
      `${label}.${actorField}`,
      approval[actorField]
    ),
  };
}

function validateBytecodeParity({
  artifact,
  bytecodes,
  componentHashes,
  deploymentCodeCommitment,
}) {
  const contracts = requireObject(artifact.contracts, "protocol contracts");
  for (const [name] of Object.entries(ALL_CONTRACT_ARTIFACTS)) {
    if (typeof bytecodes?.[name] !== "string" || bytecodes[name] === "0x") {
      throw new Error(`${name} creation bytecode is missing.`);
    }
    if (keccak256(bytecodes[name]) !== contracts[name]?.creationBytecodeHash) {
      throw new Error(
        `${name} creation bytecode does not match the protocol artifact.`
      );
    }
  }
  const actualComponentHashes = COMPONENTS.map(([, name]) =>
    keccak256(bytecodes[name])
  );
  if (
    componentHashes.length !== actualComponentHashes.length ||
    componentHashes.some((hash, index) => hash !== actualComponentHashes[index])
  ) {
    throw new Error(
      "Component bytecode order does not match the protocol artifact."
    );
  }
  const actualCommitment = keccak256(
    coder.encode(["bytes32[8]"], [actualComponentHashes])
  );
  if (actualCommitment !== deploymentCodeCommitment) {
    throw new Error(
      "Deployment code commitment does not match compiled bytecode."
    );
  }
}

function requireObject(value, label) {
  if (value == null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
  return value;
}

function requireArray(value, label) {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array.`);
  return value;
}

function requireBytes32(label, value) {
  if (
    typeof value !== "string" ||
    !/^0x[0-9a-f]{64}$/.test(value) ||
    /^0x0{64}$/.test(value)
  ) {
    throw new Error(`${label} must be a nonzero lowercase bytes32 value.`);
  }
  return value;
}

function requireSha256(label, value) {
  if (
    typeof value !== "string" ||
    !/^[0-9a-f]{64}$/.test(value) ||
    /^0{64}$/.test(value)
  ) {
    throw new Error(`${label} must be a nonzero lowercase SHA-256 digest.`);
  }
  return value;
}

function requireAddress(label, value) {
  if (typeof value !== "string")
    throw new Error(`${label} must be an address.`);
  let address;
  try {
    address = getAddress(value);
  } catch {
    throw new Error(`${label} must be an EVM address.`);
  }
  if (address === ZeroAddress) throw new Error(`${label} cannot be zero.`);
  return address;
}

function requireUnsigned(label, value, maximum = null) {
  if (
    (typeof value !== "string" || !/^(0|[1-9][0-9]*)$/.test(value)) &&
    (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) &&
    typeof value !== "bigint"
  ) {
    throw new Error(`${label} must be an unsigned integer.`);
  }
  const result = BigInt(value);
  if (result < 0n || (maximum != null && result > maximum)) {
    throw new Error(`${label} is outside its unsigned integer range.`);
  }
  return result;
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

async function main() {
  const args = parseRobinhoodMainnetPlanArgs(process.argv.slice(2));
  const [configRaw, evidenceRaw, planningInputs] = await Promise.all([
    readFile(resolve(args.config), "utf8"),
    readFile(resolve(args.evidence), "utf8"),
    loadRobinhoodMainnetPlanningInputs(),
  ]);
  const plan = buildRobinhoodMainnetDryRunPlan({
    ...planningInputs,
    config: JSON.parse(configRaw),
    evidence: JSON.parse(evidenceRaw),
  });
  console.log(
    JSON.stringify(
      plan,
      (_key, value) => (typeof value === "bigint" ? value.toString(10) : value),
      2
    )
  );
}

if (
  process.argv[1] != null &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
