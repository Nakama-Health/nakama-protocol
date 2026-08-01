// SPDX-License-Identifier: AGPL-3.0-or-later

import { createHash } from "node:crypto";
import { Interface, getAddress } from "ethers";

import {
  ETHEREUM_LIVE_CONTRACTS,
  ETHEREUM_LIVE_ROLES,
  requireExactKeys,
} from "./ethereum_contract_set.mjs";
import {
  ROBINHOOD_MAINNET_CANONICAL_USDG_ADDRESS,
  ROBINHOOD_GENERIC_TESTNET_CHAIN_ID,
  ROBINHOOD_TESTNET_SETTLEMENT_ASSET_CLASSIFICATION,
  ROBINHOOD_TESTNET_SETTLEMENT_ASSET_CONTRACT,
  ROBINHOOD_TESTNET_BLOCKSCOUT_API_BASE_URL,
} from "./robinhood_generic_core_guard.mjs";
import { canonicalSha256 } from "./robinhood_generic_core_manifest.mjs";

const tokenInterface = new Interface([
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
]);

function requireCondition(condition, message) {
  if (!condition) throw new Error(message);
}

async function jsonRpc(rpcUrl, method, params, fetchImpl) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const response = await fetchImpl(rpcUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    });
    if (
      !response.ok &&
      [429, 502, 503, 504].includes(response.status) &&
      attempt < 4
    ) {
      const retryAfterSeconds = Number(response.headers?.get?.("retry-after"));
      const delayMs = Number.isFinite(retryAfterSeconds)
        ? Math.max(250, retryAfterSeconds * 1_000)
        : 250 * 2 ** attempt;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      continue;
    }
    if (!response.ok) {
      throw new Error(
        `Robinhood testnet RPC ${method} failed with HTTP ${response.status}`
      );
    }
    const payload = await response.json();
    if (payload?.error) {
      throw new Error(
        `Robinhood testnet RPC ${method} failed: ${
          payload.error.message ?? "unknown RPC error"
        }`
      );
    }
    if (payload?.result === undefined) {
      throw new Error(`Robinhood testnet RPC ${method} returned no result`);
    }
    return payload.result;
  }
  throw new Error(`Robinhood testnet RPC ${method} exhausted retries`);
}

function runtimeBytecodeSha256(bytecode, field) {
  requireCondition(
    typeof bytecode === "string" &&
      /^0x(?:[0-9a-fA-F]{2})+$/.test(bytecode),
    `${field} runtime bytecode is missing or malformed`
  );
  return createHash("sha256")
    .update(Buffer.from(bytecode.slice(2), "hex"))
    .digest("hex");
}

