// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.28;

import {RobinhoodTypes} from "../types/RobinhoodTypes.sol";

/// @notice Append-only discovery registry for immutable program suites.
contract PoolRegistry {
    error OnlyFactory();
    error AlreadyRegistered(bytes32 programId);
    error InvalidDeployment();

    event ProgramRegistered(
        bytes32 indexed programId,
        bytes32 indexed suiteId,
        address indexed sponsor,
        address program,
        address vault,
        address membershipRegistry,
        address decisionModule,
        address claimManager,
        address settlementModule,
        address agentAuthorizationRegistry,
        address safetyGuardian
    );

    address public immutable factory;
    bytes32[] private _programIds;
    mapping(bytes32 programId => RobinhoodTypes.ProgramDeployment deployment) private _deployments;
    mapping(bytes32 programId => bytes32 suiteId) public suiteOf;

    constructor() {
        factory = msg.sender;
    }

    function registerProgram(bytes32 suiteId, address sponsor, RobinhoodTypes.ProgramDeployment calldata deployment)
        external
    {
        if (msg.sender != factory) revert OnlyFactory();
        if (_deployments[deployment.programId].program != address(0)) revert AlreadyRegistered(deployment.programId);
        if (
            suiteId == bytes32(0) || sponsor == address(0) || deployment.programId == bytes32(0)
                || deployment.program == address(0) || deployment.vault == address(0)
                || deployment.membershipRegistry == address(0) || deployment.decisionModule == address(0)
                || deployment.claimManager == address(0) || deployment.settlementModule == address(0)
                || deployment.agentAuthorizationRegistry == address(0) || deployment.safetyGuardian == address(0)
        ) revert InvalidDeployment();
        _deployments[deployment.programId] = deployment;
        suiteOf[deployment.programId] = suiteId;
        _programIds.push(deployment.programId);
        emit ProgramRegistered(
            deployment.programId,
            suiteId,
            sponsor,
            deployment.program,
            deployment.vault,
            deployment.membershipRegistry,
            deployment.decisionModule,
            deployment.claimManager,
            deployment.settlementModule,
            deployment.agentAuthorizationRegistry,
            deployment.safetyGuardian
        );
    }

    function getDeployment(bytes32 programId) external view returns (RobinhoodTypes.ProgramDeployment memory) {
        return _deployments[programId];
    }

    function programCount() external view returns (uint256) {
        return _programIds.length;
    }

    function programIds(uint256 offset, uint256 limit) external view returns (bytes32[] memory page) {
        uint256 length = _programIds.length;
        if (offset >= length || limit == 0) return new bytes32[](0);
        uint256 end = offset + limit;
        if (end > length) end = length;
        page = new bytes32[](end - offset);
        for (uint256 i = offset; i < end; ++i) page[i - offset] = _programIds[i];
    }
}
