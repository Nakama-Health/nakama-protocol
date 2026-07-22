# Nakama Protocol

Nakama Protocol's current launch job is concrete: help a sponsor fund Travel 30 acute travel protection for a cohort, show whether the reserve posture can support it, and trace every claim from intake to payout.

Plainly: a sponsor can fund a protected group, see what backs the promise, and audit what happened when a claim is reviewed or paid.

This branch adds an immutable Ethereum mainnet implementation candidate with a one-purpose deployment factory, a custody and accounting core, a separately bound policy registry, domain-isolated ERC-20 vaults, contributor-controlled exits, commitment-based claims, strict-majority attestation, one challenge round, and permissionless finalization and settlement. It is pre-mainnet and unaudited: no Ethereum address or deployment transaction is configured, and the existing Solana devnet program remains the currently deployed beta until an audited migration is explicitly completed.

The current public launch reference is Genesis Protect Acute. `Travel 30` is the primary Founder SKU: a 100-seat cohort where 99 USDC reserves access to a reserve-indexed 30-day travel cap targeting up to 250,000 USDC at activation, unlocked only when the posted claims-paying reserve/backstop reaches the required threshold and final terms are ready. `Event 7` is the short-window cohort/demo SKU, with a 7-day window and a 3,000 USDC fixed-benefit cap. Both remain bounded launch surfaces: reservations are not active cover today, pending custody is not claims-paying reserve, this is not comprehensive travel insurance, and Phase 0 claim review is operator-backed rather than fully decentralized.

On Solana devnet beta today, the public surface in this repository can already anchor:

- sponsor-funded reward or protection lanes with explicit reserve and funding-line attribution
- contributor-signed backstop deposits with on-chain contribution/return balances
- operator-mediated member enrollment, claim intake, obligations, reserve booking, and payouts

## Ethereum Implementation Candidate

The Solidity 0.8.28 surface is immutable by design: it has no proxy, global owner, global pause, or arbitrary controller-created payout. A constructor-only `NakamaProtocolFactory` atomically creates `NakamaPolicyRegistry` at factory CREATE nonce 1 and `NakamaCoverageProtocol` at nonce 2, then retains getters only. Scope-local controllers can stop new activity, but existing claims, contributor exits from unencumbered equity, finalization, reservation, and settlement remain available.

The schema-v3 machine-readable interface is [`shared/ethereum/protocol_contract.json`](./shared/ethereum/protocol_contract.json), with standalone ABIs for the factory, core, registry, and reserve-vault template. `ReserveVault` has no single launch address: the core creates one deterministic CREATE2 vault per domain and ERC-20 pair. The checked-in deployment example stays `unconfigured`; clients must not infer a mainnet address from the presence of compiled contracts.

Start with:

- [Ethereum Mainnet Protocol Vertical Slice](./docs/architecture/ethereum-mainnet-protocol.md)
- [Ethereum CROPS and Walkaway Review](./docs/security/ethereum-crops-walkaway.md)
- [`deployments/ethereum-mainnet.example.json`](./deployments/ethereum-mainnet.example.json)

## Start Here

