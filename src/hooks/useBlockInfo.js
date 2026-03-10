'use client';
import { useState, useEffect } from 'react';
import { getBlockNumber, getGasPrice, formatGwei } from '@/lib/web3mini';

export function useBlockInfo(isConnected) {
  const [blockNumber, setBlockNumber] = useState(null);
  const [gasPrice,    setGasPrice]    = useState(null);
  const [ethPrice,    setEthPrice]    = useState(null);

  const fetch = async () => {
    try {
      const [block, gas] = await Promise.all([getBlockNumber(), getGasPrice()]);
      setBlockNumber(block);
      setGasPrice(formatGwei(gas) + ' Gwei');
    } catch (_) {}
  };

  // Fetch ETH price from CoinGecko (best-effort, no key needed)
  useEffect(() => {
    if (!isConnected) return;
    fetch();
    window.fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd')
      .then(r => r.json())
      .then(d => setEthPrice(d?.ethereum?.usd || null))
      .catch(() => {});
    const interval = setInterval(fetch, 12000);
    return () => clearInterval(interval);
  }, [isConnected]);

  return { blockNumber, gasPrice, ethPrice };
}
