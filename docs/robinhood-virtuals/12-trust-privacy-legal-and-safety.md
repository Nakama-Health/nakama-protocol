# Trust, Privacy, Legal, and Safety

## Verdict

Nakama can responsibly test a sponsor-funded health-support program before it
can responsibly claim to operate an insurance product or autonomous mutual.
Phase 0 therefore uses a fixed sponsor budget, zero member price, bounded
benefits, explicit discretion or entitlement as counsel approves, private
evidence, accountable human decisions, and no token dependency.

Terminology does not decide legal classification. Calling a product
"protection," "mutual aid," "membership benefit," or "discretionary" does not
remove insurance, healthcare, consumer, payments, securities, privacy, tax, or
employment obligations. Structure, promises, marketing, control, funding,
eligibility, and actual operation decide the risk.

This document defines product and release gates, not legal advice. Written
advice must identify the entity, sponsor, users, jurisdictions, facts, and
version of the product it covers.

## Trust Promise

Nakama's trust promise is narrower and more defensible than "trustless health
insurance":

> A member can see the applicable terms and aggregate funding before joining,
> submit sensitive evidence privately, receive a decision from an accountable
> process, challenge that decision, and verify any resulting economic
> settlement without depending on token price.

The sponsor can verify that its budget is segregated and used according to the
agreed program. Nakama can prove the authority and financial history without
publishing a member's medical story.

## Legal Workstreams

These workstreams run in parallel but have separate opinions and owners.

### Program classification

Counsel must determine whether the exact Phase 0 offer is insurance, a group
benefit, discretionary assistance, prepaid service, mutual aid, employer or
membership benefit, regulated claims administration, or another arrangement in
each relevant jurisdiction.

The review packet must include:

- legal entities and contracting parties
- sponsor and member relationship
- exact marketing copy and member terms
- who funds the budget and whether members pay
- whether payment creates a contractual entitlement
- covered events, exclusions, caps, discretion, and appeals
- who assesses evidence and controls payment
- program geography and member residency
- custody, stablecoin, wallet, refund, and unused-budget flows
- compensation to Nakama, reviewers, introducers, and capital providers
- token, ACP, and governance separation

The first commercial agreement should state who carries the program obligation,
who owns member communications, who performs screening, who handles disputes,
and what happens when law, chain, stablecoin, or operations prevent performance.

### Licensing and regulated partners

If any activity requires an insurer, broker, TPA, assistance provider, medical
network, money-service provider, custodian, or locally licensed entity, Nakama
either contracts one with explicit responsibility or removes the activity from
Phase 0. A partner logo or informal introduction does not satisfy the gate.

### Token and capital formation

Separate counsel reviews `$NAKAMA`, Virtuals launch mechanics, creator trading
fees, team allocation, ACF proceeds, treasury use, governance, marketing, user
geography, KYC/AML, sanctions, market conduct, tax, and financial promotions.
The analysis cannot assume that calling the token "utility" controls its legal
treatment.

Token proceeds and creator fees enter the operating treasury only after an
approved treasury policy. They do not automatically capitalize a protection
program and cannot be described as a claim reserve unless transferred under a
separate, approved sponsor or grant agreement.

### Virtuals eligibility and Malaysia

The reviewed Virtuals terms list Malaysia as a prohibited jurisdiction. Nakama
therefore needs written clarity on any relevant Malaysia nexus involving the
creator entity, beneficial owners, operators, access location, marketing,
treasury signers, and permitted participation before using the launchpad or ACP.

This is a stop gate. VPN use, a foreign entity without substance, or silence
from the platform is not a solution. If eligibility cannot be confirmed,
Nakama may still build an EVM-portable product but does not launch through
Virtuals or operate ACP from a prohibited posture.

### Health, consumer, and communications

Medical disclaimers do not cure unsafe behavior. The product must clearly
separate benefit administration, medical advice, emergency care, navigation,
and provider relationships. Members must be told to use local emergency
services when appropriate, and no agent output can delay urgent care.

Terms, exclusions, caps, timelines, evidence requirements, reviewer authority,
complaints, appeals, refunds, stablecoin risk, and service limitations must be
understandable before enrollment. Material changes require a new version and,
where applicable, renewed consent; a website update cannot silently alter an
active program.

