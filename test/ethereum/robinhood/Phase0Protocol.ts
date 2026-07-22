import { expect } from "chai";
import { network } from "hardhat";

const { ethers, networkHelpers } = await network.create();

const DAY = 86_400n;
const USDG = 1_000_000n;
const PER_MEMBER_CAP = 1_000n * USDG;
const AGGREGATE_CAP = 5_000n * USDG;
const suiteId = ethers.id("NAKAMA_ROBINHOOD_PHASE0_1.0.0");
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

async function deployFixture({ smartReviewer = false, feeToken = false } = {}) {
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

  const token = feeToken
    ? await ethers.deployContract("FeeOnTransferUSDG")
    : await ethers.deployContract("MockUSDG");
  const reviewerContract = smartReviewer
    ? await ethers.deployContract("MockERC1271Reviewer", [
        reviewerOwner.address,
      ])
    : null;
  const reviewer = reviewerContract
    ? await reviewerContract.getAddress()
    : reviewerOwner.address;

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
      1,
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
    eligibilityAttestor: eligibilityAttestor.address,
  };
  const salt = commitment(
    `program-${smartReviewer ? "1271" : "eoa"}-${feeToken ? "fee" : "exact"}`
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
  await networkHelpers.time.increaseTo(fixture.config.enrollmentOpensAt);
  await fixture.program.openEnrollment();
}

async function activateMember(
  fixture: Fixture,
  member = fixture.member,
  label = "member-one"
) {
  const memberCommitment = commitment(label);
  const eligibility = {
    programId: fixture.predicted.programId,
    memberCommitment,
    account: member.address,
    termsCommitment: fixture.config.termsCommitment,
    privacyCommitment: fixture.config.privacyCommitment,
    nonce: 0n,
    validUntil: fixture.config.activeAt,
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
  const membershipId = await fixture.membership.deriveMembershipId(
    memberCommitment
  );
  await fixture.membership
    .connect(member)
    .activateMembership(eligibility, signature);
  return membershipId;
}

async function activateProgram(fixture: Fixture) {
  await networkHelpers.time.increaseTo(fixture.config.activeAt);
  await fixture.program.activate();
}

async function openRequest(
  fixture: Fixture,
  membershipId: string,
  member = fixture.member,
  label = "request-one",
  requestedAmount = 400n * USDG
) {
  const requestId = await fixture.claims.deriveRequestId(membershipId, 0);
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
          1,
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

  it("runs a fully funded membership, request, decision, settlement, close, and refund", async function () {
    const fixture = await networkHelpers.loadFixture(deployFixture);
    await fundAndOpenEnrollment(fixture);
    const membershipId = await activateMember(fixture);
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
      maxCallsPerPeriod: 10,
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
      adapter
        .connect(fixture.member)
        .perform(await fixture.authorizations.getAddress(), authorizationId)
    ).to.be.revertedWithCustomError(
      fixture.authorizations,
      "AuthorizationNotActive"
    );
    await adapter
      .connect(fixture.outsider)
      .perform(await fixture.authorizations.getAddress(), authorizationId);
    const [, consumption] = await fixture.authorizations.getAuthorization(
      authorizationId
    );
    expect(consumption.callsInPeriod).to.equal(1n);

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
