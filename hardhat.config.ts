import hardhatToolboxMochaEthersPlugin from "@nomicfoundation/hardhat-toolbox-mocha-ethers";
import { configVariable, defineConfig } from "hardhat/config";

const compilerSettings = {
  optimizer: {
    enabled: true,
    runs: 200,
  },
  viaIR: true,
  evmVersion: "cancun",
  metadata: {
    bytecodeHash: "ipfs",
  },
} as const;

export default defineConfig({
  plugins: [hardhatToolboxMochaEthersPlugin],
  paths: {
    sources: {
      solidity: ["contracts"],
    },
    tests: {
      mocha: "test/ethereum",
    },
    artifacts: "artifacts/hardhat",
    cache: "tmp/hardhat-cache",
  },
  solidity: {
    profiles: {
      default: {
        version: "0.8.28",
        settings: compilerSettings,
      },
      production: {
        version: "0.8.28",
        settings: compilerSettings,
      },
    },
  },
  networks: {
    hardhatMainnet: {
      type: "edr-simulated",
      chainType: "l1",
    },
    mainnet: {
      type: "http",
      chainType: "l1",
      url: configVariable("ETHEREUM_MAINNET_RPC_URL"),
      accounts: [configVariable("ETHEREUM_MAINNET_PRIVATE_KEY")],
    },
    robinhoodTestnet: {
      type: "http",
      chainType: "generic",
      chainId: 46630,
      url: configVariable("ROBINHOOD_TESTNET_RPC_URL"),
      accounts: [configVariable("ROBINHOOD_TESTNET_PRIVATE_KEY")],
    },
    robinhoodMainnet: {
      type: "http",
      chainType: "generic",
      chainId: 4663,
      url: configVariable("ROBINHOOD_MAINNET_RPC_URL"),
      accounts: [configVariable("ROBINHOOD_MAINNET_PRIVATE_KEY")],
    },
  },
});
