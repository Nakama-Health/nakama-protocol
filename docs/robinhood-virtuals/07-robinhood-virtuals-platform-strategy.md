# Robinhood Chain and Virtuals Platform Strategy

Evidence date: 2026-07-22

## Decision

Use Robinhood Chain as the proposed native execution environment for the
Nakama program contracts, stablecoin budgets, member economic records,
Virtuals token, and ACP commerce. Use Virtuals for productive-agent identity,
agent distribution, ACP services, tokenization, and conditional capital
formation.

This can be a real single-chain system. Robinhood mainnet is live, the current
Virtuals launch interface exposes Robinhood, the current BondingV5 contracts are
deployed there, and Virtuals ACP Node v2 explicitly supports Robinhood mainnet
and testnet.

The decision is conditional because the platform is young and several live
contract parameters conflict with published documentation. The product should
remain EVM-portable, with Robinhood-specific code isolated in configuration,
finality, asset, account-abstraction, and platform adapters.

## What Robinhood Chain Actually Provides

Current official documentation describes Robinhood Chain as a permissionless,
Ethereum-compatible Arbitrum Layer 2 using ETH for gas. Mainnet chain ID is
`4663`; testnet is `46630`. Standard Solidity, Foundry, Hardhat, viem, ethers,
and EVM wallet tooling apply.

Useful product capabilities include:

- low-cost EVM execution for bounded program actions and small settlements
- Robinhood Wallet and standard EVM-wallet compatibility
- account-abstraction infrastructure for sponsored gas, batched actions,
  session keys, and policy-controlled smart accounts
- public Blockscout verification
- canonical and partner bridge routes
- an ecosystem oriented toward tokenized financial and real-world assets
- native deployment of Virtuals `$VIRTUAL`, launch contracts, and ACP

Primary sources:

