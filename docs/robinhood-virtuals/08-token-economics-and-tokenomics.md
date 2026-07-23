# Token Economics and Tokenomics

Evidence date: 2026-07-22

## Recommendation

Launch `$NAKAMA` only after the Nakama Operator has completed useful paid work,
one sponsor has committed the full Genesis program budget, and the exact
Virtuals/Robinhood launch configuration has passed technical and legal review.

If those gates pass, first ask whether the documented **60 Days** reversible
framework is actually supported on Robinhood and whether its exact wind-down
and refund behavior is acceptable. If it is unavailable and Nakama genuinely
needs performance-linked capital formation, consider a **Unicorn/ACF-style
launch**. If Nakama does not need ACF or cannot accept a 50% combined ACF/team
reserve, use the least concentrated supported route or wait. Do not choose a
launch mechanism simply because it creates the largest founder allocation.

The token must remain economically and legally separate from member protection.

## Three Economic Systems

### 1. Protection economics

- sponsor budgets in Phase 0; legally approved member contributions only in a
  separately gated later model
- segregated USDG or another approved stablecoin
- explicit obligations, payments, refunds, and unused balances
- no dependence on `$NAKAMA` price or liquidity

### 2. Product and agent economics

- design, launch, administration, and software fees
- ACP job revenue and specialist-agent expenses
- operating treasury and payroll
- customer retention and contribution margin

### 3. Token economics

- Virtuals bonding and liquidity
- creator trading fees
- ecosystem allocations
- team vesting
- ACF token sales
- network staking or governance only when a real role exists

Every ledger, wallet, report, and public metric must preserve these boundaries.

## Platform-Defined Supply and Distribution

Current Robinhood BondingV5 configuration creates one billion agent tokens for
the observed Pegasus/Unicorn-style path. Official Virtuals documentation now
describes three launch classes; the two relevant early-stage models are:

| Allocation | Pegasus | Unicorn |
| --- | ---: | ---: |
| Open market / liquidity | 95% | 45% |
| `$VIRTUAL` staker ecosystem | 2% | 2% |
| ACP/Butler ecosystem | 3% | 3% |
| Automated Capital Formation | 0% | 25% |
| Team allocation | 0% | 25% |
| Total | 100% | 100% |

Sources:

