"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { NETWORKS } from "@/lib/contract";
import { truncateAddr } from "@/lib/utils";

const SEPOLIA_CHAIN_ID = 11155111;
const SEPOLIA_HEX = "0xaa36a7";

async function doSwitchToSepolia(provider) {
  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: SEPOLIA_HEX }],
    });
  } catch (err) {
    if (err.code === 4902) {
      await provider.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: SEPOLIA_HEX,
            chainName: "Sepolia Testnet",
            nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
            rpcUrls: ["https://rpc.sepolia.org"],
            blockExplorerUrls: ["https://sepolia.etherscan.io"],
          },
        ],
      });
    } else {
      throw err;
    }
  }
}

export function useWallet() {
  const [address, setAddress] = useState("");
  const [chainId, setChainId] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState("");
  const connectingRef = useRef(false); // prevent double-calls

  const network = chainId
    ? NETWORKS[chainId] || { name: `Chain ${chainId}`, explorer: "" }
    : null;
  const isWrongNet = isConnected && chainId !== SEPOLIA_CHAIN_ID;

  // ── Silent reconnect — only runs on mount, never shows a popup ──
  const silentReconnect = useCallback(async (p) => {
    try {
      // eth_accounts is silent — returns [] if not already approved, no popup
      const accounts = await p.request({ method: "eth_accounts" });
      if (!accounts?.length) return; // not previously connected, do nothing

      const chain = parseInt(await p.request({ method: "eth_chainId" }), 16);
      window.__activeProvider = p;
      setAddress(accounts[0]);
      setChainId(chain);
      setIsConnected(true);
    } catch {
      // Silent fail — user just won't be auto-connected
    }
  }, []);

  // ── User-initiated connect — called by WalletModal ──
  const connect = useCallback(async (specificProvider = null) => {
    if (connectingRef.current) return; // prevent double invocation
    connectingRef.current = true;

    const p = specificProvider || window.__activeProvider || window.ethereum;
    if (!p) {
      setError("No wallet found — install MetaMask, Rabby, or any EVM wallet");
      connectingRef.current = false;
      return;
    }

    setIsConnecting(true);
    setError("");

    try {
      // eth_requestAccounts — shows the MetaMask popup (user-initiated only)
      const accounts = await p.request({ method: "eth_requestAccounts" });
      if (!accounts?.length) throw new Error("No accounts returned");

      let chain = parseInt(await p.request({ method: "eth_chainId" }), 16);

      if (chain !== SEPOLIA_CHAIN_ID) {
        try {
          await doSwitchToSepolia(p);
          chain = SEPOLIA_CHAIN_ID;
        } catch (switchErr) {
          // User dismissed network switch — connect anyway, show banner
          console.warn("Network switch skipped:", switchErr.message);
        }
        // Re-read chain after switch attempt
        chain = parseInt(await p.request({ method: "eth_chainId" }), 16);
      }

      window.__activeProvider = p;
      setAddress(accounts[0]);
      setChainId(chain);
      setIsConnected(true);
      setError("");
    } catch (err) {
      if (err.code === 4001) setError("Connection rejected");
      else if (err.code === -32002)
        setError("Request pending — open your wallet");
      else setError(err.message?.slice(0, 80) || "Connection failed");
    } finally {
      setIsConnecting(false);
      connectingRef.current = false;
    }
  }, []);

  const disconnect = useCallback(() => {
    setAddress("");
    setChainId(null);
    setIsConnected(false);
    setError("");
    window.__activeProvider = null;
  }, []);

  const switchNetwork = useCallback(async () => {
    const p = window.__activeProvider || window.ethereum;
    if (!p) return;
    try {
      await doSwitchToSepolia(p);
      const chain = parseInt(await p.request({ method: "eth_chainId" }), 16);
      setChainId(chain);
      setError("");
    } catch {
      setError("Failed to switch to Sepolia");
    }
  }, []);

  // ── Mount: silent reconnect + wire wallet events ──
  useEffect(() => {
    if (typeof window === "undefined") return;
    const p = window.__activeProvider || window.ethereum;
    if (!p) return;

    // Silent reconnect — no popup, no eth_requestAccounts
    silentReconnect(p);

    const onAccountsChanged = (accs) => {
      if (accs.length === 0) disconnect();
      else {
        setAddress(accs[0]);
        setIsConnected(true);
      }
    };
    const onChainChanged = (hexChain) => {
      setChainId(parseInt(hexChain, 16));
    };

    p.on?.("accountsChanged", onAccountsChanged);
    p.on?.("chainChanged", onChainChanged);
    return () => {
      p.removeListener?.("accountsChanged", onAccountsChanged);
      p.removeListener?.("chainChanged", onChainChanged);
    };
  }, [silentReconnect, disconnect]);

  return {
    address,
    chainId,
    network,
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
