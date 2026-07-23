// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.28;

import {RobinhoodTypes} from "../types/RobinhoodTypes.sol";

interface IClaimManager {
    function canReleaseMembership(bytes32 membershipId) external view returns (bool);
    function settlementDetails(bytes32 requestId)
        external
        view
        returns (RobinhoodTypes.RequestState requestState, address recipient, uint256 amount);
    function markSettled(bytes32 requestId) external;
    function openRequestCount() external view returns (uint256);
}
