# SDK, App, and Web Implementation

## Outcome

Deliver one coherent product surface from canonical protocol artifacts:

- an SDK that makes safe actions and finality explicit
- a sponsor console that can configure, fund, activate, operate, and close one
  program
- a member experience that feels like a trusted benefit, not a crypto protocol
- an operator/reviewer console that makes accountability and deadlines clear
- a public website that explains the category and current product without
  overstating deployed, legal, customer, or platform facts

## Phase 0 SDK acceptance matrix

"Implemented" below means the safe code boundary and deterministic tests exist;
it does not convert an unconfigured deployment, caller-supplied evidence, or a
mock adapter into production proof.

| ID    | Code status                                     | Implemented evidence                                                                                                                                                                                       | Remaining external acceptance gate                                                                                                                                                                   |
| ----- | ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S-001 | Implemented, fail-closed                        | Generated 12-contract bundle, nonzero committed source revision, raw artifact/ABI hashes, deployment commitment, chain/code verification, version checks, and stale-output CI                              | Audited deployed manifests, exact live source verification, and independent runtime promotion                                                                                                        |
| S-002 | Implemented                                     | Chain/asset-bound integer USDG amounts, named reads, block/finality/reconciliation context, exhaustive event/error decoding, and full receipt states                                                       | Live deployment readback and production indexer/RPC observation evidence                                                                                                                             |
| S-003 | Implemented                                     | One immutable EIP-712 object drives preview, EOA signing, local/onchain EIP-1271 verification, replay keys, expiry, and substitution-negative tests                                                        | Production reviewer wallet selection, threshold policy, relayer persistence, and live signature exercise                                                                                             |
| S-004 | Implemented, writes disabled while unconfigured | Capability-marked action builders, semantic validation, exact pinned and fresh simulations, decoded failures, expected state changes, and no generic send escape hatch                                     | Audited manifest, verified live runtime, wallet exercise, and finalized failure/reorg campaign                                                                                                       |
| S-005 | Provider-neutral code boundary implemented      | Maintenance-only smart-account simulation, quote-only paymaster policy, exact approval-plus-funding batch plan, account/program/call/value/gas/rate/expiry binding, and disabled user-operation submission | Provider selection; passkey account creation/recovery/signer-change and EIP-1271 conformance; one-signature member UX; fallback-wallet exercise; independent finalized module/paymaster verification |
| S-006 | Provider-neutral code boundary implemented      | Direct critical reads, indexed/direct reconciliation, write blocking, public-only adapter scope, bounded pagination/retries, cursor/snapshot checks, offline TTL, and conservative reorg invalidation      | Indexer selection/operation, production mapping privacy review, live balance/obligation parity, and outage/reorg campaign                                                                            |

## Experience Principles

### One understandable action at a time

Members should see the program, sponsor, dates, benefit, cap, exclusions,
evidence, decision process, appeal, privacy, and settlement method before a
wallet or signature becomes relevant.

### Crypto is infrastructure

Use passkeys, embedded or compatible smart accounts, sponsored gas, batched
actions, plain-language confirmations, and transaction recovery. Do not require
a member to bridge, acquire ETH, buy `$NAKAMA`, understand FDV, or interpret a
block explorer to receive sponsor-funded support.

### State is precise

Interfaces distinguish draft, awaiting human approval, transaction prepared,
wallet approval required, submitted, soft-confirmed, finalized, failed,
reorged, paused, and manually escalated. "Done" means the relevant source of
truth is final, not that a button was clicked.

### Sensitive work is calm and private

Request flows minimize fields, explain why information is needed, permit pause
and return, show who can access it, avoid public wallet/health linkage, and
provide an immediate human/emergency route.

## SDK Work Items

### S-001 — Canonical generated ABI and deployment package

**Outcome:** All clients consume one reproducible artifact generated from the
reviewed protocol release.

**Scope:** ABIs, bytecode hashes, addresses, suite/template versions, chain IDs,
events, errors, NatSpec-derived docs, and artifact checksum.

**Acceptance:**

- no hand-maintained duplicate ABI or production address exists downstream
- package generation is deterministic from protocol source and manifest
- runtime verifies chain ID and contract bytecode before enabling writes
- incompatible suite versions fail with an explicit upgrade message
- CI detects stale generated artifacts

### S-002 — Domain types, reads, and receipts

**Outcome:** Product code works with named program concepts and reliable receipt
states rather than raw tuples and transaction hashes.

**Scope:** Program, funding, membership, request, decision, appeal, obligation,
settlement, role, pause, and reconciliation types; public read client;
submission/finality receipt model.

**Acceptance:**

