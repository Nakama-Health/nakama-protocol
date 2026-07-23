// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.28;

import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {IERC1271} from "@openzeppelin/contracts/interfaces/IERC1271.sol";

/// @notice Test-only smart-account signer backed by one EOA owner. The owner
/// can make the account reject or revert signatures, covering fail-closed
/// ERC-1271 behavior without production wallet assumptions.
contract MockERC1271Reviewer is IERC1271 {
    bytes4 private constant MAGIC_VALUE = 0x1626ba7e;

    enum SignatureMode {
        ValidOwner,
        Invalid,
        RevertAlways
    }

    error Unauthorized();
    error SignatureValidationReverted();

    address public immutable owner;
    SignatureMode public signatureMode;

    constructor(address owner_) {
        owner = owner_;
    }

    function setSignatureMode(SignatureMode next) external {
        if (msg.sender != owner) revert Unauthorized();
        signatureMode = next;
    }

    function isValidSignature(bytes32 hash, bytes calldata signature) external view returns (bytes4) {
        if (signatureMode == SignatureMode.RevertAlways) revert SignatureValidationReverted();
        if (signatureMode == SignatureMode.Invalid) return bytes4(0xffffffff);
        return ECDSA.recover(hash, signature) == owner ? MAGIC_VALUE : bytes4(0xffffffff);
    }
}
