'use client';
import { useEffect } from 'react';
import { useWallet }    from '@/hooks/useWallet';
import { useVaults }    from '@/hooks/useVaults';
import { useToast }     from '@/hooks/useToast';
import { useBlockInfo } from '@/hooks/useBlockInfo';

import Header      from '@/components/layout/Header';
import Footer      from '@/components/layout/Footer';
import StatsGrid   from '@/components/stats/StatsGrid';
import DepositForm from '@/components/deposit/DepositForm';
import NetworkInfo from '@/components/ui/NetworkInfo';
import VaultList   from '@/components/vault/VaultList';
import VaultChart  from '@/components/chart/VaultChart';
import { ToastContainer } from '@/components/ui/Toast';

export default function Home() {
  const wallet    = useWallet();
  const vaults    = useVaults(wallet.address);
  const toast     = useToast();
  const blockInfo = useBlockInfo(wallet.isConnected);

  // Load vaults whenever wallet connects or address changes
  useEffect(() => {
    if (wallet.isConnected) vaults.load();
  }, [wallet.isConnected, wallet.address]);

  return (
    <div className="app-shell">
      <ToastContainer toasts={toast.toasts} onRemove={toast.remove} />

      <Header wallet={wallet} />

      <main className="main-grid">
        {/* ── Left column ── */}
        <aside>
          <StatsGrid
            totalBalance={vaults.totalBalance}
            unlockedBalance={vaults.unlockedBalance}
            vaultCount={vaults.vaults.length}
            ethPrice={blockInfo.ethPrice}
          />

          <DepositForm
            wallet={wallet}
            onSuccess={vaults.loadAfterTx}
            toast={toast}
          />

          <NetworkInfo
            network={wallet.network}
            blockNumber={blockInfo.blockNumber}
            gasPrice={blockInfo.gasPrice}
            ethPrice={blockInfo.ethPrice}
          />
        </aside>

        {/* ── Right column ── */}
        <section>
          <VaultChart
            vaults={vaults.vaults}
            ethPrice={blockInfo.ethPrice}
          />

          <VaultList
            vaults={vaults.vaults}
            isLoading={vaults.isLoading}
            isConnected={wallet.isConnected}
            address={wallet.address}
            chainId={wallet.chainId}
            ethPrice={blockInfo.ethPrice}
            onRefresh={vaults.load}
            onSuccess={vaults.loadAfterTx}
            toast={toast}
          />
        </section>
      </main>

      <Footer />
    </div>
  );
}
