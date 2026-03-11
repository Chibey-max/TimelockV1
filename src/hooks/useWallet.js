'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { NETWORKS } from '@/lib/contract';
import { truncateAddr } from '@/lib/utils';

const SEPOLIA_ID  = 11155111;
const SEPOLIA_HEX = '0xaa36a7';

function getAnyProvider() {
  if (typeof window === 'undefined') return null;
  return window.__activeProvider
    || window.rabby
    || window.ethereum
    || null;
}

async function addSepolia(p) {
  await p.request({
    method: 'wallet_addEthereumChain',
    params: [{
      chainId:           SEPOLIA_HEX,
      chainName:         'Sepolia Testnet',
      nativeCurrency:    { name: 'ETH', symbol: 'ETH', decimals: 18 },
      rpcUrls:           ['https://rpc.sepolia.org'],
      blockExplorerUrls: ['https://sepolia.etherscan.io'],
    }],
  });
}

export function useWallet() {
  const [address,      setAddress]      = useState('');
  const [chainId,      setChainId]      = useState(null);
  const [isConnected,  setIsConnected]  = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error,        setError]        = useState('');
  const [showModal,    setShowModal]    = useState(false);
  const busy = useRef(false);

  const network    = chainId ? (NETWORKS[chainId] || { name: `Chain ${chainId}`, explorer: '' }) : null;
  const isWrongNet = isConnected && chainId !== SEPOLIA_ID;

  // Core connect — accepts any provider, triggers MetaMask popup
  const connect = useCallback(async (specificProvider) => {
    if (busy.current) return;
    busy.current = true;

    const p = specificProvider || getAnyProvider();
    if (!p) {
      setError('No wallet found. Install MetaMask or Rabby.');
      busy.current = false;
      return;
    }

    setIsConnecting(true);
    setError('');

    try {
      const accounts = await p.request({ method: 'eth_requestAccounts' });
      if (!accounts?.length) throw new Error('No accounts returned');

      let chain = parseInt(await p.request({ method: 'eth_chainId' }), 16);

      if (chain !== SEPOLIA_ID) {
        try {
          await p.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: SEPOLIA_HEX }] });
          chain = SEPOLIA_ID;
        } catch (e) {
          if (e.code === 4902) { await addSepolia(p); chain = SEPOLIA_ID; }
          // if user dismissed — still connect, banner will show
        }
        chain = parseInt(await p.request({ method: 'eth_chainId' }), 16);
      }

      window.__activeProvider = p;
      setAddress(accounts[0]);
      setChainId(chain);
      setIsConnected(true);
      setError('');
      setShowModal(false);
    } catch (err) {
      if      (err.code === 4001)   setError('Rejected — please approve in your wallet');
      else if (err.code === -32002) setError('Already pending — open your wallet');
      else                          setError(err.message?.slice(0, 100) || 'Connection failed');
    } finally {
      setIsConnecting(false);
      busy.current = false;
    }
  }, []);

  const openModal  = useCallback(() => setShowModal(true),  []);
  const closeModal = useCallback(() => setShowModal(false), []);

  const disconnect = useCallback(() => {
    setAddress(''); setChainId(null);
    setIsConnected(false); setError('');
    window.__activeProvider = null;
  }, []);

  const switchNetwork = useCallback(async () => {
    const p = getAnyProvider();
    if (!p) return;
    try {
      await p.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: SEPOLIA_HEX }] });
      setChainId(SEPOLIA_ID); setError('');
    } catch (e) {
      if (e.code === 4902) { await addSepolia(p); setChainId(SEPOLIA_ID); }
      else setError('Failed to switch network');
    }
  }, []);

  // Silent auto-reconnect on mount — no popup
  useEffect(() => {
    const p = getAnyProvider();
    if (!p) return;

    p.request({ method: 'eth_accounts' })
      .then(accs => {
        if (!accs?.length) return;
        p.request({ method: 'eth_chainId' }).then(hex => {
          window.__activeProvider = p;
          setAddress(accs[0]);
          setChainId(parseInt(hex, 16));
          setIsConnected(true);
        });
      })
      .catch(() => {});

    const onAccounts = accs => {
      if (!accs?.length) disconnect();
      else { setAddress(accs[0]); setIsConnected(true); }
    };
    const onChain = hex => setChainId(parseInt(hex, 16));

    p.on?.('accountsChanged', onAccounts);
    p.on?.('chainChanged', onChain);
    return () => {
      p.removeListener?.('accountsChanged', onAccounts);
      p.removeListener?.('chainChanged', onChain);
    };
  }, [disconnect]);

  return {
    address, chainId, network,
    isConnected, isConnecting, isWrongNet, error,
    showModal, openModal, closeModal,
    connect, disconnect, switchNetwork,
    truncatedAddress: address ? truncateAddr(address) : '',
  };
}
