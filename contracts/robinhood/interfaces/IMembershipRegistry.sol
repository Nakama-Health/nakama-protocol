// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.28;

interface IMembershipRegistry {
    function isActiveMembership(bytes32 membershipId) external view returns (bool);
    function isMembershipAccount(bytes32 membershipId, address account) external view returns (bool);
    function activeMemberships() external view returns (uint32);
}