export async function verifyRobinhoodTestnetSettlementAsset(
  rpcUrl,
  expectedAsset,
  { fetchImpl = fetch } = {}
) {
  const address = getAddress(expectedAsset.address);
  requireCondition(
    address !== getAddress(ROBINHOOD_MAINNET_CANONICAL_USDG_ADDRESS) &&
      expectedAsset.contractName ===
        ROBINHOOD_TESTNET_SETTLEMENT_ASSET_CONTRACT &&
      expectedAsset.classification ===
        ROBINHOOD_TESTNET_SETTLEMENT_ASSET_CLASSIFICATION &&
      expectedAsset.canonical === false &&
      expectedAsset.name !== "Global Dollar" &&
      expectedAsset.symbol.toUpperCase() !== "USDG",
    "Robinhood testnet settlement asset must be explicitly test-only and noncanonical"
  );
  requireCondition(
    /^0x[0-9a-fA-F]{64}$/.test(expectedAsset.deploymentTransaction),
    "Settlement-asset deployment transaction must be a transaction hash"
  );
  const chainId = await jsonRpc(rpcUrl, "eth_chainId", [], fetchImpl);
  const runtimeCode = await jsonRpc(
    rpcUrl,
    "eth_getCode",
    [address, "latest"],
    fetchImpl
  );
  const nameRaw = await jsonRpc(
    rpcUrl,
    "eth_call",
    [
      { to: address, data: tokenInterface.encodeFunctionData("name") },
      "latest",
    ],
    fetchImpl
  );
  const symbolRaw = await jsonRpc(
    rpcUrl,
    "eth_call",
    [
      { to: address, data: tokenInterface.encodeFunctionData("symbol") },
      "latest",
    ],
    fetchImpl
  );
  const decimalsRaw = await jsonRpc(
    rpcUrl,
    "eth_call",
    [
      { to: address, data: tokenInterface.encodeFunctionData("decimals") },
      "latest",
    ],
    fetchImpl
  );
  const deploymentTransaction = await jsonRpc(
    rpcUrl,
    "eth_getTransactionByHash",
    [expectedAsset.deploymentTransaction],
    fetchImpl
  );
  const deploymentReceipt = await jsonRpc(
    rpcUrl,
    "eth_getTransactionReceipt",
    [expectedAsset.deploymentTransaction],
    fetchImpl
  );
  requireCondition(
    BigInt(chainId) === ROBINHOOD_GENERIC_TESTNET_CHAIN_ID,
    "Settlement-asset RPC is not Robinhood testnet"
  );
  requireCondition(
    deploymentTransaction !== null &&
      deploymentReceipt !== null &&
      deploymentTransaction.to === null &&
      deploymentReceipt.to === null &&
      BigInt(deploymentReceipt.status) === 1n &&
      getAddress(deploymentReceipt.contractAddress) === address &&
      String(deploymentTransaction.hash).toLowerCase() ===
        expectedAsset.deploymentTransaction.toLowerCase() &&
      String(deploymentReceipt.transactionHash).toLowerCase() ===
        expectedAsset.deploymentTransaction.toLowerCase(),
    "Settlement token address is not bound to the configured successful creation transaction"
  );
  const [name] = tokenInterface.decodeFunctionResult("name", nameRaw);
  const [symbol] = tokenInterface.decodeFunctionResult("symbol", symbolRaw);
  const [decimals] = tokenInterface.decodeFunctionResult(
    "decimals",
    decimalsRaw
  );
  requireCondition(
    name === expectedAsset.name &&
      symbol === expectedAsset.symbol &&
      decimals === BigInt(expectedAsset.decimals),
    "Configured Robinhood testnet settlement asset metadata does not match the reviewed test token"
  );
  return {
    contractName: ROBINHOOD_TESTNET_SETTLEMENT_ASSET_CONTRACT,
    address,
    name,
    symbol,
    decimals: Number(decimals),
    deploymentTransaction:
      expectedAsset.deploymentTransaction.toLowerCase(),
    runtimeBytecodeSha256: runtimeBytecodeSha256(
      runtimeCode,
      "settlementAsset"
    ),
    classification: ROBINHOOD_TESTNET_SETTLEMENT_ASSET_CLASSIFICATION,
    canonical: false,
  };
}

export async function observeRobinhoodRuntimeBytecode(
  rpcUrl,
  liveContracts,
  { fetchImpl = fetch } = {}
) {
  requireExactKeys(liveContracts, ETHEREUM_LIVE_ROLES, "liveContracts");
  const chainId = await jsonRpc(rpcUrl, "eth_chainId", [], fetchImpl);
  requireCondition(
    BigInt(chainId) === ROBINHOOD_GENERIC_TESTNET_CHAIN_ID,
    "Runtime-bytecode RPC is not Robinhood testnet"
  );
  const observations = {};
  for (const role of ETHEREUM_LIVE_ROLES) {
    const runtimeCode = await jsonRpc(
      rpcUrl,
      "eth_getCode",
      [getAddress(liveContracts[role].address), "latest"],
      fetchImpl
    );
    observations[role] = runtimeBytecodeSha256(
      runtimeCode,
      `${role} contract`
    );
  }
  return observations;
}

