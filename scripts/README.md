# Scripts

This directory contains the repository's command-line helpers.

## Categories

### Verification

- `ethereum_mainnet_preflight.mjs` validates the approved source, artifact, signer, Ethereum chain ID, deployer balance, and EIP-170 size without sending a transaction
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

- `generate_ethereum_contract.mjs` produces the deterministic Ethereum ABI and bytecode-hash artifact at `shared/ethereum/protocol_contract.json`
- `generate_protocol_contract.ts` regenerates checked-in shared artifacts
- `generate_schema_metadata_hash.ts` and `generate_outcome_rule_hashes.ts` regenerate deterministic schema-related outputs
- `generate_standard_health_outcomes_schema.ts` rebuilds the standard schema definition

### Program build helpers

- `anchor_build_with_stack_gate.mjs` wraps program builds with stack-usage checks
- `anchor_test_with_stack_gate.mjs` does the same for Anchor tests

### Ethereum mainnet release

- `deploy_ethereum_mainnet.ts` deploys the immutable `NakamaCoverageProtocol` only after the same fail-closed release checks used by preflight
- `promote_ethereum_mainnet_manifest.mjs` independently verifies an audited intermediate receipt against canonical finalized Ethereum state and the fixed Sourcify v2 exact-match endpoint, then binds the approved artifacts and exact SDK ABI into the final manifest
- `lib/ethereum_deploy_guard.mjs` validates operator-supplied deployment intent, source, release approval, signer, balance, network, and runtime size
- `lib/ethereum_release_preflight.mjs` binds a clean git checkout to the compiled runtime, generated artifact, audit digest, approval digest, and reviewed operator-local release manifest
- `lib/ethereum_manifest_promotion.mjs` validates both deployment stages and emits the SDK's canonical `status: deployed`, `verified: true`, `auditStatus: audited` field set

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
- Use `npm run ethereum:test` for the Solidity and deployment-guard suite, `npm run ethereum:contract` to regenerate the canonical ABI, and `npm run ethereum:contract:check` to reject stale artifacts.
- Use `npm run ethereum:deploy:preflight` before any mainnet action. It requires the ignored, operator-local `deployments/ethereum-mainnet.release.json`, performs read-only network checks, and never submits a transaction. Commit the source and generated artifact first, then populate the local manifest with that existing HEAD; only `ethereum-mainnet.release.example.json` is tracked.
- `npm run ethereum:deploy:mainnet` is intentionally unavailable until the checkout is clean and the following variables exactly match the reviewed release: `ETHEREUM_MAINNET_RPC_URL`, `ETHEREUM_MAINNET_PRIVATE_KEY`, `NAKAMA_MAINNET_EXPECTED_DEPLOYER`, `NAKAMA_MAINNET_SOURCE_COMMIT`, `NAKAMA_MAINNET_AUDIT_REPORT_SHA256`, `NAKAMA_MAINNET_RELEASE_APPROVAL_SHA256`, `NAKAMA_MAINNET_CONFIRMATIONS`, `NAKAMA_MAINNET_MIN_DEPLOYER_BALANCE_WEI`, and `NAKAMA_MAINNET_DEPLOY_CONFIRMATION`.
- The confirmation value must be `DEPLOY_IMMUTABLE_NAKAMA_COVERAGE_PROTOCOL_TO_ETHEREUM_MAINNET`. Keep private keys in the operator's environment or secret store, never in a tracked file.
- Mainnet deployment requires at least 12 confirmations. Its JSON is deliberately intermediate: `status: deployed-unverified`, `verified: false`, and `auditStatus: audited`; it must never be published as the final SDK manifest.
- Promote only after Sourcify v2 reports exact creation and runtime matches. Run `ETHEREUM_MAINNET_RPC_URL=<credential-free-URL> npm run ethereum:manifest:promote -- --deployment <intermediate-json> --sdk-abi <NakamaCoverageProtocol.abi.json>`. The production Sourcify host and path are fixed; no operator-supplied verification URL is accepted.
- Promotion rereads the transaction, creation input, receipt, canonical block, safe/finalized heads, historical and latest code, immutable-normalized template, and exact live hash from chain 1. It emits the schema in `deployments/ethereum-mainnet.final.schema.json`; the SDK repeats these checks before accepting it.
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
