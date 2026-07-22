# Scripts

This directory contains the repository's command-line helpers.

## Categories

### Verification

- `ethereum_mainnet_preflight.mjs` validates the approved source, four-contract artifact set, signer, Ethereum chain ID, deployer balance, reconciled signer nonce, latest block gas limit, the exact factory deployment estimate against EIP-7825, every EIP-170 runtime, and every EIP-3860 initcode size without sending a transaction
- `check_public_repo_hygiene.mjs` blocks tracked secrets, local artifacts, and private references
- `check_semantic_readiness.mjs` blocks retired pool-era language from active protocol, audit, script, and documentation surfaces
- `check_dependency_licenses.mjs` audits npm and Cargo dependency licenses
- `check_protocol_contract.mjs` verifies that generated protocol artifacts are in sync
- `protocol_workbench_mobile_sidebar_smoke.ts` boots the local frontend and verifies the closed mobile workbench drawer stays out of tab order while the open drawer traps focus and makes the workbench frame inert
- `check_beta_consistency.mjs` and `check_mvp_consistency.mjs` validate protocol consistency assumptions
- `doctor.mjs` runs local environment sanity checks

### Localnet E2E

- `run_localnet_e2e.mjs` boots a fresh local validator and runs the deterministic localnet scenario audit

### Generation

- `generate_ethereum_contract.mjs` produces the schema-v3 factory/core/registry/vault artifact at `shared/ethereum/protocol_contract.json` and four standalone ABIs
- `generate_robinhood_contract.mjs` produces the Robinhood Phase 0 twelve-contract artifact at `shared/robinhood/protocol_contract.json`, including deterministic component hashes, twelve standalone ABIs, and the last committed revision containing the exact contract-source tree; generation fails while those source paths are dirty, untracked, or ignored
- `generate_protocol_contract.ts` regenerates checked-in shared artifacts
- `generate_schema_metadata_hash.ts` and `generate_outcome_rule_hashes.ts` regenerate deterministic schema-related outputs
- `generate_standard_health_outcomes_schema.ts` rebuilds the standard schema definition

### Program build helpers

- `anchor_build_with_stack_gate.mjs` wraps program builds with stack-usage checks
- `anchor_test_with_stack_gate.mjs` does the same for Anchor tests

### Ethereum mainnet release

- `deploy_ethereum_mainnet.ts` rejects unreconciled signer transactions, journals the signer nonce, predicted factory/registry/core addresses, factory initcode hash and aggregate artifact digest before broadcast, then sends one nonce-pinned immutable `NakamaProtocolFactory` transaction; the factory creates the policy registry at nonce 1 and custody core at nonce 2, then retains getters only
- `promote_ethereum_mainnet_manifest.mjs` independently verifies the audited factory receipt, derived child addresses, immutable cross-bindings, three live runtimes, and three fixed Sourcify v2 exact matches, then binds all four exact SDK ABIs into the final manifest
- `lib/ethereum_deploy_guard.mjs` validates operator-supplied deployment intent, source, release approval, signer, balance, network, every runtime size, and every initcode size
- `lib/ethereum_release_preflight.mjs` binds a clean git checkout to all four compiled artifacts and ABIs, the aggregate generated artifact, audit digest, approval digest, and reviewed operator-local release manifest
- `lib/ethereum_manifest_promotion.mjs` validates both deployment stages and emits the SDK's canonical `status: deployed`, `verified: true`, `auditStatus: audited` field set

### Robinhood Chain testnet

- `deploy_robinhood_testnet.ts` deploys one fully bound but unfunded Phase 0 suite only after an explicit testnet confirmation, exact chain/USDG validation, and a public-safe operator-local configuration file; it writes no secrets and prints an unverified deployment receipt for independent readback

### Robinhood Chain mainnet planning

- `plan_robinhood_mainnet.mjs` is an offline-only deterministic planner. It requires an operator-local program config and release-evidence packet, checks the exact committed source revision, artifact hash, component bytecodes, USDG identity, independent approval identities, program bounds, and deployer nonce, then prints predicted global and CREATE2 addresses without loading an RPC URL, signer, or private key. It rejects `--broadcast`; there is no mainnet deployment implementation in this lane.

