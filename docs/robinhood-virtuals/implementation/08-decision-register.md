# Decision Register

## Use

This register records the current recommendations behind the implementation
plan. A decision is not a deployed fact and can be reversed when its named
evidence changes. Reversal requires a dated entry explaining new evidence,
affected work, migration/communications consequences, and approvers.

Status values:

- `ACCEPTED`: governs current planning
- `CONDITIONAL`: preferred if named gates pass
- `OPEN`: no implementation assumption may silently resolve it
- `REJECTED`: intentionally excluded from the current plan
- `SUPERSEDED`: retained for history with replacement ID

## Accepted Decisions

### D-001 — Start with a sponsor-funded protection program

**Status:** `ACCEPTED`
**Decision:** Phase 0 is a bounded sponsor-funded health-support program for one
paid international cohort. Members pay zero; sponsor funds the complete maximum
program budget before activation.

**Why:** This tests sponsor demand, member trust, operations, private evidence,
and settlement without simultaneously testing member pooling or token demand.

**Consequences:** Public product name is Genesis Protection Program. Member-
funded pooling and external risk capital require a new legal/economic decision.

**Revisit when:** One sponsor-funded program closes with credible activation,
service, economics, renewal evidence, and counsel identifies a viable next
structure.

### D-002 — Keep autonomous mutuals as the long-term category

**Status:** `ACCEPTED`
**Decision:** Nakama's category ambition is infrastructure for autonomous
mutuals; customer copy initially says sponsor-funded or community protection as
the approved structure permits.

**Why:** The category unifies community distribution, agent operations,
transparent funding, accountable decisions, and later network roles, but using
it as a present legal claim would overstate Phase 0.

**Consequences:** Vision and product label are distinct across website, deck,
terms, agent, and token material.

### D-003 — Launch the full product, not a generic risk agent

**Status:** `ACCEPTED`
**Decision:** The Nakama Operator is a productive component of a complete
program covering terms, funding, members, private evidence, decisions, appeals,
settlement, and reporting.

**Why:** A risk chatbot is easy to copy and does not solve the buyer's operating
job. Productive agent work becomes defensible only inside a delivered loop.

**Consequences:** The agent launch shows a real bounded output and measured
human/agent responsibilities. "Risk agent" remains a capability description.

### D-004 — Build a clean Robinhood-native vertical slice

**Status:** `ACCEPTED`
**Decision:** Design the target around Robinhood Chain and current product
requirements rather than preserving Solana/Ethereum compatibility.

**Why:** Prior architecture should not encode constraints that no longer serve
the product. Existing code may still reduce risk when its invariants pass.

**Consequences:** New contract suite, manifests, SDK path, chain configuration,
and platform adapters. Reuse requires explicit review.

### D-005 — Preserve EVM portability

**Status:** `ACCEPTED`
**Decision:** Core Solidity and domain logic remain standard EVM. Robinhood,
Virtuals, ACP, USDG, finality, RPC, bridge, and AA differences live in
configuration/adapters.

**Why:** Robinhood is strategically coherent but young and externally
controlled. Portability reduces platform and access concentration.

**Consequences:** The same core tests must run in a reference EVM environment;
active programs do not become cross-chain.

### D-006 — Use immutable, versioned program suites

**Status:** `ACCEPTED`
**Decision:** Each program pins code and template versions. New behavior uses a
new factory/suite version rather than a global upgradeable program monolith.

**Why:** A sponsor/member promise should not change through an admin upgrade.

**Consequences:** More deployments and explicit migrations, but stronger audit,
terms, and incident boundaries. External Virtuals/ACP proxies are monitored and
isolated.

### D-007 — Use conservative full-liability accounting in Phase 0

**Status:** `ACCEPTED`
**Decision:** Actual approved USDG assets must cover maximum remaining liability,
approved unpaid obligations, and matured refunds before activation and after
every transition.

**Why:** The first cohort should prove service and accounting without pretending
to have actuarial diversification or external risk capital.

**Consequences:** Capital efficiency is intentionally low; larger or pooled
programs need a new model and review.

### D-008 — Keep restricted data offchain

**Status:** `ACCEPTED`
**Decision:** Raw medical/identity/evidence/reviewer data stays in an isolated
encrypted private plane. Chain receives random commitments and public-safe
economic/authority state only.

