// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.28;

import {RobinhoodTypes} from "../types/RobinhoodTypes.sol";

/// @notice Immutable suite-version admission for future program deployments.
/// The authority is expected to be an institution-controlled threshold account.
contract TemplateRegistry {
    struct SuiteRecord {
        address factory;
        bytes32 deploymentCodeCommitment;
        bytes32 templateCommitment;
        bytes32 reviewCommitment;
        uint64 registeredAt;
        uint32 major;
        uint32 minor;
        uint32 patch;
        RobinhoodTypes.TemplateStatus status;
    }

    error Unauthorized();
    error InvalidAddress();
    error InvalidCommitment();
    error AlreadyRegistered(bytes32 suiteId);
    error UnknownSuite(bytes32 suiteId);
    error SuiteNotActive(bytes32 suiteId, RobinhoodTypes.TemplateStatus status);
    error FactoryMismatch(address expected, address actual);

    event SuiteRegistered(
        bytes32 indexed suiteId,
        address indexed factory,
        uint32 major,
        uint32 minor,
        uint32 patch,
        bytes32 deploymentCodeCommitment,
        bytes32 templateCommitment,
        bytes32 reviewCommitment
    );
    event SuiteStatusChanged(
        bytes32 indexed suiteId, RobinhoodTypes.TemplateStatus previous, RobinhoodTypes.TemplateStatus next
    );
    event AuthorityTransferStarted(address indexed currentAuthority, address indexed pendingAuthority);
    event AuthorityTransferred(address indexed previousAuthority, address indexed newAuthority);

    address public authority;
    address public pendingAuthority;
    mapping(bytes32 suiteId => SuiteRecord record) private _suites;

    constructor(address authority_) {
        if (authority_ == address(0)) revert InvalidAddress();
        authority = authority_;
    }

    modifier onlyAuthority() {
        if (msg.sender != authority) revert Unauthorized();
        _;
    }

    function registerSuite(
        bytes32 suiteId,
        address factory,
        uint32 major,
        uint32 minor,
        uint32 patch,
        bytes32 deploymentCodeCommitment,
        bytes32 templateCommitment,
        bytes32 reviewCommitment
    ) external onlyAuthority {
        if (
            suiteId == bytes32(0) || deploymentCodeCommitment == bytes32(0) || templateCommitment == bytes32(0)
                || reviewCommitment == bytes32(0)
        ) {
            revert InvalidCommitment();
        }
        if (factory == address(0) || factory.code.length == 0) revert InvalidAddress();
        if (_suites[suiteId].status != RobinhoodTypes.TemplateStatus.Unregistered) revert AlreadyRegistered(suiteId);
        _suites[suiteId] = SuiteRecord({
            factory: factory,
            deploymentCodeCommitment: deploymentCodeCommitment,
            templateCommitment: templateCommitment,
            reviewCommitment: reviewCommitment,
            registeredAt: uint64(block.timestamp),
            major: major,
            minor: minor,
            patch: patch,
            status: RobinhoodTypes.TemplateStatus.Active
        });
        emit SuiteRegistered(
            suiteId,
            factory,
            major,
            minor,
            patch,
            deploymentCodeCommitment,
            templateCommitment,
            reviewCommitment
        );
    }

    function setSuiteStatus(bytes32 suiteId, RobinhoodTypes.TemplateStatus next) external onlyAuthority {
        SuiteRecord storage record = _suites[suiteId];
        RobinhoodTypes.TemplateStatus previous = record.status;
        if (previous == RobinhoodTypes.TemplateStatus.Unregistered) revert UnknownSuite(suiteId);
        if (next == RobinhoodTypes.TemplateStatus.Unregistered || next == previous) revert InvalidCommitment();
        record.status = next;
        emit SuiteStatusChanged(suiteId, previous, next);
    }

    function requireActiveSuite(bytes32 suiteId, address factory) external view returns (SuiteRecord memory record) {
        record = _suites[suiteId];
        if (record.status != RobinhoodTypes.TemplateStatus.Active) revert SuiteNotActive(suiteId, record.status);
        if (record.factory != factory) revert FactoryMismatch(record.factory, factory);
    }

    function getSuite(bytes32 suiteId) external view returns (SuiteRecord memory) {
        return _suites[suiteId];
    }

    function beginAuthorityTransfer(address nextAuthority) external onlyAuthority {
        if (nextAuthority == address(0) || nextAuthority == authority) revert InvalidAddress();
        pendingAuthority = nextAuthority;
        emit AuthorityTransferStarted(authority, nextAuthority);
    }

    function acceptAuthority() external {
        if (msg.sender != pendingAuthority) revert Unauthorized();
        address previous = authority;
        authority = msg.sender;
        pendingAuthority = address(0);
        emit AuthorityTransferred(previous, msg.sender);
    }
}
