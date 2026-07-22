// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.28;

/// @notice Canonical public types for the immutable Robinhood Phase 0 suite.
library RobinhoodTypes {
    enum AssetStatus {
        Unregistered,
        Active,
        Paused,
        Deprecated
    }

    enum TemplateStatus {
        Unregistered,
        Active,
        Warning,
        Deprecated
    }

    enum ProgramState {
        Draft,
        Reviewed,
        Funded,
        EnrollmentOpen,
        Active,
        Runoff,
        Closed,
        Cancelled
    }

    enum MembershipState {
        None,
        Active,
        Expired,
        Cancelled
    }

    enum RequestState {
        None,
        Pending,
        InformationRequested,
        Escalated,
        DeniedAppealable,
        Appealed,
        Approved,
        FinalDenied,
        Settled
    }

    enum ReviewRound {
        None,
        Initial,
        Appeal
    }

    enum ReviewerRole {
        None,
        InitialReviewer,
        AppealReviewer
    }

    enum DecisionAction {
        None,
        RequestInformation,
        Approve,
        Deny
    }

    enum PauseScope {
        None,
        Enrollment,
        NewRequests,
        NewObligations,
        Settlement,
        AgentActions
    }

    struct RoleConfig {
        address sponsor;
        address operator;
        address initialReviewer;
        address appealReviewer;
        address settlement;
        address guardian;
        address eligibilityAttestor;
    }

    struct ProgramConfig {
        bytes32 sponsorLegalEntityCommitment;
        bytes32 metadataCommitment;
        bytes32 termsCommitment;
        bytes32 privacyCommitment;
        bytes32 operationsCommitment;
        bytes32 activationChecklistCommitment;
        address fundingAsset;
        uint64 enrollmentOpensAt;
        uint64 activeAt;
        uint64 runoffAt;
        uint64 closesAt;
        uint64 appealWindow;
        uint64 initialDecisionWindow;
        uint64 appealDecisionWindow;
        uint256 perMemberCap;
        uint256 aggregateCap;
        uint32 maxMembers;
    }

    struct ProgramDeployment {
        bytes32 programId;
        address program;
        address vault;
        address membershipRegistry;
        address decisionModule;
        address claimManager;
        address settlementModule;
        address agentAuthorizationRegistry;
        address safetyGuardian;
    }

    struct Eligibility {
        bytes32 programId;
        bytes32 memberCommitment;
        address account;
        bytes32 termsCommitment;
        bytes32 privacyCommitment;
        uint256 nonce;
        uint64 validUntil;
    }

    struct EligibilityRevocation {
        bytes32 programId;
        bytes32 authorizationDigest;
        uint256 nonce;
        uint64 validUntil;
    }

    struct RecoveryAuthorization {
        bytes32 programId;
        bytes32 membershipId;
        address newAccount;
        uint256 nonce;
        uint64 validUntil;
    }

    struct Decision {
        bytes32 programId;
        bytes32 requestId;
        bytes32 termsCommitment;
        bytes32 evidenceManifestCommitment;
        uint32 evidenceVersion;
        uint8 reviewRound;
        uint8 reviewerRole;
        uint8 action;
        uint256 approvedAmount;
        bytes32 recipientCommitment;
        bytes32 publicReasonCode;
        uint256 nonce;
        uint64 validUntil;
    }

    struct VaultAccounting {
        uint256 sponsorFunded;
        uint256 settled;
        uint256 sponsorRefunded;
        uint256 maximumRemainingMemberLiability;
        uint256 pendingRequestReservation;
        uint256 approvedUnpaidObligations;
        uint256 maturedRefunds;
    }

    struct Authorization {
        address principal;
        address target;
        bytes4 selector;
        uint256 maxNativeValue;
        address asset;
        uint256 maxAssetAmountPerAction;
        uint256 periodAssetLimit;
        uint64 periodSeconds;
        uint64 issuedAt;
        uint64 expiresAt;
        uint32 maxCallsPerPeriod;
        uint256 nonce;
        bytes32 purposeCommitment;
    }
}