- exact USDG values use integer base units and safe formatting
- every amount type binds asset address, chain, decimals, and symbol metadata
- reads expose block and finality context
- event and typed-error decoders have exhaustive tests
- receipt state supports submitted, soft-confirmed, L1-posted where available,
  finalized, reverted, replaced, timed out, and reorged

### S-003 — EIP-712 and EIP-1271 decision package

**Outcome:** Human and smart-account reviewers sign exact, replay-safe actions
that contracts and product can render identically.

**Acceptance:**

- typed data includes domain, chain, contract, program, request, terms,
  evidence manifest, action, amount, recipient commitment, role, nonce, and
  expiry
- signer preview is generated from the same data object sent to the wallet
- signature verification works locally and onchain for EOA and EIP-1271
- negative tests cover chain/program/version/amount/manifest substitution,
  expired signatures, nonce replay, and malformed contract signer

### S-004 — Action builders and simulation

**Outcome:** Each sponsor, member, reviewer, settlement, and guardian action is
prepared, simulated, explained, and submitted through a safe typed path.

**Acceptance:**

- action builder validates lifecycle, role, amount, dates, and asset before RPC
- simulation uses current state and returns decoded failure reason
- expected state changes are shown to product before signature
- state can change between simulation and inclusion without unsafe assumptions
- no generic `sendTransaction` escape hatch exists in product code

### S-005 — Smart account, passkey, and paymaster adapter

**Outcome:** Members and sponsors can use policy-controlled accounts without
unrestricted session keys or paymaster sponsorship.

**Acceptance:**

- account creation, recovery, signer change, and EIP-1271 behavior are tested
- paymaster policy binds account, program, selector, value, rate, and expiry
- member activation requires at most one understandable signature after account
  setup
- sponsor exact approval+funding may be batched without infinite allowance
- failure and fallback to compatible wallet are documented
- provider-specific behavior is isolated behind an adapter

**Phase 0 implementation boundary:** the SDK may expose provider-neutral smart
account simulation and paymaster quote adapters only when policy and returned
quotes bind account, program, target, selector, native value, action
commitment, gas, rate window, and expiry. Adapter self-attestation never
authorizes submission. Account creation/recovery/signer-change conformance,
passkey UX, EIP-1271 verification, provider selection, fallback evidence, and
independently verified user-operation submission remain external acceptance
gates.

### S-006 — Indexer/query and offline-safe client

**Outcome:** Applications query fast indexed views while detecting stale or
divergent state and retaining direct-chain verification.

**Acceptance:**

- query responses include indexed block, chain head, finality, and
  reconciliation status
- critical balances and obligations can be verified directly from contracts
- stale/divergent indexer disables unsafe writes and explains the delay
- pagination, retries, caching, and reorg invalidation are tested
- no private evidence enters the public query package

**Phase 0 implementation boundary:** the public SDK query adapter validates
chain/finality/reconciliation context, bounds pagination and retries, detects
cursor loops, and invalidates cached state on a block-hash reorg. Offline,
stale, divergent, or indexer-only state cannot authorize writes. Selecting and
operating an indexer, proving direct-contract balance/obligation parity under
live failures, and confirming that production mappings contain no private
evidence remain external acceptance gates.

## Sponsor Console Work Items

### A-001 — Sponsor onboarding and authority

**Outcome:** A sponsor administrator can create a controlled organization,
invite accountable colleagues, and verify legal/wallet authority.

**Screens:** Organization identity, contracting entity, users and roles,
programs, wallet/threshold account, compliance tasks, and audit activity.

**Acceptance:**

- product clearly distinguishes organization role from onchain role
- invitations, removals, recovery, and role changes are auditable
- one user cannot unilaterally satisfy sponsor threshold actions
- no medical evidence appears in the general sponsor workspace

### A-002 — Program design workspace

**Outcome:** Sponsor and Nakama can move from structured input to a reviewable,
versioned program proposal.

**Screens:** Cohort, dates, geography, incident/current alternative, eligibility,
benefit schedule, caps, exclusions, evidence, operations, budget scenarios,
terms, approvals, and open questions.

**Acceptance:**

- agent-generated content is visibly draft and source-linked
- every change has author, version, rationale, and affected economics
- maximum-liability and required-funding calculation is visible
- unsupported combination is blocked rather than silently customized
- legal/clinical/security/finance approval status is explicit

### A-003 — Funding and activation

**Outcome:** Sponsor funds exact USDG and activates only after every gate passes.

**Acceptance:**

- asset, address, network, amount, custody path, and risk disclosure are shown
- no infinite token allowance
- submitted, confirmed, finalized, reconciled, and sufficient are separate
- direct token donation does not show as expanded program capacity
- activation checklist identifies every missing role/document/control
- threshold signatures and resulting onchain state are verifiable

