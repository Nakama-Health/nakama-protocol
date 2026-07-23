# Ninety-Day Backlog

## Use of This Backlog

This is the issue seed for execution, not a promise that all work ships on day
90. Customer and legal evidence can stop, narrow, reorder, or remove technical
work. Funded mainnet activation and token launch remain gated outcomes.

Priority meanings:

- `P0`: blocks safe paid-pilot proof or a critical decision
- `P1`: required for funded activation
- `P2`: valuable after the core loop or conditional token gate

Every issue inherits the work-item format in the implementation index and must
be created in its owning repository or operations tracker with dependencies and
acceptance copied intact.

## Days 0–14 — Decide the Real Product and Build the Spine

### PMF, product, and legal

| ID | Priority | Outcome | Dependencies | Acceptance evidence |
| --- | --- | --- | --- | --- |
| G-001 | P0 | Build 40-account ICP list with named decision-makers, cohort/deadline, incident/current alternative, budget signal, geography, and warm path | None | 40 complete qualified records; no audience-only leads |
| G-002 | P0 | Run first 15 structured decision-maker interviews | G-001 | Notes capture all qualification fields and costly next step; repeated patterns synthesized |
| G-003 | P0 | Package and price the Protection Design Sprint | Product hypothesis | Fixed scope, exclusions, price, timeline, sample output, and paid CTA reviewed |
| C-001 | P0 | Freeze Phase 0 product glossary and exclusions | Strategy package | Team-approved current product, future category, agent, chain, token, and prohibited claims |
| C-002 | P0 | Draft standard sponsor-funded program schedule | C-001 | Cohort, eligibility, acute benefits, caps, exclusions, evidence, SLA, appeal, termination, unused funds |
| L-001 | P0 | Create actual-product legal briefing packet | C-002 | Entities, money/data/decision flows, copy, open questions, countries, and requested opinions complete |
| L-002 | P0 | Obtain preliminary classification and partner map | L-001 | Written viable/no-viable paths and required licensed/service roles |
| D-001 | P0 | Complete privacy data-flow and processor inventory | C-002 | Field-level class, purpose, role, system, region, processor, retention, and public-chain rule |
| F-001 | P0 | Define program/customer/unit-economic model | C-002 | Nakama fees, program budget, pass-through costs, staff time, margin, and no-token runway inputs |

### Protocol and platform

| ID | Priority | Outcome | Dependencies | Acceptance evidence |
| --- | --- | --- | --- | --- |
| P-001 | P0 | Approve contract architecture ADR and invariants | C-002, L-002 preliminary | State/authority/accounting specification signed by functions |
| P-002 | P0 | Implement exact USDG asset registry/adapter | P-001 | Address/name/symbol/decimals/chain validation and malicious-token tests |
| P-003 | P0 | Implement suite/template registry skeleton | P-001 | Version admission/deprecation/history tests |
| P-004 | P0 | Implement deterministic factory skeleton | P-003 | Prediction, one-time initialization, manifest generation tests |
| P-005 | P0 | Implement program lifecycle skeleton | P-001 | Legal/illegal transition and activation-gate tests |
| R-001 | P0 | Stand up Robinhood testnet provider/finality baseline | None | Dual RPC measurements, chain ID verification, explorer, reorg/failure model |
| R-002 | P0 | Snapshot Robinhood/Virtuals/ACP/USDG dependencies | None | Addresses, bytecode, proxy/admin/config, terms, and observation blocks recorded |

### SDK, product, and agent

