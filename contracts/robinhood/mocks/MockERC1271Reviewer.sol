// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.28;

import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {IERC1271} from "@openzeppelin/contracts/interfaces/IERC1271.sol";

/// @notice Test-only smart-account reviewer backed by one EOA owner.
contract MockERC1271Reviewer is IERC1271 {
    bytes4 private constant MAGIC_VALUE = 0x1626ba7e;
    address public immutable owner;

    constructor(address owner_) {
        owner = owner_;
    }

    function isValidSignature(bytes32 hash, bytes calldata signature) external view returns (bytes4) {
        return ECDSA.recover(hash, signature) == owner ? MAGIC_VALUE : bytes4(0xffffffff);
    }
}
