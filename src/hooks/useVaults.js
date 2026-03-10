'use client';
import { useState, useCallback } from 'react';
import { getActiveVaults, formatEther } from '@/lib/web3mini';
import { CONTRACT_ADDRESS } from '@/lib/contract';

export function useVaults(address) {
  const [vaults,    setVaults]    = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error,     setError]     = useState('');

  const load = useCallback(async () => {
    if (!address) return;
    setIsLoading(true);
    setError('');
    try {
      // Retry up to 4x with 2s gaps for slow RPC nodes
      let ids = [], balances = [], unlockTimes = [];
      for (let attempt = 0; attempt < 4; attempt++) {
        if (attempt > 0) await new Promise(r => setTimeout(r, 2000));
        [ids, balances, unlockTimes] = await getActiveVaults(CONTRACT_ADDRESS, address);
        if (ids.length > 0) break;
        console.log(`loadVaults attempt ${attempt + 1}: empty, retrying...`);
      }

      setVaults(ids.map((id, i) => ({
        id:          Number(id),
        // formatEther returns string like "0.01", parseFloat for display
        amount:      parseFloat(formatEther(balances[i])),
        unlockTime:  Number(unlockTimes[i]) * 1000, // seconds → ms
        depositTime: Number(unlockTimes[i]) * 1000 - 30 * 86400000,
        active:      true,
      })));
    } catch (err) {
      console.error('loadVaults error:', err);
      setError(err.message || 'Failed to load vaults');
    } finally {
      setIsLoading(false);
    }
  }, [address]);

  const now             = Date.now();
  const totalBalance    = vaults.reduce((s, v) => s + v.amount, 0);
  const unlockedBalance = vaults.filter(v => now >= v.unlockTime).reduce((s, v) => s + v.amount, 0);
  const unlockedVaults  = vaults.filter(v => now >= v.unlockTime);

  return { vaults, isLoading, error, load, totalBalance, unlockedBalance, unlockedVaults };
}
