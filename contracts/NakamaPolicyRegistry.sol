// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.28;

import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {MerkleProof} from "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import {SignatureChecker} from "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";

import {ProtocolTypes} from "./libraries/ProtocolTypes.sol";

/// @title Nakama immutable policy and claim registry
/// @notice Stores immutable policy terms, holder positions, claim votes, and
/// recipient authorizations. Every mutation enters through its paired core;
/// the registry never calls back into the core.
contract NakamaPolicyRegistry is EIP712 {
    bytes32 public constant CLAIM_RECIPIENT_TYPEHASH =
        keccak256("ClaimRecipient(bytes32 claimId,address recipient,uint256 nonce,uint256 deadline)");

    bytes32 private constant POSITION_ID_NAMESPACE = keccak256("NAKAMA_POLICY_POSITION_V1");
    bytes32 private constant CLAIM_ID_NAMESPACE = keccak256("NAKAMA_POSITION_CLAIM_V1");
    bytes32 private constant CLAIM_OBLIGATION_NAMESPACE = keccak256("NAKAMA_CLAIM_OBLIGATION_V1");
    bytes32 private constant NO_QUORUM_DECISION = keccak256("NAKAMA_NO_QUORUM_TIMEOUT_V1");

    error OnlyCore();
    error AlreadyExists(bytes32 id);
    error DoesNotExist(bytes32 id);
    error Unauthorized();
    error InvalidAddress();
    error InvalidAmount();
    error InvalidCommitment();
    error InvalidState();
    error InvalidBinding();
    error InvalidEligibilityProof();
    error ExposureCapExceeded(uint256 cap, uint256 nextExposure);
    error AlreadyAttested();
    error DecisionAlreadyReached();
    error DecisionWindowOpen(uint64 closesAt);
    error DecisionWindowClosed();
    error ChallengeWindowClosed();
    error ChallengeAlreadyUsed();
    error NullifierAlreadyUsed(bytes32 nullifier);
    error SignatureExpired();
    error InvalidSignature();

    event PolicySeriesCreated(
        bytes32 indexed planId,
        bytes32 indexed seriesId,
        address indexed assetToken,
        bytes32 termsCommitment
    );
    event PolicyPositionActivated(
        bytes32 indexed seriesId,
        bytes32 indexed positionId,
        address indexed holder,
        bytes32 coverageLineId,
        bytes32 premiumLineId,
        uint64 expiresAt,
        uint256 coverageLimit
    );
    event PolicyPositionExpired(
        bytes32 indexed seriesId,
        bytes32 indexed positionId,
        address indexed holder,
        uint256 releasedCoverage
    );
    event ClaimCaseStateChanged(
        bytes32 indexed claimId,
        ProtocolTypes.ClaimStatus status,
        uint256 approvedAmount,
        bytes32 decisionCommitment
    );
    event ClaimAttested(
        bytes32 indexed claimId,
        uint8 indexed round,
        address indexed attester,
        bytes32 voteKey,
        uint16 votes,
        uint16 threshold
    );
    event ClaimChallenged(bytes32 indexed claimId, bytes32 indexed counterCommitment, uint64 decisionDeadline);
    event ClaimRecipientAuthorized(
        bytes32 indexed claimId,
        address indexed claimant,
        address indexed recipient,
        uint256 nonce
    );

    struct ClaimFinalization {
        bytes32 lineId;
        bytes32 obligationId;
        address payoutRecipient;
        uint256 requestedAmount;
        uint256 approvedAmount;
        bytes32 decisionCommitment;
        bool approved;
    }

    address public immutable core;

    mapping(bytes32 seriesId => ProtocolTypes.PolicySeries) private _series;
    mapping(bytes32 positionId => ProtocolTypes.PolicyPosition) private _positions;
    mapping(bytes32 claimId => ProtocolTypes.ClaimCase) private _claims;

    mapping(bytes32 claimId => mapping(uint8 round => mapping(address attester => bool))) public hasAttested;
    mapping(bytes32 claimId => mapping(uint8 round => mapping(bytes32 voteKey => uint16))) public claimVoteCount;
    mapping(bytes32 positionId => mapping(address claimant => mapping(bytes32 nullifier => bool used)))
        public nullifierUsed;
    mapping(bytes32 lineId => bytes32 seriesId) public boundSeriesForLine;

    constructor(address core_) EIP712("Nakama Policy Registry", "1") {
        if (core_ == address(0)) revert InvalidAddress();
        core = core_;
    }

    modifier onlyCore() {
        if (msg.sender != core) revert OnlyCore();
        _;
    }

    function derivePositionId(bytes32 seriesId, address holder) public pure returns (bytes32) {
        return keccak256(abi.encode(POSITION_ID_NAMESPACE, seriesId, holder));
    }

    function deriveClaimId(bytes32 positionId, address claimant, bytes32 nullifier) public pure returns (bytes32) {
        return keccak256(abi.encode(CLAIM_ID_NAMESPACE, positionId, claimant, nullifier));
    }

    /// @notice Leaf format used by OpenZeppelin StandardMerkleTree for a
    /// single `address` value. A zero root makes the series permissionless.
    function eligibilityLeaf(address holder) public pure returns (bytes32) {
        return keccak256(bytes.concat(keccak256(abi.encode(holder))));
    }

    function registerPolicySeries(bytes32 seriesId, ProtocolTypes.PolicySeries calldata series_) external onlyCore {
        if (series_.assetToken == address(0)) revert InvalidAddress();
        if (
            seriesId == bytes32(0) || series_.planId == bytes32(0) || series_.coverageLineId == bytes32(0)
                || series_.premiumLineId == bytes32(0) || series_.premiumLineId == series_.coverageLineId
        ) revert InvalidBinding();
        if (
            series_.coverageDuration == 0 || series_.initialDecisionWindow == 0 || series_.challengeWindow == 0
                || series_.attesterThreshold == 0 || series_.coverageLimit == 0 || series_.premiumAmount == 0
                || series_.premiumAmount > series_.coverageLimit || series_.exposureCap < series_.coverageLimit
        ) revert InvalidAmount();
        if (series_.termsCommitment == bytes32(0) || series_.outstandingExposure != 0) {
            revert InvalidCommitment();
        }
        if (_series[seriesId].planId != bytes32(0)) revert AlreadyExists(seriesId);
        if (boundSeriesForLine[series_.coverageLineId] != bytes32(0)) {
            revert AlreadyExists(series_.coverageLineId);
        }
        if (boundSeriesForLine[series_.premiumLineId] != bytes32(0)) {
            revert AlreadyExists(series_.premiumLineId);
        }
        boundSeriesForLine[series_.coverageLineId] = seriesId;
        boundSeriesForLine[series_.premiumLineId] = seriesId;
        _series[seriesId] = series_;
        emit PolicySeriesCreated(series_.planId, seriesId, series_.assetToken, series_.termsCommitment);
    }

    function activatePolicyPosition(
        bytes32 seriesId,
        address holder,
        bytes32[] calldata eligibilityProof
    ) external onlyCore returns (bytes32 positionId) {
        ProtocolTypes.PolicySeries storage series_ = _requireSeries(seriesId);
        if (holder == address(0)) revert InvalidAddress();
        if (series_.eligibilityRoot == bytes32(0)) {
            if (eligibilityProof.length != 0) revert InvalidEligibilityProof();
        } else if (
            !MerkleProof.verifyCalldata(eligibilityProof, series_.eligibilityRoot, eligibilityLeaf(holder))
        ) revert InvalidEligibilityProof();

        positionId = derivePositionId(seriesId, holder);
        if (_positions[positionId].status != ProtocolTypes.PolicyPositionStatus.None) {
            revert AlreadyExists(positionId);
        }
        uint256 nextExposure = series_.outstandingExposure + series_.coverageLimit;
        if (nextExposure > series_.exposureCap) {
            revert ExposureCapExceeded(series_.exposureCap, nextExposure);
        }
        uint64 openedAt = uint64(block.timestamp);
        uint64 expiresAt = openedAt + series_.coverageDuration;
        _positions[positionId] = ProtocolTypes.PolicyPosition({
            seriesId: seriesId,
            coverageLineId: series_.coverageLineId,
            premiumLineId: series_.premiumLineId,
            holder: holder,
            openedAt: openedAt,
            expiresAt: expiresAt,
            remainingCoverage: series_.coverageLimit,
            activeClaimId: bytes32(0),
            status: ProtocolTypes.PolicyPositionStatus.Active
        });
        series_.outstandingExposure = nextExposure;
        emit PolicyPositionActivated(
            seriesId,
            positionId,
            holder,
            series_.coverageLineId,
            series_.premiumLineId,
            expiresAt,
            series_.coverageLimit
        );
    }

    function expirePolicyPosition(bytes32 positionId)
        external
        onlyCore
        returns (bytes32 coverageLineId, uint256 releasedCoverage)
    {
        ProtocolTypes.PolicyPosition storage position = _requirePosition(positionId);
        if (position.status != ProtocolTypes.PolicyPositionStatus.Active) revert InvalidState();
        if (block.timestamp < position.expiresAt) revert DecisionWindowOpen(position.expiresAt);
        if (position.activeClaimId != bytes32(0)) revert InvalidState();

        releasedCoverage = position.remainingCoverage;
        coverageLineId = position.coverageLineId;
        position.remainingCoverage = 0;
        position.status = ProtocolTypes.PolicyPositionStatus.Expired;
        ProtocolTypes.PolicySeries storage series_ = _series[position.seriesId];
        series_.outstandingExposure -= releasedCoverage;
        emit PolicyPositionExpired(position.seriesId, positionId, position.holder, releasedCoverage);
    }

    function openClaimCase(
        bytes32 positionId,
        address claimant,
        bytes32 claimCommitment,
        bytes32 nullifier,
        address payoutRecipient,
        uint256 requestedAmount
    ) external onlyCore returns (bytes32 claimId, bytes32 coverageLineId) {
        ProtocolTypes.PolicyPosition storage position = _requirePosition(positionId);
        if (position.status != ProtocolTypes.PolicyPositionStatus.Active || position.holder != claimant) {
            revert Unauthorized();
        }
        if (block.timestamp >= position.expiresAt || position.activeClaimId != bytes32(0)) revert InvalidState();
        if (claimCommitment == bytes32(0) || nullifier == bytes32(0) || claimCommitment == nullifier) {
            revert InvalidCommitment();
        }
        if (payoutRecipient == address(0)) revert InvalidAddress();
        if (requestedAmount == 0 || requestedAmount > position.remainingCoverage) revert InvalidAmount();

        ProtocolTypes.PolicySeries storage series_ = _series[position.seriesId];
        if (nullifierUsed[positionId][claimant][nullifier]) revert NullifierAlreadyUsed(nullifier);
        claimId = deriveClaimId(positionId, claimant, nullifier);
        if (_claims[claimId].status != ProtocolTypes.ClaimStatus.None) revert AlreadyExists(claimId);
        nullifierUsed[positionId][claimant][nullifier] = true;
        coverageLineId = position.coverageLineId;
        uint64 decisionDeadline = uint64(block.timestamp) + series_.initialDecisionWindow;
        _claims[claimId] = ProtocolTypes.ClaimCase({
            planId: series_.planId,
            seriesId: position.seriesId,
            positionId: positionId,
            lineId: coverageLineId,
            claimCommitment: claimCommitment,
            nullifier: nullifier,
            claimant: claimant,
            payoutRecipient: payoutRecipient,
            requestedAmount: requestedAmount,
            approvedAmount: 0,
            recipientNonce: 0,
            decisionDeadline: decisionDeadline,
            round: 0,
            fallbackApproved: false,
            roundOneDecisionReady: false,
            roundOneApproved: false,
            status: ProtocolTypes.ClaimStatus.Open,
            fallbackDecisionCommitment: bytes32(0),
            roundOneDecisionCommitment: bytes32(0),
            finalDecisionCommitment: bytes32(0),
            obligationId: bytes32(0)
        });
        position.activeClaimId = claimId;
        emit ClaimCaseStateChanged(claimId, ProtocolTypes.ClaimStatus.Open, 0, claimCommitment);
    }

    function claimRecipientDigest(bytes32 claimId, address recipient, uint256 nonce, uint256 deadline)
        public
        view
        returns (bytes32)
    {
        return _hashTypedDataV4(
            keccak256(abi.encode(CLAIM_RECIPIENT_TYPEHASH, claimId, recipient, nonce, deadline))
        );
    }

    function authorizeClaimRecipient(
        bytes32 claimId,
        address recipient,
        uint256 deadline,
        bytes calldata signature
    ) external onlyCore {
        if (recipient == address(0)) revert InvalidAddress();
        ProtocolTypes.ClaimCase storage claim = _requireClaim(claimId);
        if (block.timestamp > deadline) revert SignatureExpired();
        if (
            claim.status != ProtocolTypes.ClaimStatus.Open
                && claim.status != ProtocolTypes.ClaimStatus.Provisional
                && claim.status != ProtocolTypes.ClaimStatus.Challenged
                && claim.status != ProtocolTypes.ClaimStatus.FinalizedApproved
        ) revert InvalidState();
        uint256 nonce = claim.recipientNonce;
        bytes32 digest = claimRecipientDigest(claimId, recipient, nonce, deadline);
        if (!SignatureChecker.isValidSignatureNowCalldata(claim.claimant, digest, signature)) {
            revert InvalidSignature();
        }
        claim.recipientNonce = nonce + 1;
        claim.payoutRecipient = recipient;
        emit ClaimRecipientAuthorized(claimId, claim.claimant, recipient, nonce);
    }

    function attestClaim(
        bytes32 claimId,
        address attester,
        bool approve,
        uint256 approvedAmount,
        bytes32 decisionCommitment
    ) external onlyCore {
        ProtocolTypes.ClaimCase storage claim = _requireClaim(claimId);
        uint8 round = claim.round;
        if (round == 0) {
            if (claim.status != ProtocolTypes.ClaimStatus.Open) revert InvalidState();
            if (block.timestamp >= claim.decisionDeadline) revert DecisionWindowClosed();
        } else {
            if (claim.status != ProtocolTypes.ClaimStatus.Challenged) revert InvalidState();
            if (block.timestamp >= claim.decisionDeadline) revert ChallengeWindowClosed();
            if (claim.roundOneDecisionReady) revert DecisionAlreadyReached();
        }
        if (hasAttested[claimId][round][attester]) revert AlreadyAttested();
        if (decisionCommitment == bytes32(0)) revert InvalidCommitment();
        if (
            (approve && (approvedAmount == 0 || approvedAmount > claim.requestedAmount))
                || (!approve && approvedAmount != 0)
        ) revert InvalidAmount();

        hasAttested[claimId][round][attester] = true;
        bytes32 voteKey = keccak256(abi.encode(approve, approvedAmount, decisionCommitment));
        uint16 votes = ++claimVoteCount[claimId][round][voteKey];
        ProtocolTypes.PolicySeries storage series_ = _series[claim.seriesId];
        uint16 threshold = series_.attesterThreshold;
        emit ClaimAttested(claimId, round, attester, voteKey, votes, threshold);

        if (votes >= threshold) {
            if (round == 0) {
                claim.fallbackApproved = approve;
                claim.approvedAmount = approvedAmount;
                claim.fallbackDecisionCommitment = decisionCommitment;
                claim.decisionDeadline = uint64(block.timestamp) + series_.challengeWindow;
                claim.status = ProtocolTypes.ClaimStatus.Provisional;
                emit ClaimCaseStateChanged(claimId, claim.status, approvedAmount, decisionCommitment);
            } else {
                claim.roundOneDecisionReady = true;
                claim.roundOneApproved = approve;
                claim.approvedAmount = approvedAmount;
                claim.roundOneDecisionCommitment = decisionCommitment;
                emit ClaimCaseStateChanged(claimId, claim.status, approvedAmount, decisionCommitment);
            }
        }
    }

    function challengeClaim(bytes32 claimId, address actor, bytes32 counterCommitment) external onlyCore {
        ProtocolTypes.ClaimCase storage claim = _requireClaim(claimId);
        if (actor != claim.claimant) revert Unauthorized();
        if (claim.round != 0) revert ChallengeAlreadyUsed();
        if (claim.status != ProtocolTypes.ClaimStatus.Provisional) revert InvalidState();
        if (block.timestamp >= claim.decisionDeadline) revert ChallengeWindowClosed();
        if (counterCommitment == bytes32(0)) revert InvalidCommitment();
        claim.round = 1;
        claim.status = ProtocolTypes.ClaimStatus.Challenged;
        claim.decisionDeadline = uint64(block.timestamp) + _series[claim.seriesId].challengeWindow;
        emit ClaimChallenged(claimId, counterCommitment, claim.decisionDeadline);
        emit ClaimCaseStateChanged(claimId, claim.status, claim.approvedAmount, counterCommitment);
    }

    function finalizeClaimCase(bytes32 claimId)
        external
        onlyCore
        returns (ClaimFinalization memory result)
    {
        ProtocolTypes.ClaimCase storage claim = _requireClaim(claimId);
        if (
            claim.status != ProtocolTypes.ClaimStatus.Open
                && claim.status != ProtocolTypes.ClaimStatus.Provisional
                && claim.status != ProtocolTypes.ClaimStatus.Challenged
        ) revert InvalidState();
        if (block.timestamp < claim.decisionDeadline) revert DecisionWindowOpen(claim.decisionDeadline);

        bool approved;
        bytes32 decisionCommitment;
        if (claim.status == ProtocolTypes.ClaimStatus.Open) {
            decisionCommitment = NO_QUORUM_DECISION;
        } else if (claim.round == 1 && claim.roundOneDecisionReady) {
            approved = claim.roundOneApproved;
            decisionCommitment = claim.roundOneDecisionCommitment;
        } else {
            approved = claim.fallbackApproved;
            decisionCommitment = claim.fallbackDecisionCommitment;
        }

        uint256 approvedAmount = approved ? claim.approvedAmount : 0;
        claim.finalDecisionCommitment = decisionCommitment;
        ProtocolTypes.PolicyPosition storage position = _positions[claim.positionId];
        if (position.activeClaimId != claimId) revert InvalidState();

        bytes32 obligationId;
        if (approved) {
            obligationId = keccak256(abi.encode(CLAIM_OBLIGATION_NAMESPACE, claimId));
            claim.obligationId = obligationId;
            claim.status = ProtocolTypes.ClaimStatus.FinalizedApproved;
            position.remainingCoverage -= approvedAmount;
            _series[claim.seriesId].outstandingExposure -= approvedAmount;
        } else {
            claim.approvedAmount = 0;
            claim.status = ProtocolTypes.ClaimStatus.FinalizedDenied;
            position.activeClaimId = bytes32(0);
        }

        result = ClaimFinalization({
            lineId: claim.lineId,
            obligationId: obligationId,
            payoutRecipient: claim.payoutRecipient,
            requestedAmount: claim.requestedAmount,
            approvedAmount: approvedAmount,
            decisionCommitment: decisionCommitment,
            approved: approved
        });
        emit ClaimCaseStateChanged(claimId, claim.status, approvedAmount, decisionCommitment);
    }

    function markClaimSettled(bytes32 claimId, bytes32 obligationId) external onlyCore {
        ProtocolTypes.ClaimCase storage claim = _requireClaim(claimId);
        if (
            claim.status != ProtocolTypes.ClaimStatus.FinalizedApproved || claim.obligationId != obligationId
                || obligationId == bytes32(0)
        ) revert InvalidState();
        ProtocolTypes.PolicyPosition storage position = _positions[claim.positionId];
        if (position.activeClaimId != claimId) revert InvalidState();
        claim.status = ProtocolTypes.ClaimStatus.Settled;
        position.activeClaimId = bytes32(0);
        if (position.remainingCoverage == 0) position.status = ProtocolTypes.PolicyPositionStatus.Exhausted;
        emit ClaimCaseStateChanged(
            claimId, ProtocolTypes.ClaimStatus.Settled, claim.approvedAmount, claim.finalDecisionCommitment
        );
    }

    function getPolicySeries(bytes32 seriesId) external view returns (ProtocolTypes.PolicySeries memory) {
        return _requireSeries(seriesId);
    }

    function getPolicyPosition(bytes32 positionId) external view returns (ProtocolTypes.PolicyPosition memory) {
        return _requirePosition(positionId);
    }

    function getClaim(bytes32 claimId) external view returns (ProtocolTypes.ClaimCase memory) {
        return _requireClaim(claimId);
    }

    function _requireSeries(bytes32 seriesId)
        private
        view
        returns (ProtocolTypes.PolicySeries storage series_)
    {
        series_ = _series[seriesId];
        if (series_.planId == bytes32(0)) revert DoesNotExist(seriesId);
    }

    function _requirePosition(bytes32 positionId)
        private
        view
        returns (ProtocolTypes.PolicyPosition storage position)
    {
        position = _positions[positionId];
        if (position.status == ProtocolTypes.PolicyPositionStatus.None) revert DoesNotExist(positionId);
    }

    function _requireClaim(bytes32 claimId) private view returns (ProtocolTypes.ClaimCase storage claim) {
        claim = _claims[claimId];
        if (claim.status == ProtocolTypes.ClaimStatus.None) revert DoesNotExist(claimId);
    }
}
