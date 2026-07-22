# Protocol Contracts Implementation

## Outcome

Produce an immutable, versioned Robinhood Chain contract suite that can hold a
fully funded sponsor budget, activate one bounded cohort, record pseudonymous
membership and request state, enforce accountable decisions, settle exact USDG
obligations, refund according to signed terms, and expose independently
reconcilable economic truth.

The suite does not implement insurance pricing, clinical judgment, raw evidence
storage, token utility, yield, permissionless pool creation, or cross-chain
state in Phase 0.

## Contract Package Layout

Implemented package layout:

```text
contracts/robinhood/
  factory/
    Create2Deployer.sol
    NakamaFactory.sol
  registry/
    AssetRegistry.sol
    PoolRegistry.sol
    TemplateRegistry.sol
  program/
    ProtectionProgram.sol
    MembershipRegistry.sol
    ClaimManager.sol
  finance/
    PoolVault.sol
    SettlementModule.sol
  authority/
    DecisionModule.sol
    AgentAuthorizationRegistry.sol
    SafetyGuardian.sol
  interfaces/
  libraries/
  types/
  mocks/

scripts/
  deploy_robinhood_testnet.ts
  generate_robinhood_contract.mjs
  plan_robinhood_mainnet.mjs
test/ethereum/robinhood/
deployments/robinhood-mainnet/
deployments/robinhood-testnet/
```

The implementation preserves these responsibilities as separate trust
boundaries. A later suite version may change names, but it must not collapse
authority or custody merely to reduce contract count.

## Core Specifications

### Program identity

Every program has:

- globally unique `programId`
- immutable suite version and template version
- sponsor legal-entity commitment and public display metadata commitment
- funding asset, chain ID, vault, and decimals
- cohort enrollment, active, runoff, and closure timestamps
- per-member and aggregate caps
- terms, privacy notice, and operations commitments
- role registry for sponsor, operator, reviewer, appeal, settlement, guardian,
  and eligibility attestor
- state, pause scope, and public reason code

Human-readable metadata is versioned offchain and committed onchain. Terms used
for an active program cannot be replaced under the same version.

### Authority matrix

| Action                  | Member |     Sponsor |               Operator |             Reviewer |      Appeal reviewer |    Settlement |  Guardian |
| ----------------------- | -----: | ----------: | ---------------------: | -------------------: | -------------------: | ------------: | --------: |
| Fund sponsor budget     |        |         Yes |                        |                      |                      |               |           |
| Approve activation      |        |     Co-sign |                Co-sign |                      |                      |               |           |
| Activate own membership |    Yes |             | Eligibility dependency |                      |                      |               |           |
| Commit request          |    Yes |             |               Assisted |                      |                      |               |           |
| Request information     |        |             |                        |                  Yes |        Yes on appeal |               |           |
| Initial determination   |        |             |                        |                  Yes |                      |               |           |
| Appeal determination    |        |             |                        |                      |                  Yes |               |           |
| Create obligation       |        |             |                        | Signed decision only | Signed decision only | Deterministic |           |
| Settle obligation       |        |             |                        |                      |                      |           Yes |           |
| Recover unused funds    |        | Terms-bound |                        |                      |                      | Deterministic |           |
| Pause bounded functions |        |             |                        |                      |                      |               | Threshold |

No role has a generic arbitrary-call method. Administration functions accept
typed values, enforce program state, and emit complete events.

### Accounting model

The contract specification must formally define:

```text
actualAssets
maximumRemainingMemberLiability
pendingRequestReservation
approvedUnpaidObligations
maturedRefunds
encumberedAssets
freeLiquidity
```

The initial conservative rule reserves maximum remaining member liability for
every active membership. If later evidence supports a different reservation
model, it ships as a new suite/template version after legal, economic, and
security approval.

Required properties:

- `actualAssets >= encumberedAssets` after every successful state transition
- activation fails unless the complete required funding is present
- approved obligation cannot exceed member remaining cap or aggregate remaining
  cap
- obligation creation reduces available benefit exactly once
- settlement reduces approved unpaid obligations exactly once
- a failed token transfer reverts the accounting transition
- a direct token donation cannot expand program promises
- sponsor recovery cannot touch an active, pending, approved, appealed,
  refundable, or otherwise encumbered amount
- rounding always favors fulfillment of already promised obligations
- unsupported tokens cannot alter the ledger

## Work Items

### P-001 — Contract architecture ADR and specification

**Outcome:** An implementation-ready specification defines modules, state,
authority, invariants, events, errors, and external dependencies before code is
accepted.

