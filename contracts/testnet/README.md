# Testnet-only contracts

`NakamaTestUsd` is a fixed-supply, six-decimal qualification asset for
Robinhood Chain testnet. It is deliberately named `Nakama Test USD` with symbol
`tUSDG` because Robinhood does not document a canonical testnet USDG contract.

The token has no post-construction mint authority and no mainnet meaning. A
deployment is usable only when its creation transaction, runtime bytecode,
metadata, Blockscout source, and exact Sourcify match are pinned in the
generic-core testnet release evidence.
