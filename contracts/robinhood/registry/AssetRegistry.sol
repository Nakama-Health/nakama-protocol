// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.28;

import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

import {RobinhoodTypes} from "../types/RobinhoodTypes.sol";

/// @notice Future-program allowlist for exact six-decimal Robinhood assets.
/// Deprecation never changes the asset bound to an existing program.
contract AssetRegistry {
    struct AssetRecord {
        bytes32 assetId;
        bytes32 nameHash;
        bytes32 symbolHash;
        bytes32 runtimeCodeHash;
        uint64 registeredAt;
        uint64 chainId;
        uint8 decimals;
        RobinhoodTypes.AssetStatus status;
    }

    error Unauthorized();
    error InvalidAddress();
    error InvalidCommitment();
    error InvalidAssetMetadata();
    error AssetAlreadyRegistered(address token);
    error AssetNotRegistered(address token);
    error AssetNotActive(address token, RobinhoodTypes.AssetStatus status);

    event AssetRegistered(
        address indexed token,
        bytes32 indexed assetId,
        bytes32 nameHash,
        bytes32 symbolHash,
        bytes32 runtimeCodeHash
    );
    event AssetStatusChanged(address indexed token, RobinhoodTypes.AssetStatus previous, RobinhoodTypes.AssetStatus next);
    event AuthorityTransferStarted(address indexed currentAuthority, address indexed pendingAuthority);
    event AuthorityTransferred(address indexed previousAuthority, address indexed newAuthority);

    address public authority;
    address public pendingAuthority;
    mapping(address token => AssetRecord record) private _assets;

    constructor(address authority_) {
        if (authority_ == address(0)) revert InvalidAddress();
        authority = authority_;
    }

    modifier onlyAuthority() {
        if (msg.sender != authority) revert Unauthorized();
        _;
    }

    function registerAsset(
        address token,
        bytes32 assetId,
        bytes32 expectedNameHash,
        bytes32 expectedSymbolHash
    ) external onlyAuthority {
        if (token == address(0) || token.code.length == 0) revert InvalidAddress();
        if (assetId == bytes32(0) || expectedNameHash == bytes32(0) || expectedSymbolHash == bytes32(0)) {
            revert InvalidCommitment();
        }
        if (_assets[token].status != RobinhoodTypes.AssetStatus.Unregistered) revert AssetAlreadyRegistered(token);

        IERC20Metadata metadata = IERC20Metadata(token);
        bytes32 actualNameHash;
        bytes32 actualSymbolHash;
        uint8 actualDecimals;
        try metadata.name() returns (string memory name_) {
            actualNameHash = keccak256(bytes(name_));
        } catch {
            revert InvalidAssetMetadata();
        }
        try metadata.symbol() returns (string memory symbol_) {
            actualSymbolHash = keccak256(bytes(symbol_));
        } catch {
            revert InvalidAssetMetadata();
        }
        try metadata.decimals() returns (uint8 decimals_) {
            actualDecimals = decimals_;
        } catch {
            revert InvalidAssetMetadata();
        }
        if (actualNameHash != expectedNameHash || actualSymbolHash != expectedSymbolHash || actualDecimals != 6) {
            revert InvalidAssetMetadata();
        }

        bytes32 runtimeCodeHash = token.codehash;
        _assets[token] = AssetRecord({
            assetId: assetId,
            nameHash: actualNameHash,
            symbolHash: actualSymbolHash,
            runtimeCodeHash: runtimeCodeHash,
            registeredAt: uint64(block.timestamp),
            chainId: uint64(block.chainid),
            decimals: actualDecimals,
            status: RobinhoodTypes.AssetStatus.Active
        });
        emit AssetRegistered(token, assetId, actualNameHash, actualSymbolHash, runtimeCodeHash);
    }

    function setAssetStatus(address token, RobinhoodTypes.AssetStatus next) external onlyAuthority {
        AssetRecord storage record = _assets[token];
        RobinhoodTypes.AssetStatus previous = record.status;
        if (previous == RobinhoodTypes.AssetStatus.Unregistered) revert AssetNotRegistered(token);
        if (next == RobinhoodTypes.AssetStatus.Unregistered || next == previous) revert InvalidAssetMetadata();
        record.status = next;
        emit AssetStatusChanged(token, previous, next);
    }

    function requireActiveAsset(address token) external view returns (AssetRecord memory record) {
        record = _assets[token];
        if (record.status != RobinhoodTypes.AssetStatus.Active) revert AssetNotActive(token, record.status);
        if (record.chainId != block.chainid || token.codehash != record.runtimeCodeHash) revert InvalidAssetMetadata();

        IERC20Metadata metadata = IERC20Metadata(token);
        try metadata.name() returns (string memory name_) {
            if (keccak256(bytes(name_)) != record.nameHash) revert InvalidAssetMetadata();
        } catch {
            revert InvalidAssetMetadata();
        }
        try metadata.symbol() returns (string memory symbol_) {
            if (keccak256(bytes(symbol_)) != record.symbolHash) revert InvalidAssetMetadata();
        } catch {
            revert InvalidAssetMetadata();
        }
        try metadata.decimals() returns (uint8 decimals_) {
            if (decimals_ != record.decimals || decimals_ != 6) revert InvalidAssetMetadata();
        } catch {
            revert InvalidAssetMetadata();
        }
    }

    function getAsset(address token) external view returns (AssetRecord memory) {
        return _assets[token];
    }

    function beginAuthorityTransfer(address nextAuthority) external onlyAuthority {
        if (nextAuthority == address(0) || nextAuthority == authority) revert InvalidAddress();
        pendingAuthority = nextAuthority;
        emit AuthorityTransferStarted(authority, nextAuthority);
    }

    function acceptAuthority() external {
        if (msg.sender != pendingAuthority) revert Unauthorized();
        address previous = authority;
        authority = msg.sender;
        pendingAuthority = address(0);
        emit AuthorityTransferred(previous, msg.sender);
    }
}
