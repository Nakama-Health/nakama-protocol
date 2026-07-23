# Genesis Product Specification

## Product Decision

The first product should be a **sponsor-funded, bounded health-protection
program** for one paid international cohort. Internally it proves the primitive
that could later support an autonomous mutual. Publicly it should not be called
a legally recognized mutual, risk pool, or insurance product until counsel has
approved the structure and language.

This sequencing avoids testing four difficult behaviors at once. The sponsor
funds a fixed program budget; members do not initially pool premiums or assume
that their contributions create an enforceable insurance contract. Nakama can
still prove terms, eligibility, private evidence, agent operations, reserve
visibility, decisions, payouts, and reporting.

## Product Promise

For the community operator:

> Fund and operate a clear health-support program for an international cohort,
> with verified budget, private member intake, accountable decisions, and an
> auditable outcome report.

For the member:

> Before the program starts, know whether you are eligible, what support may be
> available, what the limits are, what evidence is required, who decides, and
> what money has been set aside.

The exact legal promise must be defined per deployment. This specification is a
product target, not customer terms or legal advice.

## Qualified Genesis Sponsor

The first sponsor should meet all of these conditions:

- a real legal entity and named accountable operator
- repeated cohorts of 50–250 people or a 500–5,000 member organization
- participants who travel or reside internationally for a defined period
- at least two prior health incidents, emergency grants, refunds, or assistance
  cases that demonstrate a current workflow
- an existing welfare, safety, member-benefit, or program budget
- authority to share the member offer and coordinate eligibility
- willingness to fund the complete pilot budget before activation
- willingness to provide de-identified operating data and a post-program case
  study, subject to member privacy

Audience size without a responsible operator, budget, cohort definition, or
member relationship does not qualify.

## Initial Program Shape

Recommended default:

| Dimension | Genesis default | Why |
| --- | --- | --- |
| Cohort | 50–100 eligible members | Large enough to test operations, small enough to cap exposure |
| Window | 30 days | Matches a residency, program, or extended event without creating open-ended liability |
| Funding | Sponsor-funded fixed budget posted before activation | Tests product demand without simultaneously testing member underwriting and recurring contributions |
| Member price | Zero in Phase 0 unless counsel approves another structure | Removes token and payment friction from the first behavior test |
| Benefit type | Fixed or capped assistance for named acute events | Easier to explain, reserve, review, and audit than broad reimbursement |
| Aggregate cap | Equal to the approved posted program budget after fees | Prevents liabilities from exceeding available capital |
| Per-case cap | Defined in approved terms | Prevents one event from consuming the entire program |
| Decisions | Agent-prepared, accountable human-approved | Preserves operating leverage and clear responsibility |
| Payout asset | Approved stablecoin | Avoids `$NAKAMA` volatility and makes reserve accounting legible |
| Evidence | Encrypted offchain; minimal commitments onchain | Protects members while preserving economic auditability |
| Jurisdiction | One approved operating entity, forum, and bounded corridor | Reduces cross-border ambiguity |

The specific covered events, exclusions, waiting periods, evidence rules, caps,
and appeals process are legal and actuarial decisions. They must be versioned
and approved before the first member enrolls.

## End-to-End Member Journey

### 1. Sponsor configuration

The sponsor supplies cohort dates, participant profile, incident history,
locations, current support process, desired outcomes, budget, and responsible
people. The Nakama Operator produces scenarios rather than silently selecting
terms.

### 2. Program approval

Nakama, the sponsor, legal reviewer, operations owner, and capital owner approve
one versioned program package:

- eligibility
- benefit schedule
- exclusions and waiting periods
- aggregate and per-case caps
- evidence requirements
- decision authority
- service levels
- appeal and dispute process
- sponsor budget source and full-funding evidence
- termination and unused-fund treatment

### 3. Funding and deployment

The sponsor posts the approved stablecoin program budget to a segregated vault.
Contracts and public read surfaces expose the budget, committed obligations,
paid amounts, remaining capacity, term hash, and authorized roles. Activation
cannot occur before funding and role checks pass.

### 4. Member invitation

