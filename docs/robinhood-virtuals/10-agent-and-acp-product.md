# Nakama Operator and ACP Product

## Agent Identity

The tokenized Virtuals agent should be **Nakama Operator** or simply **Nakama**.
It is the founding productive operator of the Nakama network. "Risk Agent" is a
capability label and should not become the master product identity.

The agent's purpose is:

> Convert a community's cohort, budget, and approved constraints into a clear
> program proposal, then operate the repetitive workflow with visible
> assumptions and accountable human decisions.

## Product Roles

### Community program designer

- collect structured sponsor inputs
- generate contribution, budget, and exposure scenarios
- map open assumptions and disqualifying gaps
- draft from approved terms templates
- produce a go/no-go package

### Program operator

- coordinate activation gates
- monitor funding, enrollment, capacity, and deadlines
- surface operational exceptions
- produce sponsor and public-safe reports

### Member concierge

- explain procedures and terms in plain language
- guide enrollment and evidence upload
- answer status questions
- route urgent or sensitive issues to people

### Evidence packager

- check file completeness and integrity
- extract structured facts in the private plane
- identify missing or inconsistent fields
- map facts to terms without making the final decision
- prepare a reviewer packet and audit trail

### Agent-commerce participant

- sell bounded public or sponsor-authorized jobs
- purchase qualified specialist services
- manage a capped operating wallet
- preserve ACP receipts and reconcile fees

## Authority Levels

| Level | Agent may do | Agent may not do |
| --- | --- | --- |
| Advisory | Draft, summarize, simulate, explain | Sign, move value, bind terms |
| Attested | Publish a signed structured recommendation or report | Create member liability or adverse final decision |
| Bounded execution | Call allowlisted functions within per-action, daily, program, and expiry limits | Change roles, move reserve freely, approve its own recommendation |
| Human-controlled | Prepare exact transaction for named reviewer/operator signature | Circumvent required signer or appeal path |

Genesis should use advisory, attested, and narrowly bounded execution. It should
not use unrestricted autonomous control.

## Public ACP Offerings

The first offerings must avoid PHI and legally sensitive adjudication.

### `pool_design_simulation`

Input:

- de-identified cohort size and profile
- dates and geographic scope
- fixed budget or contribution hypothesis
- approved benefit template identifier

Output:

- scenario table
- assumptions and warnings
- aggregate exposure and funding requirements
- unresolved legal/operating questions

Excluded:

- insurance advice
- individual underwriting
- legal authorization
- binding terms

### `public_reserve_health_report`

Input:

- verified program contract address
- finality threshold

Output:

- asset balance
- encumbered obligations
- paid amounts
- free program capacity according to the public formula
- contract version and authority warnings

Excluded:

- member or claim identity
- prediction of future medical loss

### `community_terms_translation`

Input:

- approved public terms document
- target reading level or language

Output:

- plain-language explanation
- key limits, exclusions, deadlines, and appeal rights
- terms-version reference

The output never overrides the legal terms.

### `pool_operations_audit`

Input:

- public contract and event history
- sponsor-authorized privacy-safe operating metrics

Output:

- activation and role checks
- SLA and reconciliation findings
- exceptions requiring human review

### `public_protocol_risk_review`

Input:

- contract addresses and deployment manifest

Output:

- configuration, proxy, admin, asset, pause, and concentration warnings
- no claim of a full security audit

## Prohibited ACP Data

Do not put into ACP memos, resources, events, logs, or external agent context:

- names, email addresses, phone numbers, passports, or identity documents
- diagnoses, provider records, invoices, images, prescriptions, or medical notes
- raw claim evidence
- reviewer notes or appeal discussions
- unredacted member addresses linked to health events
- credentials, signed URLs, encryption keys, or private endpoints

ACP can receive a privacy-safe job reference and return a signed receipt. A
Nakama-owned private service handles protected data.

## ACP Lifecycle

Virtuals describes ACP as Request → Negotiation → Transaction → Evaluation →
Completed. Nakama's adapter should persist:

