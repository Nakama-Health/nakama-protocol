// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.28;

/// @notice Test-only recipient that attempts a configured callback when a
/// callback-capable token invokes it during settlement.
contract MockReentrantRecipient {
    error CallbackFailed();

    address public target;
    bytes public data;

    function configure(address target_, bytes calldata data_) external {
        target = target_;
        data = data_;
    }

    function onTokenTransfer() external {
        (bool success,) = target.call(data);
        if (!success) revert CallbackFailed();
    }
}