Eligible members receive a plain-language invitation. Wallet complexity should
be hidden behind embedded wallet or account-abstraction UX where possible.
Members see the program sponsor, dates, benefit schedule, caps, exclusions,
data handling, decision process, appeal path, and token independence before
accepting.

### 5. Enrollment

The member proves the minimum identity and cohort credentials offchain. The
system records an opaque member identifier or commitment, terms version,
activation status, and expiry. It does not publish a medical profile or a label
that reveals a diagnosis or claim type.

### 6. Support and evidence intake

During the active window, the member can reach the Nakama Operator for
navigation and instructions. For a potential event, the member uploads evidence
to encrypted storage. The agent checks completeness, dates, internal
consistency, and applicable terms, then asks only for missing information.

### 7. Review and decision

The agent prepares a structured case summary and recommendation with term
references. A named authorized reviewer signs the decision. Complex, adverse,
ambiguous, or high-value cases require a second reviewer according to policy.

### 8. Reserve and payout

An approved decision creates or confirms a bounded obligation. The vault pays
only if the program, member, decision, amount, nonce, and signer authority pass
contract checks. The public receipt reveals no raw health data.

### 9. Appeal

A member can appeal within the published window. The appeal goes to an
independent or separately authorized reviewer. The original agent output is
available in the private audit record but does not bind the appeal.

### 10. Program report

After expiry and claim-tail handling, Nakama produces:

- invited, eligible, and activated member counts
- member support and evidence-funnel metrics
- number and category of cases at a privacy-safe aggregation level
- decision and payout service levels
- approved, denied, appealed, and reversed counts
- program budget, obligations, payments, and unused balance
- human work and agent work per case
- sponsor and member feedback
- renewal recommendation

## The Two Magic Moments

The buyer magic moment is:

> The sponsor sees a complete, bounded program proposal generated from its
> actual cohort and budget, with every assumption exposed for review.

The market-belief magic moment is later:

> An eligible member submits once, receives a correct decision and payment
> within the promised service level, and the sponsor chooses to renew.

Deployment in one session is not the promise. The agent can compress design;
it cannot manufacture authority, capital, or safe operations.

## Nakama Operator Responsibilities

The launch agent may:

- intake sponsor requirements
- generate scenarios from approved models
- draft terms from approved templates
- explain the program in plain language
- coordinate invitations and enrollment
- monitor funding, capacity, and service levels
- answer procedural member questions
- prepare evidence and claim packets
- identify missing or inconsistent data
- route cases to authorized reviewers
- generate private and public-safe reports

The launch agent may not:

- create unapproved benefit promises
- modify active terms
- move reserve assets outside signed authority
- deny a member based solely on model output
- publish or sell health data
- use reserve assets for agent, token, or treasury activity
- describe a sponsor as a partner before written approval

## Sponsor Console

The sponsor needs one operating surface containing:

- program status and activation gates
- funding and remaining program capacity
- invitation and enrollment funnel
- open operational tasks
- privacy-safe case queue
- decision service levels
- signer and authority health
- incident and escalation status
- post-program report generation

It should not expose raw medical files to sponsor personnel without an explicit
role and legal basis.

## Member Experience Requirements

- email, passkey, or familiar sign-in before wallet concepts
- gas sponsorship for expected member actions
- plain-language terms before acceptance
- a visible non-token path through the entire product
- mobile-first evidence capture
- upload resumption and explicit receipt confirmation
- a human-help path at every adverse or ambiguous state
- no public claim type, diagnosis, provider, or document hash that can be
  correlated without a privacy review
- payout status and appeal deadline visible without explorer use

### Support-request detail hierarchy

The detail screen is a member task surface, not a protocol console. It should
answer three questions in order:

1. What is happening with my request?
2. What, if anything, do I need to do now?
3. What happens after I do it?

The default view uses one page hierarchy rather than a stack of independent
cards:

- a compact request header with the current state, one plain-language sentence,
  and the relevant deadline
- one primary action area immediately below it when member input is required
- a short progress view showing the completed, current, and next steps
- four or fewer essential facts: requested amount, program, support limit, and
  last update
