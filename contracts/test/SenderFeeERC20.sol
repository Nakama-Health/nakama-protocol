// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @notice Test-only token that credits the requested transfer in full but
/// debits an additional fee from the sender. A receive-only delta check would
/// incorrectly accept this behavior.
contract SenderFeeERC20 is ERC20 {
    uint256 public constant FEE_BPS = 100;

    constructor() ERC20("Sender Fee Token", "SFEE") {}

    function mint(address recipient, uint256 amount) external {
        _mint(recipient, amount);
    }

    function transferFrom(address from, address to, uint256 value) public override returns (bool) {
        _spendAllowance(from, _msgSender(), value);
        _update(from, to, value);
        uint256 fee = value * FEE_BPS / 10_000;
        if (fee != 0) _update(from, address(0), fee);
        return true;
    }
}