## Privacy and Data Protection

HIPAA applies only when the parties and data flow meet its legal tests; it is
not a universal badge for health software. GDPR and local privacy, health-data,
consumer, and breach laws may apply independently. The privacy program starts
with a role and data-flow analysis for every entity and processor.

### Data classification

| Class | Examples | Storage | Public chain | Agent use |
| --- | --- | --- | --- | --- |
| Public | Program ID, terms hash, aggregate funding, public status, settlement receipt | Public systems and indexer | Allowed | Allowed |
| Internal | Sponsor contact, operational notes, non-sensitive analytics | Controlled product systems | No | Approved tools only |
| Confidential | Contract drafts, reviewer roster, security configuration, member contact mapping | Encrypted and restricted | Commitment only if needed | Minimum necessary |
| Restricted health/identity | Medical files, diagnosis, identity documents, detailed request narrative, reviewer rationale | Dedicated encrypted evidence plane | Never raw; random commitment only | Redacted fields under explicit purpose |
| Secret | Keys, recovery material, credentials, KMS material | Approved secret and custody systems | Never | Never exposed to model context |

### Purpose and minimization

Every field needs a named collection purpose, legal basis, retention period,
access role, processor list, and deletion rule. Data collected for benefit
review cannot be reused for token targeting, trading analysis, public model
training, or generalized health profiling without a separate valid basis and
explicit process.

The first product should collect the minimum evidence needed for its narrow
benefit schedule. It should avoid building a longitudinal health record. Where
a reviewer only needs a date, amount, provider class, and event category, the
agent receives those structured fields rather than the complete document.

### Consent and member rights

The product records the version of privacy notice, terms, consent where
applicable, data processors, cross-border transfer mechanism, and model-use
policy acknowledged by the member. Consent must be as easy to withdraw as to
give when consent is the basis, while preserving records that must legally be
retained.

Nakama needs tested workflows for access, correction, export, objection,
restriction, deletion, authorized representative requests, and complaints.
Wallet ownership alone is not sufficient identity proof for releasing health
records.

### Processor and model controls

No model or third party receives restricted data until the contract, region,
retention, training policy, subprocessors, access model, deletion behavior, and
incident notification are reviewed. Prompts and outputs are treated as data
processing, not ephemeral conversation.

Synthetic test cases are the default for evaluation. Production evidence is
used only when necessary, redacted, purpose-bound, logged, and excluded from
provider training. Model providers and vector stores cannot be selected by
convenience alone.

## Decision Safety and Fairness

Phase 0 uses accountable review because an incorrect denial, delay, or payout
can create real harm.

### Separation of duties

- The agent checks completeness and prepares a recommendation.
- The primary reviewer signs a decision within a published scope.
- A different reviewer or panel hears an appeal.
- Settlement executes the exact final approved obligation.
- The sponsor receives aggregate operations reporting but no unnecessary
  clinical evidence.
- Token holders and public governance do not participate in individual cases.

A sponsor must not be able to deny an otherwise eligible request merely to
recover unused budget. Nakama compensation must not improve when valid requests
are denied. Reviewers must disclose conflicts and cannot review their own case,
close associate, or financial interest.

### Service levels

Each terms version defines acknowledgement, evidence check, standard review,
urgent escalation, request-for-information, appeal, and settlement timelines.
Clock pauses are explicit and visible. If Nakama misses a deadline, the request
escalates to a named person; it does not disappear into an agent queue.

### Reason codes and appeals

Public state uses broad reason classes that preserve privacy. The member
receives a complete private explanation tied to terms and evidence. The appeal
process permits additional evidence, records reviewer independence, and
preserves the associated budget until finality.

Agent recommendations are evaluated by category, demographic proxy, reviewer,
amount, evidence sufficiency, outcome, override, appeal, and error. Fairness
analysis must be legally and statistically appropriate; it cannot infer
sensitive attributes from wallet behavior.

## Economic and Stablecoin Safety

USDG is a third-party asset with issuer, reserve, redemption, liquidity,
contract, bridge, and depeg risk. The ticker alone is not a risk assessment.

Before funding, Nakama documents:

