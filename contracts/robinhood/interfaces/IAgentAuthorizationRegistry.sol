// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.28;

interface IAgentAuthorizationRegistry {
    function guardianRevoke(bytes32 authorizationId, bytes32 incidentId) external;

    function recordBlockedAttempt(
        bytes32 authorizationId,
        address principal,
        bytes4 selector,
        uint256 nativeValue,
        uint256 assetAmount
    ) external returns (bytes32 reasonCode);
}
