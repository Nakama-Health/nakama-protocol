// SPDX-License-Identifier: AGPL-3.0-or-later

import { getAddress, getCreateAddress, keccak256 } from "ethers";

import {
  canonicalImmutableReferences,
  runtimeBytecodeBytes,
  runtimeBytecodeTemplateHash,
} from "./ethereum_bytecode.mjs";

export const ETHEREUM_MAINNET_CHAIN_ID = 1n;
export const MINIMUM_FINAL_CONFIRMATIONS = 12;
export const SOURCIFY_V2_PREFIX = "https://sourcify.dev/server/v2/contract/1/";

const HASH_PATTERN = /^0x[0-9a-fA-F]{64}$/;
const QUANTITY_PATTERN = /^0x[0-9a-fA-F]+$/;

function requireCondition(condition, message) {
  if (!condition) throw new Error(message);
}

function quantity(value, field) {
  requireCondition(typeof value === "string" && QUANTITY_PATTERN.test(value), `${field} is not a hex quantity`);
  return BigInt(value);
}

function hash(value, field) {
  requireCondition(typeof value === "string" && HASH_PATTERN.test(value), `${field} is not a 32-byte hash`);
  return value.toLowerCase();
}

function address(value, field) {
  try {
    const normalized = getAddress(value);
    requireCondition(normalized !== getAddress("0x0000000000000000000000000000000000000000"), `${field} is zero`);
    return normalized;
  } catch (error) {
    if (error instanceof Error && error.message === `${field} is zero`) throw error;
    throw new Error(`${field} is not an address`);
  }
}

