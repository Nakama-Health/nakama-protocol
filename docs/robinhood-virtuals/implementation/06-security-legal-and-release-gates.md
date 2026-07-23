# Security, Legal, and Release Gates

## Purpose

This is the go/no-go control plane for the Genesis Protection Program and the
separate `$NAKAMA` token decision. A feature-complete build does not launch
until its real entities, terms, funding, infrastructure, people, and failure
paths pass.

Each gate has one accountable owner, one independent reviewer where required,
dated evidence, expiry conditions, and an explicit `PASS`, `FAIL`, or `BLOCKED`
decision. `Conditional pass` is permitted only when the condition is completed
before the dependent action.

## Release Levels

| Level | Permitted activity | Prohibited activity |
| --- | --- | --- |
| L0 — local | Synthetic data, mock assets, local accounts | External user promise, production data, public traction claim |
| L1 — Robinhood testnet | Invited testers, synthetic scenarios, test assets, wallet/AA/ACP experiments | Real program budget, real health evidence, customer benefit promise |
| L2 — mainnet shadow | Verified unfunded deployments, indexer/monitoring, low-value synthetic action | Enrollment, program promise, member evidence, sponsor budget |
| L3 — funded pilot | One approved sponsor/cohort/terms/budget with named operations | New geography/product/template, permissionless creation, token-dependent member flow |
| L4 — repeated production | Additional programs using approved standard versions | Scope expansion without its own gate |
| LT — token launch | Exact approved token creation and ongoing operations | Member reserve/claim integration, unsupported utility, unverified mechanics |

Promotion is one-way only after evidence. A shadow deployment is not production
because the UI is publicly reachable.

## Gate Owners

| Gate | Accountable owner | Required independent review |
| --- | --- | --- |
| Customer and sponsor | Founder/revenue | Product/finance |
| Product and clinical | Product/clinical lead | Operations/legal |
| Legal structure | Counsel/accountable legal owner | Second specialist where classification is material |
| Privacy/data | Privacy owner | Security and legal |
| Program economics and USDG | Finance/treasury | Protocol and legal |
| Smart contracts | Protocol lead | Independent security reviewer |
| Services and agent | Backend/agent lead | Security/privacy/product |
| Operations and member safety | Operations lead | Product/clinical/privacy |
| Deployment and roles | Release owner | Protocol/security/treasury |
| Public communications | Communications owner | Legal/product/evidence owner |
| Token | Founder/governance/finance | Token counsel, security, treasury, independent adversarial reviewer |

The same founder may be accountable for multiple gates but cannot be the only
reviewer for contracts, treasury, member decisions, legal classification, or a
token transaction from which they benefit.

## G-01 — Customer and Sponsor Gate

Required evidence:

- named legal sponsor entity and decision-maker
- qualified ICP criteria: cohort, date, prior incident/current alternative,
  budget, authority, roster, and legal geography
- paid design scope and collected payment
- complete pilot scope and sponsor responsibilities
- implementation/administration fees separated from program budget
- complete program budget committed under signed terms
- permission for any public name, logo, quote, case study, or metrics
- no token purchase/allocation as consideration for sponsor participation unless
  separately reviewed and disclosed

Fail when the sponsor is an audience, connector, unpaid collaborator, or
marketing partner without authority and complete funding.

## G-02 — Product and Clinical Gate

Required evidence:

- exact cohort, dates, eligibility, geography, benefit schedule, per-member cap,
  aggregate cap, exclusions, waiting/filing rules, evidence, and termination
- clear distinction between benefit administration, medical advice, emergency
  care, navigation, and provider responsibility
- member comprehension testing at or above the agreed threshold
- urgent-care and emergency escalation reviewed by qualified owner
- primary and appeal reviewer qualifications, capacity, conflicts, and service
  levels
- standard, missing-information, denial, appeal, urgent, payment, and closure
  scenarios exercised
- member support and authorized-representative path

Fail when the product requires the agent to diagnose, delays urgent care,
cannot explain denial/appeal, or promises a benefit outside funded scope.

## G-03 — Legal and Entity Gate

Required evidence:

- written classification for the actual entity, sponsor, member relationship,
  jurisdictions, funding, benefit, discretion/entitlement, decision, custody,
  settlement, fees, and communications
- required licenses/registrations and named responsible parties
- signed sponsor agreement, member terms, privacy notice, consent or other legal
  basis, complaints, appeals, refunds, and termination
- sanctions, KYC/KYB, AML, consumer, payments, tax, health, advertising, and
  cross-border responsibilities mapped
- regulated/service partners contracted where required
- website, app, deck, agent, partner, and support language reviewed
- legal opinion expiry and change triggers recorded

Fail when the plan depends on the words "mutual aid," "discretionary," or
"protocol" to avoid analyzing actual substance.

## G-04 — Privacy and Evidence Gate

Required evidence:

- controller/processor/business-associate or equivalent role map
- data inventory, purpose, legal basis, region, processor, access, retention,
  export, correction, deletion, and breach requirements
