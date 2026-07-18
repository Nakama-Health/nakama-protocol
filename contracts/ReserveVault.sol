// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @notice Isolated custody for one domain and one ERC-20 asset.
/// @dev There is no owner or recovery role. Only the immutable protocol can
/// move assets, and every transfer must produce exact sender and recipient
/// balance deltas. Fee-on-transfer and rebasing behavior is intentionally
/// rejected because it would invalidate the reserve ledger.
contract ReserveVault {
    using SafeERC20 for IERC20;

    error OnlyProtocol();
    error InvalidAddress();
    error UnsupportedTokenBehavior(uint256 expected, uint256 senderDelta, uint256 recipientDelta);

    address public immutable protocol;
    bytes32 public immutable domainId;
    IERC20 public immutable assetToken;

    constructor(address protocol_, bytes32 domainId_, IERC20 assetToken_) {
        if (protocol_ == address(0) || domainId_ == bytes32(0) || address(assetToken_) == address(0)) {
            revert InvalidAddress();
        }
        protocol = protocol_;
        domainId = domainId_;
        assetToken = assetToken_;
    }

    modifier onlyProtocol() {
        if (msg.sender != protocol) revert OnlyProtocol();
        _;
    }

    function depositFrom(address payer, uint256 amount) external onlyProtocol {
        if (payer == address(0) || amount == 0) revert InvalidAddress();
        uint256 payerBefore = assetToken.balanceOf(payer);
        uint256 vaultBefore = assetToken.balanceOf(address(this));
        assetToken.safeTransferFrom(payer, address(this), amount);
        uint256 payerAfter = assetToken.balanceOf(payer);
        uint256 vaultAfter = assetToken.balanceOf(address(this));
        uint256 payerDelta = payerBefore >= payerAfter ? payerBefore - payerAfter : 0;
        uint256 vaultDelta = vaultAfter >= vaultBefore ? vaultAfter - vaultBefore : 0;
        if (payerDelta != amount || vaultDelta != amount) {
            revert UnsupportedTokenBehavior(amount, payerDelta, vaultDelta);
        }
    }

    function withdrawTo(address recipient, uint256 amount) external onlyProtocol {
        if (recipient == address(0) || recipient == address(this) || amount == 0) revert InvalidAddress();
        uint256 vaultBefore = assetToken.balanceOf(address(this));
        uint256 recipientBefore = assetToken.balanceOf(recipient);
        assetToken.safeTransfer(recipient, amount);
        uint256 vaultAfter = assetToken.balanceOf(address(this));
        uint256 recipientAfter = assetToken.balanceOf(recipient);
        uint256 vaultDelta = vaultBefore >= vaultAfter ? vaultBefore - vaultAfter : 0;
        uint256 recipientDelta = recipientAfter >= recipientBefore ? recipientAfter - recipientBefore : 0;
        if (vaultDelta != amount || recipientDelta != amount) {
            revert UnsupportedTokenBehavior(amount, vaultDelta, recipientDelta);
        }
    }
}
