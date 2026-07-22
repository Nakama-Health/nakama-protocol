import { expect } from "chai";
import { network } from "hardhat";

const { ethers, networkHelpers } = await network.create();

const DAY = 86_400n;
const USDG = 1_000_000n;
const PER_MEMBER_CAP = 1_000n * USDG;
const AGGREGATE_CAP = 5_000n * USDG;
const suiteId = ethers.id("NAKAMA_ROBINHOOD_PHASE0_2.0.0");
const commitment = (value: string) =>
  ethers.keccak256(ethers.toUtf8Bytes(value));

const componentNames = [
  "ProtectionProgram",
  "PoolVault",
  "MembershipRegistry",
  "DecisionModule",
  "ClaimManager",
  "SettlementModule",
  "AgentAuthorizationRegistry",
  "SafetyGuardian",
] as const;

async function componentBytecodes() {
  const values = await Promise.all(
    componentNames.map(
      async (name) => (await ethers.getContractFactory(name)).bytecode
    )
  );
  return {
    protectionProgram: values[0],
    poolVault: values[1],
    membershipRegistry: values[2],
    decisionModule: values[3],
    claimManager: values[4],
    settlementModule: values[5],
    agentAuthorizationRegistry: values[6],
    safetyGuardian: values[7],
  };
}

async function deployFixture({
  smartReviewer = false,
  smartEligibilityAttestor = false,
  feeToken = false,
  senderFeeToken = false,
  fixtureLabel = "base",
} = {}) {
  const [
    governance,
    sponsor,
    operator,
    reviewerOwner,
    appealReviewer,
    settlement,
    guardian,
    eligibilityAttestor,
    member,
    memberTwo,
    payoutRecipient,
    outsider,
  ] = await ethers.getSigners();

  if (feeToken && senderFeeToken) {
    throw new Error("Only one adversarial funding-token mode may be selected.");
  }
  const token = feeToken
    ? await ethers.deployContract("FeeOnTransferUSDG")
    : senderFeeToken
    ? await ethers.deployContract("SenderFeeUSDG")
    : await ethers.deployContract("MockUSDG");
  const reviewerContract = smartReviewer
    ? await ethers.deployContract("MockERC1271Reviewer", [
        reviewerOwner.address,
      ])
    : null;
  const reviewer = reviewerContract
    ? await reviewerContract.getAddress()
    : reviewerOwner.address;
  const eligibilityAttestorContract = smartEligibilityAttestor
    ? await ethers.deployContract("MockERC1271Reviewer", [
        eligibilityAttestor.address,
      ])
    : null;
  const eligibilityAttestorRole = eligibilityAttestorContract
    ? await eligibilityAttestorContract.getAddress()
    : eligibilityAttestor.address;

  const assetRegistry = await ethers.deployContract("AssetRegistry", [
    governance.address,
  ]);
  const templateRegistry = await ethers.deployContract("TemplateRegistry", [
    governance.address,
  ]);
  await assetRegistry
    .connect(governance)
    .registerAsset(
      await token.getAddress(),
      commitment("USDG:ROBINHOOD"),
      commitment("Global Dollar"),
      commitment("USDG")
    );

  const bytecodes = await componentBytecodes();
  const hashes = Object.values(bytecodes).map((bytecode) =>
    ethers.keccak256(bytecode)
  );
  const factory = await ethers.deployContract("NakamaFactory", [
    await assetRegistry.getAddress(),
    await templateRegistry.getAddress(),
    await token.getAddress(),
    hashes,
  ]);
  await templateRegistry
    .connect(governance)
    .registerSuite(
      suiteId,
      await factory.getAddress(),
      2,
      0,
      0,
      await factory.deploymentCodeCommitment(),
      commitment("phase0-template"),
      commitment("phase0-review")
    );

  const now = BigInt(await networkHelpers.time.latest());
  const config = {
    sponsorLegalEntityCommitment: commitment("sponsor-legal-entity"),
    metadataCommitment: commitment("public-metadata"),
    termsCommitment: commitment("terms-v1"),
    privacyCommitment: commitment("privacy-v1"),
    operationsCommitment: commitment("operations-v1"),
    activationChecklistCommitment: commitment("activation-checklist-v1"),
    fundingAsset: await token.getAddress(),
    enrollmentOpensAt: now + 10n,
    activeAt: now + 100n,
    runoffAt: now + 2n * DAY,
    closesAt: now + 4n * DAY,
    appealWindow: 600n,
    initialDecisionWindow: 300n,
    appealDecisionWindow: 300n,
    perMemberCap: PER_MEMBER_CAP,
    aggregateCap: AGGREGATE_CAP,
    maxMembers: 5,
  };
  const roles = {
    sponsor: sponsor.address,
    operator: operator.address,
    initialReviewer: reviewer,
    appealReviewer: appealReviewer.address,
    settlement: settlement.address,
    guardian: guardian.address,
    eligibilityAttestor: eligibilityAttestorRole,
  };
  const salt = commitment(
    `program-${fixtureLabel}-${
      smartReviewer ? "1271-reviewer" : "eoa-reviewer"
    }-${smartEligibilityAttestor ? "1271-attestor" : "eoa-attestor"}-${
      feeToken ? "fee" : senderFeeToken ? "sender-fee" : "exact"
    }`
  );
  const predicted = await factory.predictDeployment(
    suiteId,
    salt,
    config,
    roles,
    bytecodes
  );
  await factory
    .connect(sponsor)
    .deployProgram(suiteId, salt, config, roles, bytecodes, {
      gasLimit: 16_000_000,
    });

  const program = await ethers.getContractAt(
    "ProtectionProgram",
    predicted.program
  );
  const vault = await ethers.getContractAt("PoolVault", predicted.vault);
  const membership = await ethers.getContractAt(
    "MembershipRegistry",
    predicted.membershipRegistry
  );
  const decisions = await ethers.getContractAt(
    "DecisionModule",
    predicted.decisionModule
  );
  const claims = await ethers.getContractAt(
    "ClaimManager",
    predicted.claimManager
  );
  const settlements = await ethers.getContractAt(
    "SettlementModule",
    predicted.settlementModule
  );
  const authorizations = await ethers.getContractAt(
    "AgentAuthorizationRegistry",
    predicted.agentAuthorizationRegistry
  );
  const safety = await ethers.getContractAt(
    "SafetyGuardian",
    predicted.safetyGuardian
  );

  return {
    governance,
    sponsor,
    operator,
    reviewerOwner,
    reviewer,
    reviewerContract,
    appealReviewer,
    settlement,
    guardian,
    eligibilityAttestor,
    eligibilityAttestorContract,
    member,
    memberTwo,
    payoutRecipient,
    outsider,
    token,
    assetRegistry,
    templateRegistry,
    factory,
    bytecodes,
    config,
    roles,
    salt,
    predicted,
    program,
    vault,
    membership,
    decisions,
    claims,
    settlements,
    authorizations,
    safety,
  };
}

type Fixture = Awaited<ReturnType<typeof deployFixture>>;

async function fundAndOpenEnrollment(fixture: Fixture) {
  await fixture.program.connect(fixture.operator).markReviewed();
  await fixture.token.mint(fixture.sponsor.address, AGGREGATE_CAP);
  await fixture.token
    .connect(fixture.sponsor)
    .approve(await fixture.vault.getAddress(), AGGREGATE_CAP);
  await fixture.vault
    .connect(fixture.sponsor)
    .fund(AGGREGATE_CAP, commitment("sponsor-funding"));
  await fixture.program.markFunded();
  await fixture.program.connect(fixture.sponsor).approveActivationAsSponsor();
  await fixture.program.connect(fixture.operator).approveActivationAsOperator();
  const now = BigInt(await networkHelpers.time.latest());
  if (now < fixture.config.enrollmentOpensAt) {
    await networkHelpers.time.increaseTo(fixture.config.enrollmentOpensAt);
  }
  await fixture.program.openEnrollment();
}

async function activateMember(
  fixture: Fixture,
  member = fixture.member,
  label = "member-one",
  nonce = 0n
) {
  const { eligibility, signature } = await signedEligibility(
    fixture,
    member,
    label,
    { nonce }
  );
  const membershipId = await fixture.membership.deriveMembershipId(
    eligibility.memberCommitment
  );
  await fixture.membership
    .connect(member)
    .activateMembership(eligibility, signature);
  return membershipId;
}

async function signedEligibility(
  fixture: Fixture,
  member: Fixture["member"],
  label: string,
  options: { nonce?: bigint; validUntil?: bigint } = {}
) {
  const memberCommitment = commitment(label);
  const eligibility = {
    programId: fixture.predicted.programId,
    memberCommitment,
    account: member.address,
    termsCommitment: fixture.config.termsCommitment,
    privacyCommitment: fixture.config.privacyCommitment,
    nonce: options.nonce ?? 0n,
    validUntil: options.validUntil ?? fixture.config.activeAt,
  };
  const chainId = (await ethers.provider.getNetwork()).chainId;
  const signature = await fixture.eligibilityAttestor.signTypedData(
    {
      name: "Nakama Membership Eligibility",
      version: "1",
      chainId,
      verifyingContract: await fixture.membership.getAddress(),
    },
    {
      Eligibility: [
        { name: "programId", type: "bytes32" },
        { name: "memberCommitment", type: "bytes32" },
        { name: "account", type: "address" },
        { name: "termsCommitment", type: "bytes32" },
        { name: "privacyCommitment", type: "bytes32" },
        { name: "nonce", type: "uint256" },
        { name: "validUntil", type: "uint64" },
      ],
    },
    eligibility
  );
  return { eligibility, signature };
}

async function signedEligibilityRevocation(
  fixture: Fixture,
  eligibility: Awaited<ReturnType<typeof signedEligibility>>["eligibility"],
  options: {
    nonce?: bigint;
    validUntil?: bigint;
    signer?: Fixture["eligibilityAttestor"];
  } = {}
) {
  const authorizationDigest = await fixture.membership.hashEligibility(
    eligibility
  );
  const revocation = {
    programId: fixture.predicted.programId,
    authorizationDigest,
    nonce:
      options.nonce ?? (await fixture.membership.eligibilityRevocationNonce()),
    validUntil:
      options.validUntil ?? BigInt(await networkHelpers.time.latest()) + 600n,
  };
  const signature = await (
    options.signer ?? fixture.eligibilityAttestor
  ).signTypedData(
    {
      name: "Nakama Membership Eligibility",
      version: "1",
      chainId: (await ethers.provider.getNetwork()).chainId,
      verifyingContract: await fixture.membership.getAddress(),
    },
    {
      EligibilityRevocation: [
        { name: "programId", type: "bytes32" },
        { name: "authorizationDigest", type: "bytes32" },
        { name: "nonce", type: "uint256" },
        { name: "validUntil", type: "uint64" },
      ],
    },
    revocation
  );
  return { authorizationDigest, revocation, signature };
}

async function activateProgram(fixture: Fixture) {
  const now = BigInt(await networkHelpers.time.latest());
  if (now < fixture.config.activeAt) {
    await networkHelpers.time.increaseTo(fixture.config.activeAt);
  }
  await fixture.program.activate();
}

async function openRequest(
  fixture: Fixture,
  membershipId: string,
  member = fixture.member,
  label = "request-one",
  requestedAmount = 400n * USDG
) {
  const requestId = await fixture.claims.deriveRequestId(
    membershipId,
    await fixture.claims.requestNonce(membershipId)
  );
  const recipientSalt = commitment(`${label}-recipient-salt`);
  const recipientCommitment = await fixture.claims.recipientCommitment(
    requestId,
    fixture.payoutRecipient.address,
    recipientSalt
  );
  await fixture.claims
    .connect(member)
    .openRequest(
      membershipId,
      commitment(`${label}-evidence`),
      recipientCommitment,
      requestedAmount
    );
  return { requestId, recipientSalt, requestedAmount };
}

