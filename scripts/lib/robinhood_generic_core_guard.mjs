// SPDX-License-Identifier: AGPL-3.0-or-later

import { getAddress } from "ethers";

import {
  ETHEREUM_CONTRACT_NAMES,
  requireExactKeys,
} from "./ethereum_contract_set.mjs";
import {
  EIP170_RUNTIME_LIMIT,
  EIP3860_INITCODE_LIMIT,
} from "./ethereum_deploy_guard.mjs";

export const ROBINHOOD_GENERIC_TESTNET_CHAIN_ID = 46_630n;
export const ROBINHOOD_GENERIC_TESTNET_CAIP2 = "eip155:46630";
export const ROBINHOOD_GENERIC_TESTNET_MINIMUM_FINAL_CONFIRMATIONS = 20;
export const ROBINHOOD_GENERIC_TESTNET_CONFIRMATION =
  "DEPLOY_IMMUTABLE_NAKAMA_GENERIC_CORE_TO_ROBINHOOD_TESTNET";
export const ROBINHOOD_TESTNET_BLOCKSCOUT_API_BASE_URL =
  "https://explorer.testnet.chain.robinhood.com/api/v2";
export const ROBINHOOD_MAINNET_CANONICAL_USDG_ADDRESS =
  "0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168";
export const ROBINHOOD_TESTNET_SETTLEMENT_ASSET_CLASSIFICATION =
  "test-only-mock";
export const ROBINHOOD_TESTNET_SETTLEMENT_ASSET_CONTRACT =
  "NakamaTestUsd";

const HARDHAT_DEFAULT_PRIVATE_KEY =
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
const SHA256_PATTERN = /^[0-9a-f]{64}$/;
const HASH_PATTERN = /^0x[0-9a-fA-F]{64}$/;

function required(env, name) {
  const value = env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export function validateRobinhoodTestnetRpcUrl(value, field) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${field} must be a valid URL`);
  }
  if (url.protocol !== "https:") {
    throw new Error(`${field} must use https`);
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new Error(
      `${field} must not contain user info, query parameters, or fragments`
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
    throw new Error(`${field} must not use a local endpoint`);
  }
  if (hostname === "rpc.testnet.chain.robinhood.com") {
    throw new Error(
      `${field} must use a production-grade provider; Robinhood's public testnet RPC is rate-limited`
    );
  }
  return url.toString();
}

export function validateIndependentRobinhoodRpcUrls(primary, fallback) {
  const primaryUrl = new URL(primary);
  const fallbackUrl = new URL(fallback);
  if (primaryUrl.hostname.toLowerCase() === fallbackUrl.hostname.toLowerCase()) {
    throw new Error(
      "Robinhood testnet RPC providers must use different provider hostnames"
    );
  }
  return [primary, fallback];
}

function requiredSha256(env, name) {
  const value = required(env, name);
  if (!SHA256_PATTERN.test(value)) {
    throw new Error(`${name} must be a lowercase SHA-256 digest`);
  }
  return value;
}

function requiredPositiveBigInt(env, name) {
  let value;
  try {
    value = BigInt(required(env, name));
  } catch {
    throw new Error(`${name} must be an integer`);
  }
  if (value <= 0n) throw new Error(`${name} must be positive`);
  return value;
}

function requiredUint8(env, name) {
  const value = Number(required(env, name));
  if (!Number.isSafeInteger(value) || value < 0 || value > 255) {
    throw new Error(`${name} must be an integer from 0 through 255`);
  }
  return value;
}

