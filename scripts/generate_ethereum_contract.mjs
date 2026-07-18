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
const protocolAbiOutputPath = resolve(root, "shared/ethereum/NakamaCoverageProtocol.abi.json");
const artifactPaths = {
  NakamaCoverageProtocol: resolve(
    root,
    "artifacts/hardhat/contracts/NakamaCoverageProtocol.sol/NakamaCoverageProtocol.json",
  ),
  ReserveVault: resolve(root, "artifacts/hardhat/contracts/ReserveVault.sol/ReserveVault.json"),
};

const contracts = {};
let protocolAbiGenerated = "";
for (const [name, path] of Object.entries(artifactPaths)) {
  const artifact = JSON.parse(await readFile(path, "utf8"));
  const standaloneAbi = `${JSON.stringify(artifact.abi, null, 2)}\n`;
  const immutableReferences = canonicalImmutableReferences(artifact.immutableReferences);
  contracts[name] = {
    abi: artifact.abi,
    abiSha256: createHash("sha256").update(standaloneAbi).digest("hex"),
    creationBytecodeHash: keccak256(artifact.bytecode),
    runtimeBytecodeTemplateHash: runtimeBytecodeTemplateHash(
      artifact.deployedBytecode,
      immutableReferences,
    ),
    runtimeBytecodeBytes: runtimeBytecodeBytes(artifact.deployedBytecode),
    immutableReferences,
  };
  if (name === "NakamaCoverageProtocol") protocolAbiGenerated = standaloneAbi;
}

const generated = `${JSON.stringify(
  {
    schemaVersion: 2,
    chainFamily: "eip155",
    canonicalChain: "eip155:1",
    compiler: {
      version: "0.8.28",
      evmVersion: "cancun",
      optimizerRuns: 200,
      viaIR: true,
    },
    contracts,
  },
  null,
  2,
)}\n`;

if (process.argv.includes("--check")) {
  const [current, currentProtocolAbi] = await Promise.all([
    readFile(outputPath, "utf8").catch(() => ""),
    readFile(protocolAbiOutputPath, "utf8").catch(() => ""),
  ]);
  if (current !== generated || currentProtocolAbi !== protocolAbiGenerated) {
    console.error("Ethereum protocol contract artifact is stale. Run npm run ethereum:contract.");
    process.exitCode = 1;
  } else {
    console.log("Ethereum protocol contract and standalone ABI artifacts are current.");
  }
} else {
  await Promise.all([
    writeFile(outputPath, generated, "utf8"),
    writeFile(protocolAbiOutputPath, protocolAbiGenerated, "utf8"),
  ]);
  console.log("Wrote shared/ethereum/protocol_contract.json and standalone protocol ABI");
}
