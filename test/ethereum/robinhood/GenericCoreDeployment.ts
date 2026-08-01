import { expect } from "chai";
import { createHash } from "node:crypto";
import { Interface, getAddress, keccak256 } from "ethers";
import { config, network } from "hardhat";

import {
  ROBINHOOD_GENERIC_TESTNET_CAIP2,
  ROBINHOOD_GENERIC_TESTNET_CONFIRMATION,
  ROBINHOOD_GENERIC_TESTNET_CHAIN_ID,
  ROBINHOOD_MAINNET_CANONICAL_USDG_ADDRESS,
  validateRobinhoodGenericTestnetEnvironment,
  validateRobinhoodGenericTestnetReleaseManifest,
  validateRobinhoodGenericTestnetRuntime,
} from "../../../scripts/lib/robinhood_generic_core_guard.mjs";
import {
  buildRobinhoodRuntimeManifest,
  validateRobinhoodGenericCoreIntermediate,
  validateRobinhoodRuntimeManifest,
} from "../../../scripts/lib/robinhood_generic_core_manifest.mjs";
import {
  buildRobinhoodGenericCorePromotionConfig,
} from "../../../scripts/lib/robinhood_generic_core_release.mjs";
import {
  verifyRobinhoodBlockscoutSource,
  verifyRobinhoodTestnetSettlementAsset,
} from "../../../scripts/lib/robinhood_generic_core_verification.mjs";
import {
  ROBINHOOD_TEST_ASSET_DEPLOY_CONFIRMATION,
  validateRobinhoodTestAssetDeploymentEnvironment,
} from "../../../scripts/lib/robinhood_test_asset_guard.mjs";
import {
  ETHEREUM_CONTRACT_NAMES,
  ETHEREUM_LIVE_CONTRACTS,
  ETHEREUM_LIVE_ROLES,
  RESERVE_VAULT_TEMPLATE,
  protocolAbiPath,
} from "../../../scripts/lib/ethereum_contract_set.mjs";

const { ethers } = await network.create();
const deployer = "0x00000000000000000000000000000000000000A1";
const settlementAddress = "0x00000000000000000000000000000000000000B1";
const settlementTransaction = `0x${"12".repeat(32)}`;
const safeEnvironment = {
  NAKAMA_ROBINHOOD_GENERIC_TESTNET_DEPLOY_CONFIRMATION:
    ROBINHOOD_GENERIC_TESTNET_CONFIRMATION,
  ROBINHOOD_TESTNET_RPC_URL: "https://primary.example.invalid/rpc",
  ROBINHOOD_TESTNET_RPC_FALLBACK_URL: "https://fallback.example.invalid/rpc",
  ROBINHOOD_TESTNET_PRIVATE_KEY: `0x${"11".repeat(32)}`,
  NAKAMA_ROBINHOOD_GENERIC_TESTNET_EXPECTED_DEPLOYER: deployer,
  NAKAMA_ROBINHOOD_GENERIC_TESTNET_SOURCE_COMMIT: "a".repeat(40),
  NAKAMA_ROBINHOOD_GENERIC_TESTNET_QUALIFICATION_SHA256: "b".repeat(64),
  NAKAMA_ROBINHOOD_GENERIC_TESTNET_RELEASE_APPROVAL_SHA256: "c".repeat(64),
  NAKAMA_ROBINHOOD_GENERIC_TESTNET_CONFIRMATIONS: "20",
  NAKAMA_ROBINHOOD_GENERIC_TESTNET_MIN_DEPLOYER_BALANCE_WEI: "1",
  ROBINHOOD_TESTNET_SETTLEMENT_ASSET_ADDRESS: settlementAddress,
  ROBINHOOD_TESTNET_SETTLEMENT_ASSET_NAME: "Nakama Test USD",
  ROBINHOOD_TESTNET_SETTLEMENT_ASSET_SYMBOL: "tUSDG",
  ROBINHOOD_TESTNET_SETTLEMENT_ASSET_DECIMALS: "6",
  ROBINHOOD_TESTNET_SETTLEMENT_ASSET_DEPLOYMENT_TRANSACTION:
    settlementTransaction,
};