- [Robinhood Chain mainnet announcement](https://robinhood.com/us/en/newsroom/robinhood-accelerates-global-expansion-robinhood-chain-mainnet-stock-tokens-agentic-trading/)
- [Robinhood Chain overview](https://docs.robinhood.com/chain/)
- [Network configuration](https://docs.robinhood.com/chain/connecting/)
- [Contract deployment](https://docs.robinhood.com/chain/deploy-smart-contracts/)
- [Account abstraction](https://docs.robinhood.com/chain/account-abstraction/)
- [Bridging](https://docs.robinhood.com/chain/bridging/)
- [Governance](https://docs.robinhood.com/chain/governance/)

## What Robinhood Chain Does Not Provide

Deployment does not provide:

- Robinhood brokerage or crypto-app listing
- access to brokerage customers
- distribution through Robinhood's regulated products
- regulatory approval, insurance authority, custody, or suitability review
- liquidity, market making, promotion, grants, or technical support
- endorsement of Nakama, its token, agent, or health product

Robinhood's own support material says the chain is separate from brokerage and
crypto accounts. Public copy may say **deployed on Robinhood Chain** after a
verified deployment. It may not say **launched with Robinhood**, **available on
Robinhood**, or **approved by Robinhood** without a separate written agreement.

## Why Robinhood Is Strategically Coherent

### One native financial environment

The protection contracts, stablecoin program budget, Virtuals agent token, ACP
jobs, and agent wallet can operate on the same chain. That removes routine
cross-chain reconciliation from the first product.

### Better member abstraction

Account abstraction can hide gas, batch safe actions, limit session keys, and
create familiar onboarding. The member experience can begin with email or
passkey rather than bridge and gas instructions.

### Financial and RWA adjacency

Robinhood Chain's asset and infrastructure focus may later support conservative
reserve assets or capital integrations. This is optional upside. Nakama should
not lead with RWA until a specific legal asset, issuer, custody, valuation, and
redemption path is approved.

### Early ecosystem timing

A functioning health-protection product can be distinctive in an early chain
ecosystem. Early status also means less mature liquidity, infrastructure,
operating history, tooling, and incident evidence. It is an execution advantage
only if Nakama ships proof quickly and remains portable.

## Robinhood Risks

### Governance concentration

Official governance documentation describes an eight-member Security Council,
including two Robinhood seats, and currently permissioned BoLD validators. The
chain should not be described as fully decentralized or free of institutional
control.

### Sequencer and compliance controls

The chain has an Arbitrum sequencer and documented screening or control
assumptions. Nakama needs clear operational behavior for sequencer downtime,
rejected transactions, RPC disagreement, and emergency upgrades.

### Finality

Fast L2 confirmation is not the same as Ethereum finality. The product should
model at least:

- `SUBMITTED`
- `SOFT_CONFIRMED`
- `L1_POSTED`
- `FINALIZED`
- `REVERTED_OR_REORGED`

High-value activation, reserve release, and public proof should use the finality
level appropriate to the consequence.

### Bridge liquidity

The canonical withdrawal path inherits the Arbitrum challenge period and may
take roughly seven days. Protection operations need prefunded Robinhood
liquidity. Fast bridges must be treated as separate contract, liquidity, and
counterparty dependencies, never implicit reserve guarantees.

### RPC and indexing

Robinhood disclaims availability and completeness guarantees for public RPC.
Production must use managed primary and independent secondary RPCs, a rebuildable
indexer, transaction reconciliation, and explorer verification.

### Stablecoin identity

Robinhood's documented native stablecoin at
`0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168` identifies onchain as **Global
Dollar (`USDG`)**, six decimals. Virtuals ACP v2 currently stores this address
under a `USDC_ADDRESSES` constant and exports `USDC` as the symbol. Nakama must
reject that label and bind address, name, symbol, decimals, issuer, and chain in
its asset registry.

No user-facing or signed record may call USDG "USDC." A genuine USDC path would
require a different verified contract or an explicit conversion step.

## Why Virtuals Fits

Virtuals is designed around productive AI agents and AI-native businesses that
perform economic work, coordinate through ACP, and can be tokenized. Nakama's
agent can perform real, bounded work in program design, public reserve analysis,
terms translation, operational audit, and workflow coordination.

Virtuals can provide:

- an agent identity and profile
- ACP discovery, negotiation, escrow, evaluation, and settlement
- connection to Butler and other agent users
- a token launch through current Robinhood contracts
- standardized liquidity and vesting machinery
- a visible build-in-public community
- conditional creator fees and Automated Capital Formation

Current documentation also describes a Titan class for established projects
using a direct-liquidity launch, a minimum `$50M` launch FDV, and at least
`$500,000` USDC worth of `$VIRTUAL` liquidity. It is not a credible Genesis
route for an unproven Nakama product and should not be used to manufacture an
institutional narrative.

Virtuals also documents a separate **60 Days** framework in which a founder
builds publicly for sixty days and then commits or winds the token down, with
defined refund treatment for specified locked funds. The mechanism is
strategically relevant because it introduces a reversible decision, but this
research did not verify that it is available on Robinhood Chain. Its stipend,
ACF, Growth Allocation, refund, token-wind-down, tax, and founder-commitment
behavior need the same legal and transaction-level review as a normal launch.

Sources:

- [Virtuals 60 Days overview](https://whitepaper.virtuals.io/about-virtuals/tokenization/60-days)
- [60 Days economic model](https://whitepaper.virtuals.io/about-virtuals/tokenization/60-days/economic-model)

Virtuals does not provide the health-product legal wrapper, medical validity,
claims authority, reserve capital, or customer PMF.

## Permissionless Is Not Curated

The [Virtuals Launchpad Developer Agreement](https://app.virtuals.io/launchpad_agreement.pdf)
describes a permissionless launchpad and explicitly disclaims any guarantee of
participation, trading volume, token value, or success. It also gives Virtuals
the right to remove a project from its interface even though the token remains
onchain.

The practical distinction is:

- **deployment:** ordinarily permissionless through current contracts
- **continued interface access:** subject to platform control
- **discovery, Butler visibility, team support, partner introductions, and
  amplification:** curated and not guaranteed
- **Robinhood app or brokerage distribution:** separate and not implied

Nakama should meet a curated-quality bar without describing that bar as formal
approval until it receives written confirmation.

## ACP-Native Architecture

The current `@virtuals-protocol/acp-node-v2` source includes Robinhood mainnet
and testnet. ACP can therefore run alongside Nakama contracts without using
Base for every job.

Current source:

- [ACP v2 chain configuration](https://github.com/Virtual-Protocol/acp-node-v2/blob/main/src/core/chains.ts)
- [ACP v2 constants](https://github.com/Virtual-Protocol/acp-node-v2/blob/main/src/core/constants.ts)
- [ACP architecture](https://whitepaper.virtuals.io/acp-product-resources/acp-concepts-terminologies-and-architecture)

The SDK is young. The inspected package was version `0.1.9` and its package
test command remained a placeholder. Nakama must:

- pin an exact version and commit
- wrap ACP behind a Nakama-owned adapter
- model fees and contracts dynamically
- override the incorrect USDG/USDC label
- add lifecycle, reconnect, idempotency, fee, pause, upgrade, and settlement
  tests
- keep PHI and private evidence outside ACP
- cap the ACP operating wallet separately from program vaults

## Current Platform Snapshot

The following values are evidence snapshots, not immutable promises:

| Item | 2026-07-22 snapshot | Treatment |
| --- | --- | --- |
| Robinhood `$VIRTUAL` | `0xc6911796042b15d7Fa4F6CDe69e245DdCd3d9c31` | Verify bytecode, proxy, symbol, and decimals before use |
| Virtuals BondingV5 | `0xd4cCBFA37e2f35611b3042e4096Ad7a3459Bd007` | Upgradeable dependency; monitor implementation/admin |
| BondingConfig | `0x3e331Fdd9Fe54D5047b1B7339Fd5c91977D53e2F` | Fetch every launch parameter before signing |
| AgentFactory | `0x43e4c17b15365596caae8e7d00e42bc8e988c2d4` | Verify LP and token-factory behavior |
| ACP | `0x238E541BfefD82238730D00a2208E5497F1832E0` | Monitor fee, pause, admin, and implementation changes |
| Native ACP asset | USDG at `0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168` | Never label as USDC |
| Agent-token supply | 1,000,000,000 | Platform configuration, not an economic-value claim |
| Graduation target | 42,000 real `$VIRTUAL` | Token-demand milestone, not PMF |
| LP maturity | 315,360,000 seconds, approximately ten 365-day years | Confirm in actual transaction |
| Scheduled-launch delay | 86,400 seconds | Minimum delay, not approval |
| Standard launch fee | Contract/UI showed 0 `$VIRTUAL` | Mutable and conflicts with whitepaper |
| ACF launch fee | Contract calculation showed 10 `$VIRTUAL` | Mutable and must be transaction-confirmed |

These addresses and values belong in a generated deployment snapshot during
implementation, not hardcoded permanently from this strategy document.

## Material Documentation Conflicts

| Topic | Published documentation | Current Robinhood observation | Required action |
| --- | --- | --- | --- |
| Creation fee | 1,000 `$VIRTUAL` | 0 standard / 10 ACF | Confirm generated transaction and obtain written answer |
| Settlement asset | Often described as USDC | Native address is USDG; ACP code mislabels it | Use explicit USDG and block symbol/address mismatch |
| ACP fees | Older 80/20 descriptions | Live contract observed 95/5 or 90/5/5 with evaluator | Read live fees and agree economics before listing jobs |
| Ecosystem airdrop | Documented 5% | Contract configuration permits 0–5% | Inspect exact launch allocation |
| Anti-sniper | Documented 98-minute decay | Current Robinhood type appears to use a 60-second mode | Simulate exact configuration; do not pre-announce curve |
| ACF reserve | 25% ACF + 25% team | Config removes combined 50% reserve | Inspect recipient wallets and vesting contracts |
| ACF payout asset | Team-distribution page says proceeds are USDC | Distribution table says ACF is disbursed in `$VIRTUAL` | Trace the actual sale and receiver asset; obtain written confirmation |

## Platform Selection Gate

Robinhood + Virtuals passes only when:

- the exact launch path and generated transaction are understood
- Nakama and its entity/founders are eligible under Virtuals terms
- Virtuals confirms the health/protection and ACP use cases are permitted
- USDG liquidity, issuer, redemption, custody, bridge, and depeg response are
  acceptable
- production RPC, indexing, finality, and monitoring are tested
- account abstraction works without an unrestricted paymaster or session key
- ACP fees, asset, proxy administration, pause, and upgrade risks are accepted
- a mainnet exit or portability path exists if platform access changes

The reviewed Virtuals Terms list Malaysia as a prohibited jurisdiction. Nakama
must document and resolve any Malaysia nexus involving its entity, founder,
operator, employee, signer, access, or user facts before any launch transaction.
Geographic presence, residence, nationality, incorporation, and platform access
are different legal facts; this document does not infer the answer.

## Written Questions for Virtuals

Before launch, ask:

1. Which Robinhood path and configuration apply to Nakama?
   Is the 60 Days framework deployed and supported on Robinhood?
2. Is a health-protection/member-support product permitted, and what wording is
   unacceptable?
3. Can related ACP jobs include funds movement, and what data is prohibited?
4. Which launch fee, allocation, airdrop, vesting, sniper, trading-fee, and ACF
   rules will the generated transaction encode?
5. Does ACF settle in USDG, USDC, `$VIRTUAL`, or through a conversion?
6. Which wallets receive team, ACF, creator-fee, and ecosystem allocations?
7. What admin, pause, upgrade, slippage, oracle, and emergency controls govern
   ACF and ACP?
8. What KYC/KYB, legal opinion, token classification, and jurisdiction evidence
   are required?
9. What, if any, Butler discovery, team review, technical support, partner
   introduction, or launch amplification is available?
10. May Nakama describe factual deployment and collaboration publicly, and
    under what brand rules?

## Recommendation

Build and sell the product through a tokenless ACP agent first. This is directly
supported by current Virtuals guidance and provides better PMF evidence.
Complete the Virtuals token launch only after paid agent work, a funded Genesis
program, written platform eligibility, legal clearance, and exact launch-
transaction review.

This sequence still captures Robinhood/Virtuals timing because the product,
agent, contracts, and evidence all develop natively on the chosen platform. It
avoids making an irreversible token launch the first customer experiment.
