// SPDX-License-Identifier: AGPL-3.0-or-later

export const ETHEREUM_CONTRACT_NAMES = [
  "NakamaProtocolFactory",
  "NakamaCoverageProtocol",
  "NakamaPolicyRegistry",
  "ReserveVault",
];

export const ETHEREUM_LIVE_CONTRACTS = {
  factory: {
    contractName: "NakamaProtocolFactory",
    deploymentKind: "transaction-create",
    factoryNonce: null,
  },
  policyRegistry: {
    contractName: "NakamaPolicyRegistry",
    deploymentKind: "factory-create",
    factoryNonce: 1,
  },
  protocol: {
    contractName: "NakamaCoverageProtocol",
    deploymentKind: "factory-create",
    factoryNonce: 2,
  },
};

export const ETHEREUM_LIVE_ROLES = Object.keys(ETHEREUM_LIVE_CONTRACTS);

export const RESERVE_VAULT_TEMPLATE = {
  contractName: "ReserveVault",
  deploymentKind: "core-create2",
  saltDerivation: "keccak256(abi.encode(domainId,assetToken))",
};

export function requireExactKeys(value, expected, label) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (JSON.stringify(actual) !== JSON.stringify(wanted)) {
    throw new Error(`${label} keys must be exactly ${wanted.join(", ")}`);
  }
  return value;
}

export function protocolAbiPath(contractName, prefix = "shared/ethereum") {
  return `${prefix}/${contractName}.abi.json`;
}
