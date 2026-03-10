"use client";
import { useState, useEffect, useCallback } from "react";
import {
  requestAccounts,
  getAccounts,
  getChainId,
  switchToSepolia,
} from "@/lib/web3mini";
import { NETWORKS } from "@/lib/contract";
import { truncateAddr } from "@/lib/utils";

const SEPOLIA_CHAIN_ID = 11155111;

export function useWallet() {
  const [address, setAddress] = useState("");
  const [chainId, setChainId] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState("");

  const network = chainId
    ? NETWORKS[chainId] || { name: `Chain ${chainId}`, explorer: "" }
    : null;
  const isWrongNet = isConnected && chainId !== SEPOLIA_CHAIN_ID;

  const connect = useCallback(async () => {
    if (typeof window === "undefined" || !window.ethereum) {
      setError("MetaMask not found — please install MetaMask to use this app");
      return;
    }
    setIsConnecting(true);
    setError("");
    try {
      const accounts = await requestAccounts();
      let chain = await getChainId();

      // Auto-switch to Sepolia if on wrong network
      if (chain !== SEPOLIA_CHAIN_ID) {
        await switchToSepolia();
        chain = SEPOLIA_CHAIN_ID;
      }

      setAddress(accounts[0]);
      setChainId(chain);
      setIsConnected(true);
    } catch (err) {
      if (err.code === 4001) setError("Connection rejected in MetaMask");
      else if (err.code === -32002)
        setError("Pending MetaMask request — open MetaMask");
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
  }, []);

  const switchNetwork = useCallback(async () => {
    try {
      await switchToSepolia();
      setChainId(SEPOLIA_CHAIN_ID);
      setError("");
    } catch (err) {
      setError("Failed to switch network");
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !window.ethereum) return;
    getAccounts()
      .then((accs) => {
        if (accs.length > 0) connect();
      })
      .catch(() => {});
    const onAccountsChanged = (accs) =>
      accs.length ? connect() : disconnect();
    const onChainChanged = () => window.location.reload();
    window.ethereum.on("accountsChanged", onAccountsChanged);
    window.ethereum.on("chainChanged", onChainChanged);
    return () => {
      window.ethereum.removeListener("accountsChanged", onAccountsChanged);
      window.ethereum.removeListener("chainChanged", onChainChanged);
    };
  }, [connect, disconnect]);

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
