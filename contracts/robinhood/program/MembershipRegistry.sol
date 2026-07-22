// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.28;

import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {SignatureChecker} from "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";

import {IClaimManager} from "../interfaces/IClaimManager.sol";
import {INakamaProgram} from "../interfaces/INakamaProgram.sol";
import {IPoolVault} from "../interfaces/IPoolVault.sol";
import {RobinhoodTypes} from "../types/RobinhoodTypes.sol";

/// @notice Program-scoped pseudonymous eligibility and non-transferable member
/// activation. No identity or health fields are accepted by the ABI.
contract MembershipRegistry is EIP712 {
    bytes32 public constant ELIGIBILITY_TYPEHASH = keccak256(
        "Eligibility(bytes32 programId,bytes32 memberCommitment,address account,bytes32 termsCommitment,bytes32 privacyCommitment,uint256 nonce,uint64 validUntil)"
    );
    bytes32 public constant RECOVERY_TYPEHASH = keccak256(
        "RecoveryAuthorization(bytes32 programId,bytes32 membershipId,address newAccount,uint256 nonce,uint64 validUntil)"
    );
    bytes32 private constant MEMBERSHIP_NAMESPACE = keccak256("NAKAMA_ROBINHOOD_MEMBERSHIP_V1");

    struct Membership {
        bytes32 memberCommitment;
        uint64 activatedAt;
        uint64 expiresAt;
        RobinhoodTypes.MembershipState state;
    }

    error Unauthorized();
    error InvalidAddress();
    error InvalidCommitment();
    error InvalidState();
    error InvalidAuthorization();
    error SignatureExpired();
    error SignatureAlreadyUsed();
    error MembershipAlreadyExists(bytes32 membershipId);
    error AccountAlreadyBound(address account);
    error MembershipLimitReached(uint32 maximum);
    error OpenRequestExists(bytes32 membershipId);

    event ClaimManagerBound(address indexed claimManager);
    event MembershipActivated(
        bytes32 indexed programId,
        bytes32 indexed membershipId,
        bytes32 indexed memberCommitment,
        uint64 activatedAt,
        uint64 expiresAt,
        bytes32 termsCommitment,
        bytes32 privacyCommitment
    );
    event MembershipAccountRecovered(bytes32 indexed programId, bytes32 indexed membershipId, uint256 recoveryNonce);
    event MembershipStateChanged(
        bytes32 indexed programId,
        bytes32 indexed membershipId,
        RobinhoodTypes.MembershipState previous,
        RobinhoodTypes.MembershipState next,
        uint256 releasedLiability
    );

    address public immutable deploymentFactory;
    address public immutable program;
    address public immutable vault;
    bytes32 public immutable programId;
    address public claimManager;
    uint32 public totalActivated;
    uint32 public activeMemberships;

    mapping(bytes32 membershipId => Membership membership_) private _memberships;
    mapping(bytes32 membershipId => address account) private _membershipAccount;
    mapping(address account => bytes32 membershipId) private _accountMembership;
    mapping(bytes32 digest => bool used) public authorizationUsed;
    mapping(bytes32 membershipId => uint256 nonce) public recoveryNonces;

    constructor(address deploymentFactory_, address program_, address vault_)
        EIP712("Nakama Membership Eligibility", "1")
    {
        if (deploymentFactory_ == address(0) || program_ == address(0) || vault_ == address(0)) {
            revert InvalidAddress();
        }
        deploymentFactory = deploymentFactory_;
        program = program_;
        vault = vault_;
        programId = INakamaProgram(program_).programId();
    }

    function bindClaimManager(address claimManager_) external {
        if (msg.sender != deploymentFactory) revert Unauthorized();
        if (claimManager != address(0) || claimManager_ == address(0)) revert InvalidAddress();
        claimManager = claimManager_;
        emit ClaimManagerBound(claimManager_);
    }

    function deriveMembershipId(bytes32 memberCommitment) public view returns (bytes32) {
        return keccak256(abi.encode(MEMBERSHIP_NAMESPACE, programId, memberCommitment));
    }

    function activateMembership(RobinhoodTypes.Eligibility calldata eligibility, bytes calldata signature)
        external
        returns (bytes32 membershipId)
    {
        INakamaProgram program_ = INakamaProgram(program);
        if (
            program_.state() != RobinhoodTypes.ProgramState.EnrollmentOpen
                || block.timestamp >= program_.activeAt()
                || program_.isActionPaused(RobinhoodTypes.PauseScope.Enrollment)
        ) revert InvalidState();
        if (
            eligibility.programId != programId || eligibility.memberCommitment == bytes32(0)
                || eligibility.account != msg.sender || eligibility.termsCommitment != program_.termsCommitment()
                || eligibility.privacyCommitment != program_.privacyCommitment()
        ) revert InvalidAuthorization();
        if (block.timestamp > eligibility.validUntil) revert SignatureExpired();
        if (_accountMembership[msg.sender] != bytes32(0)) revert AccountAlreadyBound(msg.sender);
        if (totalActivated >= program_.maxMembers()) revert MembershipLimitReached(program_.maxMembers());

        membershipId = deriveMembershipId(eligibility.memberCommitment);
        if (_memberships[membershipId].state != RobinhoodTypes.MembershipState.None) {
            revert MembershipAlreadyExists(membershipId);
        }
        bytes32 digest = _hashTypedDataV4(keccak256(abi.encode(ELIGIBILITY_TYPEHASH, eligibility)));
        if (authorizationUsed[digest]) revert SignatureAlreadyUsed();
        if (!SignatureChecker.isValidSignatureNow(program_.eligibilityAttestor(), digest, signature)) {
            revert InvalidAuthorization();
        }
        authorizationUsed[digest] = true;

        uint64 expiresAt = program_.runoffAt();
        _memberships[membershipId] = Membership({
            memberCommitment: eligibility.memberCommitment,
            activatedAt: uint64(block.timestamp),
            expiresAt: expiresAt,
            state: RobinhoodTypes.MembershipState.Active
        });
        _membershipAccount[membershipId] = msg.sender;
        _accountMembership[msg.sender] = membershipId;
        totalActivated += 1;
        activeMemberships += 1;
        IPoolVault(vault).registerMemberLiability(membershipId, program_.perMemberCap());
        emit MembershipActivated(
            programId,
            membershipId,
            eligibility.memberCommitment,
            uint64(block.timestamp),
            expiresAt,
            eligibility.termsCommitment,
            eligibility.privacyCommitment
        );
    }

    function recoverMembershipAccount(
        RobinhoodTypes.RecoveryAuthorization calldata authorization,
        bytes calldata signature
    ) external {
        if (
            authorization.programId != programId || authorization.membershipId == bytes32(0)
                || authorization.newAccount != msg.sender
        ) revert InvalidAuthorization();
        if (block.timestamp > authorization.validUntil) revert SignatureExpired();
        Membership storage membership_ = _memberships[authorization.membershipId];
        if (membership_.state != RobinhoodTypes.MembershipState.Active) revert InvalidState();
        if (_accountMembership[msg.sender] != bytes32(0)) revert AccountAlreadyBound(msg.sender);
        if (authorization.nonce != recoveryNonces[authorization.membershipId]) revert InvalidAuthorization();

        bytes32 digest = _hashTypedDataV4(keccak256(abi.encode(RECOVERY_TYPEHASH, authorization)));
        if (authorizationUsed[digest]) revert SignatureAlreadyUsed();
        if (!SignatureChecker.isValidSignatureNow(INakamaProgram(program).eligibilityAttestor(), digest, signature)) {
            revert InvalidAuthorization();
        }
        authorizationUsed[digest] = true;
        recoveryNonces[authorization.membershipId] = authorization.nonce + 1;

        address previous = _membershipAccount[authorization.membershipId];
        delete _accountMembership[previous];
        _membershipAccount[authorization.membershipId] = msg.sender;
        _accountMembership[msg.sender] = authorization.membershipId;
        emit MembershipAccountRecovered(programId, authorization.membershipId, authorization.nonce);
    }

    function cancelMembership(bytes32 membershipId) external {
        Membership storage membership_ = _memberships[membershipId];
        if (membership_.state != RobinhoodTypes.MembershipState.Active) revert InvalidState();
        if (_membershipAccount[membershipId] != msg.sender) revert Unauthorized();
        if (INakamaProgram(program).state() != RobinhoodTypes.ProgramState.EnrollmentOpen) revert InvalidState();
        if (!_canRelease(membershipId)) revert OpenRequestExists(membershipId);
        _release(membershipId, membership_, RobinhoodTypes.MembershipState.Cancelled);
    }

    function expireMembership(bytes32 membershipId) external {
        Membership storage membership_ = _memberships[membershipId];
        if (membership_.state != RobinhoodTypes.MembershipState.Active) revert InvalidState();
        if (block.timestamp < membership_.expiresAt) revert InvalidState();
        if (!_canRelease(membershipId)) revert OpenRequestExists(membershipId);
        _release(membershipId, membership_, RobinhoodTypes.MembershipState.Expired);
    }

    function membership(bytes32 membershipId) external view returns (Membership memory) {
        return _memberships[membershipId];
    }

    function membershipIdForAccount(address account) external view returns (bytes32) {
        return _accountMembership[account];
    }

    function isActiveMembership(bytes32 membershipId) external view returns (bool) {
        Membership storage membership_ = _memberships[membershipId];
        return membership_.state == RobinhoodTypes.MembershipState.Active && block.timestamp < membership_.expiresAt;
    }

    function isMembershipAccount(bytes32 membershipId, address account) external view returns (bool) {
        Membership storage membership_ = _memberships[membershipId];
        return membership_.state == RobinhoodTypes.MembershipState.Active && _membershipAccount[membershipId] == account;
    }

    function hashEligibility(RobinhoodTypes.Eligibility calldata eligibility) external view returns (bytes32) {
        return _hashTypedDataV4(keccak256(abi.encode(ELIGIBILITY_TYPEHASH, eligibility)));
    }

    function hashRecovery(RobinhoodTypes.RecoveryAuthorization calldata authorization) external view returns (bytes32) {
        return _hashTypedDataV4(keccak256(abi.encode(RECOVERY_TYPEHASH, authorization)));
    }

    function _canRelease(bytes32 membershipId) private view returns (bool) {
        return claimManager != address(0) && IClaimManager(claimManager).canReleaseMembership(membershipId);
    }

    function _release(
        bytes32 membershipId,
        Membership storage membership_,
        RobinhoodTypes.MembershipState next
    ) private {
        RobinhoodTypes.MembershipState previous = membership_.state;
        membership_.state = next;
        activeMemberships -= 1;
        uint256 released = IPoolVault(vault).releaseMemberLiability(membershipId);
        emit MembershipStateChanged(programId, membershipId, previous, next, released);
    }
}
