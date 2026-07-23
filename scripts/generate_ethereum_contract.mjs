// SPDX-License-Identifier: AGPL-3.0-or-later

import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { keccak256 } from "ethers";

import {
  canonicalImmutableReferences,
  runtimeBytecodeBytes,
  runtimeBytecodeTemplateHash,
} from "./lib/ethereum_bytecode.mjs";

const root = process.cwd();
const outputPath = resolve(root, "shared/ethereum/protocol_contract.json");
const artifactPaths = {
  NakamaProtocolFactory: resolve(
    root,
    "artifacts/hardhat/contracts/NakamaProtocolFactory.sol/NakamaProtocolFactory.json"
  ),
  NakamaCoverageProtocol: resolve(
    root,
    "artifacts/hardhat/contracts/NakamaCoverageProtocol.sol/NakamaCoverageProtocol.json"
  ),
  NakamaPolicyRegistry: resolve(
    root,
    "artifacts/hardhat/contracts/NakamaPolicyRegistry.sol/NakamaPolicyRegistry.json"
  ),
  ReserveVault: resolve(
    root,
    "artifacts/hardhat/contracts/ReserveVault.sol/ReserveVault.json"
  ),
};

const contracts = {};
const standaloneAbis = {};
for (const [name, path] of Object.entries(artifactPaths)) {
  const artifact = JSON.parse(await readFile(path, "utf8"));
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

const generated = `${JSON.stringify(
  {
    schemaVersion: 3,
    chainFamily: "eip155",
    canonicalChain: "eip155:1",
    compiler: {
      version: "0.8.28",
      evmVersion: "cancun",
      optimizerRuns: 200,
      viaIR: true,
    },
    deploymentPlan: {
      transactionCount: 1,
      entryContract: "NakamaProtocolFactory",
      factoryCreates: [
        { contractName: "NakamaPolicyRegistry", nonce: 1 },
        { contractName: "NakamaCoverageProtocol", nonce: 2 },
      ],
      templates: [
        {
          contractName: "ReserveVault",
          deploymentKind: "core-create2",
          saltDerivation: "keccak256(abi.encode(domainId,assetToken))",
        },
      ],
    },
    contracts,
  },
  null,
  2
)}\n`;

if (process.argv.includes("--check")) {
  const [current, ...currentAbis] = await Promise.all([
    readFile(outputPath, "utf8").catch(() => ""),
    ...Object.keys(standaloneAbis).map((name) =>
      readFile(resolve(root, `shared/ethereum/${name}.abi.json`), "utf8").catch(
        () => ""
      )
    ),
  ]);
  const abisCurrent = Object.values(standaloneAbis).every(
    (standaloneAbi, index) => currentAbis[index] === standaloneAbi
  );
  if (current !== generated || !abisCurrent) {
    console.error(
      "Ethereum protocol contract artifact is stale. Run npm run ethereum:contract."
    );
    process.exitCode = 1;
  } else {
    console.log(
      "Ethereum protocol contract and standalone ABI artifacts are current."
    );
  }
} else {
  await Promise.all([
    writeFile(outputPath, generated, "utf8"),
    ...Object.entries(standaloneAbis).map(([name, standaloneAbi]) =>
      writeFile(
        resolve(root, `shared/ethereum/${name}.abi.json`),
        standaloneAbi,
        "utf8"
      )
    ),
  ]);
  console.log(
    "Wrote shared/ethereum/protocol_contract.json and four standalone contract ABIs"
  );
}
