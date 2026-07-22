// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import {INakamaProgram} from "../interfaces/INakamaProgram.sol";
import {RobinhoodTypes} from "../types/RobinhoodTypes.sol";

/// @notice Segregated six-decimal USDG custody and conservative Phase 0 ledger.
/// Pending request reservation is disclosed separately but is not added twice
/// to encumbrance because it is already contained in maximum member liability.
contract PoolVault is ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint32 public constant ECONOMIC_EVENT_SCHEMA_VERSION = 2;
    bytes32 public constant SPONSOR_REFUND_ACTIVITY_ID = keccak256("NAKAMA_SPONSOR_REFUND_V2");

    error Unauthorized();
    error InvalidAddress();
    error InvalidAmount();
    error InvalidState();
    error ModulesAlreadyBound();
    error UnsupportedTokenBehavior(uint256 expected, uint256 senderDelta, uint256 recipientDelta);
    error FundingCapExceeded(uint256 cap, uint256 nextFunded);
    error LiabilityExceeded(uint256 available, uint256 requested);
    error PendingRequestExists(bytes32 requestId);
    error UnknownPendingRequest(bytes32 requestId);
    error ObligationExists(bytes32 requestId);
    error UnknownObligation(bytes32 requestId);
    error LedgerInsolvent(uint256 actual, uint256 tracked, uint256 encumbered);

    event ModulesBound(address membershipRegistry, address claimManager, address settlementModule);
    /// @notice Canonical V2 accounting event. `actor` is the address directly
    /// authorized to mutate the vault (a role or bound module); `beneficiary`
    /// records the asset recipient when one exists. The flattened accounting
    /// fields are the complete successful post-state and make replay drift
    /// independently detectable without private member data.
    event EconomicActivity(
        bytes32 indexed programId,
        bytes32 indexed activityId,
        RobinhoodTypes.EconomicActivityKind indexed kind,
        bytes32 relatedId,
        address asset,
        address actor,
        address beneficiary,
        int256 amount,
        uint256 sponsorFunded,
        uint256 settled,
        uint256 sponsorRefunded,
        uint256 maximumRemainingMemberLiability,
        uint256 pendingRequestReservation,
        uint256 approvedUnpaidObligations,
        uint256 maturedRefunds,
        uint256 trackedAssets,
        uint256 encumberedAssets
    );

    address public immutable deploymentFactory;
    address public immutable program;
    address public immutable sponsor;
    IERC20 public immutable asset;
    bytes32 public immutable programId;
    uint256 public immutable aggregateCap;

    address public membershipRegistry;
    address public claimManager;
    address public settlementModule;

    RobinhoodTypes.VaultAccounting private _accounting;
    mapping(bytes32 membershipId => uint256 remaining) public memberRemaining;
    mapping(bytes32 membershipId => uint256 pending) public pendingByMember;
    mapping(bytes32 requestId => uint256 amount) public pendingReservation;
    mapping(bytes32 requestId => bytes32 membershipId) public pendingMembership;
    mapping(bytes32 requestId => uint256 amount) public obligationAmount;

    constructor(
        address deploymentFactory_,
        address program_,
        address sponsor_,
        address asset_,
        bytes32 programId_,
        uint256 aggregateCap_
    ) {
        if (
            deploymentFactory_ == address(0) || program_ == address(0) || sponsor_ == address(0)
                || asset_ == address(0) || programId_ == bytes32(0) || aggregateCap_ == 0
        ) revert InvalidAddress();
        deploymentFactory = deploymentFactory_;
        program = program_;
        sponsor = sponsor_;
        asset = IERC20(asset_);
        programId = programId_;
        aggregateCap = aggregateCap_;
    }

    modifier onlyMembershipRegistry() {
        if (msg.sender != membershipRegistry) revert Unauthorized();
        _;
    }

    modifier onlyClaimManager() {
        if (msg.sender != claimManager) revert Unauthorized();
        _;
    }

    function bindModules(address membershipRegistry_, address claimManager_, address settlementModule_) external {
        if (msg.sender != deploymentFactory) revert Unauthorized();
        if (membershipRegistry != address(0)) revert ModulesAlreadyBound();
        if (membershipRegistry_ == address(0) || claimManager_ == address(0) || settlementModule_ == address(0)) {
            revert InvalidAddress();
        }
        membershipRegistry = membershipRegistry_;
        claimManager = claimManager_;
        settlementModule = settlementModule_;
        emit ModulesBound(membershipRegistry_, claimManager_, settlementModule_);
    }

    function fund(uint256 amount, bytes32 fundingReference) external nonReentrant {
        if (msg.sender != sponsor) revert Unauthorized();
        if (amount == 0 || fundingReference == bytes32(0)) revert InvalidAmount();
        RobinhoodTypes.ProgramState programState = INakamaProgram(program).state();
        if (programState != RobinhoodTypes.ProgramState.Draft && programState != RobinhoodTypes.ProgramState.Reviewed) {
            revert InvalidState();
        }
        uint256 nextFunded = _accounting.sponsorFunded + amount;
        if (nextFunded > aggregateCap) revert FundingCapExceeded(aggregateCap, nextFunded);
        _receiveExact(msg.sender, amount);
        _accounting.sponsorFunded = nextFunded;
        _assertSolvent();
        _emitEconomicActivity(
            RobinhoodTypes.EconomicActivityKind.SponsorFunding,
            fundingReference,
            bytes32(0),
            msg.sender,
            address(this),
            int256(amount)
        );
    }

    function registerMemberLiability(bytes32 membershipId, uint256 amount) external onlyMembershipRegistry {
        if (membershipId == bytes32(0) || amount == 0 || memberRemaining[membershipId] != 0) revert InvalidAmount();
        uint256 nextLiability = _accounting.maximumRemainingMemberLiability + amount;
        uint256 capacity = trackedAssets() - _accounting.approvedUnpaidObligations - _accounting.maturedRefunds;
        if (nextLiability > capacity) revert LiabilityExceeded(capacity, nextLiability);
        memberRemaining[membershipId] = amount;
        _accounting.maximumRemainingMemberLiability = nextLiability;
        _assertSolvent();
        _emitEconomicActivity(
            RobinhoodTypes.EconomicActivityKind.MemberLiabilityAdded,
            membershipId,
            bytes32(0),
            msg.sender,
            address(0),
            int256(amount)
        );
    }

    function releaseMemberLiability(bytes32 membershipId) external onlyMembershipRegistry returns (uint256 released) {
        if (pendingByMember[membershipId] != 0) revert InvalidState();
        released = memberRemaining[membershipId];
        memberRemaining[membershipId] = 0;
        _accounting.maximumRemainingMemberLiability -= released;
        _assertSolvent();
        _emitEconomicActivity(
            RobinhoodTypes.EconomicActivityKind.MemberLiabilityReleased,
            membershipId,
            bytes32(0),
            msg.sender,
            address(0),
            -int256(released)
        );
    }

    function reservePendingRequest(bytes32 requestId, bytes32 membershipId, uint256 amount)
        external
        onlyClaimManager
    {
        if (requestId == bytes32(0) || membershipId == bytes32(0) || amount == 0) revert InvalidAmount();
        if (pendingReservation[requestId] != 0) revert PendingRequestExists(requestId);
        uint256 remaining = memberRemaining[membershipId];
        uint256 alreadyPending = pendingByMember[membershipId];
        if (amount > remaining - alreadyPending) revert LiabilityExceeded(remaining - alreadyPending, amount);
        pendingReservation[requestId] = amount;
        pendingMembership[requestId] = membershipId;
        pendingByMember[membershipId] = alreadyPending + amount;
        _accounting.pendingRequestReservation += amount;
        _assertSolvent();
        _emitEconomicActivity(
            RobinhoodTypes.EconomicActivityKind.PendingReservationAdded,
            requestId,
            membershipId,
            msg.sender,
            address(0),
            int256(amount)
        );
    }

    function clearPendingRequest(bytes32 requestId) external onlyClaimManager {
        (uint256 amount, bytes32 membershipId) = _clearPending(requestId);
        _assertSolvent();
        _emitEconomicActivity(
            RobinhoodTypes.EconomicActivityKind.PendingReservationCleared,
            requestId,
            membershipId,
            msg.sender,
            address(0),
            -int256(amount)
        );
    }

    function approveObligation(bytes32 requestId, bytes32 membershipId, uint256 amount) external onlyClaimManager {
        uint256 pending = pendingReservation[requestId];
        if (pending == 0 || pendingMembership[requestId] != membershipId) revert UnknownPendingRequest(requestId);
        if (obligationAmount[requestId] != 0) revert ObligationExists(requestId);
        uint256 remaining = memberRemaining[membershipId];
        if (amount == 0 || amount > pending || amount > remaining) revert LiabilityExceeded(remaining, amount);

        _clearPending(requestId);
        memberRemaining[membershipId] = remaining - amount;
        _accounting.maximumRemainingMemberLiability -= amount;
        _accounting.approvedUnpaidObligations += amount;
        obligationAmount[requestId] = amount;
        _assertSolvent();
        _emitEconomicActivity(
            RobinhoodTypes.EconomicActivityKind.ObligationApproved,
            requestId,
            membershipId,
            msg.sender,
            address(0),
            int256(amount)
        );
    }

    function settleObligation(bytes32 requestId, address recipient)
        external
        nonReentrant
        returns (uint256 amount)
    {
        if (msg.sender != settlementModule) revert Unauthorized();
        if (recipient == address(0) || recipient == address(this)) revert InvalidAddress();
        amount = obligationAmount[requestId];
        if (amount == 0) revert UnknownObligation(requestId);
        obligationAmount[requestId] = 0;
        _accounting.approvedUnpaidObligations -= amount;
        _accounting.settled += amount;
        _sendExact(recipient, amount);
        _assertSolvent();
        _emitEconomicActivity(
            RobinhoodTypes.EconomicActivityKind.ObligationSettled,
            requestId,
            bytes32(0),
            msg.sender,
            recipient,
            -int256(amount)
        );
    }

    function matureSponsorRefund() external returns (uint256 amount) {
        if (msg.sender != program) revert Unauthorized();
        if (_accounting.maximumRemainingMemberLiability != 0 || _accounting.pendingRequestReservation != 0
            || _accounting.approvedUnpaidObligations != 0 || _accounting.maturedRefunds != 0) revert InvalidState();
        amount = trackedAssets();
        _accounting.maturedRefunds = amount;
        _assertSolvent();
        _emitEconomicActivity(
            RobinhoodTypes.EconomicActivityKind.SponsorRefundMatured,
            SPONSOR_REFUND_ACTIVITY_ID,
            bytes32(0),
            msg.sender,
            sponsor,
            int256(amount)
        );
    }

    function claimMaturedRefund(address recipient) external nonReentrant returns (uint256 amount) {
        if (msg.sender != sponsor) revert Unauthorized();
        if (recipient == address(0) || recipient == address(this)) revert InvalidAddress();
        RobinhoodTypes.ProgramState programState = INakamaProgram(program).state();
        if (programState != RobinhoodTypes.ProgramState.Closed && programState != RobinhoodTypes.ProgramState.Cancelled) {
            revert InvalidState();
        }
        amount = _accounting.maturedRefunds;
        if (amount == 0) revert InvalidAmount();
        _accounting.maturedRefunds = 0;
        _accounting.sponsorRefunded += amount;
        _sendExact(recipient, amount);
        _assertSolvent();
        _emitEconomicActivity(
            RobinhoodTypes.EconomicActivityKind.SponsorRefundClaimed,
            SPONSOR_REFUND_ACTIVITY_ID,
            bytes32(0),
            msg.sender,
            recipient,
            -int256(amount)
        );
    }

    function accounting() external view returns (RobinhoodTypes.VaultAccounting memory) {
        return _accounting;
    }

    function actualAssets() public view returns (uint256) {
        return asset.balanceOf(address(this));
    }

    function trackedAssets() public view returns (uint256) {
        return _accounting.sponsorFunded - _accounting.settled - _accounting.sponsorRefunded;
    }

    function encumberedAssets() public view returns (uint256) {
        return _accounting.maximumRemainingMemberLiability + _accounting.approvedUnpaidObligations
            + _accounting.maturedRefunds;
    }

    function freeLiquidity() public view returns (uint256) {
        return trackedAssets() - encumberedAssets();
    }

    function unaccountedAssets() external view returns (uint256) {
        uint256 actual = actualAssets();
        uint256 tracked = trackedAssets();
        return actual > tracked ? actual - tracked : 0;
    }

    function reconciled() external view returns (bool) {
        return actualAssets() >= trackedAssets() && trackedAssets() >= encumberedAssets();
    }

    function _clearPending(bytes32 requestId) private returns (uint256 amount, bytes32 membershipId) {
        amount = pendingReservation[requestId];
        if (amount == 0) revert UnknownPendingRequest(requestId);
        membershipId = pendingMembership[requestId];
        delete pendingReservation[requestId];
        delete pendingMembership[requestId];
        pendingByMember[membershipId] -= amount;
        _accounting.pendingRequestReservation -= amount;
    }

    function _emitEconomicActivity(
        RobinhoodTypes.EconomicActivityKind kind,
        bytes32 activityId,
        bytes32 relatedId,
        address actor,
        address beneficiary,
        int256 amount
    ) private {
        RobinhoodTypes.VaultAccounting memory state = _accounting;
        emit EconomicActivity(
            programId,
            activityId,
            kind,
            relatedId,
            address(asset),
            actor,
            beneficiary,
            amount,
            state.sponsorFunded,
            state.settled,
            state.sponsorRefunded,
            state.maximumRemainingMemberLiability,
            state.pendingRequestReservation,
            state.approvedUnpaidObligations,
            state.maturedRefunds,
            trackedAssets(),
            encumberedAssets()
        );
    }

    function _receiveExact(address payer, uint256 amount) private {
        uint256 payerBefore = asset.balanceOf(payer);
        uint256 vaultBefore = asset.balanceOf(address(this));
        asset.safeTransferFrom(payer, address(this), amount);
        uint256 payerAfter = asset.balanceOf(payer);
        uint256 vaultAfter = asset.balanceOf(address(this));
        uint256 payerDelta = payerBefore >= payerAfter ? payerBefore - payerAfter : 0;
        uint256 vaultDelta = vaultAfter >= vaultBefore ? vaultAfter - vaultBefore : 0;
        if (payerDelta != amount || vaultDelta != amount) {
            revert UnsupportedTokenBehavior(amount, payerDelta, vaultDelta);
        }
    }

    function _sendExact(address recipient, uint256 amount) private {
        uint256 vaultBefore = asset.balanceOf(address(this));
        uint256 recipientBefore = asset.balanceOf(recipient);
        asset.safeTransfer(recipient, amount);
        uint256 vaultAfter = asset.balanceOf(address(this));
        uint256 recipientAfter = asset.balanceOf(recipient);
        uint256 vaultDelta = vaultBefore >= vaultAfter ? vaultBefore - vaultAfter : 0;
        uint256 recipientDelta = recipientAfter >= recipientBefore ? recipientAfter - recipientBefore : 0;
        if (vaultDelta != amount || recipientDelta != amount) {
            revert UnsupportedTokenBehavior(amount, vaultDelta, recipientDelta);
        }
    }

    function _assertSolvent() private view {
        uint256 actual = actualAssets();
        uint256 tracked = trackedAssets();
        uint256 encumbered = encumberedAssets();
        if (actual < tracked || tracked < encumbered) revert LedgerInsolvent(actual, tracked, encumbered);
    }
}