export function validateRobinhoodTestnetSettlementAssetConfiguration(
  env = process.env
) {
  const address = getAddress(
    required(env, "ROBINHOOD_TESTNET_SETTLEMENT_ASSET_ADDRESS")
  );
  if (
    address === getAddress("0x0000000000000000000000000000000000000000")
  ) {
    throw new Error(
      "ROBINHOOD_TESTNET_SETTLEMENT_ASSET_ADDRESS cannot be zero"
    );
  }
  if (address === getAddress(ROBINHOOD_MAINNET_CANONICAL_USDG_ADDRESS)) {
    throw new Error(
      "Robinhood mainnet canonical USDG cannot be configured as a testnet settlement asset"
    );
  }

  const name = required(env, "ROBINHOOD_TESTNET_SETTLEMENT_ASSET_NAME");
  const symbol = required(env, "ROBINHOOD_TESTNET_SETTLEMENT_ASSET_SYMBOL");
  if (name === "Global Dollar" || symbol.toUpperCase() === "USDG") {
    throw new Error(
      "Robinhood testnet has no documented canonical USDG; use an explicitly named test-only token"
    );
  }
  if (
    name.length > 80 ||
    symbol.length > 16 ||
    !/^t[A-Za-z0-9]+$/.test(symbol)
  ) {
    throw new Error(
      "Robinhood testnet settlement token must use a short test-prefixed symbol such as tUSDG"
    );
  }

  const deploymentTransaction = required(
    env,
    "ROBINHOOD_TESTNET_SETTLEMENT_ASSET_DEPLOYMENT_TRANSACTION"
  );
  if (!HASH_PATTERN.test(deploymentTransaction)) {
    throw new Error(
      "ROBINHOOD_TESTNET_SETTLEMENT_ASSET_DEPLOYMENT_TRANSACTION must be a 32-byte transaction hash"
    );
  }

  return {
    contractName: ROBINHOOD_TESTNET_SETTLEMENT_ASSET_CONTRACT,
    address,
    name,
    symbol,
    decimals: requiredUint8(
      env,
      "ROBINHOOD_TESTNET_SETTLEMENT_ASSET_DECIMALS"
    ),
    deploymentTransaction: deploymentTransaction.toLowerCase(),
    classification: ROBINHOOD_TESTNET_SETTLEMENT_ASSET_CLASSIFICATION,
    canonical: false,
  };
}

export function validateRobinhoodGenericTestnetEnvironment(
  env = process.env
) {
  if (
    required(
      env,
      "NAKAMA_ROBINHOOD_GENERIC_TESTNET_DEPLOY_CONFIRMATION"
    ) !== ROBINHOOD_GENERIC_TESTNET_CONFIRMATION
  ) {
    throw new Error(
      "Robinhood generic-core testnet deployment confirmation phrase does not match"
    );
  }

  const rpcUrl = validateRobinhoodTestnetRpcUrl(
    required(env, "ROBINHOOD_TESTNET_RPC_URL"),
    "ROBINHOOD_TESTNET_RPC_URL"
  );
  const fallbackRpcUrl = validateRobinhoodTestnetRpcUrl(
    required(env, "ROBINHOOD_TESTNET_RPC_FALLBACK_URL"),
    "ROBINHOOD_TESTNET_RPC_FALLBACK_URL"
  );
  validateIndependentRobinhoodRpcUrls(rpcUrl, fallbackRpcUrl);

  const privateKey = required(env, "ROBINHOOD_TESTNET_PRIVATE_KEY");
  if (!/^0x[0-9a-fA-F]{64}$/.test(privateKey)) {
    throw new Error(
      "ROBINHOOD_TESTNET_PRIVATE_KEY must be a 32-byte hex private key"
    );
  }
  if (privateKey.toLowerCase() === HARDHAT_DEFAULT_PRIVATE_KEY) {
    throw new Error("The standard Hardhat development private key is forbidden");
  }

  const expectedDeployer = getAddress(
    required(env, "NAKAMA_ROBINHOOD_GENERIC_TESTNET_EXPECTED_DEPLOYER")
  );
  const settlementAsset =
    validateRobinhoodTestnetSettlementAssetConfiguration(env);

  const sourceCommit = required(
    env,
    "NAKAMA_ROBINHOOD_GENERIC_TESTNET_SOURCE_COMMIT"
  );
  if (!/^[0-9a-f]{40}$/.test(sourceCommit)) {
    throw new Error(
      "NAKAMA_ROBINHOOD_GENERIC_TESTNET_SOURCE_COMMIT must be a lowercase 40-character commit hash"
    );
  }

  const confirmations = Number(
    required(env, "NAKAMA_ROBINHOOD_GENERIC_TESTNET_CONFIRMATIONS")
  );
  if (
    !Number.isSafeInteger(confirmations) ||
    confirmations < ROBINHOOD_GENERIC_TESTNET_MINIMUM_FINAL_CONFIRMATIONS
  ) {
    throw new Error(
      `NAKAMA_ROBINHOOD_GENERIC_TESTNET_CONFIRMATIONS must be an integer of at least ${ROBINHOOD_GENERIC_TESTNET_MINIMUM_FINAL_CONFIRMATIONS}`
    );
  }

  return {
    rpcUrl,
    fallbackRpcUrl,
    privateKey,
    expectedDeployer,
    settlementAsset,
    sourceCommit,
    qualificationReportSha256: requiredSha256(
      env,
      "NAKAMA_ROBINHOOD_GENERIC_TESTNET_QUALIFICATION_SHA256"
    ),
    releaseApprovalSha256: requiredSha256(
      env,
      "NAKAMA_ROBINHOOD_GENERIC_TESTNET_RELEASE_APPROVAL_SHA256"
    ),
    confirmations,
    minimumBalanceWei: requiredPositiveBigInt(
      env,
      "NAKAMA_ROBINHOOD_GENERIC_TESTNET_MIN_DEPLOYER_BALANCE_WEI"
    ),
  };
}

