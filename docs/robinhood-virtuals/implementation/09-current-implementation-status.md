# Current Robinhood and Virtuals Implementation Status

Evidence date: 2026-07-23

Branch in every repository: `spike/robinhood-virtuals`

Release state: source implementation candidate; not deployed, funded, approved,
or operating

## Executive Status

The Phase 0 product has been implemented as a coherent local candidate across
the protocol, SDK, private control plane, bounded agent runtime, sponsor and
member applications, public website, and marketing package.

The implemented product is deliberately narrower than the long-term autonomous
mutual category:

> One accountable sponsor funds the complete USDG budget for a bounded
> international cohort. Members receive understandable program terms and a
> private request path. The Nakama Operator prepares and monitors work, while
> accountable people retain adverse decisions, signatures, settlement
> authority, incident authority, and recovery authority. Robinhood Chain is the
> target economic record. Virtuals ACP is an optional, public-data-only agent
> distribution path. A token is not required.

This release contains no verified deployment, funded-program, member-
entitlement, accepted-ACP-job, or token-launch evidence, and it makes none of
those claims. The code fails closed when the corresponding release evidence is
absent.

## Status Vocabulary

The following words are intentionally non-interchangeable:

- **Specified:** the product decision, invariant, and acceptance criteria are
  documented.
- **Implemented:** source code and deterministic tests exist in the named
  repository.
- **Locally verified:** the recorded local test, build, artifact, or rendered
  browser gate passed against the current worktree.
- **Deployable candidate:** the repository can produce a release artifact, but
  the target environment and external release approvals are still absent.
- **Deployed:** independently readable addresses, bytecode, configuration, and
  runtime evidence exist in an authorized environment.
- **Operating:** a funded program, accountable service owners, production
  controls, and real members exist.
- **Proven:** a sponsor renews, expands, or refers after measured use and safe
  closeout.

The current release is **implemented and locally verified at its named
Robinhood gates**. The protocol, SDK, and website repositories are clean
committed candidates. The protocol's aggregate `verify:public` command still
fails its dependency-advisory step on seven high and one moderate pre-existing
frontend advisories outside the Robinhood package, so this is not an aggregate
clean release. The health-platform implementation is locally verified but
intentionally uncommitted because its worktree also contains unrelated
concurrent native-auth changes that must not be mixed into this release.

## Cross-Repository Implementation Register

