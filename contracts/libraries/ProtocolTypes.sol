// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.28;

/// @notice Shared storage types for the immutable Ethereum protocol surface.
library ProtocolTypes {
    enum FundingLineType {
        SponsorBudget,
        PremiumIncome,
        Backstop,
        Subsidy
    }

    enum ClaimStatus {
        None,
        Open,
        Provisional,
        Challenged,
        FinalizedApproved,
        FinalizedDenied,
        Settled
    }

    enum ObligationStatus {
        None,
        Proposed,
        Reserved,
        Settled,
        Canceled
    }

    enum PolicyPositionStatus {
        None,
        Active,
        Exhausted,
        Expired
    }

    /// @dev `reserved` is a subset of `owed`; it is never added to `owed` when
    /// calculating free assets. This avoids double counting while ensuring all
    /// proposed obligations encumber contributor equity immediately.
    struct BalanceSheet {
        uint256 funded;
        uint256 owed;
        uint256 pendingClaims;
        uint256 openExposure;
        uint256 reserved;
        uint256 settled;
        uint256 returned;
    }

    struct Domain {
        address controller;
        address pendingController;
        uint64 controllerValidAfter;
        uint64 pauseUntil;
        uint64 lastPauseStarted;
        bool active;
        bytes32 metadataCommitment;
    }

    struct Plan {
        bytes32 domainId;
        address controller;
        address pendingController;
        uint64 controllerValidAfter;
        uint64 pauseUntil;
        uint64 lastPauseStarted;
        uint16 attesterCount;
        uint16 attesterThreshold;
        bool active;
        bytes32 metadataCommitment;
    }

    struct PolicySeries {
        bytes32 planId;
        bytes32 coverageLineId;
        bytes32 premiumLineId;
        address assetToken;
        bytes32 eligibilityRoot;
        uint64 coverageDuration;
        uint64 initialDecisionWindow;
        uint64 challengeWindow;
        uint16 attesterThreshold;
        uint256 coverageLimit;
        uint256 premiumAmount;
        uint256 exposureCap;
        bytes32 termsCommitment;
        /// @notice Remaining unclaimed coverage across live positions. Owed
        /// approved claims are tracked separately in reserve balance sheets.
        uint256 outstandingExposure;
    }

    struct PolicyPosition {
        bytes32 seriesId;
        bytes32 coverageLineId;
        bytes32 premiumLineId;
        address holder;
        uint64 openedAt;
        uint64 expiresAt;
        uint256 remainingCoverage;
        bytes32 activeClaimId;
        PolicyPositionStatus status;
    }

    struct FundingLine {
        bytes32 planId;
        bytes32 seriesId;
        address assetToken;
        FundingLineType lineType;
        bool active;
        uint256 capitalCap;
        uint256 grossFunded;
        uint256 grossSpent;
        uint256 grossReturned;
        bytes32 termsCommitment;
    }

    struct ClaimCase {
        bytes32 planId;
        bytes32 seriesId;
        bytes32 positionId;
        bytes32 lineId;
        bytes32 claimCommitment;
        bytes32 nullifier;
        address claimant;
        address payoutRecipient;
        uint256 requestedAmount;
        uint256 approvedAmount;
        uint256 recipientNonce;
        uint64 decisionDeadline;
        uint8 round;
        bool fallbackApproved;
        bool roundOneDecisionReady;
        bool roundOneApproved;
        ClaimStatus status;
        bytes32 fallbackDecisionCommitment;
        bytes32 roundOneDecisionCommitment;
        bytes32 finalDecisionCommitment;
        bytes32 obligationId;
    }

    struct Obligation {
        bytes32 lineId;
        bytes32 claimId;
        address recipient;
        uint256 principal;
        uint256 outstanding;
        uint256 reserved;
        ObligationStatus status;
        bytes32 reasonCommitment;
    }
}
