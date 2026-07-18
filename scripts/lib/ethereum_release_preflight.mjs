// SPDX-License-Identifier: AGPL-3.0-or-later

import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { promisify } from "node:util";
import { keccak256 } from "ethers";

import {
  validateReleaseManifest,
  validateSourceCheckout,
} from "./ethereum_deploy_guard.mjs";
import {
  canonicalImmutableReferences,
  runtimeBytecodeBytes,
  runtimeBytecodeTemplateHash,
} from "./ethereum_bytecode.mjs";

const execFileAsync = promisify(execFile);

export async function runReleasePreflight(config, root = process.cwd()) {
  const [{ stdout: headCommit }, { stdout: statusPorcelain }] = await Promise.all([
    execFileAsync("git", ["rev-parse", "HEAD"], { cwd: root }),
    execFileAsync("git", ["status", "--porcelain=v1", "--untracked-files=all"], { cwd: root }),
  ]);
  validateSourceCheckout(config, {
    headCommit: headCommit.trim(),
    statusPorcelain,
  });

  const hardhatArtifactPath = resolve(
    root,
    "artifacts/hardhat/contracts/NakamaCoverageProtocol.sol/NakamaCoverageProtocol.json",
  );
  const protocolArtifactPath = resolve(root, "shared/ethereum/protocol_contract.json");
  const protocolAbiPath = resolve(root, "shared/ethereum/NakamaCoverageProtocol.abi.json");
  const releaseManifestPath = resolve(root, "deployments/ethereum-mainnet.release.json");
  const [hardhatArtifactRaw, protocolArtifactRaw, protocolAbiRaw, releaseManifestRaw] = await Promise.all([
    readFile(hardhatArtifactPath, "utf8"),
    readFile(protocolArtifactPath, "utf8"),
    readFile(protocolAbiPath, "utf8"),
    readFile(releaseManifestPath, "utf8").catch(() => {
      throw new Error(
        "Missing deployments/ethereum-mainnet.release.json; copy the example only after audit and release approval",
      );
    }),
  ]);
  const hardhatArtifact = JSON.parse(hardhatArtifactRaw);
  const protocolArtifact = JSON.parse(protocolArtifactRaw);
  const protocolAbi = JSON.parse(protocolAbiRaw);
  const releaseManifest = JSON.parse(releaseManifestRaw);
  const protocolImmutableReferences = canonicalImmutableReferences(hardhatArtifact.immutableReferences);
  const protocolRuntimeBytecodeTemplateHash = runtimeBytecodeTemplateHash(
    hardhatArtifact.deployedBytecode,
    protocolImmutableReferences,
  );
  const protocolCreationBytecodeHash = keccak256(hardhatArtifact.bytecode);
  if (protocolArtifact.schemaVersion !== 2) {
    throw new Error("Generated protocol artifact must use schemaVersion 2");
  }
  if (
    protocolArtifact.contracts?.NakamaCoverageProtocol?.runtimeBytecodeTemplateHash !==
    protocolRuntimeBytecodeTemplateHash
  ) {
    throw new Error("Generated protocol artifact template is stale relative to the Hardhat runtime bytecode");
  }
  if (
    JSON.stringify(protocolArtifact.contracts?.NakamaCoverageProtocol?.immutableReferences)
      !== JSON.stringify(protocolImmutableReferences)
  ) {
    throw new Error("Generated protocol artifact immutable references are stale");
  }
  if (
    protocolArtifact.contracts?.NakamaCoverageProtocol?.creationBytecodeHash
      !== protocolCreationBytecodeHash
  ) {
    throw new Error("Generated protocol artifact creation bytecode hash is stale");
  }
  if (
    JSON.stringify(protocolAbi)
      !== JSON.stringify(protocolArtifact.contracts?.NakamaCoverageProtocol?.abi)
  ) {
    throw new Error("Standalone protocol ABI is stale relative to the generated protocol artifact");
  }
  const protocolAbiSha256 = createHash("sha256").update(protocolAbiRaw).digest("hex");
  if (protocolArtifact.contracts?.NakamaCoverageProtocol?.abiSha256 !== protocolAbiSha256) {
    throw new Error("Standalone protocol ABI digest does not match the generated protocol artifact");
  }
  const protocolArtifactSha256 = createHash("sha256").update(protocolArtifactRaw).digest("hex");
  validateReleaseManifest(config, releaseManifest, {
    protocolCreationBytecodeHash,
    protocolRuntimeBytecodeTemplateHash,
    protocolArtifactSha256,
  });

  return {
    headCommit: headCommit.trim(),
    protocolRuntimeBytecodeTemplateHash,
    protocolImmutableReferences,
    protocolCreationBytecodeHash,
    protocolArtifactSha256,
    protocolAbi,
    protocolAbiSha256,
    runtimeBytecodeBytes: runtimeBytecodeBytes(hardhatArtifact.deployedBytecode),
    releaseManifest,
  };
}
