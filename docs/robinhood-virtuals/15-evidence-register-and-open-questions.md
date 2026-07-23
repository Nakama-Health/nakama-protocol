# Evidence Register and Open Questions

Evidence date: 2026-07-22
Review policy: refresh platform facts immediately before any irreversible action

## Purpose

This register prevents a strategy decision, internal assertion, published
document, UI label, or live contract observation from being mistaken for the
same kind of evidence.

The documents in this package are a target plan. They do not prove that a
customer, program, legal structure, contract, agent, token, platform
relationship, allocation, reserve, or deployment exists. When a roadmap and a
deployed manifest disagree, the deployed manifest governs product behavior and
public copy.

## Evidence Labels

| Label | Meaning | Publication treatment |
| --- | --- | --- |
| `VERIFIED` | Current primary source, signed contract, direct onchain read, deployed bytecode, cash receipt, or reproducible system record | May be stated with source, scope, date, and limitations |
| `INTERNAL` | Reviewable Nakama artifact or system record that has not been independently confirmed | Use internally; publish only after permission and claim review |
| `HYPOTHESIS` | Market, product, pricing, technical, or economic proposition awaiting a test | Label as a hypothesis or do not publish |
| `DECISION` | Current recommended course selected from available evidence | State as a plan, never as completed fact |
| `OPEN` | Material fact not yet known or conflicting | Block dependent claims or irreversible actions |
| `REJECTED` | Claim contradicted by evidence or prohibited by policy | Do not repeat except to correct the record |

Every evidence item should eventually include an owner, source URI or artifact
identifier, observation time, expiry/refresh condition, and the decision it
supports.

## Current Strategic Evidence

| ID | Status | Statement | Evidence and limitation | Consequence |
| --- | --- | --- | --- | --- |
| S-01 | `INTERNAL` | Nakama has sustained founder work, health product research, protocol code, and a doctor-builder founder story | Existing artifacts demonstrate effort and capability, not customer demand | Use as right-to-exist context, never PMF proof |
| S-02 | `HYPOTHESIS` | Paid international cohort operators have an urgent, budgeted health-support problem | Directional research only; target ICP interviews and spend data are incomplete | Run 30 qualified interviews and ten priced proposals |
| S-03 | `HYPOTHESIS` | A sponsor will fund a complete 50–250-member bounded program | No verified full-budget commitment in this package | Do not activate or claim partnership before contract and funds |
| S-04 | `HYPOTHESIS` | At least 70% of eligible sponsor-funded members will activate | No production cohort result | Moderated testing, then measure a funded cohort |
| S-05 | `HYPOTHESIS` | Public reserve and settlement state materially increases sponsor/member trust | Technically plausible; customer value unmeasured | Ask in discovery and compare behavior |
| S-06 | `HYPOTHESIS` | The Nakama Operator can reduce standard program setup below 20 staff hours by the third program | No repeated-program evidence | Instrument manual and agent time from the first design sprint |
| S-07 | `HYPOTHESIS` | External agents or buyers will pay for Nakama ACP services | No paid production job recorded here | List only bounded services and require one accepted paid job before utility claim |
| S-08 | `DECISION` | Phase 0 is sponsor-funded, bounded, zero-price to members, and token-independent | Removes member-pooling and token behavior from the first customer test; legal approval still required | Governs product and implementation plans |
| S-09 | `DECISION` | Autonomous mutuals are the long-term category, not the Phase 0 legal claim | Category ambition remains while public wording follows actual structure | Use sponsor-funded protection-program copy first |
| S-10 | `DECISION` | `$NAKAMA` launches only after independent product, legal, platform, technical, and treasury gates | Token is irreversible and does not establish PMF | Build productive tokenless agent first |

Internal usage, revenue, reservation, or community-size assertions from legacy
products are deliberately excluded from the PMF baseline until a shareable
evidence packet identifies product, period, denominator, payment status,
relationship to the proposed program, and publication permission.

## Robinhood Chain Evidence

