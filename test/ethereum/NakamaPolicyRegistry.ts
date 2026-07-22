import { expect } from "chai";
import { network } from "hardhat";

const { ethers, networkHelpers } = await network.create();

const HOUR = 3_600n;
const COVERAGE_DURATION = 30n * 24n * HOUR;
const DEFAULT_COVERAGE = 1_000n;
const DEFAULT_PREMIUM = 50n;

const commitment = (label: string) =>
  ethers.keccak256(ethers.toUtf8Bytes(label));

async function deployFixture(
  tokenName:
    | "MockERC20"
    | "FeeOnTransferERC20"
    | "SenderFeeERC20"
    | "ReentrantERC20" = "MockERC20"
) {
  const [
    domainController,
    planController,
    attesterOne,
    attesterTwo,
    attesterThree,
    claimant,
    secondHolder,
    contributor,
    relayer,
    payoutRecipient,
    alternateRecipient,
    outsider,
  ] = await ethers.getSigners();

  const factory = await ethers.deployContract("NakamaProtocolFactory");
  const protocol = await ethers.getContractAt(
    "NakamaCoverageProtocol",
    await factory.protocol()
  );
  const registry = await ethers.getContractAt(
    "NakamaPolicyRegistry",
    await factory.policyRegistry()
  );
  const token =
    tokenName === "MockERC20"
      ? await ethers.deployContract("MockERC20", ["Reserve USD", "rUSD"])
      : await ethers.deployContract(tokenName);

  const domainSalt = commitment(`registry-domain-${tokenName}`);
  const domainId = await protocol.deriveDomainId(
    domainController.address,
    domainSalt
  );
  await protocol
    .connect(domainController)
    .createReserveDomain(domainSalt, commitment("domain metadata"));
  await protocol
    .connect(outsider)
    .createDomainAssetVault(domainId, await token.getAddress());
  const vaultAddress = await protocol.reserveVaults(
    domainId,
    await token.getAddress()
  );

  const planSalt = commitment(`registry-plan-${tokenName}`);
  const planId = await protocol.derivePlanId(domainId, planSalt);
  await protocol
    .connect(domainController)
    .createHealthPlan(
      domainId,
      planSalt,
      planController.address,
      commitment("plan metadata"),
      [attesterOne.address, attesterTwo.address, attesterThree.address]
    );

  const seriesSalt = commitment(`registry-series-${tokenName}`);
  const coverageSalt = commitment(`registry-coverage-${tokenName}`);
  const premiumSalt = commitment(`registry-premium-${tokenName}`);
  const seriesId = await protocol.deriveSeriesId(planId, seriesSalt);
  await protocol
    .connect(planController)
    .createPolicySeries(
      planId,
      seriesSalt,
      await token.getAddress(),
      coverageSalt,
      premiumSalt,
      ethers.ZeroHash,
      COVERAGE_DURATION,
      HOUR,
      HOUR,
      DEFAULT_COVERAGE,
      DEFAULT_PREMIUM,
      10_000n,
      commitment("series terms")
    );

  const coverageLineId = await protocol.deriveFundingLineId(
    planId,
    coverageSalt
  );
  await protocol
    .connect(planController)
    .openFundingLine(
      planId,
      seriesId,
      coverageSalt,
      2,
      1_000_000n,
      commitment("coverage line terms")
    );
  const premiumLineId = await protocol.deriveFundingLineId(planId, premiumSalt);
  await protocol
    .connect(planController)
    .openFundingLine(
      planId,
      seriesId,
      premiumSalt,
      1,
      1_000_000n,
      commitment("premium line terms")
    );

  return {
    factory,
    protocol,
    registry,
    token,
    vaultAddress,
    domainId,
    planId,
    seriesId,
    coverageLineId,
    premiumLineId,
    domainController,
    planController,
    attesterOne,
    attesterTwo,
    attesterThree,
    claimant,
    secondHolder,
    contributor,
    relayer,
    payoutRecipient,
    alternateRecipient,
    outsider,
  };
}

type Fixture = Awaited<ReturnType<typeof deployFixture>>;

async function deployMockFixture() {
  return deployFixture("MockERC20");
}

async function deployFeeTokenFixture() {
  return deployFixture("FeeOnTransferERC20");
}

async function deployReentrantTokenFixture() {
  return deployFixture("ReentrantERC20");
}

async function deploySenderFeeTokenFixture() {
  return deployFixture("SenderFeeERC20");
}

async function fundBackstop(
  fixture: Fixture,
  amount: bigint,
  lineId = fixture.coverageLineId
) {
  await fixture.token.mint(fixture.contributor.address, amount);
  await fixture.token
    .connect(fixture.contributor)
    .approve(fixture.vaultAddress, amount);
  await fixture.protocol
    .connect(fixture.contributor)
    .depositReserveCapital(
      lineId,
      amount,
      0,
      commitment(`capital-${lineId}-${amount}`)
    );
}

async function depositCapital(
  fixture: Fixture,
  lineId: string,
  contributor: Fixture["contributor"],
  amount: bigint,
  label: string
) {
  await fixture.token.mint(contributor.address, amount);
  await fixture.token
    .connect(contributor)
    .approve(fixture.vaultAddress, amount);
  await fixture.protocol
    .connect(contributor)
    .depositReserveCapital(lineId, amount, 0, commitment(`${label}-capital`));
  return fixture.protocol.contributorShares(lineId, contributor.address);
}

async function activate(
  fixture: Fixture,
  holder = fixture.claimant,
  {
    seriesId = fixture.seriesId,
    premiumAmount = DEFAULT_PREMIUM,
    proof = [] as string[],
  } = {}
) {
  await fixture.token.mint(holder.address, premiumAmount);
  await fixture.token
    .connect(holder)
    .approve(fixture.vaultAddress, premiumAmount);
  await fixture.protocol
    .connect(holder)
    .activatePolicyPosition(seriesId, proof);
  return fixture.registry.derivePositionId(seriesId, holder.address);
}

async function fundedPosition(fixture: Fixture, holder = fixture.claimant) {
  await fundBackstop(fixture, DEFAULT_COVERAGE - DEFAULT_PREMIUM);
  return activate(fixture, holder);
}

async function openClaim(
  fixture: Fixture,
  positionId: string,
  requestedAmount: bigint,
  label: string,
  claimant = fixture.claimant
) {
  const nullifier = commitment(`${label}-nullifier`);
  const claimId = await fixture.registry.deriveClaimId(
    positionId,
    claimant.address,
    nullifier
  );
  await fixture.protocol
    .connect(claimant)
    .openClaimCase(
      positionId,
      commitment(`${label}-claim`),
      nullifier,
      fixture.payoutRecipient.address,
      requestedAmount
    );
  return { claimId, nullifier };
}

async function reachQuorum(
  fixture: Fixture,
  claimId: string,
  approve: boolean,
  amount: bigint,
  label: string
) {
  const decision = commitment(label);
  await fixture.protocol
    .connect(fixture.attesterOne)
    .attestClaim(claimId, approve, amount, decision);
  await fixture.protocol
    .connect(fixture.attesterTwo)
    .attestClaim(claimId, approve, amount, decision);
  return decision;
}

async function advanceToDecisionDeadline(fixture: Fixture, claimId: string) {
  const claim = await fixture.registry.getClaim(claimId);
  await networkHelpers.time.increaseTo(claim.decisionDeadline);
}

async function expectSoundSheets(
  fixture: Fixture,
  lineId = fixture.coverageLineId
) {
  const line = await fixture.protocol.getFundingLine(lineId);
  const asset = await fixture.token.getAddress();
  const sheets = [
    await fixture.protocol.lineBalanceSheet(lineId),
    await fixture.protocol.planBalanceSheet(line.planId, asset),
    await fixture.protocol.domainBalanceSheet(fixture.domainId, asset),
  ];
  for (const sheet of sheets) {
    expect(sheet.reserved <= sheet.owed).to.equal(true);
    expect(
      sheet.owed + sheet.pendingClaims + sheet.openExposure <= sheet.funded
    ).to.equal(true);
  }
}

async function createSeriesAndLines(
  fixture: Fixture,
  label: string,
  {
    coverageLimit = 100n,
    premiumAmount = 25n,
    exposureCap = 1_000n,
    eligibilityRoot = ethers.ZeroHash,
    coverageLineType = 2,
    coverageCapitalCap = 1_000_000n,
    premiumReceiptCap = 1_000_000n,
  } = {}
) {
  const salt = commitment(`${label}-series`);
  const coverageSalt = commitment(`${label}-coverage-line`);
  const premiumSalt = commitment(`${label}-premium-line`);
  const seriesId = await fixture.protocol.deriveSeriesId(fixture.planId, salt);
  await fixture.protocol
    .connect(fixture.planController)
    .createPolicySeries(
      fixture.planId,
      salt,
      await fixture.token.getAddress(),
      coverageSalt,
      premiumSalt,
      eligibilityRoot,
      COVERAGE_DURATION,
      HOUR,
      HOUR,
      coverageLimit,
      premiumAmount,
      exposureCap,
      commitment(`${label}-terms`)
    );
  const coverageLineId = await fixture.protocol.deriveFundingLineId(
    fixture.planId,
    coverageSalt
  );
  await fixture.protocol
    .connect(fixture.planController)
    .openFundingLine(
      fixture.planId,
      seriesId,
      coverageSalt,
      coverageLineType,
      coverageCapitalCap,
      commitment(`${label}-coverage-terms`)
    );
  const premiumLineId = await fixture.protocol.deriveFundingLineId(
    fixture.planId,
    premiumSalt
  );
  await fixture.protocol
    .connect(fixture.planController)
    .openFundingLine(
      fixture.planId,
      seriesId,
      premiumSalt,
      1,
      premiumReceiptCap,
      commitment(`${label}-premium-terms`)
    );
  return { seriesId, coverageLineId, premiumLineId };
}

