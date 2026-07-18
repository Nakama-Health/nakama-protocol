// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @notice Test-only token used to prove exact-delta custody rejects transfer fees.
contract FeeOnTransferERC20 is ERC20 {
    uint256 public constant FEE_BPS = 100;

    constructor() ERC20("Fee Token", "FEE") {}

    function mint(address recipient, uint256 amount) external {
        _mint(recipient, amount);
    }

    function _update(address from, address to, uint256 value) internal override {
        if (from != address(0) && to != address(0)) {
            uint256 fee = value * FEE_BPS / 10_000;
            if (fee != 0) {
                super._update(from, address(0), fee);
                super._update(from, to, value - fee);
                return;
            }
        }
        super._update(from, to, value);
    }
}