**Scope:** Program lifecycle, member lifecycle, request/appeal lifecycle,
accounting equations, exact asset behavior, role matrix, pause matrix,
versioning, and upgrade policy.

**Dependencies:** Approved Phase 0 product schedule and preliminary legal model.

**Acceptance:**

- every state transition has caller, precondition, postcondition, event, and
  failure code
- every balance movement maps to a ledger effect and signed terms clause
- all privileged actions are enumerable and bounded
- no active-program behavior depends on `$NAKAMA`, ACP, or a model
- product, legal, finance, SDK, backend, and security reviewers sign the ADR

**Evidence:** Architecture document, state diagrams, invariant list, reviewer
record, and unresolved-question appendix.

### P-002 — Asset registry and USDG adapter

**Outcome:** The suite recognizes the exact Robinhood USDG contract and rejects
symbol/address/decimal confusion.

**Scope:** Chain ID `4663/46630`, approved token address, six-decimal accounting,
balance-delta checks, SafeERC20 behavior, asset pause/deprecation for future
programs, and mock asset for local/testnet.

**Out of scope:** Automatic swapping, genuine USDC support, yield, fast bridge,
or generalized asset listings.

**Acceptance:**

- startup/deployment verifies chain, bytecode, symbol, name, decimals, and
  expected interface
- unsupported, fee-on-transfer, rebasing, callback/reentrant, and malformed
  tokens fail tests
- user-facing manifest always says USDG, never ACP's incorrect USDC label
- a changed asset cannot alter an existing program

**Tests:** Unit and fuzz tests over decimals, transfer failures, donations,
blacklist/pause simulation, and exact balance reconciliation.

**Current Phase 0 evidence:** The local harness rejects a separately registered
six-decimal lookalike, malformed metadata, paused transfers, recipient-fee and
sender-fee transfers, and callback-based funding reentry without crediting the
ledger. A simulated post-funding balance seizure makes reconciliation false and
blocks the next protected economic transition. This does not establish the
current mainnet USDG implementation, proxy admin, freeze, upgrade, or recovery
behavior; those remain live dependency gates.

### P-003 — Template and suite registries

**Outcome:** Only reviewed versions can deploy, while historical programs stay
discoverable and immutable.

**Scope:** Suite IDs, semantic schema version, implementation addresses,
template commitment, status, review metadata, deprecation, warning, and
deterministic lookup.

**Acceptance:**

- only threshold template authority can admit a new future-use version
- deprecation blocks new deployments but does not mutate active programs
- warning state is visible without claiming an existing program was upgraded
- events reconstruct registry history from genesis
- manifests verify implementations and registry configuration

### P-004 — Deterministic factory and program deployment

**Outcome:** A reviewed sponsor configuration deploys one deterministic,
version-pinned suite with no hidden initialization authority.

**Scope:** CREATE2 or equivalent deterministic addresses, parameter validation,
one-time initialization, role assignment, registry write, deployment event, and
manifest generation.

**Acceptance:**

- predicted addresses match deployed addresses
- initializer cannot be replayed or front-run
- zero, duplicate, contract-incompatible, or unauthorized roles fail
- template/suite mismatch fails before deployment
- deployment leaves the program in `Draft` with zero promises
- generated manifest contains sources, compiler, bytecode hashes, parameters,
  roles, addresses, chain, block, transaction, and Git commit

### P-005 — Program lifecycle and activation gates

**Outcome:** A program cannot promise benefits before terms, roles, operations,
and full funding are complete.

**Scope:** `Draft`, `Reviewed`, `Funded`, `EnrollmentOpen`, `Active`, `Paused`,
`Runoff`, `Closed`, `Cancelled`; transition signatures and activation checklist
commitment.

**Acceptance:**

- every illegal transition reverts with a typed error
- activation checks exact suite/template/terms versions, dates, roles, asset,
  funding invariant, and checklist commitment
- backdated or overlapping invalid windows fail
- pause has functional scope and expiry, not one ambiguous boolean
- cancellation and closure preserve outstanding rights and exact refund rules
- test clock and production timestamp behavior are explicit

### P-006 — PoolVault conservative accounting

**Outcome:** Sponsor USDG is segregated and cannot be withdrawn while needed for
member promises or obligations.

**Scope:** Funding, encumbrance, obligation reservation, settlement debit,
refund reservation, unused-budget recovery, ledger views, and reconciliation
events.

**Acceptance:**

- all core accounting properties hold under invariant/fuzz testing
- full-funding check uses actual balance and deterministic liability
- sponsor cannot recover encumbered assets at any lifecycle state
- operator, agent, token treasury, ACP wallet, and arbitrary admin cannot
  transfer vault assets