- ACP job and entity IDs
- chain, contract, implementation, and asset identity
- buyer, provider, and optional evaluator
- negotiated price and fee snapshot
- public-safe input/output hashes
- state, timestamps, retries, and idempotency key
- transaction and finality state
- evaluation and dispute outcome
- Nakama operating-ledger reconciliation

Never infer completion from an HTTP response alone. Verify the contract state
and expected transfer.

## Current ACP Economics

At the July 22 snapshot, the live Robinhood ACP contract exposed 500 basis-point
platform and evaluator fees. With an evaluator, the observed split was 90% to
provider, 5% platform, 5% evaluator; without an evaluator, 95% provider and 5%
platform. These values are mutable and conflict with older 80/20 descriptions.

The adapter must fetch current fees, reject unexpected changes above policy,
and display gross price, each fee, and net provider amount before acceptance.

## USDG Adapter Requirement

ACP v2 currently maps Robinhood USDG under a USDC-named constant. Nakama must
not import that semantic error into its product.

Implement a Nakama `SettlementAsset` model containing:

- CAIP-2 chain ID
- contract address
- verified name and symbol
- decimals
- issuer and redemption reference
- environment
- allowed use: ACP, program, treasury, or none

The adapter should fail closed when ACP's symbol disagrees with the expected
address metadata. Signed user copy and accounting should say USDG.

## ACP Dependency Controls

- exact package and commit pin
- Nakama-owned wrapper; no direct SDK calls throughout the application
- contract address and implementation allowlist
- fee, pause, and admin monitoring
- lifecycle and reconnect tests
- idempotent job creation and settlement
- maximum job price and daily wallet spend
- explicit evaluator policy
- fallback behavior when ACP or the agent is unavailable
- reconciliation from chain events
- incident runbook and kill switch

The current ACP v2 package's placeholder test command means Nakama cannot rely
on upstream test coverage as a release argument.

## Agent Smart Account Policy

The agent wallet should have:

- allowlisted chains, contracts, and selectors
- per-call, per-job, per-program, and daily spend caps
- expiring session keys
- separate ACP and protocol allowances
- no program-vault ownership
- no authority to appoint reviewers or approve its own output
- mandatory simulation and intent hash for value-moving calls
- multisig-controlled policy changes
- immediate revocation and key rotation
- public-safe action log

Program reserves never sit in the agent wallet.

## Model and Tool Policy

Every high-consequence output records privately:

- model/provider and version
- prompt/policy/template version
- allowed tools
- input commitment
- output commitment
- confidence and unresolved fields
- human reviewer and final action

Agent output schemas should distinguish facts, extracted fields, assumptions,
recommendations, and prohibited conclusions. Prompt injection from documents,
web pages, ACP messages, or member text must be tested.

## Agent Evaluation

Measure the agent as a worker:

- paid jobs completed
- repeat buyers
- accepted versus rejected outputs
- median completion time
- human correction rate
- completeness and factual-error rate
- dollars of human labor saved
- operational incidents caused or prevented
- private-data violations
- ACP net revenue and cost

Followers, token holders, posts, and impressions are distribution metrics. They
do not prove agent productivity.

## Token Linkage

Current Virtuals guidance says an ACP agent can launch before its token and link
one token later. Nakama should use that sequence:

1. create the Nakama Operator identity
2. ship public-safe offerings
3. earn paid jobs and reviews
4. demonstrate native Robinhood integration
5. link `$NAKAMA` only after the token gate passes

One Virtuals token maps to one ACP agent under current guidance. Specialized
Nakama subagents do not each need a token. They can operate as internal tools or
independent ACP providers according to actual economic ownership.

## Failure and Fallback

If the agent or ACP is unavailable:

- active program terms remain valid
- members can reach human support
- evidence remains accessible to authorized reviewers
- claims and appeals do not auto-deny
- approved obligations remain settleable
- sponsor and public state can be read directly from chain/indexer fallback
- operating wallets stop new spending after policy timeout

The agent improves operations. It is not a single point of member-rights
failure.
