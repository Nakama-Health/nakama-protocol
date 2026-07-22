// SPDX-License-Identifier: AGPL-3.0-or-later

import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { network } from "hardhat";

const EXPECTED_CHAIN_ID = 46_630n;
const REQUIRED_CONFIRMATION =
  "DEPLOY_UNFUNDED_NAKAMA_PHASE0_TO_ROBINHOOD_TESTNET";
const COMPONENT_NAMES = [
  "ProtectionProgram",
  "PoolVault",
  "MembershipRegistry",
  "DecisionModule",
  "ClaimManager",
  "SettlementModule",
  "AgentAuthorizationRegistry",
  "SafetyGuardian",
] as const;

function requiredEnvironment(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function assertBytes32(name: string, value: unknown): asserts value is string {
  if (typeof value !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(value)) {
    throw new Error(`${name} must be a bytes32 hex value`);
  }
}

function parseUnsigned(name: string, value: unknown): bigint {
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new Error(`${name} must be a safe unsigned integer`);
    }
    return BigInt(value);
  }
  if (typeof value !== "string" || !/^(0|[1-9][0-9]*)$/.test(value)) {
    throw new Error(`${name} must be an unsigned integer string`);
  }
  const parsed = BigInt(value);
  return parsed;
}

function parseUint32(name: string, value: unknown): number {
  const parsed = parseUnsigned(name, value);
  if (parsed > 0xffff_ffffn) {
    throw new Error(`${name} exceeds uint32`);
  }
  return Number(parsed);
}

if (
  requiredEnvironment("NAKAMA_ROBINHOOD_TESTNET_CONFIRMATION") !==
  REQUIRED_CONFIRMATION
) {
  throw new Error(
    `NAKAMA_ROBINHOOD_TESTNET_CONFIRMATION must equal ${REQUIRED_CONFIRMATION}`
  );
}

const status = execFileSync("git", ["status", "--porcelain"], {
  encoding: "utf8",
}).trim();
if (status !== "")
  throw new Error("Deployment requires a clean source checkout");
const sourceCommit = execFileSync("git", ["rev-parse", "HEAD"], {
  encoding: "utf8",
}).trim();
const requiredSourceCommit = requiredEnvironment(
  "NAKAMA_ROBINHOOD_SOURCE_COMMIT"
);
if (requiredSourceCommit !== sourceCommit) {
  throw new Error("NAKAMA_ROBINHOOD_SOURCE_COMMIT does not match HEAD");
}

const configPath = resolve(
  process.cwd(),
  requiredEnvironment("NAKAMA_ROBINHOOD_TESTNET_CONFIG")
);
const rawConfig = JSON.parse(await readFile(configPath, "utf8"));
assertBytes32("suiteId", rawConfig.suiteId);
assertBytes32("salt", rawConfig.salt);
assertBytes32("templateCommitment", rawConfig.templateCommitment);
assertBytes32("reviewCommitment", rawConfig.reviewCommitment);
for (const field of [
  "sponsorLegalEntityCommitment",
  "metadataCommitment",
  "termsCommitment",
  "privacyCommitment",
  "operationsCommitment",
  "activationChecklistCommitment",
]) {
  assertBytes32(`programConfig.${field}`, rawConfig.programConfig?.[field]);
}

const { ethers } = await network.create("robinhoodTestnet");
const [deployer] = await ethers.getSigners();
const providerNetwork = await ethers.provider.getNetwork();
if (providerNetwork.chainId !== EXPECTED_CHAIN_ID) {
  throw new Error(
    `Expected Robinhood testnet chain ${EXPECTED_CHAIN_ID}, received ${providerNetwork.chainId}`
  );
}
const usdgAddress = ethers.getAddress(
  requiredEnvironment("ROBINHOOD_TESTNET_USDG_ADDRESS")
);
const token = await ethers.getContractAt(
  [
    "function name() view returns (string)",
    "function symbol() view returns (string)",
    "function decimals() view returns (uint8)",
  ],
  usdgAddress
);
const [name, symbol, decimals, runtimeCode] = await Promise.all([
  token.name(),
  token.symbol(),
  token.decimals(),
  ethers.provider.getCode(usdgAddress),
]);
if (
  name !== "Global Dollar" ||
  symbol !== "USDG" ||
  decimals !== 6n ||
  runtimeCode === "0x"
) {
  throw new Error(
    "Configured testnet USDG does not match Global Dollar/USDG/6"
  );
}