| Workstream                          | Current source state                                 | What exists now                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | What is still external                                                                                                                                                                                                                                                                                                                                 |
| ----------------------------------- | ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| P-001–P-011 protocol                | Implemented and committed                            | Major-v2 isolated Robinhood EVM suite; exhaustive factory role checks; exact USDG custody; membership eligibility and signed revocation; human decision and appeal authority; canonical economic event replay; bounded stateful invariant fuzzing; durable blocked-attempt adapter telemetry; explicit incident exercises; generated ABI and manifest                                                                                                                                                                        | Independent audit and long-running fuzzing/formal review; live USDG/config readback; deployed addresses; source and bytecode verification; threshold-account role recovery; live signer/network rehearsal                                                                                                                                              |
| P-012 release path                  | Tooling implemented; deployment intentionally absent | Testnet deploy tooling, mainnet planning, example manifests/configuration, provenance generation, artifact hygiene, fail-closed release evidence                                                                                                                                                                                                                                                                                                                                                                             | Authorized deployer, dual live RPCs, verified explorer/source publication, finalized receipts, operational monitoring, approved testnet/mainnet promotion                                                                                                                                                                                              |
| S-001–S-006 SDK                     | Implemented and committed                            | Exact schema-2/protocol-major-2 bundle; typed nine-kind economic-event decoder; authorization-failure and blocked-attempt adapter support; typed role, duplicate-role, and incompatible-suite errors; eligibility packages; EIP-712/EIP-1271 decisions; safe action builders; exact simulation plans; provider-neutral smart-account/paymaster lifecycle; offline/reorg-aware query boundary                                                                                                                                 | OmegaX Docs publication receipt; a verified non-placeholder deployment manifest; production provider/account selection; live bytecode verification; wallet/passkey, bundler, paymaster, and provider conformance                                                                                                                                       |
| H-001–H-008 private control plane   | Implemented as adapter-driven local modules          | Versioned sponsor workspace, pseudonymous eligibility, consent/audit ledger, encrypted evidence lifecycle, request/review/SLA workflow, opaque notifications, chain projection/reconciliation, private/public reporting boundaries                                                                                                                                                                                                                                                                                           | Production identity, database, KMS, object store, malware scanner, authorization, notification, indexer, finality, reconciliation, alert, and on-call adapters                                                                                                                                                                                         |
| H-009–H-010 Nakama Operator         | Implemented as bounded runtime                       | Ten strict tools, fixed role/program/value/timeout policies, exact input commitments, schema-checked handler results, one-time approvals for the only two side effects, safe audit envelopes, and a non-authorizing evaluation gate                                                                                                                                                                                                                                                                                          | Production route, model/prompt release, durable approval/review-task stores, approved templates, evaluation corpus review, monitoring, incident ownership                                                                                                                                                                                              |
| H-011 Virtuals ACP                  | Implemented as disabled adapter boundary             | Public/synthetic payload allowlist; exact itemized USDG quote binding; separate operations account/treasury policy; exact `@virtuals-protocol/acp-node-v2` 0.1.9 npm provenance; narrow correction of the package's `USDC` label to USDG only for the exact Robinhood chain/address/decimals/package-registry/upstream-symbol tuple; independently supplied runtime verification with bounded freshness; reconnectable monotonic lifecycle store; idempotency, expiry, one-time human approval, and strict result validation | Resolve or explicitly accept the reviewed package's two high, one moderate, and one low production advisories and placeholder upstream test; controlled installation and integrity; written eligibility; live account/registry/allowance/runtime verification; production funding, webhook/reconciliation, and one low-value approved tokenless canary |
| H-012 reports                       | Implemented locally                                  | Authorized private and privacy-suppressed public report schemas, deterministic commitments, completed-by-generation-time period rule, chain/accounting inputs                                                                                                                                                                                                                                                                                                                                                                | Finalized-block timestamp binding, production data sources, authorization service, scheduled generation, public publishing approval, operating data                                                                                                                                                                                                    |
| A-001–A-004 sponsor product         | Fail-closed service port plus synthetic rehearsal    | A dedicated authenticated superadmin route, same-origin server proxy, strict eleven-action control-plane contract, capability-driven setup, revision/approval/commitment-bound requests, exact receipt validation, plus disabled synthetic sponsor/program/funding/accounting/closure states                                                                                                                                                                                                                                 | A durable production implementation of the service port, signer/wallet path, real sponsor inputs, live indexer/reconciliation, audited transaction builders, and operating owners                                                                                                                                                                      |
| A-005–A-008 member product          | Additive read model and UI implemented               | Sponsor-funded `$0` explanation, no-token boundary, terms, activation/recovery states, private evidence guidance, human review and appeal, finality/payment separation, history and data-rights path                                                                                                                                                                                                                                                                                                                         | Real eligibility/account activation, production evidence and request workflow, localization, accessibility study, low-bandwidth exercise, approved member terms                                                                                                                                                                                        |
| A-009–A-011 reviewer/safety product | Fail-closed service port plus synthetic rehearsal    | The same authenticated eleven-action boundary covers reviewer assignment, human-decision preparation, and incident pause; strict output validation rejects substituted actions, revisions, IDs, commitments, and incoherent capabilities; disabled fixtures show conflict/qualification/SLA, settlement, incident, and recovery states                                                                                                                                                                                       | Durable reviewer identity/assignment and purpose grants, real signatures/simulation, notification delivery, deployed guardian, recovery exercises, and tabletop approval                                                                                                                                                                               |
| W-001 buyer website                 | Implemented, committed, and rendered locally         | Category, sponsor-funded offer, design-partner conversion path, evidence-gated intake, legal and SEO copy                                                                                                                                                                                                                                                                                                                                                                                                                    | Production deployment and configured CRM/KV receipt destination                                                                                                                                                                                                                                                                                        |
| W-002 transparency website          | Implemented, committed, and fail-closed              | Zero-or-more public program sources; derived funded/current state; explicit freshness, finality, and reconciliation evidence; canonical Blockscout links; JSON/schema output; exhaustive empty, predeployment, current, stale, divergent, and failure rendering                                                                                                                                                                                                                                                              | Verified deployment manifest, indexer/public-report feed, live reconciled program evidence, and production publication                                                                                                                                                                                                                                 |
| W-003 agent/token website           | Complete packet implemented; publication gated       | Productive-agent explanation, exact authority boundary, tokenless ACP-first sequence, complete token-launch packet, section-level SHA-256 commitments, publication/expiry gates, SEO/navigation suppression, and pre-hydration redirect while unpublished                                                                                                                                                                                                                                                                    | ACP acceptance and paid jobs, independent token go/no-go, current verified packet, verified token transaction/address, treasury reporting, and publication approval                                                                                                                                                                                    |
| Marketing and GTM                   | C0/C1 materials implemented                          | Launch/media kit, buyer one-pager, editable sponsor deck, LinkedIn/X library, threads, Celeste/Virtuals outreach drafts, claim-stage publishing rules                                                                                                                                                                                                                                                                                                                                                                        | Founder personalization, recipient selection, explicit send/publish authorization, sponsor evidence for C2, operating evidence for C3, token evidence for C4                                                                                                                                                                                           |

