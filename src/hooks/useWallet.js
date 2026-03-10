"use client";
import { useState, useEffect, useCallback } from "react";
import { getChainId, switchToSepolia } from "@/lib/web3mini";
import { NETWORKS } from "@/lib/contract";
import { truncateAddr } from "@/lib/utils";

const SEPOLIA_CHAIN_ID = 11155111;

// Works with ANY injected wallet (MetaMask, Rabby, Coinbase, Trust, etc.)
// Also works with WalletConnect via the provider passed in
function getProvider() {
  if (typeof window === "undefined") return null;

  // EIP-6963: modern wallets announce themselves — pick first available
  if (window.__eip6963Providers?.length > 0) {
    return window.__eip6963Providers[0].provider;
  }

  // Rabby injects as window.rabby, fallback to window.ethereum
  return (
    window.rabby || window.coinbaseWalletExtension || window.ethereum || null
  );
}

export function useWallet() {
  const [address, setAddress] = useState("");
  const [chainId, setChainId] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState("");
  const [provider, setProvider] = useState(null);

  const network = chainId
    ? NETWORKS[chainId] || { name: `Chain ${chainId}`, explorer: "" }
    : null;
  const isWrongNet = isConnected && chainId !== SEPOLIA_CHAIN_ID;

  const connect = useCallback(async (specificProvider = null) => {
    const prov = specificProvider || getProvider();
    if (!prov) {
      setError(
        "No wallet found — please install MetaMask, Rabby, or any EVM wallet",
      );
      return;
    }
    setIsConnecting(true);
    setError("");
    try {
      const accounts = await prov.request({ method: "eth_requestAccounts" });
      let chain = parseInt(await prov.request({ method: "eth_chainId" }), 16);

      if (chain !== SEPOLIA_CHAIN_ID) {
        try {
          await prov.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: "0xaa36a7" }],
          });
          chain = SEPOLIA_CHAIN_ID;
        } catch (switchErr) {
          if (switchErr.code === 4902) {
            await prov.request({
              method: "wallet_addEthereumChain",
              params: [
                {
                  chainId: "0xaa36a7",
                  chainName: "Sepolia Testnet",
                  nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
                  rpcUrls: ["https://rpc.sepolia.org"],
                  blockExplorerUrls: ["https://sepolia.etherscan.io"],
                },
              ],
            });
            chain = SEPOLIA_CHAIN_ID;
          }
        }
      }

      setProvider(prov);
      setAddress(accounts[0]);
      setChainId(chain);
      setIsConnected(true);

      // Store for web3mini to use
      window.__activeProvider = prov;
    } catch (err) {
      if (err.code === 4001) setError("Connection rejected");
      else if (err.code === -32002)
        setError("Pending request — open your wallet");
      else setError(err.message?.slice(0, 80) || "Connection failed");
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    setAddress("");
    setChainId(null);
    setIsConnected(false);
    setError("");
    setProvider(null);
    window.__activeProvider = null;
  }, []);

  const switchNetwork = useCallback(async () => {
    const prov = provider || getProvider();
    if (!prov) return;
    try {
      await prov.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: "0xaa36a7" }],
      });
      setChainId(SEPOLIA_CHAIN_ID);
      setError("");
    } catch (err) {
      setError("Failed to switch to Sepolia");
    }
  }, [provider]);

  // Auto-reconnect on mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    const prov = getProvider();
    if (!prov) return;

    prov
      .request({ method: "eth_accounts" })
      .then((accs) => {
        if (accs.length > 0) connect(prov);
      })
      .catch(() => {});

    const onAccountsChanged = (accs) =>
      accs.length ? connect(prov) : disconnect();
    const onChainChanged = () => window.location.reload();
    prov.on?.("accountsChanged", onAccountsChanged);
    prov.on?.("chainChanged", onChainChanged);
    return () => {
      prov.removeListener?.("accountsChanged", onAccountsChanged);
      prov.removeListener?.("chainChanged", onChainChanged);
    };
  }, [connect, disconnect]);

  return {
    address,
    chainId,
    network,
    provider,
    isConnected,
    isConnecting,
    isWrongNet,
    error,
    connect,
    disconnect,
    switchNetwork,
    truncatedAddress: address ? truncateAddr(address) : "",
  };
}
