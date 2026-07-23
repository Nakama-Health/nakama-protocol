# Virtuals Token Launch Implementation

## Decision Frame

This is a conditional launch plan, not authorization to create or buy a token.
`$NAKAMA` is considered only after Nakama has a paid sponsor, a fully funded
program, an independently useful agent, a necessary token role, and written
resolution of legal and Virtuals eligibility—including any relevant Malaysia
facts.

The product must work when the token is absent, illiquid, volatile, delisted
from an interface, or unsupported by ACP. Program budgets, member rights,
reviewer authority, and settlements do not depend on token ownership or price.

## Launch Route Decision

The default decision order is:

1. **Tokenless ACP agent.** Create productive history and paid job evidence
   without making a permanent public asset the first experiment.
2. **Defer token.** Continue product and ACP work if utility or eligibility is
   unresolved.
3. **60 Days, only if Robinhood support is confirmed.** Its documented
   commit-or-wind-down model may be preferable to an immediately permanent
   launch, but exact refund, stipend, ACF, Growth Allocation, tax, liquidity,
   and legal behavior must be verified and product gates still apply.
4. **Pegasus or least-concentrated supported path.** Prefer when ACF capital is
   unnecessary or its combined reserve/team structure is unacceptable.
5. **Unicorn/ACF path.** Consider only when performance-linked capital has a
   specific approved use, exact mechanics are verified, and concentration plus
   market-sale consequences are accepted.
6. **Titan is not the Genesis default.** Current documentation targets
   established projects with a `$50M` minimum launch FDV and at least `$500,000`
   USDC worth of `$VIRTUAL` liquidity. Reconsider only after Nakama independently
   reaches the threshold and needs a direct-liquidity route.
7. **Alternative EVM route.** Use only after a fresh platform, liquidity,
   legal, security, and distribution decision; portability is not permission to
   improvise a launch.

No route is selected because it offers the largest team allocation or modeled
raise.

## Independent Gates

### Product gate

- at least two paid Protection Design Sprints or equivalent costly buyer proof
- one sponsor agreement with complete program budget committed
- testnet product completes normal and adverse lifecycle
- actual sponsor use case survives legal and operating review
- token is unnecessary for member enrollment, evidence, benefit, or settlement

### Agent gate

- Nakama Operator has a public, bounded, production-quality capability
- at least one independent external user pays for and accepts an ACP job
- job inputs contain no PHI, identity, secrets, or member-specific data
- agent identity, history, evaluations, support, and failure behavior are clear
- one token-to-one-agent mapping is accepted for the long-term product design

### Token-necessity gate

A written memo identifies:

- exact participant and productive duty
- exact action requiring `$NAKAMA`
- why USDG payment, credentials, reputation, contracts, or non-transferable
  bonds are insufficient
- objective success/breach evidence
- dispute and appeal
- volatility and maximum-harm behavior
- legal, tax, accounting, and communications treatment

Circular staking, vague governance, access to future features, price alignment,
and a narrative desire to tokenize the project do not pass.

### Legal and eligibility gate

- token and financial-promotion advice covers actual entity, creators,
  beneficial owners, countries, mechanics, utility, fees, ACF, treasury, and
  communications
- Virtuals confirms permitted product/use case and creator/operator path
- Malaysia restriction is resolved in writing for entity, founder, operators,
  employees, signers, access, and marketing
- KYC/KYB, AML, sanctions, tax, reporting, market-conduct, and user restrictions
  are operationally resourced
- launch agreement, terms, and disclosures are approved and signed by the
  correct entity

### Platform mechanics gate

- exact Robinhood launch route and contract addresses are current
- generated transaction is decoded, simulated, and independently reviewed
- fee, supply, curve, real/synthetic liquidity, graduation, LP maturity,
  scheduled delay, allocation, recipients, vesting, anti-sniper, trading fee,
  ACF, tax, admin, pause, proxy, and upgrade values are known
- all documentation/live-state conflicts are resolved or disclosed with the
  actual transaction governing
- USDG/USDC naming and ACF settlement asset are exact
- platform outage, UI removal, contract upgrade, and support assumptions are
  accepted

### Treasury and operations gate

- every launch, team, ecosystem, ACF, fee, and treasury wallet has a beneficial
  owner, controller, threshold, purpose, custody, recovery, accounting, and
  monitoring record
- no optional large team initial purchase; default is zero
- operating runway supports at least twelve months without price appreciation,
  creator fees, or ACF
- use-of-funds and restricted program-budget separation are published
- community support, security, incident, disclosure, tax, and market-conduct
  staffing are ready
- no unpublished side agreement, derivative claim, market-making promise, or
  related-party wallet exists

If any gate fails, the decision is `defer` or `do not launch`.

## Work Items

### T-001 — Token necessity and conflict memo

**Outcome:** Team, counsel, sponsors, and community can see what the token does
and which incentives it must never create.

**Acceptance:**

