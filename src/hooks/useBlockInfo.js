'use client';
import { useState, useEffect, useCallback } from 'react';
import { getBlockNumber, getGasPrice, formatGwei } from '@/lib/web3mini';

export function useBlockInfo(isConnected) {
  const [blockNumber, setBlockNumber] = useState(null);
  const [gasPrice,    setGasPrice]    = useState(null);
  const [ethPrice,    setEthPrice]    = useState(null);

  const fetchChainInfo = useCallback(async () => {
    try {
      const [block, gas] = await Promise.all([getBlockNumber(), getGasPrice()]);
      setBlockNumber(block);
      setGasPrice(formatGwei(gas) + ' Gwei');
    } catch (_) {}
  }, []);

  // ETH price — try multiple sources, CoinGecko rate-limits on production
  const fetchEthPrice = useCallback(async () => {
    // Source 1: Binance (no API key, no rate limit)
    try {
      const res  = await fetch('https://api.binance.com/api/v3/ticker/price?symbol=ETHUSDT');
      const json = await res.json();
      if (json?.price) { setEthPrice(parseFloat(json.price)); return; }
    } catch (_) {}

    // Source 2: CoinGecko fallback
    try {
      const res  = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd');
      const json = await res.json();
      if (json?.ethereum?.usd) { setEthPrice(json.ethereum.usd); return; }
    } catch (_) {}

    // Source 3: Kraken fallback
    try {
      const res  = await fetch('https://api.kraken.com/0/public/Ticker?pair=ETHUSD');
      const json = await res.json();
      const price = json?.result?.XETHZUSD?.c?.[0];
      if (price) { setEthPrice(parseFloat(price)); return; }
    } catch (_) {}
  }, []);

  useEffect(() => {
    if (!isConnected) return;

    fetchChainInfo();
    fetchEthPrice();

    const chainInterval = setInterval(fetchChainInfo, 12000);
    const priceInterval = setInterval(fetchEthPrice, 60000); // price every 60s
    return () => {
      clearInterval(chainInterval);
      clearInterval(priceInterval);
    };
  }, [isConnected, fetchChainInfo, fetchEthPrice]);

  return { blockNumber, gasPrice, ethPrice };
}
