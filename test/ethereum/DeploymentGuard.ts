import { expect } from "chai";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { getCreateAddress, id, keccak256, zeroPadValue } from "ethers";
import { network } from "hardhat";

import {
  EIP170_RUNTIME_LIMIT,
  EIP3860_INITCODE_LIMIT,
  EIP7825_TRANSACTION_GAS_LIMIT,
  REQUIRED_DEPLOYMENT_CONFIRMATION,
  validateDeploymentEnvironment,
  validateDeploymentRuntime,
  validateReleaseManifest,
  validateSourceCheckout,
} from "../../scripts/lib/ethereum_deploy_guard.mjs";
import {
  canonicalImmutableReferences,
  normalizeRuntimeBytecode,
  runtimeBytecodeBytes,
  runtimeBytecodeTemplateHash,
} from "../../scripts/lib/ethereum_bytecode.mjs";
import {
  attestEthereumMainnetDeployment,
  sourcifyLookupUrl,
  verifySourcifyExactMatch,
} from "../../scripts/lib/ethereum_chain_verification.mjs";
import {
  ETHEREUM_CONTRACT_NAMES,
  ETHEREUM_LIVE_CONTRACTS,
  ETHEREUM_LIVE_ROLES,
  RESERVE_VAULT_TEMPLATE,
  protocolAbiPath,
} from "../../scripts/lib/ethereum_contract_set.mjs";
import {
  assertPathAbsent,
  createDeploymentIntent,
  replaceDeploymentJournal,
} from "../../scripts/lib/ethereum_deployment_journal.mjs";
import { runReleasePreflight } from "../../scripts/lib/ethereum_release_preflight.mjs";
import { buildEthereumPreflightReport } from "../../scripts/lib/ethereum_preflight_report.mjs";
import {
  buildPublishedDeploymentManifest,
  validateIntermediateDeployment,
  validatePublishedDeploymentManifest,
  validateSdkAbis,
} from "../../scripts/lib/ethereum_manifest_promotion.mjs";

const execFileAsync = promisify(execFile);
const { ethers } = await network.create();

const expectedDeployer = "0x00000000000000000000000000000000000000A1";
const safeEnvironment = {
  NAKAMA_MAINNET_DEPLOY_CONFIRMATION: REQUIRED_DEPLOYMENT_CONFIRMATION,
  ETHEREUM_MAINNET_RPC_URL: "https://ethereum.example.invalid/rpc",
  ETHEREUM_MAINNET_PRIVATE_KEY: `0x${"11".repeat(32)}`,
  NAKAMA_MAINNET_EXPECTED_DEPLOYER: expectedDeployer,
  NAKAMA_MAINNET_SOURCE_COMMIT: "a".repeat(40),
  NAKAMA_MAINNET_AUDIT_REPORT_SHA256: "b".repeat(64),
  NAKAMA_MAINNET_RELEASE_APPROVAL_SHA256: "c".repeat(64),
  NAKAMA_MAINNET_CONFIRMATIONS: "12",
  NAKAMA_MAINNET_MIN_DEPLOYER_BALANCE_WEI: "10000000000000000",
};

function rpcResponse(result: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: async () => ({ jsonrpc: "2.0", id: 1, result }),
  } as Response;
}

function artifactMetadata(
  creationBytecode: string,
  templateRuntime: string,
  immutableReferences: Array<{ start: number; length: number }>,
  abi: unknown[] = []
) {
  return {
    abi,
    abiSha256: createHash("sha256")
      .update(`${JSON.stringify(abi, null, 2)}\n`)
      .digest("hex"),
    creationBytecodeHash: keccak256(creationBytecode),
    creationBytecodeBytes: runtimeBytecodeBytes(creationBytecode),
    runtimeBytecodeTemplateHash: runtimeBytecodeTemplateHash(
      templateRuntime,
      immutableReferences
    ),
    runtimeBytecodeBytes: runtimeBytecodeBytes(templateRuntime),
    immutableReferences,
  };
}

