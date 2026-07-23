// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.28;

import {IDecisionModule} from "../interfaces/IDecisionModule.sol";
import {IMembershipRegistry} from "../interfaces/IMembershipRegistry.sol";
import {INakamaProgram} from "../interfaces/INakamaProgram.sol";
import {IPoolVault} from "../interfaces/IPoolVault.sol";
import {RobinhoodTypes} from "../types/RobinhoodTypes.sol";

/// @notice Public-safe request state and exact human-decision execution. Raw
/// evidence, narratives, and private rationale never enter this contract.
/// Evidence versions are immutable while a human decision is pending; only a
/// signed request for information opens one member update window.
contract ClaimManager {
    bytes32 private constant REQUEST_NAMESPACE = keccak256("NAKAMA_ROBINHOOD_REQUEST_V1");
    bytes32 private constant INFORMATION_TIMEOUT_REASON = keccak256("INFORMATION_RESPONSE_TIMEOUT");

    struct Request {
        bytes32 membershipId;
        bytes32 evidenceManifestCommitment;
        bytes32 recipientCommitment;
        bytes32 publicReasonCode;
        address payoutRecipient;
        uint256 requestedAmount;
        uint256 approvedAmount;
        uint64 openedAt;
        uint64 decisionDeadline;
        uint64 appealDeadline;
        uint32 evidenceVersion;
        uint8 currentRound;
        RobinhoodTypes.RequestState state;
    }

    error Unauthorized();
    error InvalidAddress();
    error InvalidAmount();
    error InvalidCommitment();
    error InvalidState();
    error InvalidDecision();
    error DeadlineOverflow();
    error DeadlineOpen(uint64 deadline);
    error DeadlineClosed(uint64 deadline);
    error SettlementModuleAlreadyBound();

    event SettlementModuleBound(address indexed settlementModule);
    event RequestOpened(
        bytes32 indexed programId,
        bytes32 indexed requestId,
        bytes32 indexed membershipId,
        uint256 requestedAmount,
        bytes32 evidenceManifestCommitment,
        uint32 evidenceVersion,
        uint64 decisionDeadline
    );
    event EvidenceManifestUpdated(
        bytes32 indexed programId,
        bytes32 indexed requestId,
        bytes32 evidenceManifestCommitment,
        uint32 evidenceVersion,
        uint64 decisionDeadline
    );
    event RequestStateChanged(
        bytes32 indexed programId,
        bytes32 indexed requestId,
        RobinhoodTypes.RequestState previous,
        RobinhoodTypes.RequestState next,
        bytes32 publicReasonCode,
        uint256 approvedAmount,
        uint64 deadline
    );
    event AppealFiled(
        bytes32 indexed programId,
        bytes32 indexed requestId,
        bytes32 evidenceManifestCommitment,
        uint32 evidenceVersion,
        uint64 decisionDeadline
    );

    address public immutable deploymentFactory;
    address public immutable program;
    address public immutable vault;
    address public immutable membershipRegistry;
    address public immutable decisionModule;
    bytes32 public immutable programId;
    address public settlementModule;
    uint256 public openRequestCount;

    mapping(bytes32 requestId => Request request_) private _requests;
    mapping(bytes32 membershipId => uint256 nextNonce) public requestNonce;
    mapping(bytes32 membershipId => uint256 unresolved) public unresolvedByMembership;

    constructor(
        address deploymentFactory_,
        address program_,
        address vault_,
        address membershipRegistry_,
        address decisionModule_
    ) {
        if (
            deploymentFactory_ == address(0) || program_ == address(0) || vault_ == address(0)
                || membershipRegistry_ == address(0) || decisionModule_ == address(0)
        ) revert InvalidAddress();
        deploymentFactory = deploymentFactory_;
        program = program_;
        vault = vault_;
        membershipRegistry = membershipRegistry_;
        decisionModule = decisionModule_;
        programId = INakamaProgram(program_).programId();
    }

    function bindSettlementModule(address settlementModule_) external {
        if (msg.sender != deploymentFactory) revert Unauthorized();
        if (settlementModule != address(0)) revert SettlementModuleAlreadyBound();
        if (settlementModule_ == address(0)) revert InvalidAddress();
        settlementModule = settlementModule_;
        emit SettlementModuleBound(settlementModule_);
    }

    function deriveRequestId(bytes32 membershipId, uint256 nonce) public view returns (bytes32) {
        return keccak256(abi.encode(REQUEST_NAMESPACE, programId, membershipId, nonce));
    }

    function recipientCommitment(bytes32 requestId, address recipient, bytes32 recipientSalt)
        public
        view
        returns (bytes32)
    {
        return keccak256(abi.encode(programId, requestId, recipient, recipientSalt));
    }

    function openRequest(
        bytes32 membershipId,
        bytes32 evidenceManifestCommitment,
        bytes32 payoutRecipientCommitment,
        uint256 requestedAmount
    ) external returns (bytes32 requestId) {
        INakamaProgram program_ = INakamaProgram(program);
        if (
            program_.state() != RobinhoodTypes.ProgramState.Active
                || block.timestamp >= program_.runoffAt()
                || program_.isActionPaused(RobinhoodTypes.PauseScope.NewRequests)
        ) revert InvalidState();
        if (
            !IMembershipRegistry(membershipRegistry).isActiveMembership(membershipId)
                || !IMembershipRegistry(membershipRegistry).isMembershipAccount(membershipId, msg.sender)
        ) {
            revert Unauthorized();
        }
        if (evidenceManifestCommitment == bytes32(0) || payoutRecipientCommitment == bytes32(0)) {
            revert InvalidCommitment();
        }
        if (requestedAmount == 0 || requestedAmount > program_.perMemberCap()) revert InvalidAmount();

        uint256 nonce = requestNonce[membershipId]++;
        requestId = deriveRequestId(membershipId, nonce);
        uint64 deadline = _deadline(program_.initialDecisionWindow());
        _requests[requestId] = Request({
            membershipId: membershipId,
            evidenceManifestCommitment: evidenceManifestCommitment,
            recipientCommitment: payoutRecipientCommitment,
            publicReasonCode: bytes32(0),
            payoutRecipient: address(0),
            requestedAmount: requestedAmount,
            approvedAmount: 0,
            openedAt: uint64(block.timestamp),
            decisionDeadline: deadline,
            appealDeadline: 0,
            evidenceVersion: 1,
            currentRound: uint8(RobinhoodTypes.ReviewRound.Initial),
            state: RobinhoodTypes.RequestState.Pending
        });
        openRequestCount += 1;
        unresolvedByMembership[membershipId] += 1;
        IPoolVault(vault).reservePendingRequest(requestId, membershipId, requestedAmount);
        emit RequestOpened(
            programId, requestId, membershipId, requestedAmount, evidenceManifestCommitment, 1, deadline
        );
    }

    function updateEvidence(bytes32 requestId, bytes32 newEvidenceManifestCommitment) external {
        if (newEvidenceManifestCommitment == bytes32(0)) revert InvalidCommitment();
        Request storage request_ = _requests[requestId];
        if (!IMembershipRegistry(membershipRegistry).isMembershipAccount(request_.membershipId, msg.sender)) {
            revert Unauthorized();
        }
        if (request_.state != RobinhoodTypes.RequestState.InformationRequested) revert InvalidState();
        if (newEvidenceManifestCommitment == request_.evidenceManifestCommitment) revert InvalidCommitment();
        request_.evidenceManifestCommitment = newEvidenceManifestCommitment;
        request_.evidenceVersion += 1;
        if (request_.currentRound == uint8(RobinhoodTypes.ReviewRound.Initial)) {
            request_.state = RobinhoodTypes.RequestState.Pending;
            request_.decisionDeadline = _deadline(INakamaProgram(program).initialDecisionWindow());
        } else {
            request_.state = RobinhoodTypes.RequestState.Appealed;
            request_.decisionDeadline = _deadline(INakamaProgram(program).appealDecisionWindow());
        }
        emit EvidenceManifestUpdated(
            programId,
            requestId,
            request_.evidenceManifestCommitment,
            request_.evidenceVersion,
            request_.decisionDeadline
        );
    }

    function executeInitialDecision(
        RobinhoodTypes.Decision calldata decision,
        address payoutRecipient,
        bytes32 recipientSalt,
        bytes calldata signature
    ) external {
        Request storage request_ = _requests[decision.requestId];
        if (
            request_.currentRound != uint8(RobinhoodTypes.ReviewRound.Initial)
                || (request_.state != RobinhoodTypes.RequestState.Pending
                    && request_.state != RobinhoodTypes.RequestState.InformationRequested
                    && request_.state != RobinhoodTypes.RequestState.Escalated)
        ) revert InvalidState();
        _validateDecisionBinding(request_, decision);
        IDecisionModule(decisionModule).consumeDecision(decision, signature);
        _applyInitialDecision(request_, decision, payoutRecipient, recipientSalt);
    }

    function fileAppeal(bytes32 requestId, bytes32 appealManifestCommitment) external {
        Request storage request_ = _requests[requestId];
        if (!IMembershipRegistry(membershipRegistry).isMembershipAccount(request_.membershipId, msg.sender)) {
            revert Unauthorized();
        }
        if (request_.state != RobinhoodTypes.RequestState.DeniedAppealable) revert InvalidState();
        if (block.timestamp > request_.appealDeadline) revert DeadlineClosed(request_.appealDeadline);
        if (
            appealManifestCommitment == bytes32(0)
                || appealManifestCommitment == request_.evidenceManifestCommitment
        ) revert InvalidCommitment();
        request_.evidenceManifestCommitment = appealManifestCommitment;
        request_.evidenceVersion += 1;
        request_.currentRound = uint8(RobinhoodTypes.ReviewRound.Appeal);
        request_.state = RobinhoodTypes.RequestState.Appealed;
        request_.decisionDeadline = _deadline(INakamaProgram(program).appealDecisionWindow());
        emit AppealFiled(
            programId,
            requestId,
            appealManifestCommitment,
            request_.evidenceVersion,
            request_.decisionDeadline
        );
    }

    function executeAppealDecision(
        RobinhoodTypes.Decision calldata decision,
        address payoutRecipient,
        bytes32 recipientSalt,
        bytes calldata signature
    ) external {
        Request storage request_ = _requests[decision.requestId];
        if (
            request_.currentRound != uint8(RobinhoodTypes.ReviewRound.Appeal)
                || (request_.state != RobinhoodTypes.RequestState.Appealed
                    && request_.state != RobinhoodTypes.RequestState.InformationRequested
                    && request_.state != RobinhoodTypes.RequestState.Escalated)
        ) revert InvalidState();
        _validateDecisionBinding(request_, decision);
        IDecisionModule(decisionModule).consumeDecision(decision, signature);
        _applyAppealDecision(request_, decision, payoutRecipient, recipientSalt);
    }

    function escalateNoQuorum(bytes32 requestId) external {
        Request storage request_ = _requests[requestId];
        if (
            request_.state != RobinhoodTypes.RequestState.Pending
                && request_.state != RobinhoodTypes.RequestState.Appealed
        ) revert InvalidState();
        if (block.timestamp <= request_.decisionDeadline) revert DeadlineOpen(request_.decisionDeadline);
        RobinhoodTypes.RequestState previous = request_.state;
        request_.state = RobinhoodTypes.RequestState.Escalated;
        emit RequestStateChanged(
            programId,
            requestId,
            previous,
            request_.state,
            bytes32(0),
            0,
            request_.decisionDeadline
        );
    }

    function finalizeUnappealedDenial(bytes32 requestId) external {
        Request storage request_ = _requests[requestId];
        if (request_.state != RobinhoodTypes.RequestState.DeniedAppealable) revert InvalidState();
        if (block.timestamp <= request_.appealDeadline) revert DeadlineOpen(request_.appealDeadline);
        IPoolVault(vault).clearPendingRequest(requestId);
        _resolve(request_, requestId, RobinhoodTypes.RequestState.FinalDenied, request_.publicReasonCode, 0);
    }

    function escalateInformationTimeout(bytes32 requestId) external {
        Request storage request_ = _requests[requestId];
        if (request_.state != RobinhoodTypes.RequestState.InformationRequested) revert InvalidState();
        if (block.timestamp <= request_.decisionDeadline) revert DeadlineOpen(request_.decisionDeadline);
        RobinhoodTypes.RequestState previous = request_.state;
        request_.state = RobinhoodTypes.RequestState.Escalated;
        request_.publicReasonCode = INFORMATION_TIMEOUT_REASON;
        emit RequestStateChanged(
            programId,
            requestId,
            previous,
            request_.state,
            INFORMATION_TIMEOUT_REASON,
            0,
            request_.decisionDeadline
        );
    }

    function markSettled(bytes32 requestId) external {
        if (msg.sender != settlementModule) revert Unauthorized();
        Request storage request_ = _requests[requestId];
        if (request_.state != RobinhoodTypes.RequestState.Approved) revert InvalidState();
        RobinhoodTypes.RequestState previous = request_.state;
        request_.state = RobinhoodTypes.RequestState.Settled;
        emit RequestStateChanged(
            programId,
            requestId,
            previous,
            request_.state,
            request_.publicReasonCode,
            request_.approvedAmount,
            0
        );
    }

    function request(bytes32 requestId) external view returns (Request memory) {
        return _requests[requestId];
    }

    function canReleaseMembership(bytes32 membershipId) external view returns (bool) {
        return unresolvedByMembership[membershipId] == 0 && IPoolVault(vault).pendingByMember(membershipId) == 0;
    }

    function settlementDetails(bytes32 requestId)
        external
        view
        returns (RobinhoodTypes.RequestState requestState, address recipient, uint256 amount)
    {
        Request storage request_ = _requests[requestId];
        return (request_.state, request_.payoutRecipient, request_.approvedAmount);
    }

    function _validateDecisionBinding(Request storage request_, RobinhoodTypes.Decision calldata decision)
        private
        view
    {
        if (
            decision.programId != programId || decision.requestId == bytes32(0)
                || decision.evidenceManifestCommitment != request_.evidenceManifestCommitment
                || decision.evidenceVersion != request_.evidenceVersion
                || decision.reviewRound != request_.currentRound
        ) revert InvalidDecision();
        bool approval = decision.action == uint8(RobinhoodTypes.DecisionAction.Approve);
        if (
            (approval && decision.recipientCommitment != request_.recipientCommitment)
                || (!approval && decision.recipientCommitment != bytes32(0))
        ) revert InvalidDecision();
    }

    function _applyInitialDecision(
        Request storage request_,
        RobinhoodTypes.Decision calldata decision,
        address payoutRecipient,
        bytes32 recipientSalt
    ) private {
        RobinhoodTypes.DecisionAction action = RobinhoodTypes.DecisionAction(decision.action);
        if (action == RobinhoodTypes.DecisionAction.RequestInformation) {
            _requestInformation(request_, decision.requestId, decision.publicReasonCode);
        } else if (action == RobinhoodTypes.DecisionAction.Approve) {
            _approve(request_, decision, payoutRecipient, recipientSalt);
        } else if (action == RobinhoodTypes.DecisionAction.Deny) {
            RobinhoodTypes.RequestState previous = request_.state;
            request_.state = RobinhoodTypes.RequestState.DeniedAppealable;
            request_.publicReasonCode = decision.publicReasonCode;
            request_.appealDeadline = _deadline(INakamaProgram(program).appealWindow());
            emit RequestStateChanged(
                programId,
                decision.requestId,
                previous,
                request_.state,
                decision.publicReasonCode,
                0,
                request_.appealDeadline
            );
        } else {
            revert InvalidDecision();
        }
    }

    function _applyAppealDecision(
        Request storage request_,
        RobinhoodTypes.Decision calldata decision,
        address payoutRecipient,
        bytes32 recipientSalt
    ) private {
        RobinhoodTypes.DecisionAction action = RobinhoodTypes.DecisionAction(decision.action);
        if (action == RobinhoodTypes.DecisionAction.RequestInformation) {
            _requestInformation(request_, decision.requestId, decision.publicReasonCode);
        } else if (action == RobinhoodTypes.DecisionAction.Approve) {
            _approve(request_, decision, payoutRecipient, recipientSalt);
        } else if (action == RobinhoodTypes.DecisionAction.Deny) {
            IPoolVault(vault).clearPendingRequest(decision.requestId);
            request_.publicReasonCode = decision.publicReasonCode;
            _resolve(request_, decision.requestId, RobinhoodTypes.RequestState.FinalDenied, decision.publicReasonCode, 0);
        } else {
            revert InvalidDecision();
        }
    }

    function _requestInformation(Request storage request_, bytes32 requestId, bytes32 reasonCode) private {
        RobinhoodTypes.RequestState previous = request_.state;
        request_.state = RobinhoodTypes.RequestState.InformationRequested;
        request_.decisionDeadline = _deadline(
            request_.currentRound == uint8(RobinhoodTypes.ReviewRound.Initial)
                ? INakamaProgram(program).initialDecisionWindow()
                : INakamaProgram(program).appealDecisionWindow()
        );
        request_.publicReasonCode = reasonCode;
        emit RequestStateChanged(
            programId, requestId, previous, request_.state, reasonCode, 0, request_.decisionDeadline
        );
    }

    function _approve(
        Request storage request_,
        RobinhoodTypes.Decision calldata decision,
        address payoutRecipient,
        bytes32 recipientSalt
    ) private {
        if (INakamaProgram(program).isActionPaused(RobinhoodTypes.PauseScope.NewObligations)) revert InvalidState();
        if (
            payoutRecipient == address(0)
                || recipientCommitment(decision.requestId, payoutRecipient, recipientSalt) != request_.recipientCommitment
                || decision.approvedAmount > request_.requestedAmount
        ) revert InvalidDecision();
        IPoolVault(vault).approveObligation(decision.requestId, request_.membershipId, decision.approvedAmount);
        request_.payoutRecipient = payoutRecipient;
        request_.approvedAmount = decision.approvedAmount;
        request_.publicReasonCode = decision.publicReasonCode;
        _resolve(
            request_,
            decision.requestId,
            RobinhoodTypes.RequestState.Approved,
            decision.publicReasonCode,
            decision.approvedAmount
        );
    }

    function _resolve(
        Request storage request_,
        bytes32 requestId,
        RobinhoodTypes.RequestState next,
        bytes32 reasonCode,
        uint256 approvedAmount
    ) private {
        RobinhoodTypes.RequestState previous = request_.state;
        request_.state = next;
        openRequestCount -= 1;
        unresolvedByMembership[request_.membershipId] -= 1;
        emit RequestStateChanged(programId, requestId, previous, next, reasonCode, approvedAmount, 0);
    }

    function _deadline(uint64 window) private view returns (uint64 deadline) {
        if (block.timestamp > type(uint64).max - uint256(window)) revert DeadlineOverflow();
        deadline = uint64(block.timestamp + uint256(window));
    }
}
