import { expect } from "chai";
import { createHash } from "node:crypto";

import {
  ROBINHOOD_MAINNET_CAIP2,
  ROBINHOOD_MAINNET_CHAIN_ID,
  ROBINHOOD_MAINNET_USDG,
  buildRobinhoodMainnetDryRunPlan,
  loadRobinhoodMainnetPlanningInputs,
  parseRobinhoodMainnetPlanArgs,
} from "../../../scripts/plan_robinhood_mainnet.mjs";

const address = (suffix: string) => `0x${suffix.padStart(40, "0")}`;

function config() {
  return {
    suiteId: `0x${"11".repeat(32)}`,
    suiteVersion: { major: 1, minor: 0, patch: 0 },
    salt: `0x${"22".repeat(32)}`,
    templateCommitment: `0x${"33".repeat(32)}`,
    reviewCommitment: `0x${"44".repeat(32)}`,
    governanceAuthority: address("88"),
    roles: {
      sponsor: address("11"),
      operator: address("22"),
      initialReviewer: address("33"),
      appealReviewer: address("44"),
      settlement: address("55"),
      guardian: address("66"),
      eligibilityAttestor: address("77"),
    },
    programConfig: {
      sponsorLegalEntityCommitment: `0x${"55".repeat(32)}`,
      metadataCommitment: `0x${"66".repeat(32)}`,
      termsCommitment: `0x${"77".repeat(32)}`,
      privacyCommitment: `0x${"88".repeat(32)}`,
      operationsCommitment: `0x${"99".repeat(32)}`,
      activationChecklistCommitment: `0x${"aa".repeat(32)}`,
      enrollmentOpensAt: "1800000000",
      activeAt: "1800003600",
      runoffAt: "1800864000",
      closesAt: "1801728000",
      appealWindow: "604800",
      initialDecisionWindow: "172800",
      appealDecisionWindow: "172800",
      perMemberCap: "1000000000",
      aggregateCap: "5000000000",
      maxMembers: "5",
    },
  };
}

function evidence(artifactRaw: string) {
  const artifact = JSON.parse(artifactRaw);
  return {
    schemaVersion: 1,
    status: "approved-for-dry-run",
    chainId: ROBINHOOD_MAINNET_CHAIN_ID,
    caip2: ROBINHOOD_MAINNET_CAIP2,
    sourceCommit: artifact.sourceCommit,
    protocolArtifactSha256: createHash("sha256")
      .update(artifactRaw)
      .digest("hex"),
    deploymentCodeCommitment: artifact.deploymentPlan.deploymentCodeCommitment,
    expectedDeployer: config().roles.sponsor,
    expectedDeployerNonce: "42",
    usdG: {
      address: ROBINHOOD_MAINNET_USDG,
      runtimeCodeHash: `0x${"88".repeat(32)}`,
      verificationUrl: "https://example.invalid/usdg-evidence",
    },
    audit: {
      reportSha256: "d".repeat(64),
      reviewer: address("81"),
    },
    releaseApproval: {
      recordSha256: "e".repeat(64),
      approver: address("82"),
    },
    legalApproval: {
      recordSha256: "f".repeat(64),
      approver: address("83"),
    },
  };
}

describe("Robinhood mainnet offline planning", function () {
  it("produces a deterministic non-broadcast plan from exact release evidence", async function () {
    const inputs = await loadRobinhoodMainnetPlanningInputs();
    const plan = buildRobinhoodMainnetDryRunPlan({
      ...inputs,
      config: config(),
      evidence: evidence(inputs.artifactRaw),
    });

    expect(plan.mode).to.equal("dry-run");
    expect(plan.broadcast).to.equal(false);
    expect(plan.chainId).to.equal(4663);
    expect(plan.caip2).to.equal("eip155:4663");
    expect(plan.usdG.address).to.equal(ROBINHOOD_MAINNET_USDG);
    expect(plan.transactionPlan).to.have.length(8);
    expect(
      plan.transactionPlan.map((entry: { nonce: string }) => entry.nonce)
    ).to.deep.equal(["42", "43", "44", "45", "46", "47", "48", "49"]);
    expect(plan.authorityHandoff).to.equal(
      "requires-two-deployer-begin-transactions-and-two-governance-acceptance-transactions"
    );
    const predicted = Object.values(plan.addresses);
    expect(predicted).to.have.length(13);
    expect(
      new Set(predicted.map((value) => value.toLowerCase())).size
    ).to.equal(predicted.length);
    expect(plan.remainingExternalGates).to.have.length.greaterThan(4);
  });

  it("rejects mismatched artifacts, approval identities, and canonical USDG substitutions", async function () {
    const inputs = await loadRobinhoodMainnetPlanningInputs();
    const release = evidence(inputs.artifactRaw);
    const build = (changed: unknown) =>
      buildRobinhoodMainnetDryRunPlan({
        ...inputs,
        config: config(),
        evidence: changed,
      });

    expect(() =>
      build({ ...release, protocolArtifactSha256: "a".repeat(64) })
    ).to.throw("does not match the canonical dry-run target");
    expect(() =>
      build({
        ...release,
        releaseApproval: {
          ...release.releaseApproval,
          approver: release.audit.reviewer,
        },
      })
    ).to.throw("must be distinct");
    expect(() =>
      build({
        ...release,
        usdG: { ...release.usdG, address: address("999") },
      })
    ).to.throw("canonical address");
  });

  it("has no broadcast CLI mode and requires both operator-local inputs", function () {
    expect(() =>
      parseRobinhoodMainnetPlanArgs([
        "--config",
        "config.json",
        "--evidence",
        "evidence.json",
        "--broadcast",
      ])
    ).to.throw("--broadcast is forbidden");
    expect(() =>
      parseRobinhoodMainnetPlanArgs(["--config", "config.json"])
    ).to.throw("Both --config and --evidence are required");
  });
});
