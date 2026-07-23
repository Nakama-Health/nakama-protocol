# Web3, Decentralization, and Governance

## The Web3 Use Case

Nakama should use a public chain for shared economic truth that multiple parties
need to verify without trusting the same database administrator.

The strongest onchain facts are:

- which program and terms version is active
- which assets are accepted
- how much approved stablecoin is held
- which portion is free, encumbered, obligated, paid, or refundable
- which opaque member commitment is active and for what window
- which authorized role signed an outcome
- which obligation exists
- when and to whom an approved settlement occurred
- which contract and implementation version governs the program

The weak web3 use cases are publishing medical records, making every workflow a
transaction, asking members to speculate, or replacing accountable review with
token voting.

## Why a Shared Ledger Matters

The sponsor, member, operator, reviewer, auditor, capital partner, and token
community have different incentives. A public ledger can make certain disputes
fact-based:

- Was the program funded before activation?
- Did terms change after the member accepted?
- Was the decision signed by an authorized reviewer?
- Did the vault pay the amount approved?
- Are liabilities being counted before free capital is reported?
- Can the operator move program funds for another purpose?

A conventional database could implement the workflow. The public chain becomes
valuable when independent verification, composability, and removal of unilateral
fund control are worth the added complexity.

## Onchain and Offchain Boundary

| Onchain | Offchain/private |
| --- | --- |
| Program identifiers and state | Names, contact information, identity documents |
| Content-addressed terms commitment | Full legal/customer document presentation |
| Approved asset, budget, obligations, settlement | Bank, card, provider, or clinical operations |
| Opaque membership commitment and window | Eligibility evidence and member profile |
| Claim commitment, status, amount, deadlines | Medical documents, OCR, notes, diagnosis, provider details |
| Reviewer role and signed decision | Clinical reasoning, fraud analysis, communications |
| Agent authorization and action receipt | Prompts, model context, private tool output |
| Contract version, pause, and role state | Legal opinions, KYC/KYB files, sanctions records |

Hashes are not automatically private. A predictable document hash, public
member address, event timing, amount, or repeated identifier can reveal
sensitive information through correlation. Every commitment format requires a
privacy and linkability review.

## Decentralization by Function

Nakama should not claim that the entire system is decentralized. Each function
has its own target:

| Function | Genesis posture | Long-term direction |
| --- | --- | --- |
| Contract execution | Public Robinhood Chain | EVM-portable, independently verifiable deployments |
| Chain governance | Robinhood Security Council and validators | External dependency, transparently disclosed |
| Program capital | Per-program segregated vault | Multiple qualified custodians/assets where justified |
| Product terms | Sponsor/operator approved template | Community and qualified-operator choice among reviewed templates |
| Claims preparation | Nakama agent | Competitive specialist agents with portable reputation |
| Claim decisions | Named human reviewers | Multiple qualified panels and independent appeals |
| Protocol development | Nakama-led | Open source, public proposals, multiple maintainers |
| Frontend/indexing | Hosted by Nakama | Independent readers and SDKs; verified direct-chain fallback |
| Private evidence | Nakama-approved encrypted service | Vendor portability, stronger confidential execution where useful |
| Governance | Founder/multisig guarded | Bounded token and stakeholder governance over future-facing policy |

The chain itself has institutional governance and permissioned elements. Public
copy should say **publicly verifiable** and **progressively decentralized**
rather than **fully decentralized**.

## Progressive Decentralization Roadmap

### Phase D0 — accountable operator

- Nakama and sponsor operate one program
- named reviewers and appeal reviewers
- program vault cannot be used for company purposes
- contracts and public reads are open
- emergency authority is documented and time bounded

### Phase D1 — multiple operators and reviewers

- at least two independent qualified operators or evaluators
- objective scopes and service levels
- portable performance history
- independent appeal panel
- no token slashing until duties and evidence are reviewable

### Phase D2 — template and service marketplace

- reviewed versioned templates
- permissionless proposals but gated activation
- specialist agent marketplace
- governance over admissions, grants, and future deployment versions
- external read/index implementations

### Phase D3 — capital and program plurality

- multiple approved stable assets or reserve adapters
- legally supportable capital partners
- program-specific governance and operators
- standardized risk and outcome reporting
- protocol governance unable to seize program funds or rewrite active rights

### Phase D4 — autonomous mutual network

- communities select operators, evaluators, services, and approved capital
- agents perform most routine work under bounded authority
- dispute and reputation systems work across programs
- the protocol remains usable if Nakama's hosted interface is unavailable

Progression is earned through operation and diversity, not calendar dates.

## Governance Domains

### Token governance may control

- protocol treasury budgets
- ecosystem grants
- future template admission and deprecation
- non-sensitive registry policy
- fee policy for future deployments
- protocol release recommendations
- operator/evaluator requirements

### Program governance may control

- future program terms before activation
- sponsor budget and unused-fund policy
- operator selection
- reviewer and appeal-panel appointment
- renewal, expansion, or closure

### Governance may never control

- an individual's diagnosis or raw evidence
- an individual claim outcome by popular vote
- active terms already accepted by a member
- an approved obligation
- withdrawal of segregated program funds for unrelated use
- retroactive reduction of member rights
- bypass of sanctions, legal, or privacy obligations

## Authority Design

No single signer should hold all roles. At minimum separate:

- factory/release authority
- program operator
- sponsor authority
- initial reviewer set
- appeal reviewer set
- safety/pause guardian
- protocol treasury
- program vault authority
- token/creator-fee treasury
- agent session-key issuer

High-risk authorities use multisig, narrow roles, delay where practical,
monitoring, documented rotation, and break-glass procedures. Emergency pause
should stop new exposure and unsafe actions without permanently blocking valid
claims, settlements, refunds, or exits.

## Immutability and Upgrades

Prefer immutable, versioned program suites:

- each active program pins its contract and terms version
- a new release deploys a new factory or implementation hash
- existing programs do not change silently
- migrations require explicit consent and reconciliation
- registries can mark versions supported or deprecated but cannot rewrite state

Virtuals launch and ACP contracts are external upgradeable dependencies. Nakama
must monitor proxy implementations, admins, fees, pauses, and configuration
changes.

## RWA Boundary

Nakama may later hold or integrate tokenized reserve assets. A valid RWA claim
requires:

- identifiable legal asset and issuer
- holder rights
- custody and segregation
- valuation method
- liquidity and redemption mechanism
- jurisdiction and transfer restrictions
- loss and insolvency treatment

Health obligations and `$NAKAMA` are not automatically RWAs. A specific approved
tokenized Treasury or cash-equivalent reserve instrument could be one. It enters
only after liquidity and principal-safety review; yield does not outrank claims
readiness.

## Composability

Safe composability can include:

- public reserve and obligation readers
- standardized program and terms metadata
- agent and evaluator reputation
- permissioned sponsor/partner integrations
- explorer and auditor dashboards
- SDKs for creating proposals, not silently activating exposure

Unsafe default composability includes:

- lending or rehypothecating program vault assets
- trading member positions
- public claim marketplaces
- exposing membership or claim graphs
- arbitrary contract callbacks from program vaults
- token governance adapters with reserve authority

## Web3 Success Test

The chain is justified when an external observer can verify a material economic
truth or prevent a unilateral misuse that would otherwise require trusting
Nakama. It is not justified when the same action gains only an explorer link,
extra wallet friction, and no meaningful change in rights or accountability.
