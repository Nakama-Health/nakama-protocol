import { expect } from "chai";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { getCreateAddress, keccak256 } from "ethers";
import { network } from "hardhat";

import {
  EIP170_RUNTIME_LIMIT,
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
  validateSdkAbi,
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

function makeChainFixture() {
  const immutableReferences = [{ start: 2, length: 2 }];
  const templateRuntime = "0x60016000600360046005";
  const liveRuntime = "0x6001aabb600360046005";
  const creationBytecode = "0x60006000f3";
  const deploymentTransaction = `0x${"34".repeat(32)}`;
  const deploymentBlockHash = `0x${"45".repeat(32)}`;
  const protocolAddress = getCreateAddress({ from: expectedDeployer, nonce: 0 });
  const release = {
    headCommit: safeEnvironment.NAKAMA_MAINNET_SOURCE_COMMIT,
    protocolCreationBytecodeHash: keccak256(creationBytecode),
    protocolRuntimeBytecodeTemplateHash: runtimeBytecodeTemplateHash(
      templateRuntime,
      immutableReferences,
    ),
    protocolImmutableReferences: immutableReferences,
    runtimeBytecodeBytes: runtimeBytecodeBytes(templateRuntime),
    protocolArtifactSha256: "d".repeat(64),
    protocolAbi: [],
    releaseManifest: {
      expectedDeployer,
      auditReportSha256: safeEnvironment.NAKAMA_MAINNET_AUDIT_REPORT_SHA256,
      releaseApprovalSha256: safeEnvironment.NAKAMA_MAINNET_RELEASE_APPROVAL_SHA256,
    },
  };
  const intermediate = {
    schemaVersion: 2,
    status: "deployed-unverified",
    chainId: 1,
    caip2: "eip155:1",
    contractName: "NakamaCoverageProtocol",
    protocolAddress,
    deployer: expectedDeployer,
    deploymentTransaction,
    deploymentBlock: 100,
    deploymentBlockHash,
    confirmations: 12,
    sourceCommit: release.headCommit,
    auditReportSha256: release.releaseManifest.auditReportSha256,
    releaseApprovalSha256: release.releaseManifest.releaseApprovalSha256,
    protocolArtifactSha256: release.protocolArtifactSha256,
    creationBytecodeHash: release.protocolCreationBytecodeHash,
    runtimeBytecodeHash: keccak256(liveRuntime),
    runtimeBytecodeTemplateHash: release.protocolRuntimeBytecodeTemplateHash,
    runtimeBytecodeBytes: release.runtimeBytecodeBytes,
    immutableReferences,
    abiArtifact: "shared/ethereum/protocol_contract.json",
    verified: false,
    auditStatus: "audited",
  };
  const state = {
    transaction: {
      hash: deploymentTransaction,
      from: expectedDeployer,
      to: null,
      nonce: "0x0",
      input: creationBytecode,
      blockNumber: "0x64",
      blockHash: deploymentBlockHash,
    } as Record<string, unknown> | null,
    receipt: {
      status: "0x1",
      transactionHash: deploymentTransaction,
      from: expectedDeployer,
      to: null,
      contractAddress: protocolAddress,
      blockNumber: "0x64",
      blockHash: deploymentBlockHash,
    } as Record<string, unknown> | null,
    block: {
      hash: deploymentBlockHash,
      number: "0x64",
      transactions: [deploymentTransaction],
    } as Record<string, unknown> | null,
    safeBlock: { hash: `0x${"67".repeat(32)}`, number: "0x70", transactions: [] },
    finalizedBlock: { hash: `0x${"68".repeat(32)}`, number: "0x6f", transactions: [] },
    latestBlock: "0x70",
    liveRuntime,
  };
  const fetchImpl = (async (_url: string | URL | Request, init?: RequestInit) => {
    const request = JSON.parse(String(init?.body));
    let result: unknown;
    switch (request.method) {
      case "eth_chainId": result = "0x1"; break;
      case "eth_getTransactionByHash": result = state.transaction; break;
      case "eth_getTransactionReceipt": result = state.receipt; break;
      case "eth_getBlockByHash": result = state.block; break;
      case "eth_getBlockByNumber": {
        const tag = request.params[0];
        result = tag === "safe" ? state.safeBlock : tag === "finalized" ? state.finalizedBlock : state.block;
        break;
      }
      case "eth_blockNumber": result = state.latestBlock; break;
      case "eth_getCode": result = state.liveRuntime; break;
      default: throw new Error(`Unexpected RPC method: ${request.method}`);
    }
    return rpcResponse(result);
  }) as typeof fetch;
  return { creationBytecode, immutableReferences, intermediate, liveRuntime, release, state, fetchImpl };
}

describe("Ethereum mainnet deployment guard", function () {
  it("accepts only an explicit chain-1, signer, balance, and code-size preflight", function () {
    const config = validateDeploymentEnvironment(safeEnvironment);
    const result = validateDeploymentRuntime(config, {
      chainId: 1n,
      deployer: expectedDeployer,
      balanceWei: 20_000_000_000_000_000n,
      runtimeBytecodeBytes: 23_485,
    });
    expect(result.deployer).to.equal(expectedDeployer);
  });

  it("refuses missing confirmation, credential URLs, local RPC, development keys, and shallow confirmations", function () {
    expect(() =>
      validateDeploymentEnvironment({ ...safeEnvironment, NAKAMA_MAINNET_DEPLOY_CONFIRMATION: "yes" }),
    ).to.throw("confirmation phrase");
    expect(() =>
      validateDeploymentEnvironment({ ...safeEnvironment, ETHEREUM_MAINNET_RPC_URL: "http://127.0.0.1:8545" }),
    ).to.throw("must use https");
    for (const rpcUrl of [
      "https://user:secret@ethereum.example.invalid/rpc",
      "https://ethereum.example.invalid/rpc?apiKey=secret",
    ]) {
      expect(() =>
        validateDeploymentEnvironment({ ...safeEnvironment, ETHEREUM_MAINNET_RPC_URL: rpcUrl }),
      ).to.throw("must not contain embedded credentials");
    }
    expect(() =>
      validateDeploymentEnvironment({
        ...safeEnvironment,
        ETHEREUM_MAINNET_PRIVATE_KEY:
          "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
      }),
    ).to.throw("Hardhat development private key");
    expect(() =>
      validateDeploymentEnvironment({ ...safeEnvironment, NAKAMA_MAINNET_CONFIRMATIONS: "11" }),
    ).to.throw("at least 12");
  });

  it("refuses the wrong chain, signer, insufficient balance, and oversized runtime", function () {
    const config = validateDeploymentEnvironment(safeEnvironment);
    const baseRuntime = {
      chainId: 1n,
      deployer: expectedDeployer,
      balanceWei: 20_000_000_000_000_000n,
      runtimeBytecodeBytes: 23_485,
    };
    expect(() => validateDeploymentRuntime(config, { ...baseRuntime, chainId: 31_337n })).to.throw(
      "expected Ethereum mainnet chain 1",
    );
    expect(() =>
      validateDeploymentRuntime(config, {
        ...baseRuntime,
        deployer: "0x00000000000000000000000000000000000000b2",
      }),
    ).to.throw("does not match");
    expect(() => validateDeploymentRuntime(config, { ...baseRuntime, balanceWei: 1n })).to.throw(
      "balance is below",
    );
    expect(() =>
      validateDeploymentRuntime(config, {
        ...baseRuntime,
        runtimeBytecodeBytes: EIP170_RUNTIME_LIMIT + 1,
      }),
    ).to.throw("above the EIP-170 limit");
  });

  it("requires the configured source commit and a completely clean checkout", function () {
    const config = validateDeploymentEnvironment(safeEnvironment);
    expect(() =>
      validateSourceCheckout(config, { headCommit: "d".repeat(40), statusPorcelain: "" }),
    ).to.throw("does not match the current git HEAD");
    expect(() =>
      validateSourceCheckout(config, {
        headCommit: config.sourceCommit,
        statusPorcelain: " M contracts/NakamaCoverageProtocol.sol\n",
      }),
    ).to.throw("completely clean worktree");
  });

  it("requires release approval bound to deployer, audit, approval, template, and artifact", function () {
    const config = validateDeploymentEnvironment(safeEnvironment);
    const artifacts = {
      protocolCreationBytecodeHash: `0x${"11".repeat(32)}`,
      protocolRuntimeBytecodeTemplateHash: `0x${"12".repeat(32)}`,
      protocolArtifactSha256: "d".repeat(64),
    };
    const approvedManifest = {
      schemaVersion: 2,
      status: "approved-for-mainnet",
      sourceCommit: config.sourceCommit,
      expectedDeployer: config.expectedDeployer,
      auditReportSha256: config.auditReportSha256,
      releaseApprovalSha256: config.releaseApprovalSha256,
      protocolCreationBytecodeHash: artifacts.protocolCreationBytecodeHash,
      protocolRuntimeBytecodeTemplateHash: artifacts.protocolRuntimeBytecodeTemplateHash,
      protocolArtifactSha256: artifacts.protocolArtifactSha256,
      independentAuditCompleted: true,
      releaseApproved: true,
    };
    expect(() =>
      validateReleaseManifest(config, { ...approvedManifest, status: "not-approved" }, artifacts),
    ).to.throw("approved-for-mainnet");
    expect(() =>
      validateReleaseManifest(
        config,
        { ...approvedManifest, expectedDeployer: "0x00000000000000000000000000000000000000b2" },
        artifacts,
      ),
    ).to.throw("expectedDeployer");
    expect(() =>
      validateReleaseManifest(
        config,
        { ...approvedManifest, protocolRuntimeBytecodeTemplateHash: `0x${"34".repeat(32)}` },
        artifacts,
      ),
    ).to.throw("template hash");
    expect(validateReleaseManifest(config, approvedManifest, artifacts)).to.equal(approvedManifest);
  });

  it("emits every creation/template proof in the no-transaction preflight report", function () {
    const fixture = makeChainFixture();
    const report = buildEthereumPreflightReport(
      {
        sourceCommit: fixture.release.headCommit,
        auditReportSha256: fixture.release.releaseManifest.auditReportSha256,
        releaseApprovalSha256: fixture.release.releaseManifest.releaseApprovalSha256,
        confirmations: 12,
      },
      fixture.release,
      { deployer: expectedDeployer, runtimeBytecodeBytes: fixture.release.runtimeBytecodeBytes },
      1n,
    );
    expect(report.creationBytecodeHash).to.equal(fixture.release.protocolCreationBytecodeHash);
    expect(report.runtimeBytecodeTemplateHash).to.equal(
      fixture.release.protocolRuntimeBytecodeTemplateHash,
    );
    expect(report.immutableReferences).to.deep.equal(fixture.immutableReferences);
    expect(Object.values(report)).not.to.include(undefined);
    expect(() => buildEthereumPreflightReport(
      {
        sourceCommit: fixture.release.headCommit,
        auditReportSha256: fixture.release.releaseManifest.auditReportSha256,
        releaseApprovalSha256: fixture.release.releaseManifest.releaseApprovalSha256,
        confirmations: 12,
      },
      { ...fixture.release, protocolCreationBytecodeHash: undefined },
      { deployer: expectedDeployer, runtimeBytecodeBytes: fixture.release.runtimeBytecodeBytes },
      1n,
    )).to.throw("creationBytecodeHash is unavailable");
  });

  it("binds an ignored approval manifest to an already committed source and schema-v2 artifacts", async function () {
    const root = await mkdtemp(join(tmpdir(), "nakama-ethereum-release-"));
    try {
      const hardhatArtifactDirectory = join(root, "artifacts/hardhat/contracts/NakamaCoverageProtocol.sol");
      const sharedArtifactDirectory = join(root, "shared/ethereum");
      const deploymentDirectory = join(root, "deployments");
      await Promise.all([
        mkdir(hardhatArtifactDirectory, { recursive: true }),
        mkdir(sharedArtifactDirectory, { recursive: true }),
        mkdir(deploymentDirectory, { recursive: true }),
      ]);
      const bytecode = "0x60006000f3";
      const deployedBytecode = "0x6000";
      const immutableReferences: Array<{ start: number; length: number }> = [];
      const templateHash = runtimeBytecodeTemplateHash(deployedBytecode, immutableReferences);
      const protocolAbiRaw = "[]\n";
      const protocolAbiSha256 = createHash("sha256").update(protocolAbiRaw).digest("hex");
      const protocolArtifactRaw = `${JSON.stringify({
        schemaVersion: 2,
        contracts: {
          NakamaCoverageProtocol: {
            abi: [],
            abiSha256: protocolAbiSha256,
            creationBytecodeHash: keccak256(bytecode),
            runtimeBytecodeTemplateHash: templateHash,
            runtimeBytecodeBytes: 2,
            immutableReferences,
          },
        },
      }, null, 2)}\n`;
      const protocolArtifactSha256 = createHash("sha256").update(protocolArtifactRaw).digest("hex");
      await Promise.all([
        writeFile(
          join(hardhatArtifactDirectory, "NakamaCoverageProtocol.json"),
          `${JSON.stringify({ bytecode, deployedBytecode, immutableReferences })}\n`,
        ),
        writeFile(join(sharedArtifactDirectory, "protocol_contract.json"), protocolArtifactRaw),
        writeFile(join(sharedArtifactDirectory, "NakamaCoverageProtocol.abi.json"), protocolAbiRaw),
        writeFile(join(root, ".gitignore"), "deployments/ethereum-mainnet.release.json\n"),
      ]);
      await execFileAsync("git", ["init", "--quiet"], { cwd: root });
      await execFileAsync("git", ["add", "."], { cwd: root });
      await execFileAsync(
        "git",
        ["-c", "user.name=Nakama Release Test", "-c", "user.email=release-test@nakama.invalid", "commit", "--quiet", "-m", "release fixture"],
        { cwd: root },
      );
      const { stdout } = await execFileAsync("git", ["rev-parse", "HEAD"], { cwd: root });
      const sourceCommit = stdout.trim();
      const config = validateDeploymentEnvironment({
        ...safeEnvironment,
        NAKAMA_MAINNET_SOURCE_COMMIT: sourceCommit,
      });
      await writeFile(join(deploymentDirectory, "ethereum-mainnet.release.json"), `${JSON.stringify({
        schemaVersion: 2,
        status: "approved-for-mainnet",
        sourceCommit,
        expectedDeployer: config.expectedDeployer,
        auditReportSha256: config.auditReportSha256,
        releaseApprovalSha256: config.releaseApprovalSha256,
        protocolCreationBytecodeHash: keccak256(bytecode),
        protocolRuntimeBytecodeTemplateHash: templateHash,
        protocolArtifactSha256,
        independentAuditCompleted: true,
        releaseApproved: true,
      }, null, 2)}\n`);
      const result = await runReleasePreflight(config, root);
      expect(result.protocolRuntimeBytecodeTemplateHash).to.equal(templateHash);
      expect(result.protocolCreationBytecodeHash).to.equal(keccak256(bytecode));
      expect(result.protocolImmutableReferences).to.deep.equal([]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("normalizes only canonical non-overlapping immutable ranges", function () {
    const bytecode = "0x112233445566";
    expect(normalizeRuntimeBytecode(bytecode, [{ start: 1, length: 2 }])).to.equal("0x110000445566");
    expect(canonicalImmutableReferences({ b: [{ start: 4, length: 1 }], a: [{ start: 1, length: 2 }] }))
      .to.deep.equal([{ start: 1, length: 2 }, { start: 4, length: 1 }]);
    expect(() => normalizeRuntimeBytecode(bytecode, [{ start: 1, length: 2 }, { start: 2, length: 1 }]))
      .to.throw("must not overlap");
    expect(() => normalizeRuntimeBytecode(bytecode, [{ start: 6, length: 1 }]))
      .to.throw("exceeds runtime bytecode length");
  });

  it("reproduces immutable artifact/live divergence while preserving the normalized template", async function () {
    const protocol = await ethers.deployContract("NakamaCoverageProtocol");
    await protocol.waitForDeployment();
    const artifact = await ethers.getContractFactory("NakamaCoverageProtocol");
    const hardhatArtifact = JSON.parse(
      await readFile("artifacts/hardhat/contracts/NakamaCoverageProtocol.sol/NakamaCoverageProtocol.json", "utf8"),
    );
    const liveCode = await ethers.provider.getCode(await protocol.getAddress());
    const references = canonicalImmutableReferences(hardhatArtifact.immutableReferences);
    expect(artifact.bytecode).to.not.equal("0x");
    expect(keccak256(liveCode)).to.not.equal(keccak256(hardhatArtifact.deployedBytecode));
    expect(runtimeBytecodeTemplateHash(liveCode, references)).to.equal(
      runtimeBytecodeTemplateHash(hardhatArtifact.deployedBytecode, references),
    );
  });

  it("rejects extra or shifted manifest ranges before any live normalization", function () {
    const fixture = makeChainFixture();
    expect(() => validateIntermediateDeployment({
      ...fixture.intermediate,
      immutableReferences: [...fixture.immutableReferences, { start: 6, length: 1 }],
    }, fixture.release)).to.throw("exactly match");
    expect(() => validateIntermediateDeployment({
      ...fixture.intermediate,
      immutableReferences: [{ start: 3, length: 2 }],
    }, fixture.release)).to.throw("exactly match");
  });

  it("independently attests transaction, receipt, canonical finalized block, and both runtime hashes", async function () {
    const fixture = makeChainFixture();
    const intermediate = validateIntermediateDeployment(fixture.intermediate, fixture.release);
    const attested = await attestEthereumMainnetDeployment(intermediate, fixture.release, {
      rpcUrl: safeEnvironment.ETHEREUM_MAINNET_RPC_URL,
      fetchImpl: fixture.fetchImpl,
    });
    expect(attested.runtimeBytecodeHash).to.equal(keccak256(fixture.liveRuntime));
    expect(attested.runtimeBytecodeTemplateHash).to.equal(fixture.release.protocolRuntimeBytecodeTemplateHash);
    expect(attested.confirmations).to.equal(13);
  });

  it("rejects forged intermediate identity, missing transactions, altered initcode, and unsafe heads", async function () {
    const forgedAddress = makeChainFixture();
    const forgedIntermediate = validateIntermediateDeployment({
      ...forgedAddress.intermediate,
      protocolAddress: "0x000000000000000000000000000000000000dEaD",
    }, forgedAddress.release);
    await expect(attestEthereumMainnetDeployment(forgedIntermediate, forgedAddress.release, {
      rpcUrl: safeEnvironment.ETHEREUM_MAINNET_RPC_URL,
      fetchImpl: forgedAddress.fetchImpl,
    })).to.be.rejectedWith("protocolAddress does not match");

    const missingTransaction = makeChainFixture();
    missingTransaction.state.transaction = null;
    await expect(attestEthereumMainnetDeployment(
      validateIntermediateDeployment(missingTransaction.intermediate, missingTransaction.release),
      missingTransaction.release,
      { rpcUrl: safeEnvironment.ETHEREUM_MAINNET_RPC_URL, fetchImpl: missingTransaction.fetchImpl },
    )).to.be.rejectedWith("transaction does not exist");

    const alteredInitcode = makeChainFixture();
    if (alteredInitcode.state.transaction) alteredInitcode.state.transaction.input = "0x60016000f3";
    await expect(attestEthereumMainnetDeployment(
      validateIntermediateDeployment(alteredInitcode.intermediate, alteredInitcode.release),
      alteredInitcode.release,
      { rpcUrl: safeEnvironment.ETHEREUM_MAINNET_RPC_URL, fetchImpl: alteredInitcode.fetchImpl },
    )).to.be.rejectedWith("creation bytecode");

    const unsafe = makeChainFixture();
    unsafe.state.safeBlock.number = "0x63";
    unsafe.state.finalizedBlock.number = "0x62";
    await expect(attestEthereumMainnetDeployment(
      validateIntermediateDeployment(unsafe.intermediate, unsafe.release),
      unsafe.release,
      { rpcUrl: safeEnvironment.ETHEREUM_MAINNET_RPC_URL, fetchImpl: unsafe.fetchImpl },
    )).to.be.rejectedWith("safe head");
  });

  it("rejects altered nonimmutable code and binds altered immutable values with the exact live hash", async function () {
    const alteredCode = makeChainFixture();
    alteredCode.state.liveRuntime = `0x61${alteredCode.liveRuntime.slice(4)}`;
    const alteredIntermediate = {
      ...alteredCode.intermediate,
      runtimeBytecodeHash: keccak256(alteredCode.state.liveRuntime),
    };
    await expect(attestEthereumMainnetDeployment(
      validateIntermediateDeployment(alteredIntermediate, alteredCode.release),
      alteredCode.release,
      { rpcUrl: safeEnvironment.ETHEREUM_MAINNET_RPC_URL, fetchImpl: alteredCode.fetchImpl },
    )).to.be.rejectedWith("Normalized live runtime");

    const alteredImmutable = makeChainFixture();
    alteredImmutable.state.liveRuntime = "0x6001ccdd600360046005";
    const exactIntermediate = validateIntermediateDeployment({
      ...alteredImmutable.intermediate,
      runtimeBytecodeHash: keccak256(alteredImmutable.state.liveRuntime),
    }, alteredImmutable.release);
    const accepted = await attestEthereumMainnetDeployment(exactIntermediate, alteredImmutable.release, {
      rpcUrl: safeEnvironment.ETHEREUM_MAINNET_RPC_URL,
      fetchImpl: alteredImmutable.fetchImpl,
    });
    expect(accepted.runtimeBytecodeHash).to.equal(keccak256(alteredImmutable.state.liveRuntime));

    await expect(attestEthereumMainnetDeployment(
      validateIntermediateDeployment(alteredImmutable.intermediate, alteredImmutable.release),
      alteredImmutable.release,
      { rpcUrl: safeEnvironment.ETHEREUM_MAINNET_RPC_URL, fetchImpl: alteredImmutable.fetchImpl },
    )).to.be.rejectedWith("runtimeBytecodeHash does not match live code");
  });

  it("accepts only a fixed Sourcify v2 exact creation/runtime match", async function () {
    const fixture = makeChainFixture();
    let requestedUrl = "";
    const fetchImpl = (async (url: string | URL | Request) => {
      requestedUrl = String(url);
      return {
        ok: true,
        status: 200,
        json: async () => ({
          chainId: "1",
          address: fixture.intermediate.protocolAddress,
          creationMatch: "exact_match",
          runtimeMatch: "exact_match",
          verifiedAt: "2026-07-19T00:00:00.000Z",
          matchId: "1234",
        }),
      } as Response;
    }) as typeof fetch;
    const evidence = await verifySourcifyExactMatch(fixture.intermediate.protocolAddress, { fetchImpl });
    expect(requestedUrl).to.equal(sourcifyLookupUrl(fixture.intermediate.protocolAddress));
    expect(evidence.verificationProvider).to.equal("sourcify-v2");

    const partialFetch = (async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        chainId: "1",
        address: fixture.intermediate.protocolAddress,
        creationMatch: "match",
        runtimeMatch: "exact_match",
        verifiedAt: "2026-07-19T00:00:00.000Z",
        matchId: "1234",
      }),
    } as Response)) as typeof fetch;
    await expect(verifySourcifyExactMatch(fixture.intermediate.protocolAddress, { fetchImpl: partialFetch }))
      .to.be.rejectedWith("creation bytecode is not an exact match");
  });

  it("builds a final manifest only from canonical chain and Sourcify evidence", async function () {
    const fixture = makeChainFixture();
    const canonicalDeployment = await attestEthereumMainnetDeployment(
      validateIntermediateDeployment(fixture.intermediate, fixture.release),
      fixture.release,
      { rpcUrl: safeEnvironment.ETHEREUM_MAINNET_RPC_URL, fetchImpl: fixture.fetchImpl },
    );
    const sourceVerification = {
      verificationProvider: "sourcify-v2",
      verificationUrl: sourcifyLookupUrl(canonicalDeployment.protocolAddress),
      sourceVerifiedAt: "2026-07-19T00:00:00.000Z",
      sourcifyMatchId: "1234",
      creationMatch: "exact_match",
      runtimeMatch: "exact_match",
    };
    const finalManifest = buildPublishedDeploymentManifest(canonicalDeployment, sourceVerification, {
      abiSha256: "e".repeat(64),
      verificationEvidenceSha256: "f".repeat(64),
    });
    expect(validatePublishedDeploymentManifest(finalManifest)).to.equal(finalManifest);
    expect(finalManifest.creationBytecodeHash).to.equal(fixture.release.protocolCreationBytecodeHash);
    expect(finalManifest.runtimeBytecodeBytes).to.equal(fixture.release.runtimeBytecodeBytes);
    const finalSchema = JSON.parse(
      await readFile("deployments/ethereum-mainnet.final.schema.json", "utf8"),
    );
    for (const field of finalSchema.required) {
      expect(finalManifest).to.have.property(field);
      expect(finalManifest[field as keyof typeof finalManifest]).not.to.equal(undefined);
    }
    expect(() => validatePublishedDeploymentManifest({
      ...finalManifest,
      verificationUrl: "https://attacker.invalid/fake",
    })).to.throw("canonical Sourcify v2 lookup");
    expect(() => validatePublishedDeploymentManifest({ ...finalManifest, confirmations: 11 }))
      .to.throw("at least 12");
  });

  it("structurally binds the SDK ABI", function () {
    const approvedAbi = [{
      type: "function",
      name: "getClaim",
      stateMutability: "view",
      inputs: [{ name: "claimId", type: "bytes32" }],
      outputs: [],
    }];
    expect(validateSdkAbi([{
      outputs: [],
      inputs: [{ type: "bytes32", name: "claimId" }],
      stateMutability: "view",
      name: "getClaim",
      type: "function",
    }], approvedAbi)).to.have.length(1);
    expect(() => validateSdkAbi([{ ...approvedAbi[0], name: "getObligation" }], approvedAbi))
      .to.throw("does not structurally match");
  });

  it("uses a durable exclusive intent and prints recovery data before the post-broadcast journal update", async function () {
    const root = await mkdtemp(join(tmpdir(), "nakama-deployment-journal-"));
    try {
      const journalPath = join(root, "broadcast.json");
      await createDeploymentIntent(journalPath, { status: "intent" });
      expect((await readFile(journalPath, "utf8")).trim()).to.not.equal("");
      await expect(createDeploymentIntent(journalPath, { status: "second" })).to.be.rejected;
      await replaceDeploymentJournal(journalPath, { status: "broadcast", transaction: "0x1234" });
      expect(JSON.parse(await readFile(journalPath, "utf8")).status).to.equal("broadcast");

      const zeroBytePath = join(root, "zero.json");
      await writeFile(zeroBytePath, "");
      await expect(assertPathAbsent(zeroBytePath)).to.be.rejectedWith("unreconciled operator state");
      const directoryPath = join(root, "directory.json");
      await mkdir(directoryPath);
      await expect(assertPathAbsent(directoryPath)).to.be.rejectedWith("unreconciled operator state");

      const blockedTempPath = `${journalPath}.tmp-${process.pid}`;
      await mkdir(blockedTempPath);
      await expect(replaceDeploymentJournal(journalPath, { status: "replacement" })).to.be.rejected;
      expect(JSON.parse(await readFile(journalPath, "utf8")).status).to.equal("broadcast");

      const deployScript = await readFile("scripts/deploy_ethereum_mainnet.ts", "utf8");
      expect(deployScript.indexOf("createDeploymentIntent")).to.be.lessThan(deployScript.indexOf("factory.deploy"));
      expect(deployScript.indexOf("console.error(`[ethereum-mainnet:broadcast]")).to.be.lessThan(
        deployScript.indexOf("replaceDeploymentJournal(broadcastPath"),
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