- identifies productive roles and duties existing at launch versus future
- compares token with USDG, credentials, reputation, contracts, and equity
- maps founder, sponsor, member, reviewer, token-holder, trader, agent, Virtuals,
  and treasury conflicts
- explicitly prohibits claim votes, evidence access, reserve backing, required
  member holding, and active-program term changes
- receives product, legal, finance, security, and independent adversarial review

### T-002 — Virtuals written diligence and eligibility

**Outcome:** Platform use is knowingly permitted, and expected support is not
confused with permissionless deployment.

**Acceptance:**

- written answers cover Malaysia, entity/creator/operator facts, health/support
  use case, ACP data/funds constraints, KYC/KYB, legal evidence, and marketing
- deployment, interface access, curation, Butler discovery, technical support,
  partner introduction, and amplification are listed separately
- no public relationship language exceeds written permission
- an unresolved prohibited-jurisdiction issue automatically records no-launch

### T-003 — Live contract and launch transaction decoder

**Outcome:** The team knows exactly what a proposed signature will create and
which mutable dependencies control it.

**Scope:** Contract/proxy addresses, implementations, admins, code hashes,
config, generated calldata, value, tokens, receivers, CREATE2 addresses,
allocations, vesting, LP, curve, graduation, fees, ACF, anti-sniper, approvals,
slippage, deadline, pause, and upgrade.

**Acceptance:**

- reads are performed through two RPC providers at recorded blocks
- decoder produces human-readable and machine-readable diff against approved
  tokenomics
- simulation runs from the intended signer/account and records resulting state
- mismatch blocks signing
- independent reviewer reproduces the decode
- post-signing verifier checks actual state and recipients

### T-004 — Allocation and beneficial-owner register

**Outcome:** Every token and economic recipient is known and publicly
explainable before launch.

**Acceptance:**

- total supply reconciles to 100% across market/LP, ecosystem, ACP/Butler, ACF,
  team, initial purchase, and any other receiver
- every contract/wallet has owner class, beneficial owner, control, vesting,
  transfer limits, purpose, and disclosure status
- related wallets and service-provider arrangements are identified
- team initial purchase is zero unless a separate approved exception explains
  amount, source, owner, price, custody, lock, and purpose
- no recipient can be mislabeled as community or reserve

### T-005 — Treasury, custody, and market-conduct controls

**Outcome:** Token and creator economics can be operated without commingling,
undisclosed trading, or dependence on price.

**Acceptance:**

- distinct threshold wallets for team vesting, creator fees, protocol treasury,
  operating conversion, grants, and ACP
- signer diversity, hardware, recovery, rotation, transaction policy, limits,
  monitoring, and emergency response are tested
- insider information, personal trading, quiet period, disclosure, related-party
  transaction, conflicts, and market-manipulation policies are approved
- creator fees and ACF are recognized under reviewed accounting/tax treatment
- program vaults reject all token-treasury authority and flows
- treasury reporting includes realized assets and restrictions, not marked-up
  token value as operating cash

### T-006 — Exact tokenomics and risk disclosure

**Outcome:** Public materials describe actual mechanics, uncertainty, and
non-utility in plain language.

**Acceptance:**

- exact supply, decimals, chain, address, class, curve, liquidity, graduation,
  LP lock/maturity, allocation, vesting, fees, ACF, anti-sniper, and admin risks
- modeled ACF numbers are labeled models, never guaranteed proceeds
- creator fee describes total fee and creator share, not "we receive 1%"
- product separation, no reserve right, no benefit entitlement, no equity or
  promised revenue share, and no claim vote are prominent
- Robinhood Chain is separated from Robinhood brokerage/listing/endorsement
- Virtuals permissionless launch is separated from curation/amplification
- risk factors include volatility, liquidity, concentration, platform,
  upgrade, legal, tax, smart-contract, treasury, and product risks
- publication waits for address and state readback

### T-007 — Agent/token linkage and productive utility

**Outcome:** One token maps to the actual Nakama Operator, and token-related
features connect to productive roles rather than fabricated staking.

**Acceptance:**

- agent profile links public capabilities, evaluations, support, code/product
  evidence, and ACP history
- token linkage preserves or documents agent/job history
- any access discount or payment path has clear economics and does not exclude
  sponsor/member product users
- operator/evaluator bonds remain disabled until independent roles and objective
  duties exist
- governance cannot reach active program terms, evidence, requests, or vaults

### T-008 — Scheduled launch rehearsal

**Outcome:** Team rehearses the exact launch end to end without relying on
real-time improvisation.

**Acceptance:**

- signers, thresholds, devices, location/eligibility, RPC, balances, approvals,
  gas, timing, and communications are verified
- exact transaction is generated, decoded, simulated, approved, and frozen
- known platform scheduled delay is incorporated
- anti-sniper behavior and first-hour buyer disclosure are ready
- monitoring covers contracts, allocations, vesting, LP, creator fees, ACF,
  related wallets, market anomalies, platform/UI state, and security incidents
- abort criteria and authority are agreed before rehearsal
- support has answers for failed transaction, wallet/network error, tax/fee,
  scam token, impersonation, liquidity, and no-brokerage-access confusion

