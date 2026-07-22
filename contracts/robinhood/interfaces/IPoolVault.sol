// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.28;

import {RobinhoodTypes} from "../types/RobinhoodTypes.sol";

interface IPoolVault {
    function actualAssets() external view returns (uint256);
    function trackedAssets() external view returns (uint256);
    function encumberedAssets() external view returns (uint256);
    function freeLiquidity() external view returns (uint256);
    function accounting() external view returns (RobinhoodTypes.VaultAccounting memory);
    function memberRemaining(bytes32 membershipId) external view returns (uint256);
    function pendingByMember(bytes32 membershipId) external view returns (uint256);
    function obligationAmount(bytes32 requestId) external view returns (uint256);
    function registerMemberLiability(bytes32 membershipId, uint256 amount) external;
    function releaseMemberLiability(bytes32 membershipId) external returns (uint256 released);
    function reservePendingRequest(bytes32 requestId, bytes32 membershipId, uint256 amount) external;
    function clearPendingRequest(bytes32 requestId) external;
    function approveObligation(bytes32 requestId, bytes32 membershipId, uint256 amount) external;
    function settleObligation(bytes32 requestId, address recipient) external returns (uint256 amount);
    function matureSponsorRefund() external returns (uint256 amount);
}
