import { expect } from "chai";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { keccak256 } from "ethers";

import {
  EIP170_RUNTIME_LIMIT,
  REQUIRED_DEPLOYMENT_CONFIRMATION,
  validateDeploymentEnvironment,
  validateDeploymentRuntime,
  validateReleaseManifest,
  validateSourceCheckout,
} from "../../scripts/lib/ethereum_deploy_guard.mjs";
import { runReleasePreflight } from "../../scripts/lib/ethereum_release_preflight.mjs";
import {
  buildPublishedDeploymentManifest,
  validateIntermediateDeployment,
  validatePublishedDeploymentManifest,
  validateSdkAbi,
  validateSourceVerificationEvidence,
} from "../../scripts/lib/ethereum_manifest_promotion.mjs";

const execFileAsync = promisify(execFile);

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

  it("refuses missing confirmation, local RPC, development keys, and shallow confirmation depth", function () {
    expect(() =>
      validateDeploymentEnvironment({ ...safeEnvironment, NAKAMA_MAINNET_DEPLOY_CONFIRMATION: "yes" }),
    ).to.throw("confirmation phrase");
    expect(() =>
      validateDeploymentEnvironment({ ...safeEnvironment, ETHEREUM_MAINNET_RPC_URL: "http://127.0.0.1:8545" }),
    ).to.throw("must use https");
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
      validateSourceCheckout(config, {
        headCommit: "d".repeat(40),
        statusPorcelain: "",
      }),
    ).to.throw("does not match the current git HEAD");
    expect(() =>
      validateSourceCheckout(config, {
        headCommit: config.sourceCommit,
        statusPorcelain: " M contracts/NakamaCoverageProtocol.sol\n",
      }),
    ).to.throw("completely clean worktree");
    expect(
      validateSourceCheckout(config, {
        headCommit: config.sourceCommit,
        statusPorcelain: "",
      }).headCommit,
    ).to.equal(config.sourceCommit);
  });

  it("requires an approved release manifest bound to audit, approval, and artifacts", function () {
    const config = validateDeploymentEnvironment(safeEnvironment);
    const artifacts = {
      protocolRuntimeBytecodeHash: `0x${"12".repeat(32)}`,
      protocolArtifactSha256: "d".repeat(64),
    };
    const approvedManifest = {
      schemaVersion: 1,
      status: "approved-for-mainnet",
      sourceCommit: config.sourceCommit,
      auditReportSha256: config.auditReportSha256,
      releaseApprovalSha256: config.releaseApprovalSha256,
      protocolRuntimeBytecodeHash: artifacts.protocolRuntimeBytecodeHash,
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
        { ...approvedManifest, auditReportSha256: "e".repeat(64) },
        artifacts,
      ),
    ).to.throw("audit digest");
    expect(() =>
      validateReleaseManifest(
        config,
        { ...approvedManifest, protocolRuntimeBytecodeHash: `0x${"34".repeat(32)}` },
        artifacts,
      ),
    ).to.throw("runtime bytecode hash");
    expect(validateReleaseManifest(config, approvedManifest, artifacts)).to.equal(approvedManifest);
  });

  it("accepts a reviewed, ignored release manifest bound to an already committed source HEAD", async function () {
    const root = await mkdtemp(join(tmpdir(), "nakama-ethereum-release-"));
    try {
      const hardhatArtifactDirectory = join(
        root,
        "artifacts/hardhat/contracts/NakamaCoverageProtocol.sol",
      );
      const sharedArtifactDirectory = join(root, "shared/ethereum");
      const deploymentDirectory = join(root, "deployments");
      await Promise.all([
        mkdir(hardhatArtifactDirectory, { recursive: true }),
        mkdir(sharedArtifactDirectory, { recursive: true }),
        mkdir(deploymentDirectory, { recursive: true }),
      ]);

      const deployedBytecode = "0x6000";
      const runtimeBytecodeHash = keccak256(deployedBytecode);
      const protocolAbiRaw = "[]\n";
      const protocolAbiSha256 = createHash("sha256").update(protocolAbiRaw).digest("hex");
      const protocolArtifactRaw = `${JSON.stringify(
        {
          schemaVersion: 1,
          contracts: {
            NakamaCoverageProtocol: {
              abi: [],
              abiSha256: protocolAbiSha256,
              runtimeBytecodeHash,
            },
          },
        },
        null,
        2,
      )}\n`;
      const protocolArtifactSha256 = createHash("sha256").update(protocolArtifactRaw).digest("hex");

      await Promise.all([
        writeFile(
          join(hardhatArtifactDirectory, "NakamaCoverageProtocol.json"),
          `${JSON.stringify({ deployedBytecode })}\n`,
        ),
        writeFile(join(sharedArtifactDirectory, "protocol_contract.json"), protocolArtifactRaw),
        writeFile(join(sharedArtifactDirectory, "NakamaCoverageProtocol.abi.json"), protocolAbiRaw),
        writeFile(
          join(root, ".gitignore"),
          "deployments/ethereum-mainnet.release.json\n",
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
        { cwd: root },
      );
      const { stdout: sourceCommitRaw } = await execFileAsync("git", ["rev-parse", "HEAD"], {
        cwd: root,
      });
      const sourceCommit = sourceCommitRaw.trim();
      const config = validateDeploymentEnvironment({
        ...safeEnvironment,
        NAKAMA_MAINNET_SOURCE_COMMIT: sourceCommit,
      });
      const releaseManifest = {
        schemaVersion: 1,
        status: "approved-for-mainnet",
        sourceCommit,
        auditReportSha256: config.auditReportSha256,
        releaseApprovalSha256: config.releaseApprovalSha256,
        protocolRuntimeBytecodeHash: runtimeBytecodeHash,
        protocolArtifactSha256,
        independentAuditCompleted: true,
        releaseApproved: true,
      };
      await writeFile(
        join(deploymentDirectory, "ethereum-mainnet.release.json"),
        `${JSON.stringify(releaseManifest, null, 2)}\n`,
      );

      const { stdout: statusPorcelain } = await execFileAsync(
        "git",
        ["status", "--porcelain=v1", "--untracked-files=all"],
        { cwd: root },
      );
      expect(statusPorcelain).to.equal("");
      const result = await runReleasePreflight(config, root);
      expect(result.headCommit).to.equal(sourceCommit);
      expect(result.protocolRuntimeBytecodeHash).to.equal(runtimeBytecodeHash);
      expect(result.protocolArtifactSha256).to.equal(protocolArtifactSha256);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("promotes only an audited intermediate receipt with matching source-verification evidence", function () {
    const runtimeBytecodeHash = `0x${"12".repeat(32)}`;
    const protocolArtifactSha256 = "d".repeat(64);
    const release = {
      headCommit: safeEnvironment.NAKAMA_MAINNET_SOURCE_COMMIT,
      protocolRuntimeBytecodeHash: runtimeBytecodeHash,
      protocolArtifactSha256,
      releaseManifest: {
        auditReportSha256: safeEnvironment.NAKAMA_MAINNET_AUDIT_REPORT_SHA256,
        releaseApprovalSha256: safeEnvironment.NAKAMA_MAINNET_RELEASE_APPROVAL_SHA256,
      },
    };
    const intermediate = validateIntermediateDeployment(
      {
        schemaVersion: 1,
        status: "deployed-unverified",
        chainId: 1,
        caip2: "eip155:1",
        contractName: "NakamaCoverageProtocol",
        protocolAddress: "0x00000000000000000000000000000000000000a2",
        deployer: expectedDeployer,
        deploymentTransaction: `0x${"34".repeat(32)}`,
        deploymentBlock: 22_000_000,
        confirmations: 12,
        sourceCommit: release.headCommit,
        auditReportSha256: release.releaseManifest.auditReportSha256,
        releaseApprovalSha256: release.releaseManifest.releaseApprovalSha256,
        protocolArtifactSha256,
        runtimeBytecodeHash,
        abiArtifact: "shared/ethereum/protocol_contract.json",
        verified: false,
        auditStatus: "audited",
      },
      release,
    );
    const evidence = validateSourceVerificationEvidence(
      {
        schemaVersion: 1,
        status: "verified",
        chainId: 1,
        caip2: "eip155:1",
        contractName: "NakamaCoverageProtocol",
        protocolAddress: intermediate.protocolAddress,
        deploymentTransaction: intermediate.deploymentTransaction,
        sourceCommit: intermediate.sourceCommit,
        runtimeBytecodeHash,
        verificationProvider: "sourcify",
        verificationUrl: "https://repo.sourcify.dev/contracts/full_match/1/example/",
        verifiedAt: "2026-07-19T00:00:00.000Z",
      },
      intermediate,
    );
    const finalManifest = buildPublishedDeploymentManifest(intermediate, evidence, {
      abiSha256: "e".repeat(64),
      verificationEvidenceSha256: "f".repeat(64),
    });

    expect(validatePublishedDeploymentManifest(finalManifest)).to.equal(finalManifest);
    expect(finalManifest.status).to.equal("deployed");
    expect(finalManifest.abiArtifact).to.equal(
      "contracts/ethereum/NakamaCoverageProtocol.abi.json",
    );
    expect(finalManifest.verified).to.equal(true);
    expect(finalManifest.auditStatus).to.equal("audited");
    expect(() =>
      validateSourceVerificationEvidence(
        { ...evidence, runtimeBytecodeHash: `0x${"56".repeat(32)}` },
        intermediate,
      ),
    ).to.throw("runtime hash does not match");
    expect(() =>
      validatePublishedDeploymentManifest({ ...finalManifest, confirmations: 11 }),
    ).to.throw("at least 12");
    const approvedAbi = [
      {
        type: "function",
        name: "getClaim",
        stateMutability: "view",
        inputs: [{ name: "claimId", type: "bytes32" }],
        outputs: [],
      },
    ];
    expect(
      validateSdkAbi(
        [
          {
            outputs: [],
            inputs: [{ type: "bytes32", name: "claimId" }],
            stateMutability: "view",
            name: "getClaim",
            type: "function",
          },
        ],
        approvedAbi,
      ),
    ).to.have.length(1);
    expect(() =>
      validateSdkAbi(
        [{ ...approvedAbi[0], name: "getObligation" }],
        approvedAbi,
      ),
    ).to.throw("does not structurally match");
  });
});
