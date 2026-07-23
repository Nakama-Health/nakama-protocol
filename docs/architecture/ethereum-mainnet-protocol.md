# Ethereum Mainnet Protocol Architecture

This is the pre-mainnet architecture for the immutable Ethereum implementation in `contracts/`. It coexists with the Solana programs while clients migrate; it does not claim a deployed mainnet address, replace the existing Solana deployment, or imply Ethereum Foundation review or endorsement.

The implementation follows Ethereum's open-source, security, privacy, censorship-resistance, and credible-neutrality direction where those values can be enforced in code. It does not claim complete decentralization: plan controllers choose new terms, immutable attester sets decide private claims, eligibility and evidence remain offchain, supported ERC-20 assets retain their own issuer risk, and a mainnet release still requires an independent audit.

The canonical machine-readable interface is `shared/ethereum/protocol_contract.json`. Until a reviewed final deployment manifest records verified factory, core, and registry addresses, every client must treat the Ethereum write surface as unconfigured.

## Immutable contract boundary

The launch transaction creates a one-purpose `NakamaProtocolFactory`. Its constructor deploys `NakamaPolicyRegistry` at the factory's first CREATE nonce and `NakamaCoverageProtocol` at its second CREATE nonce, then verifies both immutable cross-bindings. The deployed factory has getters only; it has no owner, initializer, upgrade path, or post-deployment authority.

`NakamaCoverageProtocol` is the custody and accounting core. It owns reserve-domain, plan, funding-line, contributor-share, obligation, and hierarchical balance-sheet state. Every registry mutation enters through a typed core function, and the core cannot replace the registry.

`NakamaPolicyRegistry` stores immutable series terms, enrolled positions, position-scoped nullifiers, claim votes, final decisions, and claimant-signed recipient changes. Only its constructor-bound core can mutate it, and the registry never calls back into the core. This one-way boundary keeps claim state separate without introducing an administrator or circular external calls.

`ReserveVault` instances hold one ERC-20 for one reserve domain. The core deploys each vault with CREATE2 using `keccak256(abi.encode(domainId, assetToken))` as the salt; the vault's core, domain, and token bindings are immutable. A vault has no owner or recovery role and accepts deposits or withdrawals only from the core. The launch manifest therefore verifies the vault artifact as a deployment template rather than inventing one launch-time vault address.

There is no proxy, upgrade administrator, global owner, global pause, arbitrary controller-created obligation, or protocol-wide asset recovery path.

The onchain hierarchy is:

```text
Factory (inert after construction)
├── Policy registry
│   └── Series → holder position → claim → attestation rounds
└── Custody/accounting core
    └── Reserve domain + ERC-20 vault
        └── Health plan + immutable strict-majority attester set
            └── Series-bound coverage and premium funding lines
                ├── Funded assets and contributor shares
                └── Claim-derived obligations and settlement
```

IDs are deterministic, namespace-separated hashes. Domains bind creator and salt; plans and series bind their parent and salt; funding lines bind their plan and salt; positions bind series and holder; claims bind position, claimant, and nullifier. A copied nullifier from another position or holder cannot block its intended claim.

## Series and position boundary

A plan controller creates a series with immutable asset, coverage line, premium-receipt line, eligibility root, coverage duration, initial-decision window, challenge window, per-position coverage limit, exact premium, aggregate exposure cap, plan-derived attester threshold, and terms commitment. Decision windows are bounded from one hour to 30 days, coverage duration is bounded to five years, and the premium cannot exceed the holder's maximum coverage benefit.

Each line ID is reserved to one series, and the coverage and premium-receipt IDs must be distinct. The provenance line must be `PremiumIncome`; a claims-paying coverage line must be `SponsorBudget`, `Backstop`, or `Subsidy`. This prevents a premium-only line with no seed-capital path and makes the source and destination of every receipt explicit. Renewal uses a new immutable series rather than mutating an existing position.

Opening the coverage line requires a voluntary-capital cap at least as large as the per-position coverage limit, and opening the provenance line requires a per-receipt cap at least as large as the exact premium. Voluntary sponsor, subsidy, or backstop funding cannot exceed the coverage line's cap. Position-bound premiums may raise its funded balance above that cap because they add collateral without increasing the immutable exposure limit; treating the cap as a total-value ceiling would let prior funding block enrollment.