| ID | Priority | Outcome | Dependencies | Acceptance evidence |
| --- | --- | --- | --- | --- |
| S-001 | P0 | Generate canonical ABI/deployment package skeleton | P-003, P-004 | Deterministic artifact and stale-artifact CI check |
| S-002 | P0 | Define domain types and finality receipts | P-001, R-001 | Type/error/event/receipt unit tests |
| H-001 | P0 | Approve service/data architecture | D-001, P-001 | Trust boundaries, sources of truth, identities, access, failure paths signed |
| H-003 | P0 | Prototype identity/eligibility commitments | H-001 | Non-reversible program-scoped commitment and duplicate/recovery tests |
| H-004 | P0 | Build synthetic isolated evidence-service spine | H-001 | Per-request encryption, KMS abstraction, signed upload, audit event, no-PHI logs |
| H-009 | P0 | Build policy-controlled agent proposal tool | C-002, H-001 | Schema-bound proposal with sources, uncertainty, human approval, evaluation trace |
| H-011 | P1 | Wrap ACP package behind disabled adapter | R-002, H-001 | Exact pin, USDG override, separate wallet config, no-PHI classifier, kill switch |
| A-002 | P0 | Prototype sponsor program-design workspace | C-002, H-009 | Representative sponsor completes proposal review without hidden workflow |
| A-005 | P0 | Prototype member explanation and comprehension | C-002, D-001 | Five-question test and usability findings from representative participants |
| W-001 | P1 | Replace launch-first narrative with buyer-first draft | C-001, G-003 | Evidence-safe landing copy and qualified sponsor CTA in review environment |

### Day-14 checkpoint

Continue the build only if the team has reached real decision-makers and at
least several interviews reveal a repeated, budget-adjacent problem. If all
interest centers on token/community narrative, pause engineering expansion and
repair the ICP.

## Days 15–30 — Get Paid and Complete a Testnet Happy Path

### Commercial and product

| ID | Priority | Outcome | Dependencies | Acceptance evidence |
| --- | --- | --- | --- | --- |
| G-004 | P0 | Complete remaining 15 qualified interviews | G-001, G-002 | Total 30; top-three, data-sharing, deadline, and budget rates calculated |
| G-005 | P0 | Send ten priced design-sprint proposals | G-003, interview qualification | Proposal delivered to ten decision-makers with next decision date |
| G-006 | P0 | Close at least two paid design partners | G-005 | Signed scope and collected fee/deposit; discount consideration documented |
| G-007 | P0 | Select preferred Genesis sponsor candidate | G-006 | Scored decision on urgency, authority, data, full funding, legal fit, member access, case study |
| C-003 | P0 | Run sponsor proposal usability sessions | A-002, G-006 | Five sessions; 4/5 can understand/edit/approve without founder reinterpretation |
| C-004 | P0 | Run member flow tests | A-005 | Comprehension, privacy, wallet, trust, and refusal findings drive revision |
| L-003 | P0 | Refine legal analysis for selected sponsor facts | G-007, L-002 | Entity/jurisdiction/product path and stop conditions in writing |
| F-002 | P0 | Update price/cost model from paid design delivery | G-006 | Cash, hours, vendor quotes, expected ACV, cycle, and margin recorded |

### Protocol

| ID | Priority | Outcome | Dependencies | Acceptance evidence |
| --- | --- | --- | --- | --- |
| P-006 | P0 | Implement PoolVault conservative accounting | P-002, P-005 | Unit/stateful invariant/differential tests for funding, encumbrance, obligation, refund, recovery |
| P-007 | P0 | Implement pseudonymous membership registry | P-005, H-003 | Eligibility, acknowledgement, activation, expiry, duplicate, recovery tests |
| P-008a | P0 | Implement request and initial decision lifecycle | P-005, P-007 | Evidence commitment, information request, approve/deny, deadline/no-quorum tests |
| P-011 | P0 | Define canonical events/views/errors | P-005–P-008a | Indexer-rebuild schema and privacy review |
| P-012a | P1 | Deploy first suite skeleton to Robinhood testnet | R-001, P-002–P-008a | Verified addresses, source, bytecode, roles, generated manifest |

### SDK, app, services, agent

| ID | Priority | Outcome | Dependencies | Acceptance evidence |
| --- | --- | --- | --- | --- |
| S-003 | P0 | Implement EIP-712/EIP-1271 decision types | P-008a | Positive and cross-chain/program/version/replay negative tests |
| S-004 | P0 | Implement typed action builders/simulation | S-001–S-003 | Lifecycle/role/asset validation and decoded errors |
| S-005a | P0 | Prototype passkey/smart account and paymaster | R-001, S-004 | Member activation without ETH/token; exact sponsor funding approval simulation |
| H-002 | P0 | Implement sponsor workspace backend | H-001, C-002 | Organization, versioned draft, approval checklist, aggregate role tests |
| H-005a | P0 | Implement intake/evidence/review workflow happy path | H-004, P-008a, S-003 | Synthetic request to signed decision trace |
| H-006a | P0 | Implement testnet indexer/projection | P-011, P-012a | Rebuild, duplicate event, stale-state, direct-read tests |
| H-008 | P0 | Implement append-only audit/consent ledger | D-001, H-001 | Actor/purpose/version/access/tool audit tests |
| H-010a | P0 | Establish agent evaluation set and shadow run | H-009, C-002 | Normal/adverse cases, unsupported claim/leakage/override baseline |
| A-003a | P0 | Build testnet funding/activation sponsor flow | S-004, S-005a, H-002 | Exact asset/amount, finality, reconciliation, checklist states |
| A-006a | P0 | Build member testnet activation flow | S-005a, H-003, P-007 | One clear signature and recovery/failure states |
| A-007a | P0 | Build synthetic request and evidence flow | H-004, H-005a | Save/resume, upload, timeline, information-request flow |