function makeChainFixture() {
  const immutableReferences = [{ start: 2, length: 2 }];
  const creationBytecodes = {
    NakamaProtocolFactory: "0x60006000f3",
    NakamaCoverageProtocol: "0x60016000f3",
    NakamaPolicyRegistry: "0x60026000f3",
    ReserveVault: "0x60036000f3",
  };
  const templateRuntime = {
    NakamaProtocolFactory: "0x60016000600360046005",
    NakamaCoverageProtocol: "0x60116000601360146015",
    NakamaPolicyRegistry: "0x60216000602360246025",
    ReserveVault: "0x60316000603360346035",
  };
  const liveRuntime = {
    factory: "0x6001aabb600360046005",
    protocol: "0x6011ccdd601360146015",
    policyRegistry: "0x6021eeff602360246025",
  };
  const contracts = Object.fromEntries(
    ETHEREUM_CONTRACT_NAMES.map((name) => [
      name,
      artifactMetadata(
        creationBytecodes[name],
        templateRuntime[name],
        immutableReferences
      ),
    ])
  );
  const deploymentTransaction = `0x${"34".repeat(32)}`;
  const deploymentBlockHash = `0x${"45".repeat(32)}`;
  const factoryAddress = getCreateAddress({ from: expectedDeployer, nonce: 0 });
  const policyRegistryAddress = getCreateAddress({
    from: factoryAddress,
    nonce: 1,
  });
  const protocolAddress = getCreateAddress({ from: factoryAddress, nonce: 2 });
  const addresses = {
    factory: factoryAddress,
    policyRegistry: policyRegistryAddress,
    protocol: protocolAddress,
  };
  const release = {
    headCommit: safeEnvironment.NAKAMA_MAINNET_SOURCE_COMMIT,
    contracts,
    protocolArtifactSha256: "d".repeat(64),
    releaseManifest: {
      expectedDeployer,
      auditReportSha256: safeEnvironment.NAKAMA_MAINNET_AUDIT_REPORT_SHA256,
      releaseApprovalSha256:
        safeEnvironment.NAKAMA_MAINNET_RELEASE_APPROVAL_SHA256,
    },
  };
  const liveContracts = Object.fromEntries(
    ETHEREUM_LIVE_ROLES.map((role) => {
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
          runtimeBytecodeHash: keccak256(liveRuntime[role]),
          runtimeBytecodeTemplateHash: approved.runtimeBytecodeTemplateHash,
          runtimeBytecodeBytes: approved.runtimeBytecodeBytes,
          immutableReferences,
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
    chainId: 1,
    caip2: "eip155:1",
    entryContract: "NakamaProtocolFactory",
    deployer: expectedDeployer,
    deploymentTransaction,
    deploymentBlock: 100,
    deploymentBlockHash,
    confirmations: 12,
    sourceCommit: release.headCommit,
    protocolArtifactSha256: release.protocolArtifactSha256,
    liveContracts,
    contractTemplates: {
      reserveVault: {
        ...RESERVE_VAULT_TEMPLATE,
        creationBytecodeHash: vault.creationBytecodeHash,
        creationBytecodeBytes: vault.creationBytecodeBytes,
        runtimeBytecodeTemplateHash: vault.runtimeBytecodeTemplateHash,
        runtimeBytecodeBytes: vault.runtimeBytecodeBytes,
        immutableReferences,
        abiArtifact: protocolAbiPath("ReserveVault"),
        abiSha256: vault.abiSha256,
      },
    },
    verified: false,
    auditStatus: "audited",
    auditReportSha256: release.releaseManifest.auditReportSha256,
    releaseApprovalSha256: release.releaseManifest.releaseApprovalSha256,
    verificationEvidenceSha256: null,
  };
  const state = {
    transaction: {
      hash: deploymentTransaction,
      from: expectedDeployer,
      to: null,
      nonce: "0x0",
      input: creationBytecodes.NakamaProtocolFactory,
      blockNumber: "0x64",
      blockHash: deploymentBlockHash,
    } as Record<string, unknown> | null,
    receipt: {
      status: "0x1",
      transactionHash: deploymentTransaction,
      from: expectedDeployer,
      to: null,
      contractAddress: factoryAddress,
      blockNumber: "0x64",
      blockHash: deploymentBlockHash,
    } as Record<string, unknown> | null,
    block: {
      hash: deploymentBlockHash,
      number: "0x64",
      transactions: [deploymentTransaction],
    } as Record<string, unknown> | null,
    safeBlock: {
      hash: `0x${"67".repeat(32)}`,
      number: "0x70",
      transactions: [],
    },
    finalizedBlock: {
      hash: `0x${"68".repeat(32)}`,
      number: "0x6f",
      transactions: [],
    },
    latestBlock: "0x70",
    liveRuntime: { ...liveRuntime },
    getterOverrides: {} as Record<string, string>,
  };
  const fetchImpl = (async (
    _url: string | URL | Request,
    init?: RequestInit
  ) => {
    const request = JSON.parse(String(init?.body));
    let result: unknown;
    switch (request.method) {
      case "eth_chainId":
        result = "0x1";
        break;
      case "eth_getTransactionByHash":
        result = state.transaction;
        break;
      case "eth_getTransactionReceipt":
        result = state.receipt;
        break;
      case "eth_getBlockByHash":
        result = state.block;
        break;
      case "eth_getBlockByNumber": {
        const tag = request.params[0];
        result =
          tag === "safe"
            ? state.safeBlock
            : tag === "finalized"
            ? state.finalizedBlock
            : state.block;
        break;
      }
      case "eth_blockNumber":
        result = state.latestBlock;
        break;
      case "eth_getCode": {
        const requested = String(request.params[0]).toLowerCase();
        const role = ETHEREUM_LIVE_ROLES.find(
          (candidate) => addresses[candidate].toLowerCase() === requested
        );
        result = role ? state.liveRuntime[role] : "0x";
        break;
      }
      case "eth_call": {
        const to = String(request.params[0].to).toLowerCase();
        const data = String(request.params[0].data).toLowerCase();
        const key = `${to}:${data}`;
        let value = state.getterOverrides[key];
        if (
          !value &&
          to === factoryAddress.toLowerCase() &&
          data === id("policyRegistry()").slice(0, 10)
        ) {
          value = policyRegistryAddress;
        } else if (
          !value &&
          to === factoryAddress.toLowerCase() &&
          data === id("protocol()").slice(0, 10)
        ) {
          value = protocolAddress;
        } else if (
          !value &&
          to === policyRegistryAddress.toLowerCase() &&
          data === id("core()").slice(0, 10)
        ) {
          value = protocolAddress;
        } else if (
          !value &&
          to === protocolAddress.toLowerCase() &&
          data === id("policyRegistry()").slice(0, 10)
        ) {
          value = policyRegistryAddress;
        } else if (
          !value &&
          to === protocolAddress.toLowerCase() &&
          data === id("deploymentFactory()").slice(0, 10)
        ) {
          value = factoryAddress;
        }
        if (!value) throw new Error(`Unexpected eth_call ${key}`);
        result = zeroPadValue(value, 32);
        break;
      }
      default:
        throw new Error(`Unexpected RPC method: ${request.method}`);
    }
    return rpcResponse(result);
  }) as typeof fetch;
  return {
    addresses,
    contracts,
    creationBytecodes,
    immutableReferences,
    intermediate,
    liveRuntime,
    release,
    state,
    fetchImpl,
  };
}

function sizeMaps(fixture = makeChainFixture()) {
  return {
    runtimeBytecodeBytes: Object.fromEntries(
      ETHEREUM_CONTRACT_NAMES.map((name) => [
        name,
        fixture.contracts[name].runtimeBytecodeBytes,
      ])
    ),
    creationBytecodeBytes: Object.fromEntries(
      ETHEREUM_CONTRACT_NAMES.map((name) => [
        name,
        fixture.contracts[name].creationBytecodeBytes,
      ])
    ),
  };
}

function safeRuntime(fixture = makeChainFixture()) {
  return {
    chainId: 1n,
    deployer: expectedDeployer,
    balanceWei: 20_000_000_000_000_000n,
    latestNonce: 7,
    pendingNonce: 7,
    latestBlockNumber: 24_000_000,
    latestBlockGasLimit: 36_000_000n,
    estimatedFactoryDeploymentGas: 10_000_000n,
    ...sizeMaps(fixture),
  };
}

describe("Ethereum mainnet deployment guard", function () {
  it("accepts only an explicit chain-1 signer, balance, and every code-size gate", function () {
    const config = validateDeploymentEnvironment(safeEnvironment);
    const sizes = sizeMaps();
    const runtime = safeRuntime();
    const result = validateDeploymentRuntime(config, runtime);
    expect(result.deployer).to.equal(expectedDeployer);
    expect(() =>
      validateDeploymentRuntime(config, {
        ...runtime,
        runtimeBytecodeBytes: {
          ...sizes.runtimeBytecodeBytes,
          NakamaCoverageProtocol: EIP170_RUNTIME_LIMIT + 1,
        },
      })
    ).to.throw("NakamaCoverageProtocol runtime bytecode");
    expect(() =>
      validateDeploymentRuntime(config, {
        ...runtime,
        creationBytecodeBytes: {
          ...sizes.creationBytecodeBytes,
          NakamaProtocolFactory: EIP3860_INITCODE_LIMIT + 1,
        },
      })
    ).to.throw("NakamaProtocolFactory creation bytecode");
  });

  it("rejects pending signer state and factory deployments above mainnet transaction limits", function () {
    const config = validateDeploymentEnvironment(safeEnvironment);
    const runtime = safeRuntime();
    expect(EIP7825_TRANSACTION_GAS_LIMIT).to.equal(16_777_216n);
    expect(() =>
      validateDeploymentRuntime(config, {
        ...runtime,
        pendingNonce: runtime.latestNonce + 1,
      })
    ).to.throw("pending transactions");
    expect(() =>
      validateDeploymentRuntime(config, {
        ...runtime,
        estimatedFactoryDeploymentGas: 0n,
      })
    ).to.throw("gas estimate must be positive");
    expect(() =>
      validateDeploymentRuntime(config, {
        ...runtime,
        estimatedFactoryDeploymentGas: EIP7825_TRANSACTION_GAS_LIMIT + 1n,
      })
    ).to.throw("EIP-7825 transaction gas limit");
    expect(() =>
      validateDeploymentRuntime(config, {
        ...runtime,
        latestBlockGasLimit: 9_999_999n,
      })
    ).to.throw("latest block gas limit");
  });

  it("refuses missing confirmation, unsafe RPCs, development keys, wrong runtime, and shallow confirmations", function () {
    expect(() =>
      validateDeploymentEnvironment({
        ...safeEnvironment,
        NAKAMA_MAINNET_DEPLOY_CONFIRMATION: "yes",
      })
    ).to.throw("confirmation phrase");
    expect(() =>
      validateDeploymentEnvironment({
        ...safeEnvironment,
        ETHEREUM_MAINNET_RPC_URL: "http://127.0.0.1:8545",
      })
    ).to.throw("must use https");
    expect(() =>
      validateDeploymentEnvironment({
        ...safeEnvironment,
        ETHEREUM_MAINNET_PRIVATE_KEY:
          "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
      })
    ).to.throw("Hardhat development private key");
    expect(() =>
      validateDeploymentEnvironment({
        ...safeEnvironment,
        NAKAMA_MAINNET_CONFIRMATIONS: "11",
      })
    ).to.throw("at least 12");
    const config = validateDeploymentEnvironment(safeEnvironment);
    expect(() =>
      validateDeploymentRuntime(config, {
        ...safeRuntime(),
        chainId: 31_337n,
      })
    ).to.throw("expected Ethereum mainnet chain 1");
  });

  it("requires the configured source commit and a completely clean checkout", function () {
    const config = validateDeploymentEnvironment(safeEnvironment);
    expect(() =>
      validateSourceCheckout(config, {
        headCommit: "d".repeat(40),
        statusPorcelain: "",
      })
    ).to.throw("does not match the current git HEAD");
    expect(() =>
      validateSourceCheckout(config, {
        headCommit: config.sourceCommit,
        statusPorcelain: " M contracts/NakamaCoverageProtocol.sol\n",
      })
    ).to.throw("completely clean worktree");
  });

  it("binds release approval to every artifact in the schema-v3 contract set", function () {
    const config = validateDeploymentEnvironment(safeEnvironment);
    const fixture = makeChainFixture();
    const contracts = Object.fromEntries(
      ETHEREUM_CONTRACT_NAMES.map((name) => [
        name,
        {
          creationBytecodeHash: fixture.contracts[name].creationBytecodeHash,
          runtimeBytecodeTemplateHash:
            fixture.contracts[name].runtimeBytecodeTemplateHash,
        },
      ])
    );
    const approvedManifest = {
      schemaVersion: 3,
      status: "approved-for-mainnet",
      sourceCommit: config.sourceCommit,
      expectedDeployer: config.expectedDeployer,
      auditReportSha256: config.auditReportSha256,
      releaseApprovalSha256: config.releaseApprovalSha256,
      protocolArtifactSha256: fixture.release.protocolArtifactSha256,
      contracts,
      independentAuditCompleted: true,
      releaseApproved: true,
    };
    expect(() =>
      validateReleaseManifest(
        config,
        { ...approvedManifest, status: "not-approved" },
        fixture.release
      )
    ).to.throw("approved-for-mainnet");
    expect(() =>
      validateReleaseManifest(
        config,
        { ...approvedManifest, unexpectedApproval: true },
        fixture.release
      )
    ).to.throw("Release manifest keys must be exactly");
    expect(() =>
      validateReleaseManifest(
        config,
        {
          ...approvedManifest,
          contracts: {
            ...contracts,
            NakamaPolicyRegistry: {
              ...contracts.NakamaPolicyRegistry,
              runtimeBytecodeTemplateHash: `0x${"34".repeat(32)}`,
            },
          },
        },
        fixture.release
      )
    ).to.throw("NakamaPolicyRegistry runtime bytecode template hash");
    expect(
      validateReleaseManifest(config, approvedManifest, fixture.release)
    ).to.equal(approvedManifest);
  });

  it("emits all four creation and runtime proofs in the no-transaction preflight report", function () {
    const fixture = makeChainFixture();
    const runtime = safeRuntime(fixture);
    const report = buildEthereumPreflightReport(
      {
        sourceCommit: fixture.release.headCommit,
        auditReportSha256: fixture.release.releaseManifest.auditReportSha256,
        releaseApprovalSha256:
          fixture.release.releaseManifest.releaseApprovalSha256,
        confirmations: 12,
      },
      fixture.release,
      runtime,
      1n
    );
    expect(report.deploymentTransactions).to.equal(1);
    expect(Object.keys(report.contracts)).to.deep.equal(
      ETHEREUM_CONTRACT_NAMES
    );
    expect(
      report.contracts.NakamaProtocolFactory.creationBytecodeHash
    ).to.equal(fixture.contracts.NakamaProtocolFactory.creationBytecodeHash);
    expect(
      Object.values(report.contracts).every(
        (contract) => contract.runtimeBytecodeBytes > 0
      )
    ).to.equal(true);
    expect(report.latestNonce).to.equal(runtime.latestNonce);
    expect(report.pendingNonce).to.equal(runtime.pendingNonce);
    expect(report.latestBlockNumber).to.equal(runtime.latestBlockNumber);
    expect(report.latestBlockGasLimit).to.equal(
      runtime.latestBlockGasLimit.toString()
    );
    expect(report.estimatedFactoryDeploymentGas).to.equal(
      runtime.estimatedFactoryDeploymentGas.toString()
    );
    expect(report.eip7825TransactionGasLimit).to.equal(
      EIP7825_TRANSACTION_GAS_LIMIT.toString()
    );
    expect(() => JSON.stringify(report)).not.to.throw();
  });

  it("keeps the one-transaction factory deployment below the EIP-7825 cap", async function () {
    const [localDeployer] = await ethers.getSigners();
    const factoryContractFactory = await ethers.getContractFactory(
      "NakamaProtocolFactory",
      localDeployer
    );
    const deploymentRequest =
      await factoryContractFactory.getDeployTransaction();
    const estimatedGas = await ethers.provider.estimateGas({
      ...deploymentRequest,
      from: localDeployer.address,
    });
    expect(estimatedGas > 0n).to.equal(true);
    expect(estimatedGas <= EIP7825_TRANSACTION_GAS_LIMIT).to.equal(true);

    const factory = await factoryContractFactory.deploy({
      gasLimit: estimatedGas,
    });
    const deploymentTransaction = factory.deploymentTransaction();
    expect(deploymentTransaction).to.not.equal(null);
    const receipt = await deploymentTransaction!.wait();
    expect(receipt).to.not.equal(null);
    expect(receipt!.gasUsed > 0n).to.equal(true);
    expect(receipt!.gasUsed <= EIP7825_TRANSACTION_GAS_LIMIT).to.equal(true);
  });

  it("binds an ignored approval manifest to committed schema-v3 artifacts", async function () {
    const root = await mkdtemp(join(tmpdir(), "nakama-ethereum-release-"));
    try {
      const sharedArtifactDirectory = join(root, "shared/ethereum");
      const deploymentDirectory = join(root, "deployments");
      await Promise.all([
        mkdir(sharedArtifactDirectory, { recursive: true }),
        mkdir(deploymentDirectory, { recursive: true }),
        ...ETHEREUM_CONTRACT_NAMES.map((name) =>
          mkdir(join(root, `artifacts/hardhat/contracts/${name}.sol`), {
            recursive: true,
          })
        ),
      ]);
      const contractArtifacts = {};
      let factoryCreationBytecode = "";
      for (const [index, name] of ETHEREUM_CONTRACT_NAMES.entries()) {
        const bytecode = `0x60${index}06000f3`;
        const deployedBytecode = `0x60${index}0`;
        const abi = [];
        const abiRaw = `${JSON.stringify(abi, null, 2)}\n`;
        const metadata = artifactMetadata(bytecode, deployedBytecode, [], abi);
        contractArtifacts[name] = metadata;
        if (name === "NakamaProtocolFactory") {
          factoryCreationBytecode = bytecode;
        }
        await Promise.all([
          writeFile(
            join(root, `artifacts/hardhat/contracts/${name}.sol/${name}.json`),
            `${JSON.stringify({
              abi,
              bytecode,
              deployedBytecode,
              immutableReferences: {},
            })}\n`
          ),
          writeFile(join(sharedArtifactDirectory, `${name}.abi.json`), abiRaw),
        ]);
      }
      const protocolArtifactRaw = `${JSON.stringify(
        {
          schemaVersion: 3,
          chainFamily: "eip155",
          canonicalChain: "eip155:1",
          deploymentPlan: {
            transactionCount: 1,
            entryContract: "NakamaProtocolFactory",
            factoryCreates: [
              { contractName: "NakamaPolicyRegistry", nonce: 1 },
              { contractName: "NakamaCoverageProtocol", nonce: 2 },
            ],
            templates: [{ ...RESERVE_VAULT_TEMPLATE }],
          },
          contracts: contractArtifacts,
        },
        null,
        2
      )}\n`;
      const protocolArtifactSha256 = createHash("sha256")
        .update(protocolArtifactRaw)
        .digest("hex");
      await Promise.all([
        writeFile(
          join(sharedArtifactDirectory, "protocol_contract.json"),
          protocolArtifactRaw
        ),
        writeFile(
          join(root, ".gitignore"),
          "deployments/ethereum-mainnet.release.json\n"
        ),
      ]);
      await execFileAsync("git", ["init", "--quiet"], { cwd: root });
      await execFileAsync("git", ["add", "."], { cwd: root });
      await execFileAsync(
        "git",
        [
          "-c",
          "user.name=Nakama Release Test",
          "-c",
          "user.email=release-test@nakama.invalid",
          "commit",
          "--quiet",
          "-m",
          "release fixture",
        ],
        { cwd: root }
      );
      const { stdout } = await execFileAsync("git", ["rev-parse", "HEAD"], {
        cwd: root,
      });
      const sourceCommit = stdout.trim();
      const config = validateDeploymentEnvironment({
        ...safeEnvironment,
        NAKAMA_MAINNET_SOURCE_COMMIT: sourceCommit,
      });
      await writeFile(
        join(deploymentDirectory, "ethereum-mainnet.release.json"),
        `${JSON.stringify(
          {
            schemaVersion: 3,
            status: "approved-for-mainnet",
            sourceCommit,
            expectedDeployer: config.expectedDeployer,
            auditReportSha256: config.auditReportSha256,
            releaseApprovalSha256: config.releaseApprovalSha256,
            protocolArtifactSha256,
            contracts: Object.fromEntries(
              ETHEREUM_CONTRACT_NAMES.map((name) => [
                name,
                {
                  creationBytecodeHash:
                    contractArtifacts[name].creationBytecodeHash,
                  runtimeBytecodeTemplateHash:
                    contractArtifacts[name].runtimeBytecodeTemplateHash,
                },
              ])
            ),
            independentAuditCompleted: true,
            releaseApproved: true,
          },
          null,
          2
        )}\n`
      );
      const result = await runReleasePreflight(config, root);
      expect(Object.keys(result.contracts)).to.deep.equal(
        ETHEREUM_CONTRACT_NAMES
      );
      expect(result.protocolArtifactSha256).to.equal(protocolArtifactSha256);
      expect(result.factoryCreationBytecode).to.equal(factoryCreationBytecode);

      const alteredProtocolArtifactRaw = `${JSON.stringify(
        {
          ...JSON.parse(protocolArtifactRaw),
          deploymentPlan: {
            ...JSON.parse(protocolArtifactRaw).deploymentPlan,
            templates: [
              {
                ...RESERVE_VAULT_TEMPLATE,
                saltDerivation: "keccak256(abi.encode(assetToken,domainId))",
              },
            ],
          },
        },
        null,
        2
      )}\n`;
      await writeFile(
        join(sharedArtifactDirectory, "protocol_contract.json"),
        alteredProtocolArtifactRaw
      );
      await execFileAsync(
        "git",
        [
          "-c",
          "user.name=Nakama Release Test",
          "-c",
          "user.email=release-test@nakama.invalid",
          "commit",
          "--quiet",
          "-am",
          "alter deployment plan",
        ],
        { cwd: root }
      );
      const { stdout: alteredHead } = await execFileAsync(
        "git",
        ["rev-parse", "HEAD"],
        { cwd: root }
      );
      const alteredConfig = validateDeploymentEnvironment({
        ...safeEnvironment,
        NAKAMA_MAINNET_SOURCE_COMMIT: alteredHead.trim(),
      });
      await expect(runReleasePreflight(alteredConfig, root)).to.be.rejectedWith(
        "canonical schema-v3 factory deployment plan"
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("normalizes only canonical non-overlapping immutable ranges", function () {
    const bytecode = "0x112233445566";
    expect(
      normalizeRuntimeBytecode(bytecode, [{ start: 1, length: 2 }])
    ).to.equal("0x110000445566");
    expect(
      canonicalImmutableReferences({
        b: [{ start: 4, length: 1 }],
        a: [{ start: 1, length: 2 }],
      })
    ).to.deep.equal([
      { start: 1, length: 2 },
      { start: 4, length: 1 },
    ]);
    expect(() =>
      normalizeRuntimeBytecode(bytecode, [
        { start: 1, length: 2 },
        { start: 2, length: 1 },
      ])
    ).to.throw("must not overlap");
    expect(() =>
      normalizeRuntimeBytecode(bytecode, [{ start: 6, length: 1 }])
    ).to.throw("exceeds runtime bytecode length");
  });

  it("reproduces immutable artifact/live divergence for factory, registry, and core", async function () {
    const deployedFactory = await ethers.deployContract(
      "NakamaProtocolFactory"
    );
    await deployedFactory.waitForDeployment();
    const addresses = {
      NakamaProtocolFactory: await deployedFactory.getAddress(),
      NakamaPolicyRegistry: await deployedFactory.policyRegistry(),
      NakamaCoverageProtocol: await deployedFactory.protocol(),
    };
    for (const [name, deployedAddress] of Object.entries(addresses)) {
      const hardhatArtifact = JSON.parse(
        await readFile(
          `artifacts/hardhat/contracts/${name}.sol/${name}.json`,
          "utf8"
        )
      );
      const liveCode = await ethers.provider.getCode(deployedAddress);
      const references = canonicalImmutableReferences(
        hardhatArtifact.immutableReferences
      );
      expect(keccak256(liveCode)).to.not.equal(
        keccak256(hardhatArtifact.deployedBytecode)
      );
      expect(runtimeBytecodeTemplateHash(liveCode, references)).to.equal(
        runtimeBytecodeTemplateHash(
          hardhatArtifact.deployedBytecode,
          references
        )
      );
    }
  });

  it("rejects shifted ranges, stale templates, and a fake live vault address", function () {
    const fixture = makeChainFixture();
    expect(() =>
      validateIntermediateDeployment(
        {
          ...fixture.intermediate,
          liveContracts: {
            ...fixture.intermediate.liveContracts,
            policyRegistry: {
              ...fixture.intermediate.liveContracts.policyRegistry,
              immutableReferences: [{ start: 3, length: 2 }],
            },
          },
        },
        fixture.release
      )
    ).to.throw("immutableReferences must exactly match");
    expect(() =>
      validateIntermediateDeployment(
        {
          ...fixture.intermediate,
          contractTemplates: {
            reserveVault: {
              ...fixture.intermediate.contractTemplates.reserveVault,
              address: "0x000000000000000000000000000000000000dEaD",
            },
          },
        },
        fixture.release
      )
    ).to.throw("reserveVault template keys");
  });

  it("attests one factory transaction, nonce-one registry, nonce-two core, finality, code, and bindings", async function () {
    const fixture = makeChainFixture();
    const intermediate = validateIntermediateDeployment(
      fixture.intermediate,
      fixture.release
    );
    const attested = await attestEthereumMainnetDeployment(
      intermediate,
      fixture.release,
      {
        rpcUrl: safeEnvironment.ETHEREUM_MAINNET_RPC_URL,
        fetchImpl: fixture.fetchImpl,
      }
    );
    expect(attested.confirmations).to.equal(13);
    expect(attested.liveContracts.factory.address).to.equal(
      fixture.addresses.factory
    );
    expect(attested.liveContracts.policyRegistry.address).to.equal(
      fixture.addresses.policyRegistry
    );
    expect(attested.liveContracts.protocol.address).to.equal(
      fixture.addresses.protocol
    );
  });

  it("rejects forged child identity, altered factory initcode, unsafe heads, changed code, and binding mismatch", async function () {
    const forged = makeChainFixture();
    await expect(
      attestEthereumMainnetDeployment(
        validateIntermediateDeployment(
          {
            ...forged.intermediate,
            liveContracts: {
              ...forged.intermediate.liveContracts,
              policyRegistry: {
                ...forged.intermediate.liveContracts.policyRegistry,
                address: "0x000000000000000000000000000000000000dEaD",
              },
            },
          },
          forged.release
        ),
        forged.release,
        {
          rpcUrl: safeEnvironment.ETHEREUM_MAINNET_RPC_URL,
          fetchImpl: forged.fetchImpl,
        }
      )
    ).to.be.rejectedWith("CREATE nonce one");

    const alteredInitcode = makeChainFixture();
    if (alteredInitcode.state.transaction)
      alteredInitcode.state.transaction.input = "0x60016000f3";
    await expect(
      attestEthereumMainnetDeployment(
        validateIntermediateDeployment(
          alteredInitcode.intermediate,
          alteredInitcode.release
        ),
        alteredInitcode.release,
        {
          rpcUrl: safeEnvironment.ETHEREUM_MAINNET_RPC_URL,
          fetchImpl: alteredInitcode.fetchImpl,
        }
      )
    ).to.be.rejectedWith("Factory deployment transaction input");

    const unsafe = makeChainFixture();
    unsafe.state.safeBlock.number = "0x63";
    unsafe.state.finalizedBlock.number = "0x62";
    await expect(
      attestEthereumMainnetDeployment(
        validateIntermediateDeployment(unsafe.intermediate, unsafe.release),
        unsafe.release,
        {
          rpcUrl: safeEnvironment.ETHEREUM_MAINNET_RPC_URL,
          fetchImpl: unsafe.fetchImpl,
        }
      )
    ).to.be.rejectedWith("safe head");

    const alteredCode = makeChainFixture();
    alteredCode.state.liveRuntime.protocol = `0x61${alteredCode.liveRuntime.protocol.slice(
      4
    )}`;
    alteredCode.intermediate.liveContracts.protocol.runtimeBytecodeHash =
      keccak256(alteredCode.state.liveRuntime.protocol);
    await expect(
      attestEthereumMainnetDeployment(
        validateIntermediateDeployment(
          alteredCode.intermediate,
          alteredCode.release
        ),
        alteredCode.release,
        {
          rpcUrl: safeEnvironment.ETHEREUM_MAINNET_RPC_URL,
          fetchImpl: alteredCode.fetchImpl,
        }
      )
    ).to.be.rejectedWith("normalized live runtime");

    const badBinding = makeChainFixture();
    const key = `${badBinding.addresses.factory.toLowerCase()}:${id(
      "policyRegistry()"
    ).slice(0, 10)}`;
    badBinding.state.getterOverrides[key] = badBinding.addresses.protocol;
    await expect(
      attestEthereumMainnetDeployment(
        validateIntermediateDeployment(
          badBinding.intermediate,
          badBinding.release
        ),
        badBinding.release,
        {
          rpcUrl: safeEnvironment.ETHEREUM_MAINNET_RPC_URL,
          fetchImpl: badBinding.fetchImpl,
        }
      )
    ).to.be.rejectedWith("Factory policyRegistry getter mismatch");

    const badProtocolFactory = makeChainFixture();
    const protocolFactoryKey = `${badProtocolFactory.addresses.protocol.toLowerCase()}:${id(
      "deploymentFactory()"
    ).slice(0, 10)}`;
    badProtocolFactory.state.getterOverrides[protocolFactoryKey] =
      badProtocolFactory.addresses.policyRegistry;
    await expect(
      attestEthereumMainnetDeployment(
        validateIntermediateDeployment(
          badProtocolFactory.intermediate,
          badProtocolFactory.release
        ),
        badProtocolFactory.release,
        {
          rpcUrl: safeEnvironment.ETHEREUM_MAINNET_RPC_URL,
          fetchImpl: badProtocolFactory.fetchImpl,
        }
      )
    ).to.be.rejectedWith("Protocol deploymentFactory getter mismatch");
  });

  it("accepts only fixed Sourcify v2 exact creation/runtime matches", async function () {
    const fixture = makeChainFixture();
    for (const role of ETHEREUM_LIVE_ROLES) {
      let requestedUrl = "";
      const fetchImpl = (async (url: string | URL | Request) => {
        requestedUrl = String(url);
        return {
          ok: true,
          status: 200,
          json: async () => ({
            chainId: "1",
            address: fixture.addresses[role],
            creationMatch: "exact_match",
            runtimeMatch: "exact_match",
            verifiedAt: "2026-07-19T00:00:00.000Z",
            matchId: role,
          }),
        } as Response;
      }) as typeof fetch;
      const evidence = await verifySourcifyExactMatch(fixture.addresses[role], {
        fetchImpl,
      });
      expect(requestedUrl).to.equal(sourcifyLookupUrl(fixture.addresses[role]));
      expect(evidence.verificationProvider).to.equal("sourcify-v2");
    }
    const partialFetch = (async () =>
      ({
        ok: true,
        status: 200,
        json: async () => ({
          chainId: "1",
          address: fixture.addresses.protocol,
          creationMatch: "match",
          runtimeMatch: "exact_match",
          verifiedAt: "2026-07-19T00:00:00.000Z",
          matchId: "partial",
        }),
      } as Response)) as typeof fetch;
    await expect(
      verifySourcifyExactMatch(fixture.addresses.protocol, {
        fetchImpl: partialFetch,
      })
    ).to.be.rejectedWith("creation bytecode is not an exact match");
  });

  it("builds a final schema-v3 manifest from three Sourcify records and four SDK ABIs", async function () {
    const fixture = makeChainFixture();
    const canonicalDeployment = await attestEthereumMainnetDeployment(
      validateIntermediateDeployment(fixture.intermediate, fixture.release),
      fixture.release,
      {
        rpcUrl: safeEnvironment.ETHEREUM_MAINNET_RPC_URL,
        fetchImpl: fixture.fetchImpl,
      }
    );
    const sourceVerifications = Object.fromEntries(
      ETHEREUM_LIVE_ROLES.map((role) => [
        role,
        {
          verificationProvider: "sourcify-v2",
          verificationUrl: sourcifyLookupUrl(
            canonicalDeployment.liveContracts[role].address
          ),
          sourceVerifiedAt: "2026-07-19T00:00:00.000Z",
          sourcifyMatchId: role,
          creationMatch: "exact_match",
          runtimeMatch: "exact_match",
        },
      ])
    );
    const abiSha256ByContract = Object.fromEntries(
      ETHEREUM_CONTRACT_NAMES.map((name) => [
        name,
        fixture.contracts[name].abiSha256,
      ])
    );
    const finalManifest = buildPublishedDeploymentManifest(
      canonicalDeployment,
      sourceVerifications,
      { abiSha256ByContract, verificationEvidenceSha256: "f".repeat(64) }
    );
    expect(validatePublishedDeploymentManifest(finalManifest)).to.deep.equal(
      finalManifest
    );
    expect(
      finalManifest.liveContracts.factory.verification.creationMatch
    ).to.equal("exact_match");
    expect(finalManifest.contractTemplates.reserveVault).not.to.have.property(
      "address"
    );
    const finalSchema = JSON.parse(
      await readFile("deployments/ethereum-mainnet.final.schema.json", "utf8")
    );
    for (const field of finalSchema.required)
      expect(finalManifest).to.have.property(field);
    expect(finalSchema.properties.schemaVersion.const).to.equal(3);
    expect(() =>
      validatePublishedDeploymentManifest({
        ...finalManifest,
        liveContracts: {
          ...finalManifest.liveContracts,
          protocol: {
            ...finalManifest.liveContracts.protocol,
            verification: {
              ...finalManifest.liveContracts.protocol.verification,
              verificationUrl: "https://attacker.invalid/fake",
            },
          },
        },
      })
    ).to.throw("canonical Sourcify v2 lookup");
  });

  it("structurally binds all four SDK ABIs", function () {
    const fixture = makeChainFixture();
    const sdkAbis = Object.fromEntries(
      ETHEREUM_CONTRACT_NAMES.map((name) => [name, fixture.contracts[name].abi])
    );
    expect(validateSdkAbis(sdkAbis, fixture.contracts)).to.equal(sdkAbis);
    expect(() =>
      validateSdkAbis(
        {
          ...sdkAbis,
          NakamaPolicyRegistry: [
            { type: "function", name: "owner", inputs: [], outputs: [] },
          ],
        },
        fixture.contracts
      )
    ).to.throw("NakamaPolicyRegistry ABI");
  });

  it("uses one durable factory intent and preserves recovery data before journal replacement", async function () {
    const root = await mkdtemp(join(tmpdir(), "nakama-deployment-journal-"));
    try {
      const journalPath = join(root, "broadcast.json");
      await createDeploymentIntent(journalPath, { status: "intent" });
      expect((await readFile(journalPath, "utf8")).trim()).to.not.equal("");
      await expect(createDeploymentIntent(journalPath, { status: "second" })).to
        .be.rejected;
      await replaceDeploymentJournal(journalPath, {
        status: "broadcast",
        transaction: "0x1234",
      });
      expect(JSON.parse(await readFile(journalPath, "utf8")).status).to.equal(
        "broadcast"
      );
      const zeroBytePath = join(root, "zero.json");
      await writeFile(zeroBytePath, "");
      await expect(assertPathAbsent(zeroBytePath)).to.be.rejectedWith(
        "unreconciled operator state"
      );
      const deployScript = await readFile(
        "scripts/deploy_ethereum_mainnet.ts",
        "utf8"
      );
      const preflightScript = await readFile(
        "scripts/ethereum_mainnet_preflight.mjs",
        "utf8"
      );
      expect(deployScript.indexOf("createDeploymentIntent")).to.be.lessThan(
        deployScript.indexOf("factoryContractFactory.deploy")
      );
      for (const recoveryField of [
        "deploymentNonce",
        "liveContractAddresses",
        "factoryCreationBytecodeHash",
        "deploymentPreflight",
        "protocolArtifactSha256",
      ]) {
        expect(
          deployScript.slice(
            deployScript.indexOf("createDeploymentIntent"),
            deployScript.indexOf("factoryContractFactory.deploy")
          )
        ).to.include(recoveryField);
      }
      expect(deployScript).to.include(
        "gasLimit: runtime.estimatedFactoryDeploymentGas"
      );
      for (const script of [deployScript, preflightScript]) {
        expect(script).to.include("getTransactionCount(");
        expect(script).to.include('"latest"');
        expect(script).to.include('"pending"');
        expect(script).to.include('getBlock("latest")');
        expect(script).to.include("data: release.factoryCreationBytecode");
      }
      expect(
        deployScript.indexOf("console.error(`[ethereum-mainnet:broadcast]")
      ).to.be.lessThan(
        deployScript.indexOf("replaceDeploymentJournal(broadcastPath")
      );
      expect(deployScript.match(/\.deploy\(/g)).to.have.length(1);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