export function validateRobinhoodGenericTestnetReleaseManifest(
  config,
  manifest,
  artifacts
) {
  requireExactKeys(
    manifest,
    [
      "schemaVersion",
      "status",
      "chainId",
      "caip2",
      "sourceCommit",
      "expectedDeployer",
      "qualificationReportSha256",
      "releaseApprovalSha256",
      "protocolArtifactSha256",
      "settlementAsset",
      "contracts",
      "qualificationReviewCompleted",
      "releaseApproved",
    ],
    "Robinhood generic-core testnet release manifest"
  );
  if (
    manifest.schemaVersion !== 3 ||
    manifest.status !== "approved-for-testnet" ||
    manifest.chainId !== Number(ROBINHOOD_GENERIC_TESTNET_CHAIN_ID) ||
    manifest.caip2 !== ROBINHOOD_GENERIC_TESTNET_CAIP2
  ) {
    throw new Error(
      "A reviewed schema-v3 Robinhood generic-core testnet release manifest is required"
    );
  }
  if (manifest.sourceCommit !== config.sourceCommit) {
    throw new Error(
      "Robinhood testnet release sourceCommit does not match the configured source commit"
    );
  }
  if (getAddress(manifest.expectedDeployer) !== config.expectedDeployer) {
    throw new Error(
      "Robinhood testnet release expectedDeployer does not match the configured deployer"
    );
  }
  if (
    manifest.qualificationReportSha256 !== config.qualificationReportSha256 ||
    manifest.releaseApprovalSha256 !== config.releaseApprovalSha256
  ) {
    throw new Error(
      "Robinhood testnet qualification or approval digest does not match the environment"
    );
  }
  if (manifest.protocolArtifactSha256 !== artifacts.protocolArtifactSha256) {
    throw new Error(
      "Robinhood testnet protocol artifact digest does not match the generated artifact"
    );
  }
  requireExactKeys(
    manifest.settlementAsset,
    [
      "address",
      "contractName",
      "name",
      "symbol",
      "decimals",
      "deploymentTransaction",
      "classification",
      "canonical",
    ],
    "Robinhood testnet release settlementAsset"
  );
  const approvedSettlementAsset = {
    ...manifest.settlementAsset,
    address: getAddress(manifest.settlementAsset.address),
    deploymentTransaction:
      manifest.settlementAsset.deploymentTransaction?.toLowerCase(),
  };
  if (
    approvedSettlementAsset.contractName !==
      config.settlementAsset.contractName ||
    approvedSettlementAsset.address !== config.settlementAsset.address ||
    approvedSettlementAsset.name !== config.settlementAsset.name ||
    approvedSettlementAsset.symbol !== config.settlementAsset.symbol ||
    approvedSettlementAsset.decimals !== config.settlementAsset.decimals ||
    approvedSettlementAsset.deploymentTransaction !==
      config.settlementAsset.deploymentTransaction ||
    approvedSettlementAsset.classification !==
      config.settlementAsset.classification ||
    approvedSettlementAsset.canonical !== config.settlementAsset.canonical
  ) {
    throw new Error(
      "Robinhood testnet release settlement asset does not match the configured reviewed test token"
    );
  }
  requireExactKeys(
    manifest.contracts,
    ETHEREUM_CONTRACT_NAMES,
    "Robinhood testnet release contracts"
  );
  for (const contractName of ETHEREUM_CONTRACT_NAMES) {
    const approved = requireExactKeys(
      manifest.contracts[contractName],
      ["creationBytecodeHash", "runtimeBytecodeTemplateHash"],
      `Robinhood testnet release ${contractName}`
    );
    const compiled = artifacts.contracts?.[contractName];
    if (!compiled) {
      throw new Error(`Compiled artifact is missing ${contractName}`);
    }
    if (
      approved.creationBytecodeHash !== compiled.creationBytecodeHash ||
      approved.runtimeBytecodeTemplateHash !==
        compiled.runtimeBytecodeTemplateHash
    ) {
      throw new Error(
        `Robinhood testnet release ${contractName} does not match the compiled artifact`
      );
    }
  }
  if (
    manifest.qualificationReviewCompleted !== true ||
    manifest.releaseApproved !== true
  ) {
    throw new Error(
      "Robinhood testnet release must record qualification review and explicit release approval"
    );
  }
  return manifest;
}