### Day-30 gate

Pass requires at least two paid design partners and one complete synthetic
testnet happy path. If fewer than two of ten qualified proposals pay, stop
custom build expansion. Existing technical work may be hardened as a demo, but
does not advance toward funded mainnet until the offer changes.

## Days 31–45 — Convert One Design into an Exact Funded Program

### Customer, terms, and economics

| ID | Priority | Outcome | Dependencies | Acceptance evidence |
| --- | --- | --- | --- | --- |
| C-005 | P0 | Finalize selected sponsor cohort and schedule | G-007, paid sprint | Sponsor-approved cohort/dates/eligibility/benefits/caps/exclusions/evidence/SLA/appeal |
| F-003 | P0 | Finalize full program budget and liability model | C-005, incident/cost data | Signed maximum liability, complete funding, fees, pass-through, unused funds, contingency |
| L-004 | P0 | Deliver final product classification/jurisdiction advice | C-005, F-003 | Written actual-facts opinion and required partner/license controls |
| L-005 | P0 | Draft sponsor agreement/member terms/privacy | L-004, D-001 | All roles, promises, money/data flows, complaints, appeals, termination, risk disclosed |
| O-001 | P0 | Staff reviewer, appeal, support, treasury, security, privacy roles | C-005, L-004 | Named primary/backup, qualification, conflict, coverage, service levels |
| G-008 | P0 | Negotiate funded pilot proposal | C-005, F-003, L-005 | Decision date, fees, full program budget, responsibilities, gates, case-study permissions |

### Protocol completion

| ID | Priority | Outcome | Dependencies | Acceptance evidence |
| --- | --- | --- | --- | --- |
| P-008b | P0 | Complete appeal, obligation, and settlement lifecycle | P-006, P-008a, S-003 | Separate appeal, cap/reservation, exact-once obligation/settlement tests |
| P-009 | P0 | Implement AgentAuthorizationRegistry/paymaster hooks | P-001, S-005a | Default deny, selector/value/time cap, revocation, separate ACP authority tests |
| P-010 | P0 | Implement SafetyGuardian | P-005, P-006, P-008b | Narrow pause, expiry, no-withdrawal, obligation-preservation tests |
| P-012b | P0 | Deploy complete candidate suite to testnet | P-002–P-011 | Verified manifest, threshold roles, source, full lifecycle |

### Product/service completion

| ID | Priority | Outcome | Dependencies | Acceptance evidence |
| --- | --- | --- | --- | --- |
| H-005b | P0 | Complete appeal/obligation/settlement workflow | P-008b, S-003 | End-to-end private/public state trace and idempotency |
| H-006b | P0 | Add reconciliation and reorg/failover | P-012b | Balance/ledger equality, missed/reordered/reorg event tests, dual RPC failover |
| H-007 | P0 | Implement privacy-safe notifications/SLA engine | H-005b, C-005 | Urgent, deadline, delivery failure, chain finality, template-version tests |
| A-004a | P0 | Build sponsor operations dashboard | H-006b | Assets/encumbrance/obligations/settlements/SLA with privacy suppression |
| A-009 | P0 | Build reviewer queue | H-005b, H-007 | Conflict, evidence access, agent/source separation, deadlines |
| A-010 | P0 | Build decision/appeal/settlement preparation | S-003, H-005b | Same typed preview/signature, independent appeal, exact settlement |
| W-002a | P1 | Build public transparency preview | H-006b | Reconciled public state, stale/divergent/paused privacy-safe views |