- donation and mistaken-transfer policy is explicit and cannot expand benefits
- emergency pause cannot create a new withdrawal path
- public view functions expose sufficient aggregate state for independent
  reconciliation without member health details

**Current Phase 0 evidence:** Deterministic multi-member traces recompute
tracked assets, encumbrance, free liquidity, member remaining liability,
pending reservation, unpaid obligation, and donation separation after every
successful transition. Targeted failure tests prove that recipient
substitution, callback settlement reentry, paused transfers, and insolvency
revert the entire state change. The traces are deterministic property tests,
not yet long-running stateful fuzzing, differential-model proof, or formal
verification.

### P-007 — Pseudonymous membership registry

**Outcome:** Eligible members activate against exact terms without publishing
identity or health data.

**Scope:** Salted member commitments, eligibility attestation issuer/version,
terms acknowledgement, activation/expiry, benefit consumption, cancellation,
and account recovery authorization.

**Acceptance:**

- raw email, phone, government ID, diagnosis, or document hash cannot enter
  defined metadata fields
- same commitment cannot activate twice in one program
- eligibility expiry and revocation behavior are deterministic
- wallet recovery does not reveal identity linkage publicly
- membership cannot be transferred or sold unless a future terms version
  explicitly supports it
- batch/member actions preserve per-member consent and replay protection

**Current Phase 0 evidence:** Eligibility can be signed by an EOA or validated
by an EIP-1271 attestor. Revocation is a separate typed envelope binding the
program, exact eligibility digest, monotonic nonce, and deadline; any relayer
may submit it without gaining authority. Exact-target substitution, stale
nonce, expired revocation, invalid magic, reverting smart signer, replay,
post-consumption revocation, and activation-after-revocation are negative
tested. Repeated revocation is idempotent, while expired eligibility can still
receive a durable revocation record under a live revocation signature.

### P-008 — Request, decision, appeal, and obligation lifecycle

**Outcome:** Every request follows a reviewable path, and only a final approved
decision creates an exact funded obligation.

**Scope:** Evidence-manifest commitment, deadlines, information request,
approval, denial, appeal, distinct reviewer role, obligation, settlement
receipt, and public-safe reason codes.

**Acceptance:**

- no-quorum or deadline miss escalates and reserves value; it cannot auto-deny
- an initial reviewer cannot sign the same request's appeal
- changing evidence manifest invalidates a pending signature and creates a new
  version
- typed decision binds chain, contract, program, request, terms, manifest,
  action, amount, recipient commitment, role, nonce, and expiry
- EOA ECDSA and smart-account EIP-1271 signatures work
- approval obeys member and aggregate caps and reserves the amount atomically
- denial exposes a safe reason class but not private rationale
- exactly one final obligation and settlement can exist per approved version

**Current Phase 0 evidence:** Hostile EIP-1271 reviewer modes that return invalid
magic or revert do not advance decision nonce, request state, or pending
reservation. Recipient substitution and callback-based settlement reentry roll
back atomically, and a subsequent correct settlement succeeds exactly once.

### P-009 — Agent authorization and paymaster policy hooks

**Outcome:** Agent and relayer actions are explicit, expiring, capped, and
unable to reach program reserves or final decisions.

**Scope:** Principal, program, contract, selector, value, asset, per-action and
period cap, issued/expiry time, nonce, revocation, and purpose metadata.

**Acceptance:**

- default state authorizes nothing
- wildcard target, selector, unlimited value, or non-expiring production grant
  is rejected
- agent can prepare permitted non-economic actions only
- separate smart account and allowance govern ACP spending
- revocation is effective before the next action and emits a monitored event
- paymaster validates exact selector, account state, amount, rate, and program
- blocked calls create security telemetry without sensitive data

### P-010 — SafetyGuardian and incident controls

**Outcome:** Threshold responders can contain a defined incident without
rewriting terms or taking funds.

**Scope:** Pausable function groups, reason codes, incident ID, expiry, unpause
requirements, dependency warning, and role revocation.

**Acceptance:**

- pausing joins, new obligations, settlement, or agent actions is separately
  controlled
- no pause permits sponsor/admin withdrawal or destroys an existing obligation
- every action uses threshold authority and produces a complete event
- time-limited pause expires into a safe reviewed state, not silent normality
- lost signer, compromised agent, USDG incident, chain outage, and contract bug
  exercises pass

### P-011 — Events, views, and generated interface manifest

**Outcome:** SDKs, indexers, auditors, and public reporting can derive canonical
state without database-only interpretation.

