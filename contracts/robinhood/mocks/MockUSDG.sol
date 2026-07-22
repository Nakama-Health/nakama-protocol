// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @notice Local/test-only six-decimal stand-in. Never use this address in a
/// Robinhood deployment manifest.
contract MockUSDG is ERC20 {
    bool public transfersPaused;

    constructor() ERC20("Global Dollar", "USDG") {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address recipient, uint256 amount) external {
        _mint(recipient, amount);
    }

    function setTransfersPaused(bool paused) external {
        transfersPaused = paused;
    }

    function _update(address from, address to, uint256 value) internal override {
        if (transfersPaused && from != address(0) && to != address(0)) revert("USDG_TRANSFERS_PAUSED");
        super._update(from, to, value);
    }
}