The caller activating a position is both holder and premium payer. A zero eligibility root is permissionless and requires an empty proof; a nonzero root uses the OpenZeppelin `StandardMerkleTree` single-address leaf convention. A `Backstop` coverage line must have live contributor shares, so a premium cannot become ownerless earnings after the last shareholder exits. Activation is atomic: the registry creates the unique `(series, holder)` position, the core collects the exact position-bound premium, credits it once to the claims-paying line, then encumbers the full coverage limit as open exposure. Any failed proof, transfer, line binding, exposure cap, or collateral check rolls back the position, provenance counters, reserve ledgers, and token movement.

`outstandingExposure` means remaining unclaimed coverage across live positions. Approved but unpaid amounts move to the reserve ledger's `owed` balance instead, so this value is not total protocol liability.

## Scope-local control

Domain and plan controllers can create configuration beneath their scope, transfer control through a two-day acceptance delay, stop new intake, and apply a pause of at most seven days once per 30-day cooldown. These controls stop new configuration, funding, and position activation inside the scope; they do not stop already vested claim intake, recipient authorization, challenge, finalization, contributor exits from unencumbered equity, reservation, settlement, or position expiry.

Controllers cannot withdraw reserve assets, select a claimant's finalized recipient, fabricate an obligation, change an existing attester set or series, override a vote, reverse settlement, upgrade code, or pause the whole protocol. A controller compromise can still stop or misconfigure future activity inside that scope, so controllers should be hardened accounts or independently governed smart accounts.

## Reserve custody and accounting

Funding supports four immutable line types: sponsor budget, premium-income provenance, backstop capital, and subsidy. Sponsor and subsidy contributions use their matching entry points. Backstop contributors receive pro-rata shares, attributed earnings use a separate no-share flow, and contributors may burn their own shares for their pro-rata portion of free equity. Premium income has no standalone funding entry point: only a successful position activation can record it. Share issuance uses virtual assets and virtual shares and requires caller-supplied slippage bounds.

Every funding line, plan, and domain maintains the same conservative balance sheet:

```text
free equity = max(funded - owed - pending claims - open exposure, 0)
reserved <= owed
owed + pending claims + open exposure <= funded
```

`reserved` is a subset of `owed`, so it is not deducted twice. Activation books the complete position limit into `openExposure`; claim intake moves the requested amount to `pendingClaims`; denial restores it; approval moves the approved amount to `owed` and restores any unapproved remainder; settlement reduces `funded`, `owed`, and `reserved`; expiry releases unused exposure. Capital therefore cannot exit between enrollment and claim intake.

The funding line is the solvency boundary. Plan and domain sheets mirror their children's totals for inspection, but a sibling line cannot consume capital attributed to another line. Reservations are full rather than partial, and anyone may reserve an approved obligation and settle a fully reserved obligation. There is no privileged recapitalization shortcut: a position must be fully collateralized at activation and normal funding rules remain the only path for new capital.

The premium line is an event and gross-flow provenance ledger, not a custody sink. For each successful activation its `grossFunded` and `grossSpent` rise by the same amount while its balance sheet stays at zero; the coverage line, plan, domain, and vault each receive one net credit. Indexers must treat `FundingFlowRecorded` and `PolicyPremiumCollected` as one external receipt plus its internal allocation, not two deposits.

Premiums allocated to a `Backstop` line accrue to its existing shareholders. Premiums allocated to a `SponsorBudget` or `Subsidy` line become irrevocable communal claims-paying assets because those line types have no contributor withdrawal right. This is an explicit series-economic choice rather than an operator recovery path. Across any coverage line, `grossFunded - grossSpent - grossReturned` reconciles to current `funded`.

If settlement wipes all contributor equity while real shares remain outstanding, ordinary deposits revert rather than diluting existing shareholders at a zero price. Attributed no-share earnings can restore the same active line within its cap. If the last shareholder exits and virtual-share rounding leaves a small accounted residual, a later deposit is priced against that residual rather than capturing it.

Vault transfers require exact payer, vault, and recipient balance deltas. Fee-on-transfer, sender-fee, rebasing, or otherwise non-exact tokens are rejected because their behavior would diverge custody from the reserve ledger. Direct token donations remain visible as excess vault assets but do not mint shares or increase accounted funding.

## Claim lifecycle