async function signedDecision(
  fixture: Fixture,
  requestId: string,
  {
    round = 1,
    action = 2,
    amount = 400n * USDG,
    signer = fixture.reviewerOwner,
  } = {}
) {
  const request = await fixture.claims.request(requestId);
  const signerAddress =
    round === 1 ? fixture.reviewer : fixture.appealReviewer.address;
  const nonce = await fixture.decisions.nonces(signerAddress);
  const decision = {
    programId: fixture.predicted.programId,
    requestId,
    termsCommitment: fixture.config.termsCommitment,
    evidenceManifestCommitment: request.evidenceManifestCommitment,
    evidenceVersion: request.evidenceVersion,
    reviewRound: round,
    reviewerRole: round,
    action,
    approvedAmount: action === 2 ? amount : 0n,
    recipientCommitment:
      action === 2 ? request.recipientCommitment : ethers.ZeroHash,
    publicReasonCode: commitment(
      action === 2 ? "APPROVED_WITHIN_TERMS" : "OUTSIDE_NAMED_SCOPE"
    ),
    nonce,
    validUntil: BigInt(await networkHelpers.time.latest()) + 600n,
  };
  const signature = await signDecisionPayload(fixture, decision, signer);
  return { decision, signature };
}

async function signDecisionPayload(
  fixture: Fixture,
  decision: Record<string, unknown>,
  signer: Fixture["reviewerOwner"]
) {
  const chainId = (await ethers.provider.getNetwork()).chainId;
  return signer.signTypedData(
    {
      name: "Nakama Protection Decision",
      version: "1",
      chainId,
      verifyingContract: await fixture.decisions.getAddress(),
    },
    {
      Decision: [
        { name: "programId", type: "bytes32" },
        { name: "requestId", type: "bytes32" },
        { name: "termsCommitment", type: "bytes32" },
        { name: "evidenceManifestCommitment", type: "bytes32" },
        { name: "evidenceVersion", type: "uint32" },
        { name: "reviewRound", type: "uint8" },
        { name: "reviewerRole", type: "uint8" },
        { name: "action", type: "uint8" },
        { name: "approvedAmount", type: "uint256" },
        { name: "recipientCommitment", type: "bytes32" },
        { name: "publicReasonCode", type: "bytes32" },
        { name: "nonce", type: "uint256" },
        { name: "validUntil", type: "uint64" },
      ],
    },
    decision
  );
}

function seededUint32(seed: number) {
  let state = seed >>> 0;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return state >>> 0;
  };
}

async function assertVaultInvariants(
  fixture: Fixture,
  membershipIds: readonly string[],
  requestIds: readonly string[],
  expectedUnaccounted = 0n
) {
  const [accounting, actual, tracked, encumbered, freeLiquidity] =
    await Promise.all([
      fixture.vault.accounting(),
      fixture.vault.actualAssets(),
      fixture.vault.trackedAssets(),
      fixture.vault.encumberedAssets(),
      fixture.vault.freeLiquidity(),
    ]);
  const memberRemaining = await Promise.all(
    membershipIds.map((membershipId) =>
      fixture.vault.memberRemaining(membershipId)
    )
  );
  const pending = await Promise.all(
    requestIds.map((requestId) => fixture.vault.pendingReservation(requestId))
  );
  const obligations = await Promise.all(
    requestIds.map((requestId) => fixture.vault.obligationAmount(requestId))
  );
  const sum = (values: readonly bigint[]) =>
    values.reduce((total, value) => total + value, 0n);

  expect(tracked).to.equal(
    accounting.sponsorFunded - accounting.settled - accounting.sponsorRefunded
  );
  expect(encumbered).to.equal(
    accounting.maximumRemainingMemberLiability +
      accounting.approvedUnpaidObligations +
      accounting.maturedRefunds
  );
  expect(freeLiquidity).to.equal(tracked - encumbered);
  expect(accounting.maximumRemainingMemberLiability).to.equal(
    sum(memberRemaining)
  );
  expect(accounting.pendingRequestReservation).to.equal(sum(pending));
  expect(accounting.approvedUnpaidObligations).to.equal(sum(obligations));
  expect(accounting.pendingRequestReservation).to.be.lessThanOrEqual(
    accounting.maximumRemainingMemberLiability
  );
  expect(actual).to.equal(tracked + expectedUnaccounted);
  expect(actual).to.be.greaterThanOrEqual(tracked);
  expect(tracked).to.be.greaterThanOrEqual(encumbered);
  expect(await fixture.vault.reconciled()).to.equal(true);
}

async function assertEconomicEventReplay(fixture: Fixture) {
  const logs = await fixture.vault.queryFilter(
    fixture.vault.filters.EconomicActivity()
  );
  const state = {
    sponsorFunded: 0n,
    settled: 0n,
    sponsorRefunded: 0n,
    maximumRemainingMemberLiability: 0n,
    pendingRequestReservation: 0n,
    approvedUnpaidObligations: 0n,
    maturedRefunds: 0n,
  };
  const memberRemaining = new Map<string, bigint>();
  const pending = new Map<string, bigint>();
  const obligations = new Map<string, bigint>();
  const kinds: number[] = [];

  for (const log of logs) {
    if (!("args" in log))
      throw new Error("EconomicActivity log was not decoded.");
    const args = log.args;
    const kind = Number(args.kind);
    const amount = args.amount as bigint;
    const activityId = args.activityId as string;
    const relatedId = args.relatedId as string;
    kinds.push(kind);

    expect(args.programId).to.equal(fixture.predicted.programId);
    expect(args.asset).to.equal(await fixture.token.getAddress());
    expect(args.actor).not.to.equal(ethers.ZeroAddress);
    expect(activityId).not.to.equal(ethers.ZeroHash);

    if (kind === 1) {
      state.sponsorFunded += amount;
    } else if (kind === 2) {
      memberRemaining.set(activityId, amount);
      state.maximumRemainingMemberLiability += amount;
    } else if (kind === 3) {
      memberRemaining.set(
        activityId,
        (memberRemaining.get(activityId) ?? 0n) + amount
      );
      state.maximumRemainingMemberLiability += amount;
    } else if (kind === 4) {
      pending.set(activityId, amount);
      state.pendingRequestReservation += amount;
    } else if (kind === 5) {
      expect(relatedId).not.to.equal(ethers.ZeroHash);
      const reserved = pending.get(activityId);
      expect(reserved).to.equal(-amount);
      pending.delete(activityId);
      state.pendingRequestReservation += amount;
    } else if (kind === 6) {
      expect(relatedId).not.to.equal(ethers.ZeroHash);
      const reserved = pending.get(activityId);
      if (reserved === undefined) {
        throw new Error(`Missing pending reservation for ${activityId}.`);
      }
      pending.delete(activityId);
      state.pendingRequestReservation -= reserved;
      memberRemaining.set(
        relatedId,
        (memberRemaining.get(relatedId) ?? 0n) - amount
      );
      state.maximumRemainingMemberLiability -= amount;
      obligations.set(activityId, amount);
      state.approvedUnpaidObligations += amount;
    } else if (kind === 7) {
      const obligation = obligations.get(activityId);
      expect(obligation).to.equal(-amount);
      obligations.delete(activityId);
      state.approvedUnpaidObligations += amount;
      state.settled -= amount;
    } else if (kind === 8) {
      state.maturedRefunds += amount;
    } else if (kind === 9) {
      state.maturedRefunds += amount;
      state.sponsorRefunded -= amount;
    } else {
      throw new Error(`Unknown EconomicActivity kind ${kind}.`);
    }

    const trackedAssets =
      state.sponsorFunded - state.settled - state.sponsorRefunded;
    const encumberedAssets =
      state.maximumRemainingMemberLiability +
      state.approvedUnpaidObligations +
      state.maturedRefunds;
    expect(args.sponsorFunded).to.equal(state.sponsorFunded);
    expect(args.settled).to.equal(state.settled);
    expect(args.sponsorRefunded).to.equal(state.sponsorRefunded);
    expect(args.maximumRemainingMemberLiability).to.equal(
      state.maximumRemainingMemberLiability
    );
    expect(args.pendingRequestReservation).to.equal(
      state.pendingRequestReservation
    );
    expect(args.approvedUnpaidObligations).to.equal(
      state.approvedUnpaidObligations
    );
    expect(args.maturedRefunds).to.equal(state.maturedRefunds);
    expect(args.trackedAssets).to.equal(trackedAssets);
    expect(args.encumberedAssets).to.equal(encumberedAssets);
  }

  expect(new Set(kinds)).to.deep.equal(new Set([1, 2, 3, 4, 5, 6, 7, 8, 9]));
  expect(pending.size).to.equal(0);
  expect(obligations.size).to.equal(0);
  const accounting = await fixture.vault.accounting();
  expect(accounting.sponsorFunded).to.equal(state.sponsorFunded);
  expect(accounting.settled).to.equal(state.settled);
  expect(accounting.sponsorRefunded).to.equal(state.sponsorRefunded);
  expect(accounting.maximumRemainingMemberLiability).to.equal(
    state.maximumRemainingMemberLiability
  );
  expect(accounting.pendingRequestReservation).to.equal(
    state.pendingRequestReservation
  );
  expect(accounting.approvedUnpaidObligations).to.equal(
    state.approvedUnpaidObligations
  );
  expect(accounting.maturedRefunds).to.equal(state.maturedRefunds);
}