export function validateRobinhoodGenericTestnetRuntime(config, runtime) {
  if (BigInt(runtime.chainId) !== ROBINHOOD_GENERIC_TESTNET_CHAIN_ID) {
    throw new Error(
      `Refusing deployment on chain ${runtime.chainId}; expected Robinhood testnet ${ROBINHOOD_GENERIC_TESTNET_CHAIN_ID}`
    );
  }
  const actualDeployer = getAddress(runtime.deployer);
  if (actualDeployer !== config.expectedDeployer) {
    throw new Error(
      "Configured Robinhood testnet signer does not match the approved deployer"
    );
  }
  if (BigInt(runtime.balanceWei) < config.minimumBalanceWei) {
    throw new Error("Robinhood testnet deployer balance is below the minimum");
  }
  if (
    !Number.isSafeInteger(runtime.latestNonce) ||
    runtime.latestNonce < 0 ||
    !Number.isSafeInteger(runtime.pendingNonce) ||
    runtime.pendingNonce < 0
  ) {
    throw new Error("Robinhood testnet deployer nonce is unavailable");
  }
  if (runtime.latestNonce !== runtime.pendingNonce) {
    throw new Error(
      "Robinhood testnet deployer has pending transactions; reconcile them before deployment"
    );
  }
  if (
    !Number.isSafeInteger(runtime.latestBlockNumber) ||
    runtime.latestBlockNumber < 0
  ) {
    throw new Error("Latest Robinhood testnet block number is unavailable");
  }

  const latestBlockGasLimit = BigInt(runtime.latestBlockGasLimit);
  const estimatedFactoryDeploymentGas = BigInt(
    runtime.estimatedFactoryDeploymentGas
  );
  if (
    latestBlockGasLimit <= 0n ||
    estimatedFactoryDeploymentGas <= 0n ||
    estimatedFactoryDeploymentGas > latestBlockGasLimit
  ) {
    throw new Error(
      "Robinhood testnet factory deployment gas is unavailable or exceeds the latest block gas limit"
    );
  }

  requireExactKeys(
    runtime.runtimeBytecodeBytes,
    ETHEREUM_CONTRACT_NAMES,
    "Robinhood generic-core runtime bytecode sizes"
  );
  requireExactKeys(
    runtime.creationBytecodeBytes,
    ETHEREUM_CONTRACT_NAMES,
    "Robinhood generic-core creation bytecode sizes"
  );
  for (const contractName of ETHEREUM_CONTRACT_NAMES) {
    const runtimeBytes = runtime.runtimeBytecodeBytes[contractName];
    const creationBytes = runtime.creationBytecodeBytes[contractName];
    if (
      !Number.isSafeInteger(runtimeBytes) ||
      runtimeBytes <= 0 ||
      runtimeBytes > EIP170_RUNTIME_LIMIT
    ) {
      throw new Error(
        `${contractName} runtime bytecode violates the EIP-170 limit`
      );
    }
    if (
      !Number.isSafeInteger(creationBytes) ||
      creationBytes <= 0 ||
      creationBytes > EIP3860_INITCODE_LIMIT
    ) {
      throw new Error(
        `${contractName} creation bytecode violates the EIP-3860 limit`
      );
    }
  }
  return {
    ...runtime,
    deployer: actualDeployer,
    latestBlockGasLimit,
    estimatedFactoryDeploymentGas,
  };
}