## Protocol Candidate

The Solidity package under `contracts/robinhood/` implements the complete
Phase 0 economic and authority boundary. It keeps program custody separate from
company treasury, ACP operations, and any future token treasury. It also keeps
membership identifiers pseudonymous and places no raw evidence or medical
content onchain.

Material release properties include:

1. **Exact asset binding.** The suite validates the approved six-decimal asset
   configuration and rejects fee-on-transfer, malformed-metadata, and
   accounting-changing token behavior.
2. **Full-funding activation.** Program activation depends on the complete
   conservative liability budget, so a UI or sponsor promise cannot create an
   underfunded entitlement.
3. **Typed membership authority.** Eligibility and revocation are exact
   EIP-712 messages, support EOA and ERC-1271 signers, bind nonce/deadline,
   permit relaying, and make repeated revocation idempotent without permitting
   substitution.
4. **Human decision authority.** Initial and appeal decisions bind the current
   request, terms, evidence commitment/version, reviewer role, round, amount,
   recipient, nonce, and expiry. The appeal reviewer is independent.
5. **Conservative custody.** PoolVault tracks funded assets, maximum remaining
   liability, pending reservations, approved unpaid obligations, settlements,
   and sponsor refunds without treating token donations as usable budget.
6. **Bounded automation.** Agent policy can authorize typed operational actions
   but cannot become a generic wallet or arbitrary-call authority.
7. **Scoped safety controls.** Guardian actions are typed and bounded; no role
   receives an unrestricted administration escape hatch.
8. **Canonical reconstruction.** Major suite version 2 emits one
   `EconomicActivity` schema with asset, actor, beneficiary, signed amount,
   relevant IDs, and a complete resulting accounting snapshot. A real-log test
   replays all nine activity kinds into an independent ledger model.
9. **Durable blocked telemetry.** Rejected authorization consumption still
   reverts, while the exact reviewed adapter can separately record a grant that
   remains blocked without changing authorization or consumption state.
10. **Incident and invariant evidence.** Eight seeded sixteen-step stateful
    traces and exercises for lost signers, agent compromise, USDG freeze,
    contract bug, and outage-time pause behavior pass locally. They do not
    replace live operational rehearsals.
11. **Release provenance.** Generated artifacts bind the source revision and raw
    Solidity/ABI hashes, and clean-checkout tests prove that ignored or missing
    source files cannot silently pass a developer-worktree build.

The tracked examples remain visibly unconfigured. Their presence is not a
deployment claim and no downstream client may infer a live address from them.

