# Nakama on Robinhood Chain and Virtuals

Status: strategy complete; Phase 0 source implementation candidate; not deployed
Evidence date: 2026-07-23
Primary owner: Nakama Protocol
Target launch path: Robinhood Chain + Virtuals Protocol

This folder is the self-contained strategy and execution package for a new
Robinhood Chain and Virtuals-native version of Nakama. It deliberately starts
from the desired product and market rather than treating the existing Solana or
Ethereum implementations as architectural constraints.

The proposal is ambitious but specific. The first product is deliberately
narrower than the category it is intended to unlock:

> Nakama turns trusted communities into autonomous mutuals.

An autonomous mutual is the long-term category: a community safety net with explicit terms,
segregated stablecoin reserves, private evidence handling, accountable human
oversight, and agents that perform the repetitive operating work. Health
protection for paid international cohorts is the first commercial beachhead.
Phase 0 is a sponsor-funded protection program, not a member-funded mutual and
not an insurance claim. The long-term protocol can support other bounded
protection markets only after the first program works and counsel approves the
relevant structure.

## What This Package Decides

The current recommended direction is:

- **Long-term category:** autonomous mutuals, described publicly only after a
  real operating structure exists. Current customer copy says sponsor-funded,
  human-led, agent-assisted health support.
- **Company and network:** Nakama.
- **First buyer:** an operator of a trusted, globally distributed community.
- **First member use case:** portable, bounded health protection for a defined
  travel or residency window.
- **Current product:** one sponsor-funded Genesis Protection Program for a
  defined cohort, not a general-purpose insurance DAO or a public mutual.
- **Agent:** the Nakama Operator, an AI operations assistant that drafts
  program options, organizes work, monitors deadlines, and prepares reports.
  People approve activation, decisions, and payments.
- **Token:** `$NAKAMA`, prepared for a conditional Virtuals launch on Robinhood
  Chain only after product, legal, technical, and platform gates pass. Its
  intended role is operator/evaluator accountability and network coordination,
  never medical payouts or reserve backing.
- **Settlement:** stablecoins in segregated pool vaults on Robinhood Chain,
  subject to asset, liquidity, custody, and legal confirmation.
- **Privacy:** raw medical, identity, and dispute records remain encrypted
  offchain. The chain receives commitments, permissions, bounded economic
  state, and settlement receipts.
- **Decision model:** agents recommend and prepare; accountable people approve
  sensitive or adverse benefit decisions in the first release.

These are target decisions, not claims that the corresponding product,
contracts, partnership, token, reserve, or legal permissions are live.

## The Two Proof Systems

Nakama must maintain two independent scoreboards.

The **product scoreboard** measures paid design partners, funded programs,
activated members, renewals, support-request handling, budget adequacy, and
operating margin. This is the product-market-fit scoreboard.

The **token scoreboard** measures holder distribution, liquidity, trading
volume, creator-fee receipts, and Automated Capital Formation milestones. This
is a capital formation and market-health scoreboard.

Token performance does not answer whether customers care, change behavior, or
pay enough. Product usage does not by itself make the token necessary. A launch
is healthy only when both systems are honest and the token strengthens the
product without placing member protection behind speculation.

## Reading Order

### Strategy

1. [Executive Thesis](./00-executive-thesis.md)
2. [Category, Vision, and Product](./01-category-vision-and-product.md)
3. [Arc PMF Diagnosis](./02-arc-pmf-and-market-wedge.md)
4. [Genesis Product Specification](./03-genesis-product-spec.md)
5. [Business Model and Unit Economics](./04-business-model-and-unit-economics.md)
6. [Narrative, Brand, and Communications](./05-narrative-brand-and-communications.md)
7. [Go-to-Market and Launch](./06-go-to-market-and-launch.md)
8. [Robinhood and Virtuals Platform Strategy](./07-robinhood-virtuals-platform-strategy.md)
9. [Token Economics and Tokenomics](./08-token-economics-and-tokenomics.md)
10. [Web3, Decentralization, and Governance](./09-web3-decentralization-and-governance.md)
11. [Agent and ACP Product](./10-agent-and-acp-product.md)
12. [Technical Architecture](./11-technical-architecture.md)
13. [Trust, Privacy, Legal, and Safety](./12-trust-privacy-legal-and-safety.md)
14. [Metrics and Operating Cadence](./13-success-metrics-and-operating-cadence.md)
15. [Adversarial Review and Kill Criteria](./14-adversarial-review-and-kill-criteria.md)
16. [Evidence Register and Open Questions](./15-evidence-register-and-open-questions.md)