const roles = Object.fromEntries(
  Object.entries(rawConfig.roles ?? {}).map(([key, value]) => [
    key,
    ethers.getAddress(String(value)),
  ])
);
const protectedRoleNames = [
  "sponsor",
  "operator",
  "initialReviewer",
  "appealReviewer",
  "settlement",
  "guardian",
] as const;
const protectedRoles = protectedRoleNames.map((name) => roles[name]);
if (new Set(protectedRoles).size !== protectedRoles.length) {
  throw new Error(
    "Sponsor, operator, reviewers, settlement, and guardian must be distinct"
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
  throw new Error("Eligibility attestor conflicts with a protected role");
}
if (Object.values(roles).includes(usdgAddress)) {
  throw new Error("Canonical USDG cannot hold a program role");
}
if (deployer.address !== roles.sponsor) {
  throw new Error("Deployer must be the configured sponsor");
}
const governanceAuthority = ethers.getAddress(
  String(rawConfig.governanceAuthority)
);
const programConfig = {
  sponsorLegalEntityCommitment:
    rawConfig.programConfig.sponsorLegalEntityCommitment,
  metadataCommitment: rawConfig.programConfig.metadataCommitment,
  termsCommitment: rawConfig.programConfig.termsCommitment,
  privacyCommitment: rawConfig.programConfig.privacyCommitment,
  operationsCommitment: rawConfig.programConfig.operationsCommitment,
  activationChecklistCommitment:
    rawConfig.programConfig.activationChecklistCommitment,
  fundingAsset: usdgAddress,
  enrollmentOpensAt: parseUnsigned(
    "programConfig.enrollmentOpensAt",
    rawConfig.programConfig.enrollmentOpensAt
  ),
  activeAt: parseUnsigned(
    "programConfig.activeAt",
    rawConfig.programConfig.activeAt
  ),
  runoffAt: parseUnsigned(
    "programConfig.runoffAt",
    rawConfig.programConfig.runoffAt
  ),
  closesAt: parseUnsigned(
    "programConfig.closesAt",
    rawConfig.programConfig.closesAt
  ),
  appealWindow: parseUnsigned(
    "programConfig.appealWindow",
    rawConfig.programConfig.appealWindow
  ),
  initialDecisionWindow: parseUnsigned(
    "programConfig.initialDecisionWindow",
    rawConfig.programConfig.initialDecisionWindow
  ),
  appealDecisionWindow: parseUnsigned(
    "programConfig.appealDecisionWindow",
    rawConfig.programConfig.appealDecisionWindow
  ),
  perMemberCap: parseUnsigned(
    "programConfig.perMemberCap",
    rawConfig.programConfig.perMemberCap
  ),
  aggregateCap: parseUnsigned(
    "programConfig.aggregateCap",
    rawConfig.programConfig.aggregateCap
  ),
  maxMembers: parseUint32(
    "programConfig.maxMembers",
    rawConfig.programConfig.maxMembers
  ),
};

const suiteVersion = {
  major: parseUint32("suiteVersion.major", rawConfig.suiteVersion?.major),
  minor: parseUint32("suiteVersion.minor", rawConfig.suiteVersion?.minor),
  patch: parseUint32("suiteVersion.patch", rawConfig.suiteVersion?.patch),
};
if (suiteVersion.major !== 2) {
  throw new Error(
    `suiteVersion.major must be 2 for the canonical EconomicActivity schema; received ${suiteVersion.major}.`
  );
}

const bytecodeValues = await Promise.all(
  COMPONENT_NAMES.map(
    async (contractName) =>
      (
        await ethers.getContractFactory(contractName)
      ).bytecode
  )
);
const bytecodes = {
  protectionProgram: bytecodeValues[0],
  poolVault: bytecodeValues[1],
  membershipRegistry: bytecodeValues[2],
  decisionModule: bytecodeValues[3],
  claimManager: bytecodeValues[4],
  settlementModule: bytecodeValues[5],
  agentAuthorizationRegistry: bytecodeValues[6],
  safetyGuardian: bytecodeValues[7],
};
const componentCreationCodeHashes = bytecodeValues.map((value) =>
  ethers.keccak256(value)
);

const assetRegistry = await ethers.deployContract("AssetRegistry", [
  deployer.address,
]);
const templateRegistry = await ethers.deployContract("TemplateRegistry", [
  deployer.address,
]);
await Promise.all([
  assetRegistry.waitForDeployment(),
  templateRegistry.waitForDeployment(),
]);
await (
  await assetRegistry.registerAsset(
    usdgAddress,
    ethers.id("USDG:ROBINHOOD_TESTNET"),
    ethers.id("Global Dollar"),
    ethers.id("USDG")
  )
).wait();
const factory = await ethers.deployContract("NakamaFactory", [
  await assetRegistry.getAddress(),
  await templateRegistry.getAddress(),
  usdgAddress,
  componentCreationCodeHashes,
]);
await factory.waitForDeployment();

await (
  await templateRegistry.registerSuite(
    rawConfig.suiteId,
    await factory.getAddress(),
    suiteVersion.major,
    suiteVersion.minor,
    suiteVersion.patch,
    await factory.deploymentCodeCommitment(),
    rawConfig.templateCommitment,
    rawConfig.reviewCommitment
  )
).wait();

const predicted = await factory.predictDeployment(
  rawConfig.suiteId,
  rawConfig.salt,
  programConfig,
  roles,
  bytecodes
);
const deploymentTransaction = await factory.deployProgram(
  rawConfig.suiteId,
  rawConfig.salt,
  programConfig,
  roles,
  bytecodes
);
const receipt = await deploymentTransaction.wait();
if (receipt === null || receipt.status !== 1) {
  throw new Error("Program suite deployment failed");
}

const poolRegistryAddress = await factory.poolRegistry();
const poolRegistry = await ethers.getContractAt(
  "PoolRegistry",
  poolRegistryAddress
);
const registered = await poolRegistry.getDeployment(predicted.programId);
const deploymentReadbacks = [
  ["programId", registered.programId, predicted.programId],
  ["program", registered.program, predicted.program],
  ["vault", registered.vault, predicted.vault],
  [
    "membershipRegistry",
    registered.membershipRegistry,
    predicted.membershipRegistry,
  ],
  ["decisionModule", registered.decisionModule, predicted.decisionModule],
  ["claimManager", registered.claimManager, predicted.claimManager],
  ["settlementModule", registered.settlementModule, predicted.settlementModule],
  [
    "agentAuthorizationRegistry",
    registered.agentAuthorizationRegistry,
    predicted.agentAuthorizationRegistry,
  ],
  ["safetyGuardian", registered.safetyGuardian, predicted.safetyGuardian],
] as const;
for (const [field, actual, expected] of deploymentReadbacks) {
  if (actual.toLowerCase() !== expected.toLowerCase()) {
    throw new Error(`PoolRegistry ${field} does not match prediction`);
  }
}
if (
  (await poolRegistry.suiteOf(predicted.programId)).toLowerCase() !==
  rawConfig.suiteId.toLowerCase()
) {
  throw new Error("PoolRegistry suite ID does not match deployment input");
}
if ((await poolRegistry.factory()) !== (await factory.getAddress())) {
  throw new Error("PoolRegistry factory does not match deployed factory");
}
if ((await factory.expectedFundingAsset()) !== usdgAddress) {
  throw new Error("Factory canonical funding asset does not match USDG");
}

const program = await ethers.getContractAt(
  "ProtectionProgram",
  predicted.program
);
const programReadbacks = [
  ["programId", await program.programId(), predicted.programId],
  ["vault", await program.vault(), predicted.vault],
  [
    "membershipRegistry",
    await program.membershipRegistry(),
    predicted.membershipRegistry,
  ],
  ["decisionModule", await program.decisionModule(), predicted.decisionModule],
  ["claimManager", await program.claimManager(), predicted.claimManager],
  [
    "settlementModule",
    await program.settlementModule(),
    predicted.settlementModule,
  ],
  [
    "agentAuthorizationRegistry",
    await program.agentAuthorizationRegistry(),
    predicted.agentAuthorizationRegistry,
  ],
  ["safetyGuardian", await program.safetyGuardian(), predicted.safetyGuardian],
] as const;
for (const [field, actual, expected] of programReadbacks) {
  if (actual.toLowerCase() !== expected.toLowerCase()) {
    throw new Error(`ProtectionProgram ${field} does not match prediction`);
  }
}

let authorityHandoff = "not-required";
if (governanceAuthority !== deployer.address) {
  await (
    await assetRegistry.beginAuthorityTransfer(governanceAuthority)
  ).wait();
  await (
    await templateRegistry.beginAuthorityTransfer(governanceAuthority)
  ).wait();
  authorityHandoff = "pending-acceptance";
}

const protocolArtifactBytes = await readFile(
  resolve(process.cwd(), "shared/robinhood/protocol_contract.json")
);
const protocolArtifact = JSON.parse(protocolArtifactBytes.toString("utf8"));
const addresses = {
  assetRegistry: await assetRegistry.getAddress(),
  templateRegistry: await templateRegistry.getAddress(),
  poolRegistry: poolRegistryAddress,
  factory: await factory.getAddress(),
  program: predicted.program,
  vault: predicted.vault,
  membershipRegistry: predicted.membershipRegistry,
  decisionModule: predicted.decisionModule,
  requestManager: predicted.claimManager,
  settlementModule: predicted.settlementModule,
  agentAuthorizationRegistry: predicted.agentAuthorizationRegistry,
  safetyGuardian: predicted.safetyGuardian,
};
const contractNames = {
  assetRegistry: "AssetRegistry",
  templateRegistry: "TemplateRegistry",
  poolRegistry: "PoolRegistry",
  factory: "NakamaFactory",
  program: "ProtectionProgram",
  vault: "PoolVault",
  membershipRegistry: "MembershipRegistry",
  decisionModule: "DecisionModule",
  requestManager: "ClaimManager",
  settlementModule: "SettlementModule",
  agentAuthorizationRegistry: "AgentAuthorizationRegistry",
  safetyGuardian: "SafetyGuardian",
};
const contracts = Object.fromEntries(
  await Promise.all(
    Object.entries(addresses).map(async ([role, address]) => {
      const contractName = contractNames[role as keyof typeof contractNames];
      const code = await ethers.provider.getCode(address);
      if (code === "0x") throw new Error(`No runtime code for ${role}`);
      return [
        role,
        {
          contractName,
          address,
          abiArtifact: `shared/robinhood/${contractName}.abi.json`,
          abiSha256: protocolArtifact.contracts[contractName].abiSha256,
          runtimeCodeHash: ethers.keccak256(code),
          verificationUrl: null,
        },
      ];
    })
  )
);
const deployment = {
  schemaVersion: 1,
  status: "deployed-unverified-unfunded",
  chainId: Number(EXPECTED_CHAIN_ID),
  caip2: `eip155:${EXPECTED_CHAIN_ID}`,
  sourceCommit,
  protocolArtifactSha256: createHash("sha256")
    .update(protocolArtifactBytes)
    .digest("hex"),
  deployer: deployer.address,
  governanceAuthority,
  authorityHandoff,
  usdG: {
    address: usdgAddress,
    name,
    symbol,
    decimals: Number(decimals),
    runtimeCodeHash: ethers.keccak256(runtimeCode),
  },
  suiteId: rawConfig.suiteId,
  programId: predicted.programId,
  deploymentTransaction: receipt.hash,
  deploymentBlock: receipt.blockNumber,
  contracts,
  verified: false,
  funded: false,
  auditStatus: "unaudited",
};
console.log(JSON.stringify(deployment, null, 2));
