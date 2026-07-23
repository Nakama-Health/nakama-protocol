// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.28;

import {ProtocolTypes} from "./ProtocolTypes.sol";

/// @notice Conservative reserve-accounting operations shared by every scope.
library ReserveAccounting {
    error InsufficientFreeAssets(uint256 available, uint256 required);
    error InsufficientReserveLiquidity(uint256 available, uint256 required);
    error LedgerInvariantViolation();

    function freeAssets(ProtocolTypes.BalanceSheet storage sheet) internal view returns (uint256) {
        uint256 encumbered = sheet.owed + sheet.pendingClaims + sheet.openExposure;
        return sheet.funded > encumbered ? sheet.funded - encumbered : 0;
    }

    function bookFunding(ProtocolTypes.BalanceSheet storage sheet, uint256 amount) internal {
        sheet.funded += amount;
    }

    /// @dev A funding line must fully back new policy exposure when it is
    /// activated. The position-bound premium is allocated to the distinct
    /// claims-paying line before this check.
    function bookOpenExposure(ProtocolTypes.BalanceSheet storage sheet, uint256 amount) internal {
        uint256 available = freeAssets(sheet);
        if (amount > available) revert InsufficientFreeAssets(available, amount);
        sheet.openExposure += amount;
        _assertInvariant(sheet);
    }

    /// @dev Plan and domain sheets mirror a line-level exposure mutation. They
    /// report attribution and never gate liquidity belonging to another line.
    function recordAggregateOpenExposure(ProtocolTypes.BalanceSheet storage sheet, uint256 amount) internal {
        sheet.openExposure += amount;
        _assertInvariant(sheet);
    }

    function moveOpenExposureToPending(ProtocolTypes.BalanceSheet storage sheet, uint256 amount) internal {
        if (amount > sheet.openExposure) revert LedgerInvariantViolation();
        sheet.openExposure -= amount;
        sheet.pendingClaims += amount;
        _assertInvariant(sheet);
    }

    function finalizePendingClaim(
        ProtocolTypes.BalanceSheet storage sheet,
        uint256 requestedAmount,
        uint256 approvedAmount
    ) internal {
        if (approvedAmount > requestedAmount || requestedAmount > sheet.pendingClaims) {
            revert LedgerInvariantViolation();
        }
        sheet.pendingClaims -= requestedAmount;
        sheet.owed += approvedAmount;
        sheet.openExposure += requestedAmount - approvedAmount;
        _assertInvariant(sheet);
    }

    function releaseOpenExposure(ProtocolTypes.BalanceSheet storage sheet, uint256 amount) internal {
        if (amount > sheet.openExposure) revert LedgerInvariantViolation();
        sheet.openExposure -= amount;
        _assertInvariant(sheet);
    }

    function bookReservation(ProtocolTypes.BalanceSheet storage sheet, uint256 amount) internal {
        uint256 reserveLiquidity = sheet.funded - sheet.reserved;
        if (amount > reserveLiquidity) {
            revert InsufficientReserveLiquidity(reserveLiquidity, amount);
        }
        sheet.reserved += amount;
        _assertInvariant(sheet);
    }

    /// @dev Plan and domain sheets are reporting aggregates, not fungible
    /// liquidity pools. The funding-line mutation has already established that
    /// the attributed line can reserve this amount, so aggregate scopes only
    /// mirror the resulting totals and assert their accounting invariant.
    function recordAggregateReservation(ProtocolTypes.BalanceSheet storage sheet, uint256 amount) internal {
        sheet.reserved += amount;
        _assertInvariant(sheet);
    }

    function bookSettlement(ProtocolTypes.BalanceSheet storage sheet, uint256 amount) internal {
        if (amount > sheet.reserved || amount > sheet.owed || amount > sheet.funded) {
            revert LedgerInvariantViolation();
        }
        sheet.funded -= amount;
        sheet.owed -= amount;
        sheet.reserved -= amount;
        sheet.settled += amount;
        _assertInvariant(sheet);
    }

    /// @dev Mirrors a settlement already validated against its funding line.
    function recordAggregateSettlement(ProtocolTypes.BalanceSheet storage sheet, uint256 amount) internal {
        sheet.funded -= amount;
        sheet.owed -= amount;
        sheet.reserved -= amount;
        sheet.settled += amount;
        _assertInvariant(sheet);
    }

    function bookCancellation(ProtocolTypes.BalanceSheet storage sheet, uint256 amount) internal {
        if (amount > sheet.owed || amount > sheet.reserved) {
            revert LedgerInvariantViolation();
        }
        sheet.owed -= amount;
        sheet.reserved -= amount;
        _assertInvariant(sheet);
    }

    function bookWithdrawal(ProtocolTypes.BalanceSheet storage sheet, uint256 amount) internal {
        uint256 available = freeAssets(sheet);
        if (amount > available) revert InsufficientFreeAssets(available, amount);
        sheet.funded -= amount;
        sheet.returned += amount;
        _assertInvariant(sheet);
    }

    /// @dev Mirrors an exit already validated against its funding line. Owed
    /// or pending amounts on another line must not consume this line's equity.
    function recordAggregateWithdrawal(ProtocolTypes.BalanceSheet storage sheet, uint256 amount) internal {
        sheet.funded -= amount;
        sheet.returned += amount;
        _assertInvariant(sheet);
    }

    function isSound(ProtocolTypes.BalanceSheet storage sheet) internal view returns (bool) {
        return sheet.reserved <= sheet.owed
            && sheet.owed + sheet.pendingClaims + sheet.openExposure <= sheet.funded;
    }

    function _assertInvariant(ProtocolTypes.BalanceSheet storage sheet) private view {
        if (!isSound(sheet)) revert LedgerInvariantViolation();
    }
}