**Why:** Public permanence and token/community access are incompatible with
minimum necessary health-data handling.

**Consequences:** Onchain hashes prove artifact integrity/version, not truth or
medical validity. Private services and legal controls remain essential.

### D-009 — Human accountability for material decisions

**Status:** `ACCEPTED`
**Decision:** The agent prepares and recommends. Authorized humans sign initial
determinations, appeals, material terms, activation, and settlements in Phase 0.

**Why:** The operational evidence needed to automate high-consequence decisions
does not yet exist.

**Consequences:** Reviewer staffing and service levels are part of the product.
No-quorum escalates and preserves budget; it never auto-denies.

### D-010 — Separate four economic domains

**Status:** `ACCEPTED`
**Decision:** Program vault, operating treasury, protocol/token treasury, and
ACP wallet have separate assets, keys, accounts, ledgers, reports, and authority.

**Why:** Commingling would let token/operating volatility threaten member
promises and create misleading reserve/revenue claims.

**Consequences:** Creator fees/ACF cannot become program reserve without a new
approved transaction and legal basis; `$NAKAMA` is never a payout asset.

### D-011 — Use product-first and token-later sequencing

**Status:** `ACCEPTED`
**Decision:** Build and sell the product, run a tokenless agent, and prove paid
ACP work before the token go/no-go.

**Why:** A token launch is irreversible, can distort incentives, and does not
answer whether sponsors care, members activate, or programs work.

**Consequences:** Token preparation may run in parallel but never gates the
member product or displaces its P0 work.

### D-012 — Use account abstraction to hide avoidable crypto friction

**Status:** `ACCEPTED`
**Decision:** Prefer passkeys/smart accounts, sponsored gas, batched exact
actions, scoped session keys, and plain-language previews.

**Why:** Members are accepting a benefit, not enrolling in a crypto course.

**Consequences:** AA/paymaster becomes a security boundary with adapter,
provider failover, recovery, caps, and tests. Members never need `$NAKAMA`.

### D-013 — Use USDG only after explicit asset approval

**Status:** `CONDITIONAL`
**Decision:** Use Robinhood-native USDG as the initial program and ACP asset if
issuer, redemption, liquidity, custody, bridge, freeze/upgrade, and depeg review
passes.

**Why:** Native single-chain settlement reduces cross-chain complexity, but the
ACP package's USDC mislabel and asset risks require a hard adapter boundary.

**Consequences:** Exact address/name/symbol/decimals binding; prefund on
Robinhood; no yield; alternative asset/no-launch if review fails.

### D-014 — Use Virtuals for agent commerce before tokenization

**Status:** `CONDITIONAL`
**Decision:** List bounded public/non-PHI Nakama Operator jobs through ACP when
use-case and Malaysia eligibility are resolved.

**Why:** Paid agent behavior is stronger evidence than a narrative-only agent
token and can be tested tokenless.

**Consequences:** ACP adapter, separate wallet, dynamic fee read, USDG override,
package pin, kill switch, and no dependency in member operations.

### D-015 — Prefer zero optional team initial purchase

**Status:** `ACCEPTED`
**Decision:** Do not use the optional up-to-45% team initial purchase unless a
small separately approved operational exception exists.

**Why:** Large additional concentration conflicts with community alignment and
adds market, disclosure, legal, custody, and reputation risk.

**Consequences:** Any exception discloses amount, owner, source, price, wallet,
lock, and purpose before signing.

## Conditional Decisions

### D-016 — Select a Virtuals launch class

**Status:** `OPEN`
**Options:** Tokenless/defer; Pegasus or least-concentrated supported route;
Unicorn/ACF; alternative reviewed route.

**Decision criteria:** Necessary token role, capital use, exact live mechanics,
allocation/concentration, ACF sale behavior, legal treatment, platform
eligibility, treasury capacity, and sponsor/member trust.

**No default:** Unicorn is not selected merely because ACF may provide capital.
Pegasus is not selected from stale documentation. The generated transaction
must be reviewed.

### D-017 — Define first benefit schedule and cap

**Status:** `OPEN`
**Decision criteria:** Actual sponsor incident data, member value, provider
costs, complete funding, operational evidence needs, clinical safety, legal
classification, and comprehension.

**Temporary implementation input:** Use a clearly synthetic bounded example for
local/testnet; it cannot become production terms through configuration drift.