- issuer and legal claim
- reserve and attestation model
- redemption route and eligible counterparties
- Robinhood Chain contract address and decimals
- DEX and offchain liquidity for expected payout sizes
- custody, key recovery, and signer policy
- bridge route, finality, fees, and withdrawal delay
- freeze, upgrade, blacklist, and pause capabilities
- depeg thresholds and response authority
- member alternatives if direct USDG receipt is unsuitable

The program is prefunded on Robinhood Chain. It does not wait for a seven-day
canonical bridge withdrawal or speculative liquidity sale to honor an approved
obligation. If USDG falls outside the approved risk band, new enrollment and
new obligations pause while existing obligations follow the signed incident
plan.

Program assets are never deposited into a yield protocol in Phase 0. Any later
yield strategy requires a separate legal, risk, liquidity, accounting, and
member-terms decision, and expected yield cannot support a promised benefit.

## Threat Model

| Threat actor or failure | Attack or failure | Primary control | Residual risk |
| --- | --- | --- | --- |
| Compromised sponsor signer | Changes terms, redirects funds, removes members | Threshold roles, typed exact actions, timelocks before activation, immutable active terms | Insider collusion |
| Compromised Nakama operator | Reads evidence or creates obligations | Purpose RBAC, split services, no vault discretion, signed human decision | Privileged support access |
| Prompt injection or model failure | Agent leaks data or calls unsafe tool | Tool allowlist, schema firewall, data classification, output validation, human queue | Novel tool-chain exploit |
| Malicious member | Duplicate identity, fabricated evidence, replay | Eligibility attestation, manifest versioning, reviewer checks, nonces | Sophisticated fraud and false negatives |
| Biased reviewer | Inconsistent denial or conflict | Published terms, reason codes, appeals, audit sampling, conflict rules | Human judgment variability |
| Sponsor economic conflict | Suppresses valid use to recover budget | Contractual duties, separation of review, transparent aggregate outcomes | Relationship pressure |
| Token holder or founder | Uses governance or publicity to influence case | No token case authority, private evidence, conflict policy | Offchain harassment |
| Smart-contract bug | Locks or misroutes program funds | Minimal immutable suite, invariant tests, audit, caps, rehearsed pause | Unknown defect |
| Stablecoin or bridge failure | Depeg, freeze, delayed liquidity | Prefunding, exposure caps, issuer diligence, incident plan | Systemic asset failure |
| Robinhood Chain failure | RPC outage, reorg, sequencer or governance event | Dual providers, finality policy, offchain continuity, EVM portability | Extended chain halt |
| Virtuals or ACP change | Fees, contracts, access, or package behavior changes | Isolated adapter, version pin, monitoring, kill switch | Loss of channel or token function |
| Evidence breach | Medical or identity disclosure | Encryption, minimization, isolated service, logs, tested response | Insider or zero-day breach |

## Privileged Operations

All mainnet roles use institution-controlled threshold accounts. The role
matrix names purpose, allowed actions, threshold, signers, geographic and device
diversity, recovery, rotation, monitoring, and maximum response time.

Changes to factories, templates, stablecoins, reviewers, paymasters, agent
permissions, ACP allowance, and safety roles generate public events and
internal high-severity alerts. Routine operations use least-privilege keys;
recovery and break-glass keys are offline, tested, and never used as daily
signers.

Every emergency action requires a reason code, incident identifier, scope,
expiry, communications owner, and post-incident review. An indefinite silent
pause is a failure state, not a control.

## Marketing Claim Control

Every external claim receives an evidence class before publication.

| Claim class | Example | Publication rule |
| --- | --- | --- |
| Deployed fact | "The program vault is deployed at this address" | Publish only from a verified manifest and correct environment |
| Measured result | "92% of eligible members activated" | Name cohort, denominator, date, and measurement method; obtain permission |
| Contracted relationship | "Built with Sponsor X" | Written name/logo/case-study permission |
| Platform relationship | "Deployed on Robinhood Chain" | Permitted after deployment; never imply brokerage listing or endorsement |
| Product description | "Sponsor-funded acute health support" | Must match signed terms and counsel-approved language |
| Roadmap | "We plan to add evaluator staking" | Label as planned and avoid a date unless resourced |
| Token economics | "Virtuals currently routes 70% of a 1% fee to creator" | Date and qualify; verify live configuration before launch |

