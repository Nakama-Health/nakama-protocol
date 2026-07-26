// SPDX-License-Identifier: AGPL-3.0-or-later

import { getAddress } from "ethers";

import {
  ROBINHOOD_GENERIC_TESTNET_MINIMUM_FINAL_CONFIRMATIONS,
  validateIndependentRobinhoodRpcUrls,
  validateRobinhoodTestnetRpcUrl,
} from "./robinhood_generic_core_guard.mjs";

export const ROBINHOOD_TEST_ASSET_DEPLOY_CONFIRMATION =
  "DEPLOY_FIXED_SUPPLY_NAKAMA_TEST_USD_TO_ROBINHOOD_TESTNET";

const HARDHAT_DEFAULT_PRIVATE_KEY =
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

function required(env, name) {
  const value = env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function positiveBigInt(env, name) {
  let value;
  try {
    value = BigInt(required(env, name));
  } catch {
    throw new Error(`${name} must be an integer`);
  }
  if (value <= 0n) throw new Error(`${name} must be positive`);
  return value;
}

export function validateRobinhoodTestAssetDeploymentEnvironment(
  env = process.env
) {
  if (
    required(env, "NAKAMA_ROBINHOOD_TEST_ASSET_DEPLOY_CONFIRMATION") !==
    ROBINHOOD_TEST_ASSET_DEPLOY_CONFIRMATION
  ) {
    throw new Error(
      "Robinhood test-asset deployment confirmation phrase does not match"
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

  const sourceCommit = required(
    env,
    "NAKAMA_ROBINHOOD_TEST_ASSET_SOURCE_COMMIT"
  );
  if (!/^[0-9a-f]{40}$/.test(sourceCommit)) {
    throw new Error(
      "NAKAMA_ROBINHOOD_TEST_ASSET_SOURCE_COMMIT must be a lowercase 40-character commit hash"
    );
  }
  const confirmations = Number(
    required(env, "NAKAMA_ROBINHOOD_TEST_ASSET_CONFIRMATIONS")
  );
  if (
    !Number.isSafeInteger(confirmations) ||
    confirmations < ROBINHOOD_GENERIC_TESTNET_MINIMUM_FINAL_CONFIRMATIONS
  ) {
    throw new Error(
      `NAKAMA_ROBINHOOD_TEST_ASSET_CONFIRMATIONS must be an integer of at least ${ROBINHOOD_GENERIC_TESTNET_MINIMUM_FINAL_CONFIRMATIONS}`
    );
  }

  return {
    rpcUrl,
    fallbackRpcUrl,
    privateKey,
    expectedDeployer: getAddress(
      required(env, "NAKAMA_ROBINHOOD_TEST_ASSET_EXPECTED_DEPLOYER")
    ),
    sourceCommit,
    initialHolder: getAddress(
      required(env, "NAKAMA_ROBINHOOD_TEST_ASSET_INITIAL_HOLDER")
    ),
    initialSupply: positiveBigInt(
      env,
      "NAKAMA_ROBINHOOD_TEST_ASSET_INITIAL_SUPPLY_UNITS"
    ),
    confirmations,
    minimumBalanceWei: positiveBigInt(
      env,
      "NAKAMA_ROBINHOOD_TEST_ASSET_MIN_DEPLOYER_BALANCE_WEI"
    ),
  };
}
