// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.28;

import {RobinhoodTypes} from "../types/RobinhoodTypes.sol";

interface INakamaProgram {
    function programId() external view returns (bytes32);
    function termsCommitment() external view returns (bytes32);
    function privacyCommitment() external view returns (bytes32);
    function fundingAsset() external view returns (address);
    function sponsor() external view returns (address);
    function operator() external view returns (address);
    function initialReviewer() external view returns (address);
    function appealReviewer() external view returns (address);
    function settlementRole() external view returns (address);
    function guardianRole() external view returns (address);
    function eligibilityAttestor() external view returns (address);
    function vault() external view returns (address);
    function membershipRegistry() external view returns (address);
    function decisionModule() external view returns (address);
    function claimManager() external view returns (address);
    function settlementModule() external view returns (address);
    function agentAuthorizationRegistry() external view returns (address);
    function safetyGuardian() external view returns (address);
    function perMemberCap() external view returns (uint256);
    function aggregateCap() external view returns (uint256);
    function maxMembers() external view returns (uint32);
    function activeAt() external view returns (uint64);
    function runoffAt() external view returns (uint64);
    function initialDecisionWindow() external view returns (uint64);
    function appealDecisionWindow() external view returns (uint64);
    function appealWindow() external view returns (uint64);
    function state() external view returns (RobinhoodTypes.ProgramState);
    function isActionPaused(RobinhoodTypes.PauseScope scope) external view returns (bool);
}
