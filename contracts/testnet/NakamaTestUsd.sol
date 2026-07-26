// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @notice Fixed-supply Robinhood testnet asset for protocol qualification.
/// @dev This token is not USDG, has no mainnet meaning, and cannot mint after
/// construction. Applications must label it as a test-only asset.
contract NakamaTestUsd is ERC20 {
    error InvalidInitialDistribution();

    constructor(address initialHolder, uint256 initialSupply) ERC20("Nakama Test USD", "tUSDG") {
        if (initialHolder == address(0) || initialSupply == 0) revert InvalidInitialDistribution();
        _mint(initialHolder, initialSupply);
    }

    function decimals() public pure override returns (uint8) {
        return 6;
    }
}
