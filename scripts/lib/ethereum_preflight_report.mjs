// SPDX-License-Identifier: AGPL-3.0-or-later

import { canonicalImmutableReferences } from "./ethereum_bytecode.mjs";
import { ETHEREUM_CONTRACT_NAMES } from "./ethereum_contract_set.mjs";
import { EIP7825_TRANSACTION_GAS_LIMIT } from "./ethereum_deploy_guard.mjs";

function required(value, field) {
  if (value === undefined || value === null || value === "") {
    throw new Error(`Preflight report field ${field} is unavailable`);
  }
  return value;
}

function decimalString(value, field) {
  let parsed;
  try {
    parsed = BigInt(required(value, field));
  } catch {
    throw new Error(`Preflight report field ${field} is not an integer`);
  }
  if (parsed < 0n) {
    throw new Error(`Preflight report field ${field} must not be negative`);
  }
  return parsed.toString();
}

function safeInteger(value, field) {
  const parsed = required(value, field);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error(
      `Preflight report field ${field} must be a non-negative safe integer`
    );
  }
  return parsed;
}

export function buildEthereumPreflightReport(
  config,
  release,
  runtime,
  chainId
) {
  const contracts = {};
  for (const contractName of ETHEREUM_CONTRACT_NAMES) {
    const contract = required(
      release.contracts?.[contractName],
      `contracts.${contractName}`
    );
    contracts[contractName] = {
      creationBytecodeHash: required(
        contract.creationBytecodeHash,
        `${contractName}.creationBytecodeHash`
      ),
      creationBytecodeBytes: required(
        runtime.creationBytecodeBytes?.[contractName],
        `${contractName}.creationBytecodeBytes`
      ),
      runtimeBytecodeTemplateHash: required(
        contract.runtimeBytecodeTemplateHash,
        `${contractName}.runtimeBytecodeTemplateHash`
      ),
      runtimeBytecodeBytes: required(
        runtime.runtimeBytecodeBytes?.[contractName],
        `${contractName}.runtimeBytecodeBytes`
      ),
      immutableReferences: canonicalImmutableReferences(
        required(
          contract.immutableReferences,
          `${contractName}.immutableReferences`
        )
      ),
    };
  }
  return {
    ok: true,
    mode: "preflight-only-no-transaction",
    deploymentTransactions: 1,
    entryContract: "NakamaProtocolFactory",
    chainId: Number(chainId),
    caip2: "eip155:1",
    deployer: required(runtime.deployer, "deployer"),
    balanceRequirementMet: true,
    latestNonce: safeInteger(runtime.latestNonce, "latestNonce"),
    pendingNonce: safeInteger(runtime.pendingNonce, "pendingNonce"),
    latestBlockNumber: safeInteger(
      runtime.latestBlockNumber,
      "latestBlockNumber"
    ),
    latestBlockGasLimit: decimalString(
      runtime.latestBlockGasLimit,
      "latestBlockGasLimit"
    ),
    estimatedFactoryDeploymentGas: decimalString(
      runtime.estimatedFactoryDeploymentGas,
      "estimatedFactoryDeploymentGas"
    ),
    eip7825TransactionGasLimit: EIP7825_TRANSACTION_GAS_LIMIT.toString(),
    sourceCommit: required(config.sourceCommit, "sourceCommit"),
    auditReportSha256: required(config.auditReportSha256, "auditReportSha256"),
    releaseApprovalSha256: required(
      config.releaseApprovalSha256,
      "releaseApprovalSha256"
    ),
    protocolArtifactSha256: required(
      release.protocolArtifactSha256,
      "protocolArtifactSha256"
    ),
    confirmations: required(config.confirmations, "confirmations"),
    contracts,
  };
}
