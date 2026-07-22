# Robinhood Phase 0 Incident Exercises

## Status and boundary

This runbook describes the local, synthetic incident exercises for the
immutable Robinhood Phase 0 candidate. Passing these tests proves contract
containment properties on Hardhat only. It does not prove Robinhood network
liveness, production threshold-account recovery, USDG issuer response, bridge
recovery, explorer availability, operational staffing, or legal authority.

Run the focused evidence lane with:

```bash
npm run robinhood:test
```

Record the Git commit, generated protocol artifact SHA-256, test output, test
timestamp, operator, independent reviewer, and any deviations. Never include a
private key, RPC credential, member identity, health evidence, or internal
incident narrative in public evidence.

## Exercise matrix

| Exercise               | Synthetic trigger                                                                     | Required containment                                                                                                                               | Local evidence                                                                            | Production evidence still required                                                                                                  |
| ---------------------- | ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Lost initial reviewer  | Let the signed decision deadline pass without a reviewer action                       | Anyone may escalate to `Escalated`; pending reservation remains; silence cannot deny or release value                                              | `contains lost reviewer and settlement signer incidents without releasing reserved value` | Threshold-account key replacement, reviewer reassignment procedure, paging and SLA timestamps                                       |
| Lost settlement signer | Approve an exact obligation, then attempt settlement from every other privileged role | Every substitute actor reverts; obligation and reconciliation remain intact                                                                        | Same focused test                                                                         | Settlement threshold-account rotation, signer quorum, device loss drill, liveness target                                            |
| Compromised agent      | Guardian revokes a live adapter grant                                                 | Revocation is effective before the next consumption; separate blocked-attempt telemetry persists; no reserve path exists                           | `revokes a compromised agent immediately and keeps blocked-attempt evidence durable`      | Detection source, on-call owner, adapter disablement, paymaster/session-key revocation, ACP wallet isolation                        |
| USDG transfer freeze   | Freeze the local six-decimal token during an approved settlement                      | Transfer and all accounting changes roll back; dependency warning and settlement pause contain the incident; explicit recovery precedes settlement | `contains a USDG transfer freeze atomically and resumes only after explicit recovery`     | Current USDG proxy/admin/freeze assessment, issuer contact, redemption/liquidity test, alternative lawful payout procedure          |
| Contract bug           | Pause `NewObligations` before a signed approval is executed                           | Approval fails, pending value remains reserved, and only operator plus guardian can resume                                                         | `keeps contract-bug and chain-outage pauses active past review until two-party recovery`  | Independent diagnosis, patched new suite review, migration decision, member/sponsor communications                                  |
| Chain outage boundary  | Advance the local clock past the pause review time with no transactions               | The pause remains active and becomes review-required; time alone never resumes actions                                                             | Same focused test                                                                         | Dual-RPC loss, sequencer/finality interruption, reorg, delayed transaction, backfill, and public-status drills on Robinhood testnet |

## Operator sequence

1. **Identify and classify.** Assign a public-safe incident ID and reason code,
   name the affected scope, and keep private facts in the authorized incident
   system rather than onchain.
2. **Contain narrowly.** Pause only enrollment, new requests, new obligations,
   settlement, or agent actions affected by the incident. Existing obligations
   and vault assets remain intact.
3. **Reconcile independently.** Compare token balance, canonical
   `EconomicActivity` replay, vault accounting, request state, authorization
   state, and finalized chain reads. A database-only green state is not enough.
4. **Approve recovery twice.** The operator records recovery approval and the
   guardian performs unpause for the exact scope and incident. Expiry creates a
   review requirement; it never silently clears containment.
5. **Verify one bounded action.** Re-run the smallest affected action, confirm
   the resulting event and direct reads, then widen service only under the
   release owner's decision.
6. **Close with evidence.** Record timeline, owner, reviewer, state hashes,
   member-impact assessment, corrective action, and the next rehearsal date.

## Fail conditions

The exercise fails if any unauthorized role can replace a lost signer, if a
deadline releases or denies value automatically, if a rejected token transfer
partially changes accounting, if a revoked agent consumes again, if a pause
creates a withdrawal path, if elapsed time silently unpauses, or if recovery
does not bind the exact incident and scope.

Production release remains blocked until independent reviewers authenticate
the live role owners, current USDG configuration, dual-RPC/finality behavior,
monitoring, communications, and real threshold-account recovery evidence.