describe("Nakama immutable registry/core pair", function () {
  it("deploys the registry at factory nonce one and the mutually bound core at nonce two", async function () {
    const fixture = await networkHelpers.loadFixture(deployMockFixture);
    const factoryAddress = await fixture.factory.getAddress();
    const predictedRegistry = ethers.getCreateAddress({
      from: factoryAddress,
      nonce: 1,
    });
    const predictedCore = ethers.getCreateAddress({
      from: factoryAddress,
      nonce: 2,
    });

    expect(await fixture.registry.getAddress()).to.equal(predictedRegistry);
    expect(await fixture.protocol.getAddress()).to.equal(predictedCore);
    expect(await fixture.registry.core()).to.equal(predictedCore);
    expect(await fixture.protocol.policyRegistry()).to.equal(predictedRegistry);
    expect(fixture.factory.interface.getFunction("owner")).to.equal(null);
    expect(fixture.factory.interface.getFunction("upgradeTo")).to.equal(null);

    await expect(
      fixture.registry
        .connect(fixture.outsider)
        .expirePolicyPosition(commitment("unknown-position"))
    ).to.be.revertedWithCustomError(fixture.registry, "OnlyCore");
  });

  it("rejects direct calls to every registry mutation", async function () {
    const fixture = await networkHelpers.loadFixture(deployMockFixture);
    const outsiderRegistry = fixture.registry.connect(fixture.outsider);
    const series = await fixture.registry.getPolicySeries(fixture.seriesId);
    const seriesInput = {
      planId: series.planId,
      coverageLineId: series.coverageLineId,
      premiumLineId: series.premiumLineId,
      assetToken: series.assetToken,
      eligibilityRoot: series.eligibilityRoot,
      coverageDuration: series.coverageDuration,
      initialDecisionWindow: series.initialDecisionWindow,
      challengeWindow: series.challengeWindow,
      attesterThreshold: series.attesterThreshold,
      coverageLimit: series.coverageLimit,
      premiumAmount: series.premiumAmount,
      exposureCap: series.exposureCap,
      termsCommitment: series.termsCommitment,
      outstandingExposure: 0n,
    };
    const unknown = commitment("only-core-unknown");
    const mutations = [
      () => outsiderRegistry.registerPolicySeries(unknown, seriesInput),
      () =>
        outsiderRegistry.activatePolicyPosition(
          fixture.seriesId,
          fixture.outsider.address,
          []
        ),
      () => outsiderRegistry.expirePolicyPosition(unknown),
      () =>
        outsiderRegistry.openClaimCase(
          unknown,
          fixture.outsider.address,
          commitment("only-core-claim"),
          commitment("only-core-nullifier"),
          fixture.outsider.address,
          1n
        ),
      () =>
        outsiderRegistry.authorizeClaimRecipient(
          unknown,
          fixture.outsider.address,
          1n,
          "0x"
        ),
      () =>
        outsiderRegistry.attestClaim(
          unknown,
          fixture.outsider.address,
          false,
          0n,
          unknown
        ),
      () =>
        outsiderRegistry.challengeClaim(
          unknown,
          fixture.outsider.address,
          unknown
        ),
      () => outsiderRegistry.finalizeClaimCase(unknown),
      () => outsiderRegistry.markClaimSettled(unknown, unknown),
    ];
    for (const mutate of mutations) {
      await expect(mutate()).to.be.revertedWithCustomError(
        fixture.registry,
        "OnlyCore"
      );
    }
  });

  it("freezes full series terms and sources the threshold from the immutable plan", async function () {
    const fixture = await networkHelpers.loadFixture(deployMockFixture);
    const series = await fixture.registry.getPolicySeries(fixture.seriesId);
    expect(series.planId).to.equal(fixture.planId);
    expect(series.assetToken).to.equal(await fixture.token.getAddress());
    expect(series.coverageDuration).to.equal(COVERAGE_DURATION);
    expect(series.initialDecisionWindow).to.equal(HOUR);
    expect(series.challengeWindow).to.equal(HOUR);
    expect(series.attesterThreshold).to.equal(2n);
    expect(series.coverageLimit).to.equal(DEFAULT_COVERAGE);
    expect(series.premiumAmount).to.equal(DEFAULT_PREMIUM);
    expect(series.exposureCap).to.equal(10_000n);
    expect(series.outstandingExposure).to.equal(0n);
    expect(series.coverageLineId).to.equal(fixture.coverageLineId);
    expect(series.premiumLineId).to.equal(fixture.premiumLineId);

    await expect(
      fixture.protocol
        .connect(fixture.planController)
        .createPolicySeries(
          fixture.planId,
          commitment("line-reuse-series"),
          await fixture.token.getAddress(),
          commitment("registry-coverage-MockERC20"),
          commitment("line-reuse-premium"),
          ethers.ZeroHash,
          COVERAGE_DURATION,
          HOUR,
          HOUR,
          100,
          1,
          100,
          commitment("line-reuse-terms")
        )
    )
      .to.be.revertedWithCustomError(fixture.registry, "AlreadyExists")
      .withArgs(fixture.coverageLineId);

    await expect(
      fixture.protocol
        .connect(fixture.planController)
        .createPolicySeries(
          fixture.planId,
          commitment("too-long-series"),
          await fixture.token.getAddress(),
          commitment("too-long-coverage-line"),
          commitment("too-long-premium-line"),
          ethers.ZeroHash,
          5n * 365n * 24n * HOUR + 1n,
          HOUR,
          HOUR,
          100,
          1,
          100,
          commitment("too-long-terms")
        )
    ).to.be.revertedWithCustomError(fixture.protocol, "InvalidAmount");

    await expect(
      fixture.protocol
        .connect(fixture.planController)
        .createPolicySeries(
          fixture.planId,
          commitment("premium-above-coverage-series"),
          await fixture.token.getAddress(),
          commitment("premium-above-coverage-line"),
          commitment("premium-above-coverage-receipts"),
          ethers.ZeroHash,
          COVERAGE_DURATION,
          HOUR,
          HOUR,
          100n,
          101n,
          100n,
          commitment("premium-above-coverage-terms")
        )
    ).to.be.revertedWithCustomError(fixture.protocol, "InvalidAmount");
  });

  it("rejects wrong series controllers, position holders, attesters, and challengers", async function () {
    const fixture = await networkHelpers.loadFixture(deployMockFixture);
    await expect(
      fixture.protocol
        .connect(fixture.outsider)
        .createPolicySeries(
          fixture.planId,
          commitment("unauthorized-series"),
          await fixture.token.getAddress(),
          commitment("unauthorized-coverage"),
          commitment("unauthorized-premium"),
          ethers.ZeroHash,
          COVERAGE_DURATION,
          HOUR,
          HOUR,
          100n,
          10n,
          100n,
          commitment("unauthorized-series-terms")
        )
    ).to.be.revertedWithCustomError(fixture.protocol, "Unauthorized");
    await expect(
      fixture.protocol
        .connect(fixture.outsider)
        .openFundingLine(
          fixture.planId,
          fixture.seriesId,
          commitment("unauthorized-line"),
          2,
          1_000n,
          commitment("unauthorized-line-terms")
        )
    ).to.be.revertedWithCustomError(fixture.protocol, "Unauthorized");

    const positionId = await fundedPosition(fixture);
    await expect(
      fixture.protocol
        .connect(fixture.secondHolder)
        .openClaimCase(
          positionId,
          commitment("wrong-holder-claim"),
          commitment("wrong-holder-nullifier"),
          fixture.payoutRecipient.address,
          100n
        )
    ).to.be.revertedWithCustomError(fixture.registry, "Unauthorized");

    const { claimId } = await openClaim(
      fixture,
      positionId,
      100n,
      "actor-boundaries"
    );
    await expect(
      fixture.protocol
        .connect(fixture.outsider)
        .attestClaim(claimId, true, 100n, commitment("outsider-vote"))
    ).to.be.revertedWithCustomError(fixture.protocol, "Unauthorized");
    await reachQuorum(fixture, claimId, true, 100n, "authorized-vote");
    await expect(
      fixture.protocol
        .connect(fixture.outsider)
        .challengeClaim(claimId, commitment("outsider-challenge"))
    ).to.be.revertedWithCustomError(fixture.registry, "Unauthorized");
  });

  it("rejects line caps that make immutable coverage or premium terms unactivatable", async function () {
    const fixture = await networkHelpers.loadFixture(deployMockFixture);
    const splitSalt = commitment("cap-viability-split-series");
    const splitCoverageSalt = commitment("cap-viability-split-coverage");
    const splitPremiumSalt = commitment("cap-viability-split-premium");
    const splitSeriesId = await fixture.protocol.deriveSeriesId(
      fixture.planId,
      splitSalt
    );
    await fixture.protocol
      .connect(fixture.planController)
      .createPolicySeries(
        fixture.planId,
        splitSalt,
        await fixture.token.getAddress(),
        splitCoverageSalt,
        splitPremiumSalt,
        ethers.ZeroHash,
        COVERAGE_DURATION,
        HOUR,
        HOUR,
        100n,
        25n,
        100n,
        commitment("cap-viability-split-terms")
      );
    await expect(
      fixture.protocol
        .connect(fixture.planController)
        .openFundingLine(
          fixture.planId,
          splitSeriesId,
          splitCoverageSalt,
          1,
          100n,
          commitment("premium-income-coverage-line")
        )
    ).to.be.revertedWithCustomError(fixture.protocol, "InvalidFundingLineType");
    await expect(
      fixture.protocol
        .connect(fixture.planController)
        .openFundingLine(
          fixture.planId,
          splitSeriesId,
          splitCoverageSalt,
          2,
          99n,
          commitment("short-coverage-cap")
        )
    )
      .to.be.revertedWithCustomError(fixture.protocol, "CapitalCapTooLow")
      .withArgs(100n, 99n);
    await fixture.protocol
      .connect(fixture.planController)
      .openFundingLine(
        fixture.planId,
        splitSeriesId,
        splitCoverageSalt,
        2,
        100n,
        commitment("exact-coverage-cap")
      );
    await expect(
      fixture.protocol
        .connect(fixture.planController)
        .openFundingLine(
          fixture.planId,
          splitSeriesId,
          splitPremiumSalt,
          1,
          24n,
          commitment("short-premium-cap")
        )
    )
      .to.be.revertedWithCustomError(fixture.protocol, "CapitalCapTooLow")
      .withArgs(25n, 24n);

    const sameSalt = commitment("cap-viability-same-series");
    const sameLineSalt = commitment("cap-viability-same-line");
    await expect(
      fixture.protocol
        .connect(fixture.planController)
        .createPolicySeries(
          fixture.planId,
          sameSalt,
          await fixture.token.getAddress(),
          sameLineSalt,
          sameLineSalt,
          ethers.ZeroHash,
          COVERAGE_DURATION,
          HOUR,
          HOUR,
          100n,
          100n,
          100n,
          commitment("cap-viability-same-terms")
        )
    ).to.be.revertedWithCustomError(fixture.protocol, "InvalidBinding");
  });

  it("allows exposure exactly at the series cap and rejects the next position atomically", async function () {
    const fixture = await networkHelpers.loadFixture(deployMockFixture);
    const capped = await createSeriesAndLines(fixture, "exposure-cap", {
      coverageLimit: 10n,
      premiumAmount: 10n,
      exposureCap: 20n,
    });
    await fundBackstop(fixture, 20n, capped.coverageLineId);
    await activate(fixture, fixture.claimant, {
      ...capped,
      premiumAmount: 10n,
    });
    await activate(fixture, fixture.secondHolder, {
      ...capped,
      premiumAmount: 10n,
    });

    const rejectedPosition = await fixture.registry.derivePositionId(
      capped.seriesId,
      fixture.outsider.address
    );
    await expect(
      activate(fixture, fixture.outsider, { ...capped, premiumAmount: 10n })
    )
      .to.be.revertedWithCustomError(fixture.registry, "ExposureCapExceeded")
      .withArgs(20n, 30n);
    await expect(
      fixture.registry.getPolicyPosition(rejectedPosition)
    ).to.be.revertedWithCustomError(fixture.registry, "DoesNotExist");
    expect(
      (await fixture.registry.getPolicySeries(capped.seriesId))
        .outstandingExposure
    ).to.equal(20n);
    expect(
      (await fixture.protocol.lineBalanceSheet(capped.coverageLineId))
        .openExposure
    ).to.equal(20n);
    expect(
      (await fixture.protocol.lineBalanceSheet(capped.premiumLineId)).funded
    ).to.equal(0n);
    expect(
      (await fixture.protocol.lineBalanceSheet(capped.coverageLineId)).funded
    ).to.equal(40n);
  });

  it("uses canonical eligibility proofs and makes renewal an explicit new-series action", async function () {
    const fixture = await networkHelpers.loadFixture(deployMockFixture);
    const holderLeaf = await fixture.registry.eligibilityLeaf(
      fixture.claimant.address
    );
    const gated = await createSeriesAndLines(fixture, "gated", {
      eligibilityRoot: holderLeaf,
      coverageLimit: 100n,
      premiumAmount: 10n,
      exposureCap: 200n,
    });
    await fundBackstop(fixture, 200n, gated.coverageLineId);

    const positionId = await activate(fixture, fixture.claimant, {
      ...gated,
      premiumAmount: 10n,
      proof: [],
    });
    expect(
      (await fixture.registry.getPolicyPosition(positionId)).holder
    ).to.equal(fixture.claimant.address);
    await expect(
      activate(fixture, fixture.claimant, {
        ...gated,
        premiumAmount: 10n,
        proof: [],
      })
    ).to.be.revertedWithCustomError(fixture.registry, "AlreadyExists");
    await expect(
      activate(fixture, fixture.secondHolder, {
        ...gated,
        premiumAmount: 10n,
        proof: [],
      })
    ).to.be.revertedWithCustomError(
      fixture.registry,
      "InvalidEligibilityProof"
    );

    await expect(
      activate(fixture, fixture.secondHolder, { proof: [holderLeaf] })
    ).to.be.revertedWithCustomError(
      fixture.registry,
      "InvalidEligibilityProof"
    );

    const renewal = await createSeriesAndLines(fixture, "renewal", {
      coverageLimit: 100n,
      premiumAmount: 10n,
    });
    await fundBackstop(fixture, 100n, renewal.coverageLineId);
    const renewalPosition = await activate(fixture, fixture.claimant, {
      ...renewal,
      premiumAmount: 10n,
    });
    expect(renewalPosition).not.to.equal(positionId);

    const sharedNullifier = commitment("position-scoped-nullifier");
    const firstClaimId = await fixture.registry.deriveClaimId(
      positionId,
      fixture.claimant.address,
      sharedNullifier
    );
    const renewalClaimId = await fixture.registry.deriveClaimId(
      renewalPosition,
      fixture.claimant.address,
      sharedNullifier
    );
    await fixture.protocol
      .connect(fixture.claimant)
      .openClaimCase(
        positionId,
        commitment("first series claim"),
        sharedNullifier,
        fixture.payoutRecipient.address,
        10n
      );
    await fixture.protocol
      .connect(fixture.claimant)
      .openClaimCase(
        renewalPosition,
        commitment("renewal series claim"),
        sharedNullifier,
        fixture.payoutRecipient.address,
        10n
      );
    expect(firstClaimId).not.to.equal(renewalClaimId);
  });

  it("credits only position-bound premiums to claims-paying reserves and cannot be cap-griefed", async function () {
    const fixture = await networkHelpers.loadFixture(deployMockFixture);
    const split = await createSeriesAndLines(fixture, "split-line", {
      coverageLimit: 100n,
      premiumAmount: 25n,
      exposureCap: 200n,
      coverageCapitalCap: 200n,
      premiumReceiptCap: 25n,
    });
    const ownerlessPosition = await fixture.registry.derivePositionId(
      split.seriesId,
      fixture.claimant.address
    );
    await expect(
      activate(fixture, fixture.claimant, {
        ...split,
        premiumAmount: 25n,
      })
    ).to.be.revertedWithCustomError(fixture.protocol, "ZeroShares");
    await expect(
      fixture.registry.getPolicyPosition(ownerlessPosition)
    ).to.be.revertedWithCustomError(fixture.registry, "DoesNotExist");
    await fundBackstop(fixture, 200n, split.coverageLineId);
    const firstPosition = await activate(fixture, fixture.claimant, {
      ...split,
      premiumAmount: 25n,
    });
    const secondPosition = await activate(fixture, fixture.secondHolder, {
      ...split,
      premiumAmount: 25n,
    });
    expect(
      (await fixture.registry.getPolicyPosition(firstPosition)).holder
    ).to.equal(fixture.claimant.address);
    expect(
      (await fixture.registry.getPolicyPosition(secondPosition)).holder
    ).to.equal(fixture.secondHolder.address);
    const derivedSecondPosition = await fixture.registry.derivePositionId(
      split.seriesId,
      fixture.secondHolder.address
    );
    expect(secondPosition).to.equal(derivedSecondPosition);
    expect(
      (await fixture.registry.getPolicySeries(split.seriesId))
        .outstandingExposure
    ).to.equal(200n);
    expect(
      (await fixture.protocol.lineBalanceSheet(split.premiumLineId)).funded
    ).to.equal(0n);
    const sheet = await fixture.protocol.lineBalanceSheet(split.coverageLineId);
    expect(sheet.funded).to.equal(250n);
    expect(sheet.openExposure).to.equal(200n);
    const premiumLine = await fixture.protocol.getFundingLine(
      split.premiumLineId
    );
    expect(premiumLine.grossFunded).to.equal(50n);
    expect(premiumLine.grossSpent).to.equal(50n);
    expect(
      (
        await fixture.protocol.planBalanceSheet(
          fixture.planId,
          await fixture.token.getAddress()
        )
      ).funded
    ).to.equal(250n);
    expect(
      (
        await fixture.protocol.domainBalanceSheet(
          fixture.domainId,
          await fixture.token.getAddress()
        )
      ).funded
    ).to.equal(250n);
    expect(
      fixture.protocol.interface.getFunction("recordPremiumPayment")
    ).to.equal(null);
  });

  it("rolls premium provenance and allocation back when coverage remains underfunded", async function () {
    const fixture = await networkHelpers.loadFixture(deployMockFixture);
    const split = await createSeriesAndLines(fixture, "premium-rollback", {
      coverageLimit: 100n,
      premiumAmount: 25n,
      coverageCapitalCap: 100n,
      premiumReceiptCap: 25n,
    });
    await fundBackstop(fixture, 50n, split.coverageLineId);
    const positionId = await fixture.registry.derivePositionId(
      split.seriesId,
      fixture.claimant.address
    );
    await expect(
      activate(fixture, fixture.claimant, {
        ...split,
        premiumAmount: 25n,
      })
    )
      .to.be.revertedWithCustomError(fixture.protocol, "InsufficientFreeAssets")
      .withArgs(75n, 100n);
    await expect(
      fixture.registry.getPolicyPosition(positionId)
    ).to.be.revertedWithCustomError(fixture.registry, "DoesNotExist");
    const premiumLine = await fixture.protocol.getFundingLine(
      split.premiumLineId
    );
    expect(premiumLine.grossFunded).to.equal(0n);
    expect(premiumLine.grossSpent).to.equal(0n);
    expect(
      (await fixture.protocol.lineBalanceSheet(split.premiumLineId)).funded
    ).to.equal(0n);
    expect(
      (await fixture.protocol.lineBalanceSheet(split.coverageLineId)).funded
    ).to.equal(50n);
    expect(await fixture.token.balanceOf(fixture.vaultAddress)).to.equal(50n);
  });

  it("rolls registry activation back when exact premium transfer fails", async function () {
    const fixture = await networkHelpers.loadFixture(deployMockFixture);
    await fundBackstop(fixture, DEFAULT_COVERAGE);
    const positionId = await fixture.registry.derivePositionId(
      fixture.seriesId,
      fixture.claimant.address
    );

    await expect(
      fixture.protocol
        .connect(fixture.claimant)
        .activatePolicyPosition(fixture.seriesId, [])
    )
      .to.be.revertedWithCustomError(
        fixture.token,
        "ERC20InsufficientAllowance"
      )
      .withArgs(fixture.vaultAddress, 0n, DEFAULT_PREMIUM);
    await expect(
      fixture.registry.getPolicyPosition(positionId)
    ).to.be.revertedWithCustomError(fixture.registry, "DoesNotExist");
    expect(
      (await fixture.registry.getPolicySeries(fixture.seriesId))
        .outstandingExposure
    ).to.equal(0n);
    expect(
      (await fixture.protocol.lineBalanceSheet(fixture.coverageLineId))
        .openExposure
    ).to.equal(0n);
  });

  it("moves full policy exposure through pending, partial approval, settlement, and expiry", async function () {
    const fixture = await networkHelpers.loadFixture(deployMockFixture);
    const positionId = await fundedPosition(fixture);
    let sheet = await fixture.protocol.lineBalanceSheet(fixture.coverageLineId);
    expect(sheet.funded).to.equal(DEFAULT_COVERAGE);
    expect(sheet.openExposure).to.equal(DEFAULT_COVERAGE);
    expect(
      await fixture.protocol.freeLineAssets(fixture.coverageLineId)
    ).to.equal(0n);
    await expectSoundSheets(fixture);

    const { claimId } = await openClaim(fixture, positionId, 400n, "partial");
    sheet = await fixture.protocol.lineBalanceSheet(fixture.coverageLineId);
    expect(sheet.openExposure).to.equal(600n);
    expect(sheet.pendingClaims).to.equal(400n);
    await expectSoundSheets(fixture);
    await reachQuorum(fixture, claimId, true, 250n, "partial approval");
    sheet = await fixture.protocol.lineBalanceSheet(fixture.coverageLineId);
    expect(sheet.openExposure).to.equal(600n);
    expect(sheet.pendingClaims).to.equal(400n);

    await advanceToDecisionDeadline(fixture, claimId);
    await fixture.protocol.connect(fixture.outsider).finalizeClaimCase(claimId);
    const claim = await fixture.registry.getClaim(claimId);
    const position = await fixture.registry.getPolicyPosition(positionId);
    const series = await fixture.registry.getPolicySeries(fixture.seriesId);
    sheet = await fixture.protocol.lineBalanceSheet(fixture.coverageLineId);
    expect(sheet.pendingClaims).to.equal(0n);
    expect(sheet.openExposure).to.equal(750n);
    expect(sheet.owed).to.equal(250n);
    expect(position.remainingCoverage).to.equal(750n);
    expect(position.activeClaimId).to.equal(claimId);
    expect(series.outstandingExposure).to.equal(750n);
    await expectSoundSheets(fixture);

    await fixture.protocol
      .connect(fixture.outsider)
      .reserveObligation(claim.obligationId);
    await fixture.protocol
      .connect(fixture.relayer)
      .settleObligation(claim.obligationId);
    sheet = await fixture.protocol.lineBalanceSheet(fixture.coverageLineId);
    expect(sheet.funded).to.equal(750n);
    expect(sheet.owed).to.equal(0n);
    expect(sheet.reserved).to.equal(0n);
    expect(sheet.openExposure).to.equal(750n);
    expect(sheet.settled).to.equal(250n);
    await expectSoundSheets(fixture);
    expect(
      (await fixture.registry.getPolicyPosition(positionId)).activeClaimId
    ).to.equal(ethers.ZeroHash);

    const expiresAt = (await fixture.registry.getPolicyPosition(positionId))
      .expiresAt;
    await networkHelpers.time.increaseTo(expiresAt);
    await fixture.protocol
      .connect(fixture.outsider)
      .expirePolicyPosition(positionId);
    expect(
      (await fixture.protocol.lineBalanceSheet(fixture.coverageLineId))
        .openExposure
    ).to.equal(0n);
    expect(
      (await fixture.registry.getPolicySeries(fixture.seriesId))
        .outstandingExposure
    ).to.equal(0n);
    expect(
      (await fixture.registry.getPolicyPosition(positionId)).status
    ).to.equal(3n);
    await expectSoundSheets(fixture);

    const remainingShares = await fixture.protocol.contributorShares(
      fixture.coverageLineId,
      fixture.contributor.address
    );
    await fixture.protocol
      .connect(fixture.contributor)
      .withdrawReserveCapital(
        fixture.coverageLineId,
        remainingShares,
        0n,
        fixture.contributor.address
      );
    const coverageLine = await fixture.protocol.getFundingLine(
      fixture.coverageLineId
    );
    const premiumLine = await fixture.protocol.getFundingLine(
      fixture.premiumLineId
    );
    const coverageSheet = await fixture.protocol.lineBalanceSheet(
      fixture.coverageLineId
    );
    const premiumSheet = await fixture.protocol.lineBalanceSheet(
      fixture.premiumLineId
    );
    expect(
      coverageLine.grossFunded -
        coverageLine.grossSpent -
        coverageLine.grossReturned
    ).to.equal(coverageSheet.funded);
    expect(
      premiumLine.grossFunded -
        premiumLine.grossSpent -
        premiumLine.grossReturned
    ).to.equal(premiumSheet.funded);
    const planSheet = await fixture.protocol.planBalanceSheet(
      fixture.planId,
      await fixture.token.getAddress()
    );
    const domainSheet = await fixture.protocol.domainBalanceSheet(
      fixture.domainId,
      await fixture.token.getAddress()
    );
    for (const field of [
      "funded",
      "owed",
      "pendingClaims",
      "openExposure",
      "reserved",
      "settled",
      "returned",
    ] as const) {
      expect(planSheet[field]).to.equal(
        coverageSheet[field] + premiumSheet[field]
      );
      expect(domainSheet[field]).to.equal(planSheet[field]);
    }
  });

  it("blocks expiry while a position has an open or approved-but-unsettled claim", async function () {
    const fixture = await networkHelpers.loadFixture(deployMockFixture);
    await fundBackstop(fixture, 2n * DEFAULT_COVERAGE);
    const openPositionId = await activate(fixture, fixture.claimant);
    const approvedPositionId = await activate(fixture, fixture.secondHolder);
    const { claimId: openClaimId } = await openClaim(
      fixture,
      openPositionId,
      100n,
      "expiry-open"
    );
    const { claimId: approvedClaimId } = await openClaim(
      fixture,
      approvedPositionId,
      100n,
      "expiry-approved",
      fixture.secondHolder
    );
    await reachQuorum(fixture, approvedClaimId, true, 100n, "expiry approval");
    await advanceToDecisionDeadline(fixture, approvedClaimId);
    await fixture.protocol
      .connect(fixture.outsider)
      .finalizeClaimCase(approvedClaimId);

    const openPosition = await fixture.registry.getPolicyPosition(
      openPositionId
    );
    const approvedPosition = await fixture.registry.getPolicyPosition(
      approvedPositionId
    );
    await networkHelpers.time.increaseTo(
      openPosition.expiresAt > approvedPosition.expiresAt
        ? openPosition.expiresAt
        : approvedPosition.expiresAt
    );
    await expect(
      fixture.protocol
        .connect(fixture.outsider)
        .expirePolicyPosition(openPositionId)
    ).to.be.revertedWithCustomError(fixture.registry, "InvalidState");
    await expect(
      fixture.protocol
        .connect(fixture.outsider)
        .expirePolicyPosition(approvedPositionId)
    ).to.be.revertedWithCustomError(fixture.registry, "InvalidState");
    expect(
      (await fixture.registry.getPolicyPosition(openPositionId)).activeClaimId
    ).to.equal(openClaimId);
    expect(
      (await fixture.registry.getPolicyPosition(approvedPositionId))
        .activeClaimId
    ).to.equal(approvedClaimId);
    expect((await fixture.registry.getClaim(approvedClaimId)).status).to.equal(
      4n
    );
  });

  it("permissionlessly denies round-zero no-quorum at the initial deadline", async function () {
    const fixture = await networkHelpers.loadFixture(deployMockFixture);
    const positionId = await fundedPosition(fixture);
    const { claimId } = await openClaim(fixture, positionId, 400n, "timeout");
    const deadline = (await fixture.registry.getClaim(claimId))
      .decisionDeadline;
    await networkHelpers.time.increaseTo(deadline);
    await expect(
      fixture.protocol
        .connect(fixture.attesterOne)
        .attestClaim(claimId, true, 400, commitment("late vote"))
    ).to.be.revertedWithCustomError(fixture.registry, "DecisionWindowClosed");
    await fixture.protocol.connect(fixture.outsider).finalizeClaimCase(claimId);

    const claim = await fixture.registry.getClaim(claimId);
    const position = await fixture.registry.getPolicyPosition(positionId);
    const sheet = await fixture.protocol.lineBalanceSheet(
      fixture.coverageLineId
    );
    expect(claim.status).to.equal(5n);
    expect(position.activeClaimId).to.equal(ethers.ZeroHash);
    expect(position.remainingCoverage).to.equal(DEFAULT_COVERAGE);
    expect(sheet.pendingClaims).to.equal(0n);
    expect(sheet.openExposure).to.equal(DEFAULT_COVERAGE);
  });

  it("rejects duplicate attesters and does not combine split vote tuples", async function () {
    const fixture = await networkHelpers.loadFixture(deployMockFixture);
    const positionId = await fundedPosition(fixture);
    const { claimId } = await openClaim(
      fixture,
      positionId,
      300n,
      "split-votes"
    );
    const firstDecision = commitment("split-vote-first");
    const secondDecision = commitment("split-vote-second");
    await fixture.protocol
      .connect(fixture.attesterOne)
      .attestClaim(claimId, true, 200n, firstDecision);
    await expect(
      fixture.protocol
        .connect(fixture.attesterOne)
        .attestClaim(claimId, true, 200n, firstDecision)
    ).to.be.revertedWithCustomError(fixture.registry, "AlreadyAttested");
    await fixture.protocol
      .connect(fixture.attesterTwo)
      .attestClaim(claimId, true, 200n, secondDecision);
    expect((await fixture.registry.getClaim(claimId)).status).to.equal(1n);

    await fixture.protocol
      .connect(fixture.attesterThree)
      .attestClaim(claimId, true, 200n, firstDecision);
    expect((await fixture.registry.getClaim(claimId)).status).to.equal(2n);
    const firstVoteKey = ethers.keccak256(
      ethers.AbiCoder.defaultAbiCoder().encode(
        ["bool", "uint256", "bytes32"],
        [true, 200n, firstDecision]
      )
    );
    const secondVoteKey = ethers.keccak256(
      ethers.AbiCoder.defaultAbiCoder().encode(
        ["bool", "uint256", "bytes32"],
        [true, 200n, secondDecision]
      )
    );
    expect(
      await fixture.registry.claimVoteCount(claimId, 0, firstVoteKey)
    ).to.equal(2n);
    expect(
      await fixture.registry.claimVoteCount(claimId, 0, secondVoteKey)
    ).to.equal(1n);
  });

  it("allows one challenge round and uses the initial decision when round one has no quorum", async function () {
    const fixture = await networkHelpers.loadFixture(deployMockFixture);
    const positionId = await fundedPosition(fixture);
    const { claimId } = await openClaim(fixture, positionId, 300n, "challenge");
    await reachQuorum(fixture, claimId, true, 200n, "fallback approval");
    await fixture.protocol
      .connect(fixture.claimant)
      .challengeClaim(claimId, commitment("counter evidence"));
    await expect(
      fixture.protocol
        .connect(fixture.claimant)
        .challengeClaim(claimId, commitment("second counter evidence"))
    ).to.be.revertedWithCustomError(fixture.registry, "ChallengeAlreadyUsed");
    await fixture.protocol
      .connect(fixture.attesterOne)
      .attestClaim(claimId, false, 0, commitment("round one split"));
    await expect(
      fixture.protocol.connect(fixture.outsider).finalizeClaimCase(claimId)
    ).to.be.revertedWithCustomError(fixture.registry, "DecisionWindowOpen");
    await advanceToDecisionDeadline(fixture, claimId);
    await expect(
      fixture.protocol
        .connect(fixture.attesterTwo)
        .attestClaim(claimId, false, 0, commitment("late round one vote"))
    ).to.be.revertedWithCustomError(fixture.registry, "ChallengeWindowClosed");
    await fixture.protocol.connect(fixture.outsider).finalizeClaimCase(claimId);
    expect((await fixture.registry.getClaim(claimId)).status).to.equal(4n);
    expect((await fixture.registry.getClaim(claimId)).approvedAmount).to.equal(
      200n
    );
  });

  it("preserves vested claim and expiry rights after scoped intake is stopped", async function () {
    const fixture = await networkHelpers.loadFixture(deployMockFixture);
    const positionId = await fundedPosition(fixture);
    await fixture.protocol
      .connect(fixture.domainController)
      .setDomainControls(fixture.domainId, false, 0);
    await fixture.protocol
      .connect(fixture.planController)
      .setPlanControls(fixture.planId, false, 0);

    await expect(fundBackstop(fixture, 1n)).to.be.revertedWithCustomError(
      fixture.protocol,
      "IntakeClosed"
    );
    const { claimId } = await openClaim(
      fixture,
      positionId,
      100n,
      "paused rights"
    );
    await reachQuorum(fixture, claimId, false, 0n, "paused denial");
    await advanceToDecisionDeadline(fixture, claimId);
    await fixture.protocol.connect(fixture.outsider).finalizeClaimCase(claimId);
    expect((await fixture.registry.getClaim(claimId)).status).to.equal(5n);

    const expiresAt = (await fixture.registry.getPolicyPosition(positionId))
      .expiresAt;
    await networkHelpers.time.increaseTo(expiresAt);
    await fixture.protocol
      .connect(fixture.outsider)
      .expirePolicyPosition(positionId);
    expect(
      (await fixture.registry.getPolicyPosition(positionId)).status
    ).to.equal(3n);
  });

  it("enforces delayed controller handoffs and bounded pause cooldowns", async function () {
    const fixture = await networkHelpers.loadFixture(deployMockFixture);
    await expect(
      fixture.protocol
        .connect(fixture.outsider)
        .setDomainControls(fixture.domainId, true, 0)
    ).to.be.revertedWithCustomError(fixture.protocol, "Unauthorized");

    await fixture.protocol
      .connect(fixture.domainController)
      .proposeDomainController(fixture.domainId, fixture.outsider.address);
    await expect(
      fixture.protocol
        .connect(fixture.planController)
        .acceptDomainController(fixture.domainId)
    ).to.be.revertedWithCustomError(fixture.protocol, "Unauthorized");
    await expect(
      fixture.protocol
        .connect(fixture.outsider)
        .acceptDomainController(fixture.domainId)
    ).to.be.revertedWithCustomError(fixture.protocol, "ControllerDelayActive");
    await networkHelpers.time.increase(
      await fixture.protocol.CONTROLLER_DELAY()
    );
    await fixture.protocol
      .connect(fixture.outsider)
      .acceptDomainController(fixture.domainId);
    expect(
      (await fixture.protocol.getDomain(fixture.domainId)).controller
    ).to.equal(fixture.outsider.address);

    await fixture.protocol
      .connect(fixture.planController)
      .proposePlanController(
        fixture.planId,
        fixture.alternateRecipient.address
      );
    await expect(
      fixture.protocol
        .connect(fixture.alternateRecipient)
        .acceptPlanController(fixture.planId)
    ).to.be.revertedWithCustomError(fixture.protocol, "ControllerDelayActive");
    await networkHelpers.time.increase(
      await fixture.protocol.CONTROLLER_DELAY()
    );
    await fixture.protocol
      .connect(fixture.alternateRecipient)
      .acceptPlanController(fixture.planId);
    expect(
      (await fixture.protocol.getPlan(fixture.planId)).controller
    ).to.equal(fixture.alternateRecipient.address);

    const now = BigInt(await networkHelpers.time.latest());
    await expect(
      fixture.protocol
        .connect(fixture.outsider)
        .setDomainControls(
          fixture.domainId,
          true,
          now + (await fixture.protocol.MAX_PAUSE_DURATION()) + HOUR
        )
    ).to.be.revertedWithCustomError(fixture.protocol, "PauseDurationInvalid");
    const pauseUntil = now + HOUR;
    await fixture.protocol
      .connect(fixture.outsider)
      .setDomainControls(fixture.domainId, true, pauseUntil);
    await expect(
      fixture.protocol
        .connect(fixture.outsider)
        .setDomainControls(fixture.domainId, true, pauseUntil + HOUR)
    ).to.be.revertedWithCustomError(fixture.protocol, "PauseDurationInvalid");

    await networkHelpers.time.increaseTo(pauseUntil + 1n);
    await expect(
      fixture.protocol
        .connect(fixture.outsider)
        .setDomainControls(fixture.domainId, true, pauseUntil + 2n * HOUR)
    ).to.be.revertedWithCustomError(fixture.protocol, "PauseCooldownActive");
    const domain = await fixture.protocol.getDomain(fixture.domainId);
    await networkHelpers.time.increaseTo(
      domain.lastPauseStarted + (await fixture.protocol.PAUSE_COOLDOWN())
    );
    const secondPauseUntil = BigInt(await networkHelpers.time.latest()) + HOUR;
    await fixture.protocol
      .connect(fixture.outsider)
      .setDomainControls(fixture.domainId, true, secondPauseUntil);
  });

  it("keeps contributor exits and approved claim finality open during scoped pauses", async function () {
    const fixture = await networkHelpers.loadFixture(deployMockFixture);
    const positionId = await fundedPosition(fixture);
    await fundBackstop(fixture, 200n);
    const pauseUntil =
      BigInt(await networkHelpers.time.latest()) + 7n * 24n * HOUR;
    await fixture.protocol
      .connect(fixture.domainController)
      .setDomainControls(fixture.domainId, true, pauseUntil);
    await fixture.protocol
      .connect(fixture.planController)
      .setPlanControls(fixture.planId, true, pauseUntil);

    const shares =
      (await fixture.protocol.contributorShares(
        fixture.coverageLineId,
        fixture.contributor.address
      )) / 20n;
    const exitQuote = await fixture.protocol.contributorExitQuote(
      fixture.coverageLineId,
      shares
    );
    expect(exitQuote).to.be.greaterThan(0n);
    await fixture.protocol
      .connect(fixture.contributor)
      .withdrawReserveCapital(
        fixture.coverageLineId,
        shares,
        exitQuote,
        fixture.contributor.address
      );

    const { claimId } = await openClaim(
      fixture,
      positionId,
      100n,
      "paused-approved-finality"
    );
    await reachQuorum(fixture, claimId, true, 100n, "paused-approved-decision");
    await advanceToDecisionDeadline(fixture, claimId);
    await fixture.protocol.connect(fixture.outsider).finalizeClaimCase(claimId);
    const claim = await fixture.registry.getClaim(claimId);
    await fixture.protocol
      .connect(fixture.outsider)
      .reserveObligation(claim.obligationId);
    await fixture.protocol
      .connect(fixture.outsider)
      .settleObligation(claim.obligationId);
    expect((await fixture.registry.getClaim(claimId)).status).to.equal(6n);
    await expectSoundSheets(fixture);
  });

  it("rejects every known protocol sink for claims, recipient rotation, and exits", async function () {
    const fixture = await networkHelpers.loadFixture(deployMockFixture);
    const positionId = await fundedPosition(fixture);
    const secondToken = await ethers.deployContract("MockERC20", [
      "Second Reserve USD",
      "rUSD2",
    ]);
    await fixture.protocol
      .connect(fixture.outsider)
      .createDomainAssetVault(fixture.domainId, await secondToken.getAddress());
    const secondVault = await fixture.protocol.reserveVaults(
      fixture.domainId,
      await secondToken.getAddress()
    );
    const invalidRecipients = [
      ethers.ZeroAddress,
      await fixture.factory.getAddress(),
      await fixture.registry.getAddress(),
      await fixture.protocol.getAddress(),
      await fixture.token.getAddress(),
      fixture.vaultAddress,
      secondVault,
    ];

    for (const [index, recipient] of invalidRecipients.entries()) {
      await expect(
        fixture.protocol
          .connect(fixture.claimant)
          .openClaimCase(
            positionId,
            commitment(`invalid-recipient-claim-${index}`),
            commitment(`invalid-recipient-nullifier-${index}`),
            recipient,
            100n
          )
      ).to.be.revertedWithCustomError(fixture.protocol, "InvalidAddress");
    }

    const { claimId } = await openClaim(
      fixture,
      positionId,
      100n,
      "valid-recipient-guard"
    );
    const deadline = BigInt(await networkHelpers.time.latest()) + HOUR;
    for (const recipient of invalidRecipients) {
      await expect(
        fixture.protocol
          .connect(fixture.relayer)
          .authorizeClaimRecipient(claimId, recipient, deadline, "0x")
      ).to.be.revertedWithCustomError(fixture.protocol, "InvalidAddress");
      await expect(
        fixture.protocol
          .connect(fixture.contributor)
          .withdrawReserveCapital(fixture.coverageLineId, 1n, 0n, recipient)
      ).to.be.revertedWithCustomError(fixture.protocol, "InvalidAddress");
    }
  });

  it("revalidates a recipient that later becomes a deterministic reserve vault", async function () {
    const fixture = await networkHelpers.loadFixture(deployMockFixture);
    const positionId = await fundedPosition(fixture);
    const futureToken = await ethers.deployContract("MockERC20", [
      "Future Reserve USD",
      "frUSD",
    ]);
    const protocolAddress = await fixture.protocol.getAddress();
    const futureTokenAddress = await futureToken.getAddress();
    const deploymentSalt = ethers.keccak256(
      ethers.AbiCoder.defaultAbiCoder().encode(
        ["bytes32", "address"],
        [fixture.domainId, futureTokenAddress]
      )
    );
    const vaultFactory = await ethers.getContractFactory("ReserveVault");
    const initCode = ethers.concat([
      vaultFactory.bytecode,
      ethers.AbiCoder.defaultAbiCoder().encode(
        ["address", "bytes32", "address"],
        [protocolAddress, fixture.domainId, futureTokenAddress]
      ),
    ]);
    const futureVault = ethers.getCreate2Address(
      protocolAddress,
      deploymentSalt,
      ethers.keccak256(initCode)
    );
    expect(await ethers.provider.getCode(futureVault)).to.equal("0x");

    const nullifier = commitment("future-vault-nullifier");
    const claimId = await fixture.registry.deriveClaimId(
      positionId,
      fixture.claimant.address,
      nullifier
    );
    await fixture.protocol
      .connect(fixture.claimant)
      .openClaimCase(
        positionId,
        commitment("future-vault-claim"),
        nullifier,
        futureVault,
        200n
      );
    await reachQuorum(fixture, claimId, true, 200n, "future-vault-approval");
    await advanceToDecisionDeadline(fixture, claimId);
    await fixture.protocol.connect(fixture.relayer).finalizeClaimCase(claimId);
    const claim = await fixture.registry.getClaim(claimId);
    await fixture.protocol
      .connect(fixture.outsider)
      .reserveObligation(claim.obligationId);

    await fixture.protocol
      .connect(fixture.outsider)
      .createDomainAssetVault(fixture.domainId, futureTokenAddress);
    expect(
      await fixture.protocol.reserveVaults(fixture.domainId, futureTokenAddress)
    ).to.equal(futureVault);
    await expect(
      fixture.protocol
        .connect(fixture.relayer)
        .settleObligation(claim.obligationId)
    ).to.be.revertedWithCustomError(fixture.protocol, "InvalidAddress");
    expect((await fixture.registry.getClaim(claimId)).status).to.equal(4n);
    expect(
      (await fixture.protocol.getObligation(claim.obligationId)).status
    ).to.equal(2n);
    expect(await fixture.token.balanceOf(futureVault)).to.equal(0n);
  });

  it("rotates an approved claim recipient under registry EIP-712 and updates a reserved obligation", async function () {
    const fixture = await networkHelpers.loadFixture(deployMockFixture);
    const positionId = await fundedPosition(fixture);
    const { claimId } = await openClaim(
      fixture,
      positionId,
      300n,
      "recipient rotation"
    );
    await reachQuorum(fixture, claimId, true, 300n, "recipient approval");
    await advanceToDecisionDeadline(fixture, claimId);
    await fixture.protocol.connect(fixture.outsider).finalizeClaimCase(claimId);
    const claim = await fixture.registry.getClaim(claimId);
    await fixture.protocol
      .connect(fixture.outsider)
      .reserveObligation(claim.obligationId);

    const deadline = BigInt(await networkHelpers.time.latest()) + HOUR;
    const { chainId } = await ethers.provider.getNetwork();
    const domain = {
      name: "Nakama Policy Registry",
      version: "1",
      chainId,
      verifyingContract: await fixture.registry.getAddress(),
    };
    const types = {
      ClaimRecipient: [
        { name: "claimId", type: "bytes32" },
        { name: "recipient", type: "address" },
        { name: "nonce", type: "uint256" },
        { name: "deadline", type: "uint256" },
      ],
    };
    const signature = await fixture.claimant.signTypedData(domain, types, {
      claimId,
      recipient: fixture.alternateRecipient.address,
      nonce: 0,
      deadline,
    });
    await expect(
      fixture.protocol
        .connect(fixture.relayer)
        .authorizeClaimRecipient(
          claimId,
          fixture.alternateRecipient.address,
          deadline,
          signature
        )
    )
      .to.emit(fixture.protocol, "ObligationRecipientUpdated")
      .withArgs(
        claim.obligationId,
        claimId,
        fixture.payoutRecipient.address,
        fixture.alternateRecipient.address
      );
    expect(
      (await fixture.protocol.getObligation(claim.obligationId)).recipient
    ).to.equal(fixture.alternateRecipient.address);
    expect(
      (await fixture.protocol.getObligation(claim.obligationId)).status
    ).to.equal(2n);

    const before = await fixture.token.balanceOf(
      fixture.alternateRecipient.address
    );
    await fixture.protocol
      .connect(fixture.outsider)
      .settleObligation(claim.obligationId);
    expect(
      await fixture.token.balanceOf(fixture.alternateRecipient.address)
    ).to.equal(before + 300n);
    await expect(
      fixture.protocol
        .connect(fixture.relayer)
        .authorizeClaimRecipient(
          claimId,
          fixture.payoutRecipient.address,
          deadline,
          signature
        )
    ).to.be.revertedWithCustomError(fixture.registry, "InvalidState");
  });

  it("binds recipient authorizations to registry, chain, nonce, and deadline", async function () {
    const fixture = await networkHelpers.loadFixture(deployMockFixture);
    const positionId = await fundedPosition(fixture);
    const { claimId } = await openClaim(
      fixture,
      positionId,
      100n,
      "recipient-domain-binding"
    );
    const deadline = BigInt(await networkHelpers.time.latest()) + HOUR;
    const { chainId } = await ethers.provider.getNetwork();
    const registryDomain = {
      name: "Nakama Policy Registry",
      version: "1",
      chainId,
      verifyingContract: await fixture.registry.getAddress(),
    };
    const types = {
      ClaimRecipient: [
        { name: "claimId", type: "bytes32" },
        { name: "recipient", type: "address" },
        { name: "nonce", type: "uint256" },
        { name: "deadline", type: "uint256" },
      ],
    };
    const authorization = {
      claimId,
      recipient: fixture.alternateRecipient.address,
      nonce: 0n,
      deadline,
    };
    const wrongContractSignature = await fixture.claimant.signTypedData(
      {
        ...registryDomain,
        verifyingContract: await fixture.protocol.getAddress(),
      },
      types,
      authorization
    );
    await expect(
      fixture.protocol
        .connect(fixture.relayer)
        .authorizeClaimRecipient(
          claimId,
          fixture.alternateRecipient.address,
          deadline,
          wrongContractSignature
        )
    ).to.be.revertedWithCustomError(fixture.registry, "InvalidSignature");

    const wrongChainSignature = await fixture.claimant.signTypedData(
      { ...registryDomain, chainId: chainId + 1n },
      types,
      authorization
    );
    await expect(
      fixture.protocol
        .connect(fixture.relayer)
        .authorizeClaimRecipient(
          claimId,
          fixture.alternateRecipient.address,
          deadline,
          wrongChainSignature
        )
    ).to.be.revertedWithCustomError(fixture.registry, "InvalidSignature");

    const validSignature = await fixture.claimant.signTypedData(
      registryDomain,
      types,
      authorization
    );
    await fixture.protocol
      .connect(fixture.relayer)
      .authorizeClaimRecipient(
        claimId,
        fixture.alternateRecipient.address,
        deadline,
        validSignature
      );
    expect((await fixture.registry.getClaim(claimId)).recipientNonce).to.equal(
      1n
    );
    await expect(
      fixture.protocol
        .connect(fixture.relayer)
        .authorizeClaimRecipient(
          claimId,
          fixture.alternateRecipient.address,
          deadline,
          validSignature
        )
    ).to.be.revertedWithCustomError(fixture.registry, "InvalidSignature");

    const expiredDeadline = BigInt(await networkHelpers.time.latest()) - 1n;
    const expiredSignature = await fixture.claimant.signTypedData(
      registryDomain,
      types,
      {
        claimId,
        recipient: fixture.payoutRecipient.address,
        nonce: 1n,
        deadline: expiredDeadline,
      }
    );
    await expect(
      fixture.protocol
        .connect(fixture.relayer)
        .authorizeClaimRecipient(
          claimId,
          fixture.payoutRecipient.address,
          expiredDeadline,
          expiredSignature
        )
    ).to.be.revertedWithCustomError(fixture.registry, "SignatureExpired");
  });

  it("accepts ERC-1271 claimants without allowing signature callbacks to mutate claim state", async function () {
    const fixture = await networkHelpers.loadFixture(deployMockFixture);
    await fundBackstop(fixture, DEFAULT_COVERAGE);
    const claimantWallet = await ethers.deployContract("ERC1271Claimant", [
      fixture.claimant.address,
    ]);
    const claimantWalletAddress = await claimantWallet.getAddress();
    await fixture.token.mint(claimantWalletAddress, DEFAULT_PREMIUM);
    await claimantWallet
      .connect(fixture.claimant)
      .approveAsset(
        await fixture.token.getAddress(),
        fixture.vaultAddress,
        DEFAULT_PREMIUM
      );
    await claimantWallet
      .connect(fixture.claimant)
      .activate(await fixture.protocol.getAddress(), fixture.seriesId, []);

    const positionId = await fixture.registry.derivePositionId(
      fixture.seriesId,
      claimantWalletAddress
    );
    const nullifier = commitment("erc1271-nullifier");
    const claimId = await fixture.registry.deriveClaimId(
      positionId,
      claimantWalletAddress,
      nullifier
    );
    await claimantWallet
      .connect(fixture.claimant)
      .openClaim(
        await fixture.protocol.getAddress(),
        positionId,
        commitment("erc1271-claim"),
        nullifier,
        fixture.payoutRecipient.address,
        100n
      );
    await reachQuorum(fixture, claimId, true, 100n, "erc1271 approval");

    const deadline = BigInt(await networkHelpers.time.latest()) + HOUR;
    const digest = await fixture.registry.claimRecipientDigest(
      claimId,
      fixture.alternateRecipient.address,
      0n,
      deadline
    );
    const callback = fixture.protocol.interface.encodeFunctionData(
      "challengeClaim",
      [claimId, commitment("erc1271 callback challenge")]
    );
    await claimantWallet
      .connect(fixture.claimant)
      .configureValidation(
        digest,
        await fixture.protocol.getAddress(),
        callback
      );
    const signature = await claimantWallet.validSignature();
    await fixture.protocol
      .connect(fixture.relayer)
      .authorizeClaimRecipient(
        claimId,
        fixture.alternateRecipient.address,
        deadline,
        signature
      );

    const claim = await fixture.registry.getClaim(claimId);
    expect(claim.status).to.equal(2n);
    expect(claim.round).to.equal(0n);
    expect(claim.payoutRecipient).to.equal(fixture.alternateRecipient.address);
    expect(claim.recipientNonce).to.equal(1n);

    await (
      await claimantWallet.connect(fixture.claimant).executeCallback()
    ).wait();
    expect((await fixture.registry.getClaim(claimId)).status).to.equal(3n);
  });

  it("marks a fully paid position exhausted only after successful settlement", async function () {
    const fixture = await networkHelpers.loadFixture(deployMockFixture);
    const positionId = await fundedPosition(fixture);
    const { claimId } = await openClaim(
      fixture,
      positionId,
      DEFAULT_COVERAGE,
      "full claim"
    );
    await reachQuorum(
      fixture,
      claimId,
      true,
      DEFAULT_COVERAGE,
      "full approval"
    );
    await advanceToDecisionDeadline(fixture, claimId);
    await fixture.protocol.connect(fixture.outsider).finalizeClaimCase(claimId);
    let position = await fixture.registry.getPolicyPosition(positionId);
    expect(position.remainingCoverage).to.equal(0n);
    expect(position.status).to.equal(1n);
    expect(position.activeClaimId).to.equal(claimId);

    const claim = await fixture.registry.getClaim(claimId);
    await fixture.protocol
      .connect(fixture.outsider)
      .reserveObligation(claim.obligationId);
    await fixture.protocol
      .connect(fixture.outsider)
      .settleObligation(claim.obligationId);
    position = await fixture.registry.getPolicyPosition(positionId);
    expect(position.status).to.equal(2n);
    expect(position.activeClaimId).to.equal(ethers.ZeroHash);
    await expect(
      fixture.protocol.expirePolicyPosition(positionId)
    ).to.be.revertedWithCustomError(fixture.registry, "InvalidState");
  });

  it("rejects exact-delta fee assets without leaving shares or accounting", async function () {
    const fixture = await networkHelpers.loadFixture(deployFeeTokenFixture);
    await fixture.token.mint(fixture.contributor.address, 1_000n);
    await fixture.token
      .connect(fixture.contributor)
      .approve(fixture.vaultAddress, 1_000n);
    const vault = await ethers.getContractAt(
      "ReserveVault",
      fixture.vaultAddress
    );
    await expect(
      fixture.protocol
        .connect(fixture.contributor)
        .depositReserveCapital(
          fixture.coverageLineId,
          1_000n,
          0,
          commitment("fee capital")
        )
    )
      .to.be.revertedWithCustomError(vault, "UnsupportedTokenBehavior")
      .withArgs(1_000n, 1_000n, 990n);
    expect(
      await fixture.protocol.contributorShares(
        fixture.coverageLineId,
        fixture.contributor.address
      )
    ).to.equal(0n);
    expect(
      (await fixture.protocol.lineBalanceSheet(fixture.coverageLineId)).funded
    ).to.equal(0n);
  });

  it("blocks premium-transfer callback reentrancy while preserving the outer activation", async function () {
    const fixture = await networkHelpers.loadFixture(
      deployReentrantTokenFixture
    );
    await fundBackstop(fixture, DEFAULT_COVERAGE);
    await fixture.token.mint(fixture.claimant.address, DEFAULT_PREMIUM);
    await fixture.token
      .connect(fixture.claimant)
      .approve(fixture.vaultAddress, DEFAULT_PREMIUM);
    const callback = fixture.protocol.interface.encodeFunctionData(
      "activatePolicyPosition",
      [fixture.seriesId, []]
    );
    await fixture.token.armCallback(
      await fixture.protocol.getAddress(),
      callback
    );
    await fixture.protocol
      .connect(fixture.claimant)
      .activatePolicyPosition(fixture.seriesId, []);
    expect(await fixture.token.callbackAttempted()).to.equal(true);
    expect(await fixture.token.callbackSucceeded()).to.equal(false);
    const positionId = await fixture.registry.derivePositionId(
      fixture.seriesId,
      fixture.claimant.address
    );
    expect(
      (await fixture.registry.getPolicyPosition(positionId)).status
    ).to.equal(1n);
    expect(
      (await fixture.protocol.lineBalanceSheet(fixture.coverageLineId))
        .openExposure
    ).to.equal(DEFAULT_COVERAGE);
  });
});

