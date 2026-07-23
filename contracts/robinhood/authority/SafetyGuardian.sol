// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.28;

import {IAgentAuthorizationRegistry} from "../interfaces/IAgentAuthorizationRegistry.sol";
import {INakamaProgram} from "../interfaces/INakamaProgram.sol";
import {RobinhoodTypes} from "../types/RobinhoodTypes.sol";

/// @notice Scoped, review-expiring incident containment. Expiry does not
/// silently resume operations; operator and guardian must explicitly unpause.
contract SafetyGuardian {
    uint64 public constant MAX_PAUSE_DURATION = 7 days;

    struct PauseRecord {
        bytes32 incidentId;
        bytes32 reasonCode;
        uint64 openedAt;
        uint64 reviewRequiredAt;
        bool active;
        bool operatorUnpauseApproved;
    }

    error Unauthorized();
    error InvalidAddress();
    error InvalidPause();
    error PauseAlreadyActive(RobinhoodTypes.PauseScope scope);
    error PauseNotActive(RobinhoodTypes.PauseScope scope);
    error IncidentMismatch(bytes32 expected, bytes32 actual);
    error UnpauseNotApproved();

    event ScopePaused(
        bytes32 indexed programId,
        RobinhoodTypes.PauseScope indexed scope,
        bytes32 indexed incidentId,
        bytes32 reasonCode,
        uint64 reviewRequiredAt
    );
    event OperatorUnpauseApproved(
        bytes32 indexed programId, RobinhoodTypes.PauseScope indexed scope, bytes32 indexed incidentId
    );
    event ScopeUnpaused(
        bytes32 indexed programId,
        RobinhoodTypes.PauseScope indexed scope,
        bytes32 indexed incidentId,
        address actor
    );
    event DependencyWarningChanged(
        bytes32 indexed programId,
        bytes32 indexed dependencyId,
        bool active,
        bytes32 reasonCode,
        bytes32 incidentId
    );
    event AgentAuthorizationEmergencyRevoked(
        bytes32 indexed programId, bytes32 indexed authorizationId, bytes32 indexed incidentId
    );

    address public immutable program;
    address public immutable agentAuthorizationRegistry;
    bytes32 public immutable programId;

    mapping(RobinhoodTypes.PauseScope scope => PauseRecord record) private _pauses;
    mapping(bytes32 dependencyId => bool active) public dependencyWarning;

    constructor(address program_, address agentAuthorizationRegistry_) {
        if (program_ == address(0) || agentAuthorizationRegistry_ == address(0)) revert InvalidAddress();
        program = program_;
        agentAuthorizationRegistry = agentAuthorizationRegistry_;
        programId = INakamaProgram(program_).programId();
    }

    modifier onlyGuardian() {
        if (msg.sender != INakamaProgram(program).guardianRole()) revert Unauthorized();
        _;
    }

    function pause(
        RobinhoodTypes.PauseScope scope,
        bytes32 incidentId,
        bytes32 reasonCode,
        uint64 reviewRequiredAt
    ) external onlyGuardian {
        if (
            scope == RobinhoodTypes.PauseScope.None || incidentId == bytes32(0) || reasonCode == bytes32(0)
                || reviewRequiredAt <= block.timestamp || reviewRequiredAt > block.timestamp + MAX_PAUSE_DURATION
        ) revert InvalidPause();
        if (_pauses[scope].active) revert PauseAlreadyActive(scope);
        _pauses[scope] = PauseRecord({
            incidentId: incidentId,
            reasonCode: reasonCode,
            openedAt: uint64(block.timestamp),
            reviewRequiredAt: reviewRequiredAt,
            active: true,
            operatorUnpauseApproved: false
        });
        emit ScopePaused(programId, scope, incidentId, reasonCode, reviewRequiredAt);
    }

    function approveUnpauseAsOperator(RobinhoodTypes.PauseScope scope, bytes32 incidentId) external {
        if (msg.sender != INakamaProgram(program).operator()) revert Unauthorized();
        PauseRecord storage record = _pauses[scope];
        if (!record.active) revert PauseNotActive(scope);
        if (record.incidentId != incidentId) revert IncidentMismatch(record.incidentId, incidentId);
        record.operatorUnpauseApproved = true;
        emit OperatorUnpauseApproved(programId, scope, incidentId);
    }

    function unpause(RobinhoodTypes.PauseScope scope, bytes32 incidentId) external onlyGuardian {
        PauseRecord storage record = _pauses[scope];
        if (!record.active) revert PauseNotActive(scope);
        if (record.incidentId != incidentId) revert IncidentMismatch(record.incidentId, incidentId);
        if (!record.operatorUnpauseApproved) revert UnpauseNotApproved();
        record.active = false;
        emit ScopeUnpaused(programId, scope, incidentId, msg.sender);
    }

    function setDependencyWarning(bytes32 dependencyId, bool active, bytes32 reasonCode, bytes32 incidentId)
        external
        onlyGuardian
    {
        if (dependencyId == bytes32(0) || reasonCode == bytes32(0) || incidentId == bytes32(0)) {
            revert InvalidPause();
        }
        dependencyWarning[dependencyId] = active;
        emit DependencyWarningChanged(programId, dependencyId, active, reasonCode, incidentId);
    }

    function revokeAgentAuthorization(bytes32 authorizationId, bytes32 incidentId) external onlyGuardian {
        if (authorizationId == bytes32(0) || incidentId == bytes32(0)) revert InvalidPause();
        IAgentAuthorizationRegistry(agentAuthorizationRegistry).guardianRevoke(authorizationId, incidentId);
        emit AgentAuthorizationEmergencyRevoked(programId, authorizationId, incidentId);
    }

    function isPaused(RobinhoodTypes.PauseScope scope) external view returns (bool) {
        return _pauses[scope].active;
    }

    function pauseRecord(RobinhoodTypes.PauseScope scope) external view returns (PauseRecord memory) {
        return _pauses[scope];
    }

    function reviewRequired(RobinhoodTypes.PauseScope scope) external view returns (bool) {
        PauseRecord storage record = _pauses[scope];
        return record.active && block.timestamp >= record.reviewRequiredAt;
    }
}