### Devnet and operator workflows

- `bootstrap_governance_realms.ts` provisions governance state
- `bootstrap_protocol.ts` writes the canonical hard-break devnet migration manifest and env exports
- `bootstrap_devnet_live_protocol.ts` seeds the canonical shared-devnet plan/capital/oracle graph and advertises schema hashes through oracle profiles
- `bootstrap_genesis_live_protocol.ts` seeds the real Genesis Protect Acute launch surface from explicit live inputs instead of the baked devnet fixture matrix
- `bootstrap_devnet_frontend_parity.ts` syncs canonical fixture env values and writes `frontend/public/devnet-fixtures.json`
- `devnet_beta_observability.ts` collects structured devnet observability output
- `devnet_frontend_role_smoke.ts` validates the canonical fixture matrix in smoke or strict mode
- `devnet_governance_smoke.ts` runs the shared-devnet native governance smoke in `create-vote` and `execute` phases
- `devnet_governance_ui_readonly.ts` boots the local frontend and verifies readonly governance routes against devnet data
- `devnet_operator_drawer_sim.ts` simulates the mounted operator drawer transactions against devnet and fails on real builder/wiring mismatches such as membership proof-mode or gate-configuration errors
- `seed_devnet_treasury_canaries.ts` seeds devnet treasury pen-test canary state; with the local operator signer it creates a linked-claim obligation canary, and with `OMEGAX_DEVNET_PROTOCOL_GOVERNANCE_KEYPAIR_PATH` it can also seed governance-gated fee-vault and LP-redemption canaries
- `deploy_devnet_beta.ts` runs the checked build, artifact parity, and canonical manifest/bootstrap preparation for the hard-break migration
- `governance_schema_state_update.ts` exits with migration guidance because on-chain schema-state governance has been removed

## Usage guidance