describe("Nakama reserve regressions under position-backed coverage", function () {
  it("blocks the seed-donation sandwich with virtual offsets and minShares", async function () {
    const fixture = await networkHelpers.loadFixture(deployMockFixture);
    const attacker = fixture.contributor;
    const victim = fixture.outsider;
    await fixture.token.mint(attacker.address, 501n);
    await fixture.token.connect(attacker).approve(fixture.vaultAddress, 501n);
    await fixture.protocol
      .connect(attacker)
      .depositReserveCapital(
        fixture.coverageLineId,
        1n,
        0,
        commitment("sandwich seed")
      );
    expect(
      await fixture.protocol.contributorShares(
        fixture.coverageLineId,
        attacker.address
      )
    ).to.equal(1_000_000n);

    const staleQuote = await fixture.protocol.contributorDepositQuote(
      fixture.coverageLineId,
      1_000n
    );
    await fixture.protocol
      .connect(attacker)
      .recordReserveEarnings(
        fixture.coverageLineId,
        500n,
        commitment("sandwich donation")
      );
    await fixture.token.mint(victim.address, 1_000n);
    await fixture.token.connect(victim).approve(fixture.vaultAddress, 1_000n);
    await expect(
      fixture.protocol
        .connect(victim)
        .depositReserveCapital(
          fixture.coverageLineId,
          1_000n,
          staleQuote,
          commitment("slippage protected victim")
        )
    ).to.be.revertedWithCustomError(fixture.protocol, "SlippageExceeded");

    const currentQuote = await fixture.protocol.contributorDepositQuote(
      fixture.coverageLineId,
      1_000n
    );
    await fixture.protocol
      .connect(victim)
      .depositReserveCapital(
        fixture.coverageLineId,
        1_000n,
        currentQuote,
        commitment("repriced victim")
      );
    const attackerShares = await fixture.protocol.contributorShares(
      fixture.coverageLineId,
      attacker.address
    );
    await fixture.protocol
      .connect(attacker)
      .withdrawReserveCapital(
        fixture.coverageLineId,
        attackerShares,
        0,
        attacker.address
      );
    expect(await fixture.token.balanceOf(attacker.address)).to.equal(251n);
  });

  it("keeps direct vault donations outside contributor accounting", async function () {
    const fixture = await networkHelpers.loadFixture(deployMockFixture);
    await fixture.token.mint(fixture.outsider.address, 500n);
    await fixture.token
      .connect(fixture.outsider)
      .transfer(fixture.vaultAddress, 500n);
    const shares = await depositCapital(
      fixture,
      fixture.coverageLineId,
      fixture.contributor,
      1_000n,
      "post donation first deposit"
    );
    await fixture.protocol
      .connect(fixture.contributor)
      .withdrawReserveCapital(
        fixture.coverageLineId,
        shares,
        1_000n,
        fixture.contributor.address
      );
    expect(await fixture.token.balanceOf(fixture.contributor.address)).to.equal(
      1_000n
    );
    expect(await fixture.token.balanceOf(fixture.vaultAddress)).to.equal(500n);
    expect(
      (await fixture.protocol.lineBalanceSheet(fixture.coverageLineId)).funded
    ).to.equal(0n);
  });

  it("restarts safely after the last exit leaves a virtual-share residual", async function () {
    const fixture = await networkHelpers.loadFixture(deployMockFixture);
    const firstShares = await depositCapital(
      fixture,
      fixture.coverageLineId,
      fixture.contributor,
      1_000n,
      "residual first capital"
    );
    await fixture.token.mint(fixture.outsider.address, 500n);
    await fixture.token
      .connect(fixture.outsider)
      .approve(fixture.vaultAddress, 500n);
    await fixture.protocol
      .connect(fixture.outsider)
      .recordReserveEarnings(
        fixture.coverageLineId,
        500n,
        commitment("residual earnings")
      );
    await fixture.protocol
      .connect(fixture.contributor)
      .withdrawReserveCapital(
        fixture.coverageLineId,
        firstShares,
        1_499n,
        fixture.contributor.address
      );
    expect(
      (await fixture.protocol.lineBalanceSheet(fixture.coverageLineId)).funded
    ).to.equal(1n);
    expect(
      await fixture.protocol.totalContributorShares(fixture.coverageLineId)
    ).to.equal(0n);

    const restartShares = await depositCapital(
      fixture,
      fixture.coverageLineId,
      fixture.relayer,
      1_000n,
      "residual restart"
    );
    expect(restartShares).to.equal(500_000_000n);
    await fixture.protocol
      .connect(fixture.relayer)
      .withdrawReserveCapital(
        fixture.coverageLineId,
        restartShares,
        1_000n,
        fixture.relayer.address
      );
    expect(await fixture.token.balanceOf(fixture.relayer.address)).to.equal(
      1_000n
    );
  });

  it("prices a pending claim without a denial discount or post-denial windfall", async function () {
    const fixture = await networkHelpers.loadFixture(deployMockFixture);
    await fundBackstop(fixture, DEFAULT_COVERAGE - DEFAULT_PREMIUM);
    const positionId = await activate(fixture);
    const { claimId } = await openClaim(
      fixture,
      positionId,
      DEFAULT_COVERAGE,
      "pending denial"
    );
    await reachQuorum(
      fixture,
      claimId,
      true,
      DEFAULT_COVERAGE,
      "pending approval"
    );
    const expectedAttackerShares =
      await fixture.protocol.contributorDepositQuote(
        fixture.coverageLineId,
        100n
      );
    const attackerShares = await depositCapital(
      fixture,
      fixture.coverageLineId,
      fixture.outsider,
      100n,
      "pending attacker"
    );
    expect(attackerShares).to.equal(expectedAttackerShares);
    await fixture.protocol
      .connect(fixture.claimant)
      .challengeClaim(claimId, commitment("honest denial challenge"));
    await fixture.protocol
      .connect(fixture.attesterOne)
      .attestClaim(claimId, false, 0, commitment("honest denial"));
    await fixture.protocol
      .connect(fixture.attesterTwo)
      .attestClaim(claimId, false, 0, commitment("honest denial"));
    await advanceToDecisionDeadline(fixture, claimId);
    await fixture.protocol.connect(fixture.outsider).finalizeClaimCase(claimId);

    const expiresAt = (await fixture.registry.getPolicyPosition(positionId))
      .expiresAt;
    await networkHelpers.time.increaseTo(expiresAt);
    await fixture.protocol.expirePolicyPosition(positionId);
    const finalExitQuote = await fixture.protocol.contributorExitQuote(
      fixture.coverageLineId,
      attackerShares
    );
    expect(finalExitQuote).to.be.at.most(100n);
    expect(finalExitQuote).to.be.at.least(99n);
  });

  it("does not create a windfall when a challenged claim is only partially approved", async function () {
    const fixture = await networkHelpers.loadFixture(deployMockFixture);
    await fundBackstop(fixture, DEFAULT_COVERAGE - DEFAULT_PREMIUM);
    const positionId = await activate(fixture);
    const { claimId } = await openClaim(
      fixture,
      positionId,
      DEFAULT_COVERAGE,
      "partial decrease"
    );
    await reachQuorum(
      fixture,
      claimId,
      true,
      DEFAULT_COVERAGE,
      "initial full approval"
    );
    const attackerShares = await depositCapital(
      fixture,
      fixture.coverageLineId,
      fixture.outsider,
      100n,
      "partial attacker"
    );
    await fixture.protocol
      .connect(fixture.claimant)
      .challengeClaim(claimId, commitment("partial challenge"));
    await fixture.protocol
      .connect(fixture.attesterOne)
      .attestClaim(claimId, true, 400n, commitment("partial approval"));
    await fixture.protocol
      .connect(fixture.attesterTwo)
      .attestClaim(claimId, true, 400n, commitment("partial approval"));
    await advanceToDecisionDeadline(fixture, claimId);
    await fixture.protocol.connect(fixture.outsider).finalizeClaimCase(claimId);
    const claim = await fixture.registry.getClaim(claimId);
    await fixture.protocol
      .connect(fixture.outsider)
      .reserveObligation(claim.obligationId);
    await fixture.protocol
      .connect(fixture.outsider)
      .settleObligation(claim.obligationId);
    const expiresAt = (await fixture.registry.getPolicyPosition(positionId))
      .expiresAt;
    await networkHelpers.time.increaseTo(expiresAt);
    await fixture.protocol.expirePolicyPosition(positionId);
    expect(
      await fixture.protocol.contributorExitQuote(
        fixture.coverageLineId,
        attackerShares
      )
    ).to.equal(63n);
  });

  it("keeps wiped shares non-dilutable and revives them through attributed earnings", async function () {
    const fixture = await networkHelpers.loadFixture(deployMockFixture);
    await fundBackstop(fixture, DEFAULT_COVERAGE - DEFAULT_PREMIUM);
    const initialShares = await fixture.protocol.totalContributorShares(
      fixture.coverageLineId
    );
    const positionId = await activate(fixture);
    const { claimId } = await openClaim(
      fixture,
      positionId,
      DEFAULT_COVERAGE,
      "wiped line"
    );
    await reachQuorum(
      fixture,
      claimId,
      true,
      DEFAULT_COVERAGE,
      "wiped approval"
    );
    await advanceToDecisionDeadline(fixture, claimId);
    await fixture.protocol.connect(fixture.outsider).finalizeClaimCase(claimId);
    const claim = await fixture.registry.getClaim(claimId);
    await fixture.protocol
      .connect(fixture.outsider)
      .reserveObligation(claim.obligationId);
    await fixture.protocol
      .connect(fixture.outsider)
      .settleObligation(claim.obligationId);
    expect(
      (await fixture.protocol.lineBalanceSheet(fixture.coverageLineId)).funded
    ).to.equal(0n);
    expect(
      await fixture.protocol.totalContributorShares(fixture.coverageLineId)
    ).to.equal(initialShares);

    await fixture.token.mint(fixture.outsider.address, 200n);
    await fixture.token
      .connect(fixture.outsider)
      .approve(fixture.vaultAddress, 200n);
    await expect(
      fixture.protocol
        .connect(fixture.outsider)
        .depositReserveCapital(
          fixture.coverageLineId,
          100n,
          0,
          commitment("forbidden wipe dilution")
        )
    ).to.be.revertedWithCustomError(fixture.protocol, "InvalidState");
    await fixture.protocol
      .connect(fixture.outsider)
      .recordReserveEarnings(
        fixture.coverageLineId,
        100n,
        commitment("wiped revival")
      );
    const revivedQuote = await fixture.protocol.contributorDepositQuote(
      fixture.coverageLineId,
      100n
    );
    await fixture.protocol
      .connect(fixture.outsider)
      .depositReserveCapital(
        fixture.coverageLineId,
        100n,
        revivedQuote,
        commitment("post revival capital")
      );
    expect(
      await fixture.protocol.contributorShares(
        fixture.coverageLineId,
        fixture.outsider.address
      )
    ).to.equal(revivedQuote);
  });

  it("keeps exposure attributed to its funding line inside the same plan", async function () {
    const fixture = await networkHelpers.loadFixture(deployMockFixture);
    const sibling = await createSeriesAndLines(fixture, "same-plan-sibling", {
      coverageLimit: 100n,
      premiumAmount: 10n,
    });
    const siblingShares = await depositCapital(
      fixture,
      sibling.coverageLineId,
      fixture.contributor,
      100n,
      "same plan sibling"
    );
    await fundBackstop(fixture, DEFAULT_COVERAGE);
    await activate(fixture);

    expect(
      (await fixture.protocol.lineBalanceSheet(sibling.coverageLineId))
        .openExposure
    ).to.equal(0n);
    expect(
      await fixture.protocol.contributorExitQuote(
        sibling.coverageLineId,
        siblingShares
      )
    ).to.equal(100n);
    await fixture.protocol
      .connect(fixture.contributor)
      .withdrawReserveCapital(
        sibling.coverageLineId,
        siblingShares,
        100n,
        fixture.contributor.address
      );
    const planSheet = await fixture.protocol.planBalanceSheet(
      fixture.planId,
      await fixture.token.getAddress()
    );
    expect(planSheet.openExposure).to.equal(DEFAULT_COVERAGE);
    expect(planSheet.returned).to.equal(100n);
  });

  it("keeps exposure attributed to its plan inside a shared reserve domain", async function () {
    const fixture = await networkHelpers.loadFixture(deployMockFixture);
    const planSalt = commitment("cross-plan-sibling-plan");
    const siblingPlanId = await fixture.protocol.derivePlanId(
      fixture.domainId,
      planSalt
    );
    await fixture.protocol
      .connect(fixture.domainController)
      .createHealthPlan(
        fixture.domainId,
        planSalt,
        fixture.planController.address,
        commitment("cross-plan metadata"),
        [
          fixture.attesterOne.address,
          fixture.attesterTwo.address,
          fixture.attesterThree.address,
        ]
      );
    const seriesSalt = commitment("cross-plan-sibling-series");
    const coverageSalt = commitment("cross-plan-sibling-coverage");
    const premiumSalt = commitment("cross-plan-sibling-premium");
    const siblingSeriesId = await fixture.protocol.deriveSeriesId(
      siblingPlanId,
      seriesSalt
    );
    await fixture.protocol
      .connect(fixture.planController)
      .createPolicySeries(
        siblingPlanId,
        seriesSalt,
        await fixture.token.getAddress(),
        coverageSalt,
        premiumSalt,
        ethers.ZeroHash,
        COVERAGE_DURATION,
        HOUR,
        HOUR,
        100n,
        10n,
        100n,
        commitment("cross-plan sibling terms")
      );
    const siblingCoverageLine = await fixture.protocol.deriveFundingLineId(
      siblingPlanId,
      coverageSalt
    );
    const siblingPremiumLine = await fixture.protocol.deriveFundingLineId(
      siblingPlanId,
      premiumSalt
    );
    await fixture.protocol
      .connect(fixture.planController)
      .openFundingLine(
        siblingPlanId,
        siblingSeriesId,
        coverageSalt,
        2,
        1_000_000n,
        commitment("cross-plan coverage terms")
      );
    await fixture.protocol
      .connect(fixture.planController)
      .openFundingLine(
        siblingPlanId,
        siblingSeriesId,
        premiumSalt,
        1,
        1_000_000n,
        commitment("cross-plan premium terms")
      );
    expect(siblingPremiumLine).not.to.equal(siblingCoverageLine);

    const siblingShares = await depositCapital(
      fixture,
      siblingCoverageLine,
      fixture.contributor,
      100n,
      "cross plan sibling"
    );
    await fundBackstop(fixture, DEFAULT_COVERAGE);
    await activate(fixture);
    expect(
      (
        await fixture.protocol.planBalanceSheet(
          siblingPlanId,
          await fixture.token.getAddress()
        )
      ).openExposure
    ).to.equal(0n);
    await fixture.protocol
      .connect(fixture.contributor)
      .withdrawReserveCapital(
        siblingCoverageLine,
        siblingShares,
        100n,
        fixture.contributor.address
      );
    const domainSheet = await fixture.protocol.domainBalanceSheet(
      fixture.domainId,
      await fixture.token.getAddress()
    );
    expect(domainSheet.openExposure).to.equal(DEFAULT_COVERAGE);
    expect(domainSheet.returned).to.equal(100n);
  });

  it("rejects sender-fee assets before their extra debit can diverge custody", async function () {
    const fixture = await networkHelpers.loadFixture(
      deploySenderFeeTokenFixture
    );
    await fixture.token.mint(fixture.contributor.address, 1_100n);
    await fixture.token
      .connect(fixture.contributor)
      .approve(fixture.vaultAddress, 1_000n);
    const vault = await ethers.getContractAt(
      "ReserveVault",
      fixture.vaultAddress
    );
    await expect(
      fixture.protocol
        .connect(fixture.contributor)
        .depositReserveCapital(
          fixture.coverageLineId,
          1_000n,
          0,
          commitment("sender fee deposit")
        )
    )
      .to.be.revertedWithCustomError(vault, "UnsupportedTokenBehavior")
      .withArgs(1_000n, 1_010n, 1_000n);
    expect(
      (await fixture.protocol.lineBalanceSheet(fixture.coverageLineId)).funded
    ).to.equal(0n);
  });

  it("blocks deposit callback reentrancy without rejecting the exact outer transfer", async function () {
    const fixture = await networkHelpers.loadFixture(
      deployReentrantTokenFixture
    );
    await fixture.token.mint(fixture.contributor.address, 1_000n);
    await fixture.token
      .connect(fixture.contributor)
      .approve(fixture.vaultAddress, 1_000n);
    const callbackData = fixture.protocol.interface.encodeFunctionData(
      "depositReserveCapital",
      [fixture.coverageLineId, 1n, 0, commitment("nested deposit")]
    );
    await fixture.token.armCallback(
      await fixture.protocol.getAddress(),
      callbackData
    );
    await fixture.protocol
      .connect(fixture.contributor)
      .depositReserveCapital(
        fixture.coverageLineId,
        100n,
        0,
        commitment("outer deposit")
      );
    expect(await fixture.token.callbackAttempted()).to.equal(true);
    expect(await fixture.token.callbackSucceeded()).to.equal(false);
    expect(
      (await fixture.protocol.lineBalanceSheet(fixture.coverageLineId)).funded
    ).to.equal(100n);
    expect(
      await fixture.protocol.contributorShares(
        fixture.coverageLineId,
        fixture.contributor.address
      )
    ).to.equal(100_000_000n);
  });

  it("blocks reserve-vault registry mutation during an exact withdrawal", async function () {
    const fixture = await networkHelpers.loadFixture(
      deployReentrantTokenFixture
    );
    await fixture.token.mint(fixture.contributor.address, 100n);
    await fixture.token
      .connect(fixture.contributor)
      .approve(fixture.vaultAddress, 100n);
    await fixture.protocol
      .connect(fixture.contributor)
      .depositReserveCapital(
        fixture.coverageLineId,
        100n,
        0,
        commitment("registry guard capital")
      );
    const futureToken = await ethers.deployContract("MockERC20", [
      "Callback Vault Asset",
      "CVA",
    ]);
    const callbackData = fixture.protocol.interface.encodeFunctionData(
      "createDomainAssetVault",
      [fixture.domainId, await futureToken.getAddress()]
    );
    await fixture.token.armCallback(
      await fixture.protocol.getAddress(),
      callbackData
    );
    await fixture.protocol
      .connect(fixture.contributor)
      .withdrawReserveCapital(
        fixture.coverageLineId,
        10_000_000n,
        10n,
        fixture.contributor.address
      );
    expect(await fixture.token.callbackAttempted()).to.equal(true);
    expect(await fixture.token.callbackSucceeded()).to.equal(false);
    expect(
      await fixture.protocol.reserveVaults(
        fixture.domainId,
        await futureToken.getAddress()
      )
    ).to.equal(ethers.ZeroAddress);
    expect(
      (await fixture.protocol.lineBalanceSheet(fixture.coverageLineId)).funded
    ).to.equal(90n);
  });

  it("exposes no global owner, upgrade, arbitrary obligation, or global pause", async function () {
    const fixture = await networkHelpers.loadFixture(deployMockFixture);
    for (const contract of [
      fixture.factory,
      fixture.registry,
      fixture.protocol,
    ]) {
      for (const selector of [
        "owner",
        "upgradeTo",
        "upgradeToAndCall",
        "pause",
        "unpause",
      ]) {
        expect(contract.interface.getFunction(selector)).to.equal(null);
      }
    }
    expect(fixture.protocol.interface.getFunction("createObligation")).to.equal(
      null
    );
    expect(fixture.protocol.interface.getFunction("recapitalizeLine")).to.equal(
      null
    );
    await expect(
      fixture.protocol
        .connect(fixture.outsider)
        .proposeDomainController(fixture.domainId, fixture.outsider.address)
    ).to.be.revertedWithCustomError(fixture.protocol, "Unauthorized");
  });
});
