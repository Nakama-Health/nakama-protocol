# Operator Runbooks — Index

Single index for the operator runbooks under `docs/operations/`. Use the role × environment table below to find the canonical entry point for the work you're doing, then follow the linked runbook for the full sequence and any environment-specific guards.

This page does not replace the individual runbooks — they remain the canonical source for their respective flows. This is a navigation layer so a contributor can find the right runbook without reading four READMEs.

## Role × environment quickstart

| Role                                 | Environment                                  | Entry point                                                                                                   | Runbook                                                                                       |
| ------------------------------------ | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Reviewer / contributor               | Local working tree                           | `make verify` (or `npm run verify:public`)                                                                    | [public-release-gate.md](./public-release-gate.md)                                            |
| Reviewer / contributor               | Local working tree, protocol-touching change | `npm run test:e2e:localnet`                                                                                   | [public-release-gate.md](./public-release-gate.md)                                            |
| Release manager                      | Public-tag / mainnet promotion               | fill in evidence template before promoting                                                                    | [release-candidate-evidence-template.md](./release-candidate-evidence-template.md)            |
| Devnet operator                      | Shared devnet beta                           | `npm run devnet:beta:deploy` → `npm run protocol:bootstrap:devnet-live` → `npm run devnet:frontend:bootstrap` | [devnet-beta-runbook.md](./devnet-beta-runbook.md)                                            |
| Devnet operator                      | Devnet observability sweep                   | `npm run devnet:beta:observe`                                                                                 | [devnet-beta-runbook.md](./devnet-beta-runbook.md)                                            |
| Devnet operator                      | Drawer simulation (no state mutation)        | `npm run devnet:operator:drawer:sim`                                                                          | [devnet-beta-runbook.md](./devnet-beta-runbook.md#operator-drawer-simulation)                 |
| Mainnet operator                     | Genesis live bootstrap (preview)             | `npm run protocol:bootstrap:genesis-live -- --plan`                                                           | [genesis-live-bootstrap.md](./genesis-live-bootstrap.md)                                      |
| Mainnet operator                     | Genesis live bootstrap (apply)               | `npm run protocol:bootstrap:genesis-live` (with `OMEGAX_REQUIRE_DISTINCT_OPERATOR_KEYS=1`)                    | [genesis-live-bootstrap.md](./genesis-live-bootstrap.md)                                      |
| Mainnet operator / frontend reviewer | Phase 0 surface gating                       | confirm launch profile, disabled previews, and reservation visibility                                         | [phase0-mainnet-surface-gating.md](./phase0-mainnet-surface-gating.md)                        |
| Protocol / incident reviewer         | Robinhood Phase 0 local incident rehearsal   | `npm run robinhood:test` and retain public-safe evidence                                                      | [robinhood-phase0-incident-exercises.md](./robinhood-phase0-incident-exercises.md)            |
| Launch operator                      | Founder reservation mode                     | configure Squads vault, route public CTAs, reconcile pending reservations                                     | [founder-reservation-runbook.md](./founder-reservation-runbook.md)                            |
| Hosting operator                     | Firebase App Hosting cutover                 | follow the cutover checklist                                                                                  | [firebase-app-hosting-cutover.md](./firebase-app-hosting-cutover.md)                          |
| Release manager                      | Public-tag promotion                         | walk the gate, then publish notes                                                                             | [public-release-gate.md](./public-release-gate.md) + [release-v0.3.1.md](./release-v0.3.1.md) |
| Anyone touching the on-chain surface | Local                                        | `npm run anchor:idl` then `npm run protocol:contract` then `npm run idl:freshness:check`                      | [public-release-gate.md](./public-release-gate.md#generated-artifacts)                        |

## Pre-flight: required environment

These environment-variable expectations are enforced by the underlying scripts, but new operators commonly hit the missing-variable wall first. The list below is the union — see each runbook for which subset applies.

- `SOLANA_KEYPAIR` — operator keypair path. Defaults to `~/.config/solana/id.json`.
- `OMEGAX_LIVE_ORACLE_WALLET`, `OMEGAX_LIVE_ORACLE_KEYPAIR_PATH` — Genesis live oracle wallet pair (mainnet bootstrap).
- `OMEGAX_LIVE_SETTLEMENT_MINT` — settlement asset mint for the live cluster (mainnet bootstrap).
- `OMEGAX_DEVNET_OPERATOR_SOURCE_TOKEN_ACCOUNT` and `OMEGAX_DEVNET_*_VAULT_TOKEN_ACCOUNT` — optional devnet custody token accounts for drawer simulation or explicit treasury movement; the trimmed live bootstrap itself does not move SPL custody balances.
- `OMEGAX_REQUIRE_DISTINCT_OPERATOR_KEYS=1` — **required on mainnet**; refuses configs where any two privileged roles resolve to the same pubkey. Bootstrap hard-fails on mainnet without this flag.
- `OMEGAX_LIVE_{RESERVE_DOMAIN_ADMIN,SPONSOR,SPONSOR_OPERATOR,CLAIMS_OPERATOR,POOL_CURATOR,POOL_ALLOCATOR,POOL_SENTINEL}_WALLET` — **required on mainnet**; without explicit values these default to the governance signer and the bootstrap refuses to load. See [`../security/mainnet-privileged-role-controls.md`](../security/mainnet-privileged-role-controls.md) §1 for the role matrix.
- `OMEGAX_LIVE_CLUSTER_OVERRIDE=devnet|localnet` — opt out of the mainnet guard for isolated rehearsals against a private mainnet-beta-like cluster.
- `OMEGAX_ALLOW_LOCAL_SIGNER_FOR_MAINNET=1` — break-glass override for incident recovery; emits a loud stderr warning and **must** be recorded in the [release-candidate evidence template](./release-candidate-evidence-template.md) §8.
- `NEXT_PUBLIC_GOVERNANCE_REALM`, `NEXT_PUBLIC_GOVERNANCE_CONFIG`, `NEXT_PUBLIC_GOVERNANCE_TOKEN_MINT` — optional legacy/adjunct frontend governance wiring; not required by the trimmed base-program bootstrap.

The `scripts/CLAUDE.md` file is explicit that bootstrap, deploy, treasury, and legacy devnet governance scripts may mutate on-chain state — never run them unless the operator/contributor explicitly intends to.

## Generated artifacts

When the on-chain program surface changes, regenerate the checked-in artifacts so SDKs downstream stay in sync:

```bash
npm run anchor:idl              # rebuilds + copies checked-in program IDLs + writes source hashes
npm run protocol:contract       # regenerates shared/protocol_contract.json and frontend/lib/generated/
npm run idl:freshness:check     # CI-mirrored guard: fails if any gated program source drifted from its checked-in IDL
npm run protocol:contract:check # CI-mirrored guard: fails if generated downstreams drifted from the IDL
```

CI runs `idl:freshness:check` and `protocol:contract:check` automatically (see `.github/workflows/ci.yml`). Run Localnet E2E locally before pushing protocol-touching changes. The hosted Localnet E2E workflow (`.github/workflows/localnet-e2e.yml`) is manual and reserved for release candidates or cases where local reproduction is not enough.

## Public-safety guardrails

- Never commit secrets, private keys, deployment-only env files, or local validator artifacts to this repo. The `npm run public:hygiene:check` gate looks for the most common patterns.
- The Genesis vanity wallet `oxhocTdPyENqy9RS13iaq2upoNAovMJHu9PMaBxrK8h` is public-safe; the corresponding private keypair is **not**. See `CLAUDE.md` Genesis Protect Launch Keys for the env-var contract.
- `idl/`, `shared/protocol_contract.json`, and `frontend/lib/generated/` are generated artifacts — do not hand-edit unless a documented maintenance workflow explicitly requires it.

## Related references

- [`README.md`](../../README.md) — repo entry point
- [`CONTRIBUTING.md`](../../CONTRIBUTING.md) — DCO, dep policy, PR expectations
- [`scripts/README.md`](../../scripts/README.md) — full script catalog (operator + verification tooling)
- [`docs/testing/protocol-surface-audit.md`](../testing/protocol-surface-audit.md) — canonical scenario coverage matrix
- [`docs/operations/dependency-advisory-risk-acceptance.md`](./dependency-advisory-risk-acceptance.md) — accepted advisories