## Days 46–60 — Secure Full Commitment and Break the System

### Commercial and legal

| ID | Priority | Outcome | Dependencies | Acceptance evidence |
| --- | --- | --- | --- | --- |
| G-009 | P0 | Execute sponsor agreement and collect implementation fee | G-008, L-005 | Signed contract and cash receipt |
| F-004 | P0 | Secure complete program-budget commitment | G-009 | Funds available under signed activation conditions; not an informal pledge |
| L-006 | P0 | Complete privacy processor and transfer agreements | D-001, H-004 production design | Signed/approved processor register and member rights process |
| L-007 | P0 | Complete USDG/custody/liquidity/legal assessment | F-003, platform diligence | Approved or alternative funding asset/no-launch decision |
| O-002 | P0 | Approve operating runbooks and member communications | O-001, L-005 | Normal/adverse workflows and accountable contacts signed |

### Adversarial and quality

| ID | Priority | Outcome | Dependencies | Acceptance evidence |
| --- | --- | --- | --- | --- |
| Q-001 | P0 | Run full contract invariant/fuzz/differential campaign | Complete candidate suite | Stable reproducible results and triaged failures |
| Q-002 | P0 | Run application authorization/privacy abuse tests | H-002–H-008 | Tenant/role/object/model/log/analytics/notification findings resolved |
| Q-003 | P0 | Run chain/RPC/indexer/AA failure campaign | H-006b, S-005a | Reorg, divergence, provider outage, paymaster rejection, recovery evidence |
| Q-004 | P0 | Run agent safety regression | H-009, H-010a, H-005b | Injection, leakage, urgency, unsupported assertion, tool escalation, fallback |
| Q-005 | P0 | Run operations incident table-tops | O-002 | Lost signer, no reviewer, USDG, chain, evidence breach, agent error, mistaken decision |
| Q-006 | P1 | Deliver one external ACP production-quality job | H-011, safe offering | Paid accepted job, exact fees/asset, no sensitive payload, reconciled settlement |
| H-012 | P1 | Generate closure/public report from synthetic program | H-006b | Economic reconciliation, methodology, privacy suppression, evidence levels |
| A-011 | P1 | Build incident console/control surface | P-010, O-002 | Scoped pause preview, incident ownership, recovery checklist |

### Day-60 gate

Pass requires signed sponsor economics including complete budget, a viable legal
structure, approved USDG path, and complete testnet adverse-path evidence. If
the structure fails, narrow to sponsor support/navigation software. If funding
fails, do not activate or substitute founder/token capital as customer proof.

## Days 61–75 — Independent Review and Shadow Mainnet

| ID | Priority | Outcome | Dependencies | Acceptance evidence |
| --- | --- | --- | --- | --- |
| R-003 | P0 | Independent smart-contract and privileged-role review | Q-001, candidate freeze | Critical/high findings closed; scope/commit/exclusions recorded |
| R-004 | P0 | Independent privacy/service/agent review | Q-002–Q-004 | Critical/high findings closed; processors and production config reviewed |
| R-005 | P0 | Production infrastructure and on-call readiness | R-001, H-006b, O-002 | Dual RPC, indexer, alerts, dashboards, backups, recovery, support coverage |
| R-006 | P0 | Deploy unfunded mainnet shadow suite | R-003, approved release candidate | Verified source/bytecode/roles/manifests; no sponsor/member promise |
| R-007 | P0 | Run low-value synthetic shadow lifecycle | R-006, R-005 | Funding, activation, request, appeal, settlement, refund, pause, close, readback |
| R-008 | P0 | Final legal/privacy/product/public-copy review | R-004, actual deployment | Signed terms/config/copy match; addresses/status exact |
| W-001b | P0 | Release buyer site with current evidence | R-008 | Qualified CTA, current product, safe chain/agent language, no token page |
| W-002b | P0 | Release shadow transparency page | R-006, R-007 | Clearly labeled unfunded test/shadow, verified data and limitations |
| O-003 | P0 | Conduct production signer and incident rehearsal | R-006, R-005 | Threshold funding/activation/guardian/recovery practice, no key exposure |

## Days 76–90 — Activate or Record No-Launch

### Product path

