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
import {
  ETHEREUM_CONTRACT_NAMES,
  RESERVE_VAULT_TEMPLATE,
  protocolAbiPath,
} from "./ethereum_contract_set.mjs";

const execFileAsync = promisify(execFile);

function hardhatArtifactPath(root, contractName) {
  return resolve(
    root,
    `artifacts/hardhat/contracts/${contractName}.sol/${contractName}.json`
  );
}

function equalJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

export async function runReleasePreflight(config, root = process.cwd()) {
  const [{ stdout: headCommit }, { stdout: statusPorcelain }] =
    await Promise.all([
      execFileAsync("git", ["rev-parse", "HEAD"], { cwd: root }),
      execFileAsync(
        "git",
        ["status", "--porcelain=v1", "--untracked-files=all"],
        { cwd: root }
      ),
    ]);
  validateSourceCheckout(config, {
    headCommit: headCommit.trim(),
    statusPorcelain,
  });

  const protocolArtifactPath = resolve(
    root,
    "shared/ethereum/protocol_contract.json"
  );
  const releaseManifestPath = resolve(
    root,
    "deployments/ethereum-mainnet.release.json"
  );
  const [protocolArtifactRaw, releaseManifestRaw, ...artifactAndAbiRaw] =
    await Promise.all([
      readFile(protocolArtifactPath, "utf8"),
      readFile(releaseManifestPath, "utf8").catch(() => {
        throw new Error(
          "Missing deployments/ethereum-mainnet.release.json; copy the example only after audit and release approval"
        );
      }),
      ...ETHEREUM_CONTRACT_NAMES.flatMap((contractName) => [
        readFile(hardhatArtifactPath(root, contractName), "utf8"),
        readFile(resolve(root, protocolAbiPath(contractName)), "utf8"),
      ]),
    ]);

  const protocolArtifact = JSON.parse(protocolArtifactRaw);
  const releaseManifest = JSON.parse(releaseManifestRaw);
  if (
    protocolArtifact.schemaVersion !== 3 ||
    protocolArtifact.chainFamily !== "eip155" ||
    protocolArtifact.canonicalChain !== "eip155:1" ||
    protocolArtifact.deploymentPlan?.transactionCount !== 1 ||
    protocolArtifact.deploymentPlan?.entryContract !==
      "NakamaProtocolFactory" ||
    !equalJson(protocolArtifact.deploymentPlan?.factoryCreates, [
      { contractName: "NakamaPolicyRegistry", nonce: 1 },
      { contractName: "NakamaCoverageProtocol", nonce: 2 },
    ]) ||
    !equalJson(protocolArtifact.deploymentPlan?.templates, [
      RESERVE_VAULT_TEMPLATE,
    ])
  ) {
    throw new Error(
      "Generated protocol artifact must use the canonical schema-v3 factory deployment plan"
    );
  }

  const contracts = {};
  let factoryCreationBytecode;
  for (const [index, contractName] of ETHEREUM_CONTRACT_NAMES.entries()) {
    const hardhatArtifactRaw = artifactAndAbiRaw[index * 2];
    const standaloneAbiRaw = artifactAndAbiRaw[index * 2 + 1];
    const hardhatArtifact = JSON.parse(hardhatArtifactRaw);
    const standaloneAbi = JSON.parse(standaloneAbiRaw);
    const immutableReferences = canonicalImmutableReferences(
      hardhatArtifact.immutableReferences
    );
    const contract = {
      abi: hardhatArtifact.abi,
      abiSha256: createHash("sha256").update(standaloneAbiRaw).digest("hex"),
      creationBytecodeHash: keccak256(hardhatArtifact.bytecode),
      creationBytecodeBytes: runtimeBytecodeBytes(hardhatArtifact.bytecode),
      runtimeBytecodeTemplateHash: runtimeBytecodeTemplateHash(
        hardhatArtifact.deployedBytecode,
        immutableReferences
      ),
      runtimeBytecodeBytes: runtimeBytecodeBytes(
        hardhatArtifact.deployedBytecode
      ),
      immutableReferences,
    };
    const generated = protocolArtifact.contracts?.[contractName];
    if (!generated || !equalJson(generated, contract)) {
      throw new Error(
        `Generated ${contractName} artifact is stale relative to the Hardhat artifact and standalone ABI`
      );
    }
    if (!equalJson(standaloneAbi, hardhatArtifact.abi)) {
      throw new Error(
        `${contractName} standalone ABI is stale relative to the Hardhat artifact`
      );
    }
    if (contractName === "NakamaProtocolFactory") {
      factoryCreationBytecode = hardhatArtifact.bytecode;
    }
    contracts[contractName] = contract;
  }
  if (!factoryCreationBytecode) {
    throw new Error("Compiled artifact is missing factory creation bytecode");
  }

  const protocolArtifactSha256 = createHash("sha256")
    .update(protocolArtifactRaw)
    .digest("hex");
  validateReleaseManifest(config, releaseManifest, {
    contracts,
    protocolArtifactSha256,
  });

  return {
    headCommit: headCommit.trim(),
    contracts,
    factoryCreationBytecode,
    protocolArtifactSha256,
    releaseManifest,
  };
}
