// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.28;

import {AgentAuthorizationRegistry} from "../authority/AgentAuthorizationRegistry.sol";
import {DecisionModule} from "../authority/DecisionModule.sol";
import {SafetyGuardian} from "../authority/SafetyGuardian.sol";
import {PoolVault} from "../finance/PoolVault.sol";
import {SettlementModule} from "../finance/SettlementModule.sol";
import {ClaimManager} from "../program/ClaimManager.sol";
import {MembershipRegistry} from "../program/MembershipRegistry.sol";
import {ProtectionProgram} from "../program/ProtectionProgram.sol";
import {AssetRegistry} from "../registry/AssetRegistry.sol";
import {PoolRegistry} from "../registry/PoolRegistry.sol";
import {TemplateRegistry} from "../registry/TemplateRegistry.sol";
import {RobinhoodTypes} from "../types/RobinhoodTypes.sol";
import {Create2Deployer} from "./Create2Deployer.sol";

/// @notice Version-pinned deterministic factory for reviewed Robinhood Phase 0
/// programs. Component creation bytecode is supplied by the caller and must
/// match the immutable reviewed hashes, keeping factory runtime deployable.
contract NakamaFactory {
    struct ComponentBytecodes {
        bytes protectionProgram;
        bytes poolVault;
        bytes membershipRegistry;
        bytes decisionModule;
        bytes claimManager;
        bytes settlementModule;
        bytes agentAuthorizationRegistry;
        bytes safetyGuardian;
    }

    error Unauthorized();
    error InvalidAddress();
    error InvalidSalt();
    error FundingAssetMismatch(address expected, address actual);
    error FundingAssetIdentityChanged();
    error InvalidBytecode(uint8 component, bytes32 expected, bytes32 actual);
    error DeploymentAddressMismatch(uint8 component, address expected, address actual);
    error InvalidRole(uint8 roleIndex, address role);
    error DuplicateRole(uint8 firstRoleIndex, uint8 secondRoleIndex, address role);
    error IncompatibleSuiteVersion(uint32 expectedMajor, uint32 actualMajor);

    event ProgramSuiteDeployed(
        bytes32 indexed programId,
        bytes32 indexed suiteId,
        address indexed sponsor,
        address program,
        address vault,
        address membershipRegistry,
        address decisionModule,
        address claimManager,
        address settlementModule,
        address agentAuthorizationRegistry,
        address safetyGuardian
    );

    uint8 private constant PROGRAM_COMPONENT = 0;
    uint8 private constant VAULT_COMPONENT = 1;
    uint8 private constant MEMBERSHIP_COMPONENT = 2;
    uint8 private constant DECISION_COMPONENT = 3;
    uint8 private constant CLAIM_COMPONENT = 4;
    uint8 private constant SETTLEMENT_COMPONENT = 5;
    uint8 private constant AGENT_COMPONENT = 6;
    uint8 private constant GUARDIAN_COMPONENT = 7;
    uint32 public constant SUITE_MAJOR_VERSION = 2;
    bytes32 private constant PROGRAM_ID_NAMESPACE = keccak256("NAKAMA_ROBINHOOD_PROGRAM_V2");

    AssetRegistry public immutable assetRegistry;
    TemplateRegistry public immutable templateRegistry;
    address public immutable expectedFundingAsset;
    bytes32 public immutable expectedFundingAssetId;
    bytes32 public immutable expectedFundingAssetNameHash;
    bytes32 public immutable expectedFundingAssetSymbolHash;
    bytes32 public immutable expectedFundingAssetRuntimeCodeHash;
    PoolRegistry public immutable poolRegistry;
    Create2Deployer public immutable create2Deployer;
    bytes32 public immutable deploymentCodeCommitment;
    bytes32[8] private _componentCreationCodeHashes;

    constructor(
        address assetRegistry_,
        address templateRegistry_,
        address expectedFundingAsset_,
        bytes32[8] memory componentCreationCodeHashes_
    ) {
        if (assetRegistry_ == address(0) || templateRegistry_ == address(0) || expectedFundingAsset_ == address(0)) {
            revert InvalidAddress();
        }
        for (uint256 i; i < componentCreationCodeHashes_.length; ++i) {
            if (componentCreationCodeHashes_[i] == bytes32(0)) revert InvalidBytecode(uint8(i), bytes32(0), bytes32(0));
            _componentCreationCodeHashes[i] = componentCreationCodeHashes_[i];
        }
        assetRegistry = AssetRegistry(assetRegistry_);
        templateRegistry = TemplateRegistry(templateRegistry_);
        AssetRegistry.AssetRecord memory fundingAssetRecord =
            AssetRegistry(assetRegistry_).requireActiveAsset(expectedFundingAsset_);
        expectedFundingAsset = expectedFundingAsset_;
        expectedFundingAssetId = fundingAssetRecord.assetId;
        expectedFundingAssetNameHash = fundingAssetRecord.nameHash;
        expectedFundingAssetSymbolHash = fundingAssetRecord.symbolHash;
        expectedFundingAssetRuntimeCodeHash = fundingAssetRecord.runtimeCodeHash;
        poolRegistry = new PoolRegistry();
        create2Deployer = new Create2Deployer(address(this));
        deploymentCodeCommitment = keccak256(abi.encode(componentCreationCodeHashes_));
    }

    function componentCreationCodeHash(uint256 component) external view returns (bytes32) {
        return _componentCreationCodeHashes[component];
    }

    function deriveProgramId(address sponsor, bytes32 suiteId, bytes32 salt) public view returns (bytes32) {
        return keccak256(abi.encode(PROGRAM_ID_NAMESPACE, block.chainid, address(this), sponsor, suiteId, salt));
    }

    function deployProgram(
        bytes32 suiteId,
        bytes32 salt,
        RobinhoodTypes.ProgramConfig calldata config,
        RobinhoodTypes.RoleConfig calldata roles,
        ComponentBytecodes calldata bytecodes
    ) external returns (RobinhoodTypes.ProgramDeployment memory deployment) {
        if (msg.sender != roles.sponsor) revert Unauthorized();
        if (salt == bytes32(0)) revert InvalidSalt();
        _validateRoles(config.fundingAsset, roles);
        _requireExpectedFundingAsset(config.fundingAsset);
        _requireCompatibleSuite(suiteId);
        _verifyBytecodes(bytecodes);
        deployment = _deploymentAddresses(suiteId, salt, config, roles, bytecodes);

        _deployComponent(
            PROGRAM_COMPONENT,
            _componentSalt(deployment.programId, PROGRAM_COMPONENT),
            abi.encodePacked(
                bytecodes.protectionProgram,
                abi.encode(address(this), deployment.programId, suiteId, config, roles)
            ),
            deployment.program
        );
        _deployComponent(
            VAULT_COMPONENT,
            _componentSalt(deployment.programId, VAULT_COMPONENT),
            abi.encodePacked(
                bytecodes.poolVault,
                abi.encode(
                    address(this),
                    deployment.program,
                    roles.sponsor,
                    config.fundingAsset,
                    deployment.programId,
                    config.aggregateCap
                )
            ),
            deployment.vault
        );
        _deployComponent(
            MEMBERSHIP_COMPONENT,
            _componentSalt(deployment.programId, MEMBERSHIP_COMPONENT),
            abi.encodePacked(
                bytecodes.membershipRegistry, abi.encode(address(this), deployment.program, deployment.vault)
            ),
            deployment.membershipRegistry
        );
        _deployComponent(
            DECISION_COMPONENT,
            _componentSalt(deployment.programId, DECISION_COMPONENT),
            abi.encodePacked(bytecodes.decisionModule, abi.encode(address(this), deployment.program)),
            deployment.decisionModule
        );
        _deployComponent(
            CLAIM_COMPONENT,
            _componentSalt(deployment.programId, CLAIM_COMPONENT),
            abi.encodePacked(
                bytecodes.claimManager,
                abi.encode(
                    address(this),
                    deployment.program,
                    deployment.vault,
                    deployment.membershipRegistry,
                    deployment.decisionModule
                )
            ),
            deployment.claimManager
        );
        _deployComponent(
            SETTLEMENT_COMPONENT,
            _componentSalt(deployment.programId, SETTLEMENT_COMPONENT),
            abi.encodePacked(
                bytecodes.settlementModule,
                abi.encode(deployment.program, deployment.vault, deployment.claimManager)
            ),
            deployment.settlementModule
        );
        _deployComponent(
            AGENT_COMPONENT,
            _componentSalt(deployment.programId, AGENT_COMPONENT),
            abi.encodePacked(
                bytecodes.agentAuthorizationRegistry,
                abi.encode(
                    address(this),
                    deployment.program,
                    deployment.vault,
                    deployment.decisionModule,
                    deployment.settlementModule
                )
            ),
            deployment.agentAuthorizationRegistry
        );
        _deployComponent(
            GUARDIAN_COMPONENT,
            _componentSalt(deployment.programId, GUARDIAN_COMPONENT),
            abi.encodePacked(
                bytecodes.safetyGuardian,
                abi.encode(deployment.program, deployment.agentAuthorizationRegistry)
            ),
            deployment.safetyGuardian
        );

        ProtectionProgram(deployment.program).bindModules(deployment);
        PoolVault(deployment.vault).bindModules(
            deployment.membershipRegistry, deployment.claimManager, deployment.settlementModule
        );
        MembershipRegistry(deployment.membershipRegistry).bindClaimManager(deployment.claimManager);
        DecisionModule(deployment.decisionModule).bindClaimManager(deployment.claimManager);
        ClaimManager(deployment.claimManager).bindSettlementModule(deployment.settlementModule);
        AgentAuthorizationRegistry(deployment.agentAuthorizationRegistry).bindSafetyGuardian(
            deployment.safetyGuardian
        );
        poolRegistry.registerProgram(suiteId, roles.sponsor, deployment);
        emit ProgramSuiteDeployed(
            deployment.programId,
            suiteId,
            roles.sponsor,
            deployment.program,
            deployment.vault,
            deployment.membershipRegistry,
            deployment.decisionModule,
            deployment.claimManager,
            deployment.settlementModule,
            deployment.agentAuthorizationRegistry,
            deployment.safetyGuardian
        );
    }

    function predictDeployment(
        bytes32 suiteId,
        bytes32 salt,
        RobinhoodTypes.ProgramConfig calldata config,
        RobinhoodTypes.RoleConfig calldata roles,
        ComponentBytecodes calldata bytecodes
    ) external view returns (RobinhoodTypes.ProgramDeployment memory deployment) {
        if (salt == bytes32(0)) revert InvalidSalt();
        _validateRoles(config.fundingAsset, roles);
        _requireExpectedFundingAsset(config.fundingAsset);
        _requireCompatibleSuite(suiteId);
        _verifyBytecodes(bytecodes);
        deployment = _deploymentAddresses(suiteId, salt, config, roles, bytecodes);
    }

    function _requireExpectedFundingAsset(address fundingAsset) private view {
        if (fundingAsset != expectedFundingAsset) {
            revert FundingAssetMismatch(expectedFundingAsset, fundingAsset);
        }
        AssetRegistry.AssetRecord memory assetRecord = assetRegistry.requireActiveAsset(fundingAsset);
        if (
            assetRecord.decimals != 6 || assetRecord.chainId != block.chainid
                || assetRecord.assetId != expectedFundingAssetId || assetRecord.nameHash != expectedFundingAssetNameHash
                || assetRecord.symbolHash != expectedFundingAssetSymbolHash
                || assetRecord.runtimeCodeHash != expectedFundingAssetRuntimeCodeHash
        ) revert FundingAssetIdentityChanged();
    }

    function _requireCompatibleSuite(bytes32 suiteId) private view {
        TemplateRegistry.SuiteRecord memory suite = templateRegistry.requireActiveSuite(suiteId, address(this));
        if (suite.major != SUITE_MAJOR_VERSION) {
            revert IncompatibleSuiteVersion(SUITE_MAJOR_VERSION, suite.major);
        }
        if (suite.deploymentCodeCommitment != deploymentCodeCommitment) {
            revert InvalidBytecode(255, suite.deploymentCodeCommitment, deploymentCodeCommitment);
        }
    }

    /// @dev Sponsor, operator, both reviewers, settlement, and guardian are
    /// six independent authorities. Eligibility attestation may be performed
    /// by sponsor or operator, but never by a reviewer, settlement, or guardian.
    /// Arbitrary smart accounts remain valid roles; only suite infrastructure
    /// contracts, which cannot perform a role, are rejected as incompatible.
    function _validateRoles(address fundingAsset, RobinhoodTypes.RoleConfig calldata roles) private view {
        address[7] memory values = [
            roles.sponsor,
            roles.operator,
            roles.initialReviewer,
            roles.appealReviewer,
            roles.settlement,
            roles.guardian,
            roles.eligibilityAttestor
        ];
        for (uint8 i; i < values.length; ++i) {
            address role = values[i];
            if (_isIncompatibleRole(role, fundingAsset)) revert InvalidRole(i, role);
            for (uint8 j; j < i; ++j) {
                if (role != values[j]) continue;
                bool allowedEligibilityOverlap = i == 6 && (j == 0 || j == 1);
                if (!allowedEligibilityOverlap) revert DuplicateRole(j, i, role);
            }
        }
    }

    function _isIncompatibleRole(address role, address fundingAsset) private view returns (bool) {
        return role == address(0) || role == fundingAsset || role == address(this)
            || role == address(assetRegistry) || role == address(templateRegistry)
            || role == address(poolRegistry) || role == address(create2Deployer);
    }

    function _deploymentAddresses(
        bytes32 suiteId,
        bytes32 salt,
        RobinhoodTypes.ProgramConfig calldata config,
        RobinhoodTypes.RoleConfig calldata roles,
        ComponentBytecodes calldata bytecodes
    ) private view returns (RobinhoodTypes.ProgramDeployment memory deployment) {
        deployment.programId = deriveProgramId(roles.sponsor, suiteId, salt);
        deployment.program = _predict(
            deployment.programId,
            PROGRAM_COMPONENT,
            abi.encodePacked(
                bytecodes.protectionProgram,
                abi.encode(address(this), deployment.programId, suiteId, config, roles)
            )
        );
        deployment.vault = _predict(
            deployment.programId,
            VAULT_COMPONENT,
            abi.encodePacked(
                bytecodes.poolVault,
                abi.encode(
                    address(this),
                    deployment.program,
                    roles.sponsor,
                    config.fundingAsset,
                    deployment.programId,
                    config.aggregateCap
                )
            )
        );
        deployment.membershipRegistry = _predict(
            deployment.programId,
            MEMBERSHIP_COMPONENT,
            abi.encodePacked(
                bytecodes.membershipRegistry, abi.encode(address(this), deployment.program, deployment.vault)
            )
        );
        deployment.decisionModule = _predict(
            deployment.programId,
            DECISION_COMPONENT,
            abi.encodePacked(bytecodes.decisionModule, abi.encode(address(this), deployment.program))
        );
        deployment.claimManager = _predict(
            deployment.programId,
            CLAIM_COMPONENT,
            abi.encodePacked(
                bytecodes.claimManager,
                abi.encode(
                    address(this),
                    deployment.program,
                    deployment.vault,
                    deployment.membershipRegistry,
                    deployment.decisionModule
                )
            )
        );
        deployment.settlementModule = _predict(
            deployment.programId,
            SETTLEMENT_COMPONENT,
            abi.encodePacked(
                bytecodes.settlementModule,
                abi.encode(deployment.program, deployment.vault, deployment.claimManager)
            )
        );
        deployment.agentAuthorizationRegistry = _predict(
            deployment.programId,
            AGENT_COMPONENT,
            abi.encodePacked(
                bytecodes.agentAuthorizationRegistry,
                abi.encode(
                    address(this),
                    deployment.program,
                    deployment.vault,
                    deployment.decisionModule,
                    deployment.settlementModule
                )
            )
        );
        deployment.safetyGuardian = _predict(
            deployment.programId,
            GUARDIAN_COMPONENT,
            abi.encodePacked(
                bytecodes.safetyGuardian,
                abi.encode(deployment.program, deployment.agentAuthorizationRegistry)
            )
        );
    }

    function _verifyBytecodes(ComponentBytecodes calldata bytecodes) private view {
        _verifyBytecode(PROGRAM_COMPONENT, bytecodes.protectionProgram);
        _verifyBytecode(VAULT_COMPONENT, bytecodes.poolVault);
        _verifyBytecode(MEMBERSHIP_COMPONENT, bytecodes.membershipRegistry);
        _verifyBytecode(DECISION_COMPONENT, bytecodes.decisionModule);
        _verifyBytecode(CLAIM_COMPONENT, bytecodes.claimManager);
        _verifyBytecode(SETTLEMENT_COMPONENT, bytecodes.settlementModule);
        _verifyBytecode(AGENT_COMPONENT, bytecodes.agentAuthorizationRegistry);
        _verifyBytecode(GUARDIAN_COMPONENT, bytecodes.safetyGuardian);
    }

    function _verifyBytecode(uint8 component, bytes calldata creationCode) private view {
        bytes32 actual = keccak256(creationCode);
        bytes32 expected = _componentCreationCodeHashes[component];
        if (actual != expected) revert InvalidBytecode(component, expected, actual);
    }

    function _deployComponent(uint8 component, bytes32 salt, bytes memory initCode, address expected) private {
        address deployed = create2Deployer.deploy(salt, initCode);
        if (deployed != expected) revert DeploymentAddressMismatch(component, expected, deployed);
    }

    function _predict(bytes32 programId, uint8 component, bytes memory initCode) private view returns (address) {
        return create2Deployer.computeAddress(_componentSalt(programId, component), keccak256(initCode));
    }

    function _componentSalt(bytes32 programId, uint8 component) private pure returns (bytes32) {
        return keccak256(abi.encode(programId, component));
    }
}