### D-018 — Select initial jurisdictions and entities

**Status:** `OPEN`
**Decision criteria:** Sponsor entity, member location, contracting party,
reviewer/service location, data transfer, custody/payment, regulatory analysis,
and operational capacity.

**Consequence:** Website availability and enrollment must enforce the approved
matrix; global access does not mean global offer.

### D-019 — Select AA/paymaster provider

**Status:** `OPEN`
**Decision criteria:** Robinhood support, standards compatibility, passkey and
recovery behavior, policy granularity, availability, cost, security history,
data processing, portability, and provider exit.

### D-020 — Select production RPC/indexer/monitor stack

**Status:** `OPEN`
**Decision criteria:** Independent infrastructure, finality/reorg behavior,
availability, rate/cost, archive access, data integrity, alerting, support, and
rebuild/failover tests.

### D-021 — Decide whether public chain creates customer value

**Status:** `OPEN`
**Decision criteria:** Sponsor/member/auditor behavior, trust interviews, UX
cost, operating cost, and alternative private-ledger comparison during pilot.

**Possible outcome:** Keep chain as back-office economic proof while removing
wallet-facing member interaction, or reduce onchain scope if value is absent.

### D-022 — Decide sponsor-funded product versus service-infrastructure pivot

**Status:** `CONDITIONAL`
**Decision:** Continue the protection program if a legal structure and funded
sponsor pass. Pivot to agentic member-support infrastructure if customers value
workflow but Nakama cannot lawfully/viably operate the protection promise.

**Trigger:** Legal failure, unworkable capital exposure, or direct unit economics
paired with paid workflow demand.

## Rejected Decisions

### D-023 — Tokenize member rights or claims

**Status:** `REJECTED`
Members never need `$NAKAMA` to enroll, submit evidence, appeal, or receive an
approved benefit. Token holders never inspect or vote on individual cases.

### D-024 — Use `$NAKAMA` as reserve or RWA backing

**Status:** `REJECTED`
Token volatility and liquidity cannot back a fixed member promise. RWA is a
future asset-specific integration, not a narrative label for the token.

### D-025 — Automate adverse determinations in Phase 0

**Status:** `REJECTED`
There is no production evidence to justify autonomous denial or appeal. The
agent remains advisory and workflow-bounded.

### D-026 — Put health evidence on IPFS or a public chain

**Status:** `REJECTED`
Encryption does not make permanent public distribution a sound default for
health/identity material. Only random commitments are public.

### D-027 — Make ACF or creator fees the business model

**Status:** `REJECTED`
These are volatile token capital/market economics. The customer business must
work on design, launch, administration, and agent/service revenue.

### D-028 — Claim Robinhood brokerage distribution

**Status:** `REJECTED`
Robinhood Chain deployment is separate from brokerage listing, user access,
approval, endorsement, and promotion.

### D-029 — Exploit adjacent-community controversy for buzz

**Status:** `REJECTED`
Health incidents and community controversy can inform responsible product
research, but cannot be used as marketing entertainment or implied partnership.

### D-030 — Preserve legacy chain compatibility at product cost

**Status:** `REJECTED`
Existing code is reused only where it passes the new product's invariants. A
new Robinhood-native path need not preserve old transaction or state models.

## Decisions Required Before Funded Mainnet

- D-017 benefit schedule and cap
- D-018 entities/jurisdictions
- D-019 AA/paymaster
- D-020 RPC/indexer/monitoring
- D-013 USDG approval
- D-022 legal/business structure path
- exact sponsor, terms, reviewers, operations, and release packet

## Decisions Required Before Token Launch

- proof that D-011's product/agent gates passed
- D-014 ACP/eligibility approval and paid job
- D-016 exact launch class
- token necessity, legal, Malaysia, allocations, live mechanics, treasury,
  custody, public disclosures, and launch-abort decisions

## Change Template

When changing a decision, append:

```text
Date:
Decision ID:
Previous status/decision:
New status/decision:
New evidence:
Alternatives considered:
Customer/product consequence:
Legal/privacy/security consequence:
Economic/token consequence:
Implementation and migration impact:
Public communications impact:
Owner:
Reviewers/approvers:
Next review trigger:
```

Do not erase the prior decision. The history is necessary to explain why code,
terms, and public language changed.
