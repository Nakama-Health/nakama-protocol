import { expect } from "chai";
import { network } from "hardhat";

const { ethers, networkHelpers } = await network.create();

const commitment = (label: string) => ethers.keccak256(ethers.toUtf8Bytes(label));

async function deployScope(
  tokenContract: "MockERC20" | "FeeOnTransferERC20" | "SenderFeeERC20" | "ReentrantERC20",
) {
  const [
    domainController,
    planController,
    attesterOne,
    attesterTwo,
    attesterThree,
    claimant,
    contributor,
    relayer,
    payoutRecipient,
    alternateRecipient,
    outsider,
  ] = await ethers.getSigners();

  const protocol = await ethers.deployContract("NakamaCoverageProtocol");
  const token =
    tokenContract === "MockERC20"
      ? await ethers.deployContract("MockERC20", ["Reserve USD", "rUSD"])
      : await ethers.deployContract(tokenContract);

  const domainSalt = commitment(`domain-${tokenContract}`);
  const domainId = await protocol.deriveDomainId(domainController.address, domainSalt);
  await protocol.connect(domainController).createReserveDomain(domainSalt, commitment("domain metadata"));
  await protocol.connect(outsider).createDomainAssetVault(domainId, await token.getAddress());
  const vaultAddress = await protocol.reserveVaults(domainId, await token.getAddress());

  const planSalt = commitment(`plan-${tokenContract}`);
  const planId = await protocol.derivePlanId(domainId, planSalt);
  await protocol.connect(domainController).createHealthPlan(
    domainId,
    planSalt,
    planController.address,
    commitment("plan metadata"),
    [attesterOne.address, attesterTwo.address, attesterThree.address],
  );

  const seriesSalt = commitment(`series-${tokenContract}`);
  const seriesId = await protocol.deriveSeriesId(planId, seriesSalt);
  await protocol
    .connect(planController)
    .createPolicySeries(
      planId,
      seriesSalt,
      await token.getAddress(),
      3_600,
      commitment("series terms"),
    );

  const lineSalt = commitment(`line-${tokenContract}`);
  const lineId = await protocol.deriveFundingLineId(planId, lineSalt);
  await protocol
    .connect(planController)
    .openFundingLine(planId, seriesId, lineSalt, 2, 1_000_000, commitment("line terms"));

  return {
    protocol,
    token,
    vaultAddress,
    domainId,
    planId,
    seriesId,
    lineId,
    domainController,
    planController,
    attesterOne,
    attesterTwo,
    attesterThree,
    claimant,
    contributor,
    relayer,
    payoutRecipient,
    alternateRecipient,
    outsider,
  };
}

async function deployBackstopFixture() {
  return deployScope("MockERC20");
}

async function deployFeeTokenFixture() {
  return deployScope("FeeOnTransferERC20");
}

async function deployReentrantTokenFixture() {
  return deployScope("ReentrantERC20");
}

async function deploySenderFeeTokenFixture() {
  return deployScope("SenderFeeERC20");
}

async function depositAndOpenClaim(
  fixture: Awaited<ReturnType<typeof deployBackstopFixture>>,
  depositAmount = 1_000n,
  requestedAmount = 400n,
) {
  const { token, contributor, protocol, vaultAddress, lineId, claimant, payoutRecipient, planId } = fixture;
  await token.mint(contributor.address, depositAmount);
  await token.connect(contributor).approve(vaultAddress, depositAmount);
  await protocol
    .connect(contributor)
    .depositReserveCapital(lineId, depositAmount, 0, commitment("capital terms"));

  const nullifier = commitment(`nullifier-${depositAmount}-${requestedAmount}`);
  const claimId = await protocol.deriveClaimId(planId, claimant.address, nullifier);
  await protocol
    .connect(claimant)
    .openClaimCase(
      lineId,
      commitment(`salted-claim-${depositAmount}-${requestedAmount}`),
      nullifier,
      payoutRecipient.address,
      requestedAmount,
    );
  return { claimId, nullifier };
}

async function reachInitialDecision(
  fixture: Awaited<ReturnType<typeof deployBackstopFixture>>,
  claimId: string,
  approve: boolean,
  amount: bigint,
  decisionLabel = "initial decision",
) {
  const decision = commitment(decisionLabel);
  await fixture.protocol.connect(fixture.attesterOne).attestClaim(claimId, approve, amount, decision);
  await fixture.protocol.connect(fixture.attesterTwo).attestClaim(claimId, approve, amount, decision);
  return decision;
}

async function createBackstopLine(
  fixture: Awaited<ReturnType<typeof deployBackstopFixture>>,
  label: string,
  { newPlan = false, capitalCap = 1_000_000n } = {},
) {
  let planId = fixture.planId;
  if (newPlan) {
    const planSalt = commitment(`${label}-plan`);
    planId = await fixture.protocol.derivePlanId(fixture.domainId, planSalt);
    await fixture.protocol.connect(fixture.domainController).createHealthPlan(
      fixture.domainId,
      planSalt,
      fixture.planController.address,
      commitment(`${label}-plan-metadata`),
      [fixture.attesterOne.address, fixture.attesterTwo.address, fixture.attesterThree.address],
    );
  }
  const seriesSalt = commitment(`${label}-series`);
  const seriesId = await fixture.protocol.deriveSeriesId(planId, seriesSalt);
  await fixture.protocol.connect(fixture.planController).createPolicySeries(
    planId,
    seriesSalt,
    await fixture.token.getAddress(),
    3_600,
    commitment(`${label}-series-terms`),
  );
  const lineSalt = commitment(`${label}-line`);
  const lineId = await fixture.protocol.deriveFundingLineId(planId, lineSalt);
  await fixture.protocol.connect(fixture.planController).openFundingLine(
    planId,
    seriesId,
    lineSalt,
    2,
    capitalCap,
    commitment(`${label}-line-terms`),
  );
  return { lineId, planId, seriesId };
}