1. **Open.** Only the holder of a live, unexpired position may open one active claim. The request must fit within remaining coverage. Intake consumes a position-scoped nullifier and atomically moves the requested amount from open exposure to pending claims. The salted evidence commitment stays onchain while medical evidence remains offchain.
2. **Initial quorum.** The plan's immutable attesters vote once on the exact tuple of approval, amount, and decision commitment. A strict majority creates a provisional decision and starts the challenge window. If no initial quorum exists at the deadline, anyone can finalize a denial and restore the pending request to open exposure.
3. **Optional challenge.** Only the claimant may open the single challenge round before the provisional deadline. The same immutable attester set votes during a fresh challenge window.
4. **Permissionless finality.** Anyone may finalize after the applicable deadline. A round-one quorum wins; otherwise the initial quorum decision is the fallback. Denial clears the active claim. Approval converts only the approved amount to an obligation and keeps the claim active until payment.
5. **Permissionless payment.** Anyone may reserve the full approved obligation and settle it. Settlement pays the claimant-selected recipient, clears the active claim, and exhausts a position only when no coverage remains. Sequential claims are bounded by remaining coverage.

The claimant may rotate the payout recipient through settlement using an EIP-712 signature. This prevents recipient invalidation from permanently blocking payment or expiry, and supports EOAs and ERC-1271 smart accounts. The registry domain is:

```text
name: Nakama Policy Registry
version: 1
chainId: runtime chain ID
verifyingContract: deployed policy registry address
type: ClaimRecipient(bytes32 claimId,address recipient,uint256 nonce,uint256 deadline)
```

Addresses, asset amounts, commitments, nullifiers, eligibility roots, and state transitions are public on Ethereum. Medical evidence and direct identifiers must never be put in these fields; the onchain design provides commitments, not transaction privacy.

## Direct reads and independent operation

Clients do not need a hosted Nakama indexer to reconstruct canonical state. Core and registry getters expose every primary entity, attester membership, vote count, nullifier use, contributor share, balance sheet, exit quote, obligation, and vault-solvency check. Events provide efficient discovery, but any independently operated Ethereum RPC or local node can read the same state.

The protocol remains dependent on Ethereum consensus, the selected ERC-20 contract, and the plan's immutable attester quorum. Claims are censorship-resistant after a valid transaction reaches Ethereum because timeouts, finalization, reservation, settlement, and expiry are permissionless; attesters still control approval of private claims. This is decentralized execution with explicit governance and oracle dependencies, not a claim of trustlessness or 100% decentralization.

## Release boundary

Use `npm run ethereum:contract` after any Solidity change and commit the generated four-contract canonical artifact and ABIs. `npm run ethereum:contract:check` fails when an ABI, initcode hash, runtime template, immutable reference, or deployment-plan field is stale.

The code is an unaudited implementation candidate until an independent report and release approval are bound into a schema-v3 manifest. The no-transaction preflight requires an exact source commit, clean checkout, production artifacts, reviewed local approval manifest, independent-audit digest, release-approval digest, expected deployer, sufficient balance, chain ID 1, credential-free HTTPS RPC, explicit confirmation phrase, a reconciled latest/pending signer nonce, an exact factory-initcode gas estimate within both the live block limit and the 16,777,216-gas EIP-7825 transaction cap, all EIP-170 runtime checks, and all EIP-3860 initcode checks.

`deployments/ethereum-mainnet.release.json` is ignored and operator-local. Source and canonical artifacts are committed first, then the reviewed local manifest binds its `sourceCommit` to that existing HEAD. Tracking the populated approval file would create a commit-hash self-reference; only the inert example belongs in git.

Deployment and publication are separate machine-checked stages. The transaction stage rejects a signer with unreconciled pending transactions or an unsafe factory gas estimate, then durably records the exact signer nonce, live block and gas-gate snapshot, predicted factory/registry/core addresses, approved factory initcode hash, and aggregate artifact digest before broadcasting the nonce-pinned, explicitly gas-bounded factory transaction. It journals the transaction hash immediately, checks the three deployed runtimes and immutable cross-getters, and emits only `deployed-unverified`. Promotion independently verifies the canonical finalized block, transaction initcode, all three live code hashes and normalized templates, the four SDK ABIs, and exact Sourcify v2 creation/runtime matches for factory, core, and registry. A vault receives its own source-verification evidence when a real per-domain instance is created.

No mainnet transaction should be broadcast until the independent audit, signer, funding, supported-token, migration, and release approvals are complete. See [Ethereum CROPS and Walkaway Review](../security/ethereum-crops-walkaway.md) for the decentralization claims and remaining operational gaps.