## SDK Candidate

The SDK carries and verifies the canonical schema-2, suite-major-2 protocol
bundle and all twelve ABIs byte-for-byte. It treats an unconfigured manifest or
a runtime suite-major mismatch as a capability boundary rather than a blank to
be filled by a caller. Read, signature, action, simulation, smart-account,
paymaster, and query flows are typed around that generated protocol contract.

The key safety properties are:

- integer USDG base-unit arithmetic with chain and asset binding;
- a typed, accounting-validated decoder for all nine `EconomicActivity` kinds,
  plus exhaustive error and receipt-state decoding;
- one immutable typed-data object for preview, signature, verification,
  replay, expiry, and substitution checks;
- action builders without a generic transaction-send escape hatch;
- exact pinned/fresh simulation expectations before any write can be promoted;
- provider-neutral smart-account and paymaster lifecycle interfaces that remain
  submission-disabled until the manifest, runtime, policy, account, and quote
  are verified, and that reject an incompatible live suite major;
- adapter-only blocked-attempt recording and typed authorization-failure
  inspection, without weakening the protocol's reverting authorization path;
- direct/indexed read reconciliation, bounded pagination/retries, snapshot and
  cursor validation, offline TTL, and conservative reorg invalidation;
- signed eligibility issuance and revocation helpers aligned with the current
  MembershipRegistry ABI.

These interfaces make unsafe wiring harder. They do not select a wallet,
provider, bundler, paymaster, indexer, or live deployment on the user's behalf.
The production-dependency and packed-consumer audits pass. The standard release
verifier passes; the exact publication verifier remains deliberately blocked
only on the honest `PENDING` OmegaX Docs commit, timestamp, and publisher
fields.

## Private Control Plane and Operator

The health-platform code defines the production trust seams without pretending
that in-memory test adapters are production infrastructure.

### Private data path

Evidence ingestion verifies consent and authorization, records the access
audit, and scans the content before object or metadata persistence. It encrypts
each object with an AES-256-GCM data key, binds authenticated metadata to the
exact program, request, subject, content digest, evidence version, bucket, and
consent policy, and exposes only commitments to public projections. Once the
private write-ahead envelope is durably prepared, retries preserve its exact
wrapped key, IV, tag, ciphertext digest, and object receipt through object,
metadata, audit, and cleanup recovery. A failure after KMS but before that
durable envelope exists may intentionally prepare a new key and envelope on
retry because no ciphertext has yet been persisted.

Raw evidence, filenames, storage paths, signed URLs, diagnoses, identifiers,
prompts, hidden reasoning, and reviewer notes are prohibited from chain, ACP,
analytics, and general logs. Retention, legal hold, and two-phase deletion are
explicit service states rather than implicit object-store behavior.

### Workflow and authority path

The request workflow structurally binds transitions to the current record
revision and preserves the supplied case's reviewer identifiers, round, terms,
evidence version, deadline, and review state. Notifications are opaque template
envelopes, use semantic idempotency, and share one atomic workflow-CAS/outbox
port, so a losing workflow race cannot leave a stale dispatchable envelope.
The module does not authenticate the actor against a reviewer account or prove
the provenance of a caller-supplied human-review case; production reviewer
authorization and verified-decision receipt consumption remain external gates.
Notifications do not make a state transition authoritative.

Workspace, eligibility, workflow/notification, and projection mutations append
a durable audit intent before their exact state write, emit the domain success
action only after the CAS or atomic workflow/outbox write commits, and emit an
abort after a definite conflict. The handle supports idempotent reconciliation
after a crash, and forced losing-CAS tests prove that no target success event is
left behind. Production composition still needs a durable pending-intent worker
and a trusted domain-outcome resolver; caller assertion alone is not sufficient
reconciliation evidence.

Program reports bind the exact program/grant/period inputs and reject an
unfinished or future reporting period. Public reports apply small-count
suppression and contain no private case material. The local projection does not
yet bind the report period to an independently reconciled finalized-block
timestamp, so production publication remains blocked on that proof.

### Nakama Operator path

