// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.28;

import {INakamaProgram} from "../interfaces/INakamaProgram.sol";
import {RobinhoodTypes} from "../types/RobinhoodTypes.sol";

/// @notice Expiring policy and consumption records for reviewed agent adapters.
/// This contract has no arbitrary-call executor, authenticates no principal,
/// observes no target side effect, and grants no custody permission. A target
/// adapter reports the principal and value fields when it consumes a grant, so
/// only adapters that authenticate the principal and honestly report or avoid
/// value are safe integrations. Phase 0 grants must be non-economic.
contract AgentAuthorizationRegistry {
    uint64 public constant MAX_AUTHORIZATION_DURATION = 30 days;
    uint64 public constant MAX_PERIOD = 7 days;
    uint32 public constant MAX_CALLS_PER_PERIOD = 1_000;

    struct Consumption {
        uint64 periodStartedAt;
        uint32 callsInPeriod;
        uint256 assetAmountInPeriod;
    }

    error Unauthorized();
    error InvalidAddress();
    error InvalidAuthorization();
    error AuthorizationAlreadyExists(bytes32 authorizationId);
    error AuthorizationNotActive(bytes32 authorizationId);
    error AuthorizationLimitExceeded(bytes32 authorizationId);
    error SafetyGuardianAlreadyBound();
    error AgentActionsPaused();

    event SafetyGuardianBound(address indexed safetyGuardian);
    event AuthorizationGranted(
        bytes32 indexed programId,
        bytes32 indexed authorizationId,
        address indexed principal,
        address target,
        bytes4 selector,
        uint64 expiresAt,
        uint32 maxCallsPerPeriod,
        bytes32 purposeCommitment
    );
    event AuthorizationConsumed(
        bytes32 indexed programId,
        bytes32 indexed authorizationId,
        address indexed principal,
        address target,
        bytes4 selector,
        uint32 callsInPeriod,
        uint256 assetAmountInPeriod
    );
    event AuthorizationRevoked(
        bytes32 indexed programId,
        bytes32 indexed authorizationId,
        address indexed actor,
        bytes32 incidentId
    );
    event AuthorizationBlocked(
        bytes32 indexed programId,
        bytes32 indexed authorizationId,
        address indexed principal,
        address target,
        bytes4 selector,
        bytes32 reasonCode
    );

    address public immutable deploymentFactory;
    address public immutable program;
    address public immutable vault;
    address public immutable decisionModule;
    address public immutable settlementModule;
    bytes32 public immutable programId;
    address public safetyGuardian;

    mapping(address principal => uint256 nonce) public nonces;
    mapping(bytes32 authorizationId => RobinhoodTypes.Authorization authorization) private _authorizations;
    mapping(bytes32 authorizationId => Consumption consumption) private _consumptions;
    mapping(bytes32 authorizationId => bool revoked) public revoked;

    constructor(
        address deploymentFactory_,
        address program_,
        address vault_,
        address decisionModule_,
        address settlementModule_
    ) {
        if (
            deploymentFactory_ == address(0) || program_ == address(0) || vault_ == address(0)
                || decisionModule_ == address(0) || settlementModule_ == address(0)
        ) revert InvalidAddress();
        deploymentFactory = deploymentFactory_;
        program = program_;
        vault = vault_;
        decisionModule = decisionModule_;
        settlementModule = settlementModule_;
        programId = INakamaProgram(program_).programId();
    }

    function bindSafetyGuardian(address safetyGuardian_) external {
        if (msg.sender != deploymentFactory) revert Unauthorized();
        if (safetyGuardian != address(0)) revert SafetyGuardianAlreadyBound();
        if (safetyGuardian_ == address(0)) revert InvalidAddress();
        safetyGuardian = safetyGuardian_;
        emit SafetyGuardianBound(safetyGuardian_);
    }

    function deriveAuthorizationId(address principal, address target, bytes4 selector, uint256 nonce)
        public
        view
        returns (bytes32)
    {
        return keccak256(abi.encode(programId, principal, target, selector, nonce));
    }

    function grantAuthorization(RobinhoodTypes.Authorization calldata authorization)
        external
        returns (bytes32 authorizationId)
    {
        INakamaProgram program_ = INakamaProgram(program);
        if (msg.sender != program_.operator()) revert Unauthorized();
        if (program_.isActionPaused(RobinhoodTypes.PauseScope.AgentActions)) revert AgentActionsPaused();
        _validateGrant(authorization);
        uint256 expectedNonce = nonces[authorization.principal];
        if (authorization.nonce != expectedNonce) revert InvalidAuthorization();
        authorizationId = deriveAuthorizationId(
            authorization.principal, authorization.target, authorization.selector, authorization.nonce
        );
        if (_authorizations[authorizationId].principal != address(0)) revert AuthorizationAlreadyExists(authorizationId);
        nonces[authorization.principal] = expectedNonce + 1;
        _authorizations[authorizationId] = authorization;
        emit AuthorizationGranted(
            programId,
            authorizationId,
            authorization.principal,
            authorization.target,
            authorization.selector,
            authorization.expiresAt,
            authorization.maxCallsPerPeriod,
            authorization.purposeCommitment
        );
    }

    function consumeAuthorization(
        bytes32 authorizationId,
        address principal,
        bytes4 selector,
        uint256 nativeValue,
        uint256 assetAmount
    ) external {
        // `msg.sender` is the bound adapter, but principal and value are
        // caller-reported. This ledger deliberately cannot prove what the
        // adapter did before or after consumption.
        RobinhoodTypes.Authorization storage authorization = _authorizations[authorizationId];
        if (
            authorization.principal != principal || authorization.target != msg.sender
                || authorization.selector != selector || !isAuthorized(authorizationId, principal, msg.sender, selector)
        ) {
            emit AuthorizationBlocked(
                programId, authorizationId, principal, msg.sender, selector, keccak256("AUTHORIZATION_NOT_ACTIVE")
            );
            revert AuthorizationNotActive(authorizationId);
        }
        if (nativeValue > authorization.maxNativeValue || assetAmount > authorization.maxAssetAmountPerAction) {
            emit AuthorizationBlocked(
                programId, authorizationId, principal, msg.sender, selector, keccak256("ACTION_LIMIT_EXCEEDED")
            );
            revert AuthorizationLimitExceeded(authorizationId);
        }

        Consumption storage consumption = _consumptions[authorizationId];
        if (
            consumption.periodStartedAt == 0
                || block.timestamp >= uint256(consumption.periodStartedAt) + authorization.periodSeconds
        ) {
            consumption.periodStartedAt = uint64(block.timestamp);
            consumption.callsInPeriod = 0;
            consumption.assetAmountInPeriod = 0;
        }
        uint32 nextCalls = consumption.callsInPeriod + 1;
        uint256 nextAssetAmount = consumption.assetAmountInPeriod + assetAmount;
        if (
            nextCalls > authorization.maxCallsPerPeriod || nextAssetAmount > authorization.periodAssetLimit
        ) revert AuthorizationLimitExceeded(authorizationId);
        consumption.callsInPeriod = nextCalls;
        consumption.assetAmountInPeriod = nextAssetAmount;
        emit AuthorizationConsumed(
            programId,
            authorizationId,
            principal,
            msg.sender,
            selector,
            nextCalls,
            nextAssetAmount
        );
    }

    function revokeAuthorization(bytes32 authorizationId, bytes32 reasonCode) external {
        if (msg.sender != INakamaProgram(program).operator()) revert Unauthorized();
        if (_authorizations[authorizationId].principal == address(0) || reasonCode == bytes32(0)) {
            revert InvalidAuthorization();
        }
        revoked[authorizationId] = true;
        emit AuthorizationRevoked(programId, authorizationId, msg.sender, reasonCode);
    }

    function guardianRevoke(bytes32 authorizationId, bytes32 incidentId) external {
        if (msg.sender != safetyGuardian) revert Unauthorized();
        if (_authorizations[authorizationId].principal == address(0) || incidentId == bytes32(0)) {
            revert InvalidAuthorization();
        }
        revoked[authorizationId] = true;
        emit AuthorizationRevoked(programId, authorizationId, msg.sender, incidentId);
    }

    function isAuthorized(bytes32 authorizationId, address principal, address target, bytes4 selector)
        public
        view
        returns (bool)
    {
        RobinhoodTypes.Authorization storage authorization = _authorizations[authorizationId];
        return !revoked[authorizationId] && authorization.principal == principal && authorization.target == target
            && authorization.selector == selector && block.timestamp >= authorization.issuedAt
            && block.timestamp <= authorization.expiresAt
            && !INakamaProgram(program).isActionPaused(RobinhoodTypes.PauseScope.AgentActions);
    }

    function getAuthorization(bytes32 authorizationId)
        external
        view
        returns (RobinhoodTypes.Authorization memory, Consumption memory, bool)
    {
        return (_authorizations[authorizationId], _consumptions[authorizationId], revoked[authorizationId]);
    }

    function _validateGrant(RobinhoodTypes.Authorization calldata authorization) private view {
        if (
            authorization.principal == address(0) || authorization.target == address(0)
                || authorization.target.code.length == 0 || authorization.selector == bytes4(0)
                || authorization.selector == bytes4(type(uint32).max) || authorization.purposeCommitment == bytes32(0)
        ) revert InvalidAuthorization();
        if (_isForbiddenTarget(authorization.target)) revert InvalidAuthorization();
        if (
            authorization.maxNativeValue != 0 || authorization.asset != address(0)
                || authorization.maxAssetAmountPerAction != 0 || authorization.periodAssetLimit != 0
        ) revert InvalidAuthorization();
        if (
            authorization.issuedAt > block.timestamp || authorization.expiresAt <= block.timestamp
                || authorization.expiresAt - authorization.issuedAt > MAX_AUTHORIZATION_DURATION
                || authorization.periodSeconds == 0 || authorization.periodSeconds > MAX_PERIOD
                || authorization.maxCallsPerPeriod == 0
                || authorization.maxCallsPerPeriod > MAX_CALLS_PER_PERIOD
        ) revert InvalidAuthorization();
    }

    function _isForbiddenTarget(address target) private view returns (bool) {
        INakamaProgram program_ = INakamaProgram(program);
        return target == deploymentFactory || target == address(this) || target == program || target == vault
            || target == program_.vault() || target == program_.membershipRegistry()
            || target == decisionModule || target == program_.decisionModule()
            || target == program_.claimManager() || target == settlementModule
            || target == program_.settlementModule() || target == program_.agentAuthorizationRegistry()
            || target == safetyGuardian || target == program_.safetyGuardian()
            || target == program_.fundingAsset() || target == program_.sponsor()
            || target == program_.operator() || target == program_.initialReviewer()
            || target == program_.appealReviewer() || target == program_.settlementRole()
            || target == program_.guardianRole() || target == program_.eligibilityAttestor();
    }
}
