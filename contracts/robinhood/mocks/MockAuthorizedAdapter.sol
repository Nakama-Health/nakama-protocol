// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.28;

interface IAuthorizationConsumptionRegistry {
    function consumeAuthorization(
        bytes32 authorizationId,
        address principal,
        bytes4 selector,
        uint256 nativeValue,
        uint256 assetAmount
    ) external;

    function recordBlockedAttempt(
        bytes32 authorizationId,
        address principal,
        bytes4 selector,
        uint256 nativeValue,
        uint256 assetAmount
    ) external returns (bytes32 reasonCode);
}

/// @notice Test-only example of the minimum adapter boundary: authenticate the
/// principal from msg.sender, bind the intended selector, and report no value.
contract MockAuthorizedAdapter {
    event Performed(bytes32 indexed authorizationId, address indexed principal);

    function perform(address registry, bytes32 authorizationId) external {
        IAuthorizationConsumptionRegistry(registry).consumeAuthorization(
            authorizationId, msg.sender, this.perform.selector, 0, 0
        );
        emit Performed(authorizationId, msg.sender);
    }

    function recordBlocked(address registry, bytes32 authorizationId, address principal)
        external
        returns (bytes32 reasonCode)
    {
        return IAuthorizationConsumptionRegistry(registry).recordBlockedAttempt(
            authorizationId, principal, this.perform.selector, 0, 0
        );
    }
}