### T-009 — Launch and post-launch verification

**Outcome:** If authorized, launch occurs through approved threshold control and
all resulting state is verified before any success claim.

**Sequence:**

1. Refresh evidence and terms.
2. Freeze public copy and the exact transaction.
3. Re-read chain, proxy, implementation, admin, pause, fee, and config.
4. Simulate from intended signer at a recent block.
5. Collect independent reviewer and legal/treasury go signatures.
6. Execute through approved threshold wallet.
7. Verify inclusion/finality and every resulting address, balance, receiver,
   vest, LP, curve, fee, and admin.
8. Publish verified address and risk disclosure through controlled channels.
9. Monitor and reconcile continuously through the high-risk launch period.
10. Issue factual incident corrections quickly if any field differs.

**Acceptance:** No address, supply, allocation, price, volume, funding, ACF,
partnership, or product-success claim is published before readback.

### T-010 — Ongoing token and treasury operations

**Outcome:** The token remains a governed public liability after launch rather
than a one-day campaign.

**Acceptance:**

- weekly treasury and allocation reconciliation
- vesting/unlock calendar and alerts
- creator-fee and ACF receipts reconciled by asset and source
- public material-event and treasury reporting cadence
- community proposals and moderation with no medical case discussion
- security monitoring for impersonation, malicious tokens, approvals, phishing,
  admin/proxy changes, and related-wallet anomalies
- quarterly utility review can remove unsupported token features/claims
- product PMF and token market scoreboards remain separate

## Exact Mechanics Checklist

Immediately before any launch decision, record:

| Field | Required evidence |
| --- | --- |
| Network | Chain name, chain ID, RPC block, explorer |
| Creation contracts | Addresses, bytecode, proxy implementation/admin, paused state |
| Creation fee | Asset, amount, receiver, approval, refundable/non-refundable treatment |
| Token | Predicted/final address, name, symbol, decimals, total supply, owner/admin |
| Curve | Formula, quote asset, real/synthetic liquidity, buy/sell behavior, slippage |
| Graduation | Exact threshold, destination DEX/pool, transition behavior |
| LP | Pair, allocations, recipient, lock/maturity, position authority, fee rights |
| Ecosystem | Exact percent and recipient contracts/wallets |
| Team | Exact percent, recipients, cliff, vest, acceleration, transfer behavior |
| Initial purchase | Amount, owner, source of funds, price, wallet, lock |
| ACF | Allocation, FDV/oracle logic, bands, cadence, slippage, sale asset, receivers, controls |
| Trading fee | Total rate, phase/venue coverage, creator/ACP/partner split, delegation |
| Anti-sniper | Duration, buy/sell rate schedule, proceeds, buyback, pause/admin |
| Schedule | Earliest time, delay, cancellation/change behavior |
| Admin | Upgrade, pause, config, oracle, rescue, blacklist, emergency roles |
| Agreement | Applicable entity, click/signature authority, terms version, restrictions |

The source is the actual transaction and contract state, corroborated by
current official documentation and written answers. A screenshot alone is not
enough.

## Launch Communications Sequence

### Before scheduling

Publish product and agent evidence, the founder's specific problem history,
current limitations, and what remains gated. Do not tease guaranteed funding,
price, promotion, or Robinhood distribution.

### After scheduling

Publish exact date/time, network, official domains/accounts, verified mechanics
known at that point, anti-scam guidance, eligibility restrictions, and the
scheduled launch's cancellation conditions.

### At verified creation

Publish contract address only after two-party readback. Pin it across official
surfaces with chain ID and explorer. State that lookalikes and other-chain
tokens are unofficial.

### Post launch

Report shipped product, agent jobs, treasury receipts/spend, allocation/vesting,
and risks. Price and volume may be stated factually with source and period but
are never framed as customer traction or a promise.

## Launch Abort Conditions

Abort or defer if:

- a contract address, implementation, admin, fee, allocation, vesting, ACF,
  anti-sniper, recipient, or asset differs from the approved packet
- signer/entity/platform eligibility is uncertain
- platform or counsel cannot support the public product/token description
- a critical security, treasury, custody, or disclosure control is incomplete
- malicious front end, domain, package, wallet, or contract behavior is
  suspected
- USDG or `$VIRTUAL` balance/liquidity/allowance is unsafe or unexplained
- sponsor/member program funds could be touched
- communications cannot distinguish Robinhood Chain from brokerage access
- team pressure to hit a date prevents independent review

The abort announcement should state a technical or readiness delay without
speculating about a new date. Preserving trust is part of the launch.

## Success and Failure

Launch execution succeeds when the intended token is created with exact
verified mechanics, custody and disclosures work, and the agent/product remain
operational. The token strategy succeeds only when productive roles and real
jobs make the token useful over time.

Graduation, FDV, ACF sales, creator fees, volume, and holder count remain token
market outcomes. They do not close any sponsor PMF, member safety, or program
renewal gate.
