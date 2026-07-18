// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.28;

import {ProtocolTypes} from "./ProtocolTypes.sol";

/// @notice Conservative reserve-accounting operations shared by every scope.
library ReserveAccounting {
    error InsufficientFreeAssets(uint256 available, uint256 required);
    error InsufficientReserveLiquidity(uint256 available, uint256 required);
    error LedgerInvariantViolation();

    function freeAssets(ProtocolTypes.BalanceSheet storage sheet) internal view returns (uint256) {
        uint256 encumbered = sheet.owed + sheet.pendingClaims;
        return sheet.funded > encumbered ? sheet.funded - encumbered : 0;
    }

    function bookFunding(ProtocolTypes.BalanceSheet storage sheet, uint256 amount) internal {
        sheet.funded += amount;
    }

    function bookObligation(ProtocolTypes.BalanceSheet storage sheet, uint256 amount) internal {
        sheet.owed += amount;
    }

    function replacePendingClaim(
        ProtocolTypes.BalanceSheet storage sheet,
        uint256 previousAmount,
        uint256 nextAmount
    ) internal {
        if (previousAmount > sheet.pendingClaims) revert LedgerInvariantViolation();
        sheet.pendingClaims = sheet.pendingClaims - previousAmount + nextAmount;
    }

    function convertPendingClaimToObligation(ProtocolTypes.BalanceSheet storage sheet, uint256 amount) internal {
        if (amount > sheet.pendingClaims) revert LedgerInvariantViolation();
        sheet.pendingClaims -= amount;
        sheet.owed += amount;
    }

    function releasePendingClaim(ProtocolTypes.BalanceSheet storage sheet, uint256 amount) internal {
        if (amount > sheet.pendingClaims) revert LedgerInvariantViolation();
        sheet.pendingClaims -= amount;
    }

    function bookReservation(ProtocolTypes.BalanceSheet storage sheet, uint256 amount) internal {
        uint256 reserveLiquidity = sheet.funded - sheet.reserved;
        if (amount > reserveLiquidity) {
            revert InsufficientReserveLiquidity(reserveLiquidity, amount);
        }
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

    function isSound(ProtocolTypes.BalanceSheet storage sheet) internal view returns (bool) {
        return sheet.reserved <= sheet.owed && sheet.reserved <= sheet.funded;
    }

    function _assertInvariant(ProtocolTypes.BalanceSheet storage sheet) private view {
        if (!isSound(sheet)) revert LedgerInvariantViolation();
    }
}