- a contextual support link near the primary action
- one collapsed `Review, privacy, and network details` disclosure for review
  authority, appeals, data handling, and technical references

Do not repeat the request summary, state, or next action in separate cards.
Do not place `New request`, program navigation, readiness checks, preview
limitations, contract configuration, testnet warnings, L1 finality, or raw
verification fields in the primary member flow. A member-facing warning appears
only when it changes what the member should do.

Network confirmation and payment are separate states. A network commitment,
transaction reference, or finality signal cannot use paid, settled, or success
language unless an approved payment has its own verified transfer record.

The layout may use two columns on a wide screen when the primary action remains
first in reading and keyboard order. It becomes a single column on smaller
screens. Every disclosure, upload control, status, error, and success message
must remain understandable without color and operable by keyboard.

### Support-request interaction states

| State | Primary message | Primary action | Secondary information |
| --- | --- | --- | --- |
| Submitted | We received your request | None | Expected review timing |
| More information needed | We need specific documents to continue | Add requested documents | Due date and why each item is needed |
| Under review | A reviewer is checking your request | None | Last update and expected next step |
| Approved, payment pending | Your support was approved | None | Approved amount and payment timing |
| Paid | Payment sent | View payment details | Asset, amount, date, and verified reference |
| Declined | Your request was not approved | Review the decision | Reason, terms reference, and appeal deadline |
| Appeal open | You can ask for a new review | Start appeal | Deadline and independent-review explanation |
| Offline or delayed | We cannot update this request right now | Try again or contact support | Last confirmed state, without implying a new decision |

Success after an upload means the documents were received. It does not mean the
request was approved or paid. The confirmation should state what happens next
and when the member can expect another update.

## Activation Gates

The program remains `DRAFT` until every required gate is true:

- sponsor agreement executed
- approved jurisdiction and legal structure recorded
- terms and disclosures versioned
- stablecoin, custody, and redemption path approved
- full program budget posted
- operator, reviewer, appeal, pause, and treasury roles assigned
- test cases pass against the exact terms version
- member support and incident runbooks staffed
- data-processing agreements and retention rules active
- contracts verified and monitored
- launch and termination dates set

Activation is an explicit state transition. A marketing announcement, token
launch, draft vault balance, or sponsor expression of interest cannot activate
member protection.

## Product Success Criteria

For the first sponsor-funded program:

- at least 70% of invited eligible members activate
- at least 80% understand the benefit and key limits in a short comprehension
  test
- median support response under the promised service level
- complete evidence packets require no more than two agent follow-up cycles in
  the median case
- clean cases reach a correct decision within 48 hours after complete evidence
- approved payments settle within the published target
- material decision error below 2% in independent review
- appeals below 15%, with every appeal resolved and explained
- no reserve deficit, unauthorized transfer, or privacy incident
- the sponsor renews, expands, or introduces another qualified buyer

Targets should be adjusted before launch when counsel, operating partners, or
the approved product structure requires different service levels.

## Phase 1: Member-Funded Mutual Candidate

Member contributions enter only after:

- written legal analysis for one specific structure and jurisdiction
- evidence that members want to pay rather than merely accept sponsor funding
- adverse-selection controls and eligibility timing are defined
- reserve and backstop requirements are independently reviewed
- accounting separates contributions, fees, reserves, obligations, and refunds
- member governance rights are real rather than branding
- withdrawal, cancellation, unused funds, and insolvency behavior are explicit

The member-funded design is a later product decision. It must not be smuggled
into Phase 0 token utility or public copy.

## Strong Fallback Product

If risk pooling or mutual formation cannot pass its legal or economic gates,
Nakama becomes agentic member-support infrastructure:

- sponsors deposit a capped assistance budget
- members receive clear eligibility and support terms
- the agent administers private intake and case preparation
- accountable people approve payments
- the protocol records budget, authority, obligations, and settlement

This fallback preserves the buyer, agent, stablecoin, privacy, and auditability
advantages without claiming risk transfer. It is a valid commercial pit stop,
not a cosmetic relabeling.
