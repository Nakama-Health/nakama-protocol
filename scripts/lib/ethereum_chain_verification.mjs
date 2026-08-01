// SPDX-License-Identifier: AGPL-3.0-or-later

import { getAddress, getCreateAddress, id, keccak256 } from "ethers";

import {
  canonicalImmutableReferences,
  runtimeBytecodeBytes,
  runtimeBytecodeTemplateHash,
} from "./ethereum_bytecode.mjs";
import {
  ETHEREUM_LIVE_CONTRACTS,
  ETHEREUM_LIVE_ROLES,
} from "./ethereum_contract_set.mjs";

export const ETHEREUM_MAINNET_CHAIN_ID = 1n;
export const MINIMUM_FINAL_CONFIRMATIONS = 12;
export const SOURCIFY_V2_PREFIX = "https://sourcify.dev/server/v2/contract/1/";

const HASH_PATTERN = /^0x[0-9a-fA-F]{64}$/;
const QUANTITY_PATTERN = /^0x[0-9a-fA-F]+$/;
const ADDRESS_RESULT_PATTERN = /^0x[0-9a-fA-F]{64}$/;

function requireCondition(condition, message) {
  if (!condition) throw new Error(message);
}

function quantity(value, field) {
  requireCondition(
    typeof value === "string" && QUANTITY_PATTERN.test(value),
    `${field} is not a hex quantity`
  );
  return BigInt(value);
}

function hash(value, field) {
  requireCondition(
    typeof value === "string" && HASH_PATTERN.test(value),
    `${field} is not a 32-byte hash`
  );
  return value.toLowerCase();
}

function address(value, field) {
  try {
    const normalized = getAddress(value);
    requireCondition(
      normalized !== getAddress("0x0000000000000000000000000000000000000000"),
      `${field} is zero`
    );
    return normalized;
  } catch (error) {
    if (error instanceof Error && error.message === `${field} is zero`)
      throw error;
    throw new Error(`${field} is not an address`);
  }
}

