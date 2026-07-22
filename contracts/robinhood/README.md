# Robinhood Chain Phase 0 Protocol

This package is the buildable, unaudited Robinhood-native implementation of
the sponsor-funded Genesis Protection Program. It is isolated from the current
Solana and Ethereum candidates and does not change either deployed surface.

The code can compile, deploy deterministically on a local EVM, and execute the
complete synthetic lifecycle. It has not been deployed to Robinhood testnet or
mainnet, independently audited, legally approved, or funded with real USDG.

## Contract graph

Global contracts:

- `AssetRegistry` pins a six-decimal asset's address, chain, identity,
  metadata, and runtime hash, and rechecks its live metadata and code before a
  deployment. Pausing or deprecating an asset does not rewrite an existing
  program.
- `TemplateRegistry` admits a reviewed factory, semantic version, component
  bytecode commitment, template commitment, and review commitment.
- `NakamaFactory` is permanently bound to one active funding-asset address and
  its registered identity snapshot. It rejects every other registered token,
  including six-decimal lookalikes, verifies all eight component creation-code
  hashes, and asks a one-purpose `Create2Deployer` to deploy deterministic
  instances. Only the named sponsor may deploy, so an operator cannot register
  a program under a third party's identity or consume that sponsor's salt.
- `PoolRegistry` is an append-only discovery index for deployed programs.

Each program receives its own immutable instances:

- `ProtectionProgram` holds terms, roles, time windows, caps, activation gates,
  lifecycle, and module bindings.
- `PoolVault` holds only the program's USDG and maintains the conservative
  liability, pending-request, obligation, settlement, and refund ledger.
- `MembershipRegistry` verifies EIP-712 or EIP-1271 eligibility and recovery
  authorizations without accepting identity or health fields.
- `DecisionModule` verifies typed initial and appeal decisions from distinct
  accountable reviewers.
- `ClaimManager` records public-safe request commitments, information requests,
  deadline escalation, denials, appeals, approvals, and settlement state.
- `SettlementModule` executes an approved obligation exactly once.
- `AgentAuthorizationRegistry` records expiring, selector-bound, call-capped
  non-economic grants and consumption reports. It contains no arbitrary-call
  executor and excludes the factory, every per-program module, the funding
  asset, and every privileged program role as targets.
- `SafetyGuardian` contains enrollment, request, obligation, settlement, or
  agent incidents independently. Expiry requires review and does not silently
  unpause a scope.

Sponsor, operator, initial reviewer, appeal reviewer, settlement, and guardian
must be six distinct addresses. This preserves the two-party activation,
cancellation, and unpause checks and keeps financial, decision, appeal, and
incident authority separated. The eligibility attestor may equal the sponsor
or operator because cohort eligibility can be their factual responsibility; it
may also be a seventh address. It cannot equal either reviewer, settlement, or
guardian. Deployment policy still requires threshold-controlled production
roles even though the contracts validate addresses rather than wallet internals.
Cancellation approvals are scoped to the current lifecycle state and cleared
on every transition, so an approval from Draft or Reviewed cannot be replayed
after review or funding changes the program.

Enrollment closes by timestamp inside `MembershipRegistry`, independently of
whether anyone has advanced `ProtectionProgram` from `EnrollmentOpen` to
`Active`. A membership activation at or after `activeAt` always fails.

## Accounting rule

Phase 0 reserves every active member's complete remaining cap. When a request
is approved, the approved amount moves from remaining member liability to an
unpaid obligation, so it is never counted twice or released early.

```text
trackedAssets = sponsorFunded - settled - sponsorRefunded
encumberedAssets = maximumRemainingMemberLiability
                   + approvedUnpaidObligations
                   + maturedRefunds
actualAssets >= trackedAssets >= encumberedAssets
freeLiquidity = trackedAssets - encumberedAssets
```

`pendingRequestReservation` is an independently visible subset of remaining
member liability. Direct token donations increase actual balance but never
tracked assets, capacity, or promises. V1 intentionally provides no donation
sweep path, because adding one would enlarge the custody attack surface.

The vault accepts exact transfer deltas only. Fee-on-transfer, sender-fee,
malformed, and negatively rebasing behavior cannot be reconciled and must fail.

## Agent adapter boundary

