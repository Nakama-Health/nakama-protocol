// SPDX-License-Identifier: AGPL-3.0-or-later

import { getAddress } from "ethers";

import {
  ETHEREUM_CONTRACT_NAMES,
  requireExactKeys,
} from "./ethereum_contract_set.mjs";

export const REQUIRED_DEPLOYMENT_CONFIRMATION =
  "DEPLOY_IMMUTABLE_NAKAMA_COVERAGE_PROTOCOL_TO_ETHEREUM_MAINNET";
export const EIP170_RUNTIME_LIMIT = 24_576;
export const EIP3860_INITCODE_LIMIT = 49_152;
// EIP-7825 caps the gas limit of one Ethereum mainnet transaction at 2^24.
export const EIP7825_TRANSACTION_GAS_LIMIT = 16_777_216n;

const HARDHAT_DEFAULT_PRIVATE_KEY =
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

function required(env, name) {
  const value = env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export function validateMainnetRpcUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error("ETHEREUM_MAINNET_RPC_URL must be a valid URL");
  }
  if (url.protocol !== "https:") {
    throw new Error("Ethereum mainnet RPC must use https");
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new Error(
      "Ethereum mainnet RPC URL must not contain embedded credentials, query parameters, or fragments"
    );
  }
  const hostname = url.hostname.toLowerCase();
  if (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "0.0.0.0" ||
    hostname === "::1" ||
    hostname.endsWith(".local")
  ) {
    throw new Error(
      "Local RPC endpoints are not accepted by the mainnet deployment guard"
    );
  }
  return value;
}

export function validateDeploymentEnvironment(env = process.env) {
  const confirmation = required(env, "NAKAMA_MAINNET_DEPLOY_CONFIRMATION");
  if (confirmation !== REQUIRED_DEPLOYMENT_CONFIRMATION) {
    throw new Error("Mainnet deployment confirmation phrase does not match");
  }

  const rpcUrl = validateMainnetRpcUrl(
    required(env, "ETHEREUM_MAINNET_RPC_URL")
  );
  const privateKey = required(env, "ETHEREUM_MAINNET_PRIVATE_KEY");
  if (!/^0x[0-9a-fA-F]{64}$/.test(privateKey)) {
    throw new Error("ETHEREUM_MAINNET_PRIVATE_KEY must be a 32-byte hex key");
  }
  if (privateKey.toLowerCase() === HARDHAT_DEFAULT_PRIVATE_KEY) {
    throw new Error(
      "The standard Hardhat development private key is forbidden"
    );
  }

  const expectedDeployer = getAddress(
    required(env, "NAKAMA_MAINNET_EXPECTED_DEPLOYER")
  );
  const sourceCommit = required(env, "NAKAMA_MAINNET_SOURCE_COMMIT");
  if (!/^[0-9a-f]{40}$/.test(sourceCommit)) {
    throw new Error(
      "NAKAMA_MAINNET_SOURCE_COMMIT must be a lowercase 40-character commit hash"
    );
  }

  const auditReportSha256 = required(env, "NAKAMA_MAINNET_AUDIT_REPORT_SHA256");
  if (!/^[0-9a-f]{64}$/.test(auditReportSha256)) {
    throw new Error(
      "NAKAMA_MAINNET_AUDIT_REPORT_SHA256 must be a lowercase SHA-256 digest"
    );
  }
  const releaseApprovalSha256 = required(
    env,
    "NAKAMA_MAINNET_RELEASE_APPROVAL_SHA256"
  );
  if (!/^[0-9a-f]{64}$/.test(releaseApprovalSha256)) {
    throw new Error(
      "NAKAMA_MAINNET_RELEASE_APPROVAL_SHA256 must be a lowercase SHA-256 digest"
    );
  }

  const confirmations = Number(required(env, "NAKAMA_MAINNET_CONFIRMATIONS"));
  if (!Number.isSafeInteger(confirmations) || confirmations < 12) {
    throw new Error(
      "NAKAMA_MAINNET_CONFIRMATIONS must be an integer of at least 12"
    );
  }

  let minimumBalanceWei;
  try {
    minimumBalanceWei = BigInt(
      required(env, "NAKAMA_MAINNET_MIN_DEPLOYER_BALANCE_WEI")
    );
  } catch {
    throw new Error(
      "NAKAMA_MAINNET_MIN_DEPLOYER_BALANCE_WEI must be an integer"
    );
  }
  if (minimumBalanceWei <= 0n) {
    throw new Error("NAKAMA_MAINNET_MIN_DEPLOYER_BALANCE_WEI must be positive");
  }

  return {
    rpcUrl,
    privateKey,
    expectedDeployer,
    sourceCommit,
    auditReportSha256,
    releaseApprovalSha256,
    confirmations,
    minimumBalanceWei,
  };
}

