'use client';
import { useState, useEffect, useCallback } from 'react';
import { requestAccounts, getAccounts, getChainId } from '@/lib/web3mini';
import { NETWORKS } from '@/lib/contract';
import { truncateAddr } from '@/lib/utils';

export function useWallet() {
  const [address,      setAddress]      = useState('');
  const [chainId,      setChainId]      = useState(null);
  const [isConnected,  setIsConnected]  = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error,        setError]        = useState('');

  const network = chainId
    ? (NETWORKS[chainId] || { name: `Chain ${chainId}`, explorer: '' })
    : null;

  const connect = useCallback(async () => {
    if (typeof window === 'undefined' || !window.ethereum) {
      setError('MetaMask not found — make sure MetaMask is installed and you are on http://localhost');
      return;
    }
    setIsConnecting(true);
    setError('');
    try {
      const accounts = await requestAccounts();
      const chain    = await getChainId();
      setAddress(accounts[0]);
      setChainId(chain);
      setIsConnected(true);
    } catch (err) {
      if      (err.code === 4001)    setError('Connection rejected in MetaMask');
      else if (err.code === -32002)  setError('Pending MetaMask request — open MetaMask to approve');
      else                           setError(err.message?.slice(0, 80) || 'Connection failed');
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    setAddress('');
    setChainId(null);
    setIsConnected(false);
    setError('');
  }, []);

  // Auto-reconnect on mount + wire MetaMask events
  useEffect(() => {
    if (typeof window === 'undefined' || !window.ethereum) return;

    getAccounts()
      .then(accs => { if (accs.length > 0) connect(); })
      .catch(() => {});

    const onAccountsChanged = accs => {
      if (accs.length === 0) disconnect();
      else window.location.reload();
    };
    const onChainChanged = () => window.location.reload();

    window.ethereum.on('accountsChanged', onAccountsChanged);
    window.ethereum.on('chainChanged',    onChainChanged);
    return () => {
      window.ethereum.removeListener('accountsChanged', onAccountsChanged);
      window.ethereum.removeListener('chainChanged',    onChainChanged);
    };
  }, [connect, disconnect]);

  return {
    address,
    chainId,
    network,
    isConnected,
    isConnecting,
    error,
    connect,
    disconnect,
    truncatedAddress: address ? truncateAddr(address) : '',
  };
}
