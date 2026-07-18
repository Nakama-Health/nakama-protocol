# Ethereum Mainnet Protocol Vertical Slice

This is the pre-mainnet architecture for the immutable Ethereum implementation in `contracts/`. It coexists with the Solana programs while clients migrate; it does not claim a deployed mainnet address, replace the existing Solana deployment, or imply Ethereum Foundation review or endorsement.

The canonical machine-readable interface is `shared/ethereum/protocol_contract.json`. Until a reviewed deployment manifest records a real address and transaction, every client must treat the Ethereum surface as unconfigured.

## Contract boundary

`NakamaCoverageProtocol` is the only coordination contract. It creates one `ReserveVault` for each reserve domain and ERC-20 asset pair, records domain, plan, series, funding-line, claim, obligation, and contributor-share state, and exposes direct view functions for all material state.

Each `ReserveVault` has immutable protocol, domain, and token bindings. It has no owner or recovery role, and it accepts asset movement only from the protocol. There is no proxy, upgrade administrator, global owner, global pause, or arbitrary controller-created obligation.

The on-chain hierarchy is:

```text
Reserve domain
├── Domain + ERC-20 ReserveVault
└── Health plan
    ├── Immutable strict-majority attester set
    └── Policy series
        └── Funding line
            ├── Funded assets and contributor shares
            ├── Claim commitments and decisions
            └── Claim-derived obligations and settlement
```

IDs are deterministic, namespace-separated hashes. Domains bind the creator and salt; plans and series bind their parent and salt; funding lines bind the plan and salt; claims bind the plan, claimant, and nullifier. Claimant scoping means a copied nullifier cannot prevent its original owner from opening the intended claim.

## Scope-local control

Domain and plan controllers can create configuration beneath their scope, transfer control through a two-day acceptance delay, stop new intake, and apply a pause of at most seven days once per 30-day cooldown. These controls do not stop existing claim intake, recipient authorization, challenge, finalization, contributor exits from unencumbered equity, reservation, or settlement.

Controllers cannot withdraw reserve assets, select a finalized claim recipient, fabricate an obligation, override attesters, reverse a settlement, upgrade code, or pause the whole protocol. A controller compromise can stop or misconfigure new activity inside that scope, so controllers should still be hardened accounts or independently governed smart accounts.

## Reserve custody and accounting

Funding supports four immutable line types: sponsor budget, premium income, backstop capital, and subsidy. Only the matching funding entry point can fund each line. Backstop contributors receive pro-rata shares and may burn their own shares for their pro-rata portion of free equity.

Every scope maintains the same conservative balance sheet:

```text
free equity = max(funded - owed - pending claims, 0)
reserved <= owed
reserved <= funded
```

`reserved` is a subset of `owed`, so it is not deducted twice. A provisional approval books a pending claim liability immediately; a final approval converts it atomically to an obligation; a denial releases it. This prevents a contributor from exiting with assets needed for a claim while its challenge window remains open.

Reservations are full rather than partial. Anyone may reserve an approved obligation if the line, plan, and domain ledgers all have enough liquidity, and anyone may settle a fully reserved obligation. The recipient is fixed by the claimant and may only be changed before finality through an EIP-712 authorization signed by that claimant.

Vault transfers require exact payer, vault, and recipient balance deltas. Fee-on-transfer, sender-fee, rebasing, or otherwise non-exact tokens are rejected because their behavior would break the reserve ledger. Direct token donations are visible as excess actual vault assets but do not mint shares or increase accounted funding.

## Claim lifecycle

1. **Open.** A claimant submits a salted evidence commitment, claimant-scoped nullifier, payout recipient, and requested amount. The evidence itself stays offchain; addresses, amounts, commitments, nullifiers, and state transitions remain public.
2. **Initial quorum.** The plan's immutable attesters vote on the exact tuple of approval, amount, and decision commitment. A strict majority creates a provisional decision and starts the series challenge window.
3. **Optional challenge.** Only the claimant may open the single challenge round before the initial window closes. The same attester set votes again during a fresh challenge window.
4. **Permissionless finality.** After the deadline, anyone may finalize. A round-one quorum wins; without one, the initial quorum decision is the fallback. Approval creates the only kind of obligation the protocol permits.
5. **Permissionless payment.** Anyone may fully reserve the obligation and then settle it to the claimant-selected recipient.

An attester set that never reaches its initial quorum can leave a claim open indefinitely. That is an explicit remaining liveness dependency, not a fully censorship-resistant claims oracle.

## Direct reads and integration

Clients do not need a hosted Nakama indexer to reconstruct canonical state. Contract getters expose every primary entity, attester membership, nullifier use, contributor shares, line, plan, and domain balance sheets, exit quotes, and vault solvency. Events provide efficient discovery, but an independently operated Ethereum RPC or local node can read the same state directly.

The EIP-712 recipient authorization domain is:

```text
name: Nakama Coverage Protocol
version: 1
chainId: runtime chain ID
verifyingContract: deployed protocol address
type: ClaimRecipient(bytes32 claimId,address recipient,uint256 nonce,uint256 deadline)
```

Use `npm run ethereum:contract` after any Solidity change and commit the resulting canonical artifact. `npm run ethereum:contract:check` fails when the generated interface or bytecode hashes are stale.

## Release boundary

The code is currently an unaudited implementation candidate, not a mainnet release. The deployment command requires an exact source commit, clean checkout, production artifact, reviewed release manifest, independent-audit digest, release-approval digest, expected deployer, minimum balance, chain ID 1, HTTPS RPC, explicit confirmation phrase, and an EIP-170 runtime-size check. The preflight command sends no transaction.

`deployments/ethereum-mainnet.release.json` is deliberately ignored and operator-local. The source and canonical artifacts are committed first, then the reviewed local manifest binds its `sourceCommit` to that existing HEAD. Tracking the populated manifest would create an impossible commit-hash self-reference; only the inert `.example.json` template belongs in git.

Deployment and publication are two machine-checked stages. The transaction command emits `deployed-unverified` with `verified: false`; after public source verification, `ethereum:manifest:promote` binds that receipt, verification evidence, the approved artifact digests, and the exact SDK ABI into `deployments/ethereum-mainnet.final.schema.json`. Only this second stage may emit `status: deployed`, `verified: true`, and `auditStatus: audited`, and the SDK independently checks the chain-1 receipt and live runtime before accepting it.

See [Ethereum CROPS and Walkaway Review](../security/ethereum-crops-walkaway.md) for the decentralization claims and remaining gaps.
