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
      const [ids, balances, unlockTimes] = await getActiveVaults(CONTRACT_ADDRESS, address);
      setVaults(ids.map((id, i) => ({
        id:          Number(id),
        amount:      parseFloat(formatEther(balances[i])),
        unlockTime:  Number(unlockTimes[i]) * 1000,
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

  // Called after a tx confirms — waits a beat then reloads
  const loadAfterTx = useCallback(async () => {
    if (!address) return;
    await new Promise(r => setTimeout(r, 2000));
    await load();
  }, [address, load]);

  const now             = Date.now();
  const totalBalance    = vaults.reduce((s, v) => s + v.amount, 0);
  const unlockedBalance = vaults.filter(v => now >= v.unlockTime).reduce((s, v) => s + v.amount, 0);
  const unlockedVaults  = vaults.filter(v => now >= v.unlockTime);

  return { vaults, isLoading, error, load, loadAfterTx, totalBalance, unlockedBalance, unlockedVaults };
}
