// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.28;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import {IClaimManager} from "../interfaces/IClaimManager.sol";
import {INakamaProgram} from "../interfaces/INakamaProgram.sol";
import {IPoolVault} from "../interfaces/IPoolVault.sol";
import {RobinhoodTypes} from "../types/RobinhoodTypes.sol";

/// @notice Exact-once execution of an already approved obligation.
contract SettlementModule is ReentrancyGuard {
    error Unauthorized();
    error InvalidAddress();
    error InvalidState();
    error SettlementPaused();
    error AmountMismatch(uint256 expected, uint256 actual);

    event SettlementExecuted(
        bytes32 indexed programId,
        bytes32 indexed requestId,
        address indexed recipient,
        address asset,
        uint256 amount,
        address settlementActor
    );

    address public immutable program;
    address public immutable vault;
    address public immutable claimManager;
    bytes32 public immutable programId;

    constructor(address program_, address vault_, address claimManager_) {
        if (program_ == address(0) || vault_ == address(0) || claimManager_ == address(0)) revert InvalidAddress();
        program = program_;
        vault = vault_;
        claimManager = claimManager_;
        programId = INakamaProgram(program_).programId();
    }

    function settle(bytes32 requestId) external nonReentrant returns (uint256 amount) {
        INakamaProgram program_ = INakamaProgram(program);
        if (msg.sender != program_.settlementRole()) revert Unauthorized();
        if (program_.isActionPaused(RobinhoodTypes.PauseScope.Settlement)) revert SettlementPaused();
        RobinhoodTypes.ProgramState programState = program_.state();
        if (programState != RobinhoodTypes.ProgramState.Active && programState != RobinhoodTypes.ProgramState.Runoff) {
            revert InvalidState();
        }
        (RobinhoodTypes.RequestState requestState, address recipient, uint256 expectedAmount) =
            IClaimManager(claimManager).settlementDetails(requestId);
        if (requestState != RobinhoodTypes.RequestState.Approved || recipient == address(0) || expectedAmount == 0) {
            revert InvalidState();
        }
        amount = IPoolVault(vault).settleObligation(requestId, recipient);
        if (amount != expectedAmount) revert AmountMismatch(expectedAmount, amount);
        IClaimManager(claimManager).markSettled(requestId);
        emit SettlementExecuted(programId, requestId, recipient, program_.fundingAsset(), amount, msg.sender);
    }
}
