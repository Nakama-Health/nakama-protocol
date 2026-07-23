// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.28;

/// @notice Test-only contract with code but no ERC-20 metadata return values.
/// Asset registration must fail while decoding its empty fallback response.
contract MalformedMetadataToken {
    fallback() external {}
}