- Prefer package scripts from the repository root when they exist.
- Use `npm run ethereum:test` for the Solidity and deployment-guard suite, `npm run ethereum:contract` to regenerate the canonical four-ABI artifact set, and `npm run ethereum:contract:check` to reject stale artifacts.
- Use `npm run robinhood:test` for the Robinhood Phase 0 suite and `npm run robinhood:contract` after any `contracts/robinhood/` change. `robinhood:contract:check` is part of the public gate so SDK ABIs cannot silently drift.
- Robinhood artifact generation requires every `contracts/robinhood/**/*.sol` file and `hardhat.config.ts` to be tracked and committed. Ignored source files are rejected explicitly rather than silently omitted. The recorded `sourceCommit` is the newest ancestor that contains the exact current source tree, so a later artifact-only commit does not create a self-referential `HEAD` provenance claim.
- `npm run robinhood:deploy:testnet` is transaction-producing operator tooling. It requires `ROBINHOOD_TESTNET_RPC_URL`, `ROBINHOOD_TESTNET_PRIVATE_KEY`, `ROBINHOOD_TESTNET_USDG_ADDRESS`, `NAKAMA_ROBINHOOD_TESTNET_CONFIG`, and the exact confirmation `DEPLOY_UNFUNDED_NAKAMA_PHASE0_TO_ROBINHOOD_TESTNET`. Never use the mock USDG address outside local tests.
- Use `npm run robinhood:deploy:mainnet:plan -- --config <operator-local-config.json> --evidence <operator-local-evidence.json>` only for offline review. The checked-in examples contain invalid placeholders by design. A successful plan authenticates no evidence and authorizes no transaction; independent live chain, USDG proxy, signer, audit, approval, source-verification, finality, and post-deployment readback gates still apply.
- Use `npm run ethereum:deploy:preflight` before any mainnet action. It requires the ignored, operator-local `deployments/ethereum-mainnet.release.json`, performs read-only network checks, and never submits a transaction. Commit the source and generated artifact first, then populate the local manifest with that existing HEAD; only `ethereum-mainnet.release.example.json` is tracked.
- `npm run ethereum:deploy:mainnet` is intentionally unavailable until the checkout is clean and the following variables exactly match the reviewed release: `ETHEREUM_MAINNET_RPC_URL`, `ETHEREUM_MAINNET_PRIVATE_KEY`, `NAKAMA_MAINNET_EXPECTED_DEPLOYER`, `NAKAMA_MAINNET_SOURCE_COMMIT`, `NAKAMA_MAINNET_AUDIT_REPORT_SHA256`, `NAKAMA_MAINNET_RELEASE_APPROVAL_SHA256`, `NAKAMA_MAINNET_CONFIRMATIONS`, `NAKAMA_MAINNET_MIN_DEPLOYER_BALANCE_WEI`, and `NAKAMA_MAINNET_DEPLOY_CONFIRMATION`.
- The confirmation value must be `DEPLOY_IMMUTABLE_NAKAMA_COVERAGE_PROTOCOL_TO_ETHEREUM_MAINNET`. Keep private keys in the operator's environment or secret store, never in a tracked file.
- Mainnet deployment requires at least 12 confirmations. Its JSON is deliberately intermediate: `status: deployed-unverified`, `verified: false`, and `auditStatus: audited`; it records factory, policy-registry, and core addresses but must never be published as the final SDK manifest. `ReserveVault` is recorded only as a deterministic per-domain CREATE2 template because no single launch vault exists.
- Promote only after Sourcify v2 reports exact creation and runtime matches for the factory, registry, and core. Run `ETHEREUM_MAINNET_RPC_URL=<credential-free-URL> npm run ethereum:manifest:promote -- --deployment <intermediate-json> --sdk-abi-dir <directory-containing-four-ABIs>`. The production Sourcify host and path are fixed; no operator-supplied verification URL is accepted.
- Promotion rereads the factory transaction and creation input, receipt, canonical block, safe/finalized heads, historical and latest code at all three live addresses, nonce-derived child identities, immutable cross-getters, normalized templates, and exact live hashes from chain 1. It emits the schema in `deployments/ethereum-mainnet.final.schema.json`; the SDK repeats these checks before accepting it.
- Use `npm run verify:public` for the public release gate.
- Use `npm run frontend:workbench:mobile-sidebar:smoke` for the targeted mobile drawer accessibility smoke.
- Use `SOLANA_KEYPAIR=<devnet governance keypair> npm run devnet:operator:drawer:sim` for the targeted plan/governance operator drawer transaction smoke; the signer must match `NEXT_PUBLIC_DEVNET_PROTOCOL_GOVERNANCE_WALLET`, and the script aborts before RPC simulation when it does not.
- Use `npm run devnet:treasury:seed-canaries` before `npm run devnet:treasury:pen-test` when the devnet snapshot lacks live treasury outflow canaries.
- Use `npm run test:e2e:localnet` as an additional release-candidate sign-off step when the public protocol surface changes.
- Use `npm run semantic:readiness:check` when you want the canonical-surface wording guard on its own.
- Treat deployment and bootstrap helpers as operator tooling, not general contributor entry points.
- Review required environment variables before running any script that changes on-chain state.
- The hard-break devnet migration now centers on the manifest emitted by `npm run protocol:bootstrap`.
- The shared-devnet release sign-off path now typically runs `npm run protocol:bootstrap:devnet-live`, `npm run devnet:frontend:bootstrap`, `npm run devnet:frontend:signoff`, the governance smoke pair, and `npm run devnet:beta:observe` in one tracked rollout window.
- Use [`../docs/operations/genesis-live-bootstrap.md`](../docs/operations/genesis-live-bootstrap.md) for the Genesis mainnet-ready bootstrap path and its required env inputs.
- The governance smoke uses the existing `GOVERNANCE_SECRET_KEY_BASE58` signer or the local Solana keypair fallback, requires pre-existing DAO tokens, only SOL-airdrops fee balance when the signer drops below the configured threshold, and expects any protocol-governance transfer to be proposed and accepted before `GOVERNANCE_CONFIG` is treated as live authority.
- The readonly governance UI smoke requires Playwright Chromium locally: `npx playwright install chromium`.