### Implementation

1. [Implementation Index](./implementation/README.md)
2. [Master Roadmap](./implementation/00-master-roadmap.md)
3. [Protocol Contracts](./implementation/01-protocol-contracts.md)
4. [Agent, Data, and Services](./implementation/02-agent-data-and-services.md)
5. [SDK, App, and Web](./implementation/03-sdk-app-and-web.md)
6. [Virtuals Token Launch](./implementation/04-virtuals-token-launch.md)
7. [GTM, Content, and Partnerships](./implementation/05-gtm-content-and-partnerships.md)
8. [Security, Legal, and Release Gates](./implementation/06-security-legal-and-release-gates.md)
9. [Ninety-Day Backlog](./implementation/07-90-day-backlog.md)
10. [Decision Register](./implementation/08-decision-register.md)
11. [Current Implementation Status](./implementation/09-current-implementation-status.md)

The [Five-Pass Review Log](./PASS_LOG.md) records how this package was built and
challenged.

## Source-of-Truth Rules

Every material statement should be interpreted as one of four types:

- **Verified platform fact:** supported by a current official source or direct
  onchain observation and dated in the evidence register.
- **Internal evidence:** supported by a named, reviewable Nakama artifact but
  not necessarily validated by an independent party.
- **Hypothesis:** a market, pricing, product, or technical proposition that must
  be tested.
- **Decision:** the current recommendation, which remains reversible until its
  stated gate passes.

When documents disagree, the evidence register and decision register govern.
When the implementation differs from this package, public copy must describe
the implementation rather than the roadmap.

## Non-Negotiable Boundaries

- Do not call a token launch Robinhood brokerage distribution, listing,
  endorsement, or approval.
- Do not claim Virtuals guarantees attention, trading volume, price support,
  graduation, funding, or curation.
- Do not count token market capitalization as customer demand.
- Do not automatically treat token-sale or ACF proceeds as claims-paying
  reserve.
- Do not require members to buy or hold `$NAKAMA` to receive a benefit they
  already paid for.
- Do not let token holders inspect medical evidence or vote on individual
  claims.
- Do not put raw medical or identity records on a public chain.
- Do not use "mutual aid," "protection," or "discretionary" as a substitute
  for jurisdiction-specific legal analysis.
- Do not describe an agent recommendation as an autonomous final medical or
  benefit decision.
- Do not use an adjacent community, including Network School, as a claimed
  customer, partner, or endorsement without written permission.

## Definition of Success

The launch succeeds when Nakama proves all of the following in sequence:

1. A qualified community operator pays for a Protection Design Sprint.
2. The community and Nakama agree who the program is for, what it may support,
   its dates and limits, and who is responsible.
3. The complete sponsor-funded program budget is posted in a segregated vault
   before activation.
4. Real eligible members enroll in the sponsor-funded program.
5. The Nakama Operator reduces setup, administration, or review work enough to
   create measurable economic value.
6. Any support request is handled according to published terms, with private
   documents, a human decision, an appeal path, and a payment record that does
   not rely on network confirmation alone.
7. The first community renews, expands, or refers another qualified operator.
8. If its independent launch gate passes, `$NAKAMA` develops utility from real
   operator, evaluator, and agent activity rather than from a narrative-only
   staking loop.

Everything before step one is preparation. Everything after a token launch but
before steps one through seven remains capital-market activity, not PMF.