The authorization registry is a policy ledger, not an execution sandbox. The
adapter calls `consumeAuthorization`, so the adapter itself supplies the
principal, selector, native-value, and asset-value report. The registry can
bind that report to an operator-issued grant and enforce its counters, but it
cannot authenticate the end user or observe the adapter's external side
effects. Revert-path `AuthorizationBlocked` logs are also rolled back with the
transaction and are not durable incident telemetry.

Only specifically reviewed adapters may integrate. Each adapter must
authenticate the principal, bind the real action selector, reject or honestly
report value, consume before producing a side effect, and be monitored outside
the registry. Phase 0 hard-codes zero native and asset limits. A grant to any
suite module, privileged role, factory, or canonical funding asset is invalid,
even when that address is a contract.

## Decision domain

The EIP-712 domain is:

```text
name: Nakama Protection Decision
version: 1
chainId: current chain
verifyingContract: program DecisionModule
```

The exact type is:

```text
Decision(bytes32 programId,bytes32 requestId,bytes32 termsCommitment,
bytes32 evidenceManifestCommitment,uint32 evidenceVersion,uint8 reviewRound,
uint8 reviewerRole,uint8 action,uint256 approvedAmount,
bytes32 recipientCommitment,bytes32 publicReasonCode,uint256 nonce,
uint64 validUntil)
```

Ordinals are `Initial=1`, `Appeal=2`; reviewer roles use the same ordinals;
actions are `RequestInformation=1`, `Approve=2`, and `Deny=3`.

A reviewer deadline miss escalates without denial and keeps value reserved. An
information-response timeout does the same in both review rounds. Only the
assigned reviewer can turn a pending, information-requested, or escalated case
into an approval or denial by signing the typed decision; silence never creates
an adverse decision or releases reserved value.

The evidence commitment and version are frozen while a request is pending,
appealed, or escalated. A signed human `RequestInformation` decision opens one
member update window; the update advances the version and returns the request
to its round's decision state. This prevents a member from invalidating a
reviewer's signed transaction by repeatedly racing it with evidence bumps.

## Build and test

```bash
npm run robinhood:build
npm run robinhood:test
npm run robinhood:contract
npm run robinhood:contract:check
```

The canonical generated bundle is
`shared/robinhood/protocol_contract.json`, with one standalone ABI beside it
for each of the twelve public contracts. Generated metadata includes bytecode
hashes, runtime template hashes, component order, suite commitment, compiler,
network IDs, and the exact mainnet USDG identity.

The focused suite covers deterministic CREATE2 prediction, lifecycle gates,
full funding, membership, decisions, appeal preservation, no-quorum escalation,
EIP-1271 reviewers, exact settlement, refunds, fee-token rejection, donation
isolation, scoped incidents, and default-deny agent policy.

## Network and deployment boundary

Hardhat defines Robinhood mainnet `4663` and testnet `46630`. Mainnet USDG is
recorded as `0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168`; testnet requires an
operator-supplied address that passes runtime, name, symbol, and decimal checks.

`npm run robinhood:deploy:testnet` is transaction-producing and must never be
used as a smoke test. It requires an exact confirmation, clean source commit,
explicit signer, RPC, USDG address, and reviewed operator-local public config.
It deploys an unfunded, unverified suite and prints a receipt. It does not fund,
activate, verify, or publish the program. There is deliberately no mainnet
deployment command.

Example inputs and inert receipts live in:

- `deployments/robinhood-testnet/`
- `deployments/robinhood-mainnet/`

## Fail-closed gaps

Before real testnet evidence can be promoted, the team must verify the actual
testnet USDG and explorer, rehearse source verification and independent RPC
readback, and bind threshold-controlled roles. Before any funded mainnet use,
the legal/product schedule, full sponsor budget, privacy operations, USDG risk,
external contract audit, incident exercise, independent deployment review, and
release packet must all pass. `$NAKAMA`, Virtuals, ACP, yield, swaps, bridges,
permissionless pools, clinical logic, and raw evidence remain outside this
contract package.

The onchain asset checks pin the exact token address, metadata, and proxy
runtime. A proxy can still change behavior without changing proxy runtime, so
production approval also requires independent verification and monitoring of
its implementation, admin, and upgrade configuration.
