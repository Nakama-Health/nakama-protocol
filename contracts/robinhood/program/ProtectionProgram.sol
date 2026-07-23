// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.28;

import {IClaimManager} from "../interfaces/IClaimManager.sol";
import {IMembershipRegistry} from "../interfaces/IMembershipRegistry.sol";
import {IPoolVault} from "../interfaces/IPoolVault.sol";
import {ISafetyGuardian} from "../interfaces/ISafetyGuardian.sol";
import {RobinhoodTypes} from "../types/RobinhoodTypes.sol";

/// @notice Immutable terms, authority, lifecycle, and activation gates for one
/// sponsor-funded Phase 0 program. Pauses are scoped in SafetyGuardian rather
/// than represented by an ambiguous global state.
contract ProtectionProgram {
    uint64 public constant MAX_REVIEW_WINDOW = 365 days;

    error Unauthorized();
    error InvalidAddress();
    error InvalidConfiguration();
    error InvalidState(RobinhoodTypes.ProgramState expected, RobinhoodTypes.ProgramState actual);
    error InvalidTime(uint64 requiredAt, uint64 actualTime);
    error ModulesAlreadyBound();
    error ModulesNotBound();
    error ActivationNotApproved();
    error FundingIncomplete(uint256 required, uint256 tracked, uint256 actual);
    error OutstandingRights(uint32 activeMemberships, uint256 openRequests, uint256 encumberedAssets);
    error ActionPaused(RobinhoodTypes.PauseScope scope);

    event ModulesBound(
        address vault,
        address membershipRegistry,
        address decisionModule,
        address claimManager,
        address settlementModule,
        address agentAuthorizationRegistry,
        address safetyGuardian
    );
    event ProgramStateChanged(
        bytes32 indexed programId,
        RobinhoodTypes.ProgramState previous,
        RobinhoodTypes.ProgramState next,
        address indexed actor
    );
    event ActivationApprovalRecorded(bytes32 indexed programId, address indexed actor, bool sponsorApproval);
    event CancellationApprovalRecorded(bytes32 indexed programId, address indexed actor, bool sponsorApproval);

    bytes32 public immutable programId;
    bytes32 public immutable suiteId;
    bytes32 public immutable sponsorLegalEntityCommitment;
    bytes32 public immutable metadataCommitment;
    bytes32 public immutable termsCommitment;
    bytes32 public immutable privacyCommitment;
    bytes32 public immutable operationsCommitment;
    bytes32 public immutable activationChecklistCommitment;

    address public immutable deploymentFactory;
    address public immutable fundingAsset;
    address public immutable sponsor;
    address public immutable operator;
    address public immutable initialReviewer;
    address public immutable appealReviewer;
    address public immutable settlementRole;
    address public immutable guardianRole;
    address public immutable eligibilityAttestor;

    uint64 public immutable enrollmentOpensAt;
    uint64 public immutable activeAt;
    uint64 public immutable runoffAt;
    uint64 public immutable closesAt;
    uint64 public immutable appealWindow;
    uint64 public immutable initialDecisionWindow;
    uint64 public immutable appealDecisionWindow;
    uint256 public immutable perMemberCap;
    uint256 public immutable aggregateCap;
    uint32 public immutable maxMembers;

    RobinhoodTypes.ProgramState public state;
    bool public sponsorActivationApproved;
    bool public operatorActivationApproved;
    bool public sponsorCancellationApproved;
    bool public operatorCancellationApproved;

    address public vault;
    address public membershipRegistry;
    address public decisionModule;
    address public claimManager;
    address public settlementModule;
    address public agentAuthorizationRegistry;
    address public safetyGuardian;

    constructor(
        address deploymentFactory_,
        bytes32 programId_,
        bytes32 suiteId_,
        RobinhoodTypes.ProgramConfig memory config,
        RobinhoodTypes.RoleConfig memory roles
    ) {
        if (
            deploymentFactory_ == address(0) || programId_ == bytes32(0) || suiteId_ == bytes32(0)
                || config.sponsorLegalEntityCommitment == bytes32(0)
                || config.metadataCommitment == bytes32(0) || config.termsCommitment == bytes32(0)
                || config.privacyCommitment == bytes32(0) || config.operationsCommitment == bytes32(0)
                || config.activationChecklistCommitment == bytes32(0)
        ) revert InvalidConfiguration();
        if (
            config.fundingAsset == address(0) || roles.sponsor == address(0) || roles.operator == address(0)
                || roles.initialReviewer == address(0) || roles.appealReviewer == address(0)
                || roles.settlement == address(0) || roles.guardian == address(0)
                || roles.eligibilityAttestor == address(0)
        ) revert InvalidAddress();
        if (
            roles.sponsor == roles.operator || roles.sponsor == roles.initialReviewer
                || roles.sponsor == roles.appealReviewer || roles.sponsor == roles.settlement
                || roles.sponsor == roles.guardian || roles.operator == roles.initialReviewer
                || roles.operator == roles.appealReviewer || roles.operator == roles.settlement
                || roles.operator == roles.guardian || roles.initialReviewer == roles.appealReviewer
                || roles.initialReviewer == roles.settlement || roles.initialReviewer == roles.guardian
                || roles.appealReviewer == roles.settlement || roles.appealReviewer == roles.guardian
                || roles.settlement == roles.guardian || roles.eligibilityAttestor == roles.initialReviewer
                || roles.eligibilityAttestor == roles.appealReviewer || roles.eligibilityAttestor == roles.settlement
                || roles.eligibilityAttestor == roles.guardian
        ) revert InvalidConfiguration();
        if (
            roles.sponsor == config.fundingAsset || roles.operator == config.fundingAsset
                || roles.initialReviewer == config.fundingAsset || roles.appealReviewer == config.fundingAsset
                || roles.settlement == config.fundingAsset || roles.guardian == config.fundingAsset
                || roles.eligibilityAttestor == config.fundingAsset
        ) revert InvalidConfiguration();
        if (
            config.enrollmentOpensAt >= config.activeAt || config.activeAt >= config.runoffAt
                || config.runoffAt >= config.closesAt || config.appealWindow == 0
                || config.initialDecisionWindow == 0 || config.appealDecisionWindow == 0 || config.perMemberCap == 0
                || config.aggregateCap < config.perMemberCap || config.maxMembers == 0
                || config.appealWindow > MAX_REVIEW_WINDOW
                || config.initialDecisionWindow > MAX_REVIEW_WINDOW
                || config.appealDecisionWindow > MAX_REVIEW_WINDOW
                || config.perMemberCap > uint256(type(int256).max)
                || config.aggregateCap > uint256(type(int256).max)
                || uint256(config.maxMembers) * config.perMemberCap > config.aggregateCap
        ) revert InvalidConfiguration();

        deploymentFactory = deploymentFactory_;
        programId = programId_;
        suiteId = suiteId_;
        sponsorLegalEntityCommitment = config.sponsorLegalEntityCommitment;
        metadataCommitment = config.metadataCommitment;
        termsCommitment = config.termsCommitment;
        privacyCommitment = config.privacyCommitment;
        operationsCommitment = config.operationsCommitment;
        activationChecklistCommitment = config.activationChecklistCommitment;
        fundingAsset = config.fundingAsset;
        enrollmentOpensAt = config.enrollmentOpensAt;
        activeAt = config.activeAt;
        runoffAt = config.runoffAt;
        closesAt = config.closesAt;
        appealWindow = config.appealWindow;
        initialDecisionWindow = config.initialDecisionWindow;
        appealDecisionWindow = config.appealDecisionWindow;
        perMemberCap = config.perMemberCap;
        aggregateCap = config.aggregateCap;
        maxMembers = config.maxMembers;
        sponsor = roles.sponsor;
        operator = roles.operator;
        initialReviewer = roles.initialReviewer;
        appealReviewer = roles.appealReviewer;
        settlementRole = roles.settlement;
        guardianRole = roles.guardian;
        eligibilityAttestor = roles.eligibilityAttestor;
        state = RobinhoodTypes.ProgramState.Draft;
    }

    function bindModules(RobinhoodTypes.ProgramDeployment calldata deployment) external {
        if (msg.sender != deploymentFactory) revert Unauthorized();
        if (vault != address(0)) revert ModulesAlreadyBound();
        if (deployment.programId != programId || deployment.program != address(this)) revert InvalidConfiguration();
        if (
            deployment.vault == address(0) || deployment.membershipRegistry == address(0)
                || deployment.decisionModule == address(0) || deployment.claimManager == address(0)
                || deployment.settlementModule == address(0) || deployment.agentAuthorizationRegistry == address(0)
                || deployment.safetyGuardian == address(0)
        ) revert InvalidAddress();
        vault = deployment.vault;
        membershipRegistry = deployment.membershipRegistry;
        decisionModule = deployment.decisionModule;
        claimManager = deployment.claimManager;
        settlementModule = deployment.settlementModule;
        agentAuthorizationRegistry = deployment.agentAuthorizationRegistry;
        safetyGuardian = deployment.safetyGuardian;
        emit ModulesBound(
            deployment.vault,
            deployment.membershipRegistry,
            deployment.decisionModule,
            deployment.claimManager,
            deployment.settlementModule,
            deployment.agentAuthorizationRegistry,
            deployment.safetyGuardian
        );
    }

    function markReviewed() external {
        _requireModulesBound();
        if (msg.sender != operator) revert Unauthorized();
        _transition(RobinhoodTypes.ProgramState.Draft, RobinhoodTypes.ProgramState.Reviewed);
    }

    function markFunded() external {
        _requireModulesBound();
        if (state != RobinhoodTypes.ProgramState.Reviewed) {
            revert InvalidState(RobinhoodTypes.ProgramState.Reviewed, state);
        }
        uint256 tracked = IPoolVault(vault).trackedAssets();
        uint256 actual = IPoolVault(vault).actualAssets();
        if (tracked != aggregateCap || actual < aggregateCap) revert FundingIncomplete(aggregateCap, tracked, actual);
        _setState(RobinhoodTypes.ProgramState.Funded);
    }

    function approveActivationAsSponsor() external {
        if (msg.sender != sponsor) revert Unauthorized();
        if (state != RobinhoodTypes.ProgramState.Funded) {
            revert InvalidState(RobinhoodTypes.ProgramState.Funded, state);
        }
        sponsorActivationApproved = true;
        emit ActivationApprovalRecorded(programId, msg.sender, true);
    }

    function approveActivationAsOperator() external {
        if (msg.sender != operator) revert Unauthorized();
        if (state != RobinhoodTypes.ProgramState.Funded) {
            revert InvalidState(RobinhoodTypes.ProgramState.Funded, state);
        }
        operatorActivationApproved = true;
        emit ActivationApprovalRecorded(programId, msg.sender, false);
    }

    function openEnrollment() external {
        if (state != RobinhoodTypes.ProgramState.Funded) {
            revert InvalidState(RobinhoodTypes.ProgramState.Funded, state);
        }
        if (!sponsorActivationApproved || !operatorActivationApproved) revert ActivationNotApproved();
        if (block.timestamp < enrollmentOpensAt || block.timestamp >= activeAt) {
            revert InvalidTime(enrollmentOpensAt, uint64(block.timestamp));
        }
        _requireNotPaused(RobinhoodTypes.PauseScope.Enrollment);
        _setState(RobinhoodTypes.ProgramState.EnrollmentOpen);
    }

    function activate() external {
        if (state != RobinhoodTypes.ProgramState.EnrollmentOpen) {
            revert InvalidState(RobinhoodTypes.ProgramState.EnrollmentOpen, state);
        }
        if (block.timestamp < activeAt || block.timestamp >= runoffAt) revert InvalidTime(activeAt, uint64(block.timestamp));
        _setState(RobinhoodTypes.ProgramState.Active);
    }

    function enterRunoff() external {
        if (state != RobinhoodTypes.ProgramState.Active && state != RobinhoodTypes.ProgramState.EnrollmentOpen) {
            revert InvalidState(RobinhoodTypes.ProgramState.Active, state);
        }
        if (block.timestamp < runoffAt) revert InvalidTime(runoffAt, uint64(block.timestamp));
        _setState(RobinhoodTypes.ProgramState.Runoff);
    }

    function close() external {
        if (state != RobinhoodTypes.ProgramState.Runoff) {
            revert InvalidState(RobinhoodTypes.ProgramState.Runoff, state);
        }
        if (block.timestamp < closesAt) revert InvalidTime(closesAt, uint64(block.timestamp));
        uint32 active = IMembershipRegistry(membershipRegistry).activeMemberships();
        uint256 open = IClaimManager(claimManager).openRequestCount();
        uint256 encumbered = IPoolVault(vault).encumberedAssets();
        if (active != 0 || open != 0 || encumbered != 0) revert OutstandingRights(active, open, encumbered);
        _setState(RobinhoodTypes.ProgramState.Closed);
        IPoolVault(vault).matureSponsorRefund();
    }

    function approveCancellationAsSponsor() external {
        if (msg.sender != sponsor) revert Unauthorized();
        _requireCancellable();
        sponsorCancellationApproved = true;
        emit CancellationApprovalRecorded(programId, msg.sender, true);
    }

    function approveCancellationAsOperator() external {
        if (msg.sender != operator) revert Unauthorized();
        _requireCancellable();
        operatorCancellationApproved = true;
        emit CancellationApprovalRecorded(programId, msg.sender, false);
    }

    function cancelBeforePromises() external {
        _requireCancellable();
        if (!sponsorCancellationApproved || !operatorCancellationApproved) revert ActivationNotApproved();
        if (IMembershipRegistry(membershipRegistry).activeMemberships() != 0) {
            revert OutstandingRights(IMembershipRegistry(membershipRegistry).activeMemberships(), 0, 0);
        }
        _setState(RobinhoodTypes.ProgramState.Cancelled);
        IPoolVault(vault).matureSponsorRefund();
    }

    function isActionPaused(RobinhoodTypes.PauseScope scope) public view returns (bool) {
        if (safetyGuardian == address(0)) return false;
        return ISafetyGuardian(safetyGuardian).isPaused(scope);
    }

    function isTerminal() external view returns (bool) {
        return state == RobinhoodTypes.ProgramState.Closed || state == RobinhoodTypes.ProgramState.Cancelled;
    }

    function _requireNotPaused(RobinhoodTypes.PauseScope scope) private view {
        if (isActionPaused(scope)) revert ActionPaused(scope);
    }

    function _requireModulesBound() private view {
        if (vault == address(0)) revert ModulesNotBound();
    }

    function _requireCancellable() private view {
        if (
            state != RobinhoodTypes.ProgramState.Draft && state != RobinhoodTypes.ProgramState.Reviewed
                && state != RobinhoodTypes.ProgramState.Funded
        ) revert InvalidState(RobinhoodTypes.ProgramState.Funded, state);
        _requireModulesBound();
    }

    function _transition(RobinhoodTypes.ProgramState expected, RobinhoodTypes.ProgramState next) private {
        if (state != expected) revert InvalidState(expected, state);
        _setState(next);
    }

    function _setState(RobinhoodTypes.ProgramState next) private {
        RobinhoodTypes.ProgramState previous = state;
        // Cancellation is a two-party approval of the current lifecycle state,
        // not a standing authorization that may be replayed after review or
        // funding changes the program materially.
        sponsorCancellationApproved = false;
        operatorCancellationApproved = false;
        state = next;
        emit ProgramStateChanged(programId, previous, next, msg.sender);
    }
}