describe("Robinhood Phase 0 protocol", function () {
  it("deploys deterministic immutable modules and registers the suite", async function () {
    const fixture = await networkHelpers.loadFixture(deployFixture);
    const registered = await (
      await ethers.getContractAt(
        "PoolRegistry",
        await fixture.factory.poolRegistry()
      )
    ).getDeployment(fixture.predicted.programId);
    expect(registered.program).to.equal(fixture.predicted.program);
    expect(await fixture.program.state()).to.equal(0n);
    expect(await fixture.program.vault()).to.equal(fixture.predicted.vault);
    expect(await fixture.factory.expectedFundingAsset()).to.equal(
      await fixture.token.getAddress()
    );
    expect(await fixture.vault.claimManager()).to.equal(
      fixture.predicted.claimManager
    );

    await expect(
      fixture.factory
        .connect(fixture.operator)
        .deployProgram(
          suiteId,
          commitment("operator-spoofed-sponsor"),
          fixture.config,
          fixture.roles,
          fixture.bytecodes
        )
    ).to.be.revertedWithCustomError(fixture.factory, "Unauthorized");

    const tampered = { ...fixture.bytecodes, poolVault: "0x6000" };
    await expect(
      fixture.factory.predictDeployment(
        suiteId,
        commitment("tampered-program"),
        fixture.config,
        fixture.roles,
        tampered
      )
    ).to.be.revertedWithCustomError(fixture.factory, "InvalidBytecode");

    await expect(
      fixture.templateRegistry
        .connect(fixture.governance)
        .registerSuite(
          commitment("suite-without-review"),
          await fixture.factory.getAddress(),
          2,
          0,
          1,
          await fixture.factory.deploymentCodeCommitment(),
          commitment("template-without-review"),
          ethers.ZeroHash
        )
    ).to.be.revertedWithCustomError(
      fixture.templateRegistry,
      "InvalidCommitment"
    );
  });

  it("rejects a separately registered six-decimal funding-asset lookalike", async function () {
    const fixture = await networkHelpers.loadFixture(deployFixture);
    const lookalike = await ethers.deployContract("MockSixDecimalAsset", [
      "USD Coin",
      "USDC",
    ]);
    await fixture.assetRegistry
      .connect(fixture.governance)
      .registerAsset(
        await lookalike.getAddress(),
        commitment("USDC:LOOKALIKE"),
        commitment("USD Coin"),
        commitment("USDC")
      );
    const lookalikeConfig = {
      ...fixture.config,
      fundingAsset: await lookalike.getAddress(),
    };

    await expect(
      fixture.factory.predictDeployment(
        suiteId,
        commitment("lookalike-prediction"),
        lookalikeConfig,
        fixture.roles,
        fixture.bytecodes
      )
    )
      .to.be.revertedWithCustomError(fixture.factory, "FundingAssetMismatch")
      .withArgs(await fixture.token.getAddress(), await lookalike.getAddress());
    await expect(
      fixture.factory
        .connect(fixture.sponsor)
        .deployProgram(
          suiteId,
          commitment("lookalike-deployment"),
          lookalikeConfig,
          fixture.roles,
          fixture.bytecodes
        )
    )
      .to.be.revertedWithCustomError(fixture.factory, "FundingAssetMismatch")
      .withArgs(await fixture.token.getAddress(), await lookalike.getAddress());
  });

  it("rejects role overlap that would collapse activation, review, settlement, or guardian separation", async function () {
    const fixture = await networkHelpers.loadFixture(deployFixture);
    const invalidRoles = [
      { ...fixture.roles, operator: fixture.roles.sponsor },
      { ...fixture.roles, appealReviewer: fixture.roles.initialReviewer },
      { ...fixture.roles, guardian: fixture.roles.operator },
      { ...fixture.roles, eligibilityAttestor: fixture.roles.initialReviewer },
      { ...fixture.roles, settlement: await fixture.token.getAddress() },
    ];
    for (const [index, roles] of invalidRoles.entries()) {
      await expect(
        ethers.deployContract("ProtectionProgram", [
          await fixture.factory.getAddress(),
          commitment(`invalid-role-program-${index}`),
          suiteId,
          fixture.config,
          roles,
        ])
      ).to.be.revertedWithCustomError(fixture.program, "InvalidConfiguration");
    }
  });

  it("validates every role separation and incompatible suite role before prediction or deployment", async function () {
    const fixture = await networkHelpers.loadFixture(deployFixture);
    const roleNames = [
      "sponsor",
      "operator",
      "initialReviewer",
      "appealReviewer",
      "settlement",
      "guardian",
      "eligibilityAttestor",
    ] as const;
    const protectedPairs: Array<[number, number]> = [];
    for (let second = 1; second < 6; second += 1) {
      for (let first = 0; first < second; first += 1) {
        protectedPairs.push([first, second]);
      }
    }
    for (const first of [2, 3, 4, 5]) {
      protectedPairs.push([first, 6]);
    }

    for (const [caseIndex, [first, second]] of protectedPairs.entries()) {
      const roles = {
        ...fixture.roles,
        [roleNames[second]]: fixture.roles[roleNames[first]],
      };
      await expect(
        fixture.factory.predictDeployment(
          suiteId,
          commitment(`duplicate-role-prediction-${caseIndex}`),
          fixture.config,
          roles,
          fixture.bytecodes
        )
      )
        .to.be.revertedWithCustomError(fixture.factory, "DuplicateRole")
        .withArgs(first, second, fixture.roles[roleNames[first]]);
    }

    for (const [index, roleName] of roleNames.entries()) {
      await expect(
        fixture.factory.predictDeployment(
          suiteId,
          commitment(`zero-role-prediction-${index}`),
          fixture.config,
          { ...fixture.roles, [roleName]: ethers.ZeroAddress },
          fixture.bytecodes
        )
      )
        .to.be.revertedWithCustomError(fixture.factory, "InvalidRole")
        .withArgs(index, ethers.ZeroAddress);
    }

    const incompatibleRoles = [
      await fixture.token.getAddress(),
      await fixture.factory.getAddress(),
      await fixture.assetRegistry.getAddress(),
      await fixture.templateRegistry.getAddress(),
      await fixture.factory.poolRegistry(),
      await fixture.factory.create2Deployer(),
    ];
    for (const [index, role] of incompatibleRoles.entries()) {
      await expect(
        fixture.factory.predictDeployment(
          suiteId,
          commitment(`incompatible-role-prediction-${index}`),
          fixture.config,
          { ...fixture.roles, settlement: role },
          fixture.bytecodes
        )
      )
        .to.be.revertedWithCustomError(fixture.factory, "InvalidRole")
        .withArgs(4, role);
    }

    for (const [index, eligibilityAttestor] of [
      fixture.roles.sponsor,
      fixture.roles.operator,
    ].entries()) {
      const predicted = await fixture.factory.predictDeployment(
        suiteId,
        commitment(`permitted-attestor-overlap-${index}`),
        fixture.config,
        { ...fixture.roles, eligibilityAttestor },
        fixture.bytecodes
      );
      expect(predicted.program).not.to.equal(ethers.ZeroAddress);
    }

    await expect(
      fixture.factory
        .connect(fixture.sponsor)
        .deployProgram(
          suiteId,
          commitment("duplicate-role-deployment"),
          fixture.config,
          { ...fixture.roles, appealReviewer: fixture.roles.initialReviewer },
          fixture.bytecodes
        )
    ).to.be.revertedWithCustomError(fixture.factory, "DuplicateRole");

    const legacySuiteId = commitment("NAKAMA_ROBINHOOD_PHASE0_1.0.0");
    await fixture.templateRegistry
      .connect(fixture.governance)
      .registerSuite(
        legacySuiteId,
        await fixture.factory.getAddress(),
        1,
        0,
        0,
        await fixture.factory.deploymentCodeCommitment(),
        commitment("legacy-template"),
        commitment("legacy-review")
      );
    await expect(
      fixture.factory.predictDeployment(
        legacySuiteId,
        commitment("legacy-suite-prediction"),
        fixture.config,
        fixture.roles,
        fixture.bytecodes
      )
    )
      .to.be.revertedWithCustomError(
        fixture.factory,
        "IncompatibleSuiteVersion"
      )
      .withArgs(2, 1);
  });

  it("rejects caps that cannot be represented by signed accounting events and unbounded review windows", async function () {
    const fixture = await networkHelpers.loadFixture(deployFixture);
    const invalidConfigs = [
      {
        ...fixture.config,
        perMemberCap: 1n << 255n,
        aggregateCap: 1n << 255n,
        maxMembers: 1,
      },
      {
        ...fixture.config,
        appealWindow: 366n * DAY,
      },
      {
        ...fixture.config,
        initialDecisionWindow: 366n * DAY,
      },
      {
        ...fixture.config,
        appealDecisionWindow: 366n * DAY,
      },
    ];

    for (const [index, config] of invalidConfigs.entries()) {
      await expect(
        ethers.deployContract("ProtectionProgram", [
          await fixture.factory.getAddress(),
          commitment(`invalid-bounds-program-${index}`),
          suiteId,
          config,
          fixture.roles,
        ])
      ).to.be.revertedWithCustomError(fixture.program, "InvalidConfiguration");
    }
  });

  it("reconstructs the complete economic ledger from canonical lifecycle events", async function () {
    const fixture = await networkHelpers.loadFixture(deployFixture);
    await fundAndOpenEnrollment(fixture);
    const membershipId = await activateMember(fixture);
    const deniedMembershipId = await activateMember(
      fixture,
      fixture.memberTwo,
      "event-replay-denied-member"
    );
    expect(await fixture.vault.memberRemaining(membershipId)).to.equal(
      PER_MEMBER_CAP
    );
    await activateProgram(fixture);
    const opened = await openRequest(fixture, membershipId);
    const { decision, signature } = await signedDecision(
      fixture,
      opened.requestId
    );
    await fixture.claims.executeInitialDecision(
      decision,
      fixture.payoutRecipient.address,
      opened.recipientSalt,
      signature
    );
    const denied = await openRequest(
      fixture,
      deniedMembershipId,
      fixture.memberTwo,
      "event-replay-denied-request",
      100n * USDG
    );
    const deniedDecision = await signedDecision(fixture, denied.requestId, {
      action: 3,
      amount: 0n,
    });
    await fixture.claims.executeInitialDecision(
      deniedDecision.decision,
      ethers.ZeroAddress,
      ethers.ZeroHash,
      deniedDecision.signature
    );
    const deniedRequest = await fixture.claims.request(denied.requestId);
    await networkHelpers.time.increaseTo(deniedRequest.appealDeadline + 1n);
    await fixture.claims.finalizeUnappealedDenial(denied.requestId);
    expect(
      (await fixture.vault.accounting()).approvedUnpaidObligations
    ).to.equal(opened.requestedAmount);
    await fixture.settlements
      .connect(fixture.settlement)
      .settle(opened.requestId);
    expect(
      await fixture.token.balanceOf(fixture.payoutRecipient.address)
    ).to.equal(opened.requestedAmount);
    expect((await fixture.claims.request(opened.requestId)).state).to.equal(8n);
    expect(await fixture.vault.reconciled()).to.equal(true);

    await networkHelpers.time.increaseTo(fixture.config.runoffAt);
    await fixture.program.enterRunoff();
    await fixture.membership.expireMembership(membershipId);
    await fixture.membership.expireMembership(deniedMembershipId);
    await networkHelpers.time.increaseTo(fixture.config.closesAt);
    await fixture.program.close();
    const refund = AGGREGATE_CAP - opened.requestedAmount;
    expect((await fixture.vault.accounting()).maturedRefunds).to.equal(refund);
    await fixture.vault
      .connect(fixture.sponsor)
      .claimMaturedRefund(fixture.sponsor.address);
    expect(await fixture.token.balanceOf(fixture.sponsor.address)).to.equal(
      refund
    );
    expect(await fixture.vault.trackedAssets()).to.equal(0n);
    expect(await fixture.vault.ECONOMIC_EVENT_SCHEMA_VERSION()).to.equal(2n);
    await assertEconomicEventReplay(fixture);
  });

  it("closes enrollment at activeAt even if nobody advances the program state", async function () {
    const fixture = await networkHelpers.loadFixture(deployFixture);
    await fundAndOpenEnrollment(fixture);
    await networkHelpers.time.increaseTo(fixture.config.activeAt);
    expect(await fixture.program.state()).to.equal(3n);

    const memberCommitment = commitment("late-member");
    const eligibility = {
      programId: fixture.predicted.programId,
      memberCommitment,
      account: fixture.member.address,
      termsCommitment: fixture.config.termsCommitment,
      privacyCommitment: fixture.config.privacyCommitment,
      nonce: 0n,
      validUntil: fixture.config.activeAt,
    };
    const signature = await fixture.eligibilityAttestor.signTypedData(
      {
        name: "Nakama Membership Eligibility",
        version: "1",
        chainId: (await ethers.provider.getNetwork()).chainId,
        verifyingContract: await fixture.membership.getAddress(),
      },
      {
        Eligibility: [
          { name: "programId", type: "bytes32" },
          { name: "memberCommitment", type: "bytes32" },
          { name: "account", type: "address" },
          { name: "termsCommitment", type: "bytes32" },
          { name: "privacyCommitment", type: "bytes32" },
          { name: "nonce", type: "uint256" },
          { name: "validUntil", type: "uint64" },
        ],
      },
      eligibility
    );
    await expect(
      fixture.membership
        .connect(fixture.member)
        .activateMembership(eligibility, signature)
    ).to.be.revertedWithCustomError(fixture.membership, "InvalidState");
  });

  it("requires fresh two-party cancellation approval after every lifecycle transition", async function () {
    const fixture = await networkHelpers.loadFixture(deployFixture);

    await fixture.program
      .connect(fixture.sponsor)
      .approveCancellationAsSponsor();
    await fixture.program
      .connect(fixture.operator)
      .approveCancellationAsOperator();
    await fixture.program.connect(fixture.operator).markReviewed();
    await expect(
      fixture.program.connect(fixture.outsider).cancelBeforePromises()
    ).to.be.revertedWithCustomError(fixture.program, "ActivationNotApproved");

    await fixture.program
      .connect(fixture.sponsor)
      .approveCancellationAsSponsor();
    await fixture.program
      .connect(fixture.operator)
      .approveCancellationAsOperator();
    await fixture.token.mint(fixture.sponsor.address, AGGREGATE_CAP);
    await fixture.token
      .connect(fixture.sponsor)
      .approve(await fixture.vault.getAddress(), AGGREGATE_CAP);
    await fixture.vault
      .connect(fixture.sponsor)
      .fund(AGGREGATE_CAP, commitment("sponsor-funding"));
    await fixture.program.markFunded();
    await expect(
      fixture.program.connect(fixture.outsider).cancelBeforePromises()
    ).to.be.revertedWithCustomError(fixture.program, "ActivationNotApproved");

    await fixture.program
      .connect(fixture.sponsor)
      .approveCancellationAsSponsor();
    await fixture.program
      .connect(fixture.operator)
      .approveCancellationAsOperator();
    await fixture.program.connect(fixture.outsider).cancelBeforePromises();
    expect(await fixture.program.state()).to.equal(7n);
    expect((await fixture.vault.accounting()).maturedRefunds).to.equal(
      AGGREGATE_CAP
    );
  });

  it("keeps denied value reserved through an independent appeal", async function () {
    const fixture = await networkHelpers.loadFixture(deployFixture);
    await fundAndOpenEnrollment(fixture);
    const membershipId = await activateMember(fixture);
    await activateProgram(fixture);
    const opened = await openRequest(fixture, membershipId);
    const denial = await signedDecision(fixture, opened.requestId, {
      action: 3,
      amount: 0n,
    });
    await fixture.claims.executeInitialDecision(
      denial.decision,
      ethers.ZeroAddress,
      ethers.ZeroHash,
      denial.signature
    );
    expect(
      (await fixture.vault.accounting()).pendingRequestReservation
    ).to.equal(opened.requestedAmount);

    const deniedRequest = await fixture.claims.request(opened.requestId);
    await expect(
      fixture.claims
        .connect(fixture.member)
        .fileAppeal(opened.requestId, deniedRequest.evidenceManifestCommitment)
    ).to.be.revertedWithCustomError(fixture.claims, "InvalidCommitment");

    await fixture.claims
      .connect(fixture.member)
      .fileAppeal(opened.requestId, commitment("appeal-packet-v2"));
    const approval = await signedDecision(fixture, opened.requestId, {
      round: 2,
      signer: fixture.appealReviewer,
    });
    await fixture.claims.executeAppealDecision(
      approval.decision,
      fixture.payoutRecipient.address,
      opened.recipientSalt,
      approval.signature
    );
    expect((await fixture.claims.request(opened.requestId)).state).to.equal(6n);
    expect(
      (await fixture.vault.accounting()).pendingRequestReservation
    ).to.equal(0n);
    expect(
      (await fixture.vault.accounting()).approvedUnpaidObligations
    ).to.equal(opened.requestedAmount);
  });

  it("requires an approval recipient commitment and forbids it on non-approval decisions", async function () {
    const fixture = await networkHelpers.loadFixture(deployFixture);
    await fundAndOpenEnrollment(fixture);
    const membershipId = await activateMember(fixture);
    await activateProgram(fixture);
    const opened = await openRequest(fixture, membershipId);
    const request = await fixture.claims.request(opened.requestId);

    const denial = await signedDecision(fixture, opened.requestId, {
      action: 3,
      amount: 0n,
    });
    const denialWithRecipient = {
      ...denial.decision,
      recipientCommitment: request.recipientCommitment,
    };
    const denialSignature = await signDecisionPayload(
      fixture,
      denialWithRecipient,
      fixture.reviewerOwner
    );
    await expect(
      fixture.decisions.verifyDecision(denialWithRecipient, denialSignature)
    ).to.be.revertedWithCustomError(fixture.decisions, "InvalidDecision");
    await expect(
      fixture.claims.executeInitialDecision(
        denialWithRecipient,
        ethers.ZeroAddress,
        ethers.ZeroHash,
        denialSignature
      )
    ).to.be.revertedWithCustomError(fixture.claims, "InvalidDecision");

    const approval = await signedDecision(fixture, opened.requestId);
    const approvalWithoutRecipient = {
      ...approval.decision,
      recipientCommitment: ethers.ZeroHash,
    };
    const approvalSignature = await signDecisionPayload(
      fixture,
      approvalWithoutRecipient,
      fixture.reviewerOwner
    );
    await expect(
      fixture.decisions.verifyDecision(
        approvalWithoutRecipient,
        approvalSignature
      )
    ).to.be.revertedWithCustomError(fixture.decisions, "InvalidDecision");
    await expect(
      fixture.claims.executeInitialDecision(
        approvalWithoutRecipient,
        fixture.payoutRecipient.address,
        opened.recipientSalt,
        approvalSignature
      )
    ).to.be.revertedWithCustomError(fixture.claims, "InvalidDecision");
  });

  it("escalates deadline misses without auto-denial or releasing value", async function () {
    const fixture = await networkHelpers.loadFixture(deployFixture);
    await fundAndOpenEnrollment(fixture);
    const membershipId = await activateMember(fixture);
    await activateProgram(fixture);
    const opened = await openRequest(fixture, membershipId);
    const request = await fixture.claims.request(opened.requestId);
    await networkHelpers.time.increaseTo(request.decisionDeadline + 1n);
    await fixture.claims.escalateNoQuorum(opened.requestId);
    expect((await fixture.claims.request(opened.requestId)).state).to.equal(3n);
    expect(
      (await fixture.vault.accounting()).pendingRequestReservation
    ).to.equal(opened.requestedAmount);
    expect(await fixture.claims.openRequestCount()).to.equal(1n);
  });

  it("escalates an information timeout without unsigned denial or releasing value", async function () {
    const fixture = await networkHelpers.loadFixture(deployFixture);
    await fundAndOpenEnrollment(fixture);
    const membershipId = await activateMember(fixture);
    await activateProgram(fixture);
    const opened = await openRequest(fixture, membershipId);
    const informationRequest = await signedDecision(fixture, opened.requestId, {
      action: 1,
      amount: 0n,
    });
    await fixture.claims.executeInitialDecision(
      informationRequest.decision,
      ethers.ZeroAddress,
      ethers.ZeroHash,
      informationRequest.signature
    );
    const waiting = await fixture.claims.request(opened.requestId);
    expect(waiting.state).to.equal(2n);
    expect(waiting.decisionDeadline).to.be.greaterThan(0n);
    await networkHelpers.time.increaseTo(waiting.decisionDeadline + 1n);
    await fixture.claims.escalateInformationTimeout(opened.requestId);
    const escalated = await fixture.claims.request(opened.requestId);
    expect(escalated.state).to.equal(3n);
    expect(
      (await fixture.vault.accounting()).pendingRequestReservation
    ).to.equal(opened.requestedAmount);
    expect(await fixture.claims.openRequestCount()).to.equal(1n);

    const signedDenial = await signedDecision(fixture, opened.requestId, {
      action: 3,
      amount: 0n,
    });
    await fixture.claims.executeInitialDecision(
      signedDenial.decision,
      ethers.ZeroAddress,
      ethers.ZeroHash,
      signedDenial.signature
    );
    const appealable = await fixture.claims.request(opened.requestId);
    expect(appealable.state).to.equal(4n);
    await networkHelpers.time.increaseTo(appealable.appealDeadline + 1n);
    await fixture.claims.finalizeUnappealedDenial(opened.requestId);
    expect((await fixture.claims.request(opened.requestId)).state).to.equal(7n);
    expect(
      (await fixture.vault.accounting()).pendingRequestReservation
    ).to.equal(0n);
  });

  it("allows the assigned human reviewer to decide while information is requested", async function () {
    const fixture = await networkHelpers.loadFixture(deployFixture);
    await fundAndOpenEnrollment(fixture);
    const membershipId = await activateMember(fixture);
    await activateProgram(fixture);
    const opened = await openRequest(fixture, membershipId);
    const informationRequest = await signedDecision(fixture, opened.requestId, {
      action: 1,
      amount: 0n,
    });
    await fixture.claims.executeInitialDecision(
      informationRequest.decision,
      ethers.ZeroAddress,
      ethers.ZeroHash,
      informationRequest.signature
    );

    const approval = await signedDecision(fixture, opened.requestId);
    await fixture.claims.executeInitialDecision(
      approval.decision,
      fixture.payoutRecipient.address,
      opened.recipientSalt,
      approval.signature
    );
    expect((await fixture.claims.request(opened.requestId)).state).to.equal(6n);
    expect(
      (await fixture.vault.accounting()).approvedUnpaidObligations
    ).to.equal(opened.requestedAmount);
  });

  it("freezes evidence versions outside a reviewer-opened information window", async function () {
    const fixture = await networkHelpers.loadFixture(deployFixture);
    await fundAndOpenEnrollment(fixture);
    const membershipId = await activateMember(fixture);
    await activateProgram(fixture);
    const opened = await openRequest(fixture, membershipId);

    await expect(
      fixture.claims
        .connect(fixture.member)
        .updateEvidence(opened.requestId, commitment("pending-front-run"))
    ).to.be.revertedWithCustomError(fixture.claims, "InvalidState");

    const pending = await fixture.claims.request(opened.requestId);
    await networkHelpers.time.increaseTo(pending.decisionDeadline + 1n);
    await fixture.claims.escalateNoQuorum(opened.requestId);
    await expect(
      fixture.claims
        .connect(fixture.member)
        .updateEvidence(opened.requestId, commitment("escalated-front-run"))
    ).to.be.revertedWithCustomError(fixture.claims, "InvalidState");

    const informationRequest = await signedDecision(fixture, opened.requestId, {
      action: 1,
      amount: 0n,
    });
    await fixture.claims.executeInitialDecision(
      informationRequest.decision,
      ethers.ZeroAddress,
      ethers.ZeroHash,
      informationRequest.signature
    );
    await fixture.claims
      .connect(fixture.member)
      .updateEvidence(opened.requestId, commitment("requested-update"));
    expect((await fixture.claims.request(opened.requestId)).state).to.equal(1n);

    const denial = await signedDecision(fixture, opened.requestId, {
      action: 3,
      amount: 0n,
    });
    await fixture.claims.executeInitialDecision(
      denial.decision,
      ethers.ZeroAddress,
      ethers.ZeroHash,
      denial.signature
    );
    await fixture.claims
      .connect(fixture.member)
      .fileAppeal(opened.requestId, commitment("appeal-packet"));
    await expect(
      fixture.claims
        .connect(fixture.member)
        .updateEvidence(opened.requestId, commitment("appeal-front-run"))
    ).to.be.revertedWithCustomError(fixture.claims, "InvalidState");
  });

  it("rejects new requests at and after runoff even before the lifecycle transition is called", async function () {
    const fixture = await networkHelpers.loadFixture(deployFixture);
    await fundAndOpenEnrollment(fixture);
    const membershipId = await activateMember(fixture);
    await activateProgram(fixture);
    const requestId = await fixture.claims.deriveRequestId(membershipId, 0);
    const recipientSalt = commitment("expired-recipient-salt");
    const payoutCommitment = await fixture.claims.recipientCommitment(
      requestId,
      fixture.payoutRecipient.address,
      recipientSalt
    );

    await networkHelpers.time.increaseTo(fixture.config.runoffAt);
    expect(await fixture.membership.isActiveMembership(membershipId)).to.equal(
      false
    );
    expect(
      await fixture.membership.isMembershipAccount(
        membershipId,
        fixture.member.address
      )
    ).to.equal(true);
    await expect(
      fixture.claims
        .connect(fixture.member)
        .openRequest(
          membershipId,
          commitment("expired-evidence-at-boundary"),
          payoutCommitment,
          100n * USDG
        )
    ).to.be.revertedWithCustomError(fixture.claims, "InvalidState");

    await networkHelpers.time.increaseTo(fixture.config.runoffAt + 1n);
    await expect(
      fixture.claims
        .connect(fixture.member)
        .openRequest(
          membershipId,
          commitment("expired-evidence-later"),
          payoutCommitment,
          100n * USDG
        )
    ).to.be.revertedWithCustomError(fixture.claims, "InvalidState");
  });

  it("supports EIP-1271 human reviewer decisions", async function () {
    const fixture = await deployFixture({ smartReviewer: true });
    await fundAndOpenEnrollment(fixture);
    const membershipId = await activateMember(fixture);
    await activateProgram(fixture);
    const opened = await openRequest(fixture, membershipId);
    const approval = await signedDecision(fixture, opened.requestId);
    await fixture.claims.executeInitialDecision(
      approval.decision,
      fixture.payoutRecipient.address,
      opened.recipientSalt,
      approval.signature
    );
    expect((await fixture.claims.request(opened.requestId)).state).to.equal(6n);
  });

  it("fails closed when an EIP-1271 reviewer returns invalid magic or reverts", async function () {
    const fixture = await deployFixture({
      smartReviewer: true,
      fixtureLabel: "hostile-1271-reviewer",
    });
    await fundAndOpenEnrollment(fixture);
    const membershipId = await activateMember(fixture);
    await activateProgram(fixture);
    const opened = await openRequest(fixture, membershipId);
    const approval = await signedDecision(fixture, opened.requestId);

    await expect(
      fixture.reviewerContract!.connect(fixture.outsider).setSignatureMode(1)
    ).to.be.revertedWithCustomError(fixture.reviewerContract!, "Unauthorized");
    await fixture
      .reviewerContract!.connect(fixture.reviewerOwner)
      .setSignatureMode(1);
    await expect(
      fixture.claims.executeInitialDecision(
        approval.decision,
        fixture.payoutRecipient.address,
        opened.recipientSalt,
        approval.signature
      )
    ).to.be.revertedWithCustomError(fixture.decisions, "InvalidSignature");
    expect(await fixture.decisions.nonces(fixture.reviewer)).to.equal(0n);
    expect((await fixture.claims.request(opened.requestId)).state).to.equal(1n);
    expect(
      (await fixture.vault.accounting()).pendingRequestReservation
    ).to.equal(opened.requestedAmount);

    await fixture
      .reviewerContract!.connect(fixture.reviewerOwner)
      .setSignatureMode(2);
    await expect(
      fixture.claims.executeInitialDecision(
        approval.decision,
        fixture.payoutRecipient.address,
        opened.recipientSalt,
        approval.signature
      )
    ).to.be.revertedWithCustomError(fixture.decisions, "InvalidSignature");
    expect(await fixture.decisions.nonces(fixture.reviewer)).to.equal(0n);

    await fixture
      .reviewerContract!.connect(fixture.reviewerOwner)
      .setSignatureMode(0);
    await fixture.claims.executeInitialDecision(
      approval.decision,
      fixture.payoutRecipient.address,
      opened.recipientSalt,
      approval.signature
    );
    expect(await fixture.decisions.nonces(fixture.reviewer)).to.equal(1n);
    expect((await fixture.claims.request(opened.requestId)).state).to.equal(6n);
  });

  it("records typed eligibility revocation with deterministic expiry, replay, and idempotency semantics", async function () {
    const fixture = await networkHelpers.loadFixture(deployFixture);
    await fundAndOpenEnrollment(fixture);
    const now = BigInt(await networkHelpers.time.latest());
    const revoked = await signedEligibility(
      fixture,
      fixture.member,
      "revoked-member",
      { validUntil: now + 10n }
    );
    const revocation = await signedEligibilityRevocation(
      fixture,
      revoked.eligibility,
      { validUntil: now + 20n }
    );

    const invalidSignature = await signedEligibilityRevocation(
      fixture,
      revoked.eligibility,
      { signer: fixture.outsider }
    );
    await expect(
      fixture.membership
        .connect(fixture.outsider)
        .revokeEligibilityAuthorization(
          revoked.eligibility,
          invalidSignature.revocation,
          invalidSignature.signature
        )
    ).to.be.revertedWithCustomError(fixture.membership, "InvalidAuthorization");

    const firstResult = await fixture.membership
      .connect(fixture.outsider)
      .revokeEligibilityAuthorization.staticCall(
        revoked.eligibility,
        revocation.revocation,
        revocation.signature
      );
    expect(firstResult[0]).to.equal(revocation.authorizationDigest);
    expect(firstResult[1]).to.equal(true);
    await expect(
      fixture.membership
        .connect(fixture.outsider)
        .revokeEligibilityAuthorization(
          revoked.eligibility,
          revocation.revocation,
          revocation.signature
        )
    )
      .to.emit(fixture.membership, "EligibilityAuthorizationRevoked")
      .withArgs(
        fixture.predicted.programId,
        revocation.authorizationDigest,
        fixture.eligibilityAttestor.address,
        fixture.outsider.address,
        0n
      );
    expect(
      await fixture.membership.eligibilityAuthorizationRevoked(
        revocation.authorizationDigest
      )
    ).to.equal(true);
    expect(
      await fixture.membership.authorizationUsed(
        await fixture.membership.hashEligibilityRevocation(
          revocation.revocation
        )
      )
    ).to.equal(true);
    expect(await fixture.membership.eligibilityRevocationNonce()).to.equal(1n);

    await networkHelpers.time.increaseTo(now + 21n);
    const retryResult = await fixture.membership
      .connect(fixture.outsider)
      .revokeEligibilityAuthorization.staticCall(
        revoked.eligibility,
        revocation.revocation,
        revocation.signature
      );
    expect(retryResult[0]).to.equal(revocation.authorizationDigest);
    expect(retryResult[1]).to.equal(false);
    await expect(
      fixture.membership
        .connect(fixture.outsider)
        .revokeEligibilityAuthorization(
          revoked.eligibility,
          revocation.revocation,
          revocation.signature
        )
    ).to.not.emit(fixture.membership, "EligibilityAuthorizationRevoked");
    expect(await fixture.membership.eligibilityRevocationNonce()).to.equal(1n);

    const fresh = await signedEligibility(
      fixture,
      fixture.outsider,
      "revocation-envelope-negative"
    );
    const substituted = await signedEligibility(
      fixture,
      fixture.memberTwo,
      "revocation-target-substitution"
    );
    const targetBoundRevocation = await signedEligibilityRevocation(
      fixture,
      fresh.eligibility
    );
    await expect(
      fixture.membership
        .connect(fixture.outsider)
        .revokeEligibilityAuthorization(
          substituted.eligibility,
          targetBoundRevocation.revocation,
          targetBoundRevocation.signature
        )
    ).to.be.revertedWithCustomError(fixture.membership, "InvalidAuthorization");
    expect(await fixture.membership.eligibilityRevocationNonce()).to.equal(1n);

    const staleNonceRevocation = await signedEligibilityRevocation(
      fixture,
      fresh.eligibility,
      { nonce: 0n }
    );
    await expect(
      fixture.membership
        .connect(fixture.outsider)
        .revokeEligibilityAuthorization(
          fresh.eligibility,
          staleNonceRevocation.revocation,
          staleNonceRevocation.signature
        )
    ).to.be.revertedWithCustomError(fixture.membership, "InvalidAuthorization");
    const expiredEnvelope = await signedEligibilityRevocation(
      fixture,
      fresh.eligibility,
      { validUntil: now + 20n }
    );
    await expect(
      fixture.membership
        .connect(fixture.outsider)
        .revokeEligibilityAuthorization(
          fresh.eligibility,
          expiredEnvelope.revocation,
          expiredEnvelope.signature
        )
    ).to.be.revertedWithCustomError(fixture.membership, "SignatureExpired");

    await expect(
      fixture.membership
        .connect(fixture.member)
        .activateMembership(revoked.eligibility, revoked.signature)
    )
      .to.be.revertedWithCustomError(
        fixture.membership,
        "RevokedEligibilityAuthorization"
      )
      .withArgs(revocation.authorizationDigest);

    const expired = await signedEligibility(
      fixture,
      fixture.memberTwo,
      "expired-but-recorded-member",
      { validUntil: now + 5n }
    );
    const expiredRevocation = await signedEligibilityRevocation(
      fixture,
      expired.eligibility
    );
    await expect(
      fixture.membership
        .connect(fixture.outsider)
        .revokeEligibilityAuthorization(
          expired.eligibility,
          expiredRevocation.revocation,
          expiredRevocation.signature
        )
    ).to.emit(fixture.membership, "EligibilityAuthorizationRevoked");
    await expect(
      fixture.membership
        .connect(fixture.memberTwo)
        .activateMembership(expired.eligibility, expired.signature)
    ).to.be.revertedWithCustomError(
      fixture.membership,
      "RevokedEligibilityAuthorization"
    );

    const replacement = await signedEligibility(
      fixture,
      fixture.member,
      "revoked-member",
      { nonce: 1n }
    );
    await fixture.membership
      .connect(fixture.member)
      .activateMembership(replacement.eligibility, replacement.signature);
    await expect(
      fixture.membership
        .connect(fixture.member)
        .activateMembership(replacement.eligibility, replacement.signature)
    ).to.be.revertedWithCustomError(fixture.membership, "SignatureAlreadyUsed");
    const consumedRevocation = await signedEligibilityRevocation(
      fixture,
      replacement.eligibility
    );
    await expect(
      fixture.membership
        .connect(fixture.outsider)
        .revokeEligibilityAuthorization(
          replacement.eligibility,
          consumedRevocation.revocation,
          consumedRevocation.signature
        )
    ).to.be.revertedWithCustomError(fixture.membership, "SignatureAlreadyUsed");
  });

  it("accepts relayed EIP-1271 eligibility revocation without requiring the smart account to call", async function () {
    const fixture = await deployFixture({
      smartEligibilityAttestor: true,
      fixtureLabel: "smart-eligibility-attestor",
    });
    await fundAndOpenEnrollment(fixture);

    const firstMembershipId = await activateMember(
      fixture,
      fixture.member,
      "smart-attestor-active"
    );
    expect(
      await fixture.membership.isActiveMembership(firstMembershipId)
    ).to.equal(true);

    const revoked = await signedEligibility(
      fixture,
      fixture.memberTwo,
      "smart-attestor-revoked"
    );
    const revocation = await signedEligibilityRevocation(
      fixture,
      revoked.eligibility
    );
    await fixture
      .eligibilityAttestorContract!.connect(fixture.eligibilityAttestor)
      .setSignatureMode(1);
    await expect(
      fixture.membership
        .connect(fixture.outsider)
        .revokeEligibilityAuthorization(
          revoked.eligibility,
          revocation.revocation,
          revocation.signature
        )
    ).to.be.revertedWithCustomError(fixture.membership, "InvalidAuthorization");
    expect(await fixture.membership.eligibilityRevocationNonce()).to.equal(0n);
    await fixture
      .eligibilityAttestorContract!.connect(fixture.eligibilityAttestor)
      .setSignatureMode(2);
    await expect(
      fixture.membership
        .connect(fixture.outsider)
        .revokeEligibilityAuthorization(
          revoked.eligibility,
          revocation.revocation,
          revocation.signature
        )
    ).to.be.revertedWithCustomError(fixture.membership, "InvalidAuthorization");
    expect(await fixture.membership.eligibilityRevocationNonce()).to.equal(0n);
    await fixture
      .eligibilityAttestorContract!.connect(fixture.eligibilityAttestor)
      .setSignatureMode(0);
    await expect(
      fixture.membership
        .connect(fixture.outsider)
        .revokeEligibilityAuthorization(
          revoked.eligibility,
          revocation.revocation,
          revocation.signature
        )
    )
      .to.emit(fixture.membership, "EligibilityAuthorizationRevoked")
      .withArgs(
        fixture.predicted.programId,
        revocation.authorizationDigest,
        await fixture.eligibilityAttestorContract!.getAddress(),
        fixture.outsider.address,
        0n
      );
    await expect(
      fixture.membership
        .connect(fixture.memberTwo)
        .activateMembership(revoked.eligibility, revoked.signature)
    ).to.be.revertedWithCustomError(
      fixture.membership,
      "RevokedEligibilityAuthorization"
    );
  });

  it("rotates a member account with a typed attestor authorization and rejects stale recovery nonces", async function () {
    const fixture = await networkHelpers.loadFixture(deployFixture);
    await fundAndOpenEnrollment(fixture);
    const membershipId = await activateMember(fixture);
    const chainId = (await ethers.provider.getNetwork()).chainId;
    const types = {
      RecoveryAuthorization: [
        { name: "programId", type: "bytes32" },
        { name: "membershipId", type: "bytes32" },
        { name: "newAccount", type: "address" },
        { name: "nonce", type: "uint256" },
        { name: "validUntil", type: "uint64" },
      ],
    };
    const domain = {
      name: "Nakama Membership Eligibility",
      version: "1",
      chainId,
      verifyingContract: await fixture.membership.getAddress(),
    };
    const authorization = {
      programId: fixture.predicted.programId,
      membershipId,
      newAccount: fixture.memberTwo.address,
      nonce: 0n,
      validUntil: fixture.config.activeAt,
    };
    const signature = await fixture.eligibilityAttestor.signTypedData(
      domain,
      types,
      authorization
    );
    await fixture.membership
      .connect(fixture.memberTwo)
      .recoverMembershipAccount(authorization, signature);
    expect(
      await fixture.membership.isMembershipAccount(
        membershipId,
        fixture.memberTwo.address
      )
    ).to.equal(true);
    expect(
      await fixture.membership.isMembershipAccount(
        membershipId,
        fixture.member.address
      )
    ).to.equal(false);

    const stale = { ...authorization, newAccount: fixture.outsider.address };
    const staleSignature = await fixture.eligibilityAttestor.signTypedData(
      domain,
      types,
      stale
    );
    await expect(
      fixture.membership
        .connect(fixture.outsider)
        .recoverMembershipAccount(stale, staleSignature)
    ).to.be.revertedWithCustomError(fixture.membership, "InvalidAuthorization");
  });

  it("rejects fee-on-transfer funding and does not credit the ledger", async function () {
    const fixture = await deployFixture({ feeToken: true });
    await fixture.program.connect(fixture.operator).markReviewed();
    await fixture.token.mint(fixture.sponsor.address, AGGREGATE_CAP);
    await fixture.token
      .connect(fixture.sponsor)
      .approve(await fixture.vault.getAddress(), AGGREGATE_CAP);
    await expect(
      fixture.vault
        .connect(fixture.sponsor)
        .fund(AGGREGATE_CAP, commitment("fee-funding"))
    ).to.be.revertedWithCustomError(fixture.vault, "UnsupportedTokenBehavior");
    expect(await fixture.vault.trackedAssets()).to.equal(0n);
  });

  it("rejects malformed asset metadata and paused transfers without changing custody", async function () {
    const fixture = await networkHelpers.loadFixture(deployFixture);
    const malformed = await ethers.deployContract("MalformedMetadataToken");
    await expect(
      fixture.assetRegistry
        .connect(fixture.governance)
        .registerAsset(
          await malformed.getAddress(),
          commitment("MALFORMED"),
          commitment("Global Dollar"),
          commitment("USDG")
        )
    ).to.be.revert(ethers);

    await fixture.program.connect(fixture.operator).markReviewed();
    await fixture.token.mint(fixture.sponsor.address, AGGREGATE_CAP);
    await fixture.token
      .connect(fixture.sponsor)
      .approve(await fixture.vault.getAddress(), AGGREGATE_CAP);
    const token = await ethers.getContractAt(
      "MockUSDG",
      await fixture.token.getAddress()
    );
    await token.setTransfersPaused(true);
    await expect(
      fixture.vault
        .connect(fixture.sponsor)
        .fund(AGGREGATE_CAP, commitment("paused-funding"))
    ).to.be.revertedWith("USDG_TRANSFERS_PAUSED");
    expect(await fixture.vault.actualAssets()).to.equal(0n);
    expect(await fixture.vault.trackedAssets()).to.equal(0n);
    expect((await fixture.vault.accounting()).sponsorFunded).to.equal(0n);

    await token.setTransfersPaused(false);
    await fixture.vault
      .connect(fixture.sponsor)
      .fund(AGGREGATE_CAP, commitment("unpaused-funding"));
    expect(await fixture.vault.actualAssets()).to.equal(AGGREGATE_CAP);
    expect(await fixture.vault.trackedAssets()).to.equal(AGGREGATE_CAP);
  });

  it("rejects sender-fee and callback-capable funding atomically", async function () {
    const senderFeeFixture = await deployFixture({
      senderFeeToken: true,
      fixtureLabel: "sender-fee-token",
    });
    await senderFeeFixture.program
      .connect(senderFeeFixture.operator)
      .markReviewed();
    const senderFee = AGGREGATE_CAP / 100n;
    await senderFeeFixture.token.mint(
      senderFeeFixture.sponsor.address,
      AGGREGATE_CAP + senderFee
    );
    await senderFeeFixture.token
      .connect(senderFeeFixture.sponsor)
      .approve(await senderFeeFixture.vault.getAddress(), AGGREGATE_CAP);
    await expect(
      senderFeeFixture.vault
        .connect(senderFeeFixture.sponsor)
        .fund(AGGREGATE_CAP, commitment("sender-fee-funding"))
    )
      .to.be.revertedWithCustomError(
        senderFeeFixture.vault,
        "UnsupportedTokenBehavior"
      )
      .withArgs(AGGREGATE_CAP, AGGREGATE_CAP + senderFee, AGGREGATE_CAP);
    expect(await senderFeeFixture.vault.actualAssets()).to.equal(0n);
    expect(await senderFeeFixture.vault.trackedAssets()).to.equal(0n);

    const callbackFixture = await deployFixture({
      fixtureLabel: "callback-token-funding",
    });
    await callbackFixture.program
      .connect(callbackFixture.operator)
      .markReviewed();
    await callbackFixture.token.mint(
      callbackFixture.sponsor.address,
      AGGREGATE_CAP
    );
    await callbackFixture.token
      .connect(callbackFixture.sponsor)
      .approve(await callbackFixture.vault.getAddress(), AGGREGATE_CAP);
    const callbackToken = await ethers.getContractAt(
      "MockUSDG",
      await callbackFixture.token.getAddress()
    );
    await callbackToken.setTransferCallback(
      await callbackFixture.vault.getAddress(),
      callbackFixture.vault.interface.encodeFunctionData("fund", [
        1n,
        commitment("nested-funding"),
      ])
    );
    await expect(
      callbackFixture.vault
        .connect(callbackFixture.sponsor)
        .fund(AGGREGATE_CAP, commitment("callback-funding"))
    ).to.be.revertedWithCustomError(callbackToken, "TransferCallbackFailed");
    expect(await callbackFixture.vault.actualAssets()).to.equal(0n);
    expect(await callbackFixture.vault.trackedAssets()).to.equal(0n);

    await callbackToken.clearTransferCallback();
    await callbackFixture.vault
      .connect(callbackFixture.sponsor)
      .fund(AGGREGATE_CAP, commitment("callback-cleared-funding"));
    expect(await callbackFixture.vault.trackedAssets()).to.equal(AGGREGATE_CAP);
  });

  it("rolls back membership activation when a negative rebase breaks exact full funding", async function () {
    const fixture = await networkHelpers.loadFixture(deployFixture);
    await fundAndOpenEnrollment(fixture);
    const authorization = await signedEligibility(
      fixture,
      fixture.member,
      "negative-rebase-member"
    );
    const digest = await fixture.membership.hashEligibility(
      authorization.eligibility
    );
    const membershipId = await fixture.membership.deriveMembershipId(
      authorization.eligibility.memberCommitment
    );
    const token = await ethers.getContractAt(
      "MockUSDG",
      await fixture.token.getAddress()
    );
    await token.forceBurn(await fixture.vault.getAddress(), 1n);
    expect(await fixture.vault.reconciled()).to.equal(false);
    await expect(
      fixture.membership
        .connect(fixture.member)
        .activateMembership(authorization.eligibility, authorization.signature)
    ).to.be.revertedWithCustomError(fixture.vault, "LedgerInsolvent");
    expect(await fixture.membership.authorizationUsed(digest)).to.equal(false);
    expect(await fixture.membership.totalActivated()).to.equal(0n);
    expect((await fixture.membership.membership(membershipId)).state).to.equal(
      0n
    );

    await token.mint(await fixture.vault.getAddress(), 1n);
    expect(await fixture.vault.reconciled()).to.equal(true);
    await fixture.membership
      .connect(fixture.member)
      .activateMembership(authorization.eligibility, authorization.signature);
    expect(await fixture.membership.authorizationUsed(digest)).to.equal(true);
    expect(await fixture.vault.memberRemaining(membershipId)).to.equal(
      PER_MEMBER_CAP
    );
  });

  it("keeps recipient substitution and callback reentrancy atomic through settlement", async function () {
    const fixture = await networkHelpers.loadFixture(deployFixture);
    await fundAndOpenEnrollment(fixture);
    const membershipId = await activateMember(fixture);
    await activateProgram(fixture);

    const requestId = await fixture.claims.deriveRequestId(membershipId, 0n);
    const recipient = await ethers.deployContract("MockReentrantRecipient");
    const recipientSalt = commitment("reentrant-recipient-salt");
    const recipientCommitment = await fixture.claims.recipientCommitment(
      requestId,
      await recipient.getAddress(),
      recipientSalt
    );
    const requestedAmount = 250n * USDG;
    await fixture.claims
      .connect(fixture.member)
      .openRequest(
        membershipId,
        commitment("reentrant-recipient-evidence"),
        recipientCommitment,
        requestedAmount
      );
    const approval = await signedDecision(fixture, requestId, {
      amount: requestedAmount,
    });

    await expect(
      fixture.claims.executeInitialDecision(
        approval.decision,
        fixture.payoutRecipient.address,
        recipientSalt,
        approval.signature
      )
    ).to.be.revertedWithCustomError(fixture.claims, "InvalidDecision");
    expect(await fixture.decisions.nonces(fixture.reviewer)).to.equal(0n);
    expect((await fixture.claims.request(requestId)).state).to.equal(1n);
    expect(
      (await fixture.vault.accounting()).pendingRequestReservation
    ).to.equal(requestedAmount);

    await fixture.claims.executeInitialDecision(
      approval.decision,
      await recipient.getAddress(),
      recipientSalt,
      approval.signature
    );
    await recipient.configure(
      await fixture.settlements.getAddress(),
      fixture.settlements.interface.encodeFunctionData("settle", [requestId])
    );
    const token = await ethers.getContractAt(
      "MockUSDG",
      await fixture.token.getAddress()
    );
    await token.setTransferCallback(
      await recipient.getAddress(),
      recipient.interface.encodeFunctionData("onTokenTransfer")
    );

    await expect(
      fixture.settlements.connect(fixture.settlement).settle(requestId)
    ).to.be.revertedWithCustomError(token, "TransferCallbackFailed");
    expect((await fixture.claims.request(requestId)).state).to.equal(6n);
    expect(await fixture.vault.obligationAmount(requestId)).to.equal(
      requestedAmount
    );
    expect(
      (await fixture.vault.accounting()).approvedUnpaidObligations
    ).to.equal(requestedAmount);
    expect((await fixture.vault.accounting()).settled).to.equal(0n);
    expect(await token.balanceOf(await recipient.getAddress())).to.equal(0n);

    await token.clearTransferCallback();
    await fixture.settlements.connect(fixture.settlement).settle(requestId);
    expect((await fixture.claims.request(requestId)).state).to.equal(8n);
    expect(await fixture.vault.obligationAmount(requestId)).to.equal(0n);
    expect(await token.balanceOf(await recipient.getAddress())).to.equal(
      requestedAmount
    );
  });

  it("does not let direct donations expand tracked assets or promises", async function () {
    const fixture = await networkHelpers.loadFixture(deployFixture);
    await fixture.token.mint(fixture.outsider.address, 1_000n * USDG);
    await fixture.token
      .connect(fixture.outsider)
      .transfer(await fixture.vault.getAddress(), 1_000n * USDG);
    expect(await fixture.vault.actualAssets()).to.equal(1_000n * USDG);
    expect(await fixture.vault.trackedAssets()).to.equal(0n);
    expect(await fixture.vault.unaccountedAssets()).to.equal(1_000n * USDG);
  });

  it("maintains the conservative ledger invariants across a multi-member state trace", async function () {
    const fixture = await networkHelpers.loadFixture(deployFixture);
    await fundAndOpenEnrollment(fixture);
    const actors = [fixture.member, fixture.memberTwo, fixture.outsider];
    const amounts = [1n * USDG, 333n * USDG, 999n * USDG];
    const membershipIds = [];
    for (const [index, actor] of actors.entries()) {
      membershipIds.push(
        await activateMember(fixture, actor, `trace-member-${index}`)
      );
    }
    await activateProgram(fixture);

    const requests = [];
    for (const [index, membershipId] of membershipIds.entries()) {
      const opened = await openRequest(
        fixture,
        membershipId,
        actors[index],
        `trace-request-${index}`,
        amounts[index]
      );
      requests.push(opened);
      const approval = await signedDecision(fixture, opened.requestId, {
        amount: amounts[index],
      });
      await fixture.claims.executeInitialDecision(
        approval.decision,
        fixture.payoutRecipient.address,
        opened.recipientSalt,
        approval.signature
      );
      const accounting = await fixture.vault.accounting();
      const actual = await fixture.vault.actualAssets();
      const tracked = await fixture.vault.trackedAssets();
      const encumbered = await fixture.vault.encumberedAssets();
      expect(actual >= tracked).to.equal(true);
      expect(tracked >= encumbered).to.equal(true);
      expect(
        accounting.maximumRemainingMemberLiability +
          accounting.approvedUnpaidObligations <=
          AGGREGATE_CAP
      ).to.equal(true);
      expect(
        accounting.pendingRequestReservation <=
          accounting.maximumRemainingMemberLiability
      ).to.equal(true);
    }

    for (const opened of requests) {
      await fixture.settlements
        .connect(fixture.settlement)
        .settle(opened.requestId);
      expect(await fixture.vault.reconciled()).to.equal(true);
    }
    expect(
      await fixture.token.balanceOf(fixture.payoutRecipient.address)
    ).to.equal(amounts.reduce((total, amount) => total + amount, 0n));
  });

  it("preserves exact accounting across bounded stateful invariant fuzz traces", async function () {
    const seeds = [
      0x1a2b3c4d, 0x51f15e, 0xc0ffee, 0xdeadbeef, 0x5eed1234, 0x31415926,
      0x27182818, 0xabcdef01,
    ];
    const traceSteps = 16;
    for (const seed of seeds) {
      const next = seededUint32(seed);
      const fixture = await deployFixture({
        fixtureLabel: `stateful-${seed.toString(16)}`,
      });
      await fundAndOpenEnrollment(fixture);
      const actors = [fixture.member, fixture.memberTwo, fixture.outsider];
      const membershipIds: string[] = [];
      for (const [index, actor] of actors.entries()) {
        membershipIds.push(
          await activateMember(
            fixture,
            actor,
            `stateful-${seed}-member-${index}`
          )
        );
      }
      await activateProgram(fixture);

      const donation = BigInt((next() % 50) + 1) * USDG;
      await fixture.token.mint(fixture.outsider.address, donation);
      await fixture.token
        .connect(fixture.outsider)
        .transfer(await fixture.vault.getAddress(), donation);
      const requestIds: string[] = [];
      const unsettled: string[] = [];
      await assertVaultInvariants(fixture, membershipIds, requestIds, donation);

      for (let step = 0; step < traceSteps; step += 1) {
        const remaining = await Promise.all(
          membershipIds.map((membershipId) =>
            fixture.vault.memberRemaining(membershipId)
          )
        );
        const available = remaining
          .map((amount, index) => ({ amount, index }))
          .filter(({ amount }) => amount > 0n);
        if (available.length === 0) break;
        const selected = available[next() % available.length];
        const maximumUnits = selected.amount / USDG;
        const requestedUnits = BigInt((next() % 250) + 1);
        const requestedAmount =
          (requestedUnits > maximumUnits ? maximumUnits : requestedUnits) *
          USDG;
        const opened = await openRequest(
          fixture,
          membershipIds[selected.index],
          actors[selected.index],
          `stateful-${seed}-request-${step}`,
          requestedAmount
        );
        requestIds.push(opened.requestId);
        await assertVaultInvariants(
          fixture,
          membershipIds,
          requestIds,
          donation
        );

        const action = next() % 4;
        if (action <= 1) {
          const approvedAmount =
            action === 0
              ? requestedAmount
              : requestedAmount / 2n > 0n
              ? requestedAmount / 2n
              : requestedAmount;
          const approval = await signedDecision(fixture, opened.requestId, {
            amount: approvedAmount,
          });
          await fixture.claims.executeInitialDecision(
            approval.decision,
            fixture.payoutRecipient.address,
            opened.recipientSalt,
            approval.signature
          );
          unsettled.push(opened.requestId);
        } else if (action === 2) {
          const denial = await signedDecision(fixture, opened.requestId, {
            action: 3,
            amount: 0n,
          });
          await fixture.claims.executeInitialDecision(
            denial.decision,
            ethers.ZeroAddress,
            ethers.ZeroHash,
            denial.signature
          );
          await assertVaultInvariants(
            fixture,
            membershipIds,
            requestIds,
            donation
          );
          await fixture.claims
            .connect(actors[selected.index])
            .fileAppeal(
              opened.requestId,
              commitment(`stateful-${seed}-appeal-${step}`)
            );
          const finalDenial = await signedDecision(fixture, opened.requestId, {
            round: 2,
            action: 3,
            amount: 0n,
            signer: fixture.appealReviewer,
          });
          await fixture.claims.executeAppealDecision(
            finalDenial.decision,
            ethers.ZeroAddress,
            ethers.ZeroHash,
            finalDenial.signature
          );
        } else {
          const informationRequest = await signedDecision(
            fixture,
            opened.requestId,
            { action: 1, amount: 0n }
          );
          await fixture.claims.executeInitialDecision(
            informationRequest.decision,
            ethers.ZeroAddress,
            ethers.ZeroHash,
            informationRequest.signature
          );
          await fixture.claims
            .connect(actors[selected.index])
            .updateEvidence(
              opened.requestId,
              commitment(`stateful-${seed}-evidence-update-${step}`)
            );
          const approval = await signedDecision(fixture, opened.requestId, {
            amount: requestedAmount,
          });
          await fixture.claims.executeInitialDecision(
            approval.decision,
            fixture.payoutRecipient.address,
            opened.recipientSalt,
            approval.signature
          );
          unsettled.push(opened.requestId);
        }

        await assertVaultInvariants(
          fixture,
          membershipIds,
          requestIds,
          donation
        );
        if (unsettled.length > 0 && next() % 2 === 0) {
          const settlementIndex = next() % unsettled.length;
          const [requestId] = unsettled.splice(settlementIndex, 1);
          await fixture.settlements
            .connect(fixture.settlement)
            .settle(requestId);
          await assertVaultInvariants(
            fixture,
            membershipIds,
            requestIds,
            donation
          );
        }
      }

      for (const requestId of unsettled) {
        await fixture.settlements.connect(fixture.settlement).settle(requestId);
        await assertVaultInvariants(
          fixture,
          membershipIds,
          requestIds,
          donation
        );
      }
      expect(
        (await fixture.vault.accounting()).approvedUnpaidObligations
      ).to.equal(0n);
      expect(
        (await fixture.vault.accounting()).pendingRequestReservation
      ).to.equal(0n);
    }
  });

  it("enforces scoped pauses and two-party unpause without opening a withdrawal path", async function () {
    const fixture = await networkHelpers.loadFixture(deployFixture);
    await fundAndOpenEnrollment(fixture);
    const membershipId = await activateMember(fixture);
    await activateProgram(fixture);
    const opened = await openRequest(fixture, membershipId);
    const approval = await signedDecision(fixture, opened.requestId);
    await fixture.claims.executeInitialDecision(
      approval.decision,
      fixture.payoutRecipient.address,
      opened.recipientSalt,
      approval.signature
    );
    const incident = commitment("usd-g-incident");
    const now = BigInt(await networkHelpers.time.latest());
    await fixture.safety
      .connect(fixture.guardian)
      .pause(4, incident, commitment("ASSET_INCIDENT"), now + 600n);
    await expect(
      fixture.settlements.connect(fixture.settlement).settle(opened.requestId)
    ).to.be.revertedWithCustomError(fixture.settlements, "SettlementPaused");
    await expect(
      fixture.safety.connect(fixture.guardian).unpause(4, incident)
    ).to.be.revertedWithCustomError(fixture.safety, "UnpauseNotApproved");
    await fixture.safety
      .connect(fixture.operator)
      .approveUnpauseAsOperator(4, incident);
    await fixture.safety.connect(fixture.guardian).unpause(4, incident);
    await fixture.settlements
      .connect(fixture.settlement)
      .settle(opened.requestId);
  });

  it("contains lost reviewer and settlement signer incidents without releasing reserved value", async function () {
    const fixture = await networkHelpers.loadFixture(deployFixture);
    await fundAndOpenEnrollment(fixture);
    const membershipId = await activateMember(fixture);
    await activateProgram(fixture);

    const lostReviewerRequest = await openRequest(
      fixture,
      membershipId,
      fixture.member,
      "lost-reviewer-request",
      100n * USDG
    );
    const pendingBefore = await fixture.vault.pendingReservation(
      lostReviewerRequest.requestId
    );
    const request = await fixture.claims.request(lostReviewerRequest.requestId);
    await networkHelpers.time.increaseTo(request.decisionDeadline + 1n);
    await fixture.claims.escalateNoQuorum(lostReviewerRequest.requestId);
    expect(
      (await fixture.claims.request(lostReviewerRequest.requestId)).state
    ).to.equal(3n);
    expect(
      await fixture.vault.pendingReservation(lostReviewerRequest.requestId)
    ).to.equal(pendingBefore);

    const payableRequest = await openRequest(
      fixture,
      membershipId,
      fixture.member,
      "lost-settlement-signer-request",
      200n * USDG
    );
    const approval = await signedDecision(fixture, payableRequest.requestId, {
      amount: 200n * USDG,
    });
    await fixture.claims.executeInitialDecision(
      approval.decision,
      fixture.payoutRecipient.address,
      payableRequest.recipientSalt,
      approval.signature
    );
    const accountingBefore = await fixture.vault.accounting();
    for (const unauthorized of [
      fixture.sponsor,
      fixture.operator,
      fixture.guardian,
    ]) {
      await expect(
        fixture.settlements
          .connect(unauthorized)
          .settle(payableRequest.requestId)
      ).to.be.revertedWithCustomError(fixture.settlements, "Unauthorized");
    }
    const accountingAfter = await fixture.vault.accounting();
    expect(accountingAfter.approvedUnpaidObligations).to.equal(
      accountingBefore.approvedUnpaidObligations
    );
    expect(
      await fixture.vault.obligationAmount(payableRequest.requestId)
    ).to.equal(200n * USDG);
    expect(await fixture.vault.reconciled()).to.equal(true);
  });

  it("revokes a compromised agent immediately and keeps blocked-attempt evidence durable", async function () {
    const fixture = await networkHelpers.loadFixture(deployFixture);
    const adapter = await ethers.deployContract("MockAuthorizedAdapter");
    const now = BigInt(await networkHelpers.time.latest());
    const grant = {
      principal: fixture.outsider.address,
      target: await adapter.getAddress(),
      selector: adapter.interface.getFunction("perform")!.selector,
      maxNativeValue: 0n,
      asset: ethers.ZeroAddress,
      maxAssetAmountPerAction: 0n,
      periodAssetLimit: 0n,
      periodSeconds: 600n,
      issuedAt: now,
      expiresAt: now + 3_600n,
      maxCallsPerPeriod: 10,
      nonce: 0n,
      purposeCommitment: commitment("compromised-agent-exercise"),
    };
    await fixture.authorizations
      .connect(fixture.operator)
      .grantAuthorization(grant);
    const authorizationId = await fixture.authorizations.deriveAuthorizationId(
      grant.principal,
      grant.target,
      grant.selector,
      grant.nonce
    );
    const incidentId = commitment("compromised-agent-incident");
    await fixture.safety
      .connect(fixture.guardian)
      .revokeAgentAuthorization(authorizationId, incidentId);
    expect(await fixture.authorizations.revoked(authorizationId)).to.equal(
      true
    );
    await expect(
      adapter
        .connect(fixture.outsider)
        .perform(await fixture.authorizations.getAddress(), authorizationId)
    ).to.be.revertedWithCustomError(
      fixture.authorizations,
      "AuthorizationNotActive"
    );
    await expect(
      adapter.recordBlocked(
        await fixture.authorizations.getAddress(),
        authorizationId,
        fixture.outsider.address
      )
    )
      .to.emit(fixture.authorizations, "AuthorizationBlocked")
      .withArgs(
        fixture.predicted.programId,
        authorizationId,
        fixture.outsider.address,
        await adapter.getAddress(),
        grant.selector,
        await fixture.authorizations.AUTHORIZATION_NOT_ACTIVE()
      );
  });

  it("contains a USDG transfer freeze atomically and resumes only after explicit recovery", async function () {
    const fixture = await networkHelpers.loadFixture(deployFixture);
    await fundAndOpenEnrollment(fixture);
    const membershipId = await activateMember(fixture);
    await activateProgram(fixture);
    const opened = await openRequest(fixture, membershipId);
    const approval = await signedDecision(fixture, opened.requestId);
    await fixture.claims.executeInitialDecision(
      approval.decision,
      fixture.payoutRecipient.address,
      opened.recipientSalt,
      approval.signature
    );

    await fixture.token.setTransfersPaused(true);
    const before = await fixture.vault.accounting();
    await expect(
      fixture.settlements.connect(fixture.settlement).settle(opened.requestId)
    ).to.be.revertedWith("USDG_TRANSFERS_PAUSED");
    const afterFailure = await fixture.vault.accounting();
    expect(afterFailure.settled).to.equal(before.settled);
    expect(afterFailure.approvedUnpaidObligations).to.equal(
      before.approvedUnpaidObligations
    );
    expect((await fixture.claims.request(opened.requestId)).state).to.equal(6n);

    const dependencyId = commitment("USDG");
    const incidentId = commitment("usdg-freeze-incident");
    await fixture.safety
      .connect(fixture.guardian)
      .setDependencyWarning(
        dependencyId,
        true,
        commitment("ASSET_TRANSFERS_FROZEN"),
        incidentId
      );
    const now = BigInt(await networkHelpers.time.latest());
    await fixture.safety
      .connect(fixture.guardian)
      .pause(4, incidentId, commitment("ASSET_INCIDENT"), now + 600n);
    await fixture.token.setTransfersPaused(false);
    await fixture.safety
      .connect(fixture.operator)
      .approveUnpauseAsOperator(4, incidentId);
    await fixture.safety.connect(fixture.guardian).unpause(4, incidentId);
    await fixture.safety
      .connect(fixture.guardian)
      .setDependencyWarning(
        dependencyId,
        false,
        commitment("ASSET_RECOVERED"),
        incidentId
      );
    await fixture.settlements
      .connect(fixture.settlement)
      .settle(opened.requestId);
    expect((await fixture.claims.request(opened.requestId)).state).to.equal(8n);
  });

  it("keeps contract-bug and chain-outage pauses active past review until two-party recovery", async function () {
    const fixture = await networkHelpers.loadFixture(deployFixture);
    await fundAndOpenEnrollment(fixture);
    const membershipId = await activateMember(fixture);
    await activateProgram(fixture);
    const opened = await openRequest(fixture, membershipId);
    const approval = await signedDecision(fixture, opened.requestId);
    const contractIncident = commitment("claim-contract-bug");
    const now = BigInt(await networkHelpers.time.latest());
    await fixture.safety
      .connect(fixture.guardian)
      .pause(3, contractIncident, commitment("CONTRACT_BUG"), now + 60n);
    await expect(
      fixture.claims.executeInitialDecision(
        approval.decision,
        fixture.payoutRecipient.address,
        opened.recipientSalt,
        approval.signature
      )
    ).to.be.revertedWithCustomError(fixture.claims, "InvalidState");
    expect(await fixture.vault.pendingReservation(opened.requestId)).to.equal(
      opened.requestedAmount
    );

    await networkHelpers.time.increaseTo(now + 120n);
    expect(await fixture.safety.reviewRequired(3)).to.equal(true);
    expect(await fixture.safety.isPaused(3)).to.equal(true);
    await fixture.safety
      .connect(fixture.operator)
      .approveUnpauseAsOperator(3, contractIncident);
    await fixture.safety.connect(fixture.guardian).unpause(3, contractIncident);
    await fixture.claims.executeInitialDecision(
      approval.decision,
      fixture.payoutRecipient.address,
      opened.recipientSalt,
      approval.signature
    );
    expect(await fixture.vault.obligationAmount(opened.requestId)).to.equal(
      opened.requestedAmount
    );

    const outageIncident = commitment("chain-outage-boundary");
    const afterRecovery = BigInt(await networkHelpers.time.latest());
    await fixture.safety
      .connect(fixture.guardian)
      .pause(
        5,
        outageIncident,
        commitment("CHAIN_OUTAGE"),
        afterRecovery + 60n
      );
    await networkHelpers.time.increaseTo(afterRecovery + 3_600n);
    expect(await fixture.safety.reviewRequired(5)).to.equal(true);
    expect(await fixture.safety.isPaused(5)).to.equal(true);
    await fixture.safety
      .connect(fixture.operator)
      .approveUnpauseAsOperator(5, outageIncident);
    await fixture.safety.connect(fixture.guardian).unpause(5, outageIncident);
    expect(await fixture.safety.isPaused(5)).to.equal(false);
  });

  it("records reviewed adapter consumption and rejects economic, suite, role, and asset targets", async function () {
    const fixture = await networkHelpers.loadFixture(deployFixture);
    const adapter = await ethers.deployContract("MockAuthorizedAdapter");
    const now = BigInt(await networkHelpers.time.latest());
    const grant = {
      principal: fixture.outsider.address,
      target: await adapter.getAddress(),
      selector: adapter.interface.getFunction("perform")!.selector,
      maxNativeValue: 0n,
      asset: ethers.ZeroAddress,
      maxAssetAmountPerAction: 0n,
      periodAssetLimit: 0n,
      periodSeconds: 600n,
      issuedAt: now,
      expiresAt: now + 3_600n,
      maxCallsPerPeriod: 1,
      nonce: 0n,
      purposeCommitment: commitment("evidence-completeness-assistance"),
    };
    const authorizationId = await fixture.authorizations.deriveAuthorizationId(
      grant.principal,
      grant.target,
      grant.selector,
      grant.nonce
    );
    expect(
      await fixture.authorizations.isAuthorized(
        authorizationId,
        grant.principal,
        grant.target,
        grant.selector
      )
    ).to.equal(false);
    await fixture.authorizations
      .connect(fixture.operator)
      .grantAuthorization(grant);
    expect(
      await fixture.authorizations.isAuthorized(
        authorizationId,
        grant.principal,
        grant.target,
        grant.selector
      )
    ).to.equal(true);

    await expect(
      adapter.recordBlocked(
        await fixture.authorizations.getAddress(),
        authorizationId,
        fixture.outsider.address
      )
    ).to.be.revertedWithCustomError(
      fixture.authorizations,
      "AttemptIsAuthorized"
    );

    const blockedBefore = await fixture.authorizations.queryFilter(
      fixture.authorizations.filters.AuthorizationBlocked()
    );
    await expect(
      fixture.authorizations.recordBlockedAttempt(
        authorizationId,
        fixture.member.address,
        grant.selector,
        0,
        0
      )
    ).to.be.revertedWithCustomError(fixture.authorizations, "Unauthorized");
    await expect(
      adapter
        .connect(fixture.member)
        .perform(await fixture.authorizations.getAddress(), authorizationId)
    ).to.be.revertedWithCustomError(
      fixture.authorizations,
      "AuthorizationNotActive"
    );
    const blockedAfterRevert = await fixture.authorizations.queryFilter(
      fixture.authorizations.filters.AuthorizationBlocked()
    );
    expect(blockedAfterRevert).to.have.length(blockedBefore.length);
    await expect(
      adapter.recordBlocked(
        await fixture.authorizations.getAddress(),
        authorizationId,
        fixture.member.address
      )
    )
      .to.emit(fixture.authorizations, "AuthorizationBlocked")
      .withArgs(
        fixture.predicted.programId,
        authorizationId,
        fixture.member.address,
        await adapter.getAddress(),
        adapter.interface.getFunction("perform")!.selector,
        await fixture.authorizations.AUTHORIZATION_NOT_ACTIVE()
      );
    await adapter
      .connect(fixture.outsider)
      .perform(await fixture.authorizations.getAddress(), authorizationId);
    const [, consumption] = await fixture.authorizations.getAuthorization(
      authorizationId
    );
    expect(consumption.callsInPeriod).to.equal(1n);

    await expect(
      adapter
        .connect(fixture.outsider)
        .perform(await fixture.authorizations.getAddress(), authorizationId)
    ).to.be.revertedWithCustomError(
      fixture.authorizations,
      "AuthorizationLimitExceeded"
    );
    await expect(
      adapter.recordBlocked(
        await fixture.authorizations.getAddress(),
        authorizationId,
        fixture.outsider.address
      )
    )
      .to.emit(fixture.authorizations, "AuthorizationBlocked")
      .withArgs(
        fixture.predicted.programId,
        authorizationId,
        fixture.outsider.address,
        await adapter.getAddress(),
        adapter.interface.getFunction("perform")!.selector,
        await fixture.authorizations.PERIOD_LIMIT_EXCEEDED()
      );
    const [, unchangedConsumption] =
      await fixture.authorizations.getAuthorization(authorizationId);
    expect(unchangedConsumption.callsInPeriod).to.equal(1n);

    await expect(
      fixture.authorizations.connect(fixture.operator).grantAuthorization({
        ...grant,
        maxNativeValue: 1n,
        nonce: 1n,
      })
    ).to.be.revertedWithCustomError(
      fixture.authorizations,
      "InvalidAuthorization"
    );

    const forbiddenTargets = [
      await fixture.factory.getAddress(),
      await fixture.program.getAddress(),
      await fixture.vault.getAddress(),
      await fixture.membership.getAddress(),
      await fixture.decisions.getAddress(),
      await fixture.claims.getAddress(),
      await fixture.settlements.getAddress(),
      await fixture.authorizations.getAddress(),
      await fixture.safety.getAddress(),
      await fixture.token.getAddress(),
    ];
    for (const target of forbiddenTargets) {
      await expect(
        fixture.authorizations.connect(fixture.operator).grantAuthorization({
          ...grant,
          target,
          nonce: 1n,
        })
      ).to.be.revertedWithCustomError(
        fixture.authorizations,
        "InvalidAuthorization"
      );
    }
  });

  it("rejects a contract reviewer even though it otherwise looks like an adapter", async function () {
    const fixture = await deployFixture({ smartReviewer: true });
    const now = BigInt(await networkHelpers.time.latest());
    await expect(
      fixture.authorizations.connect(fixture.operator).grantAuthorization({
        principal: fixture.outsider.address,
        target: fixture.reviewer,
        selector: "0x1626ba7e",
        maxNativeValue: 0n,
        asset: ethers.ZeroAddress,
        maxAssetAmountPerAction: 0n,
        periodAssetLimit: 0n,
        periodSeconds: 600n,
        issuedAt: now,
        expiresAt: now + 3_600n,
        maxCallsPerPeriod: 10,
        nonce: 0n,
        purposeCommitment: commitment("forbidden-reviewer-target"),
      })
    ).to.be.revertedWithCustomError(
      fixture.authorizations,
      "InvalidAuthorization"
    );
  });
});
