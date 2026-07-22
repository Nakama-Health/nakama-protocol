// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.28;

import {NakamaCoverageProtocol} from "./NakamaCoverageProtocol.sol";
import {NakamaPolicyRegistry} from "./NakamaPolicyRegistry.sol";

/// @notice One-purpose constructor factory for the immutable registry/core
/// pair. Contract creation nonces start at one, so the registry is CREATE #1
/// and the core is CREATE #2. The deployed factory retains getters only.
contract NakamaProtocolFactory {
    error PairDeploymentMismatch();

    NakamaPolicyRegistry public immutable policyRegistry;
    NakamaCoverageProtocol public immutable protocol;

    constructor() {
        address predictedCore = _secondCreateAddress(address(this));
        NakamaPolicyRegistry registry_ = new NakamaPolicyRegistry(predictedCore);
        NakamaCoverageProtocol protocol_ = new NakamaCoverageProtocol(address(registry_));
        if (
            address(protocol_) != predictedCore || registry_.core() != address(protocol_)
                || address(protocol_.policyRegistry()) != address(registry_)
                || protocol_.deploymentFactory() != address(this)
        ) revert PairDeploymentMismatch();
        policyRegistry = registry_;
        protocol = protocol_;
    }

    function _secondCreateAddress(address deployer) private pure returns (address) {
        return address(uint160(uint256(keccak256(abi.encodePacked(hex"d694", deployer, hex"02")))));
    }
}