**Scope:** Stable event schemas, typed errors, pagination, aggregate accounting
views, role and lifecycle views, ABI generation, NatSpec, and version manifest.

**Acceptance:**

- indexer can rebuild all public program state from events plus contract reads
- every economic event includes program, asset, amount, actor, relevant ID, and
  resulting aggregate value
- no event contains PHI, identity, document URL, or unbounded free text
- SDK artifacts are generated reproducibly and diffed in CI
- breaking schema changes require a new major suite version

### P-012 — Deployment, verification, and dependency monitor

**Outcome:** Testnet and mainnet deployments are reproducible, verified, and
continuously checked for external changes.

**Scope:** Robinhood networks, dual RPC, deployer/signer policy, source
verification, role handoff, manifest signing, bytecode checks, Virtuals/ACP/
USDG proxy and config monitor, and shadow deployment.

**Acceptance:**

- no production private key appears in scripts, shell history, CI output, or
  repository
- deployment stops on chain/address/bytecode/config mismatch
- explorer verification and independent RPC readback pass
- deployer authority is removed or reduced exactly as specified after setup
- role ownership matches threshold account register
- monitor alerts on code, implementation, admin, pause, fee, or relevant config
  changes
- mainnet shadow remains unfunded until release packet approval

## Test Strategy

### Unit tests

Cover each transition, role, typed error, view, event, token behavior, signature,
nonce, timestamp boundary, cap, pause, and refund path.

### Property and invariant tests

At minimum:

- assets never fall below encumbered value after a successful transaction
- active promise never exceeds deterministic funded capacity
- sum of member consumed benefits and remaining eligible capacity respects caps
- final obligation cannot be duplicated or reduced after creation
- settlement value equals obligation value and occurs at most once
- sponsor recovery plus settlements plus refunds never exceeds funded assets
- no unauthorized role can create, change, settle, pause, or withdraw
- no lifecycle sequence bypasses `Reviewed`, `Funded`, or activation checks

Use stateful fuzzing with random role calls, time advancement, member counts,
request sequences, appeals, token failures, direct donations, pauses, and
recoveries.

### Differential accounting model

Maintain a small executable reference ledger independent from Solidity. Run
random action traces against both models and compare assets, encumbrance,
benefit consumption, obligations, settlements, refunds, and final state after
every action.

### Integration tests

- generated SDK and actual deployed ABI
- smart account and EIP-1271 reviewer
- paymaster selector/value policy
- indexer rebuild and reorg simulation
- USDG funding and settlement
- evidence manifest version and typed decision
- sponsor refund after complete close
- restricted functions during partial incidents

### Fork and network tests

Before mainnet use, run against current Robinhood state with verified USDG and
external dependency addresses. Test RPC disagreement, stalled provider,
reverted transaction, delayed confirmation, token pause/freeze where
simulatable, and external proxy/config change detection.

### Adversarial cases

- malicious ERC-20 and reentrancy
- signature replay across chain/program/request/version
- malicious EIP-1271 signer
- role escalation and initializer front-running
- timestamp edge and deadline griefing
- no-quorum and reviewer censorship
- sponsor recovery during appeal
- agent/paymaster arbitrary call and allowance drain
- event/log data leakage
- indexer omission and duplicate delivery
- guardian abuse and indefinite pause

## Reuse Review Checklist

For each existing contract or library considered for reuse:

1. Identify the exact commit, code path, tests, and current deployment use.
2. Map storage and authority to the new specification.
3. List assumptions tied to Solana, Ethereum, legacy token economics, oracle,
   yield, governance, or upgrade patterns.
4. Run existing and new invariants unchanged where possible.
5. Document behavior that cannot be proven or safely migrated.
6. Decide `reuse`, `adapt`, `extract concept`, or `retire` in the decision
   register.

Reusing a name or interface while changing its economic meaning is a breaking
change and should receive a new version.

## Review and Release Evidence

The protocol release packet contains:

- approved specification and architecture decision
- complete source and dependency lock
- compiler and build reproducibility evidence
- unit, integration, invariant, fuzz, differential, and network results
- coverage and known-unreachable explanation
- static analysis and independent review findings with disposition
- threat model and privileged-role review
- exact USDG and dependency assessment
- deployment rehearsal and role-transfer evidence
- verified addresses, bytecode, sources, constructors, roles, and manifests
- unresolved risks accepted by named owner
- funded-pilot cap and incident/rollback plan

The suite does not receive funded mainnet assets while any critical accounting,
authority, privacy, signer, dependency, or deployment finding remains open.