- [Genesis Protect V1 Curve Launch Plan](./docs/architecture/genesis-protect-v1-curve-launch.md)
- [Genesis Protect Claim Trace](./docs/architecture/genesis-protect-claim-trace.md)
- [What Exists Today](https://docs.nakama.health/docs/protocol/current-program-surface)
- [Repository Documentation Map](./docs/README.md)
- [SDK Overview](https://docs.nakama.health/docs/sdk/sdk-overview)

## Choose Your Path

### Sponsors and protection operators

Fund a Travel 30 cohort, inspect reserve sufficiency, follow claim obligations, and prove payouts without treating pending custody, premiums, LP capital, or claims-paying reserve as the same thing.

Start with:

- [Genesis Protect V1 Curve Launch Plan](./docs/architecture/genesis-protect-v1-curve-launch.md)
- [Genesis Protect Claim Trace](./docs/architecture/genesis-protect-claim-trace.md)
- [What Exists Today](https://docs.nakama.health/docs/protocol/current-program-surface)

### Reserve and backstop integrators

Connect domain vaults, sponsor budgets, premiums, backstops, and reserve-domain accounting to the same Travel 30 / Event 7 launch truth.

Start with:

- [Protocol Architecture](https://docs.nakama.health/docs/protocol/architecture)
- [Public Release Gate](./docs/operations/public-release-gate.md)
- [Release v0.3.1](./docs/operations/release-v0.3.1.md)

### Oracle and event producers

Build normalized event pipelines, oracle operators, and verification services that feed Nakama-compatible outcomes into the protocol.

Start with:

- [Oracle Event Production](https://docs.nakama.health/docs/oracle/event-production)
- [SDK Overview](https://docs.nakama.health/docs/sdk/sdk-overview)
- [What Exists Today](https://docs.nakama.health/docs/protocol/current-program-surface)

### Health / wallet / app builders

Use the public SDK and read models to integrate member state, claim intake, payout posture, and outcome-triggered experiences into apps, wallets, or agents.

Start with:

- [SDK Getting Started](https://docs.nakama.health/docs/sdk/sdk-getting-started)
- [SDK Workflows](https://docs.nakama.health/docs/sdk/sdk-workflows)
- [What Exists Today](https://docs.nakama.health/docs/protocol/current-program-surface)

## What Exists Today on Devnet Beta

- reserve domains and domain asset vaults define settlement boundaries and payment custody
- health plans, policy series, and funding lines define sponsor and member-side products
- operator-mediated member enrollment, claim intake, obligations, settlement, and payout checks are mounted in the canonical console

## Long-Term Destination

Nakama Health is the first oracle and the public sponsor/operator console is the first managed experience around the protocol.

The destination is one shared settlement foundation that can support sponsor programs, coverage products, outside oracle builders, wallet-native health apps, and reserve partners without fragmenting the underlying accounting truth.

## Protocol Model

The canonical public model in this repository is:

- `ReserveDomain`: hard custody or legal segregation boundary
- `DomainAssetVault`: token custody per `[reserve_domain, asset_mint]`
- `HealthPlan`: sponsor/liability root
- `PolicySeries`: versioned product lane
- `FundingLine`: plan-side funding source
- `CapitalContribution`: contributor-level reserve capital balance per funding line
- `ClaimCase`: explicit adjudication lifecycle for material claims
- `Obligation`: canonical liability unit

## Current Surface Notes

This repository treats the earlier pool-first surface as retired devnet history and improves the current canonical model in place.

- sponsor budgets are not LP capital
- reserve-capital deposits are tracked as contribution facts, not tokenized LP shares
- reward and protection reconcile through one reserve kernel
- reserve truth is ledger-based, not implied by scattered treasuries
- LP/capital-class formation, allocation, redemption, impairment, protocol-governance, fee-vault, token-gate, and outcome-schema registry rails are retired from the live program surface

## Release Status

Current publish target: `v0.3.1`

This patch hardens the first publishable canonical Nakama reserve, obligation, and claim surface.

- reserve inflows now require checked SPL token transfers into the configured domain vault token account before ledgers increase
- emergency pause now covers reserve-moving exits and settlement paths; Founder reservations remain off-chain Squads custody until activation/posting
- settlement payouts must leave a positive net recipient payout and remain bound to the matching domain vault, funding line, and reserve ledgers
- optional mutable reserve ledgers are bound to the expected series, funding line, domain, and mint before mutation
- it is a hard-break devnet migration from the retired pool-first model
- reserve domains define hard custody and legal settlement boundaries
- health plans define sponsor, member, liability, and claims administration roots
- funding lines separate sponsor budgets, premiums, backstops, and subsidies
- backstop contributors can deposit into open backstop funding lines; the program tracks contributed and returned amounts for quote-oracle discounts or manual credits off-chain
- realized reserve earnings can be recorded only after same-mint tokens are transferred back into the domain vault with a nonzero earnings reference hash
- the canonical console now mounts `/plans`, `/claims`, `/members`, `/oracles`, and `/schemas` against live snapshot-backed protocol reads
- `/plans/new` now launches from live reserve-domain, asset-vault, policy-series, and funding-line data rather than fixture-only defaults
- `/plans/new?template=genesis-protect-acute` now bootstraps the canonical Genesis Protect Acute shell in place using the frozen Event 7 and Travel 30 launch truth
- `/plans?...&setup=genesis-protect-acute` now exposes the Genesis setup checklist, issuance posture, and reserve-warning view inside the mounted sponsor/operator workspace
- the mounted Genesis claims tab now behaves as an operator claim queue with summary cards, queue filters, selected-case detail, and contextual handoff into adjudication, reserve, and oracle follow-through
- the mounted Genesis treasury tab now behaves as a reserve console with lane filters, per-SKU reserve attribution, degraded-visibility warnings, and treasury actions scoped from the selected live funding lane
- `/members` and `/claims` now route into the mounted plan/operator workspace instead of advertising standalone self-serve dapp actions
- mounted workbenches now include sponsor-side post-launch series, funding-line actions, claim intake, and payout handling
- raw evidence review and oracle attestations are off-chain/adjunct concerns; the live program stores claim intake, proof fingerprints, adjudication, reserve, and settlement state
- pricing/yield benefits stay outside the program math for now: the quote oracle reads contribution and earnings facts and decides whether to issue discounts, credits, or manual rewards

Genesis Protect Acute sprint-1 launch truth is frozen in the public metadata and fixture surface for the April 16-20, 2026 implementation window.

- `Travel 30` is the primary Founder launch SKU with a reserve-indexed target cap, and `Event 7` is the fast demo SKU
- the current public target is end-of-month mainnet readiness, not broadly live insurance issuance today
- phase-0 claims trust is an operator-backed oracle flow rather than decentralized adjudication
- AI recommendation and more explicit decentralized review remain next-phase work, not current public fact
- prediction markets do not count as reserve truth; only posted premiums, sponsor funds, and explicit backstops do
- app membership billing remains separate from per-window protection premiums
- the public sponsor/operator console now carries the Genesis bootstrap, checklist, operator claim queue, and reserve-console read path directly on `/plans`
- the Genesis protection metadata disclosure routes now resolve on the public protocol frontend at `/coverage/technical-terms` and `/coverage/risk-disclosures`

Read the canonical design set first:

- [ADR 0001](./docs/adr/0001-health-capital-markets-rearchitecture.md)
- [WHY_THIS_MODEL](./docs/WHY_THIS_MODEL.md)
- [MIGRATION_MATRIX](./docs/MIGRATION_MATRIX.md)
- [Public Release Gate](./docs/operations/public-release-gate.md)
- [Devnet Beta Runbook](./docs/operations/devnet-beta-runbook.md)
- [Release v0.3.1](./docs/operations/release-v0.3.1.md)

## Repository Layout

- [`contracts/`](./contracts/) contains the immutable Ethereum factory, custody core, policy registry, isolated reserve-vault template, accounting library, and test tokens
- [`programs/nakama_coverage_protocol/`](./programs/nakama_coverage_protocol/) contains the onchain Anchor program
- [`frontend/`](./frontend/) contains the public protocol console and deterministic read models
- [`tests/`](./tests/) contains the fast Node-based scenario suite
- [`e2e/`](./e2e/) contains the heavier localnet audit entrypoint
- [`scripts/`](./scripts/) contains artifact generation and devnet migration helpers
- [`idl/`](./idl/), [`shared/`](./shared/), and [`frontend/lib/generated/`](./frontend/lib/generated/) contain checked-in generated contract artifacts, including four canonical Ethereum ABIs, creation hashes and sizes, normalized runtime-template hashes, and immutable byte ranges

## Quick Start

Install dependencies:

```bash
npm ci
npm --prefix frontend ci
```

Build and test the Ethereum implementation candidate:

```bash
npm run ethereum:build
npm run ethereum:test
npm run ethereum:contract:check
```

Regenerate the canonical Ethereum artifact after a Solidity change:

```bash
npm run ethereum:contract
```

`npm run ethereum:deploy:preflight` is the read-only release check. It deliberately fails until an independent audit and explicit release approval are bound to an operator-local manifest; do not run the transaction-producing mainnet command as a development smoke test.

The deployment command sends one factory transaction. Its output remains explicitly unverified until `ethereum:manifest:promote` independently validates the canonical finalized factory receipt, nonce-1 registry and nonce-2 core addresses, all three live runtime and cross-binding checks, fixed Sourcify v2 exact matches for each live contract, and all four SDK ABIs. The final public shape is machine-defined in [`deployments/ethereum-mainnet.final.schema.json`](./deployments/ethereum-mainnet.final.schema.json); the reserve vault remains an artifact-bound CREATE2 template until a real domain and asset instantiate it.

Regenerate the canonical onchain artifacts:

```bash
npm run anchor:idl
npm run protocol:contract
```

Run the fast scenario suite:

```bash
npm run test:node
```

Build the public console:

```bash
npm run frontend:build
```

Run the public verification gate:

```bash
npm run verify:public
```

## QEDGen Verification Lane

The QEDGen spec lives at [`omegax_protocol.qedspec`](./omegax_protocol.qedspec)
and `.qed/config.json` pins it for local commands. Generated verification code
is intentionally isolated under [`formal_verification/`](./formal_verification/)
so the live Anchor program in `programs/nakama_coverage_protocol/` is not overwritten by
QEDGen scaffolding.

```bash
npm run qedgen:check
npm run qedgen:codegen
npm run qedgen:verify
npm run qedgen:reconcile
```

`npm run qedgen:codegen` writes the Anchor verification model to
`formal_verification/anchor_model/`, the Lean proof surface to
`formal_verification/Spec.lean`, and the generated Kani/proptest harnesses to
`formal_verification/anchor_model/tests/`.

Treat the current QEDGen lane as a coverage and spec-hygiene gate unless a
specific property has committed proof bodies. Generated theorem stubs, missing
Lean obligations, and `todo!("fill non-mechanical effects, events, transfers,
calls")` placeholders in `formal_verification/anchor_model/` are not production
proof coverage by themselves and must not be described as mainnet formal-proof
sign-off.

The only currently accepted warning is
`missing_cpi_for_token_context` on `create_domain_asset_vault`.
That handler uses `token_program` for token-account initialization, not for a
token transfer. The modeling gap is tracked in
[`.qed/plan/findings/001-domain-vault-init-token-program.md`](./.qed/plan/findings/001-domain-vault-init-token-program.md)
and [`.qed/plan/gaps.md`](./.qed/plan/gaps.md).

## Maintainer and Devnet Operations

These helpers are for repo maintainers and shared-devnet operators rather than first-time SDK consumers.

- `npm run protocol:bootstrap`
  - writes `devnet/health-capital-markets-manifest.json`
  - writes `devnet/health-capital-markets.env`
  - emits stable canonical fixture ids for the new model
- `npm run protocol:bootstrap:devnet-live`
  - seeds the current reserve-domain, asset-vault, plan, policy-series, funding-line, and proof-claim graph onto shared devnet using the configured signer
  - does not create retired in-program governance, member-seat, oracle-registry, liquidity-pool, capital-class, or allocation accounts
  - skips custody-moving funding deposits; use the explicit funding builders or treasury scripts when you intend to move SPL assets
  - syncs canonical public role addresses back into `frontend/.env.local`
- `npm run devnet:frontend:bootstrap`
  - syncs canonical fixture env values into `frontend/.env.local`
  - writes `frontend/public/devnet-fixtures.json`
- `npm run devnet:beta:deploy`
  - runs the checked build and artifact parity
  - regenerates the canonical bootstrap artifacts
  - leaves the final live deploy step operator-mediated for auditability
  - prints the exact canonical `solana program deploy --program-id ...` upgrade command and warns if `target/deploy/nakama_coverage_protocol-keypair.json` has drifted away from the canonical program id
- `npm run devnet:frontend:smoke`
  - checks that the canonical fixture set is present and coherent
- `npm run devnet:frontend:signoff`
  - runs the strict frontend parity matrix against the canonical fixture/env set
- `npm run devnet:beta:observe`
  - captures a structured observability snapshot for the shared devnet deployment

## Verification Philosophy

The fast suite now focuses on the scenarios that matter to the redesign:

- sponsor-only reward plan without LP capital
- premium/backstop-funded protection flows with reserve-aware settlement math
- one reserve domain funding multiple series
- multiple funding lines co-funding one series
- reward plus protection under one plan root
- separate reserve-domain ring-fencing
- claim and obligation pressure
- scoped pause behavior
- migration smoke for legacy surface retirement

## Documentation Map

- [Ethereum Mainnet Protocol Vertical Slice](./docs/architecture/ethereum-mainnet-protocol.md)
- [Ethereum CROPS and Walkaway Review](./docs/security/ethereum-crops-walkaway.md)
- [Solana Program Architecture](./docs/architecture/solana-program-architecture.md)
- [Solana Instruction Map](./docs/architecture/solana-instruction-map.md)
- [Repository Layout](./docs/architecture/repository-layout.md)
- [Frontend Information Architecture](./docs/architecture/frontend-information-architecture.md)
- [tests/README.md](./tests/README.md)

## Public-Safe Boundary

This repository is public-safe by design.

Do not commit:

- private backend services
- private endpoints
- secrets or local validator state
- operator credentials
- machine-specific output

Keep deployment-only control-plane automation outside this repository.