- data-protection impact/risk assessment where appropriate
- processor contracts and training/retention/subprocessor terms
- isolated evidence service with per-request encryption and KMS
- access-control, tenant-isolation, malware, logging, redaction, backup,
  restore, export, deletion, and incident tests
- no PHI in chain, general logs, analytics, notifications, support tools, ACP,
  or unauthorized model context
- member rights and complaint flow tested

Fail on any unrestricted administrator/model/ACP path to restricted data or an
untested deletion/access process.

## G-05 — Economic, Treasury, and USDG Gate

Required evidence:

- signed maximum-liability and complete-funding calculation
- exact Robinhood USDG contract, decimals, issuer, legal claim, reserves,
  redemption, liquidity, custody, bridge, freeze/upgrade, and depeg assessment
- sponsor funding route and source-of-funds controls
- program, operating, protocol, ACP, creator-fee, and team wallets/vaults
  separated
- threshold signers, devices, recovery, rotation, limits, and monitoring tested
- prefunding plan; no reliance on delayed bridge after a request
- program accounting reconciled to actual token balance
- unused-budget, refund, fee, tax, and emergency behavior matches terms
- operating runway does not rely on token price, creator fees, ACF, or unused
  sponsor budget

Fail if actual assets are below required encumbrance or if USDG cannot be
reliably held and delivered for the promised amount.

## G-06 — Smart-Contract Gate

Required evidence:

- approved specification and trust model
- minimal immutable/versioned suite and bounded privileges
- unit, integration, property, invariant, fuzz, differential, network, and
  adversarial tests
- independent code/security review with all critical/high findings closed
- verified compiler, dependencies, source, bytecode, deployment scripts, and
  reproducible artifact
- role, pause, recovery, and no-quorum exercises
- exact event/privacy review
- gas and denial-of-service analysis for expected/max cohort
- generated ABI/address manifest and downstream compatibility
- mainnet cap and known-risk acceptance

Fail on unresolved accounting, authorization, settlement, initializer,
reentrancy, signature replay, upgrade/admin, or permanent-lock risk.

## G-07 — Application, Agent, and ACP Gate

Required evidence:

- authorization and tenant-isolation tests across all roles
- idempotency and state-machine tests for every workflow side effect
- dual RPC, finality, reorg, indexer replay, and reconciliation tests
- AA/paymaster policy limits and recovery tests
- agent tool schemas, data policy, evaluation, human fallback, and rollback
- zero successful unauthorized tool/data/economic actions
- no severe agent leakage or harmful-error result
- exact ACP package pin, code review, USDG override, fee/config read, distinct
  wallet, safe job schema, kill switch, and lifecycle reconciliation
- model, processor, and service outages rehearsed
- public app status follows finalized/reconciled state

Fail if the product can create duplicate obligations/settlements, expose PHI,
or continue an unsafe economic action during divergence.

## G-08 — Operations and Member-Safety Gate

Required evidence:

- named primary/backup operators, reviewers, appeal reviewers, treasury,
  privacy, security, support, and incident responders
- coverage calendar and escalation contacts
- standard operating procedures for enrollment, requests, evidence, review,
  appeals, settlement, refunds, closure, support, and complaints
- daily financial/service/technical controls
- missed-SLA, no-reviewer, lost-signer, chain-outage, USDG, evidence-breach,
  agent-error, and mistaken-decision exercises
- manual continuity for critical workflows
- incident severity, notification, containment, recovery, and postmortem process
- member and sponsor contact that remains available during technical outage

Fail when a critical role exists only as an agent, one unavailable founder, or
an undocumented third party.

## G-09 — Deployment and Mainnet Activation Gate

Required evidence:

- mainnet shadow deployment from reviewed commit and approved threshold signer
- independent verification of network, source, bytecode, constructor,
  initialization, proxy/non-proxy status, roles, assets, and dependencies
- dual RPC, indexer, explorer, monitoring, alerts, on-call, and runbooks live
- deployer/setup authority reduced or removed as specified
- low-value synthetic lifecycle and failure test complete
- sponsor exact funding transaction decoded and simulated
- actual post-funding balance and invariant independently reconciled
- signed activation checklist commitment equals onchain inputs
- communications and public transparency page match deployed state
- abort and narrow-pause authority available

Fail if any address is copied manually without verification, any single daily
key controls funded assets, or public copy precedes state readback.

## G-10 — Communications Gate

Required evidence:

- each material claim has evidence label, source, owner, date, denominator, and
  permission
- product description matches signed terms and legal classification
- "deployed on Robinhood Chain" is separated from Robinhood brokerage access,
  listing, approval, distribution, and endorsement
- Virtuals deployment is separated from interface access, curation, support,
  amplification, value, and success
- agent recommendations are separated from accountable decisions
- token and product scoreboards, wallets, economics, and rights are separate
- risk, stablecoin, privacy, incident, and limitations pages are accessible
- sponsor/member/partner names and metrics have written permission
- anti-scam domains/accounts and incident correction process are ready