export function validateSourceCheckout(config, checkout) {
  if (!/^[0-9a-f]{40}$/.test(checkout.headCommit)) {
    throw new Error("Current git HEAD could not be resolved to a commit");
  }
  if (checkout.headCommit !== config.sourceCommit) {
    throw new Error(
      "NAKAMA_MAINNET_SOURCE_COMMIT does not match the current git HEAD"
    );
  }
  if (checkout.statusPorcelain.trim() !== "") {
    throw new Error(
      "Mainnet deployment requires a completely clean worktree, including generated artifacts"
    );
  }
  return checkout;
}

export function validateReleaseManifest(config, manifest, artifacts) {
  requireExactKeys(
    manifest,
    [
      "schemaVersion",
      "status",
      "sourceCommit",
      "expectedDeployer",
      "auditReportSha256",
      "releaseApprovalSha256",
      "protocolArtifactSha256",
      "contracts",
      "independentAuditCompleted",
      "releaseApproved",
    ],
    "Release manifest"
  );
  if (
    manifest.schemaVersion !== 3 ||
    manifest.status !== "approved-for-mainnet"
  ) {
    throw new Error(
      "A reviewed deployments/ethereum-mainnet.release.json with approved-for-mainnet status is required"
    );
  }
  if (manifest.sourceCommit !== config.sourceCommit) {
    throw new Error(
      "Release manifest sourceCommit does not match the deployment source commit"
    );
  }
  if (getAddress(manifest.expectedDeployer) !== config.expectedDeployer) {
    throw new Error(
      "Release manifest expectedDeployer does not match the configured deployer"
    );
  }
  if (manifest.auditReportSha256 !== config.auditReportSha256) {
    throw new Error(
      "Release manifest audit digest does not match NAKAMA_MAINNET_AUDIT_REPORT_SHA256"
    );
  }
  if (manifest.releaseApprovalSha256 !== config.releaseApprovalSha256) {
    throw new Error(
      "Release approval digest does not match NAKAMA_MAINNET_RELEASE_APPROVAL_SHA256"
    );
  }
  if (manifest.protocolArtifactSha256 !== artifacts.protocolArtifactSha256) {
    throw new Error(
      "Release manifest protocol artifact digest does not match the generated artifact"
    );
  }
  requireExactKeys(
    manifest.contracts,
    ETHEREUM_CONTRACT_NAMES,
    "Release manifest contracts"
  );
  for (const contractName of ETHEREUM_CONTRACT_NAMES) {
    const approved = requireExactKeys(
      manifest.contracts[contractName],
      ["creationBytecodeHash", "runtimeBytecodeTemplateHash"],
      `Release manifest ${contractName}`
    );
    const compiled = artifacts.contracts?.[contractName];
    if (!compiled)
      throw new Error(`Compiled artifact is missing ${contractName}`);
    if (approved.creationBytecodeHash !== compiled.creationBytecodeHash) {
      throw new Error(
        `Release manifest ${contractName} creation bytecode hash does not match the compiled artifact`
      );
    }
    if (
      approved.runtimeBytecodeTemplateHash !==
      compiled.runtimeBytecodeTemplateHash
    ) {
      throw new Error(
        `Release manifest ${contractName} runtime bytecode template hash does not match the compiled artifact`
      );
    }
  }
  if (
    manifest.independentAuditCompleted !== true ||
    manifest.releaseApproved !== true
  ) {
    throw new Error(
      "Release manifest must record completed independent audit and release approval"
    );
  }
  return manifest;
}