The Operator has ten named tools:

- draft a program proposal;
- simulate budget and caps;
- compare terms to an approved template;
- check evidence completeness by commitments;
- create a reviewer task;
- monitor public program state;
- prepare a public-safe report;
- draft a reviewed member or sponsor message;
- quote an ACP job;
- deliver an ACP job.

It has no adjudication, signature, settlement, refund, transfer, arbitrary
database, raw RPC, raw evidence, or generic wallet tool. Every handler result
must echo the canonical commitment of the exact authorized input, so a valid
result from another invocation is rejected. Reviewer-task creation and ACP
delivery require exact, unexpired, one-time human approval consumed before the
side effect, plus an idempotency key for reconciliation after ambiguous
transport outcomes.

The evaluation gate can only say that a named configuration is eligible for a
named human release decision. It cannot modify authority.

### Virtuals ACP dependency boundary

The reviewed integration target is the official
`@virtuals-protocol/acp-node-v2` 0.1.9 npm artifact. Its package declarations
include Robinhood mainnet 4663 and testnet 46630, the mainnet ACP contract
`0x238E541BfefD82238730D00a2208E5497F1832E0`, and the canonical mainnet asset
address `0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168`. Those declarations confirm
package-level support; they are not evidence that a Nakama account is
registered, funded, approved, connected, or able to complete a job.

The package places that canonical six-decimal USDG address in a registry named
`USDC_ADDRESSES` and applies the symbol `USDC`. The Nakama wrapper treats this
as a narrow upstream label defect: it normalizes to `USDG (Global Dollar)` only
when chain, address, decimals, registry name, upstream symbol, reviewed package
version, git head, and registry integrity all match. Every alternate tuple is
rejected. Product and public API surfaces continue to reject USDC.

The dependency is intentionally not installed in the health platform yet. A
temporary exact-package audit found two high, one moderate, and one low
production advisory in transitive dependencies, and the upstream package test
script is a placeholder. Those findings must be resolved or explicitly accepted
before controlled installation. A trusted verifier must independently attest
the exact package and runtime snapshot before the adapter can become ready, and
that verification expires rather than remaining valid indefinitely. Production
activation additionally requires live ACP bytecode/API verification, account
and registry enrollment, allowance and operating-treasury checks,
reconnect/readback reconciliation, and a low-value public-data-only canary.
Program custody and member evidence remain outside this boundary.

## Product Surfaces

The sponsor and member implementations combine a controlled rehearsal with a
strict, unconfigured production service seam. Neither implies a live financial
product.

- The sponsor workspace shows who would be accountable, the exact maximum
  liability and budget, staged funding/finality/reconciliation, reviewer and
  appeal controls, privacy-safe operating reports, closure/refund gates, and
  incident ownership.
- Every synthetic Phase 0 fixture control remains disabled and handler-free. A
  separate authenticated superadmin control-plane panel can call only eleven
  named operations through a same-origin server proxy. Its injected oracle
  route is mounted under authenticated `/v1/internal`, while the injected
  service implementation is `null` and all capabilities are disabled by
  default; GET returns the disabled workspace and POST fails unavailable.
  Requests are revision-, commitment-, approval-, and time-bound, and accept no
  raw evidence, key, RPC URL, signer, arbitrary calldata, or wallet operation.
- The dedicated `/ops/protocol/robinhood-phase0` route is isolated from the
  legacy Operator wallet/write surface, so the old controls cannot silently
  become Phase 0 execution authority.
- The member panel says `$0 — sponsor funded`, states that `$NAKAMA` is not
  required, separates an agent draft from a human decision, explains evidence
  privacy and appeal independence, and distinguishes finalized network record
  from confirmed member payment.
- An incoming record cannot self-assert `live`. The UI still fails closed while
  the canonical release contract is synthetic-only, mainnet writes are
  disabled, or the generated manifest/SDK is unconfigured.
- Existing non-Robinhood claims continue to parse and render without being
  relabeled. No current production route or chain union is silently switched.

## Website, Narrative, and Marketing

The public experience now presents one clear hierarchy:

1. **Buyer problem:** international cohort operators carry an unowned health
   support gap.
2. **Paid first step:** a scoped Protection Design Sprint defines one bounded,
   fully budgeted sponsor program.
3. **Member product:** sponsor-funded support with understandable terms,
   private evidence, accountable human review, independent appeal, and no
   token requirement.
4. **Infrastructure:** Robinhood Chain records minimum economic truth;
   encrypted services hold sensitive evidence; the Operator reduces repetitive
   work; Virtuals ACP can distribute public non-PHI agent services.
5. **Future network:** tokenization is a separate decision earned by product
   demand, operating proof, legal/security readiness, and actual network
   utility.

The canonical collateral is:

- `nakamahealth-website/marketing/generated/Nakama_Genesis_One_Pager.pdf` — one
  unencrypted A4 page;
- `nakamahealth-website/marketing/generated/Nakama_Sponsor_Deck.pptx` —
  editable, placeholder-free eleven-slide meeting deck;
- `nakamahealth-website/marketing/social-posts.json` — 15 LinkedIn posts, 20
  standalone X posts, and three X threads with evidence stages;
- `nakamahealth-website/marketing/linkedin-outreach.json` — sub-300-character
  Celeste and Virtuals connection notes plus relationship-first follow-ups;
- `nakamahealth-website/marketing/LAUNCH_AND_MEDIA_KIT.md` — one-liners,
  blurbs, founder copy, FAQs, launch language, press responses, and claim
  controls.

C0 build-thesis content and the generic C1 founder-led sales collateral are
ready. C2 named-program content, C3 operating claims, and C4 token posts remain
gated by their actual evidence. Drafting is not authorization to send or
publish.

## Verified Evidence

The final release report must preserve the exact command outputs from the
current settled trees. At this snapshot, the verified evidence includes:

| Surface                           | Verified local result                                                                                                                                                                                                                                                                                                                                                                                            |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Protocol Robinhood suite          | 42 focused tests passed                                                                                                                                                                                                                                                                                                                                                                                          |
| Protocol full EVM suite           | 97 tests passed                                                                                                                                                                                                                                                                                                                                                                                                  |
| Protocol Node/tooling suite       | 272 tests passed                                                                                                                                                                                                                                                                                                                                                                                                 |
| Protocol clean Git archive        | 40 Solidity sources compiled from a tracked-only archive; the Phase 0 plus mainnet-planning selector passed 38/38; artifact hygiene, semantic, provenance, license, and SBOM checks passed                                                                                                                                                                                                                       |
| Protocol aggregate release gate   | `verify:public` remains red only at the dependency-advisory step: seven high and one moderate pre-existing frontend advisories in `@react-native/virtualized-lists`, `axios`, `next`, `react-devtools-core`, `react-native`, `sharp`, `shell-quote`, and `@solana/spl-governance`; the Robinhood-specific gates before it pass                                                                                   |
| SDK                               | 167/167 tests passed; typecheck, lint, format, build, 252-file generated API-doc parity, 86 documentation references across 10 subpaths, 12-contract/232-function/40-event runtime inventory, artifact parity, production audit, packed-consumer audit, examples, templates, CLI/DX smoke, and package dry-run passed; strict publication check is blocked only on the three honest OmegaX Docs `PENDING` fields |
| Protocol-oracle control plane     | TypeScript build and 550/550 full tests passed; focused authenticated-control-plane tests include exact capability/receipt validation and malicious substitution rejection; the ACP adapter passes 17/17 focused tests including exact TTL expiry, single-flight re-verification, slow-approval recheck, and failed-refresh blocking                                                                             |
| Shared health contract/display    | 10 tests passed                                                                                                                                                                                                                                                                                                                                                                                                  |
| Health agent                      | 267/267 full service tests passed; TypeScript build passed                                                                                                                                                                                                                                                                                                                                                       |
| Business sponsor/reviewer surface | 51/51 unit tests, type-check, lint, and production build passed; authenticated Chrome smoke passed across public/invite widths 320–1,440, role/API boundaries, and the dedicated Phase 0 route; five synthetic actions remained disabled, the unconfigured service failed closed, refresh could not enable writes, and desktop/mobile had no horizontal overflow                                                 |
| Member surface                    | 13/13 focused and 1,173/1,173 full tests passed across 165 files; lint and production build passed                                                                                                                                                                                                                                                                                                               |
| Health product browser audit      | Member coverage surface rendered at 1280×900 and 390×844 without horizontal overflow or console errors; source semantics and responsive classes compile and lint. This is not zoom, keyboard, screen-reader, contrast, or WCAG-conformance proof                                                                                                                                                                 |
| Virtuals ACP dependency review    | Exact package 0.1.9 provenance and Robinhood declarations were source-checked; an isolated production audit found two high, one moderate, and one low transitive advisories, and the package test script is a placeholder. The package remains deliberately uninstalled in the health platform                                                                                                                   |
| Website                           | 72/72 tests passed; production client and SSR builds, 11 prerendered routes, status, token-packet, claim, distribution, and generated-output gates passed                                                                                                                                                                                                                                                        |
| Website browser QA                | Manual desktop checks were reported for `/`, `/agent`, `/protocol`, `/design-partner`, and `/risk`, with mobile checks for `/agent`, `/protocol`, `/design-partner`, and `/risk`; navigation, labels, overflow, and the gated-route redirect were checked, but the browser evidence was not archived in the repository                                                                                           |
| Marketing artifacts               | Deck and one-pager checksums match the visually reviewed files; 15 LinkedIn posts, 20 X posts, three threads, and five core assets pass the automated claim gate                                                                                                                                                                                                                                                 |

