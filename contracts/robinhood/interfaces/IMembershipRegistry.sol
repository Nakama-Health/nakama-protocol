// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.28;

import {RobinhoodTypes} from "../types/RobinhoodTypes.sol";

interface IMembershipRegistry {
    function revokeEligibilityAuthorization(
        RobinhoodTypes.Eligibility calldata eligibility,
        RobinhoodTypes.EligibilityRevocation calldata revocation,
        bytes calldata signature
    )
        external
        returns (bytes32 authorizationDigest, bool changed);
    function eligibilityAuthorizationRevoked(bytes32 authorizationDigest) external view returns (bool);
    function hashEligibility(RobinhoodTypes.Eligibility calldata eligibility) external view returns (bytes32);
    function hashEligibilityRevocation(RobinhoodTypes.EligibilityRevocation calldata revocation)
        external
        view
        returns (bytes32);
    function isActiveMembership(bytes32 membershipId) external view returns (bool);
    function isMembershipAccount(bytes32 membershipId, address account) external view returns (bool);
    function activeMemberships() external view returns (uint32);
}