async function jsonRpc(rpcUrl, method, params, fetchImpl) {
  const response = await fetchImpl(rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  if (!response.ok) throw new Error(`Ethereum RPC ${method} failed with HTTP ${response.status}`);
  const payload = await response.json();
  if (payload?.error) {
    throw new Error(`Ethereum RPC ${method} failed: ${payload.error.message ?? "unknown RPC error"}`);
  }
  if (payload?.result === undefined) throw new Error(`Ethereum RPC ${method} returned no result`);
  return payload.result;
}

function requireSameReferences(candidate, approved) {
  const canonicalCandidate = canonicalImmutableReferences(candidate);
  const canonicalApproved = canonicalImmutableReferences(approved);
  requireCondition(
    JSON.stringify(canonicalCandidate) === JSON.stringify(canonicalApproved),
    "Intermediate immutableReferences do not exactly match the approved artifact",
  );
  return canonicalApproved;
}

export async function attestEthereumMainnetDeployment(
  deployment,
  release,
  { rpcUrl, fetchImpl = fetch },
) {
  const chainId = quantity(await jsonRpc(rpcUrl, "eth_chainId", [], fetchImpl), "eth_chainId");
  requireCondition(chainId === ETHEREUM_MAINNET_CHAIN_ID, `RPC chainId is ${chainId}; expected Ethereum mainnet 1`);

  const transactionHash = hash(deployment.deploymentTransaction, "deploymentTransaction");
  const [transaction, receipt] = await Promise.all([
    jsonRpc(rpcUrl, "eth_getTransactionByHash", [transactionHash], fetchImpl),
    jsonRpc(rpcUrl, "eth_getTransactionReceipt", [transactionHash], fetchImpl),
  ]);
  requireCondition(transaction !== null, "Deployment transaction does not exist on Ethereum mainnet");
  requireCondition(receipt !== null, "Deployment transaction receipt does not exist on Ethereum mainnet");
  requireCondition(hash(transaction.hash, "transaction.hash") === transactionHash, "RPC transaction hash mismatch");
  requireCondition(transaction.to === null, "Deployment transaction is not contract creation");
  const deployer = address(transaction.from, "transaction.from");
  requireCondition(
    deployer === address(release.releaseManifest.expectedDeployer, "release expectedDeployer"),
    "Onchain deployer does not match the approved release deployer",
  );
  requireCondition(deployer === address(deployment.deployer, "deployment.deployer"), "Intermediate deployer mismatch");
  requireCondition(
    keccak256(transaction.input ?? transaction.data) === release.protocolCreationBytecodeHash,
    "Deployment transaction input does not match the approved creation bytecode",
  );
  requireCondition(
    address(getCreateAddress({ from: deployer, nonce: quantity(transaction.nonce, "transaction.nonce") }), "derived address")
      === address(receipt.contractAddress, "receipt.contractAddress"),
    "Receipt contractAddress does not match the CREATE address derived from sender and nonce",
  );

  requireCondition(quantity(receipt.status, "receipt.status") === 1n, "Deployment transaction receipt failed");
  requireCondition(hash(receipt.transactionHash, "receipt.transactionHash") === transactionHash, "Receipt transaction hash mismatch");
  requireCondition(receipt.to === null, "Deployment receipt is not contract creation");
  requireCondition(address(receipt.from, "receipt.from") === deployer, "Receipt deployer mismatch");
  const protocolAddress = address(receipt.contractAddress, "receipt.contractAddress");
  requireCondition(
    protocolAddress === address(deployment.protocolAddress, "deployment.protocolAddress"),
    "Intermediate protocolAddress does not match the canonical receipt",
  );
  const deploymentBlock = quantity(receipt.blockNumber, "receipt.blockNumber");
  const blockHash = hash(receipt.blockHash, "receipt.blockHash");
  requireCondition(
    quantity(transaction.blockNumber, "transaction.blockNumber") === deploymentBlock
      && hash(transaction.blockHash, "transaction.blockHash") === blockHash,
    "Transaction and receipt inclusion blocks differ",
  );
  requireCondition(
    BigInt(deployment.deploymentBlock) === deploymentBlock,
    "Intermediate deploymentBlock does not match the canonical receipt",
  );

  const blockTag = `0x${deploymentBlock.toString(16)}`;
  const [blockByHash, blockByNumber, safeBlock, finalizedBlock, latestBlock, deployedCode, latestCode] = await Promise.all([
    jsonRpc(rpcUrl, "eth_getBlockByHash", [blockHash, false], fetchImpl),
    jsonRpc(rpcUrl, "eth_getBlockByNumber", [blockTag, false], fetchImpl),
    jsonRpc(rpcUrl, "eth_getBlockByNumber", ["safe", false], fetchImpl),
    jsonRpc(rpcUrl, "eth_getBlockByNumber", ["finalized", false], fetchImpl),
    jsonRpc(rpcUrl, "eth_blockNumber", [], fetchImpl),
    jsonRpc(rpcUrl, "eth_getCode", [protocolAddress, blockTag], fetchImpl),
    jsonRpc(rpcUrl, "eth_getCode", [protocolAddress, "latest"], fetchImpl),
  ]);
  requireCondition(blockByHash !== null && blockByNumber !== null, "Deployment block is unavailable");
  requireCondition(safeBlock !== null && finalizedBlock !== null, "Ethereum safe/finalized heads are unavailable");
  requireCondition(
    hash(blockByHash.hash, "blockByHash.hash") === blockHash
      && hash(blockByNumber.hash, "blockByNumber.hash") === blockHash
      && quantity(blockByHash.number, "blockByHash.number") === deploymentBlock
      && quantity(blockByNumber.number, "blockByNumber.number") === deploymentBlock,
    "Deployment receipt is not in the canonical block",
  );
  requireCondition(
    Array.isArray(blockByHash.transactions)
      && blockByHash.transactions.some((entry) => {
        const candidate = typeof entry === "string" ? entry : entry?.hash;
        return typeof candidate === "string" && candidate.toLowerCase() === transactionHash;
      }),
    "Canonical deployment block does not contain the deployment transaction",
  );
  const latestBlockNumber = quantity(latestBlock, "eth_blockNumber");
  const safeBlockNumber = quantity(safeBlock.number, "safe block number");
  const finalizedBlockNumber = quantity(finalizedBlock.number, "finalized block number");
  requireCondition(latestBlockNumber >= deploymentBlock, "Latest block predates the deployment block");
  requireCondition(
    finalizedBlockNumber <= safeBlockNumber && safeBlockNumber <= latestBlockNumber,
    "Ethereum finalized/safe/latest head ordering is invalid",
  );
  requireCondition(deploymentBlock <= safeBlockNumber, "Deployment block has not reached Ethereum safe head");
  requireCondition(deploymentBlock <= finalizedBlockNumber, "Deployment block has not reached Ethereum finalized head");
  const confirmationCount = latestBlockNumber - deploymentBlock + 1n;
  requireCondition(
    confirmationCount >= BigInt(MINIMUM_FINAL_CONFIRMATIONS),
    `Deployment has ${confirmationCount} confirmations; ${MINIMUM_FINAL_CONFIRMATIONS} required`,
  );

  requireCondition(deployedCode !== "0x", "No code exists at the canonical deployment address");
  requireCondition(deployedCode.toLowerCase() === latestCode.toLowerCase(), "Runtime code changed after deployment");
  requireCondition(
    runtimeBytecodeBytes(deployedCode) === release.runtimeBytecodeBytes,
    "Live runtime bytecode length does not match the approved template length",
  );
  const immutableReferences = requireSameReferences(
    deployment.immutableReferences,
    release.protocolImmutableReferences,
  );
  const runtimeBytecodeHash = keccak256(deployedCode);
  requireCondition(
    runtimeBytecodeHash === deployment.runtimeBytecodeHash,
    "Intermediate runtimeBytecodeHash does not match live code",
  );
  requireCondition(
    deployment.runtimeBytecodeTemplateHash === release.protocolRuntimeBytecodeTemplateHash,
    "Intermediate runtimeBytecodeTemplateHash does not match the approved artifact",
  );
  const normalizedTemplateHash = runtimeBytecodeTemplateHash(deployedCode, immutableReferences);
  requireCondition(
    normalizedTemplateHash === release.protocolRuntimeBytecodeTemplateHash,
    "Normalized live runtime bytecode does not match the approved template",
  );

  return {
    ...deployment,
    chainId: 1,
    caip2: "eip155:1",
    protocolAddress,
    deployer,
    deploymentTransaction: transactionHash,
    deploymentBlock: Number(deploymentBlock),
    deploymentBlockHash: blockHash,
    confirmations: Number(confirmationCount),
    creationBytecodeHash: release.protocolCreationBytecodeHash,
    runtimeBytecodeHash,
    runtimeBytecodeTemplateHash: normalizedTemplateHash,
    runtimeBytecodeBytes: release.runtimeBytecodeBytes,
    immutableReferences,
  };
}

export function sourcifyLookupUrl(protocolAddress) {
  return `${SOURCIFY_V2_PREFIX}${address(protocolAddress, "Sourcify protocolAddress")}`;
}

export async function verifySourcifyExactMatch(protocolAddress, { fetchImpl = fetch } = {}) {
  const expectedAddress = address(protocolAddress, "Sourcify protocolAddress");
  const verificationUrl = sourcifyLookupUrl(expectedAddress);
  const response = await fetchImpl(verificationUrl, {
    method: "GET",
    headers: { accept: "application/json" },
  });
  if (!response.ok) throw new Error(`Sourcify v2 lookup failed with HTTP ${response.status}`);
  const result = await response.json();
  requireCondition(String(result.chainId) === "1", "Sourcify result is not for Ethereum mainnet");
  requireCondition(address(result.address, "Sourcify result address") === expectedAddress, "Sourcify address mismatch");
  requireCondition(result.runtimeMatch === "exact_match", "Sourcify runtime is not an exact match");
  requireCondition(result.creationMatch === "exact_match", "Sourcify creation bytecode is not an exact match");
  requireCondition(
    typeof result.verifiedAt === "string" && Number.isFinite(Date.parse(result.verifiedAt)),
    "Sourcify result has no valid verifiedAt timestamp",
  );
  requireCondition(
    typeof result.matchId === "string" && result.matchId.trim() !== "",
    "Sourcify result has no matchId",
  );
  return {
    verificationProvider: "sourcify-v2",
    verificationUrl,
    sourceVerifiedAt: result.verifiedAt,
    sourcifyMatchId: result.matchId,
    creationMatch: result.creationMatch,
    runtimeMatch: result.runtimeMatch,
  };
}