A passing local test does not prove a live adapter, security audit, legal
structure, sponsor demand, or production operation.

## Commit and Worktree Provenance

### Protocol

- `0cb347f1` — initial Robinhood Phase 0 protocol implementation
- `1d7155d0` — release-provenance hardening
- `906167e6` — eligibility, custody, hostile-token, and source-boundary
  hardening
- `d02cf8cd` — regenerated canonical Robinhood artifacts
- `6392e2c7` — protocol-major-v2 authority, economic-event, blocked-attempt,
  invariant, incident, and release controls
- `b384e3e3` — regenerated canonical protocol-major-v2 artifacts

Protocol commits are signed off. No protocol commit has been pushed or
deployed from this branch.

### SDK

- `9d9cb90` — Robinhood protocol SDK
- `acfe10d` — SDK release-boundary hardening
- `a2c268f` — signed eligibility issuance/revocation API and latest generated
  protocol synchronization
- `dc9d8f1` — provider-neutral smart-account lifecycle boundary
- `154ddc4` — exact protocol-major-v2 migration, economic-event decoder,
  blocked-attempt support, typed compatibility errors, and regenerated docs

No SDK commit has been pushed or published from this branch.

The synchronized SDK records canonical protocol source
`6392e2c774b66252b62245ffee18c18b3803b9be`, schema version 2, protocol suite
major 2, economic-event schema version 2, protocol artifact SHA-256
`3e66c8340badccb9e413414e7dada7e80c3a8d46560d439153a799a9be5e2f1b`,
PoolVault ABI SHA-256
`4e8dae8989e20802b7cdcecf5accc413f0a0ffd3da554f0e18d0c78885ace44d`,
`EconomicActivity` topic 0
`0x66c2674649a39002b7b60387490bfe265f1679193ced8acb3ffb131893cde2f6`,
and deployment-code commitment
`0xafca0d891a53056ba7689c1c83a49d48ce7337e24709f380d52459892fe39677`.

### Health platform

The Robinhood changes are intentionally uncommitted at this snapshot. The same
worktree contains unrelated concurrent Android, iOS, and
`contracts/auth/session.json` changes. Those paths were neither staged,
modified for Robinhood, nor reverted. The Robinhood implementation must be
committed with an explicit safe path list, or from a clean isolated worktree,
after owner approval.

### Website

