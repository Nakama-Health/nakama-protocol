// SPDX-License-Identifier: AGPL-3.0-or-later

import { AbiCoder, keccak256 } from "ethers";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  canonicalImmutableReferences,
  runtimeBytecodeBytes,
  runtimeBytecodeTemplateHash,
} from "./lib/ethereum_bytecode.mjs";

const root = process.cwd();
const outputDirectory = resolve(root, "shared/robinhood");
const outputPath = resolve(outputDirectory, "protocol_contract.json");
const contractArtifacts = {
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
};
const componentOrder = [
  "ProtectionProgram",
  "PoolVault",
  "MembershipRegistry",
  "DecisionModule",
  "ClaimManager",
  "SettlementModule",
  "AgentAuthorizationRegistry",
  "SafetyGuardian",
];

const contracts = {};
const standaloneAbis = {};
for (const [name, relativePath] of Object.entries(contractArtifacts)) {
  const artifactPath = resolve(root, "artifacts/hardhat", relativePath);
  const artifact = JSON.parse(await readFile(artifactPath, "utf8"));
  const standaloneAbi = `${JSON.stringify(artifact.abi, null, 2)}\n`;
  const immutableReferences = canonicalImmutableReferences(
    artifact.immutableReferences
  );
  contracts[name] = {
    abi: artifact.abi,
    abiSha256: createHash("sha256").update(standaloneAbi).digest("hex"),
    creationBytecodeHash: keccak256(artifact.bytecode),
    creationBytecodeBytes: runtimeBytecodeBytes(artifact.bytecode),
    runtimeBytecodeTemplateHash: runtimeBytecodeTemplateHash(
      artifact.deployedBytecode,
      immutableReferences
    ),
    runtimeBytecodeBytes: runtimeBytecodeBytes(artifact.deployedBytecode),
    immutableReferences,
  };
  standaloneAbis[name] = standaloneAbi;
}

const componentCreationCodeHashes = componentOrder.map(
  (name) => contracts[name].creationBytecodeHash
);
const deploymentCodeCommitment = keccak256(
  AbiCoder.defaultAbiCoder().encode(
    ["bytes32[8]"],
    [componentCreationCodeHashes]
  )
);
const generated = `${JSON.stringify(
  {
    schemaVersion: 1,
    sourceCommit: null,
    chainFamily: "eip155",
    supportedChains: [
      { name: "Robinhood Chain Mainnet", chainId: 4663, caip2: "eip155:4663" },
      {
        name: "Robinhood Chain Testnet",
        chainId: 46630,
        caip2: "eip155:46630",
      },
    ],
    fundingAsset: {
      name: "Global Dollar",
      symbol: "USDG",
      decimals: 6,
      mainnetAddress: "0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168",
      testnetAddress: null,
    },
    compiler: {
      version: "0.8.28",
      evmVersion: "cancun",
      optimizerRuns: 200,
      viaIR: true,
    },
    deploymentPlan: {
      globalContracts: [
        "AssetRegistry",
        "TemplateRegistry",
        "PoolRegistry",
        "NakamaFactory",
      ],
      componentOrder,
      componentCreationCodeHashes,
      deploymentCodeCommitment,
      deploymentKind: "factory-authorized-create2",
      programIdDerivation:
        "keccak256(abi.encode(NAKAMA_ROBINHOOD_PROGRAM_V1,chainId,factory,sponsor,suiteId,salt))",
      componentSaltDerivation:
        "keccak256(abi.encode(programId,uint8(componentIndex)))",
    },
    contracts,
  },
  null,
  2
)}\n`;

if (process.argv.includes("--check")) {
  const current = await readFile(outputPath, "utf8").catch(() => "");
  const currentAbis = await Promise.all(
    Object.keys(standaloneAbis).map((name) =>
      readFile(resolve(outputDirectory, `${name}.abi.json`), "utf8").catch(
        () => ""
      )
    )
  );
  const abisCurrent = Object.values(standaloneAbis).every(
    (abi, index) => abi === currentAbis[index]
  );
  if (current !== generated || !abisCurrent) {
    console.error(
      "Robinhood protocol artifact is stale. Run npm run robinhood:contract."
    );
    process.exitCode = 1;
  } else {
    console.log(
      "Robinhood protocol contract and twelve standalone ABI artifacts are current."
    );
  }
} else {
  await mkdir(outputDirectory, { recursive: true });
  await Promise.all([
    writeFile(outputPath, generated, "utf8"),
    ...Object.entries(standaloneAbis).map(([name, abi]) =>
      writeFile(resolve(outputDirectory, `${name}.abi.json`), abi, "utf8")
    ),
  ]);
  console.log(
    "Wrote shared/robinhood/protocol_contract.json and twelve standalone ABIs"
  );
}