export function requireMatchingRuntimeObservations(
  deployment,
  primary,
  fallback
) {
  requireExactKeys(primary, ETHEREUM_LIVE_ROLES, "primary runtime observation");
  requireExactKeys(
    fallback,
    ETHEREUM_LIVE_ROLES,
    "fallback runtime observation"
  );
  for (const role of ETHEREUM_LIVE_ROLES) {
    requireCondition(
      primary[role] === fallback[role] &&
        primary[role] === deployment.liveContracts[role].runtimeBytecodeSha256,
      `${role} runtime bytecode differs across the deployment receipt and independent providers`
    );
  }
  return primary;
}

export function robinhoodDeploymentConsensusFingerprint(deployment) {
  return canonicalSha256({
    chainId: deployment.chainId,
    caip2: deployment.caip2,
    entryContract: deployment.entryContract,
    deployer: deployment.deployer,
    deploymentTransaction: deployment.deploymentTransaction,
    deploymentBlock: deployment.deploymentBlock,
    deploymentBlockHash: deployment.deploymentBlockHash,
    sourceCommit: deployment.sourceCommit,
    protocolArtifactSha256: deployment.protocolArtifactSha256,
    settlementAsset: deployment.settlementAsset,
    liveContracts: Object.fromEntries(
      ETHEREUM_LIVE_ROLES.map((role) => {
        const contract = deployment.liveContracts[role];
        return [
          role,
          {
            contractName: contract.contractName,
            address: contract.address,
            runtimeBytecodeHash: contract.runtimeBytecodeHash,
            runtimeBytecodeTemplateHash: contract.runtimeBytecodeTemplateHash,
            runtimeBytecodeSha256: contract.runtimeBytecodeSha256,
          },
        ];
      })
    ),
  });
}

export async function verifyRobinhoodBlockscoutSource(
  contractAddress,
  expectedContractName,
  { fetchImpl = fetch } = {}
) {
  requireCondition(
    typeof expectedContractName === "string" &&
      expectedContractName.trim() !== "",
    "Expected Blockscout contract name is required"
  );
  const expectedAddress = getAddress(contractAddress);
  const verificationUrl = `${ROBINHOOD_TESTNET_BLOCKSCOUT_API_BASE_URL}/smart-contracts/${expectedAddress}`;
  const response = await fetchImpl(verificationUrl, {
    method: "GET",
    headers: { accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(
      `Robinhood testnet Blockscout lookup failed with HTTP ${response.status}`
    );
  }
  const result = await response.json();
  requireCondition(
    result.is_verified === true,
    `${expectedContractName} is not verified on Robinhood testnet Blockscout`
  );
  requireCondition(
    result.name === expectedContractName,
    `Blockscout contract name does not match ${expectedContractName}`
  );
  requireCondition(
    typeof result.source_code === "string" &&
      result.source_code.trim() !== "" &&
      typeof result.compiler_version === "string" &&
      result.compiler_version.trim() !== "" &&
      typeof result.verified_at === "string" &&
      Number.isFinite(Date.parse(result.verified_at)),
    `${expectedContractName} Blockscout source-verification record is incomplete`
  );
  return {
    verificationProvider: "robinhood-testnet-blockscout",
    verificationUrl,
    sourceVerifiedAt: result.verified_at,
    contractName: result.name,
    compilerVersion: result.compiler_version,
  };
}

export async function verifyRobinhoodBlockscoutContract(
  role,
  contract,
  options = {}
) {
  const expectedContractName = ETHEREUM_LIVE_CONTRACTS[role]?.contractName;
  requireCondition(expectedContractName, `Unknown live contract role: ${role}`);
  return verifyRobinhoodBlockscoutSource(
    contract.address,
    expectedContractName,
    options
  );
}

export function providerEvidence(rpcUrl, attestation, runtimeBytecodeSha256) {
  const url = new URL(rpcUrl);
  return {
    providerHostname: url.hostname.toLowerCase(),
    rpcUrlSha256: createHash("sha256").update(rpcUrl).digest("hex"),
    attestationSha256:
      robinhoodDeploymentConsensusFingerprint(attestation),
    runtimeBytecodeSha256,
    confirmations: attestation.confirmations,
  };
}