- `55329c4` — Robinhood Phase 0 product narrative
- `8f6685a` — claim alignment and legacy-deck quarantine
- `f8fdeb4` — evidence-gated launch surface
- `d9a6281` — verified sponsor collateral
- `77cfb32` — pre-hydration gated-route redirect
- `2fd3261` — reconciled public-program truth and complete token-publication
  packet gates

No website commit has been pushed or deployed from this branch. The currently
deployed site must not be described as containing this release.

## External Release Gates

The following are intentionally not replaced by more local code:

1. **Commercial evidence:** a qualified operator pays for a scoped sprint,
   approves the program design, and funds the complete budget.
2. **Legal and product classification:** counsel approves the exact
   jurisdictions, sponsor/member relationship, terms, complaints/appeals,
   marketing language, data roles, and token separation.
3. **Privacy and security:** threat model, independent contract review, app and
   infrastructure review, KMS/object/IAM design, incident response, retention,
   data-subject workflow, and production evidence handling are approved.
4. **Robinhood environment:** current chain/RPC/explorer behavior, exact USDG
   contract and configuration, provider diversity, finality behavior, account
   abstraction, source verification, and operational constraints are verified
   against live state.
5. **Deployment:** testnet and shadow-mainnet transactions, addresses,
   constructors, source, bytecode, roles, signers, manifests, receipts,
   indexer/reconciliation, monitoring, alerts, and rollback evidence exist.
6. **Production services:** durable identity, eligibility, workflow, evidence,
   authorization, audit, report, notification, indexer, KMS, object-store,
   scanner, telemetry, and on-call adapters are mounted and exercised.
7. **Virtuals ACP:** package-level Robinhood declarations and the exact USDG
   label normalization are already source-verified. Eligibility, entity/account
   requirements, exact dependency installation and integrity, live bytecode/API
   mechanics, registry enrollment, allowance, operating funding, quote/job
   behavior, bounded verification freshness, reconnect reconciliation, and the
   public-data boundary still need independent runtime verification and a
   low-value tokenless canary. The reviewed package's four production
   advisories and placeholder test also require a recorded resolution or risk
   acceptance before installation.
8. **Token:** product, legal, security, treasury, distribution, market-health,
   platform, and funded-program gates independently pass. No program right,
   reserve, claim, decision, or member access depends on the token.
9. **Public operation:** the website intake has a configured receipt-producing
   destination; authenticated sponsor/member/reviewer flows pass browser and
   accessibility QA; current addresses/status are published from verified
   artifacts.

## Recommended Release Sequence

1. Separate and commit only the reviewed health-platform paths without touching
   the concurrent native-auth work.
2. Freeze the cross-repository artifact digests and archive the final local
   test evidence.
3. Obtain one paid design partner and run the legal/privacy/product design
   sprint in parallel with a synthetic testnet rehearsal.
4. Configure production-grade adapters in a default-off environment, then run
   recovery, reorg, provider-divergence, reviewer-timeout, appeal, evidence,
   solvency, notification, and incident exercises.
5. Deploy and verify an unfunded testnet/shadow suite only after the environment
   and signer controls are approved.
6. Operate one bounded sponsor-funded canary, reconcile every action, close it
   safely, and obtain a renewal/expansion/referral signal.
7. Prove at least one paid tokenless ACP job using public or synthetic data.
8. Reopen the independent `$NAKAMA` decision only with both product proof and a
   concrete network-coordination use that cannot be served more safely without
   a token.

## Go/No-Go Verdict

- **Go:** founder-led design-partner outreach, private demos, technical review,
  sponsor collateral, C0 build narrative, and external platform discovery.
- **Go with explicit synthetic labeling:** local sponsor/member/Operator demos
  and controlled testnet engineering.
- **No-go today:** public deployment claims, a funded member program, production
  evidence handling, autonomous adverse decisions, Robinhood/Virtuals approval
  claims, token publication, or C2–C4 launch communications.

The implementation has reached the point where the next bottleneck is external
proof and safe environment integration, not another narrative pivot. The
correct next milestone is a paid design partner plus a verified tokenless
vertical slice, not a speculative token launch.
