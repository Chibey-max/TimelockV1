'use client';
import { useState } from 'react';
import Modal from '@/components/ui/Modal';
import { withdrawAll, waitForReceipt } from '@/lib/web3mini';
import { CONTRACT_ADDRESS, NETWORKS } from '@/lib/contract';

export default function WithdrawAll({
  unlockedBalance, unlockedCount,
  address, chainId,
  onSuccess, toast,
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [loading,   setLoading]   = useState(false);

  async function execute() {
    setLoading(true);
    try {
      const txHash = await withdrawAll(address, CONTRACT_ADDRESS);
      setModalOpen(false);
      toast.info('Transaction Submitted', 'Withdrawing all unlocked vaults…');

      const net = NETWORKS[chainId] || { explorer: '' };
      if (net.explorer) {
        toast.info('Transaction Sent',
          `<a href="${net.explorer}/tx/${txHash}" target="_blank" style="color:var(--blue);text-decoration:underline;">${txHash.slice(0,10)}…${txHash.slice(-6)} ↗</a>`,
          12000,
        );
      }

      await waitForReceipt(txHash);
      toast.success('All Vaults Withdrawn!', `${unlockedCount} vault${unlockedCount !== 1 ? 's' : ''} — ETH returned to your wallet`);
      onSuccess?.();
    } catch (err) {
      if (err.code === 4001 || err.code === 'ACTION_REJECTED')
        toast.warning('Cancelled', 'You rejected the transaction');
      else
        toast.error('Withdraw All Failed', err.message?.slice(0, 100));
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div className="withdraw-all-section">
        <div>
          <div className="withdraw-all-label">Available to Withdraw</div>
          <div className="withdraw-all-amount">{unlockedBalance.toFixed(4)} ETH</div>
        </div>
        <button className="btn btn-success" onClick={() => setModalOpen(true)}>
          ⬆ Withdraw All
        </button>
      </div>

      <Modal isOpen={modalOpen} onClose={() => !loading && setModalOpen(false)}>
        <div className="modal-title">⬆ Withdraw All Unlocked</div>
        <div className="modal-subtitle">Withdraw all vaults whose lock period has expired</div>
        <div className="modal-detail">
          <div className="modal-detail-row">
            <span className="modal-detail-key">Total Amount</span>
            <span className="modal-detail-val" style={{ color: 'var(--green)' }}>
              {unlockedBalance.toFixed(4)} ETH
            </span>
          </div>
          <div className="modal-detail-row">
            <span className="modal-detail-key">Vaults</span>
            <span className="modal-detail-val">{unlockedCount} vault{unlockedCount !== 1 ? 's' : ''}</span>
          </div>
        </div>
        <div className="modal-actions">
          <button
            className="btn btn-secondary"
            style={{ flex: 1 }}
            onClick={() => setModalOpen(false)}
            disabled={loading}
          >
            Cancel
          </button>
          <button
            className="btn btn-success"
            style={{ flex: 2 }}
            onClick={execute}
            disabled={loading}
          >
            {loading
              ? <><span className="spinner" /> Processing…</>
              : 'Withdraw All'}
          </button>
        </div>
      </Modal>
    </>
  );
}