export function validateDeploymentRuntime(config, runtime) {
  if (BigInt(runtime.chainId) !== 1n) {
    throw new Error(
      `Refusing deployment on chain ${runtime.chainId}; expected Ethereum mainnet chain 1`
    );
  }
  const actualDeployer = getAddress(runtime.deployer);
  if (actualDeployer !== config.expectedDeployer) {
    throw new Error(
      `Configured signer ${actualDeployer} does not match NAKAMA_MAINNET_EXPECTED_DEPLOYER`
    );
  }
  if (BigInt(runtime.balanceWei) < config.minimumBalanceWei) {
    throw new Error(
      "Deployer balance is below NAKAMA_MAINNET_MIN_DEPLOYER_BALANCE_WEI"
    );
  }

  const latestNonce = runtime.latestNonce;
  const pendingNonce = runtime.pendingNonce;
  if (!Number.isSafeInteger(latestNonce) || latestNonce < 0) {
    throw new Error("Latest deployer nonce is unavailable");
  }
  if (!Number.isSafeInteger(pendingNonce) || pendingNonce < 0) {
    throw new Error("Pending deployer nonce is unavailable");
  }
  if (latestNonce !== pendingNonce) {
    throw new Error(
      "Expected deployer has pending transactions; reconcile them before mainnet deployment"
    );
  }

  const latestBlockNumber = runtime.latestBlockNumber;
  if (!Number.isSafeInteger(latestBlockNumber) || latestBlockNumber < 0) {
    throw new Error("Latest Ethereum block number is unavailable");
  }

  let latestBlockGasLimit;
  try {
    latestBlockGasLimit = BigInt(runtime.latestBlockGasLimit);
  } catch {
    throw new Error("Latest Ethereum block gas limit is unavailable");
  }
  if (latestBlockGasLimit <= 0n) {
    throw new Error("Latest Ethereum block gas limit must be positive");
  }

  let estimatedFactoryDeploymentGas;
  try {
    estimatedFactoryDeploymentGas = BigInt(
      runtime.estimatedFactoryDeploymentGas
    );
  } catch {
    throw new Error("Factory deployment gas estimate is unavailable");
  }
  if (estimatedFactoryDeploymentGas <= 0n) {
    throw new Error("Factory deployment gas estimate must be positive");
  }
  if (estimatedFactoryDeploymentGas > EIP7825_TRANSACTION_GAS_LIMIT) {
    throw new Error(
      `Factory deployment gas estimate ${estimatedFactoryDeploymentGas} exceeds the EIP-7825 transaction gas limit ${EIP7825_TRANSACTION_GAS_LIMIT}`
    );
  }
  if (estimatedFactoryDeploymentGas > latestBlockGasLimit) {
    throw new Error(
      `Factory deployment gas estimate ${estimatedFactoryDeploymentGas} exceeds latest block gas limit ${latestBlockGasLimit}`
    );
  }

  requireExactKeys(
    runtime.runtimeBytecodeBytes,
    ETHEREUM_CONTRACT_NAMES,
    "Runtime bytecode sizes"
  );
  requireExactKeys(
    runtime.creationBytecodeBytes,
    ETHEREUM_CONTRACT_NAMES,
    "Creation bytecode sizes"
  );
  for (const contractName of ETHEREUM_CONTRACT_NAMES) {
    const runtimeBytes = runtime.runtimeBytecodeBytes[contractName];
    const creationBytes = runtime.creationBytecodeBytes[contractName];
    if (!Number.isSafeInteger(runtimeBytes) || runtimeBytes <= 0) {
      throw new Error(`${contractName} runtime bytecode size is unavailable`);
    }
    if (runtimeBytes > EIP170_RUNTIME_LIMIT) {
      throw new Error(
        `${contractName} runtime bytecode is ${runtimeBytes} bytes, above the EIP-170 limit ${EIP170_RUNTIME_LIMIT}`
      );
    }
    if (!Number.isSafeInteger(creationBytes) || creationBytes <= 0) {
      throw new Error(`${contractName} creation bytecode size is unavailable`);
    }
    if (creationBytes > EIP3860_INITCODE_LIMIT) {
      throw new Error(
        `${contractName} creation bytecode is ${creationBytes} bytes, above the EIP-3860 limit ${EIP3860_INITCODE_LIMIT}`
      );
    }
  }
  return {
    ...runtime,
    deployer: actualDeployer,
    latestNonce,
    pendingNonce,
    latestBlockNumber,
    latestBlockGasLimit,
    estimatedFactoryDeploymentGas,
  };
}