async function jsonRpc(rpcUrl, method, params, fetchImpl) {
  const response = await fetchImpl(rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  if (!response.ok)
    throw new Error(
      `Ethereum RPC ${method} failed with HTTP ${response.status}`
    );
  const payload = await response.json();
  if (payload?.error) {
    throw new Error(
      `Ethereum RPC ${method} failed: ${
        payload.error.message ?? "unknown RPC error"
      }`
    );
  }
  if (payload?.result === undefined)
    throw new Error(`Ethereum RPC ${method} returned no result`);
  return payload.result;
}

function requireSameReferences(candidate, approved, contractName) {
  const canonicalCandidate = canonicalImmutableReferences(candidate);
  const canonicalApproved = canonicalImmutableReferences(approved);
  requireCondition(
    JSON.stringify(canonicalCandidate) === JSON.stringify(canonicalApproved),
    `${contractName} immutableReferences do not exactly match the approved artifact`
  );
  return canonicalApproved;
}

function decodeAddressResult(value, field) {
  requireCondition(
    typeof value === "string" && ADDRESS_RESULT_PATTERN.test(value),
    `${field} did not return one ABI-encoded address`
  );
  return address(`0x${value.slice(-40)}`, field);
}

async function readAddressGetter(
  rpcUrl,
  contractAddress,
  signature,
  fetchImpl
) {
  const result = await jsonRpc(
    rpcUrl,
    "eth_call",
    [{ to: contractAddress, data: id(signature).slice(0, 10) }, "latest"],
    fetchImpl
  );
  return decodeAddressResult(result, `${signature} at ${contractAddress}`);
}

export async function attestEvmFactoryDeployment(
  deployment,
  release,
  {
    rpcUrl,
    expectedChainId = ETHEREUM_MAINNET_CHAIN_ID,
    expectedCaip2 = "eip155:1",
    minimumFinalConfirmations = MINIMUM_FINAL_CONFIRMATIONS,
    chainLabel = "Ethereum mainnet",
    fetchImpl = fetch,
  }
) {
  const chainId = quantity(
    await jsonRpc(rpcUrl, "eth_chainId", [], fetchImpl),
    "eth_chainId"
  );
  requireCondition(
    chainId === BigInt(expectedChainId),
    `RPC chainId is ${chainId}; expected ${chainLabel} ${expectedChainId}`
  );
  requireCondition(
    deployment.chainId === Number(expectedChainId) &&
      deployment.caip2 === expectedCaip2,
    `Deployment manifest is not bound to ${expectedCaip2}`
  );

  const transactionHash = hash(
    deployment.deploymentTransaction,
    "deploymentTransaction"
  );
  const [transaction, receipt] = await Promise.all([
    jsonRpc(rpcUrl, "eth_getTransactionByHash", [transactionHash], fetchImpl),
    jsonRpc(rpcUrl, "eth_getTransactionReceipt", [transactionHash], fetchImpl),
  ]);
  requireCondition(
    transaction !== null,
    `Deployment transaction does not exist on ${chainLabel}`
  );
  requireCondition(
    receipt !== null,
    `Deployment transaction receipt does not exist on ${chainLabel}`
  );
  requireCondition(
    hash(transaction.hash, "transaction.hash") === transactionHash,
    "RPC transaction hash mismatch"
  );
  requireCondition(
    transaction.to === null,
    "Deployment transaction is not contract creation"
  );
  const deployer = address(transaction.from, "transaction.from");
  requireCondition(
    deployer ===
      address(
        release.releaseManifest.expectedDeployer,
        "release expectedDeployer"
      ),
    "Onchain deployer does not match the approved release deployer"
  );
  requireCondition(
    deployer === address(deployment.deployer, "deployment.deployer"),
    "Intermediate deployer mismatch"
  );
  const factoryArtifact = release.contracts.NakamaProtocolFactory;
  requireCondition(
    keccak256(transaction.input ?? transaction.data) ===
      factoryArtifact.creationBytecodeHash,
    "Factory deployment transaction input does not match the approved creation bytecode"
  );

  requireCondition(
    quantity(receipt.status, "receipt.status") === 1n,
    "Deployment transaction receipt failed"
  );
  requireCondition(
    hash(receipt.transactionHash, "receipt.transactionHash") ===
      transactionHash,
    "Receipt transaction hash mismatch"
  );
  requireCondition(
    receipt.to === null,
    "Deployment receipt is not contract creation"
  );
  requireCondition(
    address(receipt.from, "receipt.from") === deployer,
    "Receipt deployer mismatch"
  );
  const factoryAddress = address(
    receipt.contractAddress,
    "receipt.contractAddress"
  );
  const derivedFactory = address(
    getCreateAddress({
      from: deployer,
      nonce: quantity(transaction.nonce, "transaction.nonce"),
    }),
    "derived factory address"
  );
  requireCondition(
    factoryAddress === derivedFactory,
    "Receipt factory address does not match sender CREATE address"
  );
  requireCondition(
    factoryAddress ===
      address(
        deployment.liveContracts.factory.address,
        "deployment factory address"
      ),
    "Intermediate factory address does not match the canonical receipt"
  );
  const policyRegistryAddress = address(
    getCreateAddress({ from: factoryAddress, nonce: 1 }),
    "derived policy registry address"
  );
  const protocolAddress = address(
    getCreateAddress({ from: factoryAddress, nonce: 2 }),
    "derived protocol address"
  );
  requireCondition(
    policyRegistryAddress ===
      address(
        deployment.liveContracts.policyRegistry.address,
        "deployment policy registry address"
      ),
    "Intermediate policy registry address does not match factory CREATE nonce one"
  );
  requireCondition(
    protocolAddress ===
      address(
        deployment.liveContracts.protocol.address,
        "deployment protocol address"
      ),
    "Intermediate protocol address does not match factory CREATE nonce two"
  );

  const deploymentBlock = quantity(receipt.blockNumber, "receipt.blockNumber");
  const blockHash = hash(receipt.blockHash, "receipt.blockHash");
  requireCondition(
    quantity(transaction.blockNumber, "transaction.blockNumber") ===
      deploymentBlock &&
      hash(transaction.blockHash, "transaction.blockHash") === blockHash,
    "Transaction and receipt inclusion blocks differ"
  );
  requireCondition(
    BigInt(deployment.deploymentBlock) === deploymentBlock,
    "Intermediate deploymentBlock does not match the canonical receipt"
  );
  requireCondition(
    hash(deployment.deploymentBlockHash, "deployment.deploymentBlockHash") ===
      blockHash,
    "Intermediate deploymentBlockHash does not match the canonical receipt"
  );

  const blockTag = `0x${deploymentBlock.toString(16)}`;
  const [blockByHash, blockByNumber, safeBlock, finalizedBlock, latestBlock] =
    await Promise.all([
      jsonRpc(rpcUrl, "eth_getBlockByHash", [blockHash, false], fetchImpl),
      jsonRpc(rpcUrl, "eth_getBlockByNumber", [blockTag, false], fetchImpl),
      jsonRpc(rpcUrl, "eth_getBlockByNumber", ["safe", false], fetchImpl),
      jsonRpc(rpcUrl, "eth_getBlockByNumber", ["finalized", false], fetchImpl),
      jsonRpc(rpcUrl, "eth_blockNumber", [], fetchImpl),
    ]);
  requireCondition(
    blockByHash !== null && blockByNumber !== null,
    "Deployment block is unavailable"
  );
  requireCondition(
    safeBlock !== null && finalizedBlock !== null,
    "Ethereum safe/finalized heads are unavailable"
  );
  requireCondition(
    hash(blockByHash.hash, "blockByHash.hash") === blockHash &&
      hash(blockByNumber.hash, "blockByNumber.hash") === blockHash &&
      quantity(blockByHash.number, "blockByHash.number") === deploymentBlock &&
      quantity(blockByNumber.number, "blockByNumber.number") ===
        deploymentBlock,
    "Deployment receipt is not in the canonical block"
  );
  requireCondition(
    Array.isArray(blockByHash.transactions) &&
      blockByHash.transactions.some((entry) => {
        const candidate = typeof entry === "string" ? entry : entry?.hash;
        return (
          typeof candidate === "string" &&
          candidate.toLowerCase() === transactionHash
        );
      }),
    "Canonical deployment block does not contain the deployment transaction"
  );
  const latestBlockNumber = quantity(latestBlock, "eth_blockNumber");
  const safeBlockNumber = quantity(safeBlock.number, "safe block number");
  const finalizedBlockNumber = quantity(
    finalizedBlock.number,
    "finalized block number"
  );
  requireCondition(
    latestBlockNumber >= deploymentBlock,
    "Latest block predates the deployment block"
  );
  requireCondition(
    finalizedBlockNumber <= safeBlockNumber &&
      safeBlockNumber <= latestBlockNumber,
    `${chainLabel} finalized/safe/latest head ordering is invalid`
  );
  requireCondition(
    deploymentBlock <= safeBlockNumber,
    `Deployment block ${deploymentBlock} has not reached the ${chainLabel} safe head ${safeBlockNumber}`
  );
  requireCondition(
    deploymentBlock <= finalizedBlockNumber,
    `Deployment block ${deploymentBlock} has not reached the ${chainLabel} finalized head ${finalizedBlockNumber}`
  );
  const confirmationCount = latestBlockNumber - deploymentBlock + 1n;
  requireCondition(
    confirmationCount >= BigInt(minimumFinalConfirmations),
    `Deployment has ${confirmationCount} confirmations; ${minimumFinalConfirmations} required`
  );

  const liveContracts = {};
  for (const role of ETHEREUM_LIVE_ROLES) {
    const identity = ETHEREUM_LIVE_CONTRACTS[role];
    const contractDeployment = deployment.liveContracts[role];
    const approved = release.contracts[identity.contractName];
    const contractAddress = address(
      contractDeployment.address,
      `${role}.address`
    );
    const [deployedCode, latestCode] = await Promise.all([
      jsonRpc(rpcUrl, "eth_getCode", [contractAddress, blockTag], fetchImpl),
      jsonRpc(rpcUrl, "eth_getCode", [contractAddress, "latest"], fetchImpl),
    ]);
    requireCondition(
      deployedCode !== "0x",
      `No code exists at the canonical ${identity.contractName} address`
    );
    requireCondition(
      deployedCode.toLowerCase() === latestCode.toLowerCase(),
      `${identity.contractName} runtime code changed after deployment`
    );
    requireCondition(
      runtimeBytecodeBytes(deployedCode) === approved.runtimeBytecodeBytes,
      `${identity.contractName} live runtime bytecode length does not match the approved template length`
    );
    const immutableReferences = requireSameReferences(
      contractDeployment.immutableReferences,
      approved.immutableReferences,
      identity.contractName
    );
    const runtimeBytecodeHash = keccak256(deployedCode);
    requireCondition(
      runtimeBytecodeHash === contractDeployment.runtimeBytecodeHash,
      `${identity.contractName} runtimeBytecodeHash does not match live code`
    );
    const normalizedTemplateHash = runtimeBytecodeTemplateHash(
      deployedCode,
      immutableReferences
    );
    requireCondition(
      normalizedTemplateHash === approved.runtimeBytecodeTemplateHash,
      `${identity.contractName} normalized live runtime bytecode does not match the approved template`
    );
    liveContracts[role] = {
      ...contractDeployment,
      address: contractAddress,
      runtimeBytecodeHash,
      runtimeBytecodeTemplateHash: normalizedTemplateHash,
      runtimeBytecodeBytes: approved.runtimeBytecodeBytes,
      immutableReferences,
    };
  }

  const [
    factoryRegistry,
    factoryProtocol,
    registryCore,
    protocolRegistry,
    protocolFactory,
  ] = await Promise.all([
    readAddressGetter(rpcUrl, factoryAddress, "policyRegistry()", fetchImpl),
    readAddressGetter(rpcUrl, factoryAddress, "protocol()", fetchImpl),
    readAddressGetter(rpcUrl, policyRegistryAddress, "core()", fetchImpl),
    readAddressGetter(rpcUrl, protocolAddress, "policyRegistry()", fetchImpl),
    readAddressGetter(
      rpcUrl,
      protocolAddress,
      "deploymentFactory()",
      fetchImpl
    ),
  ]);
  requireCondition(
    factoryRegistry === policyRegistryAddress,
    "Factory policyRegistry getter mismatch"
  );
  requireCondition(
    factoryProtocol === protocolAddress,
    "Factory protocol getter mismatch"
  );
  requireCondition(
    registryCore === protocolAddress,
    "Policy registry core getter mismatch"
  );
  requireCondition(
    protocolRegistry === policyRegistryAddress,
    "Protocol policyRegistry getter mismatch"
  );
  requireCondition(
    protocolFactory === factoryAddress,
    "Protocol deploymentFactory getter mismatch"
  );

  return {
    ...deployment,
    chainId: Number(expectedChainId),
    caip2: expectedCaip2,
    deployer,
    deploymentTransaction: transactionHash,
    deploymentBlock: Number(deploymentBlock),
    deploymentBlockHash: blockHash,
    confirmations: Number(confirmationCount),
    liveContracts,
  };
}

export async function attestEthereumMainnetDeployment(
  deployment,
  release,
  options
) {
  return attestEvmFactoryDeployment(deployment, release, {
    ...options,
    expectedChainId: ETHEREUM_MAINNET_CHAIN_ID,
    expectedCaip2: "eip155:1",
    minimumFinalConfirmations: MINIMUM_FINAL_CONFIRMATIONS,
    chainLabel: "Ethereum mainnet",
  });
}

export function sourcifyLookupUrl(contractAddress, chainId = 1) {
  return `https://sourcify.dev/server/v2/contract/${chainId}/${address(
    contractAddress,
    "Sourcify contract address"
  )}`;
}

export async function verifySourcifyExactMatch(
  contractAddress,
  { fetchImpl = fetch, chainId = 1, chainLabel = "Ethereum mainnet" } = {}
) {
  const expectedAddress = address(contractAddress, "Sourcify contract address");
  const verificationUrl = sourcifyLookupUrl(expectedAddress, chainId);
  const response = await fetchImpl(verificationUrl, {
    method: "GET",
    headers: { accept: "application/json" },
  });
  if (!response.ok)
    throw new Error(`Sourcify v2 lookup failed with HTTP ${response.status}`);
  const result = await response.json();
  requireCondition(
    String(result.chainId) === String(chainId),
    `Sourcify result is not for ${chainLabel}`
  );
  requireCondition(
    address(result.address, "Sourcify result address") === expectedAddress,
    "Sourcify address mismatch"
  );
  requireCondition(
    result.runtimeMatch === "exact_match",
    "Sourcify runtime is not an exact match"
  );
  requireCondition(
    result.creationMatch === "exact_match",
    "Sourcify creation bytecode is not an exact match"
  );
  requireCondition(
    typeof result.verifiedAt === "string" &&
      Number.isFinite(Date.parse(result.verifiedAt)),
    "Sourcify result has no valid verifiedAt timestamp"
  );
  requireCondition(
    typeof result.matchId === "string" && result.matchId.trim() !== "",
    "Sourcify result has no matchId"
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