Prohibited without specific written evidence:

- licensed, insured, approved, guaranteed, risk-free, or fully decentralized
- Robinhood listing, distribution, customers, endorsement, or promotion
- Virtuals curation, pump, volume, market cap, or ACF proceeds
- clinical efficacy, claims accuracy, savings, users, revenue, reserves, or
  partners derived from a different product or unsupported internal assertion
- "AI decides claims" or "code replaces the insurer"

## Incident Response

The incident program covers security, privacy, chain, stablecoin, agent,
reviewer, legal, communications, and member-safety events.

1. **Detect and classify.** Identify affected program, data, funds, members,
   jurisdiction, active deadlines, and whether continued operation increases
   harm.
2. **Contain narrowly.** Revoke the affected key, tool, processor, or module;
   pause only the functions necessary to limit harm.
3. **Preserve service.** Maintain emergency member contact and manual intake,
   preserve request deadlines and encumbered budgets, and route urgent cases.
4. **Notify correctly.** Follow contractual, regulatory, member, sponsor,
   insurer/partner, and public notification requirements without speculation.
5. **Recover from known state.** Verify code, roles, evidence integrity,
   balances, obligations, and communications before unpausing.
6. **Publish accountable closure.** Record root cause, scope, losses, affected
   promises, corrective action, and remaining risk at an appropriate level.

Quarterly exercises must include a lost signer, evidence breach, model leak,
USDG depeg, chain outage, mistaken denial, and sponsor dispute. A runbook that
has never been exercised is not release evidence.

## Launch Risk Register

| Risk | Likelihood before controls | Impact | Owner | Gate or response |
| --- | --- | --- | --- | --- |
| Product classified as unauthorized insurance | High | Existential | Legal lead | Written jurisdiction-specific opinion before enrollment |
| Virtuals creator/operator ineligible from Malaysia | High | Launch-blocking | Founder and counsel | Written platform/legal resolution before launch or ACP operation |
| Sponsor demand is polite interest only | High | Strategic | Founder/sales | Paid design sprint and full pilot budget before custom scope |
| Member trust fails at wallet or privacy step | Medium | High | Product lead | Moderated testing and 70% activation gate; remove crypto UX if needed |
| Agent recommendation causes harmful delay | Medium | High | Clinical/operations lead | Human queue, SLA escalation, urgent-care copy, evaluated false-negative rate |
| USDG cannot support real payouts | Medium | High | Treasury/risk lead | Liquidity, custody, redemption, and depeg rehearsal before funding |
| Contract accounting defect | Medium | Critical | Protocol lead | Invariants, independent review, caps, shadow deployment |
| Claims/evidence breach | Medium | Critical | Security/privacy lead | Isolated evidence plane, access test, incident exercise |
| Token incentives corrupt member outcomes | Medium | High | Governance lead | Hard protocol separation and conflict monitoring |
| Virtuals mechanics differ at launch | High | Medium | Token launch lead | Decode and simulate exact transaction; abort on mismatch |
| Operations remain bespoke | High | Strategic | Product/operations lead | Third-program setup-time kill criterion |

## Required Written Artifacts

Before a funded pilot:

- program-classification memorandum for the actual entities and jurisdictions
- sponsor agreement and member terms
- privacy role/data-flow assessment and processor register
- data protection impact assessment where required
- clinical and emergency communication policy
- reviewer qualification, conflict, and appeal policy
- stablecoin, custody, liquidity, and bridge assessment
- smart-contract threat model and independent review
- privileged-role matrix and incident runbooks
- signed activation and termination checklists

Before a token launch:

- separate token and financial-promotion memorandum
- Virtuals eligibility resolution, including Malaysia facts
- creator entity, beneficial owner, tax, KYC/AML, and sanctions plan
- decoded live launch transaction and token allocation register
- treasury, conflicts, market-conduct, communications, and disclosure policies
- separation proof showing token, operating treasury, ACP escrow, and program
  budget cannot be conflated

## Release Gate

The product does not launch because disclaimers are complete. It launches only
when the operating reality matches the member promise: a lawful structure, full
funding, exact terms, working private evidence flow, named accountable people,
tested settlement, reachable appeals, safe failure modes, and communications
that describe those facts without enlargement.
