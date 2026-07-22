// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import {NakamaPolicyRegistry} from "./NakamaPolicyRegistry.sol";
import {ReserveVault} from "./ReserveVault.sol";
import {ProtocolTypes} from "./libraries/ProtocolTypes.sol";
import {ReserveAccounting} from "./libraries/ReserveAccounting.sol";

/// @title Nakama Coverage Protocol — immutable Ethereum vertical slice
/// @notice Domain-scoped reserve custody, contributor exits, obligations, and
/// strict-majority claim resolution without a global owner, proxy, or pause.
/// @dev This is unaudited pre-mainnet code. Deployment tooling deliberately
/// requires an explicit Ethereum mainnet confirmation and expected deployer.
contract NakamaCoverageProtocol is ReentrancyGuard {
    using ReserveAccounting for ProtocolTypes.BalanceSheet;

    uint64 public constant CONTROLLER_DELAY = 2 days;
    uint64 public constant MAX_PAUSE_DURATION = 7 days;
    uint64 public constant PAUSE_COOLDOWN = 30 days;
    uint64 public constant MIN_CHALLENGE_WINDOW = 1 hours;
    uint64 public constant MAX_CHALLENGE_WINDOW = 30 days;
    uint64 public constant MAX_COVERAGE_DURATION = 5 * 365 days;
    uint16 public constant MIN_ATTESTERS = 3;
    uint16 public constant MAX_ATTESTERS = 31;
    uint256 private constant VIRTUAL_ASSETS = 1;
    uint256 private constant VIRTUAL_SHARES = 1_000_000;

    bytes32 private constant DOMAIN_ID_NAMESPACE = keccak256("NAKAMA_DOMAIN_V1");
    bytes32 private constant PLAN_ID_NAMESPACE = keccak256("NAKAMA_PLAN_V1");
    bytes32 private constant SERIES_ID_NAMESPACE = keccak256("NAKAMA_SERIES_V1");
    bytes32 private constant LINE_ID_NAMESPACE = keccak256("NAKAMA_FUNDING_LINE_V1");

    error AlreadyExists(bytes32 id);
    error DoesNotExist(bytes32 id);
    error Unauthorized();
    error InvalidAddress();
    error InvalidAmount();
    error InvalidCommitment();
    error InvalidState();
    error InvalidBinding();
    error InvalidFundingLineType();
    error CapitalCapExceeded(uint256 cap, uint256 nextFunded);
    error CapitalCapTooLow(uint256 required, uint256 provided);
    error IntakeClosed();
    error PauseDurationInvalid();
    error PauseCooldownActive(uint64 availableAt);
    error ControllerDelayActive(uint64 validAfter);
    error InvalidAttesterSet();
    error DuplicateAttester(address attester);
    error ChallengeWindowClosed();
    error ZeroShares();
    error SlippageExceeded(uint256 minimum, uint256 actual);
    error InsufficientShares(uint256 available, uint256 requested);
    error VaultInsolvent(uint256 accounted, uint256 actual);

    event ReserveDomainCreated(bytes32 indexed domainId, address indexed controller, bytes32 metadataCommitment);
    event DomainAssetVaultCreated(bytes32 indexed domainId, address indexed assetToken, address vault);
    event HealthPlanCreated(
        bytes32 indexed domainId,
        bytes32 indexed planId,
        address indexed controller,
        uint16 attesterThreshold,
        uint16 attesterCount
    );
    event FundingLineOpened(
        bytes32 indexed planId,
        bytes32 indexed seriesId,
        bytes32 indexed lineId,
        address assetToken,
        ProtocolTypes.FundingLineType lineType,
        uint256 capitalCap
    );
    event FundingFlowRecorded(
        bytes32 indexed lineId,
        address indexed payer,
        uint256 amount,
        ProtocolTypes.FundingLineType flowKind,
        bytes32 referenceCommitment
    );
    event PolicyPremiumCollected(
        bytes32 indexed positionId,
        bytes32 indexed premiumLineId,
        bytes32 indexed coverageLineId,
        address payer,
        uint256 amount
    );
    event CapitalSharesChanged(
        bytes32 indexed lineId,
        address indexed contributor,
        int256 shareDelta,
        uint256 assetAmount,
        address recipient
    );
    event ObligationStatusChanged(
        bytes32 indexed obligationId,
        bytes32 indexed lineId,
        ProtocolTypes.ObligationStatus status,
        uint256 amount
    );
    event ObligationRecipientUpdated(
        bytes32 indexed obligationId,
        bytes32 indexed claimId,
        address indexed previousRecipient,
        address newRecipient
    );
    event ScopedControlChanged(
        bytes32 indexed scopeId,
        address indexed controller,
        bool active,
        uint64 pauseUntil
    );
    event ControllerTransferProposed(
        bytes32 indexed scopeId,
        address indexed currentController,
        address indexed pendingController,
        uint64 validAfter
    );
    event ControllerTransferAccepted(bytes32 indexed scopeId, address indexed newController);
    event LedgerInitialized(bytes32 indexed scopeId, address indexed assetToken);

    mapping(bytes32 domainId => ProtocolTypes.Domain) private _domains;
    mapping(bytes32 planId => ProtocolTypes.Plan) private _plans;
    mapping(bytes32 lineId => ProtocolTypes.FundingLine) private _fundingLines;
    mapping(bytes32 obligationId => ProtocolTypes.Obligation) private _obligations;

    mapping(bytes32 domainId => mapping(address assetToken => ProtocolTypes.BalanceSheet)) private _domainSheets;
    mapping(bytes32 planId => mapping(address assetToken => ProtocolTypes.BalanceSheet)) private _planSheets;
    mapping(bytes32 lineId => ProtocolTypes.BalanceSheet) private _lineSheets;

    mapping(bytes32 domainId => mapping(address assetToken => address vault)) public reserveVaults;
    mapping(address vault => bool registered) public isReserveVault;
    mapping(bytes32 planId => address[] attesters) private _planAttesters;
    mapping(bytes32 planId => mapping(address attester => bool)) public isPlanAttester;
    mapping(bytes32 lineId => uint256 shares) public totalContributorShares;
    mapping(bytes32 lineId => mapping(address contributor => uint256 shares)) public contributorShares;

    address public immutable deploymentFactory;
    NakamaPolicyRegistry public immutable policyRegistry;

    constructor(address policyRegistry_) {
        if (policyRegistry_ == address(0) || policyRegistry_.code.length == 0) revert InvalidAddress();
        deploymentFactory = msg.sender;
        policyRegistry = NakamaPolicyRegistry(policyRegistry_);
        if (policyRegistry.core() != address(this)) revert InvalidBinding();
    }

    // ---------------------------------------------------------------------
    // Deterministic identifiers
    // ---------------------------------------------------------------------

    function deriveDomainId(address controller, bytes32 salt) public pure returns (bytes32) {
        return keccak256(abi.encode(DOMAIN_ID_NAMESPACE, controller, salt));
    }

    function derivePlanId(bytes32 domainId, bytes32 salt) public pure returns (bytes32) {
        return keccak256(abi.encode(PLAN_ID_NAMESPACE, domainId, salt));
    }

    function deriveSeriesId(bytes32 planId, bytes32 salt) public pure returns (bytes32) {
        return keccak256(abi.encode(SERIES_ID_NAMESPACE, planId, salt));
    }

    function deriveFundingLineId(bytes32 planId, bytes32 salt) public pure returns (bytes32) {
        return keccak256(abi.encode(LINE_ID_NAMESPACE, planId, salt));
    }

    // ---------------------------------------------------------------------
    // Domain, plan, series, and funding-line creation
    // ---------------------------------------------------------------------

    function createReserveDomain(bytes32 salt, bytes32 metadataCommitment) external returns (bytes32 domainId) {
        if (salt == bytes32(0)) revert InvalidCommitment();
        domainId = deriveDomainId(msg.sender, salt);
        if (_domains[domainId].controller != address(0)) revert AlreadyExists(domainId);
        _domains[domainId] = ProtocolTypes.Domain({
            controller: msg.sender,
            pendingController: address(0),
            controllerValidAfter: 0,
            pauseUntil: 0,
            lastPauseStarted: 0,
            active: true,
            metadataCommitment: metadataCommitment
        });
        emit ReserveDomainCreated(domainId, msg.sender, metadataCommitment);
    }

    function createDomainAssetVault(bytes32 domainId, address assetToken)
        external
        nonReentrant
        returns (address vault)
    {
        _requireDomain(domainId);
        if (assetToken == address(0) || assetToken.code.length == 0) revert InvalidAddress();
        if (reserveVaults[domainId][assetToken] != address(0)) {
            revert AlreadyExists(keccak256(abi.encode(domainId, assetToken)));
        }
        bytes32 deploymentSalt = keccak256(abi.encode(domainId, assetToken));
        vault = address(new ReserveVault{salt: deploymentSalt}(address(this), domainId, IERC20(assetToken)));
        reserveVaults[domainId][assetToken] = vault;
        isReserveVault[vault] = true;
        emit DomainAssetVaultCreated(domainId, assetToken, vault);
        emit LedgerInitialized(domainId, assetToken);
    }

    function createHealthPlan(
        bytes32 domainId,
        bytes32 salt,
        address controller,
        bytes32 metadataCommitment,
        address[] calldata attesters
    ) external returns (bytes32 planId) {
        ProtocolTypes.Domain storage domain_ = _requireDomainController(domainId);
        _requireDomainIntakeOpen(domain_);
        if (salt == bytes32(0) || controller == address(0)) revert InvalidAddress();
        uint256 attesterCount = attesters.length;
        if (attesterCount < MIN_ATTESTERS || attesterCount > MAX_ATTESTERS) revert InvalidAttesterSet();

        planId = derivePlanId(domainId, salt);
        if (_plans[planId].controller != address(0)) revert AlreadyExists(planId);
        for (uint256 i; i < attesterCount; ++i) {
            address attester = attesters[i];
            if (attester == address(0)) revert InvalidAddress();
            for (uint256 j; j < i; ++j) {
                if (attesters[j] == attester) revert DuplicateAttester(attester);
            }
            isPlanAttester[planId][attester] = true;
            _planAttesters[planId].push(attester);
        }

        uint16 threshold = uint16(attesterCount / 2 + 1);
        _plans[planId] = ProtocolTypes.Plan({
            domainId: domainId,
            controller: controller,
            pendingController: address(0),
            controllerValidAfter: 0,
            pauseUntil: 0,
            lastPauseStarted: 0,
            attesterCount: uint16(attesterCount),
            attesterThreshold: threshold,
            active: true,
            metadataCommitment: metadataCommitment
        });
        emit HealthPlanCreated(domainId, planId, controller, threshold, uint16(attesterCount));
    }

    function createPolicySeries(
        bytes32 planId,
        bytes32 salt,
        address assetToken,
        bytes32 coverageLineSalt,
        bytes32 premiumLineSalt,
        bytes32 eligibilityRoot,
        uint64 coverageDuration,
        uint64 initialDecisionWindow,
        uint64 challengeWindow,
        uint256 coverageLimit,
        uint256 premiumAmount,
        uint256 exposureCap,
        bytes32 termsCommitment
    ) external returns (bytes32 seriesId) {
        ProtocolTypes.Plan storage plan_ = _requirePlanController(planId);
        _requirePlanIntakeOpen(plan_);
        if (
            salt == bytes32(0) || coverageLineSalt == bytes32(0) || premiumLineSalt == bytes32(0)
                || assetToken == address(0) || termsCommitment == bytes32(0)
                || reserveVaults[plan_.domainId][assetToken] == address(0)
        ) revert InvalidBinding();
        if (
            initialDecisionWindow < MIN_CHALLENGE_WINDOW || initialDecisionWindow > MAX_CHALLENGE_WINDOW
                || challengeWindow < MIN_CHALLENGE_WINDOW || challengeWindow > MAX_CHALLENGE_WINDOW
        ) {
            revert ChallengeWindowClosed();
        }
        if (
            coverageDuration == 0 || coverageDuration > MAX_COVERAGE_DURATION || coverageLimit == 0
                || premiumAmount == 0
                || premiumAmount > coverageLimit
                || exposureCap < coverageLimit
        ) revert InvalidAmount();
        seriesId = deriveSeriesId(planId, salt);
        bytes32 coverageLineId = deriveFundingLineId(planId, coverageLineSalt);
        bytes32 premiumLineId = deriveFundingLineId(planId, premiumLineSalt);
        if (coverageLineId == premiumLineId) revert InvalidBinding();
        policyRegistry.registerPolicySeries(seriesId, ProtocolTypes.PolicySeries({
            planId: planId,
            coverageLineId: coverageLineId,
            premiumLineId: premiumLineId,
            assetToken: assetToken,
            eligibilityRoot: eligibilityRoot,
            coverageDuration: coverageDuration,
            initialDecisionWindow: initialDecisionWindow,
            challengeWindow: challengeWindow,
            attesterThreshold: plan_.attesterThreshold,
            coverageLimit: coverageLimit,
            premiumAmount: premiumAmount,
            exposureCap: exposureCap,
            termsCommitment: termsCommitment,
            outstandingExposure: 0
        }));
    }

    function openFundingLine(
        bytes32 planId,
        bytes32 seriesId,
        bytes32 salt,
        ProtocolTypes.FundingLineType lineType,
        uint256 capitalCap,
        bytes32 termsCommitment
    ) external returns (bytes32 lineId) {
        ProtocolTypes.Plan storage plan_ = _requirePlanController(planId);
        _requirePlanIntakeOpen(plan_);
        ProtocolTypes.PolicySeries memory series_ = policyRegistry.getPolicySeries(seriesId);
        if (
            series_.planId != planId || salt == bytes32(0) || capitalCap == 0 || termsCommitment == bytes32(0)
        ) revert InvalidBinding();
        lineId = deriveFundingLineId(planId, salt);
        if (lineId != series_.coverageLineId && lineId != series_.premiumLineId) revert InvalidBinding();
        if (lineId == series_.premiumLineId && lineType != ProtocolTypes.FundingLineType.PremiumIncome) {
            revert InvalidFundingLineType();
        }
        if (lineId == series_.coverageLineId && lineType == ProtocolTypes.FundingLineType.PremiumIncome) {
            revert InvalidFundingLineType();
        }
        uint256 requiredCap = lineId == series_.coverageLineId ? series_.coverageLimit : 0;
        if (lineId == series_.premiumLineId && series_.premiumAmount > requiredCap) {
            requiredCap = series_.premiumAmount;
        }
        if (capitalCap < requiredCap) revert CapitalCapTooLow(requiredCap, capitalCap);
        if (_fundingLines[lineId].planId != bytes32(0)) revert AlreadyExists(lineId);
        _fundingLines[lineId] = ProtocolTypes.FundingLine({
            planId: planId,
            seriesId: seriesId,
            assetToken: series_.assetToken,
            lineType: lineType,
            active: true,
            capitalCap: capitalCap,
            grossFunded: 0,
            grossSpent: 0,
            grossReturned: 0,
            termsCommitment: termsCommitment
        });
        emit FundingLineOpened(planId, seriesId, lineId, series_.assetToken, lineType, capitalCap);
        emit LedgerInitialized(lineId, series_.assetToken);
    }

    /// @notice Activates one immutable-series position for the caller. The
    /// caller is both holder and premium payer; renewal requires a new series.
    function activatePolicyPosition(
        bytes32 seriesId,
        bytes32[] calldata eligibilityProof
    ) external nonReentrant returns (bytes32 positionId) {
        ProtocolTypes.PolicySeries memory series_ = policyRegistry.getPolicySeries(seriesId);
        bytes32 coverageLineId = series_.coverageLineId;
        bytes32 premiumLineId = series_.premiumLineId;
        ProtocolTypes.FundingLine storage coverageLine = _requireLineIntakeOpen(coverageLineId);
        ProtocolTypes.FundingLine storage premiumLine = _requireLineIntakeOpen(premiumLineId);
        if (
            coverageLine.seriesId != seriesId || premiumLine.seriesId != seriesId
                || coverageLine.planId != series_.planId || premiumLine.planId != series_.planId
                || coverageLine.assetToken != series_.assetToken || premiumLine.assetToken != series_.assetToken
        ) revert InvalidBinding();
        if (premiumLine.lineType != ProtocolTypes.FundingLineType.PremiumIncome) {
            revert InvalidFundingLineType();
        }
        positionId = policyRegistry.activatePolicyPosition(seriesId, msg.sender, eligibilityProof);
        if (
            coverageLine.lineType == ProtocolTypes.FundingLineType.Backstop
                && totalContributorShares[coverageLineId] == 0
        ) revert ZeroShares();
        _collectPolicyPremium(
            positionId,
            premiumLineId,
            coverageLineId,
            msg.sender,
            series_.premiumAmount,
            series_.termsCommitment
        );
        _bookOpenExposure(coverageLine, coverageLineId, series_.coverageLimit);
    }

    function expirePolicyPosition(bytes32 positionId) external nonReentrant {
        (bytes32 coverageLineId, uint256 releasedCoverage) = policyRegistry.expirePolicyPosition(positionId);
        _releaseOpenExposure(_fundingLines[coverageLineId], coverageLineId, releasedCoverage);
    }

    // ---------------------------------------------------------------------
    // Bounded, scope-local controls. Existing exits and finality stay open.
    // ---------------------------------------------------------------------

    function proposeDomainController(bytes32 domainId, address pendingController) external {
        ProtocolTypes.Domain storage domain_ = _requireDomainController(domainId);
        if (pendingController == address(0) || pendingController == domain_.controller) revert InvalidAddress();
        domain_.pendingController = pendingController;
        domain_.controllerValidAfter = uint64(block.timestamp) + CONTROLLER_DELAY;
        emit ControllerTransferProposed(
            domainId, domain_.controller, pendingController, domain_.controllerValidAfter
        );
    }

    function acceptDomainController(bytes32 domainId) external {
        ProtocolTypes.Domain storage domain_ = _requireDomain(domainId);
        if (msg.sender != domain_.pendingController) revert Unauthorized();
        if (block.timestamp < domain_.controllerValidAfter) {
            revert ControllerDelayActive(domain_.controllerValidAfter);
        }
        domain_.controller = msg.sender;
        domain_.pendingController = address(0);
        domain_.controllerValidAfter = 0;
        emit ControllerTransferAccepted(domainId, msg.sender);
    }

    function proposePlanController(bytes32 planId, address pendingController) external {
        ProtocolTypes.Plan storage plan_ = _requirePlanController(planId);
        if (pendingController == address(0) || pendingController == plan_.controller) revert InvalidAddress();
        plan_.pendingController = pendingController;
        plan_.controllerValidAfter = uint64(block.timestamp) + CONTROLLER_DELAY;
        emit ControllerTransferProposed(planId, plan_.controller, pendingController, plan_.controllerValidAfter);
    }

    function acceptPlanController(bytes32 planId) external {
        ProtocolTypes.Plan storage plan_ = _requirePlan(planId);
        if (msg.sender != plan_.pendingController) revert Unauthorized();
        if (block.timestamp < plan_.controllerValidAfter) {
            revert ControllerDelayActive(plan_.controllerValidAfter);
        }
        plan_.controller = msg.sender;
        plan_.pendingController = address(0);
        plan_.controllerValidAfter = 0;
        emit ControllerTransferAccepted(planId, msg.sender);
    }

    function setDomainControls(bytes32 domainId, bool active, uint64 pauseUntil) external {
        ProtocolTypes.Domain storage domain_ = _requireDomainController(domainId);
        _setBoundedPause(domain_.pauseUntil, domain_.lastPauseStarted, pauseUntil);
        if (pauseUntil > block.timestamp) domain_.lastPauseStarted = uint64(block.timestamp);
        domain_.pauseUntil = pauseUntil;
        domain_.active = active;
        emit ScopedControlChanged(domainId, msg.sender, active, pauseUntil);
    }

    function setPlanControls(bytes32 planId, bool active, uint64 pauseUntil) external {
        ProtocolTypes.Plan storage plan_ = _requirePlanController(planId);
        _setBoundedPause(plan_.pauseUntil, plan_.lastPauseStarted, pauseUntil);
        if (pauseUntil > block.timestamp) plan_.lastPauseStarted = uint64(block.timestamp);
        plan_.pauseUntil = pauseUntil;
        plan_.active = active;
        emit ScopedControlChanged(planId, msg.sender, active, pauseUntil);
    }

    // ---------------------------------------------------------------------
    // Exact-delta funding and contributor-controlled exits
    // ---------------------------------------------------------------------

    function fundSponsorBudget(bytes32 lineId, uint256 amount, bytes32 referenceCommitment)
        external
        nonReentrant
    {
        _requireLineType(lineId, ProtocolTypes.FundingLineType.SponsorBudget);
        _fundLine(lineId, msg.sender, amount, referenceCommitment);
    }

    function fundSubsidy(bytes32 lineId, uint256 amount, bytes32 referenceCommitment) external nonReentrant {
        _requireLineType(lineId, ProtocolTypes.FundingLineType.Subsidy);
        _fundLine(lineId, msg.sender, amount, referenceCommitment);
    }

    function depositReserveCapital(bytes32 lineId, uint256 amount, uint256 minShares, bytes32 termsCommitment)
        external
        nonReentrant
        returns (uint256 shares)
    {
        _requireLineType(lineId, ProtocolTypes.FundingLineType.Backstop);
        if (termsCommitment == bytes32(0)) revert InvalidCommitment();
        if (amount == 0) revert InvalidAmount();

        uint256 totalShares = totalContributorShares[lineId];
        shares = _convertToShares(lineId, amount);
        if (shares == 0 || shares > uint256(type(int256).max)) revert ZeroShares();
        if (shares < minShares) revert SlippageExceeded(minShares, shares);

        totalContributorShares[lineId] = totalShares + shares;
        contributorShares[lineId][msg.sender] += shares;
        _fundLine(lineId, msg.sender, amount, termsCommitment);
        emit CapitalSharesChanged(lineId, msg.sender, int256(shares), amount, address(0));
    }

    function recordReserveEarnings(bytes32 lineId, uint256 amount, bytes32 referenceCommitment)
        external
        nonReentrant
    {
        _requireLineType(lineId, ProtocolTypes.FundingLineType.Backstop);
        if (totalContributorShares[lineId] == 0) revert ZeroShares();
        _fundLine(lineId, msg.sender, amount, referenceCommitment);
    }

    function withdrawReserveCapital(bytes32 lineId, uint256 shares, uint256 minAssets, address recipient)
        external
        nonReentrant
        returns (uint256 assets)
    {
        if (shares == 0) revert InvalidAmount();
        ProtocolTypes.FundingLine storage line_ = _requireLine(lineId);
        _requireValidAssetRecipient(line_, recipient);
        if (line_.lineType != ProtocolTypes.FundingLineType.Backstop) revert InvalidFundingLineType();
        uint256 ownedShares = contributorShares[lineId][msg.sender];
        if (shares > ownedShares) revert InsufficientShares(ownedShares, shares);
        uint256 totalShares = totalContributorShares[lineId];
        assets = _convertToAssets(lineId, shares);
        if (assets == 0 || shares > uint256(type(int256).max)) revert ZeroShares();
        if (assets < minAssets) revert SlippageExceeded(minAssets, assets);

        contributorShares[lineId][msg.sender] = ownedShares - shares;
        totalContributorShares[lineId] = totalShares - shares;
        line_.grossReturned += assets;
        _bookWithdrawal(line_, lineId, assets);

        ReserveVault(reserveVaults[_plans[line_.planId].domainId][line_.assetToken]).withdrawTo(recipient, assets);
        emit CapitalSharesChanged(lineId, msg.sender, -int256(shares), assets, recipient);
    }

    // ---------------------------------------------------------------------
    // Obligations: all reservations are full and settlement is permissionless.
    // ---------------------------------------------------------------------

    function reserveObligation(bytes32 obligationId) external {
        ProtocolTypes.Obligation storage obligation = _requireObligation(obligationId);
        if (obligation.status != ProtocolTypes.ObligationStatus.Proposed || obligation.outstanding == 0) {
            revert InvalidState();
        }
        uint256 amount = obligation.outstanding;
        obligation.reserved = amount;
        obligation.status = ProtocolTypes.ObligationStatus.Reserved;
        _bookReservation(obligation.lineId, amount);
        emit ObligationStatusChanged(obligationId, obligation.lineId, obligation.status, amount);
    }

    function settleObligation(bytes32 obligationId) public nonReentrant {
        ProtocolTypes.Obligation storage obligation = _requireObligation(obligationId);
        if (
            obligation.status != ProtocolTypes.ObligationStatus.Reserved || obligation.outstanding == 0
                || obligation.reserved != obligation.outstanding
        ) revert InvalidState();
        ProtocolTypes.FundingLine storage line_ = _fundingLines[obligation.lineId];
        _requireValidAssetRecipient(line_, obligation.recipient);
        if (obligation.claimId != bytes32(0)) {
            policyRegistry.markClaimSettled(obligation.claimId, obligationId);
        }

        uint256 amount = obligation.outstanding;
        obligation.outstanding = 0;
        obligation.reserved = 0;
        obligation.status = ProtocolTypes.ObligationStatus.Settled;
        line_.grossSpent += amount;
        _bookSettlement(line_, obligation.lineId, amount);

        ReserveVault(reserveVaults[_plans[line_.planId].domainId][line_.assetToken]).withdrawTo(
            obligation.recipient, amount
        );
        emit ObligationStatusChanged(obligationId, obligation.lineId, obligation.status, amount);
    }

    // ---------------------------------------------------------------------
    // Registry-backed positions, claims, votes, and recipient authorization
    // ---------------------------------------------------------------------

    function openClaimCase(
        bytes32 positionId,
        bytes32 claimCommitment,
        bytes32 nullifier,
        address payoutRecipient,
        uint256 requestedAmount
    ) external nonReentrant returns (bytes32 claimId) {
        ProtocolTypes.PolicyPosition memory position = policyRegistry.getPolicyPosition(positionId);
        ProtocolTypes.FundingLine storage line_ = _requireLine(position.coverageLineId);
        _requireValidAssetRecipient(line_, payoutRecipient);
        bytes32 coverageLineId;
        (claimId, coverageLineId) = policyRegistry.openClaimCase(
            positionId, msg.sender, claimCommitment, nullifier, payoutRecipient, requestedAmount
        );
        if (coverageLineId != position.coverageLineId) revert InvalidBinding();
        _moveOpenExposureToPending(line_, coverageLineId, requestedAmount);
    }

    function authorizeClaimRecipient(bytes32 claimId, address recipient, uint256 deadline, bytes calldata signature)
        external
        nonReentrant
    {
        ProtocolTypes.ClaimCase memory claim = policyRegistry.getClaim(claimId);
        _requireValidAssetRecipient(_fundingLines[claim.lineId], recipient);
        policyRegistry.authorizeClaimRecipient(claimId, recipient, deadline, signature);
        if (claim.status == ProtocolTypes.ClaimStatus.FinalizedApproved) {
            ProtocolTypes.Obligation storage obligation = _requireObligation(claim.obligationId);
            if (obligation.claimId != claimId || obligation.status == ProtocolTypes.ObligationStatus.Settled) {
                revert InvalidState();
            }
            address previousRecipient = obligation.recipient;
            obligation.recipient = recipient;
            emit ObligationRecipientUpdated(claim.obligationId, claimId, previousRecipient, recipient);
        }
    }

    function attestClaim(
        bytes32 claimId,
        bool approve,
        uint256 approvedAmount,
        bytes32 decisionCommitment
    ) external {
        ProtocolTypes.ClaimCase memory claim = policyRegistry.getClaim(claimId);
        if (!isPlanAttester[claim.planId][msg.sender]) revert Unauthorized();
        policyRegistry.attestClaim(claimId, msg.sender, approve, approvedAmount, decisionCommitment);
    }

    function challengeClaim(bytes32 claimId, bytes32 counterCommitment) external {
        policyRegistry.challengeClaim(claimId, msg.sender, counterCommitment);
    }

    function finalizeClaimCase(bytes32 claimId) external nonReentrant returns (bytes32 obligationId) {
        NakamaPolicyRegistry.ClaimFinalization memory result = policyRegistry.finalizeClaimCase(claimId);
        _finalizePendingClaim(_fundingLines[result.lineId], result.lineId, result.requestedAmount, result.approvedAmount);
        if (result.approved) {
            _requireValidAssetRecipient(_fundingLines[result.lineId], result.payoutRecipient);
            obligationId = result.obligationId;
            _createObligation(
                obligationId,
                result.lineId,
                claimId,
                result.payoutRecipient,
                result.approvedAmount,
                result.decisionCommitment
            );
        }
    }

    // ---------------------------------------------------------------------
    // Public reads. No hosted indexer is required to reconstruct state.
    // ---------------------------------------------------------------------

    function getDomain(bytes32 domainId) external view returns (ProtocolTypes.Domain memory) {
        return _requireDomain(domainId);
    }

    function getPlan(bytes32 planId) external view returns (ProtocolTypes.Plan memory) {
        return _requirePlan(planId);
    }

    function getFundingLine(bytes32 lineId) external view returns (ProtocolTypes.FundingLine memory) {
        return _requireLine(lineId);
    }

    function getObligation(bytes32 obligationId) external view returns (ProtocolTypes.Obligation memory) {
        return _requireObligation(obligationId);
    }

    function getPlanAttesters(bytes32 planId) external view returns (address[] memory) {
        _requirePlan(planId);
        return _planAttesters[planId];
    }

    function domainBalanceSheet(bytes32 domainId, address assetToken)
        external
        view
        returns (ProtocolTypes.BalanceSheet memory)
    {
        _requireDomain(domainId);
        return _domainSheets[domainId][assetToken];
    }

    function planBalanceSheet(bytes32 planId, address assetToken)
        external
        view
        returns (ProtocolTypes.BalanceSheet memory)
    {
        _requirePlan(planId);
        return _planSheets[planId][assetToken];
    }

    function lineBalanceSheet(bytes32 lineId) external view returns (ProtocolTypes.BalanceSheet memory) {
        _requireLine(lineId);
        return _lineSheets[lineId];
    }

    function freeLineAssets(bytes32 lineId) public view returns (uint256) {
        _requireLine(lineId);
        return _lineSheets[lineId].freeAssets();
    }

    function contributorDepositQuote(bytes32 lineId, uint256 assets) external view returns (uint256) {
        _requireLine(lineId);
        if (assets == 0) return 0;
        return _convertToShares(lineId, assets);
    }

    function contributorExitQuote(bytes32 lineId, uint256 shares) external view returns (uint256) {
        uint256 totalShares = totalContributorShares[lineId];
        if (shares == 0 || totalShares == 0 || shares > totalShares) return 0;
        _requireLine(lineId);
        return _convertToAssets(lineId, shares);
    }

    function vaultCoverage(bytes32 domainId, address assetToken)
        external
        view
        returns (uint256 accounted, uint256 actual, bool solvent)
    {
        address vault = reserveVaults[domainId][assetToken];
        if (vault == address(0)) revert DoesNotExist(keccak256(abi.encode(domainId, assetToken)));
        accounted = _domainSheets[domainId][assetToken].funded;
        actual = IERC20(assetToken).balanceOf(vault);
        solvent = actual >= accounted;
    }

    function assertVaultSolvent(bytes32 domainId, address assetToken) external view {
        address vault = reserveVaults[domainId][assetToken];
        if (vault == address(0)) revert DoesNotExist(keccak256(abi.encode(domainId, assetToken)));
        uint256 accounted = _domainSheets[domainId][assetToken].funded;
        uint256 actual = IERC20(assetToken).balanceOf(vault);
        if (actual < accounted) revert VaultInsolvent(accounted, actual);
    }

    // ---------------------------------------------------------------------
    // Internal accounting and authorization
    // ---------------------------------------------------------------------

    function _fundLine(bytes32 lineId, address payer, uint256 amount, bytes32 referenceCommitment) private {
        ProtocolTypes.FundingLine storage line_ = _requireLineIntakeOpen(lineId);
        if (amount == 0) revert InvalidAmount();
        if (referenceCommitment == bytes32(0)) revert InvalidCommitment();
        uint256 nextFunded = _lineSheets[lineId].funded + amount;
        if (nextFunded > line_.capitalCap) {
            revert CapitalCapExceeded(line_.capitalCap, nextFunded);
        }

        line_.grossFunded += amount;
        bytes32 planId = line_.planId;
        bytes32 domainId = _plans[planId].domainId;
        _lineSheets[lineId].bookFunding(amount);
        _planSheets[planId][line_.assetToken].bookFunding(amount);
        _domainSheets[domainId][line_.assetToken].bookFunding(amount);

        ReserveVault(reserveVaults[domainId][line_.assetToken]).depositFrom(payer, amount);
        emit FundingFlowRecorded(lineId, payer, amount, line_.lineType, referenceCommitment);
    }

    /// @dev Premiums are accepted only as part of an atomic position
    /// activation. A distinct PremiumIncome line records provenance, then the
    /// same transaction credits the assets to that position's claims-paying
    /// coverage line. The mandatory receipt does not consume the voluntary
    /// capital cap, so third-party pre-funding cannot make enrollment fail.
    function _collectPolicyPremium(
        bytes32 positionId,
        bytes32 premiumLineId,
        bytes32 coverageLineId,
        address payer,
        uint256 amount,
        bytes32 referenceCommitment
    ) private {
        ProtocolTypes.FundingLine storage premiumLine = _requireLineIntakeOpen(premiumLineId);
        ProtocolTypes.FundingLine storage coverageLine = _requireLineIntakeOpen(coverageLineId);
        if (premiumLine.lineType != ProtocolTypes.FundingLineType.PremiumIncome) {
            revert InvalidFundingLineType();
        }
        if (
            premiumLine.planId != coverageLine.planId || premiumLine.seriesId != coverageLine.seriesId
                || premiumLine.assetToken != coverageLine.assetToken || amount == 0
        ) revert InvalidBinding();
        if (referenceCommitment == bytes32(0)) revert InvalidCommitment();
        if (amount > premiumLine.capitalCap) {
            revert CapitalCapExceeded(premiumLine.capitalCap, amount);
        }

        premiumLine.grossFunded += amount;
        if (premiumLineId != coverageLineId) {
            // The distinct premium line is an attribution ledger, never a
            // custody sink. Its receipt is consumed by the immutable coverage
            // destination in the same transaction.
            premiumLine.grossSpent += amount;
            coverageLine.grossFunded += amount;
        }

        bytes32 planId = coverageLine.planId;
        bytes32 domainId = _plans[planId].domainId;
        _lineSheets[coverageLineId].bookFunding(amount);
        _planSheets[planId][coverageLine.assetToken].bookFunding(amount);
        _domainSheets[domainId][coverageLine.assetToken].bookFunding(amount);

        ReserveVault(reserveVaults[domainId][coverageLine.assetToken]).depositFrom(payer, amount);
        emit FundingFlowRecorded(
            premiumLineId,
            payer,
            amount,
            ProtocolTypes.FundingLineType.PremiumIncome,
            referenceCommitment
        );
        emit PolicyPremiumCollected(positionId, premiumLineId, coverageLineId, payer, amount);
    }

    function _createObligation(
        bytes32 obligationId,
        bytes32 lineId,
        bytes32 claimId,
        address recipient,
        uint256 amount,
        bytes32 reasonCommitment
    ) private {
        if (obligationId == bytes32(0) || recipient == address(0) || amount == 0) revert InvalidAmount();
        if (reasonCommitment == bytes32(0)) revert InvalidCommitment();
        if (_obligations[obligationId].status != ProtocolTypes.ObligationStatus.None) {
            revert AlreadyExists(obligationId);
        }
        _requireLine(lineId);
        _obligations[obligationId] = ProtocolTypes.Obligation({
            lineId: lineId,
            claimId: claimId,
            recipient: recipient,
            principal: amount,
            outstanding: amount,
            reserved: 0,
            status: ProtocolTypes.ObligationStatus.Proposed,
            reasonCommitment: reasonCommitment
        });
        emit ObligationStatusChanged(obligationId, lineId, ProtocolTypes.ObligationStatus.Proposed, amount);
    }

    function _bookOpenExposure(
        ProtocolTypes.FundingLine storage line_,
        bytes32 lineId,
        uint256 amount
    ) private {
        bytes32 planId = line_.planId;
        bytes32 domainId = _plans[planId].domainId;
        _lineSheets[lineId].bookOpenExposure(amount);
        _planSheets[planId][line_.assetToken].recordAggregateOpenExposure(amount);
        _domainSheets[domainId][line_.assetToken].recordAggregateOpenExposure(amount);
    }

    function _moveOpenExposureToPending(
        ProtocolTypes.FundingLine storage line_,
        bytes32 lineId,
        uint256 amount
    ) private {
        bytes32 planId = line_.planId;
        bytes32 domainId = _plans[planId].domainId;
        _lineSheets[lineId].moveOpenExposureToPending(amount);
        _planSheets[planId][line_.assetToken].moveOpenExposureToPending(amount);
        _domainSheets[domainId][line_.assetToken].moveOpenExposureToPending(amount);
    }

    function _finalizePendingClaim(
        ProtocolTypes.FundingLine storage line_,
        bytes32 lineId,
        uint256 requestedAmount,
        uint256 approvedAmount
    ) private {
        bytes32 planId = line_.planId;
        bytes32 domainId = _plans[planId].domainId;
        _lineSheets[lineId].finalizePendingClaim(requestedAmount, approvedAmount);
        _planSheets[planId][line_.assetToken].finalizePendingClaim(requestedAmount, approvedAmount);
        _domainSheets[domainId][line_.assetToken].finalizePendingClaim(requestedAmount, approvedAmount);
    }

    function _releaseOpenExposure(
        ProtocolTypes.FundingLine storage line_,
        bytes32 lineId,
        uint256 amount
    ) private {
        bytes32 planId = line_.planId;
        bytes32 domainId = _plans[planId].domainId;
        _lineSheets[lineId].releaseOpenExposure(amount);
        _planSheets[planId][line_.assetToken].releaseOpenExposure(amount);
        _domainSheets[domainId][line_.assetToken].releaseOpenExposure(amount);
    }

    function _bookReservation(bytes32 lineId, uint256 amount) private {
        ProtocolTypes.FundingLine storage line_ = _fundingLines[lineId];
        bytes32 planId = line_.planId;
        bytes32 domainId = _plans[planId].domainId;
        _lineSheets[lineId].bookReservation(amount);
        _planSheets[planId][line_.assetToken].recordAggregateReservation(amount);
        _domainSheets[domainId][line_.assetToken].recordAggregateReservation(amount);
    }

    function _bookSettlement(ProtocolTypes.FundingLine storage line_, bytes32 lineId, uint256 amount) private {
        bytes32 planId = line_.planId;
        bytes32 domainId = _plans[planId].domainId;
        _lineSheets[lineId].bookSettlement(amount);
        _planSheets[planId][line_.assetToken].recordAggregateSettlement(amount);
        _domainSheets[domainId][line_.assetToken].recordAggregateSettlement(amount);
    }

    function _bookWithdrawal(ProtocolTypes.FundingLine storage line_, bytes32 lineId, uint256 amount) private {
        bytes32 planId = line_.planId;
        bytes32 domainId = _plans[planId].domainId;
        _lineSheets[lineId].bookWithdrawal(amount);
        _planSheets[planId][line_.assetToken].recordAggregateWithdrawal(amount);
        _domainSheets[domainId][line_.assetToken].recordAggregateWithdrawal(amount);
    }

    function _convertToShares(bytes32 lineId, uint256 assets) private view returns (uint256) {
        ProtocolTypes.BalanceSheet storage sheet = _lineSheets[lineId];
        uint256 totalShares = totalContributorShares[lineId];
        uint256 pricingEquity;
        if (totalShares == 0) {
            if (
                sheet.owed != 0 || sheet.pendingClaims != 0 || sheet.openExposure != 0
                    || sheet.reserved != 0
            ) {
                revert InvalidState();
            }
            // A virtual-share residual can remain after the last honest exit.
            // Pricing the restart against that accounted residual prevents the
            // new depositor from capturing it while keeping the line live.
            pricingEquity = sheet.funded;
        } else {
            // Pending claims are reversible and therefore cannot temporarily
            // cheapen new shares before a denial or partial approval releases
            // their encumbrance. Finalized owed liabilities remain deducted.
            if (sheet.funded <= sheet.owed) revert InvalidState();
            pricingEquity = sheet.funded - sheet.owed;
        }
        return Math.mulDiv(
            assets,
            totalShares + VIRTUAL_SHARES,
            pricingEquity + VIRTUAL_ASSETS,
            Math.Rounding.Floor
        );
    }

    function _convertToAssets(bytes32 lineId, uint256 shares) private view returns (uint256) {
        return Math.mulDiv(
            shares,
            _lineSheets[lineId].freeAssets() + VIRTUAL_ASSETS,
            totalContributorShares[lineId] + VIRTUAL_SHARES,
            Math.Rounding.Floor
        );
    }

    function _vaultForLine(ProtocolTypes.FundingLine storage line_) private view returns (address) {
        return reserveVaults[_plans[line_.planId].domainId][line_.assetToken];
    }

    function _requireValidAssetRecipient(ProtocolTypes.FundingLine storage line_, address recipient)
        private
        view
    {
        if (
            recipient == address(0) || recipient == address(this) || recipient == deploymentFactory
                || recipient == address(policyRegistry) || recipient == line_.assetToken || isReserveVault[recipient]
        ) revert InvalidAddress();
    }

    function _requireLineType(bytes32 lineId, ProtocolTypes.FundingLineType expected) private view {
        ProtocolTypes.FundingLine storage line_ = _requireLine(lineId);
        if (line_.lineType != expected) revert InvalidFundingLineType();
    }

    function _requireDomain(bytes32 domainId) private view returns (ProtocolTypes.Domain storage domain_) {
        domain_ = _domains[domainId];
        if (domain_.controller == address(0)) revert DoesNotExist(domainId);
    }

    function _requireDomainController(bytes32 domainId)
        private
        view
        returns (ProtocolTypes.Domain storage domain_)
    {
        domain_ = _requireDomain(domainId);
        if (msg.sender != domain_.controller) revert Unauthorized();
    }

    function _requirePlan(bytes32 planId) private view returns (ProtocolTypes.Plan storage plan_) {
        plan_ = _plans[planId];
        if (plan_.controller == address(0)) revert DoesNotExist(planId);
    }

    function _requirePlanController(bytes32 planId) private view returns (ProtocolTypes.Plan storage plan_) {
        plan_ = _requirePlan(planId);
        if (msg.sender != plan_.controller) revert Unauthorized();
    }

    function _requireLine(bytes32 lineId) private view returns (ProtocolTypes.FundingLine storage line_) {
        line_ = _fundingLines[lineId];
        if (line_.planId == bytes32(0)) revert DoesNotExist(lineId);
    }

    function _requireObligation(bytes32 obligationId)
        private
        view
        returns (ProtocolTypes.Obligation storage obligation)
    {
        obligation = _obligations[obligationId];
        if (obligation.status == ProtocolTypes.ObligationStatus.None) revert DoesNotExist(obligationId);
    }

    function _requireDomainIntakeOpen(ProtocolTypes.Domain storage domain_) private view {
        if (!domain_.active || domain_.pauseUntil > block.timestamp) revert IntakeClosed();
    }

    function _requirePlanIntakeOpen(ProtocolTypes.Plan storage plan_) private view {
        ProtocolTypes.Domain storage domain_ = _domains[plan_.domainId];
        _requireDomainIntakeOpen(domain_);
        if (!plan_.active || plan_.pauseUntil > block.timestamp) revert IntakeClosed();
    }

    function _requireLineIntakeOpen(bytes32 lineId)
        private
        view
        returns (ProtocolTypes.FundingLine storage line_)
    {
        line_ = _requireLine(lineId);
        ProtocolTypes.Plan storage plan_ = _plans[line_.planId];
        _requirePlanIntakeOpen(plan_);
        if (!line_.active) revert IntakeClosed();
    }

    function _setBoundedPause(uint64 currentPauseUntil, uint64 lastPauseStarted, uint64 nextPauseUntil)
        private
        view
    {
        if (nextPauseUntil == 0 || nextPauseUntil <= block.timestamp) return;
        if (currentPauseUntil > block.timestamp) revert PauseDurationInvalid();
        uint64 availableAt = lastPauseStarted + PAUSE_COOLDOWN;
        if (lastPauseStarted != 0 && block.timestamp < availableAt) revert PauseCooldownActive(availableAt);
        if (nextPauseUntil > block.timestamp + MAX_PAUSE_DURATION) revert PauseDurationInvalid();
    }
}