async function depositCapital(
  fixture: Awaited<ReturnType<typeof deployBackstopFixture>>,
  lineId: string,
  contributor: Awaited<ReturnType<typeof deployBackstopFixture>>["contributor"],
  amount: bigint,
  label: string,
) {
  await fixture.token.mint(contributor.address, amount);
  await fixture.token.connect(contributor).approve(fixture.vaultAddress, amount);
  await fixture.protocol.connect(contributor).depositReserveCapital(
    lineId,
    amount,
    0,
    commitment(`${label}-capital`),
  );
  return fixture.protocol.contributorShares(lineId, contributor.address);
}

async function finalizeApprovedClaim(
  fixture: Awaited<ReturnType<typeof deployBackstopFixture>>,
  lineId: string,
  amount: bigint,
  label: string,
) {
  const line = await fixture.protocol.getFundingLine(lineId);
  const nullifier = commitment(`${label}-nullifier`);
  const claimId = await fixture.protocol.deriveClaimId(line.planId, fixture.claimant.address, nullifier);
  await fixture.protocol.connect(fixture.claimant).openClaimCase(
    lineId,
    commitment(`${label}-claim`),
    nullifier,
    fixture.payoutRecipient.address,
    amount,
  );
  const decision = commitment(`${label}-approval`);
  await fixture.protocol.connect(fixture.attesterOne).attestClaim(claimId, true, amount, decision);
  await fixture.protocol.connect(fixture.attesterTwo).attestClaim(claimId, true, amount, decision);
  await networkHelpers.time.increase(3_601);
  await fixture.protocol.connect(fixture.relayer).finalizeClaimCase(claimId);
  return { claimId, claim: await fixture.protocol.getClaim(claimId) };
}

