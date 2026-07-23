// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.28;

import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {SignatureChecker} from "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";

import {INakamaProgram} from "../interfaces/INakamaProgram.sol";
import {RobinhoodTypes} from "../types/RobinhoodTypes.sol";

/// @notice EIP-712/EIP-1271 verifier for exact human decisions. The module
/// verifies authority and replay protection; ClaimManager enforces workflow.
contract DecisionModule is EIP712 {
    bytes32 public constant DECISION_TYPEHASH = keccak256(
        "Decision(bytes32 programId,bytes32 requestId,bytes32 termsCommitment,bytes32 evidenceManifestCommitment,uint32 evidenceVersion,uint8 reviewRound,uint8 reviewerRole,uint8 action,uint256 approvedAmount,bytes32 recipientCommitment,bytes32 publicReasonCode,uint256 nonce,uint64 validUntil)"
    );

    error Unauthorized();
    error InvalidAddress();
    error InvalidDecision();
    error InvalidRole();
    error InvalidNonce(uint256 expected, uint256 provided);
    error SignatureExpired();
    error InvalidSignature();
    error ClaimManagerAlreadyBound();

    event ClaimManagerBound(address indexed claimManager);
    event DecisionConsumed(
        bytes32 indexed programId,
        bytes32 indexed requestId,
        address indexed signer,
        uint8 reviewRound,
        uint8 action,
        uint256 nonce,
        bytes32 decisionDigest
    );

    address public immutable deploymentFactory;
    address public immutable program;
    bytes32 public immutable programId;
    address public claimManager;
    mapping(address signer => uint256 nonce) public nonces;

    constructor(address deploymentFactory_, address program_) EIP712("Nakama Protection Decision", "1") {
        if (deploymentFactory_ == address(0) || program_ == address(0)) revert InvalidAddress();
        deploymentFactory = deploymentFactory_;
        program = program_;
        programId = INakamaProgram(program_).programId();
    }

    function bindClaimManager(address claimManager_) external {
        if (msg.sender != deploymentFactory) revert Unauthorized();
        if (claimManager != address(0)) revert ClaimManagerAlreadyBound();
        if (claimManager_ == address(0)) revert InvalidAddress();
        claimManager = claimManager_;
        emit ClaimManagerBound(claimManager_);
    }

    function consumeDecision(RobinhoodTypes.Decision calldata decision, bytes calldata signature)
        external
        returns (address signer)
    {
        if (msg.sender != claimManager) revert Unauthorized();
        signer = _expectedSigner(decision);
        uint256 expectedNonce = nonces[signer];
        if (decision.nonce != expectedNonce) revert InvalidNonce(expectedNonce, decision.nonce);
        if (block.timestamp > decision.validUntil) revert SignatureExpired();
        bytes32 digest = _decisionDigest(decision);
        if (!SignatureChecker.isValidSignatureNow(signer, digest, signature)) revert InvalidSignature();
        nonces[signer] = expectedNonce + 1;
        emit DecisionConsumed(
            programId,
            decision.requestId,
            signer,
            decision.reviewRound,
            decision.action,
            decision.nonce,
            digest
        );
    }

    function verifyDecision(RobinhoodTypes.Decision calldata decision, bytes calldata signature)
        external
        view
        returns (bool)
    {
        address signer = _expectedSigner(decision);
        return decision.nonce == nonces[signer] && block.timestamp <= decision.validUntil
            && SignatureChecker.isValidSignatureNow(signer, _decisionDigest(decision), signature);
    }

    function hashDecision(RobinhoodTypes.Decision calldata decision) external view returns (bytes32) {
        return _decisionDigest(decision);
    }

    function _expectedSigner(RobinhoodTypes.Decision calldata decision) private view returns (address signer) {
        INakamaProgram program_ = INakamaProgram(program);
        if (
            decision.programId != programId || decision.requestId == bytes32(0)
                || decision.termsCommitment != program_.termsCommitment()
                || decision.evidenceManifestCommitment == bytes32(0) || decision.evidenceVersion == 0
                || decision.publicReasonCode == bytes32(0) || decision.validUntil == 0
        ) revert InvalidDecision();
        if (
            decision.action < uint8(RobinhoodTypes.DecisionAction.RequestInformation)
                || decision.action > uint8(RobinhoodTypes.DecisionAction.Deny)
        ) revert InvalidDecision();
        if (decision.action == uint8(RobinhoodTypes.DecisionAction.Approve)) {
            if (decision.approvedAmount == 0 || decision.recipientCommitment == bytes32(0)) revert InvalidDecision();
        } else if (decision.approvedAmount != 0 || decision.recipientCommitment != bytes32(0)) {
            revert InvalidDecision();
        }

        if (
            decision.reviewRound == uint8(RobinhoodTypes.ReviewRound.Initial)
                && decision.reviewerRole == uint8(RobinhoodTypes.ReviewerRole.InitialReviewer)
        ) {
            signer = program_.initialReviewer();
        } else if (
            decision.reviewRound == uint8(RobinhoodTypes.ReviewRound.Appeal)
                && decision.reviewerRole == uint8(RobinhoodTypes.ReviewerRole.AppealReviewer)
        ) {
            signer = program_.appealReviewer();
        } else {
            revert InvalidRole();
        }
    }

    function _decisionDigest(RobinhoodTypes.Decision calldata decision) private view returns (bytes32) {
        return _hashTypedDataV4(
            keccak256(
                abi.encode(
                    DECISION_TYPEHASH,
                    decision.programId,
                    decision.requestId,
                    decision.termsCommitment,
                    decision.evidenceManifestCommitment,
                    decision.evidenceVersion,
                    decision.reviewRound,
                    decision.reviewerRole,
                    decision.action,
                    decision.approvedAmount,
                    decision.recipientCommitment,
                    decision.publicReasonCode,
                    decision.nonce,
                    decision.validUntil
                )
            )
        );
    }
}
