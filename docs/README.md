# Documentation

This directory contains the public documentation set for `nakama-protocol`.

If you are evaluating the current Genesis launch surface, start with the sponsor Travel 30 path below before diving into the broader repo-internal architecture notes.

## Sponsor Travel 30 start here

- [Genesis Protect V1 Curve Launch Plan](./architecture/genesis-protect-v1-curve-launch.md) — primary Travel 30 Founder launch recommendation, Event 7 cohort/demo boundary, reserve gating, and reserve-indexed cap doctrine
- [Genesis Protect Claim Trace](./architecture/genesis-protect-claim-trace.md) — one Travel 30 claim from intake through evidence, attestation, obligation, reserve impact, and payout
- [Genesis Protect Acute Claims Processing Spec](./architecture/genesis-protect-acute-claims-processing-spec.md) — Phase 0 claim workflow, evidence rules, escalation, denial, and payout timing
- [What Exists Today](https://docs.nakama.health/docs/protocol/current-program-surface)
- [Protocol Architecture](https://docs.nakama.health/docs/protocol/architecture)

This path is intentionally launch-truth-first: `Travel 30` is the primary reserve-indexed Founder SKU, `Event 7` is the short-window cohort/demo SKU, and Phase 0 claims remain operator-backed rather than fully decentralized.

## External builder start here

- [SDK Overview](https://docs.nakama.health/docs/sdk/sdk-overview)
- [SDK Getting Started](https://docs.nakama.health/docs/sdk/sdk-getting-started)
- [SDK Workflows](https://docs.nakama.health/docs/sdk/sdk-workflows)
- [Oracle Event Production](https://docs.nakama.health/docs/oracle/event-production)
- [What Exists Today](https://docs.nakama.health/docs/protocol/current-program-surface)
- [Protocol Architecture](https://docs.nakama.health/docs/protocol/architecture)

## Sections

### Robinhood Chain and Virtuals target plan

- [Robinhood and Virtuals strategy and implementation index](./robinhood-virtuals/README.md) — five-pass, product-first plan for a sponsor-funded Genesis Protection Program, Robinhood-native protocol and agent, conditional Virtuals token launch, GTM, safety gates, and ninety-day backlog

The Phase 0 contract candidate is now implemented and locally tested; see
[Robinhood Phase 0 Protocol Implementation](./architecture/robinhood-phase0-protocol.md).
It is still not a live product, customer, legal status, deployment, token,
Robinhood relationship, or Virtuals approval. The current public protocol
surface remains the source of truth until a release packet and verified
deployment explicitly supersede it.

### Architecture

- [Repository Layout](./architecture/repository-layout.md)
- [Ethereum Mainnet Protocol Vertical Slice](./architecture/ethereum-mainnet-protocol.md) — immutable contract boundary, reserve accounting, claim finality, integration, and release gate
- [Robinhood Phase 0 Protocol Implementation](./architecture/robinhood-phase0-protocol.md) — isolated sponsor-funded USDG suite, canonical ABI, local evidence, and fail-closed deployment boundary
- [Robinhood Phase 0 Incident Exercises](./operations/robinhood-phase0-incident-exercises.md) — local lost-signer, agent, USDG, contract-bug, and outage containment evidence with explicit production boundaries
- [Protocol Vision and Capability Narrative](./architecture/protocol-vision-and-capability-narrative.md)
- [Solana Program Architecture](./architecture/solana-program-architecture.md)
- [Solana Instruction Map](./architecture/solana-instruction-map.md)
- [Decentralized Coverage Claims](./architecture/decentralized-coverage-claims.md) — abstract claim model
- [Genesis Protect Claim Trace](./architecture/genesis-protect-claim-trace.md) — deterministic end-to-end walkthrough + messy-path map
- [Genesis Protect V1 Curve Launch Plan](./architecture/genesis-protect-v1-curve-launch.md) — accepted V1 launch recommendation for reserve-indexed Travel 30, reserve gating, and Phase 0 claims
- [Frontend Information Architecture](./architecture/frontend-information-architecture.md)
- [Protocol Console Functional Specification](./architecture/protocol-console-functional-spec.md)

### Reviews

- [Review and Iterate Readiness Review (May 10, 2026)](./reviews/review-and-iterate-2026-05-10.md)
- [Solana Public Readiness Review (March 10, 2026)](./reviews/solana-public-readiness-review.md)

### Reference

- [Liquidity Pool Metadata Schema](./reference/liquidity-pool-metadata-schema.md)

### Examples

- [Non-Canonical Protocol Examples](../examples/README.md)

### Testing

- [Protocol Surface Audit](./testing/protocol-surface-audit.md)

### Operations

- [Operator Runbooks — Index](./operations/runbooks.md) — start here for role × environment routing
- [Devnet Beta Runbook](./operations/devnet-beta-runbook.md)
- [Genesis Live Bootstrap](./operations/genesis-live-bootstrap.md)
- [Public Release Gate](./operations/public-release-gate.md) — `verify:public` is repo baseline; production promotion needs the evidence template
- [Release-Candidate Evidence Template](./operations/release-candidate-evidence-template.md) — fill in before public-tag or mainnet promotion
- [Firebase App Hosting Cutover](./operations/firebase-app-hosting-cutover.md)
- [Dependency Advisory Risk Acceptance](./operations/dependency-advisory-risk-acceptance.md)
- [Release v0.3.0](./operations/release-v0.3.0.md)
- [Release v0.3.1](./operations/release-v0.3.1.md)

### Security

- [Ethereum CROPS and Walkaway Review](./security/ethereum-crops-walkaway.md) — mandate alignment, trust boundaries, honest decentralization limits, and mainnet release conditions
- [Mainnet Privileged-Role Controls](./security/mainnet-privileged-role-controls.md) — role matrix, multisig requirement, break-glass exception, rotation, incident recovery
- [Pre-Mainnet Pen-Test (2026-04-27)](./security/pre-mainnet-pen-test-2026-04-27.md)

### Public Site

- [Nakama Docs](https://docs.nakama.health/docs)
- [SDK Overview](https://docs.nakama.health/docs/sdk/sdk-overview)
- [SDK Getting Started](https://docs.nakama.health/docs/sdk/sdk-getting-started)
- [SDK Workflows](https://docs.nakama.health/docs/sdk/sdk-workflows)
- [Oracle Event Production](https://docs.nakama.health/docs/oracle/event-production)
- [What Exists Today](https://docs.nakama.health/docs/protocol/current-program-surface)
- [Protocol Architecture](https://docs.nakama.health/docs/protocol/architecture)
- [Why Nakama](https://docs.nakama.health/docs/thesis/why-nakama)

## Audience Guide

- Use [Genesis Protect V1 Curve Launch Plan](./architecture/genesis-protect-v1-curve-launch.md) when deciding how a sponsor-backed Travel 30 Founder cohort should launch, what Event 7 is allowed to mean, and how reserve gating constrains the promise.
- Use [Genesis Protect Claim Trace](./architecture/genesis-protect-claim-trace.md) when a sponsor, operator, or reviewer needs to follow one claim from evidence through payout without reading the whole program.
- Use [Genesis Protect Acute Claims Processing Spec](./architecture/genesis-protect-acute-claims-processing-spec.md) when checking Phase 0 claim operations, evidence requirements, denial/appeal posture, and payout timing.
- Use [SDK Overview](https://docs.nakama.health/docs/sdk/sdk-overview) when you want the fastest public explanation of what builders can ship on Nakama today.
- Use [SDK Getting Started](https://docs.nakama.health/docs/sdk/sdk-getting-started) when you want to connect a client and choose the right builder workflow on devnet beta.
- Use [Oracle Event Production](https://docs.nakama.health/docs/oracle/event-production) when you are designing an oracle, signal-normalization layer, or event pipeline.
- Use [What Exists Today](https://docs.nakama.health/docs/protocol/current-program-surface) when you need the current public protocol boundary before reading repo internals.
- Use [Nakama Docs](https://docs.nakama.health/docs) when you want the polished public overview, product story, and external documentation hub rather than repo-specific workflow details.
- Use [Why Nakama](https://docs.nakama.health/docs/thesis/why-nakama) when you need the clearest public statement of the protocol’s purpose and long-range destination.
- Use [Protocol Vision and Capability Narrative](./architecture/protocol-vision-and-capability-narrative.md) when you need the repo-local explanation of the trimmed protocol vision, current accounts, current functions, and community-owned coverage narrative.
- Use [Ethereum Mainnet Protocol Vertical Slice](./architecture/ethereum-mainnet-protocol.md) for the Solidity contract graph, reserve ledger, claim lifecycle, canonical ABI, and immutable deployment boundary.
- Use [Ethereum CROPS and Walkaway Review](./security/ethereum-crops-walkaway.md) when evaluating censorship resistance, open-source reproducibility, privacy, security, or the limits of the current decentralization claim.
- Start with [Repository Layout](./architecture/repository-layout.md) if you are new to the repo and need the internal file map.
- Use [Solana Program Architecture](./architecture/solana-program-architecture.md) to understand the on-chain program layout and reviewer read order.
- Use [Solana Instruction Map](./architecture/solana-instruction-map.md) when tracing an instruction from entrypoint to handler, accounts, and helpers.
- Use [Decentralized Coverage Claims](./architecture/decentralized-coverage-claims.md) when you need the signer model, claim roles, and payout-path rules for reviewed coverage claims.
- Use [Protocol Console Functional Specification](./architecture/protocol-console-functional-spec.md) when you need the target-state screen-by-screen functional brief for the public protocol console.
- Use [Review and Iterate Readiness Review](./reviews/review-and-iterate-2026-05-10.md) for the latest scored audit, remaining blockers, and validation evidence.
- Use [Solana Public Readiness Review](./reviews/solana-public-readiness-review.md) for the historical March 2026 scored audit and cleanup backlog.
- Use [Liquidity Pool Metadata Schema](./reference/liquidity-pool-metadata-schema.md) when integrating LP-facing off-chain APY metadata for a `LiquidityPool`.
- Use [Protocol Surface Audit](./testing/protocol-surface-audit.md) when you need the heavier localnet proof for canonical instruction ownership, scenario coverage, and release-candidate sign-off.
- Start with [Operator Runbooks — Index](./operations/runbooks.md) when you need to find the right runbook for a role × environment without reading every operations doc.
- Use [Devnet Beta Runbook](./operations/devnet-beta-runbook.md) for structured devnet beta operations.
- Use [Genesis Live Bootstrap](./operations/genesis-live-bootstrap.md) when seeding the live Genesis Protect Acute launch surface on a real cluster.
- Use [Public Release Gate](./operations/public-release-gate.md) for the repo-only verification baseline and release-candidate sign-off workflow.

For directory-specific guidance, also see:

- [../e2e/README.md](../e2e/README.md)
- [../frontend/README.md](../frontend/README.md)
- [../scripts/README.md](../scripts/README.md)
- [../programs/README.md](../programs/README.md)
- [../tests/README.md](../tests/README.md)
