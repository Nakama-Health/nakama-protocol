// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface INakamaClaimCore {
    function activatePolicyPosition(bytes32 seriesId, bytes32[] calldata eligibilityProof)
        external
        returns (bytes32 positionId);

    function openClaimCase(
        bytes32 positionId,
        bytes32 claimCommitment,
        bytes32 nullifier,
        address payoutRecipient,
        uint256 requestedAmount
    ) external returns (bytes32 claimId);
}

/// @notice Test-only contract claimant that proves ERC-1271 validation remains
/// read-only even when the wallet tries to call back into an authorized claim
/// mutation. The ABI deliberately remains ERC-1271-compatible while the
/// function is non-view, so OpenZeppelin's outer STATICCALL is what prevents
/// the ordinary callback below from mutating state.
contract ERC1271Claimant {
    bytes4 private constant MAGIC_VALUE = 0x1626ba7e;
    bytes32 private constant VALID_SIGNATURE_HASH = keccak256("nakama-valid-erc1271-signature");

    address public immutable owner;
    bytes32 public expectedDigest;
    address public callbackTarget;
    bytes public callbackData;

    error OnlyOwner();

    constructor(address owner_) {
        owner = owner_;
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert OnlyOwner();
        _;
    }

    function approveAsset(IERC20 token, address spender, uint256 amount) external onlyOwner {
        token.approve(spender, amount);
    }

    function activate(address core, bytes32 seriesId, bytes32[] calldata proof) external onlyOwner {
        INakamaClaimCore(core).activatePolicyPosition(seriesId, proof);
    }

    function openClaim(
        address core,
        bytes32 positionId,
        bytes32 claimCommitment,
        bytes32 nullifier,
        address payoutRecipient,
        uint256 requestedAmount
    ) external onlyOwner {
        INakamaClaimCore(core).openClaimCase(
            positionId, claimCommitment, nullifier, payoutRecipient, requestedAmount
        );
    }

    function configureValidation(bytes32 digest, address target, bytes calldata data)
        external
        onlyOwner
    {
        expectedDigest = digest;
        callbackTarget = target;
        callbackData = data;
    }

    function validSignature() external pure returns (bytes memory) {
        return bytes("nakama-valid-erc1271-signature");
    }

    function executeCallback() external onlyOwner returns (bool success) {
        bytes memory returndata;
        (success, returndata) = callbackTarget.call(callbackData);
        if (!success) {
            assembly ("memory-safe") {
                revert(add(returndata, 0x20), mload(returndata))
            }
        }
    }

    function isValidSignature(bytes32 hash, bytes calldata signature) external returns (bytes4) {
        if (hash != expectedDigest || keccak256(signature) != VALID_SIGNATURE_HASH) {
            return bytes4(0xffffffff);
        }
        (bool callbackSucceeded,) = callbackTarget.call(callbackData);
        if (callbackSucceeded) return bytes4(0xffffffff);
        return MAGIC_VALUE;
    }
}