function sha(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function makeReleaseAndIntermediate() {
  const contracts = Object.fromEntries(
    ETHEREUM_CONTRACT_NAMES.map((contractName, index) => [
      contractName,
      {
        creationBytecodeHash: `0x${String(index + 1).repeat(64)}`,
        creationBytecodeBytes: 100 + index,
        runtimeBytecodeTemplateHash: `0x${String(index + 5).repeat(64)}`,
        runtimeBytecodeBytes: 80 + index,
        immutableReferences: [],
        abiSha256: String(index + 6).repeat(64),
      },
    ])
  );
  const release = {
    headCommit: safeEnvironment.NAKAMA_ROBINHOOD_GENERIC_TESTNET_SOURCE_COMMIT,
    contracts,
    protocolArtifactSha256: "d".repeat(64),
    releaseManifest: {
      expectedDeployer: deployer,
      settlementAsset: {
        contractName: "NakamaTestUsd",
        address: settlementAddress,
        name: "Nakama Test USD",
        symbol: "tUSDG",
        decimals: 6,
        deploymentTransaction: settlementTransaction,
        classification: "test-only-mock",
        canonical: false,
      },
      qualificationReportSha256:
        safeEnvironment.NAKAMA_ROBINHOOD_GENERIC_TESTNET_QUALIFICATION_SHA256,
      releaseApprovalSha256:
        safeEnvironment.NAKAMA_ROBINHOOD_GENERIC_TESTNET_RELEASE_APPROVAL_SHA256,
    },
  };
  const addresses = {
    factory: "0x0000000000000000000000000000000000000101",
    policyRegistry: "0x0000000000000000000000000000000000000102",
    protocol: "0x0000000000000000000000000000000000000103",
  };
  const liveContracts = Object.fromEntries(
    ETHEREUM_LIVE_ROLES.map((role, index) => {
      const identity = ETHEREUM_LIVE_CONTRACTS[role];
      const approved = contracts[identity.contractName];
      return [
        role,
        {
          contractName: identity.contractName,
          address: addresses[role],
          deploymentKind: identity.deploymentKind,
          factoryNonce: identity.factoryNonce,
          creationBytecodeHash: approved.creationBytecodeHash,
          creationBytecodeBytes: approved.creationBytecodeBytes,
          runtimeBytecodeHash: `0x${String(index + 7).repeat(64)}`,
          runtimeBytecodeSha256: String(index + 1).repeat(64),
          runtimeBytecodeTemplateHash: approved.runtimeBytecodeTemplateHash,
          runtimeBytecodeBytes: approved.runtimeBytecodeBytes,
          immutableReferences: [],
          abiArtifact: protocolAbiPath(identity.contractName),
          abiSha256: approved.abiSha256,
          verification: null,
        },
      ];
    })
  );
  const vault = contracts.ReserveVault;
  const intermediate = {
    schemaVersion: 3,
    status: "deployed-unverified",
    chainId: Number(ROBINHOOD_GENERIC_TESTNET_CHAIN_ID),
    caip2: ROBINHOOD_GENERIC_TESTNET_CAIP2,
    entryContract: "NakamaProtocolFactory",
    deployer,
    deploymentTransaction: `0x${"21".repeat(32)}`,
    deploymentBlock: 100,
    deploymentBlockHash: `0x${"31".repeat(32)}`,
    confirmations: 20,
    sourceCommit: release.headCommit,
    protocolArtifactSha256: release.protocolArtifactSha256,
    settlementAsset: {
      contractName: "NakamaTestUsd",
      address: settlementAddress,
      name: "Nakama Test USD",
      symbol: "tUSDG",
      decimals: 6,
      deploymentTransaction: settlementTransaction,
      runtimeBytecodeSha256: sha("test-token-runtime"),
      classification: "test-only-mock",
      canonical: false,
    },
    liveContracts,
    contractTemplates: {
      reserveVault: {
        ...RESERVE_VAULT_TEMPLATE,
        creationBytecodeHash: vault.creationBytecodeHash,
        creationBytecodeBytes: vault.creationBytecodeBytes,
        runtimeBytecodeTemplateHash: vault.runtimeBytecodeTemplateHash,
        runtimeBytecodeBytes: vault.runtimeBytecodeBytes,
        immutableReferences: [],
        abiArtifact: protocolAbiPath("ReserveVault"),
        abiSha256: vault.abiSha256,
      },
    },
    verified: false,
    qualificationStatus: "approved-for-testnet",
    qualificationReportSha256:
      release.releaseManifest.qualificationReportSha256,
    releaseApprovalSha256: release.releaseManifest.releaseApprovalSha256,
    verificationEvidenceSha256: null,
  };
  return { contracts, release, intermediate };
}

describe("Robinhood generic-core testnet deployment gates", function () {
  it("registers the official Robinhood Blockscout explorers", function () {
    expect(
      config.chainDescriptors.get(46630n)?.blockExplorers.blockscout
    ).to.deep.equal({
      name: "Robinhood Chain Testnet Blockscout",
      url: "https://explorer.testnet.chain.robinhood.com",
      apiUrl: "https://explorer.testnet.chain.robinhood.com/api",
    });
    expect(
      config.chainDescriptors.get(4663n)?.blockExplorers.blockscout
    ).to.deep.equal({
      name: "Robinhood Chain Blockscout",
      url: "https://robinhoodchain.blockscout.com",
      apiUrl: "https://robinhoodchain.blockscout.com/api",
    });
  });

  it("requires two providers and an explicitly noncanonical test asset", function () {
    const config = validateRobinhoodGenericTestnetEnvironment(safeEnvironment);
    expect(config.settlementAsset).to.deep.equal({
      contractName: "NakamaTestUsd",
      address: getAddress(settlementAddress),
      name: "Nakama Test USD",
      symbol: "tUSDG",
      decimals: 6,
      deploymentTransaction: settlementTransaction,
      classification: "test-only-mock",
      canonical: false,
    });

    expect(() =>
      validateRobinhoodGenericTestnetEnvironment({
        ...safeEnvironment,
        ROBINHOOD_TESTNET_RPC_FALLBACK_URL:
          "https://primary.example.invalid/secondary",
      })
    ).to.throw("different provider hostnames");
    expect(() =>
      validateRobinhoodGenericTestnetEnvironment({
        ...safeEnvironment,
        ROBINHOOD_TESTNET_RPC_URL: "https://rpc.testnet.chain.robinhood.com",
      })
    ).to.throw("public testnet RPC is rate-limited");
    expect(() =>
      validateRobinhoodGenericTestnetEnvironment({
        ...safeEnvironment,
        ROBINHOOD_TESTNET_SETTLEMENT_ASSET_SYMBOL: "USDG",
      })
    ).to.throw("no documented canonical USDG");
    expect(() =>
      validateRobinhoodGenericTestnetEnvironment({
        ...safeEnvironment,
        ROBINHOOD_TESTNET_SETTLEMENT_ASSET_ADDRESS:
          ROBINHOOD_MAINNET_CANONICAL_USDG_ADDRESS,
      })
    ).to.throw("mainnet canonical USDG");
  });

  it("binds approval to the exact test asset and validates deployment limits", function () {
    const config = validateRobinhoodGenericTestnetEnvironment(safeEnvironment);
    const { contracts } = makeReleaseAndIntermediate();
    const manifest = {
      schemaVersion: 3,
      status: "approved-for-testnet",
      chainId: 46630,
      caip2: "eip155:46630",
      sourceCommit: config.sourceCommit,
      expectedDeployer: config.expectedDeployer,
      qualificationReportSha256: config.qualificationReportSha256,
      releaseApprovalSha256: config.releaseApprovalSha256,
      protocolArtifactSha256: "d".repeat(64),
      settlementAsset: config.settlementAsset,
      contracts: Object.fromEntries(
        ETHEREUM_CONTRACT_NAMES.map((contractName) => [
          contractName,
          {
            creationBytecodeHash: contracts[contractName].creationBytecodeHash,
            runtimeBytecodeTemplateHash:
              contracts[contractName].runtimeBytecodeTemplateHash,
          },
        ])
      ),
      qualificationReviewCompleted: true,
      releaseApproved: true,
    };
    expect(
      validateRobinhoodGenericTestnetReleaseManifest(config, manifest, {
        contracts,
        protocolArtifactSha256: "d".repeat(64),
      })
    ).to.equal(manifest);
    expect(() =>
      validateRobinhoodGenericTestnetReleaseManifest(
        config,
        {
          ...manifest,
          settlementAsset: {
            ...manifest.settlementAsset,
            symbol: "tOTHER",
          },
        },
        { contracts, protocolArtifactSha256: "d".repeat(64) }
      )
    ).to.throw("reviewed test token");
    expect(
      buildRobinhoodGenericCorePromotionConfig(manifest, safeEnvironment)
        .settlementAsset
    ).to.deep.equal(config.settlementAsset);
    expect(() =>
      validateRobinhoodGenericTestnetReleaseManifest(
        { ...config, settlementAsset: undefined },
        manifest,
        { contracts, protocolArtifactSha256: "d".repeat(64) }
      )
    ).to.throw("configured reviewed settlement asset");

    const runtime = validateRobinhoodGenericTestnetRuntime(config, {
      chainId: 46630n,
      deployer,
      balanceWei: 1n,
      latestNonce: 0,
      pendingNonce: 0,
      latestBlockNumber: 1,
      latestBlockGasLimit: 30_000_000n,
      estimatedFactoryDeploymentGas: 2_000_000n,
      runtimeBytecodeBytes: Object.fromEntries(
        ETHEREUM_CONTRACT_NAMES.map((name) => [name, 100])
      ),
      creationBytecodeBytes: Object.fromEntries(
        ETHEREUM_CONTRACT_NAMES.map((name) => [name, 200])
      ),
    });
    expect(runtime.latestBlockGasLimit).to.equal(30_000_000n);
  });

  it("emits only the exact schema-v3 member-runtime manifest", function () {
    const { release, intermediate } = makeReleaseAndIntermediate();
    const deployment = validateRobinhoodGenericCoreIntermediate(
      intermediate,
      release
    );
    const runtimeHashes = Object.fromEntries(
      ETHEREUM_LIVE_ROLES.map((role) => [
        role,
        deployment.liveContracts[role].runtimeBytecodeSha256,
      ])
    );
    const manifest = validateRobinhoodRuntimeManifest(
      buildRobinhoodRuntimeManifest(deployment, runtimeHashes)
    );
    expect(manifest.chainId).to.equal("eip155:46630");
    expect(Object.keys(manifest)).to.deep.equal([
      "schemaVersion",
      "chainId",
      "factoryAddress",
      "protocolContractAddress",
      "policyRegistryAddress",
      "runtimeBytecodeSha256",
      "evidence",
    ]);
    expect(Object.values(manifest.evidence).every(Boolean)).to.equal(true);
  });

  it("replays the test token creation transaction and metadata", async function () {
    const tokenInterface = new Interface([
      "function name() view returns (string)",
      "function symbol() view returns (string)",
      "function decimals() view returns (uint8)",
    ]);
    const expectedAsset = {
      contractName: "NakamaTestUsd",
      address: settlementAddress,
      name: "Nakama Test USD",
      symbol: "tUSDG",
      decimals: 6,
      deploymentTransaction: settlementTransaction,
      classification: "test-only-mock",
      canonical: false,
    };
    let requestCount = 0;
    const fetchImpl = async (
      _url: string | URL | Request,
      init?: RequestInit
    ) => {
      requestCount += 1;
      if (requestCount === 1) {
        return {
          ok: false,
          status: 429,
          headers: { get: () => null },
        } as unknown as Response;
      }
      const request = JSON.parse(String(init?.body));
      let result: unknown;
      if (request.method === "eth_chainId") result = "0xb626";
      else if (request.method === "eth_getCode") result = "0x6000";
      else if (request.method === "eth_getTransactionByHash") {
        result = {
          hash: settlementTransaction,
          to: null,
        };
      } else if (request.method === "eth_getTransactionReceipt") {
        result = {
          transactionHash: settlementTransaction,
          to: null,
          status: "0x1",
          contractAddress: settlementAddress,
        };
      } else if (request.method === "eth_call") {
        const selector = request.params[0].data;
        if (selector === tokenInterface.encodeFunctionData("name")) {
          result = tokenInterface.encodeFunctionResult("name", [
            "Nakama Test USD",
          ]);
        } else if (selector === tokenInterface.encodeFunctionData("symbol")) {
          result = tokenInterface.encodeFunctionResult("symbol", ["tUSDG"]);
        } else {
          result = tokenInterface.encodeFunctionResult("decimals", [6]);
        }
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({ jsonrpc: "2.0", id: 1, result }),
      } as Response;
    };
    const observed = await verifyRobinhoodTestnetSettlementAsset(
      "https://primary.example.invalid/rpc",
      expectedAsset,
      { fetchImpl }
    );
    expect(observed.runtimeBytecodeSha256).to.equal(
      createHash("sha256").update(Buffer.from("6000", "hex")).digest("hex")
    );
    expect(requestCount).to.equal(8);
  });

  it("requires complete Blockscout verification and deploys fixed test supply", async function () {
    const evidence = await verifyRobinhoodBlockscoutSource(
      settlementAddress,
      "NakamaTestUsd",
      {
        fetchImpl: async () =>
          ({
            ok: true,
            status: 200,
            json: async () => ({
              is_verified: true,
              name: "NakamaTestUsd",
              source_code: "contract NakamaTestUsd {}",
              compiler_version: "v0.8.28",
              verified_at: "2026-07-26T00:00:00.000Z",
            }),
          } as Response),
      }
    );
    expect(evidence.contractName).to.equal("NakamaTestUsd");

    const [holder] = await ethers.getSigners();
    const supply = 5_000_000n * 1_000_000n;
    const token = await ethers.deployContract("NakamaTestUsd", [
      holder.address,
      supply,
    ]);
    await token.waitForDeployment();
    expect(await token.name()).to.equal("Nakama Test USD");
    expect(await token.symbol()).to.equal("tUSDG");
    expect(await token.decimals()).to.equal(6n);
    expect(await token.totalSupply()).to.equal(supply);
    expect(await token.balanceOf(holder.address)).to.equal(supply);
  });

  it("guards the separate test-token deployment command", function () {
    const assetEnvironment = {
      NAKAMA_ROBINHOOD_TEST_ASSET_DEPLOY_CONFIRMATION:
        ROBINHOOD_TEST_ASSET_DEPLOY_CONFIRMATION,
      ROBINHOOD_TESTNET_RPC_URL: safeEnvironment.ROBINHOOD_TESTNET_RPC_URL,
      ROBINHOOD_TESTNET_RPC_FALLBACK_URL:
        safeEnvironment.ROBINHOOD_TESTNET_RPC_FALLBACK_URL,
      ROBINHOOD_TESTNET_PRIVATE_KEY:
        safeEnvironment.ROBINHOOD_TESTNET_PRIVATE_KEY,
      NAKAMA_ROBINHOOD_TEST_ASSET_EXPECTED_DEPLOYER: deployer,
      NAKAMA_ROBINHOOD_TEST_ASSET_SOURCE_COMMIT: "a".repeat(40),
      NAKAMA_ROBINHOOD_TEST_ASSET_INITIAL_HOLDER: deployer,
      NAKAMA_ROBINHOOD_TEST_ASSET_INITIAL_SUPPLY_UNITS: "1000000",
      NAKAMA_ROBINHOOD_TEST_ASSET_CONFIRMATIONS: "20",
      NAKAMA_ROBINHOOD_TEST_ASSET_MIN_DEPLOYER_BALANCE_WEI: "1",
    };
    const config =
      validateRobinhoodTestAssetDeploymentEnvironment(assetEnvironment);
    expect(config.initialSupply).to.equal(1_000_000n);
    expect(() =>
      validateRobinhoodTestAssetDeploymentEnvironment({
        ...assetEnvironment,
        NAKAMA_ROBINHOOD_TEST_ASSET_DEPLOY_CONFIRMATION: "DEPLOY",
      })
    ).to.throw("confirmation phrase");
  });
});