| ID | Priority | Outcome | Dependencies | Acceptance evidence |
| --- | --- | --- | --- | --- |
| R-009 | P0 | Assemble gates G-01–G-10 release packet | All P0 evidence | Every gate pass/fail, exact commit/config/terms/risks/signers |
| R-010 | P0 | Execute go/no-go for funded pilot | R-009 | Signed decision with expiry and abort conditions |
| R-011 | P0 | Fund and reconcile program vault if approved | R-010, F-004 | Exact USDG transaction, finality, assets/encumbrance equality, readback |
| R-012 | P0 | Activate enrollment if approved | R-011, signed checklist | Threshold activation, exact cohort invitation, monitoring live |
| M-001 | P0 | Measure early member activation/comprehension/refusal | R-012 | Denominators and decision trigger reported daily during enrollment |
| O-004 | P0 | Begin active-program daily operating cadence | R-012 | Financial, service, privacy, agent, chain reviews and owned exceptions |
| R-013 | P0 | Publish no-launch/narrowing record if any gate fails | R-010 fail | Evidence, affected promise, member/sponsor communication, next test/pivot |

### Conditional token path

| ID | Priority | Outcome | Dependencies | Acceptance evidence |
| --- | --- | --- | --- | --- |
| T-001 | P1 | Complete token necessity/conflict memo | Q-006, product evidence | Independent review and explicit alternatives |
| T-002 | P0 if launch considered | Resolve Virtuals use case and Malaysia eligibility | Exact entity/personnel/access facts | Written answer and legal conclusion |
| T-003 | P0 if launch considered | Decode and simulate exact live launch transaction | T-002, platform snapshot refresh | Two-RPC reads, machine/human diff, independent reproduction |
| T-004 | P0 if launch considered | Complete allocation/beneficial-owner register | T-003 | 100% reconciliation and every recipient/control disclosed |
| T-005 | P0 if launch considered | Approve treasury/custody/market-conduct controls | T-004 | Threshold wallets, recovery, accounting, policies, monitoring |
| T-006 | P0 if launch considered | Approve exact tokenomics/risk disclosure | T-003–T-005 | Mechanics match transaction and product separation is prominent |
| T-007 | P1 | Link productive agent/token design | Q-006, T-001 | No fabricated staking; one agent mapping accepted |
| T-008 | P1 | Rehearse scheduled launch | T-002–T-007 | Exact transaction, signers, abort, monitoring, support rehearsal |
| T-009 | P1 | Independent token go/no-go | R-011 or approved policy, T-008 | Signed `launch/defer/change route/no launch` decision |

A day-90 `defer` is acceptable and likely if platform/legal details remain
unresolved. The product continues tokenless.

## Post-Day-90 Backlog

Only after real operation begins:

- complete the cohort and closure report
- ask sponsor renewal/expansion/referral
- close observed security, privacy, product, and economics gaps
- compare actual setup hours, service time, errors, appeals, and margin
- onboard a second comparable sponsor only after corrections
- evaluate member-funded structure with new legal/demand tests
- introduce external operator/evaluator bonds only when roles and objective
  duties exist
- consider new benefit/geography/RWA/capital integrations as separate products

## Dependency Summary

```text
G-001..G-007 -> actual sponsor facts -> C-005/F-003/L-004
C-005/F-003/L-004 -> final contracts/terms -> P-008b/H-005b
P-* -> generated S-* -> H-*/A-*/W-*
H/P/S/Q/O/L/F evidence -> R-009 -> R-010 -> funded activation
Q-006 + funded product + T-001..T-008 -> T-009 token decision
```

## Team Capacity Rule

When capacity is constrained, preserve this order:

1. customer payment and exact sponsor facts
2. legal/product safety and full funding
3. accounting, private evidence, accountable decision, settlement, and
   operations critical path
4. member/sponsor usability and reconciliation
5. agent productivity
6. website and public reporting
7. ACP marketplace
8. token preparation

Token work never displaces a P0 funded-program safety or demand test.

## Definition of Done at Day 90

The program path is complete only when all P0 work through R-010 is evidenced,
and, if approved, R-011 through O-004 are operating. The token path is complete
when T-009 records an evidence-backed decision; it does not require a launch.

Any remaining work carries an owner, risk, decision impact, and next review
date. No item is silently called future polish when it blocks member, fund,
legal, privacy, or security safety.