### A-004 — Program operations and closure

**Outcome:** Sponsor sees aggregate enrollment, service, funding, obligations,
incidents, and closure without inappropriate member evidence access.

**Acceptance:**

- budget dashboard reconciles assets, encumbrance, obligations, settlements,
  refunds, and free liquidity
- small-count privacy suppression applies to request analytics
- SLA and incident views name an accountable Nakama owner
- unused-budget recovery appears only when contract state permits it
- closure report identifies measured outcomes, economics, unresolved issues,
  and renewal decision

## Member App Work Items

### A-005 — Eligibility and program explanation

**Outcome:** A member understands the sponsor-funded promise before creating a
wallet or sharing evidence.

**Screens:** Invitation, sponsor identity, dates, benefit, cap, examples,
exclusions, evidence, process, appeal, privacy, funding, stablecoin settlement,
limitations, and help.

**Acceptance:**

- five-question comprehension test reaches at least 80% before production
- terms are readable without crypto knowledge
- zero member price and no `$NAKAMA` requirement are explicit
- emergency and medical-advice boundary is visible
- accessible mobile-first design supports low bandwidth and resume later

### A-006 — Account and membership activation

**Outcome:** Eligible member activates with minimum friction and exact consent.

**Acceptance:**

- passkey/smart account is the default where reliable; wallet alternative exists
- activation avoids bridge, ETH acquisition, and token purchase
- signature preview says which program and terms are accepted
- recovery path is explained before it is needed
- failed, abandoned, duplicated, ineligible, and expired invitations recover
  safely
- product measures refusal reason without collecting unnecessary sensitive data

### A-007 — Private request and evidence flow

**Outcome:** Member can ask for support, provide minimum evidence, track state,
receive a reasoned decision, and appeal.

**Acceptance:**

- urgent condition always exposes immediate human/emergency route
- upload explains purpose, access, retention, and allowed files
- progress can be saved securely without public request detail
- evidence completeness is guidance, not a model denial
- member sees exact timeline and clock state
- denial shows private explanation and appeal deadline
- approved settlement shows asset, amount, destination, transaction/finality,
  and safe off-ramp guidance where allowed

### A-008 — Member history and data rights

**Outcome:** Member can review program rights, requests, decisions, settlements,
consent versions, authorized accounts, and privacy-right actions.

**Acceptance:**

- health history is not reconstructed publicly from wallet links
- data access/export/correction/deletion requests have clear status
- account recovery and authorized-representative changes are protected
- closed-program state remains understandable after active service ends

## Operator and Reviewer Console Work Items

### A-009 — Accountable work queue

**Outcome:** Humans see prioritized requests, deadlines, conflicts, evidence
state, agent recommendation, and required action without losing independent
judgment.

**Acceptance:**

- urgency and SLA are based on policy, not opaque model score alone
- conflicts and role qualifications are checked before assignment
- evidence access is purpose-bound and logged
- agent recommendation is distinguishable from source evidence and terms
- reviewer can reject/correct recommendation quickly with structured reason
- no bulk approval/denial of sensitive cases

### A-010 — Decision, appeal, and settlement preparation

**Outcome:** Reviewer signs a complete determination and settlement receives an
exact authorized obligation.

**Acceptance:**

- decision preview includes current terms and evidence-manifest commitment
- full rationale is private; public reason class is reviewed for privacy
- amount/cap math is deterministic and source-linked
- appeal requires independent role and preserves budget
- wallet signature and contract simulation use the same typed payload
- settlement operator cannot change amount or recipient commitment

### A-011 — Safety and incident console

**Outcome:** Authorized responders can detect, contain, communicate, and recover
from incidents with narrow controls.

**Acceptance:**

- financial, privacy, chain, stablecoin, reviewer, agent, and ACP alerts share
  one incident identifier
- available pause scopes and consequences are explained before signature
- every incident has owner, severity, members/programs affected, deadline,
  communications, and recovery checklist
- unpause requires verified preconditions and threshold approval

## Website Work Items

### W-001 — Category and buyer conversion site

**Outcome:** A qualified sponsor understands the current product, long-term
vision, evidence boundary, and next paid step in under five minutes.

**Required pages/sections:**

- homepage: "Give your international cohort a funded health safety net"
- how the sponsor-funded Genesis Protection Program works
- what members receive and what is excluded
- Nakama Operator with real task examples
- public economic verification and private evidence model
- sponsor qualification and Protection Design Sprint
- trust, privacy, legal, stablecoin, chain, and agent limitations
- long-term autonomous mutual vision clearly labeled future direction
- founder doctor-builder story tied to the problem, not used as traction

