// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @notice Test-only callback token that attempts to re-enter the protocol.
contract ReentrantERC20 is ERC20 {
    address public callbackTarget;
    bytes public callbackData;
    bool public callbackArmed;
    bool public callbackAttempted;
    bool public callbackSucceeded;
    bool private _insideCallback;

    constructor() ERC20("Callback Token", "CALL") {}

    function mint(address recipient, uint256 amount) external {
        _mint(recipient, amount);
    }

    function armCallback(address target, bytes calldata data) external {
        callbackTarget = target;
        callbackData = data;
        callbackArmed = true;
        callbackAttempted = false;
        callbackSucceeded = false;
    }

    function _update(address from, address to, uint256 value) internal override {
        if (callbackArmed && !_insideCallback && from != address(0) && to != address(0)) {
            _insideCallback = true;
            callbackAttempted = true;
            (callbackSucceeded,) = callbackTarget.call(callbackData);
            _insideCallback = false;
            callbackArmed = false;
        }
        super._update(from, to, value);
    }
}