| ID | Status | 2026-07-22 statement | Primary source or observation | Refresh trigger |
| --- | --- | --- | --- | --- |
| RH-01 | `VERIFIED` | Robinhood Chain mainnet launched on 2026-07-01 and is an Arbitrum-based EVM L2 | [Official mainnet announcement](https://robinhood.com/us/en/newsroom/robinhood-accelerates-global-expansion-robinhood-chain-mainnet-stock-tokens-agentic-trading/) and [Robinhood Chain documentation](https://docs.robinhood.com/chain/) | Before public launch copy |
| RH-02 | `VERIFIED` | Mainnet chain ID is `4663`; testnet is `46630`; ETH is used for gas | [Connecting to Robinhood Chain](https://docs.robinhood.com/chain/connecting/) | Every deployment and startup |
| RH-03 | `VERIFIED` | Account-abstraction support includes sponsored gas, batching, and session-key patterns | [Account abstraction](https://docs.robinhood.com/chain/account-abstraction/) | Before choosing provider/implementation |
| RH-04 | `VERIFIED` | Canonical deposits are expected around ten minutes and withdrawals inherit an approximately seven-day challenge path | [Bridging](https://docs.robinhood.com/chain/bridging/) | Before treasury and liquidity approval |
| RH-05 | `VERIFIED` | Public RPC is not offered with production availability/completeness guarantees | [Network configuration](https://docs.robinhood.com/chain/connecting/) | Before production provider selection |
| RH-06 | `VERIFIED` | Governance includes an eight-member Security Council with two Robinhood seats; validators are currently permissioned | [Governance](https://docs.robinhood.com/chain/governance/) | Before decentralization claims and mainnet |
| RH-07 | `VERIFIED` | Native Global Dollar is USDG at `0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168`, with six decimals | Official chain asset documentation plus onchain metadata read | Every deployment and before funding |
| RH-08 | `VERIFIED` | Robinhood Chain is distinct from Robinhood brokerage/crypto product access | Official chain and support boundaries | Every partnership or distribution claim |
| RH-09 | `HYPOTHESIS` | Robinhood provides a better first environment than another EVM chain for Nakama | Platform alignment is clear; distribution, liquidity, and customer advantage are unmeasured | Evaluate after testnet and first pilot |

`RH-08` means "deployed on Robinhood Chain" is a factual technical claim after
deployment. It does not mean listed in Robinhood, available to brokerage users,
approved, distributed, promoted, or endorsed by Robinhood.

## Virtuals and ACP Evidence

| ID | Status | 2026-07-22 statement | Primary source or observation | Refresh trigger |
| --- | --- | --- | --- | --- |
| V-01 | `VERIFIED` | Current Virtuals creation UI exposes Robinhood as a launch network | Current official creation surface | Immediately before launch |
| V-02 | `VERIFIED` | Robinhood `$VIRTUAL` address is `0xc6911796042b15d7Fa4F6CDe69e245DdCd3d9c31` | Current chain/contract read | Every transaction |
| V-03 | `VERIFIED` | `BondingV5` is `0xd4cCBFA37e2f35611b3042e4096Ad7a3459Bd007`; `BondingConfig` is `0x3e331Fdd9Fe54D5047b1B7339Fd5c91977D53e2F`; `AgentFactory` is `0x43e4c17b15365596caae8e7d00e42bc8e988c2d4` | Current Robinhood contract observations | Immediately before launch and on implementation change |
| V-04 | `VERIFIED` | Current config creates 1,000,000,000 agent tokens and targets 42,000 real `$VIRTUAL` for graduation | Current config observation | Immediately before launch |
| V-05 | `VERIFIED` | Current config expresses about ten years of LP maturity and a 24-hour scheduled-launch delay | Current config observation | Immediately before launch |
| V-06 | `OPEN` | Exact standard and ACF launch fee | Current contract/UI indicated `0` standard and `10` `$VIRTUAL` ACF while whitepaper material described `1,000` | Decode generated transaction and obtain written confirmation |
| V-07 | `VERIFIED` | Official Pegasus model is 95% market/LP and 5% ecosystem; official Unicorn model is 45% market/LP, 25% ACF, 25% team, and 5% ecosystem | [Agent tokenization platform](https://whitepaper.virtuals.io/about-virtuals/tokenization/agent-tokenization-platform) and [distribution table](https://whitepaper.virtuals.io/about-virtuals/tokenization/agent-tokenization-platform/token-distribution-table) | Before tokenomics publication |
| V-07a | `VERIFIED` | Official Titan model is a direct-liquidity route for established projects, with a `$50M` minimum launch FDV and at least `$500,000` USDC worth of `$VIRTUAL` liquidity | [Agent tokenization platform](https://whitepaper.virtuals.io/about-virtuals/tokenization/agent-tokenization-platform) | Before considering an established-project route |
| V-08 | `VERIFIED` | Official Unicorn ACF model sells five 5% bands from `$2M` to `$160M` modeled FDV, with modeled cumulative proceeds of `$11.55M` | [Virtuals tokenization documentation](https://whitepaper.virtuals.io/about-virtuals/tokenization/agent-tokenization-platform) | Before any ACF statement |
| V-08a | `OPEN` | Exact ACF payout asset | Current Unicorn team-distribution page says USDC; current token-distribution table says `$VIRTUAL` | Trace live Robinhood flow and obtain written confirmation |
| V-09 | `VERIFIED` | Official team allocation guidance describes a one-year lock plus six-month linear vest, with an early start at `$160M` FDV | [Unicorn team distribution](https://whitepaper.virtuals.io/about-virtuals/tokenization/agent-tokenization-platform/unicorn-team-distribution) | Decode actual vesting contract |
| V-10 | `VERIFIED` | Official docs permit an optional team initial purchase up to 45% | Current Virtuals tokenization documentation | Immediately before launch |
| V-10a | `VERIFIED` | Official docs describe a 60 Days trial in which a founder later commits or winds the token down, with specified refund treatment for locked funds | [60 Days overview](https://whitepaper.virtuals.io/about-virtuals/tokenization/60-days) and [economic model](https://whitepaper.virtuals.io/about-virtuals/tokenization/60-days/economic-model) | Before treating the framework as a launch option |
| V-10b | `OPEN` | Whether 60 Days is deployed and supported on Robinhood Chain, and its exact live behavior there | No official chain-specific confirmation was found in this review | Written confirmation and live contract/transaction inspection |
| V-11 | `OPEN` | Exact ecosystem allocation on Robinhood | Docs describe 2% veVIRTUAL plus 3% ACP/Butler; current configuration permits 0–5% | Inspect generated allocation |
| V-12 | `OPEN` | Exact trading fee and creator/ACP split | Current docs describe a 1% fee split 70% creator/30% ACP; live path is mutable | Read live contracts and launch payload |
| V-13 | `OPEN` | Exact anti-sniper behavior | Whitepaper describes 99% decaying over 98 minutes; current Robinhood configuration appeared to use a 60-second mode | Simulate actual launch type |
| V-14 | `VERIFIED` | Launchpad agreement is permissionless and disclaims participation, trading volume, value, and success guarantees; interface access can be removed | [Virtuals Launchpad Developer Agreement](https://app.virtuals.io/launchpad_agreement.pdf) | Before signing and launch copy |
| V-15 | `VERIFIED` | ACP v2 source includes Robinhood mainnet/testnet support | [ACP chain configuration](https://github.com/Virtual-Protocol/acp-node-v2/blob/main/src/core/chains.ts) | On every package upgrade |
| V-16 | `VERIFIED` | ACP contract observed at `0x238E541BfefD82238730D00a2208E5497F1832E0` and is an upgradeable dependency | Current onchain observation | Continuous dependency monitor |
| V-17 | `VERIFIED` | ACP v2 code maps Robinhood USDG through USDC-named metadata | [ACP constants](https://github.com/Virtual-Protocol/acp-node-v2/blob/main/src/core/constants.ts) and onchain token metadata | Every package upgrade; Nakama adapter must override |
| V-18 | `OPEN` | Current ACP platform/evaluator fees and net seller economics | Live snapshot showed 500 bp platform and 500 bp evaluator, conflicting with older 80/20 material | Read live config before pricing each offering |
| V-19 | `VERIFIED` | ACP usage is early; live observed job counter was 21 | Direct contract observation | Recheck before market-size claim |
| V-20 | `VERIFIED` | Current guidance permits a tokenless ACP agent and later token linkage; one token maps to one ACP agent | Current Virtuals ACP guidance | Before agent/token registration |
| V-21 | `OPEN` | Nakama creator/operator eligibility given Malaysia-related facts | Reviewed Virtuals terms list Malaysia as prohibited | Written platform and legal resolution required |

Onchain observations are stronger than remembered prose but can still become
stale when contracts are upgraded or configuration changes. The generated
transaction, verified bytecode, proxy implementation, configuration, and
recipient contracts are re-read in the same change-control window in which the
launch is signed.

## Documentation and Live-State Conflicts

| Conflict | Why it matters | Required resolution |
| --- | --- | --- |
| `1,000` `$VIRTUAL` documented launch fee versus `0/10` observed | Changes cost and signals that prose is stale | Decode live launch call and obtain written answer |
| USDC language versus USDG address | Creates incorrect accounting and user authorization | Bind chain, address, name, symbol, decimals; reject mismatch |
| Older ACP 80/20 economics versus observed 95/5 or 90/5/5 | Changes pricing and marketplace margin | Read live fee config for every quoted job |
| Fixed 5% ecosystem description versus 0–5% configurable value | Changes circulating supply and recipients | Inspect exact allocation transaction |
| 98-minute anti-sniper prose versus apparent 60-second Robinhood mode | Changes buyer experience, tax, and launch risk | Simulate the exact type and publish only confirmed behavior |
| ACF/team prose versus combined reserve behavior | Recipient and vesting ambiguity can hide concentration | Trace every recipient and vesting contract |
| ACF payout described as USDC on one official page and `$VIRTUAL` on another | Changes treasury, slippage, tax, custody, and modeled proceeds | Trace actual receiver asset and obtain written confirmation |
| Permissionless launch versus believed project approval/promotion | Can cause false partnership and success claims | Separate deployment, interface access, curation, and amplification in all copy |

## Claims Rejected by This Package

| ID | Status | Rejected claim | Correction |
| --- | --- | --- | --- |
| R-01 | `REJECTED` | "Robinhood has the most volume for newly launched projects" | No current, defined, source-backed comparison was established; do not use |
| R-02 | `REJECTED` | "Virtuals approves the project and pumps it" | Launch is permissionless, interface/curation are controlled, and promotion or market outcome is not guaranteed |
| R-03 | `REJECTED` | "Nakama gets 1% of trading fees" | Current docs describe a 1% total fee with a creator share; exact live routing is mutable |
| R-04 | `REJECTED` | "At `$2M` market cap, 5% auto-sells and Nakama gets about `$100K`" | The documented ACF band is a modeled mechanism and cannot be reduced to a guaranteed trigger, execution price, or proceeds |
| R-05 | `REJECTED` | "Launching on Robinhood Chain lists Nakama on Robinhood" | Chain deployment is separate from brokerage listing, customer distribution, approval, and endorsement |
| R-06 | `REJECTED` | "The token is the reserve/RWA" | `$NAKAMA` is outside the member program ledger; any RWA requires a specific approved asset, issuer, custody, and redemption path |
| R-07 | `REJECTED` | "The AI decides claims" | Phase 0 agent prepares recommendations; accountable humans sign decisions and appeals |
| R-08 | `REJECTED` | "Existing app/token activity proves PMF for this product" | PMF begins with paid sponsor commitment, member activation, delivered program, and renewal |

## Product and Legal Open Questions

| ID | Question | Owner | Blocking decision | Required evidence |
| --- | --- | --- | --- | --- |
| P-01 | Which exact sponsor segment has the repeated incident and budget pattern? | Founder/product | Final ICP and outreach list | 30 qualified interviews and shared data |
| P-02 | What is the current alternative and annual/cohort spend? | Revenue/product | Pricing and economic value | Buyer invoices, budgets, or specific ranges |
| P-03 | Which acute events and caps create a useful but fully fundable Phase 0 schedule? | Clinical/product/actuarial | Terms and maximum liability | Incident data, provider costs, simulations, counsel review |
| P-04 | Is the benefit contractual, discretionary, reimbursed, or service-based? | Legal/product | Member promise and accounting | Jurisdiction/entity-specific memorandum |
| P-05 | Who is the legally accountable decision-maker and appeal body? | Legal/operations | Role registry and staffing | Contracts, qualification, conflict policy |
| P-06 | Which countries may sponsor, enroll, review, and receive payment? | Legal/privacy/treasury | Launch geography | Written jurisdiction matrix |
| P-07 | What data is strictly necessary for each covered event? | Clinical/privacy | Evidence schema and retention | Evidence mapping and reviewer validation |
| P-08 | Does a sponsor value public reserve/settlement verification enough to change buying behavior? | Product/revenue | Scope of onchain product | Interview and prototype behavior |
| P-09 | Can a member complete the flow without prior crypto knowledge? | Product | Wallet/AA design | Moderated tests and activation rate |
| P-10 | Which licensed or service partners are mandatory? | Legal/operations | Commercial architecture | Written role and responsibility analysis |

## Technical and Economic Open Questions

| ID | Question | Owner | Blocking decision | Required evidence |
| --- | --- | --- | --- | --- |
| T-01 | Is USDG acceptable for sponsor custody, member receipt, liquidity, and depeg risk? | Treasury/legal | Funding asset | Issuer, redemption, liquidity, custody, and incident assessment |
| T-02 | Which AA/paymaster provider meets policy, availability, recovery, and cost needs? | Product/protocol/security | Member and sponsor UX | Testnet integration and failure rehearsal |
| T-03 | Which RPC/indexing providers meet production needs? | Protocol/operations | Mainnet readiness | Measured testnet reliability and failover |
| T-04 | Can existing contract primitives satisfy the new accounting and authority invariants? | Protocol/security | Reuse versus rewrite | Written invariant review and tests |
| T-05 | What finality level applies to activation, obligation, settlement, and public reporting? | Protocol/treasury | State machine and UX | Robinhood/Ethereum behavior and value-at-risk policy |
| T-06 | What is the complete per-program delivery cost? | Finance/operations | Price and GTM model | Real staff time, vendors, gas, support, review, and legal costs |
| T-07 | What agent task produces measurable time or quality improvement first? | Agent/product | Agent launch scope | Controlled task evaluation with human baseline |
| T-08 | Can ACP deliver a paid public job with acceptable fees and no sensitive data? | Agent/platform | Marketplace and token utility claim | Accepted external production job and reconciliation |
| T-09 | What exact action requires `$NAKAMA` rather than USDG, credentials, reputation, or contracts? | Governance/product | Token launch | Production role, adversarial design, and legal review |
| T-10 | Does Robinhood outperform a generic EVM path for this product? | Founder/protocol/product | Long-term native commitment | Pilot UX, cost, distribution, partner, and reliability evidence |

## Written Questions for Robinhood and Virtuals

### Robinhood Chain

1. Which production RPC, indexer, AA, paymaster, bridge, stablecoin, custody, and
   monitoring partners are recommended for a funded member-support program?
2. What chain, sequencer, validator, sanctions-screening, emergency, and
   upgrade behavior should a time-sensitive settlement product design for?
3. What factual language may a deployed project use, and is any ecosystem,
   technical, grant, RWA, or distribution review available?
4. What is the authoritative USDG integration, issuer, redemption, bridge, and
   liquidity path for Robinhood Chain?
5. Are there planned changes that affect chain IDs, RPC, finality, account
   abstraction, explorer, or canonical bridge behavior during the pilot window?

### Virtuals

1. Is the proposed sponsor-funded health-support product and its non-PHI ACP
   services permitted?
2. How do Malaysia restrictions apply to the creator entity, beneficial owner,
   founder, employees, operators, signers, and access location?
3. Which exact Robinhood creation path, fee, allocation, curve, graduation,
   liquidity, vesting, anti-sniper, trading-fee, and ACF parameters apply?
   Is 60 Days available on Robinhood, and which refund/wind-down contracts and
   asset flows govern it?
4. Which addresses and legal parties receive team, ACF, ecosystem, creator-fee,
   and ACP allocations, in which asset?
5. What KYC/KYB, legal opinion, token classification, sanctions, and marketing
   materials are required?
6. What admin, proxy, pause, oracle, slippage, upgrade, dispute, and emergency
   controls affect launch and ACP?
7. Which parts of review, Butler discovery, technical support, partner
   introductions, and launch amplification are available, and which are never
   guaranteed?
8. Can a tokenless ACP agent operate first and link the same agent to one token
   later without losing job history or reputation?
9. Why does the ACP package label Robinhood USDG as USDC, and what corrected
   release or integration guidance should Nakama use?
10. What brand and public-language permissions apply to factual use of the
    platform?

## Evidence Packet Required for a Go Decision

### Funded-program packet

- qualified sponsor record and costly demand evidence
- signed scope, price, full program budget, and payment receipt
- legal classification and jurisdiction matrix
- approved member terms, privacy notice, and communications
- exact benefit and maximum-liability model
- stablecoin, custody, liquidity, bridge, and incident assessment
- reviewer, appeal, support, and emergency staffing
- private evidence control test
- contract review, verified deployment manifest, and complete testnet run
- member usability and comprehension results
- signed activation checklist

### Token-launch packet

- passed funded-program gate or documented board-level exception consistent
  with this strategy
- paid external agent work and token-necessity statement
- platform and Malaysia eligibility in writing
- token/financial-promotion legal memorandum
- generated launch transaction decoded and independently reviewed
- exact addresses, beneficiaries, allocations, curve, fees, ACF, vesting,
  anti-sniper, liquidity, admin, and upgrade register
- treasury, custody, market-conduct, disclosure, tax, and incident policies
- twelve-month operating and communications plan independent of token price
- public risk, non-utility, product-separation, and platform disclosures

## Refresh Procedure

1. Freeze the intended action and environment.
2. Read current official documentation and terms.
3. Read live proxy implementations, admins, configuration, balances, fees, and
   paused state from two RPC providers.
4. Generate, decode, and simulate the exact transaction without signing.
5. Compare every field with approved tokenomics, legal advice, treasury policy,
   and public copy.
6. Resolve conflicts in writing with the platform or remove the dependent
   claim/action.
7. Record source, timestamp, block, chain ID, bytecode, and reviewer sign-off in
   a release evidence packet.
8. Sign through the approved threshold process and verify post-transaction
   state independently.

Evidence expires when a contract upgrades, terms change, configuration changes,
a new jurisdiction or entity is introduced, a product promise changes, or the
specified review window closes. "We checked this before" is not a launch
control.
