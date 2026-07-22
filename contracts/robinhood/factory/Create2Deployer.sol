// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.28;

/// @notice Small one-purpose CREATE2 primitive. Only its immutable factory may
/// deploy reviewed initcode; it retains no administration or call authority.
contract Create2Deployer {
    error OnlyFactory();
    error EmptyInitCode();
    error DeploymentFailed(bytes32 salt, bytes32 initCodeHash);

    address public immutable factory;

    constructor(address factory_) {
        factory = factory_;
    }

    function deploy(bytes32 salt, bytes calldata initCode) external returns (address deployed) {
        if (msg.sender != factory) revert OnlyFactory();
        if (initCode.length == 0) revert EmptyInitCode();
        bytes32 initCodeHash = keccak256(initCode);
        assembly ("memory-safe") {
            let pointer := mload(0x40)
            calldatacopy(pointer, initCode.offset, initCode.length)
            deployed := create2(0, pointer, initCode.length, salt)
        }
        if (deployed == address(0)) revert DeploymentFailed(salt, initCodeHash);
    }

    function computeAddress(bytes32 salt, bytes32 initCodeHash) external view returns (address) {
        return address(uint160(uint256(keccak256(abi.encodePacked(bytes1(0xff), address(this), salt, initCodeHash)))));
    }
}