**Acceptance:**

- primary CTA is a qualified sponsor design conversation, not token purchase
- no unsupported sponsor, user, revenue, reserve, clinical, platform, or volume
  claim
- Robinhood Chain deployment status is generated from a verified manifest
- Virtuals relationship wording separates use, permissionless launch, and any
  written collaboration
- mobile, accessibility, performance, analytics consent, and form routing pass
- every lead enters CRM with segment, authority, cohort, deadline, current
  alternative, and budget questions

### W-002 — Public program transparency page

**Outcome:** A sponsor, member, auditor, or community observer can verify public
program facts without seeing member identity or evidence.

**Required fields:** Program/sponsor display name with permission, suite/template
version, dates, aggregate budget, assets, encumbrance, obligations, settlements,
pause/warning, role classes, terms commitment, deployment address, chain,
finality/update time, methodology, and privacy limitations.

**Acceptance:**

- page is driven by reconciled indexed/onchain data
- stale, divergent, paused, and closed states are prominent
- small-count privacy rules apply
- "funded" has an exact calculation and never means insured/guaranteed
- explorer links and machine-readable data are available

### W-003 — Agent and conditional token pages

**Outcome:** The public can understand productive agent work and, only after its
gate, exact token mechanics and risks.

**Agent page acceptance:**

- shows inputs, outputs, permissions, human approval, evaluations, and live
  public-safe jobs
- distinguishes internal product work from paid external ACP work
- never implies autonomous claim denial or medical advice

**Token page release gate:**

- hidden/unpublished until token go decision and exact mechanics are verified
- exact chain, address, supply, allocation, beneficiaries, vesting, curve,
  graduation, liquidity, fees, ACF, anti-sniper, admins, risks, and non-utility
  are populated from the approved launch packet
- no price target, guaranteed proceeds, brokerage implication, or member
  benefit entitlement

## Shared Design System Requirements

- clear hierarchy with minimal card nesting and intentional full-canvas layouts
- one terminology source used by sponsor, member, console, website, SDK docs,
  and signed terms
- accessible color, type, focus, error, loading, and reduced-motion behavior
- high-risk actions use specific nouns and consequences, never generic
  "Confirm"
- financial values always include asset, decimals, chain, and status
- agent output has source, version, uncertainty, and approval state
- sensitive workflows prevent screenshots/telemetry exposure where practical
- empty, loading, partial, stale, failed, paused, expired, and offline states are
  designed, not improvised

## Analytics Plan

Track only purpose-approved product events:

- sponsor qualification and paid-stage conversion
- proposal creation time and correction
- member comprehension, activation, abandonment, and refusal category
- workflow state and service-level timing
- agent recommendation, correction, and override category
- transaction preparation, signature, submission, finality, and failure class
- support and privacy-right workflow

Do not send member health category, evidence content, request rationale,
diagnosis, provider, full wallet, identity, or free text to general analytics.
Metrics use pseudonymous program-scoped identifiers and documented retention.

## End-to-End Acceptance Journey

The release candidate must demonstrate, on Robinhood testnet and then low-value
shadow mainnet:

1. Sponsor organization verifies and configures a versioned program.
2. Agent generates a bounded proposal and human reviewers approve it.
3. Factory deploys the expected suite and generated artifacts propagate.
4. Sponsor approves exact USDG and funds the required budget.
5. System reconciles funding and threshold roles activate enrollment.
6. Eligible member understands terms and activates without ETH or `$NAKAMA`.
7. Member commits a request and uploads encrypted synthetic evidence.
8. Agent checks completeness; reviewer requests information.
9. Member supplies a new manifest; reviewer signs an approval.
10. Contract creates an exact encumbered obligation.
11. Settlement pays exactly once and all surfaces show correct finality.
12. A second request is denied, privately explained, appealed, independently
    reviewed, and finalized without data exposure.
13. Program enters runoff, settles outstanding work, returns allowed unused
    budget, closes, and produces private/public reports.
14. RPC/indexer, model, evidence, notification, ACP, and signer failures are
    injected and recover according to runbooks.

## Release Evidence

- generated SDK/manifest reproducibility and compatibility tests
- EIP-712/EIP-1271 and AA/paymaster tests
- complete end-to-end normal/adverse journey recording with synthetic data
- moderated sponsor and member usability results
- member comprehension and wallet/privacy refusal metrics
- accessibility and mobile/browser QA
- public-copy evidence and legal review
- analytics/privacy review
- chain/indexer/finality discrepancy tests
- deployment-truth readback for every public environment claim

No product surface may display a roadmap feature as available merely because a
screen was designed or an SDK method exists.