describe("NakamaCoverageProtocol Ethereum vertical slice", function () {
  it("requires a strict attester majority and consumes claim nullifiers once", async function () {
    const fixture = await networkHelpers.loadFixture(deployBackstopFixture);
    const { claimId, nullifier } = await depositAndOpenClaim(fixture);
    const decision = commitment("majority decision");

    await fixture.protocol
      .connect(fixture.attesterOne)
      .attestClaim(claimId, true, 400, decision);
    expect((await fixture.protocol.getClaim(claimId)).status).to.equal(1n);

    await fixture.protocol
      .connect(fixture.attesterTwo)
      .attestClaim(claimId, true, 400, decision);
    const claim = await fixture.protocol.getClaim(claimId);
    expect(claim.status).to.equal(2n);
    expect((await fixture.protocol.getPlan(fixture.planId)).attesterThreshold).to.equal(2n);

    await expect(
      fixture.protocol
        .connect(fixture.claimant)
        .openClaimCase(
          fixture.lineId,
          commitment("different claim"),
          nullifier,
          fixture.payoutRecipient.address,
          400,
        ),
    )
      .to.be.revertedWithCustomError(fixture.protocol, "NullifierAlreadyUsed")
      .withArgs(nullifier);
  });

  it("scopes nullifiers to the plan and claimant so copied calldata cannot block the victim", async function () {
    const fixture = await networkHelpers.loadFixture(deployBackstopFixture);
    const copiedNullifier = commitment("copied mempool nullifier");
    const attackerClaimId = await fixture.protocol.deriveClaimId(
      fixture.planId,
      fixture.outsider.address,
      copiedNullifier,
    );
    const victimClaimId = await fixture.protocol.deriveClaimId(
      fixture.planId,
      fixture.claimant.address,
      copiedNullifier,
    );

    await fixture.protocol
      .connect(fixture.outsider)
      .openClaimCase(
        fixture.lineId,
        commitment("attacker copied commitment"),
        copiedNullifier,
        fixture.outsider.address,
        100,
      );
    await fixture.protocol
      .connect(fixture.claimant)
      .openClaimCase(
        fixture.lineId,
        commitment("victim salted commitment"),
        copiedNullifier,
        fixture.payoutRecipient.address,
        100,
      );

    expect(attackerClaimId).not.to.equal(victimClaimId);
    expect((await fixture.protocol.getClaim(attackerClaimId)).claimant).to.equal(fixture.outsider.address);
    expect((await fixture.protocol.getClaim(victimClaimId)).claimant).to.equal(fixture.claimant.address);
    await expect(
      fixture.protocol
        .connect(fixture.claimant)
        .openClaimCase(
          fixture.lineId,
          commitment("victim duplicate"),
          copiedNullifier,
          fixture.payoutRecipient.address,
          100,
        ),
    ).to.be.revertedWithCustomError(fixture.protocol, "NullifierAlreadyUsed");
  });

  it("rejects payout recipients that would permanently strand claim assets", async function () {
    const fixture = await networkHelpers.loadFixture(deployBackstopFixture);
    const nullifier = commitment("vault recipient nullifier");
    const secondToken = await ethers.deployContract("MockERC20", ["Second Reserve USD", "rUSD2"]);
    await fixture.protocol
      .connect(fixture.outsider)
      .createDomainAssetVault(fixture.domainId, await secondToken.getAddress());
    const secondVault = await fixture.protocol.reserveVaults(
      fixture.domainId,
      await secondToken.getAddress(),
    );
    expect(await fixture.protocol.isReserveVault(fixture.vaultAddress)).to.equal(true);
    expect(await fixture.protocol.isReserveVault(secondVault)).to.equal(true);
    await expect(
      fixture.protocol
        .connect(fixture.claimant)
        .openClaimCase(
          fixture.lineId,
          commitment("vault recipient claim"),
          nullifier,
          fixture.vaultAddress,
          100,
        ),
    ).to.be.revertedWithCustomError(fixture.protocol, "InvalidAddress");

    await expect(
      fixture.protocol
        .connect(fixture.claimant)
        .openClaimCase(
          fixture.lineId,
          commitment("protocol recipient claim"),
          nullifier,
          await fixture.protocol.getAddress(),
          100,
        ),
    ).to.be.revertedWithCustomError(fixture.protocol, "InvalidAddress");

    await expect(
      fixture.protocol
        .connect(fixture.claimant)
        .openClaimCase(
          fixture.lineId,
          commitment("asset-token recipient claim"),
          nullifier,
          await fixture.token.getAddress(),
          100,
        ),
    ).to.be.revertedWithCustomError(fixture.protocol, "InvalidAddress");

    await expect(
      fixture.protocol
        .connect(fixture.claimant)
        .openClaimCase(
          fixture.lineId,
          commitment("different-vault recipient claim"),
          nullifier,
          secondVault,
          100,
        ),
    ).to.be.revertedWithCustomError(fixture.protocol, "InvalidAddress");

    await fixture.protocol
      .connect(fixture.claimant)
      .openClaimCase(
        fixture.lineId,
        commitment("valid recipient claim"),
        nullifier,
        fixture.payoutRecipient.address,
        100,
      );
    const claimId = await fixture.protocol.deriveClaimId(
      fixture.planId,
      fixture.claimant.address,
      nullifier,
    );
    const deadline = BigInt(await networkHelpers.time.latest()) + 3_600n;
    await expect(
      fixture.protocol
        .connect(fixture.relayer)
        .authorizeClaimRecipient(claimId, fixture.vaultAddress, deadline, "0x"),
    ).to.be.revertedWithCustomError(fixture.protocol, "InvalidAddress");
    await expect(
      fixture.protocol
        .connect(fixture.relayer)
        .authorizeClaimRecipient(claimId, await fixture.protocol.getAddress(), deadline, "0x"),
    ).to.be.revertedWithCustomError(fixture.protocol, "InvalidAddress");
    await expect(
      fixture.protocol
        .connect(fixture.relayer)
        .authorizeClaimRecipient(claimId, await fixture.token.getAddress(), deadline, "0x"),
    ).to.be.revertedWithCustomError(fixture.protocol, "InvalidAddress");
    await expect(
      fixture.protocol
        .connect(fixture.relayer)
        .authorizeClaimRecipient(claimId, secondVault, deadline, "0x"),
    ).to.be.revertedWithCustomError(fixture.protocol, "InvalidAddress");

    await fixture.token.mint(fixture.contributor.address, 100);
    await fixture.token.connect(fixture.contributor).approve(fixture.vaultAddress, 100);
    await fixture.protocol
      .connect(fixture.contributor)
      .depositReserveCapital(fixture.lineId, 100, 0, commitment("recipient guard capital"));
    for (const invalidRecipient of [
      await fixture.protocol.getAddress(),
      await fixture.token.getAddress(),
      fixture.vaultAddress,
      secondVault,
    ]) {
      await expect(
        fixture.protocol
          .connect(fixture.contributor)
          .withdrawReserveCapital(fixture.lineId, 1, 0, invalidRecipient),
      ).to.be.revertedWithCustomError(fixture.protocol, "InvalidAddress");
    }
  });

  it("keeps claims open for existing lines when controllers stop new activity", async function () {
    const fixture = await networkHelpers.loadFixture(deployBackstopFixture);
    await fixture.protocol.connect(fixture.domainController).setDomainControls(fixture.domainId, false, 0);
    await fixture.protocol.connect(fixture.planController).setPlanControls(fixture.planId, false, 0);

    await fixture.token.mint(fixture.contributor.address, 100);
    await fixture.token.connect(fixture.contributor).approve(fixture.vaultAddress, 100);
    await expect(
      fixture.protocol
        .connect(fixture.contributor)
        .depositReserveCapital(fixture.lineId, 100, 0, commitment("stopped funding")),
    ).to.be.revertedWithCustomError(fixture.protocol, "IntakeClosed");

    const nullifier = commitment("claim while stopped");
    await fixture.protocol
      .connect(fixture.claimant)
      .openClaimCase(
        fixture.lineId,
        commitment("covered event while stopped"),
        nullifier,
        fixture.payoutRecipient.address,
        100,
      );
    const claimId = await fixture.protocol.deriveClaimId(
      fixture.planId,
      fixture.claimant.address,
      nullifier,
    );
    expect((await fixture.protocol.getClaim(claimId)).status).to.equal(1n);
  });

  it("encumbers contributor equity at provisional approval and preserves unencumbered exits", async function () {
    const fixture = await networkHelpers.loadFixture(deployBackstopFixture);
    const { claimId } = await depositAndOpenClaim(fixture, 1_000n, 400n);
    await reachInitialDecision(fixture, claimId, true, 400n);

    let sheet = await fixture.protocol.lineBalanceSheet(fixture.lineId);
    expect(sheet.funded).to.equal(1_000n);
    expect(sheet.owed).to.equal(0n);
    expect(sheet.pendingClaims).to.equal(400n);
    expect(sheet.reserved).to.equal(0n);
    expect(await fixture.protocol.freeLineAssets(fixture.lineId)).to.equal(600n);
    const contributorShares = await fixture.protocol.contributorShares(
      fixture.lineId,
      fixture.contributor.address,
    );
    expect(await fixture.protocol.contributorExitQuote(fixture.lineId, contributorShares)).to.equal(600n);

    const now = BigInt(await networkHelpers.time.latest());
    await fixture.protocol
      .connect(fixture.domainController)
      .setDomainControls(fixture.domainId, false, now + 3_600n);
    await fixture.protocol
      .connect(fixture.planController)
      .setPlanControls(fixture.planId, false, now + 3_600n);

    await fixture.protocol
      .connect(fixture.contributor)
      .withdrawReserveCapital(fixture.lineId, contributorShares, 600, fixture.contributor.address);
    expect(await fixture.token.balanceOf(fixture.contributor.address)).to.equal(600n);

    await networkHelpers.time.increase(3_601);
    await fixture.protocol.connect(fixture.relayer).finalizeClaimCase(claimId);
    const finalizedClaim = await fixture.protocol.getClaim(claimId);
    sheet = await fixture.protocol.lineBalanceSheet(fixture.lineId);
    expect(sheet.funded).to.equal(400n);
    expect(sheet.pendingClaims).to.equal(0n);
    expect(sheet.owed).to.equal(400n);
    await fixture.protocol.connect(fixture.outsider).reserveObligation(finalizedClaim.obligationId);
    await fixture.protocol.connect(fixture.relayer).settleClaimCase(claimId);
    expect(await fixture.token.balanceOf(fixture.payoutRecipient.address)).to.equal(400n);

    sheet = await fixture.protocol.lineBalanceSheet(fixture.lineId);
    expect(sheet.funded).to.equal(0n);
    expect(sheet.owed).to.equal(0n);
    expect(sheet.pendingClaims).to.equal(0n);
    expect(sheet.reserved).to.equal(0n);
    expect(sheet.settled).to.equal(400n);
    expect(sheet.returned).to.equal(600n);
    expect((await fixture.protocol.vaultCoverage(fixture.domainId, await fixture.token.getAddress())).solvent)
      .to.equal(true);
  });

  it("blocks the seed-donation sandwich with virtual offsets and mandatory deposit slippage", async function () {
    const fixture = await networkHelpers.loadFixture(deployBackstopFixture);
    const attacker = fixture.contributor;
    const victim = fixture.outsider;
    await fixture.token.mint(attacker.address, 501);
    await fixture.token.connect(attacker).approve(fixture.vaultAddress, 501);
    await fixture.protocol.connect(attacker).depositReserveCapital(
      fixture.lineId,
      1,
      0,
      commitment("sandwich seed"),
    );
    expect(await fixture.protocol.contributorShares(fixture.lineId, attacker.address)).to.equal(1_000_000n);

    const victimPreDonationQuote = await fixture.protocol.contributorDepositQuote(fixture.lineId, 1_000);
    expect(victimPreDonationQuote).to.equal(1_000_000_000n);
    await fixture.protocol.connect(attacker).recordReserveEarnings(
      fixture.lineId,
      500,
      commitment("sandwich donation"),
    );
    await fixture.token.mint(victim.address, 1_000);
    await fixture.token.connect(victim).approve(fixture.vaultAddress, 1_000);
    await expect(fixture.protocol.connect(victim).depositReserveCapital(
      fixture.lineId,
      1_000,
      victimPreDonationQuote,
      commitment("slippage protected victim"),
    )).to.be.revertedWithCustomError(fixture.protocol, "SlippageExceeded");

    const postDonationQuote = await fixture.protocol.contributorDepositQuote(fixture.lineId, 1_000);
    expect(postDonationQuote).to.equal(3_984_063n);
    await fixture.protocol.connect(victim).depositReserveCapital(
      fixture.lineId,
      1_000,
      postDonationQuote,
      commitment("explicit repriced victim"),
    );
    const attackerShares = await fixture.protocol.contributorShares(fixture.lineId, attacker.address);
    await fixture.protocol.connect(attacker).withdrawReserveCapital(
      fixture.lineId,
      attackerShares,
      0,
      attacker.address,
    );
    expect(await fixture.token.balanceOf(attacker.address)).to.equal(251n);
  });

  it("prices deposits without reversible pending-claim discounts before a full denial", async function () {
    const fixture = await networkHelpers.loadFixture(deployBackstopFixture);
    await depositCapital(fixture, fixture.lineId, fixture.contributor, 1_000n, "pending denial base");
    const nullifier = commitment("pending denial nullifier");
    const claimId = await fixture.protocol.deriveClaimId(
      fixture.planId,
      fixture.claimant.address,
      nullifier,
    );
    await fixture.protocol.connect(fixture.claimant).openClaimCase(
      fixture.lineId,
      commitment("pending denial claim"),
      nullifier,
      fixture.payoutRecipient.address,
      1_000,
    );
    await reachInitialDecision(fixture, claimId, true, 1_000n, "pending full approval");
    expect(await fixture.protocol.freeLineAssets(fixture.lineId)).to.equal(0n);

    const attacker = fixture.outsider;
    const attackerShares = await depositCapital(fixture, fixture.lineId, attacker, 100n, "pending denial attacker");
    expect(attackerShares).to.equal(100_000_000n);
    await fixture.protocol.connect(fixture.claimant).challengeClaim(
      claimId,
      commitment("honest denial challenge"),
    );
    const denial = commitment("honest denial");
    await fixture.protocol.connect(fixture.attesterOne).attestClaim(claimId, false, 0, denial);
    await fixture.protocol.connect(fixture.attesterTwo).attestClaim(claimId, false, 0, denial);
    expect((await fixture.protocol.lineBalanceSheet(fixture.lineId)).pendingClaims).to.equal(0n);
    expect(await fixture.protocol.contributorExitQuote(fixture.lineId, attackerShares)).to.equal(100n);
    await fixture.protocol.connect(attacker).withdrawReserveCapital(
      fixture.lineId,
      attackerShares,
      100,
      attacker.address,
    );
    expect(await fixture.token.balanceOf(attacker.address)).to.equal(100n);
  });

  it("does not create a denial windfall when a challenged pending claim only decreases", async function () {
    const fixture = await networkHelpers.loadFixture(deployBackstopFixture);
    await depositCapital(fixture, fixture.lineId, fixture.contributor, 1_000n, "partial pending base");
    const nullifier = commitment("partial pending nullifier");
    const claimId = await fixture.protocol.deriveClaimId(
      fixture.planId,
      fixture.claimant.address,
      nullifier,
    );
    await fixture.protocol.connect(fixture.claimant).openClaimCase(
      fixture.lineId,
      commitment("partial pending claim"),
      nullifier,
      fixture.payoutRecipient.address,
      1_000,
    );
    await reachInitialDecision(fixture, claimId, true, 1_000n, "partial initial approval");
    const attacker = fixture.outsider;
    const attackerShares = await depositCapital(fixture, fixture.lineId, attacker, 100n, "partial pending attacker");
    await fixture.protocol.connect(fixture.claimant).challengeClaim(
      claimId,
      commitment("partial challenge"),
    );
    const partialApproval = commitment("partial appeal approval");
    await fixture.protocol.connect(fixture.attesterOne).attestClaim(claimId, true, 400, partialApproval);
    await fixture.protocol.connect(fixture.attesterTwo).attestClaim(claimId, true, 400, partialApproval);
    expect((await fixture.protocol.lineBalanceSheet(fixture.lineId)).pendingClaims).to.equal(400n);
    expect(await fixture.protocol.contributorExitQuote(fixture.lineId, attackerShares)).to.equal(63n);
    await fixture.protocol.connect(attacker).withdrawReserveCapital(
      fixture.lineId,
      attackerShares,
      63,
      attacker.address,
    );
    expect(await fixture.token.balanceOf(attacker.address)).to.equal(63n);
  });

  it("keeps direct pre-deposit token donations outside contributor accounting", async function () {
    const fixture = await networkHelpers.loadFixture(deployBackstopFixture);
    await fixture.token.mint(fixture.outsider.address, 500);
    await fixture.token.connect(fixture.outsider).transfer(fixture.vaultAddress, 500);
    const shares = await depositCapital(
      fixture,
      fixture.lineId,
      fixture.contributor,
      1_000n,
      "post donation first deposit",
    );
    await fixture.protocol.connect(fixture.contributor).withdrawReserveCapital(
      fixture.lineId,
      shares,
      1_000,
      fixture.contributor.address,
    );
    expect(await fixture.token.balanceOf(fixture.contributor.address)).to.equal(1_000n);
    expect(await fixture.token.balanceOf(fixture.vaultAddress)).to.equal(500n);
    expect((await fixture.protocol.lineBalanceSheet(fixture.lineId)).funded).to.equal(0n);
  });

  it("restarts safely after the last exit leaves a virtual-share residual", async function () {
    const fixture = await networkHelpers.loadFixture(deployBackstopFixture);
    const firstShares = await depositCapital(
      fixture,
      fixture.lineId,
      fixture.contributor,
      1_000n,
      "residual first capital",
    );
    await fixture.token.mint(fixture.outsider.address, 500);
    await fixture.token.connect(fixture.outsider).approve(fixture.vaultAddress, 500);
    await fixture.protocol.connect(fixture.outsider).recordReserveEarnings(
      fixture.lineId,
      500,
      commitment("residual earnings"),
    );
    await fixture.protocol.connect(fixture.contributor).withdrawReserveCapital(
      fixture.lineId,
      firstShares,
      1_499,
      fixture.contributor.address,
    );
    expect((await fixture.protocol.lineBalanceSheet(fixture.lineId)).funded).to.equal(1n);
    expect(await fixture.protocol.totalContributorShares(fixture.lineId)).to.equal(0n);

    const restartShares = await depositCapital(
      fixture,
      fixture.lineId,
      fixture.relayer,
      1_000n,
      "residual restart capital",
    );
    expect(restartShares).to.equal(500_000_000n);
    await fixture.protocol.connect(fixture.relayer).withdrawReserveCapital(
      fixture.lineId,
      restartShares,
      1_000,
      fixture.relayer.address,
    );
    expect(await fixture.token.balanceOf(fixture.relayer.address)).to.equal(1_000n);
    expect((await fixture.protocol.lineBalanceSheet(fixture.lineId)).funded).to.equal(1n);
  });

  it("keeps wiped shares non-dilutable and revives them only through no-share earnings", async function () {
    const fixture = await networkHelpers.loadFixture(deployBackstopFixture);
    await depositCapital(fixture, fixture.lineId, fixture.contributor, 1_000n, "wiped capital");
    const { claim } = await finalizeApprovedClaim(fixture, fixture.lineId, 1_000n, "wiped claim");
    await fixture.protocol.connect(fixture.outsider).reserveObligation(claim.obligationId);
    await fixture.protocol.connect(fixture.relayer).settleObligation(claim.obligationId);
    expect((await fixture.protocol.lineBalanceSheet(fixture.lineId)).funded).to.equal(0n);
    expect(await fixture.protocol.totalContributorShares(fixture.lineId)).to.equal(1_000_000_000n);

    await fixture.token.mint(fixture.outsider.address, 200);
    await fixture.token.connect(fixture.outsider).approve(fixture.vaultAddress, 200);
    await expect(fixture.protocol.connect(fixture.outsider).depositReserveCapital(
      fixture.lineId,
      100,
      0,
      commitment("forbidden wipe dilution"),
    )).to.be.revertedWithCustomError(fixture.protocol, "InvalidState");
    await fixture.protocol.connect(fixture.outsider).recordReserveEarnings(
      fixture.lineId,
      100,
      commitment("wiped share revival"),
    );
    const revivedQuote = await fixture.protocol.contributorDepositQuote(fixture.lineId, 100);
    expect(revivedQuote).to.not.equal(0n);
    await fixture.protocol.connect(fixture.outsider).depositReserveCapital(
      fixture.lineId,
      100,
      revivedQuote,
      commitment("post revival capital"),
    );
    expect(await fixture.protocol.contributorShares(fixture.lineId, fixture.outsider.address))
      .to.equal(revivedQuote);
  });

  it("keeps an unfunded line from consuming a funded sibling line in the same plan", async function () {
    const fixture = await networkHelpers.loadFixture(deployBackstopFixture);
    const sibling = await createBackstopLine(fixture, "same plan sibling");
    const { claim } = await finalizeApprovedClaim(fixture, fixture.lineId, 100n, "same plan unfunded");
    const siblingShares = await depositCapital(
      fixture,
      sibling.lineId,
      fixture.contributor,
      100n,
      "same plan funded sibling",
    );
    await expect(fixture.protocol.connect(fixture.outsider).reserveObligation(claim.obligationId))
      .to.be.revertedWithCustomError(fixture.protocol, "InsufficientReserveLiquidity")
      .withArgs(0, 100);
    expect(await fixture.protocol.contributorExitQuote(sibling.lineId, siblingShares)).to.equal(100n);
    await fixture.protocol.connect(fixture.contributor).withdrawReserveCapital(
      sibling.lineId,
      siblingShares,
      100,
      fixture.contributor.address,
    );
    const planSheet = await fixture.protocol.planBalanceSheet(
      fixture.planId,
      await fixture.token.getAddress(),
    );
    expect(planSheet.funded).to.equal(0n);
    expect(planSheet.owed).to.equal(100n);
    expect(planSheet.returned).to.equal(100n);
  });

  it("keeps an unfunded plan from consuming a funded sibling plan in the same domain", async function () {
    const fixture = await networkHelpers.loadFixture(deployBackstopFixture);
    const sibling = await createBackstopLine(fixture, "cross plan sibling", { newPlan: true });
    const { claim } = await finalizeApprovedClaim(fixture, fixture.lineId, 100n, "cross plan unfunded");
    const siblingShares = await depositCapital(
      fixture,
      sibling.lineId,
      fixture.contributor,
      100n,
      "cross plan funded sibling",
    );
    await expect(fixture.protocol.connect(fixture.outsider).reserveObligation(claim.obligationId))
      .to.be.revertedWithCustomError(fixture.protocol, "InsufficientReserveLiquidity");
    await fixture.protocol.connect(fixture.contributor).withdrawReserveCapital(
      sibling.lineId,
      siblingShares,
      100,
      fixture.contributor.address,
    );
    const domainSheet = await fixture.protocol.domainBalanceSheet(
      fixture.domainId,
      await fixture.token.getAddress(),
    );
    expect(domainSheet.funded).to.equal(0n);
    expect(domainSheet.owed).to.equal(100n);
    expect(domainSheet.returned).to.equal(100n);
    expect((await fixture.protocol.planBalanceSheet(sibling.planId, await fixture.token.getAddress())).owed)
      .to.equal(0n);
  });

  it("permissionlessly recapitalizes only finalized deficits despite inactive scopes and intake caps", async function () {
    const fixture = await networkHelpers.loadFixture(deployBackstopFixture);
    const capped = await createBackstopLine(fixture, "capped recap", { capitalCap: 150n });
    await depositCapital(fixture, capped.lineId, fixture.contributor, 100n, "capped initial capital");
    const { claim } = await finalizeApprovedClaim(fixture, capped.lineId, 200n, "capped liability");
    expect((await fixture.protocol.lineBalanceSheet(capped.lineId)).owed).to.equal(200n);
    await fixture.protocol.connect(fixture.domainController).setDomainControls(fixture.domainId, false, 0);
    await fixture.protocol.connect(fixture.planController).setPlanControls(capped.planId, false, 0);

    await expect(fixture.protocol.connect(fixture.outsider).recapitalizeLine(
      fixture.lineId,
      1,
      commitment("no liability recap"),
    )).to.be.revertedWithCustomError(fixture.protocol, "InvalidState");
    await expect(fixture.protocol.connect(fixture.outsider).recapitalizeLine(
      capped.lineId,
      101,
      commitment("excess recap"),
    )).to.be.revertedWithCustomError(fixture.protocol, "RecapitalizationExceedsDeficit")
      .withArgs(100, 101);

    await fixture.token.mint(fixture.outsider.address, 100);
    await fixture.token.connect(fixture.outsider).approve(fixture.vaultAddress, 100);
    await fixture.protocol.connect(fixture.outsider).recapitalizeLine(
      capped.lineId,
      100,
      commitment("permissionless exact recap"),
    );
    expect((await fixture.protocol.getFundingLine(capped.lineId)).grossFunded).to.equal(200n);
    await fixture.protocol.connect(fixture.outsider).reserveObligation(claim.obligationId);
    await fixture.protocol.connect(fixture.relayer).settleObligation(claim.obligationId);
    expect(await fixture.token.balanceOf(fixture.payoutRecipient.address)).to.equal(200n);
    const sheet = await fixture.protocol.lineBalanceSheet(capped.lineId);
    expect(sheet.funded).to.equal(0n);
    expect(sheet.owed).to.equal(0n);
    expect(sheet.reserved).to.equal(0n);
  });

  it("permits exactly one challenge round and permissionless fallback finality", async function () {
    const fixture = await networkHelpers.loadFixture(deployBackstopFixture);
    const { claimId } = await depositAndOpenClaim(fixture, 1_000n, 300n);
    await reachInitialDecision(fixture, claimId, false, 0n, "denial");
    expect((await fixture.protocol.lineBalanceSheet(fixture.lineId)).pendingClaims).to.equal(0n);

    await fixture.protocol.connect(fixture.claimant).challengeClaim(claimId, commitment("counter evidence"));
    await expect(
      fixture.protocol.connect(fixture.claimant).challengeClaim(claimId, commitment("second challenge")),
    ).to.be.revertedWithCustomError(fixture.protocol, "ChallengeAlreadyUsed");

    const appealDecision = commitment("appeal approval");
    await fixture.protocol
      .connect(fixture.attesterOne)
      .attestClaim(claimId, true, 300, appealDecision);
    await fixture.protocol
      .connect(fixture.attesterThree)
      .attestClaim(claimId, true, 300, appealDecision);
    expect((await fixture.protocol.lineBalanceSheet(fixture.lineId)).pendingClaims).to.equal(300n);
    expect(await fixture.protocol.freeLineAssets(fixture.lineId)).to.equal(700n);
    await expect(fixture.protocol.connect(fixture.outsider).finalizeClaimCase(claimId))
      .to.be.revertedWithCustomError(fixture.protocol, "ChallengeWindowOpen");

    await networkHelpers.time.increase(3_601);
    await fixture.protocol.connect(fixture.outsider).finalizeClaimCase(claimId);
    const claim = await fixture.protocol.getClaim(claimId);
    expect(claim.status).to.equal(4n);
    expect(claim.approvedAmount).to.equal(300n);
    await fixture.protocol.connect(fixture.outsider).reserveObligation(claim.obligationId);
    await expect(fixture.protocol.connect(fixture.relayer).settleClaimCase(claimId))
      .to.emit(fixture.protocol, "ClaimCaseStateChanged")
      .withArgs(claimId, 6, 300, appealDecision);
  });

  it("rejects challenge-round attestations after the decision deadline", async function () {
    const fixture = await networkHelpers.loadFixture(deployBackstopFixture);
    const { claimId } = await depositAndOpenClaim(fixture, 1_000n, 300n);
    await reachInitialDecision(fixture, claimId, false, 0n, "timely initial denial");
    await fixture.protocol
      .connect(fixture.claimant)
      .challengeClaim(claimId, commitment("timely counter evidence"));

    await networkHelpers.time.increase(3_601);
    await expect(
      fixture.protocol
        .connect(fixture.attesterOne)
        .attestClaim(claimId, true, 300, commitment("late appeal approval")),
    ).to.be.revertedWithCustomError(fixture.protocol, "ChallengeWindowClosed");

    await fixture.protocol.connect(fixture.outsider).finalizeClaimCase(claimId);
    const claim = await fixture.protocol.getClaim(claimId);
    expect(claim.status).to.equal(5n);
    expect(claim.approvedAmount).to.equal(0n);
  });

  it("revalidates a claim recipient at settlement against newly deployed CREATE2 vaults", async function () {
    const fixture = await networkHelpers.loadFixture(deployBackstopFixture);
    await fixture.token.mint(fixture.contributor.address, 500);
    await fixture.token.connect(fixture.contributor).approve(fixture.vaultAddress, 500);
    await fixture.protocol
      .connect(fixture.contributor)
      .depositReserveCapital(fixture.lineId, 500, 0, commitment("future vault guard capital"));

    const futureToken = await ethers.deployContract("MockERC20", ["Future Reserve USD", "frUSD"]);
    const protocolAddress = await fixture.protocol.getAddress();
    const futureTokenAddress = await futureToken.getAddress();
    const deploymentSalt = ethers.keccak256(
      ethers.AbiCoder.defaultAbiCoder().encode(
        ["bytes32", "address"],
        [fixture.domainId, futureTokenAddress],
      ),
    );
    const vaultFactory = await ethers.getContractFactory("ReserveVault");
    const initCode = ethers.concat([
      vaultFactory.bytecode,
      ethers.AbiCoder.defaultAbiCoder().encode(
        ["address", "bytes32", "address"],
        [protocolAddress, fixture.domainId, futureTokenAddress],
      ),
    ]);
    const futureVault = ethers.getCreate2Address(
      protocolAddress,
      deploymentSalt,
      ethers.keccak256(initCode),
    );
    expect(await ethers.provider.getCode(futureVault)).to.equal("0x");

    const nullifier = commitment("future vault nullifier");
    const claimId = await fixture.protocol.deriveClaimId(
      fixture.planId,
      fixture.claimant.address,
      nullifier,
    );
    await fixture.protocol
      .connect(fixture.claimant)
      .openClaimCase(
        fixture.lineId,
        commitment("future vault claim"),
        nullifier,
        futureVault,
        200,
      );
    await reachInitialDecision(fixture, claimId, true, 200n, "future vault approval");
    await networkHelpers.time.increase(3_601);
    await fixture.protocol.connect(fixture.relayer).finalizeClaimCase(claimId);
    const claim = await fixture.protocol.getClaim(claimId);
    await fixture.protocol.connect(fixture.outsider).reserveObligation(claim.obligationId);

    await fixture.protocol
      .connect(fixture.outsider)
      .createDomainAssetVault(fixture.domainId, futureTokenAddress);
    expect(await fixture.protocol.reserveVaults(fixture.domainId, futureTokenAddress)).to.equal(
      futureVault,
    );
    expect(await fixture.protocol.isReserveVault(futureVault)).to.equal(true);
    await expect(
      fixture.protocol.connect(fixture.relayer).settleClaimCase(claimId),
    ).to.be.revertedWithCustomError(fixture.protocol, "InvalidAddress");
    expect((await fixture.protocol.getClaim(claimId)).status).to.equal(4n);
    expect((await fixture.protocol.getObligation(claim.obligationId)).status).to.equal(2n);
    expect(await fixture.token.balanceOf(futureVault)).to.equal(0n);
  });

  it("binds recipient authorization to EIP-712 chain, nonce, and deadline", async function () {
    const fixture = await networkHelpers.loadFixture(deployBackstopFixture);
    const { claimId } = await depositAndOpenClaim(fixture);
    const chainId = (await ethers.provider.getNetwork()).chainId;
    const verifyingContract = await fixture.protocol.getAddress();
    const deadline = BigInt(await networkHelpers.time.latest()) + 3_600n;
    const types = {
      ClaimRecipient: [
        { name: "claimId", type: "bytes32" },
        { name: "recipient", type: "address" },
        { name: "nonce", type: "uint256" },
        { name: "deadline", type: "uint256" },
      ],
    };
    const domain = {
      name: "Nakama Coverage Protocol",
      version: "1",
      chainId,
      verifyingContract,
    };
    const authorization = {
      claimId,
      recipient: fixture.alternateRecipient.address,
      nonce: 0,
      deadline,
    };
    const signature = await fixture.claimant.signTypedData(domain, types, authorization);

    await fixture.protocol
      .connect(fixture.relayer)
      .authorizeClaimRecipient(claimId, fixture.alternateRecipient.address, deadline, signature);
    expect((await fixture.protocol.getClaim(claimId)).payoutRecipient).to.equal(
      fixture.alternateRecipient.address,
    );
    await expect(
      fixture.protocol
        .connect(fixture.relayer)
        .authorizeClaimRecipient(claimId, fixture.alternateRecipient.address, deadline, signature),
    ).to.be.revertedWithCustomError(fixture.protocol, "InvalidSignature");

    const wrongChainSignature = await fixture.claimant.signTypedData(
      { ...domain, chainId: chainId + 1n },
      types,
      { ...authorization, nonce: 1 },
    );
    await expect(
      fixture.protocol
        .connect(fixture.relayer)
        .authorizeClaimRecipient(
          claimId,
          fixture.alternateRecipient.address,
          deadline,
          wrongChainSignature,
        ),
    ).to.be.revertedWithCustomError(fixture.protocol, "InvalidSignature");

    const expiredDeadline = BigInt(await networkHelpers.time.latest()) - 1n;
    const expiredSignature = await fixture.claimant.signTypedData(domain, types, {
      ...authorization,
      nonce: 1,
      deadline: expiredDeadline,
    });
    await expect(
      fixture.protocol
        .connect(fixture.relayer)
        .authorizeClaimRecipient(
          claimId,
          fixture.alternateRecipient.address,
          expiredDeadline,
          expiredSignature,
        ),
    ).to.be.revertedWithCustomError(fixture.protocol, "SignatureExpired");
  });

  it("uses full reservations and rejects underfunded obligations", async function () {
    const fixture = await networkHelpers.loadFixture(deployBackstopFixture);
    const { claimId } = await depositAndOpenClaim(fixture, 100n, 200n);
    await reachInitialDecision(fixture, claimId, true, 200n);
    await networkHelpers.time.increase(3_601);
    await fixture.protocol.connect(fixture.relayer).finalizeClaimCase(claimId);
    const claim = await fixture.protocol.getClaim(claimId);

    const reserveFunction = fixture.protocol.interface.getFunction("reserveObligation");
    expect(reserveFunction?.inputs).to.have.length(1);
    await expect(fixture.protocol.connect(fixture.outsider).reserveObligation(claim.obligationId))
      .to.be.revertedWithCustomError(fixture.protocol, "InsufficientReserveLiquidity")
      .withArgs(100, 200);
    expect(await fixture.protocol.freeLineAssets(fixture.lineId)).to.equal(0n);
  });

  it("rejects fee-on-transfer assets before accounting can diverge", async function () {
    const fixture = await networkHelpers.loadFixture(deployFeeTokenFixture);
    await fixture.token.mint(fixture.contributor.address, 1_000);
    await fixture.token.connect(fixture.contributor).approve(fixture.vaultAddress, 1_000);
    const vault = await ethers.getContractAt("ReserveVault", fixture.vaultAddress);

    await expect(
      fixture.protocol
        .connect(fixture.contributor)
        .depositReserveCapital(fixture.lineId, 1_000, 0, commitment("fee token deposit")),
    )
      .to.be.revertedWithCustomError(vault, "UnsupportedTokenBehavior")
      .withArgs(1_000, 1_000, 990);
    expect((await fixture.protocol.lineBalanceSheet(fixture.lineId)).funded).to.equal(0n);
    expect(await fixture.token.balanceOf(fixture.contributor.address)).to.equal(1_000n);
  });

  it("rejects tokens that debit more than the vault receives", async function () {
    const fixture = await networkHelpers.loadFixture(deploySenderFeeTokenFixture);
    await fixture.token.mint(fixture.contributor.address, 1_100);
    await fixture.token.connect(fixture.contributor).approve(fixture.vaultAddress, 1_000);
    const vault = await ethers.getContractAt("ReserveVault", fixture.vaultAddress);

    await expect(
      fixture.protocol
        .connect(fixture.contributor)
        .depositReserveCapital(fixture.lineId, 1_000, 0, commitment("sender fee token deposit")),
    )
      .to.be.revertedWithCustomError(vault, "UnsupportedTokenBehavior")
      .withArgs(1_000, 1_010, 1_000);
    expect((await fixture.protocol.lineBalanceSheet(fixture.lineId)).funded).to.equal(0n);
    expect(await fixture.token.balanceOf(fixture.contributor.address)).to.equal(1_100n);
  });

  it("blocks token callback reentrancy without rejecting the exact outer transfer", async function () {
    const fixture = await networkHelpers.loadFixture(deployReentrantTokenFixture);
    await fixture.token.mint(fixture.contributor.address, 1_000);
    await fixture.token.connect(fixture.contributor).approve(fixture.vaultAddress, 1_000);
    const callbackData = fixture.protocol.interface.encodeFunctionData("depositReserveCapital", [
      fixture.lineId,
      1,
      0,
      commitment("nested deposit"),
    ]);
    await fixture.token.armCallback(await fixture.protocol.getAddress(), callbackData);

    await fixture.protocol
      .connect(fixture.contributor)
      .depositReserveCapital(fixture.lineId, 100, 0, commitment("outer deposit"));
    expect(await fixture.token.callbackAttempted()).to.equal(true);
    expect(await fixture.token.callbackSucceeded()).to.equal(false);
    expect((await fixture.protocol.lineBalanceSheet(fixture.lineId)).funded).to.equal(100n);
    expect(await fixture.protocol.contributorShares(fixture.lineId, fixture.contributor.address)).to.equal(
      100_000_000n,
    );
  });

  it("blocks reserve-vault registry mutation during an exact withdrawal transfer", async function () {
    const fixture = await networkHelpers.loadFixture(deployReentrantTokenFixture);
    await fixture.token.mint(fixture.contributor.address, 100);
    await fixture.token.connect(fixture.contributor).approve(fixture.vaultAddress, 100);
    await fixture.protocol
      .connect(fixture.contributor)
      .depositReserveCapital(fixture.lineId, 100, 0, commitment("registry guard capital"));

    const futureToken = await ethers.deployContract("MockERC20", ["Callback Vault Asset", "CVA"]);
    const callbackData = fixture.protocol.interface.encodeFunctionData("createDomainAssetVault", [
      fixture.domainId,
      await futureToken.getAddress(),
    ]);
    await fixture.token.armCallback(await fixture.protocol.getAddress(), callbackData);
    await fixture.protocol
      .connect(fixture.contributor)
      .withdrawReserveCapital(fixture.lineId, 10_000_000, 10, fixture.contributor.address);

    expect(await fixture.token.callbackAttempted()).to.equal(true);
    expect(await fixture.token.callbackSucceeded()).to.equal(false);
    expect(
      await fixture.protocol.reserveVaults(fixture.domainId, await futureToken.getAddress()),
    ).to.equal(ethers.ZeroAddress);
    expect(await fixture.token.balanceOf(fixture.contributor.address)).to.equal(10n);
    expect((await fixture.protocol.lineBalanceSheet(fixture.lineId)).funded).to.equal(90n);
  });

  it("has no global owner, upgrade, or global pause surface", async function () {
    const fixture = await networkHelpers.loadFixture(deployBackstopFixture);
    expect(fixture.protocol.interface.getFunction("owner")).to.equal(null);
    expect(fixture.protocol.interface.getFunction("upgradeToAndCall")).to.equal(null);
    expect(fixture.protocol.interface.getFunction("pause")).to.equal(null);
    expect(fixture.protocol.interface.getFunction("createObligation")).to.equal(null);
    await expect(
      fixture.protocol
        .connect(fixture.outsider)
        .proposeDomainController(fixture.domainId, fixture.outsider.address),
    ).to.be.revertedWithCustomError(fixture.protocol, "Unauthorized");
  });
});