- [Virtuals launch classes](https://whitepaper.virtuals.io/about-virtuals/tokenization/agent-tokenization-platform)
- [Token distribution](https://whitepaper.virtuals.io/about-virtuals/tokenization/agent-tokenization-platform/token-distribution-table)
- [Unicorn team distribution](https://whitepaper.virtuals.io/about-virtuals/tokenization/agent-tokenization-platform/unicorn-team-distribution)
- [Ecosystem airdrops](https://whitepaper.virtuals.io/about-virtuals/tokenization/agent-tokenization-platform/pegasus-and-unicorn-ecosystem-airdrops)

Robinhood's current contract configuration can differ from the prose. The
signed launch transaction, recipient wallets, vesting contracts, and live
configuration govern. No public tokenomics page should be finalized from this
table alone.

The third documented class, Titan, is a direct-liquidity route for established
projects with at least a `$50M` launch FDV and at least `$500,000` USDC worth of
`$VIRTUAL` paired as liquidity. Its tokenomics are team-defined. Nakama should
not use Titan for the Genesis launch unless it independently reaches that scale
and the route passes a new distribution, capital, legal, and market-structure
review.

## 60 Days Framework

Virtuals separately documents a reversible 60 Days framework. Founders build
publicly for sixty days and then choose to commit or wind the token down. The
published model says specified locked funds return to supporters after a
non-commit outcome; founder trading-fee share remains locked during the trial;
optional Growth Allocation uses USDC escrow; and a limited founder stipend can
be paid during the period.

This structure may reduce the cost of a premature permanent commitment, but it
does not make token trading a customer-demand test. Nakama should consider it
only after Virtuals confirms Robinhood availability and the exact refund,
wind-down, founder stipend, ACF, Growth Allocation, vesting, tax, liquidity,
admin, and legal behavior. A sponsor-funded program and paid agent work remain
prerequisites.

Sources:

- [60 Days overview](https://whitepaper.virtuals.io/about-virtuals/tokenization/60-days)
- [60 Days economic model](https://whitepaper.virtuals.io/about-virtuals/tokenization/60-days/economic-model)

## Automated Capital Formation

The documented Unicorn model allocates 25% of supply to automated sales as FDV
increases from `$2M` to `$160M`.

| FDV range | Portion sold | Documented model raise | Cumulative model raise |
| --- | ---: | ---: | ---: |
| `$2M–$10M` | 5% | `$300K` | `$300K` |
| `$10M–$20M` | 5% | `$750K` | `$1.05M` |
| `$20M–$40M` | 5% | `$1.5M` | `$2.55M` |
| `$40M–$80M` | 5% | `$3M` | `$5.55M` |
| `$80M–$160M` | 5% | `$6M` | `$11.55M` |

These are simplified estimates published by Virtuals, not guaranteed proceeds.
Actual execution depends on path availability, allocation, prices, liquidity,
oracle/FDV logic, cadence, slippage, taxes, fees, contract behavior, and market
demand.

The current official pages also conflict on the payout asset: the Unicorn team-
distribution page says ACF proceeds are disbursed in USDC, while the token-
distribution table says `$VIRTUAL`. Nakama must treat the asset as unknown until
the actual Robinhood contracts and receiver flow are traced and Virtuals
confirms it in writing.

ACF is automated treasury-token selling. It is not:

- customer revenue
- a grant
- a guaranteed `$100K` payment at `$2M`
- claims-paying reserve
- non-dilutive in the market-supply sense
- evidence of product-market fit

## Team Allocation

Official Unicorn documentation describes 25% team allocation locked for one
year and then vested linearly over six months, with early vesting start if FDV
reaches `$160M`. The price-triggered acceleration creates a potential conflict
between token-market incentives and long-term product execution.

Controls required:

- public beneficiary and wallet register
- vesting contract and bytecode verification
- no undisclosed side letters or derivative claims
- written tax and accounting treatment
- internal policy for transfers, delegation, and custody
- material-wallet alerts
- public explanation that vesting does not create member reserve

## Team Initial Purchase

Virtuals documentation permits an optional team purchase of up to 45% of the
total supply. Nakama's recommendation is **zero team initial purchase** unless a
small amount is required for a documented operational reason and independently
reviewed.

The platform already contains launch and anti-sniper mechanics. Purchasing the
full liquidity allocation would create extreme concentration and contradict a
community-alignment story. If any initial purchase occurs, publish the amount,
source of funds, beneficial owners, price, cliff, vesting, and wallet before
TGE.

## Trading Fees

Current Virtuals documentation states a 1% trading fee split:

- 70% to the creator
- 30% to ACP incentives

Before delegation or other adjustments, the documented creator gross is:

```text
creator fee = eligible trading volume × 1% × 70%
            = eligible trading volume × 0.7%
```

This is a model, not a forecast. The Robinhood contract path, graduated versus
bonding phase, fee delegation, partner share, taxes, asset conversion, and
platform changes can alter realized receipts. Fetch and simulate the live
configuration before publishing any number.

Creator fees go to the operating or protocol treasury under a published policy.
They do not automatically enter program vaults.

## Graduation and Liquidity

The current documented and onchain target is 42,000 real `$VIRTUAL` accumulated
through the bonding system before graduation to an external liquidity pool.
Official documentation states that resulting LP tokens are locked for roughly
ten years.

Graduation demonstrates token demand. It does not demonstrate:

- paid sponsor demand
- protected members
- safe claims operations
- sufficient program capital
- agent productivity
- sustainable product revenue

The launch dashboard must never label graduation as PMF.

## Anti-Sniper Mechanics

Virtuals whitepaper material describes a 99% buy-side tax decaying by one point
per minute for 98 minutes, with collected tax used for token buybacks and team
vesting. The current Robinhood configuration appears to support a different
60-second mode.

Nakama must not pre-announce the tax curve until the exact launch payload is
generated, decoded, simulated, and confirmed in writing. Publish the actual:

- duration
- buy and sell tax schedule
- recipient of tax proceeds
- buyback behavior
- vesting or distribution
- pause or emergency controls

## Token Utility Roadmap

### Phase T0 — productive agent, tokenless

- Nakama Operator sells and completes jobs
- product pays for ACP services from a capped operating wallet
- no token is required for any member action

This phase proves that the agent performs economic work.

### Phase T1 — launch and ecosystem coordination

At TGE, honest utility may include:

- participation in public product and treasury-governance discussions
- proposals and votes over ecosystem grants and non-member public goods where
  legally supported
- access or fee discounts for public, non-clinical agent services
- contributor and developer incentives tied to verified work
- delegation signals toward agent and operator reputation

Do not activate staking or slashing merely to create token demand.

### Phase T2 — operator and evaluator security

Only after independent operators or evaluators exist:

- an operator posts a bond against objective service duties
- an evaluator posts a bond against signed, reviewable commitments
- delegation can signal support but does not replace qualification
- rewards derive from real fees or an explicitly budgeted incentive program
- slashing follows a documented dispute and appeal process

Token price must not be the only security budget. High-consequence roles also
need identity, contracts, insurance/indemnity where appropriate, and legal
accountability.

### Phase T3 — network governance

Governance may coordinate:

- template admission and deprecation for future programs
- operator/evaluator registry policy
- public protocol upgrades for new deployments
- ecosystem grants
- treasury budgets
- non-sensitive protocol fees

It may never:

- alter active program terms
- decide an individual claim or appeal
- inspect private member evidence
- move segregated program funds
- reduce an existing member obligation
- force a member to hold `$NAKAMA`

## Token Stake Design Requirements

Before staking ships, define:

- the exact duty being secured
- the objective evidence of breach
- who may initiate a dispute
- independent review and appeal
- maximum slash and destination
- correlation between stake value and maximum harm
- collusion and sybil resistance
- treatment during token volatility
- exit delay and unresolved-duty lock
- legal enforceability and tax/accounting treatment

If the duty cannot be evaluated objectively enough to support fair slashing,
use reputation, contractual liability, or insurance rather than pretending the
token solves accountability.

## Treasury and Wallet Segregation

| Wallet/vault | Permitted assets | Permitted use | Prohibited use |
| --- | --- | --- | --- |
| Program vault | Approved stablecoin only | Member obligations, approved refunds, disclosed program expenses if terms allow | Payroll, token liquidity, ACP jobs, buybacks |
| Operating treasury | Stablecoins/fiat as approved | Payroll, vendors, GTM, product operations | Representing balance as claims reserve |
| Protocol treasury | `$NAKAMA`, stablecoins, ecosystem assets | Security, public infrastructure, grants, governance-approved work | Individual claim decisions or undisclosed reserve subsidy |
| ACP operating wallet | Explicit capped ACP job asset | Buying/selling agent services | Medical evidence storage or program reserve custody |
| Team vesting wallets | `$NAKAMA` | Vesting and disclosed team ownership | Hidden market making or reserve representation |
| Launch/creator-fee wallet | Platform receipts | Transfer under treasury policy | Direct commingling with program vault |

## Public Token Disclosures

Publish before TGE:

- exact supply and decimals
- launch class and chain
- every allocation and recipient type
- every vest, cliff, unlock, and price-triggered acceleration
- team initial purchase, if any
- curve, graduation, liquidity lock, and anti-sniper behavior
- trading fees and recipient split
- ACF formula, asset, execution, controls, and modeled—not guaranteed—proceeds
- proxy, upgrade, pause, and admin dependencies
- treasury and use-of-funds principles
- token utility and explicit non-utility
- health-product and member-reserve separation
- legal entity, terms, jurisdiction restrictions, and risk factors

## Token Success Metrics

Healthy token metrics include:

- concentration excluding platform-controlled vesting and LP contracts
- percentage of holders participating in productive network actions
- paid agent jobs linked to the tokenized agent
- protocol contributors rewarded for verified work
- independent operator/evaluator participation when those roles launch
- transparent treasury runway and spending
- sustained liquidity without hidden team support

Price, FDV, volume, and holder count remain market metrics. They should be
reported, but never promoted as proof that members or sponsors value Nakama.

## Token Launch Vetoes

Do not launch when:

- the utility relies on future operators that do not exist
- the project needs token buyers to finance the first customer test
- exact allocations or vesting recipients are unclear
- the team or entity is ineligible under platform terms
- public copy implies revenue sharing, guaranteed appreciation, or reserve
  rights without legal clearance
- ACF asset and controls are unresolved
- token/admin keys are not under reviewed multisig custody
- product, token, ACP, and program wallets can be confused
- no external user has paid for a useful Nakama Operator job
- no sponsor has made a costly product commitment
