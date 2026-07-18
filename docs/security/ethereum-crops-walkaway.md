# Ethereum CROPS and Walkaway Review

This review maps the Ethereum vertical slice to the [official Ethereum Foundation Mandate PDF](https://ethereum.foundation/ef-mandate.pdf), whose technical pillar defines censorship resistance, open source, privacy, and security as an indivisible set and calls for intermediary minimization, structural decentralization, and a credible walkaway path.

This is an engineering alignment review, not an Ethereum Foundation certification or endorsement. The implementation does not yet satisfy a defensible claim of “100% decentralized,” because claim liveness still depends on each plan's fixed attester majority and users still depend on Ethereum access, an ERC-20 issuer, and their chosen transaction path.

## CROPS mapping

| Property | Implemented in this slice | Remaining limit |
| --- | --- | --- |
| Censorship resistance | Anyone can create a domain, initialize its token vault, open an existing-line claim, finalize a mature decision, reserve an approved obligation, settle it, and read state. There is no global owner, upgrade key, kill switch, or global pause. Scope-local controls cannot stop existing claims, exits, finality, or payout. | A fixed attester majority can withhold the initial decision forever. Controllers can stop new activity inside their own scope. Ethereum block inclusion, RPC access, wallets, and the chosen ERC-20 can introduce external censorship points. |
| Open source and free | Contracts, deployment guards, generated ABI, tests, and architecture are public under AGPL-3.0-or-later. State and rules are directly auditable and the code can be forked without a hosted service. | Reproducibility still requires publishing the final compiler inputs, source commit, artifact digest, deployment transaction, and verified source for the actual release. |
| Privacy | Claims put salted commitments and claimant-scoped nullifiers onchain rather than raw medical or identity evidence. Recipient changes use replay-protected EIP-712 authorization and support EOA or ERC-1271 claimants. | Ethereum reveals claimant and recipient addresses, requested and approved amounts, timing, attester votes, and linkable state transitions. Commitments are privacy-minimizing, not zero knowledge; low-entropy evidence can be guessed. Sensitive evidence must never be placed onchain. |
| Security | Immutable contracts minimize governance override. Isolated vaults use exact token deltas, line-attributed solvency, virtual-offset share math, deposit/exit slippage bounds, full reservations, provisional pending-liability booking, reentrancy guards, strict-majority exact-tuple votes, one bounded challenge round, nonce/deadline/chain-bound recipient signatures, and permissionless settlement. | Claim opening is not yet bound to an eligible policy position and does not encumber reserves before quorum, so the pre-quorum withdrawal race blocks a responsible mainnet release. The code also has no completed independent audit, formal verification, public testnet soak, or mainnet deployment evidence. Immutability removes upgrade abuse and also removes an in-place bug-fix path. |

## Walkaway properties

A Nakama operator can disappear without taking custody control with them: deployed bytecode and state remain on Ethereum, contributors can withdraw unencumbered equity, mature claims can be finalized, fully funded obligations can be reserved and settled, and any client can use the canonical ABI through an independent RPC or local node. No Nakama API, database, frontend, indexer, relayer, or deployment key is required for these paths.

The current walkaway test is incomplete for claim adjudication. Attesters are selected when a plan is created and cannot be replaced, so their disappearance preserves safety but can halt decision liveness. A later protocol version should solve this without adding a global administrator—for example through an opt-in plural attestation market, cryptoeconomic liveness rules, or privacy-preserving proof systems—but such a change needs its own threat model and should not be implied by this slice.

## Trust and failure boundaries

- **Domain and plan controllers** can configure or stop new scope-local activity, but cannot seize vault assets, create payout obligations, rewrite existing claims, or stop exits and settlement.
- **Plan attesters** decide claim outcomes by strict majority. Colluding majorities can approve dishonest claims or deny honest ones, while an inactive majority can prevent the initial quorum.
- **Claimants** choose the initial payout recipient and can authorize a replacement before finality. Claimants cannot change a finalized recipient or challenge more than once.
- **Contributors** bear claim and attester risk inside the selected funding line. They can exit only against free equity, so provisional and finalized liabilities remain protected.
- **Wiped funding lines** do not accept ordinary share-minting deposits while zero-equity shares remain, because that would dilute existing contributors. Active scopes may revive shares through no-share earnings within the normal cap; otherwise new capital needs a new line or tranche.
- **ERC-20 issuers** retain whatever control exists in the token contract, including freezing, minting, or upgrades. The protocol rejects non-exact transfer behavior but cannot make a centralized token decentralized.
- **Ethereum infrastructure** supplies ordering, execution, and data availability. Users should keep an independent RPC or local-node path rather than treating one hosted provider as mandatory.

## Mainnet release conditions

Do not describe this implementation as mainnet-ready or fully decentralized until all of the following are true:

1. An independent smart-contract audit is complete, findings are resolved or explicitly accepted, and its SHA-256 digest is bound into the reviewed release manifest.
2. The exact source commit has a clean production build, current generated artifact, EIP-170 size margin, final test evidence, and a public testnet soak covering the supported production token.
3. The immutable-deployment risk, fixed-attester liveness risk, ERC-20 issuer risk, privacy limits, and recovery limitations are disclosed to users before they fund a line.
4. The mainnet transaction is executed from the expected deployer only after the no-transaction preflight passes, is durably journaled, receives at least 12 confirmations, and remains marked `deployed-unverified` until promotion independently verifies its canonical finalized block, exact live and normalized-template code hashes, and Sourcify v2 exact creation/runtime match.
5. Independent clients can reconstruct state and execute the walkaway paths without Nakama-hosted infrastructure.
6. An immutable eligibility and policy-position boundary closes the unauthenticated-claim and pre-quorum withdrawal gap described in the architecture document.

The release tooling deliberately fails closed until these conditions are represented by a reviewed, operator-local `deployments/ethereum-mainnet.release.json`; the file is ignored so it can bind an already committed source HEAD without a commit-hash self-reference. The tracked example remains `not-approved`.