Fail if an unsupported claim is necessary to make the offer compelling.

## G-11 — Token Launch Gate

This gate is independent from G-01 through G-10 and cannot be implied by a
funded product.

Required evidence:

- token necessity and conflicts memo approved
- productive tokenless agent and one accepted paid external job
- token/entity/financial-promotion/tax/KYC/AML/sanctions/market-conduct advice
- written Virtuals use-case and Malaysia eligibility resolution
- exact generated transaction decoded, simulated, and independently reviewed
- all allocations, beneficial owners, vesting, initial purchase, curve,
  liquidity, fees, ACF, anti-sniper, admins, proxy, pause, and upgrade controls
  recorded
- treasury/custody/recovery/monitoring and twelve-month operations ready
- exact public mechanics and risk disclosure approved
- program and token economic/authority separation verified in code and accounts
- launch-abort criteria and post-launch incident/support team ready

Fail or defer on any unknown material mechanic or on token utility derived
primarily from speculation, circular staking, or future roles.

## Security Review Program

### Internal review sequence

1. Architecture and trust-boundary review.
2. Contract state/authority/accounting review.
3. Service authorization and data-flow review.
4. Agent/tool/prompt and ACP review.
5. Deployment/role/treasury review.
6. End-to-end abuse-case and incident exercise.

### Independent review scope

- Solidity suite and deployment path
- signer, multisig, AA, paymaster, EIP-712/EIP-1271
- vault accounting and stablecoin behavior
- request/appeal/settlement state machine
- evidence service, authorization, and audit controls
- agent tool boundary and data leakage
- chain/indexer/reconciliation failure
- Virtuals/ACP adapter and mutable dependency risk
- mainnet operational readiness

An audit report is not a warranty. Findings, scope exclusions, commit hash,
changes after review, and operational assumptions remain visible.

## Legal and Privacy Deliverables

| Deliverable | Required before | Refresh trigger |
| --- | --- | --- |
| Product classification memo | Paid pilot contract | Entity, country, funding, benefit, discretion, decision, or marketing change |
| Sponsor agreement/member terms | Funding | Any promise or role change |
| Jurisdiction matrix | Enrollment | New sponsor/member/reviewer/payment country |
| Privacy role/data-flow assessment | Production data | New processor, purpose, field, model, region, or disclosure |
| Processor agreements | Processor access | Terms/subprocessor/model-training change |
| Stablecoin/custody memo | Funding | Asset, issuer, contract, bridge, custody, liquidity, or depeg change |
| Token memo | Token scheduling | Entity, utility, mechanics, allocation, jurisdiction, marketing change |
| Virtuals eligibility resolution | ACP production/token launch | Terms, location, personnel, entity, or access change |

## Release Evidence Packet Structure

```text
release-evidence/<environment>/<release-id>/
  00-decision.md
  01-scope-and-commit.md
  02-customer-and-legal/
  03-product-and-terms/
  04-privacy-and-processors/
  05-contract-build-and-tests/
  06-independent-review/
  07-deployment-manifest/
  08-roles-and-treasury/
  09-operations-and-incidents/
  10-communications-and-public-readback/
  11-known-risks-and-signatures.md
```

Sensitive legal, member, security, and commercial evidence must not be committed
to a public repository. The public repository stores redacted templates,
checksums, public manifests, and status; approved private systems hold the
complete packet.

## Go/No-Go Record

The final record contains:

- release level and exact action authorized
- sponsor, program, environment, chain, suite/template, asset, and cap
- status of gates G-01 through G-11, with G-11 marked not applicable when no
  token action occurs
- unresolved risks, owner, mitigation, expiry, and acceptance authority
- exact source commit, artifact digest, addresses, transaction plan, and public
  copy version
- named signers and independent reviewers
- abort conditions and rollback/containment path
- decision timestamp and expiry

An authorization expires when the source, terms, roles, platform state,
deployment transaction, sponsor economics, or material risk changes.

## Post-Release Controls

During an active program:

- daily vault and ledger reconciliation
- continuous chain/indexer/dependency/security monitoring
- daily SLA and urgent-case review
- weekly privileged-role and evidence-access review
- weekly agent error/override and ACP reconciliation review
- prompt incident handling and legally required notification
- no configuration or terms change without version and consent analysis
- closure review before unused-budget recovery

After token launch, add continuous contract/allocation/vesting/treasury/fee/ACF,
impersonation, related-wallet, and market-conduct monitoring. Token operations do
not reduce the active program's review cadence.

## Stop Authority

Any accountable owner may request a pause when they see a plausible critical
member, fund, legal, privacy, or security risk. Technical guardians execute
only the narrow onchain scope they control; operations and legal owners manage
member continuity and communication.

The founder cannot override a failed critical gate merely to meet an ecosystem,
sponsor, content, or token date. A documented no-launch is a successful release
process when the alternative would expose members or create a permanent unsafe
asset.
