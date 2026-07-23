// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @notice Test-only token that charges the sender in addition to the transfer
/// amount, proving both sides of the vault's exact-delta check are required.
contract SenderFeeUSDG is ERC20 {
    constructor() ERC20("Global Dollar", "USDG") {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address recipient, uint256 amount) external {
        _mint(recipient, amount);
    }

    function _update(address from, address to, uint256 value) internal override {
        if (from != address(0) && to != address(0) && value >= 100) {
            super._update(from, address(0), value / 100);
        }
        super._update(from, to, value);
    }
}
