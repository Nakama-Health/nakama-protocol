// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {SignatureChecker} from "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import {ReserveVault} from "./ReserveVault.sol";
import {ProtocolTypes} from "./libraries/ProtocolTypes.sol";
import {ReserveAccounting} from "./libraries/ReserveAccounting.sol";

/// @title Nakama Coverage Protocol — immutable Ethereum vertical slice
/// @notice Domain-scoped reserve custody, contributor exits, obligations, and
/// strict-majority claim resolution without a global owner, proxy, or pause.
/// @dev This is unaudited pre-mainnet code. Deployment tooling deliberately
/// requires an explicit Ethereum mainnet confirmation and expected deployer.
contract NakamaCoverageProtocol is EIP712, ReentrancyGuard {
    using ReserveAccounting for ProtocolTypes.BalanceSheet;

    uint64 public constant CONTROLLER_DELAY = 2 days;
    uint64 public constant MAX_PAUSE_DURATION = 7 days;
    uint64 public constant PAUSE_COOLDOWN = 30 days;
    uint64 public constant MIN_CHALLENGE_WINDOW = 1 hours;
    uint64 public constant MAX_CHALLENGE_WINDOW = 30 days;
    uint16 public constant MIN_ATTESTERS = 3;
    uint16 public constant MAX_ATTESTERS = 31;
    uint256 private constant VIRTUAL_ASSETS = 1;
    uint256 private constant VIRTUAL_SHARES = 1_000_000;

    bytes32 public constant CLAIM_RECIPIENT_TYPEHASH =
        keccak256("ClaimRecipient(bytes32 claimId,address recipient,uint256 nonce,uint256 deadline)");

    bytes32 private constant DOMAIN_ID_NAMESPACE = keccak256("NAKAMA_DOMAIN_V1");
    bytes32 private constant PLAN_ID_NAMESPACE = keccak256("NAKAMA_PLAN_V1");
    bytes32 private constant SERIES_ID_NAMESPACE = keccak256("NAKAMA_SERIES_V1");
    bytes32 private constant LINE_ID_NAMESPACE = keccak256("NAKAMA_FUNDING_LINE_V1");
    bytes32 private constant OBLIGATION_ID_NAMESPACE = keccak256("NAKAMA_OBLIGATION_V1");
    bytes32 private constant CLAIM_ID_NAMESPACE = keccak256("NAKAMA_CLAIM_V1");
    bytes32 private constant CLAIM_OBLIGATION_NAMESPACE = keccak256("NAKAMA_CLAIM_OBLIGATION_V1");

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
    error IntakeClosed();
    error PauseDurationInvalid();
    error PauseCooldownActive(uint64 availableAt);
    error ControllerDelayActive(uint64 validAfter);
    error InvalidAttesterSet();
    error DuplicateAttester(address attester);
    error AlreadyAttested();
    error DecisionAlreadyReached();
    error ChallengeWindowOpen(uint64 closesAt);
    error ChallengeWindowClosed();
    error ChallengeAlreadyUsed();
    error NullifierAlreadyUsed(bytes32 nullifier);
    error SignatureExpired();
    error InvalidSignature();
    error ZeroShares();
    error SlippageExceeded(uint256 minimum, uint256 actual);
    error RecapitalizationExceedsDeficit(uint256 deficit, uint256 amount);
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
    event PolicySeriesCreated(
        bytes32 indexed planId,
        bytes32 indexed seriesId,
        address indexed assetToken,
        uint64 challengeWindow,
        bytes32 termsCommitment
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
    event ClaimCaseStateChanged(
        bytes32 indexed claimId,
        ProtocolTypes.ClaimStatus status,
        uint256 approvedAmount,
        bytes32 decisionCommitment
    );
    event ClaimAttested(
        bytes32 indexed claimId,
        uint8 indexed round,
        address indexed attester,
        bytes32 voteKey,
        uint16 votes,
        uint16 threshold
    );
    event ClaimChallenged(bytes32 indexed claimId, bytes32 indexed counterCommitment, uint64 decisionDeadline);
    event ClaimRecipientAuthorized(
        bytes32 indexed claimId,
        address indexed claimant,
        address indexed recipient,
        uint256 nonce
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
    mapping(bytes32 seriesId => ProtocolTypes.PolicySeries) private _series;
    mapping(bytes32 lineId => ProtocolTypes.FundingLine) private _fundingLines;
    mapping(bytes32 claimId => ProtocolTypes.ClaimCase) private _claims;
    mapping(bytes32 obligationId => ProtocolTypes.Obligation) private _obligations;

    mapping(bytes32 domainId => mapping(address assetToken => ProtocolTypes.BalanceSheet)) private _domainSheets;
    mapping(bytes32 planId => mapping(address assetToken => ProtocolTypes.BalanceSheet)) private _planSheets;
    mapping(bytes32 lineId => ProtocolTypes.BalanceSheet) private _lineSheets;

    mapping(bytes32 domainId => mapping(address assetToken => address vault)) public reserveVaults;
    mapping(address vault => bool registered) public isReserveVault;
    mapping(bytes32 planId => address[] attesters) private _planAttesters;
    mapping(bytes32 planId => mapping(address attester => bool)) public isPlanAttester;
    mapping(bytes32 claimId => mapping(uint8 round => mapping(address attester => bool))) public hasAttested;
    mapping(bytes32 claimId => mapping(uint8 round => mapping(bytes32 voteKey => uint16))) public claimVoteCount;
    mapping(bytes32 planId => mapping(address claimant => mapping(bytes32 nullifier => bool used)))
        public nullifierUsed;

    mapping(bytes32 lineId => uint256 shares) public totalContributorShares;
    mapping(bytes32 lineId => mapping(address contributor => uint256 shares)) public contributorShares;

    constructor() EIP712("Nakama Coverage Protocol", "1") {}

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

    function deriveObligationId(bytes32 lineId, bytes32 salt) public pure returns (bytes32) {
        return keccak256(abi.encode(OBLIGATION_ID_NAMESPACE, lineId, salt));
    }

    function deriveClaimId(bytes32 planId, address claimant, bytes32 nullifier) public pure returns (bytes32) {
        return keccak256(abi.encode(CLAIM_ID_NAMESPACE, planId, claimant, nullifier));
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
        uint64 challengeWindow,
        bytes32 termsCommitment
    ) external returns (bytes32 seriesId) {
        ProtocolTypes.Plan storage plan_ = _requirePlanController(planId);
        _requirePlanIntakeOpen(plan_);
        if (
            salt == bytes32(0) || assetToken == address(0) || termsCommitment == bytes32(0)
                || reserveVaults[plan_.domainId][assetToken] == address(0)
        ) revert InvalidBinding();
        if (challengeWindow < MIN_CHALLENGE_WINDOW || challengeWindow > MAX_CHALLENGE_WINDOW) {
            revert ChallengeWindowClosed();
        }
        seriesId = deriveSeriesId(planId, salt);
        if (_series[seriesId].planId != bytes32(0)) revert AlreadyExists(seriesId);
        _series[seriesId] = ProtocolTypes.PolicySeries({
            planId: planId,
            assetToken: assetToken,
            challengeWindow: challengeWindow,
            active: true,
            termsCommitment: termsCommitment
        });
        emit PolicySeriesCreated(planId, seriesId, assetToken, challengeWindow, termsCommitment);
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
        ProtocolTypes.PolicySeries storage series_ = _series[seriesId];
        if (
            series_.planId != planId || !series_.active || salt == bytes32(0) || capitalCap == 0
                || termsCommitment == bytes32(0)
        ) revert InvalidBinding();
        lineId = deriveFundingLineId(planId, salt);
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

    function recordPremiumPayment(bytes32 lineId, uint256 amount, bytes32 referenceCommitment)
        external
        nonReentrant
    {
        _requireLineType(lineId, ProtocolTypes.FundingLineType.PremiumIncome);
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

    /// @notice Permissionlessly cures an already-finalized funding-line deficit
    /// without reopening controller-gated intake or minting contributor shares.
    function recapitalizeLine(bytes32 lineId, uint256 amount, bytes32 referenceCommitment)
        external
        nonReentrant
    {
        ProtocolTypes.FundingLine storage line_ = _requireLine(lineId);
        ProtocolTypes.BalanceSheet storage sheet = _lineSheets[lineId];
        if (sheet.owed <= sheet.funded) revert InvalidState();
        uint256 deficit = sheet.owed - sheet.funded;
        if (amount > deficit) revert RecapitalizationExceedsDeficit(deficit, amount);
        _fundLineExact(line_, lineId, msg.sender, amount, referenceCommitment, false);
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
            ProtocolTypes.ClaimCase storage claim = _claims[obligation.claimId];
            if (claim.status != ProtocolTypes.ClaimStatus.FinalizedApproved) revert InvalidState();
            claim.status = ProtocolTypes.ClaimStatus.Settled;
            emit ClaimCaseStateChanged(
                obligation.claimId, claim.status, claim.approvedAmount, claim.finalDecisionCommitment
            );
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

    function settleClaimCase(bytes32 claimId) external {
        ProtocolTypes.ClaimCase storage claim = _requireClaim(claimId);
        if (claim.status != ProtocolTypes.ClaimStatus.FinalizedApproved || claim.obligationId == bytes32(0)) {
            revert InvalidState();
        }
        settleObligation(claim.obligationId);
    }

    // ---------------------------------------------------------------------
    // Privacy-minimized claim commitments and one challenge round
    // ---------------------------------------------------------------------

    function openClaimCase(
        bytes32 lineId,
        bytes32 claimCommitment,
        bytes32 nullifier,
        address payoutRecipient,
        uint256 requestedAmount
    ) external returns (bytes32 claimId) {
        ProtocolTypes.FundingLine storage line_ = _requireLine(lineId);
        if (claimCommitment == bytes32(0) || nullifier == bytes32(0) || claimCommitment == nullifier) {
            revert InvalidCommitment();
        }
        if (requestedAmount == 0) revert InvalidAmount();
        ProtocolTypes.PolicySeries storage series_ = _series[line_.seriesId];
        if (series_.planId != line_.planId || series_.assetToken != line_.assetToken) revert InvalidBinding();
        _requireValidAssetRecipient(line_, payoutRecipient);
        if (nullifierUsed[line_.planId][msg.sender][nullifier]) revert NullifierAlreadyUsed(nullifier);

        claimId = deriveClaimId(line_.planId, msg.sender, nullifier);
        if (_claims[claimId].status != ProtocolTypes.ClaimStatus.None) revert AlreadyExists(claimId);
        nullifierUsed[line_.planId][msg.sender][nullifier] = true;
        _claims[claimId] = ProtocolTypes.ClaimCase({
            planId: line_.planId,
            seriesId: line_.seriesId,
            lineId: lineId,
            claimCommitment: claimCommitment,
            nullifier: nullifier,
            claimant: msg.sender,
            payoutRecipient: payoutRecipient,
            requestedAmount: requestedAmount,
            approvedAmount: 0,
            pendingLiability: 0,
            recipientNonce: 0,
            decisionDeadline: 0,
            round: 0,
            fallbackApproved: false,
            roundOneDecisionReady: false,
            roundOneApproved: false,
            status: ProtocolTypes.ClaimStatus.Open,
            fallbackDecisionCommitment: bytes32(0),
            roundOneDecisionCommitment: bytes32(0),
            finalDecisionCommitment: bytes32(0),
            obligationId: bytes32(0)
        });
        emit ClaimCaseStateChanged(claimId, ProtocolTypes.ClaimStatus.Open, 0, claimCommitment);
    }

    function claimRecipientDigest(bytes32 claimId, address recipient, uint256 nonce, uint256 deadline)
        public
        view
        returns (bytes32)
    {
        return _hashTypedDataV4(
            keccak256(abi.encode(CLAIM_RECIPIENT_TYPEHASH, claimId, recipient, nonce, deadline))
        );
    }

    function authorizeClaimRecipient(bytes32 claimId, address recipient, uint256 deadline, bytes calldata signature)
        external
        nonReentrant
    {
        ProtocolTypes.ClaimCase storage claim = _requireClaim(claimId);
        _requireValidAssetRecipient(_fundingLines[claim.lineId], recipient);
        if (block.timestamp > deadline) revert SignatureExpired();
        if (
            claim.status != ProtocolTypes.ClaimStatus.Open
                && claim.status != ProtocolTypes.ClaimStatus.Provisional
                && claim.status != ProtocolTypes.ClaimStatus.Challenged
        ) revert InvalidState();
        uint256 nonce = claim.recipientNonce;
        bytes32 digest = claimRecipientDigest(claimId, recipient, nonce, deadline);
        if (!SignatureChecker.isValidSignatureNowCalldata(claim.claimant, digest, signature)) {
            revert InvalidSignature();
        }
        claim.recipientNonce = nonce + 1;
        claim.payoutRecipient = recipient;
        emit ClaimRecipientAuthorized(claimId, claim.claimant, recipient, nonce);
    }

    function attestClaim(
        bytes32 claimId,
        bool approve,
        uint256 approvedAmount,
        bytes32 decisionCommitment
    ) external {
        ProtocolTypes.ClaimCase storage claim = _requireClaim(claimId);
        uint8 round = claim.round;
        if (round == 0) {
            if (claim.status != ProtocolTypes.ClaimStatus.Open) revert InvalidState();
        } else {
            if (claim.status != ProtocolTypes.ClaimStatus.Challenged) revert InvalidState();
            if (block.timestamp >= claim.decisionDeadline) revert ChallengeWindowClosed();
            if (claim.roundOneDecisionReady) revert DecisionAlreadyReached();
        }
        if (!isPlanAttester[claim.planId][msg.sender]) revert Unauthorized();
        if (hasAttested[claimId][round][msg.sender]) revert AlreadyAttested();
        if (decisionCommitment == bytes32(0)) revert InvalidCommitment();
        if ((approve && (approvedAmount == 0 || approvedAmount > claim.requestedAmount)) || (!approve && approvedAmount != 0)) {
            revert InvalidAmount();
        }

        hasAttested[claimId][round][msg.sender] = true;
        bytes32 voteKey = keccak256(abi.encode(approve, approvedAmount, decisionCommitment));
        uint16 votes = ++claimVoteCount[claimId][round][voteKey];
        uint16 threshold = _plans[claim.planId].attesterThreshold;
        emit ClaimAttested(claimId, round, msg.sender, voteKey, votes, threshold);

        if (votes >= threshold) {
            uint64 challengeWindow = _series[claim.seriesId].challengeWindow;
            if (round == 0) {
                uint256 nextLiability = approve ? approvedAmount : 0;
                _replacePendingClaimLiability(claim.lineId, claim.pendingLiability, nextLiability);
                claim.pendingLiability = nextLiability;
                claim.fallbackApproved = approve;
                claim.approvedAmount = approvedAmount;
                claim.fallbackDecisionCommitment = decisionCommitment;
                claim.decisionDeadline = uint64(block.timestamp) + challengeWindow;
                claim.status = ProtocolTypes.ClaimStatus.Provisional;
                emit ClaimCaseStateChanged(claimId, claim.status, approvedAmount, decisionCommitment);
            } else {
                uint256 nextLiability = approve ? approvedAmount : 0;
                _replacePendingClaimLiability(claim.lineId, claim.pendingLiability, nextLiability);
                claim.pendingLiability = nextLiability;
                claim.roundOneDecisionReady = true;
                claim.roundOneApproved = approve;
                claim.approvedAmount = approvedAmount;
                claim.roundOneDecisionCommitment = decisionCommitment;
                emit ClaimCaseStateChanged(claimId, claim.status, approvedAmount, decisionCommitment);
            }
        }
    }

    function challengeClaim(bytes32 claimId, bytes32 counterCommitment) external {
        ProtocolTypes.ClaimCase storage claim = _requireClaim(claimId);
        if (msg.sender != claim.claimant) revert Unauthorized();
        if (claim.round != 0) revert ChallengeAlreadyUsed();
        if (claim.status != ProtocolTypes.ClaimStatus.Provisional) revert InvalidState();
        if (block.timestamp >= claim.decisionDeadline) revert ChallengeWindowClosed();
        if (counterCommitment == bytes32(0)) revert InvalidCommitment();
        claim.round = 1;
        claim.status = ProtocolTypes.ClaimStatus.Challenged;
        claim.decisionDeadline = uint64(block.timestamp) + _series[claim.seriesId].challengeWindow;
        emit ClaimChallenged(claimId, counterCommitment, claim.decisionDeadline);
        emit ClaimCaseStateChanged(claimId, claim.status, claim.approvedAmount, counterCommitment);
    }

    function finalizeClaimCase(bytes32 claimId) external returns (bytes32 obligationId) {
        ProtocolTypes.ClaimCase storage claim = _requireClaim(claimId);
        if (
            claim.status != ProtocolTypes.ClaimStatus.Provisional
                && claim.status != ProtocolTypes.ClaimStatus.Challenged
        ) revert InvalidState();
        if (block.timestamp < claim.decisionDeadline) revert ChallengeWindowOpen(claim.decisionDeadline);

        bool approved = claim.round == 1 && claim.roundOneDecisionReady
            ? claim.roundOneApproved
            : claim.fallbackApproved;
        bytes32 decisionCommitment = claim.round == 1 && claim.roundOneDecisionReady
            ? claim.roundOneDecisionCommitment
            : claim.fallbackDecisionCommitment;
        uint256 approvedAmount = approved ? claim.approvedAmount : 0;
        claim.finalDecisionCommitment = decisionCommitment;

        if (approved) {
            obligationId = keccak256(abi.encode(CLAIM_OBLIGATION_NAMESPACE, claimId));
            claim.obligationId = obligationId;
            claim.status = ProtocolTypes.ClaimStatus.FinalizedApproved;
            _createObligation(
                obligationId,
                claim.lineId,
                claimId,
                claim.payoutRecipient,
                approvedAmount,
                decisionCommitment
            );
            claim.pendingLiability = 0;
        } else {
            if (claim.pendingLiability != 0) {
                _releasePendingClaimLiability(claim.lineId, claim.pendingLiability);
                claim.pendingLiability = 0;
            }
            claim.approvedAmount = 0;
            claim.status = ProtocolTypes.ClaimStatus.FinalizedDenied;
        }
        emit ClaimCaseStateChanged(claimId, claim.status, approvedAmount, decisionCommitment);
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

    function getPolicySeries(bytes32 seriesId) external view returns (ProtocolTypes.PolicySeries memory) {
        ProtocolTypes.PolicySeries storage series_ = _series[seriesId];
        if (series_.planId == bytes32(0)) revert DoesNotExist(seriesId);
        return series_;
    }

    function getFundingLine(bytes32 lineId) external view returns (ProtocolTypes.FundingLine memory) {
        return _requireLine(lineId);
    }

    function getClaim(bytes32 claimId) external view returns (ProtocolTypes.ClaimCase memory) {
        return _requireClaim(claimId);
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
        _fundLineExact(line_, lineId, payer, amount, referenceCommitment, true);
    }

    function _fundLineExact(
        ProtocolTypes.FundingLine storage line_,
        bytes32 lineId,
        address payer,
        uint256 amount,
        bytes32 referenceCommitment,
        bool enforceCapitalCap
    ) private {
        if (amount == 0) revert InvalidAmount();
        if (referenceCommitment == bytes32(0)) revert InvalidCommitment();
        uint256 nextFunded = _lineSheets[lineId].funded + amount;
        if (enforceCapitalCap && nextFunded > line_.capitalCap) {
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
        _convertPendingClaimToObligation(lineId, amount);
        emit ObligationStatusChanged(obligationId, lineId, ProtocolTypes.ObligationStatus.Proposed, amount);
    }

    function _replacePendingClaimLiability(bytes32 lineId, uint256 previousAmount, uint256 nextAmount) private {
        ProtocolTypes.FundingLine storage line_ = _fundingLines[lineId];
        bytes32 planId = line_.planId;
        bytes32 domainId = _plans[planId].domainId;
        _lineSheets[lineId].replacePendingClaim(previousAmount, nextAmount);
        _planSheets[planId][line_.assetToken].replacePendingClaim(previousAmount, nextAmount);
        _domainSheets[domainId][line_.assetToken].replacePendingClaim(previousAmount, nextAmount);
    }

    function _convertPendingClaimToObligation(bytes32 lineId, uint256 amount) private {
        ProtocolTypes.FundingLine storage line_ = _fundingLines[lineId];
        bytes32 planId = line_.planId;
        bytes32 domainId = _plans[planId].domainId;
        _lineSheets[lineId].convertPendingClaimToObligation(amount);
        _planSheets[planId][line_.assetToken].convertPendingClaimToObligation(amount);
        _domainSheets[domainId][line_.assetToken].convertPendingClaimToObligation(amount);
    }

    function _releasePendingClaimLiability(bytes32 lineId, uint256 amount) private {
        ProtocolTypes.FundingLine storage line_ = _fundingLines[lineId];
        bytes32 planId = line_.planId;
        bytes32 domainId = _plans[planId].domainId;
        _lineSheets[lineId].releasePendingClaim(amount);
        _planSheets[planId][line_.assetToken].releasePendingClaim(amount);
        _domainSheets[domainId][line_.assetToken].releasePendingClaim(amount);
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
            if (sheet.owed != 0 || sheet.pendingClaims != 0 || sheet.reserved != 0) {
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
            recipient == address(0) || recipient == address(this) || recipient == line_.assetToken
                || isReserveVault[recipient]
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

    function _requireClaim(bytes32 claimId) private view returns (ProtocolTypes.ClaimCase storage claim) {
        claim = _claims[claimId];
        if (claim.status == ProtocolTypes.ClaimStatus.None) revert DoesNotExist(claimId);
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
        if (!line_.active || !_series[line_.seriesId].active) revert IntakeClosed();
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
