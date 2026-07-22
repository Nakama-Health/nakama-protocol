# Robinhood Phase 0 Protocol Implementation

The Robinhood-native vertical slice described in the strategy package now has
an isolated Solidity implementation under
[`contracts/robinhood/`](../../contracts/robinhood/README.md). It is a local,
unaudited implementation candidate rather than a deployment or customer
promise.

The implementation preserves the product boundary: one sponsor posts the full
USDG budget, eligible members activate against immutable terms, private
evidence stays offchain, accountable reviewers sign typed decisions, an
independent appeal reviewer handles adverse decisions, and exact approved
obligations settle from a segregated program vault. Token, ACP, model output,
and public governance have no authority over benefits or assets.

Each factory is immutably bound at construction to one active canonical USDG
address and the registry's chain, asset ID, metadata, and runtime snapshot.
Prediction and deployment both revalidate that identity, so registering a
second six-decimal token does not make it eligible for a Phase 0 program.
The sponsor must submit the deployment transaction; operator-only deployment
is rejected before CREATE2, preventing unauthorized sponsor attribution and
salt consumption in the public registry.

Agent authorization is deliberately narrower than execution. The registry
stores operator-issued policy and consumption counters, while a separately
reviewed adapter authenticates the principal and reports the selector and
value. The registry cannot observe adapter side effects, so every program
module, privileged role, the factory, and USDG are forbidden targets and no
adapter is safe merely because a grant exists.

Request evidence versions are frozen while a decision is pending, appealed,
or escalated. A member can advance the evidence commitment only after the
assigned reviewer signs `RequestInformation`; one update closes that window
and restarts the appropriate human decision period.

Program caps cannot exceed the largest signed event delta, and appeal or
decision windows cannot exceed 365 days. `ClaimManager` also checks every
timestamp addition before narrowing it to `uint64`, so a malformed schedule
cannot turn deadline handling into an arithmetic panic.

## Sources of truth

- Solidity and public API: [`contracts/robinhood/`](../../contracts/robinhood/README.md)
- Generated ABI and bytecode bundle:
  [`shared/robinhood/protocol_contract.json`](../../shared/robinhood/protocol_contract.json)
- Focused tests:
  [`test/ethereum/robinhood/Phase0Protocol.ts`](../../test/ethereum/robinhood/Phase0Protocol.ts)
- Testnet input and receipt examples:
  [`deployments/robinhood-testnet/`](../../deployments/robinhood-testnet/)
- Product and implementation decisions:
  [`docs/robinhood-virtuals/`](../robinhood-virtuals/README.md)

## Current evidence level

The suite is implemented, compiled, artifact-generated, and locally tested. No
Robinhood address exists for any Nakama contract. The testnet USDG identity,
dual-RPC behavior, explorer verification, authority handoff, and chain failure
model still require live testnet evidence. Audit, legal approval, sponsor
agreement, full funding, and release approval still block mainnet.
