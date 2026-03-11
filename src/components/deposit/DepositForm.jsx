'use client';
import { useState } from 'react';
import Modal from '@/components/ui/Modal';
import WalletModal from '@/components/ui/WalletModal';
import { deposit, waitForReceipt, parseEther } from '@/lib/web3mini';
import { CONTRACT_ADDRESS, NETWORKS } from '@/lib/contract';
import { formatDate } from '@/lib/utils';

const QUICK_AMOUNTS   = [0.01, 0.05, 0.1, 0.5, 1];
const QUICK_DURATIONS = [
  { label: '7d',   days: 7   },
  { label: '30d',  days: 30  },
  { label: '90d',  days: 90  },
  { label: '180d', days: 180 },
  { label: '1yr',  days: 365 },
];

function daysFromNow(days) {
  const d = new Date(Date.now() + days * 86400000);
  return new Date(d - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

export default function DepositForm({ wallet, onSuccess, toast }) {
  const [amount,       setAmount]       = useState('');
  const [unlockVal,    setUnlockVal]    = useState(daysFromNow(30));
  const [confirmOpen,  setConfirmOpen]  = useState(false);
  const [walletOpen,   setWalletOpen]   = useState(false);
  const [loading,      setLoading]      = useState(false);

  const unlockMs = unlockVal ? new Date(unlockVal).getTime() : 0;
  const diffDays = unlockMs ? Math.round((unlockMs - Date.now()) / 86400000) : 0;

  function openConfirm() {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0)                              return toast.error('Invalid Amount', 'Enter a valid ETH amount');
    if (!unlockVal)                                    return toast.error('No Unlock Time', 'Select an unlock date');
    if (unlockMs <= Date.now())                        return toast.error('Invalid Date', 'Unlock time must be in the future');
    if (unlockMs > Date.now() + 365 * 86400000)       return toast.error('Too Far', 'Max lock duration is 1 year');
    setConfirmOpen(true);
  }

  async function execute() {
    setLoading(true);
    try {
      const unlockSec = Math.floor(unlockMs / 1000);
      const wei       = parseEther(amount);
      const txHash    = await deposit(wallet.address, CONTRACT_ADDRESS, unlockSec, wei);

      setConfirmOpen(false);
      toast.info('Transaction Submitted', 'Waiting for on-chain confirmation…');

      const net = NETWORKS[wallet.chainId] || { explorer: '' };
      if (net.explorer) {
        toast.info('Tx Sent',
          `<a href="${net.explorer}/tx/${txHash}" target="_blank" style="color:var(--blue);text-decoration:underline">${txHash.slice(0,10)}…${txHash.slice(-6)} ↗</a>`,
          12000);
      }

      await waitForReceipt(txHash);
      toast.success('Vault Created!', `${parseFloat(amount).toFixed(4)} ETH locked for ${diffDays} day${diffDays !== 1 ? 's' : ''}`);
      setAmount('');
      setUnlockVal(daysFromNow(30));
      onSuccess?.();
    } catch (err) {
      if (err.code === 4001 || err.code === 'ACTION_REJECTED')
        toast.warning('Cancelled', 'You rejected the transaction');
      else
        toast.error('Deposit Failed', err.message?.slice(0, 120) || 'Transaction failed');
    } finally {
      setLoading(false);
    }
  }

  // ── Not connected state ──
  if (!wallet.isConnected) {
    return (
      <>
        <div className="card">
          <div className="card-title">New Deposit</div>
          <div className="connect-prompt">
            <div className="connect-icon">🔒</div>
            <div className="connect-title">Wallet Required</div>
            <div className="connect-sub">Connect your wallet to create time-locked vaults</div>
            <button
              className="btn btn-primary"
              onClick={() => setWalletOpen(true)}
              disabled={wallet.isConnecting}
            >
              {wallet.isConnecting ? 'Connecting…' : 'Connect Wallet'}
            </button>
          </div>
        </div>

        {/* Own WalletModal instance so it works independently of Header */}
        <WalletModal
          isOpen={walletOpen}
          onClose={() => setWalletOpen(false)}
          onConnect={async (p) => {
            await wallet.connect(p);
            setWalletOpen(false);
          }}
        />
      </>
    );
  }

  // ── Connected state ──
  return (
    <>
      <div className="card">
        <div className="card-title">New Deposit</div>

        <div className="form-group">
          <label className="form-label">Amount</label>
          <div className="input-wrap">
            <input type="number" className="form-input"
              placeholder="0.0" step="0.001" min="0.001"
              value={amount} onChange={e => setAmount(e.target.value)}
              style={{ paddingRight: 42 }} />
            <span className="input-suffix">ETH</span>
          </div>
          <div className="quick-picks">
            {QUICK_AMOUNTS.map(v => (
              <button key={v} className="quick-pick" onClick={() => setAmount(String(v))}>{v}</button>
            ))}
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Unlock Date & Time</label>
          <input type="datetime-local" className="form-input"
            value={unlockVal} onChange={e => setUnlockVal(e.target.value)} />
          <div className="form-hint">⚠ Must be within 1 year from now</div>
          <div className="quick-picks">
            {QUICK_DURATIONS.map(({ label, days }) => (
              <button key={label} className="quick-pick" onClick={() => setUnlockVal(daysFromNow(days))}>{label}</button>
            ))}
          </div>
        </div>

        <button className="btn btn-primary btn-full" onClick={openConfirm}>
          🔒 Lock ETH
        </button>
        <div className="form-hint" style={{ textAlign: 'center', marginTop: 8 }}>
          Only one active vault allowed at a time
        </div>
      </div>

      <Modal isOpen={confirmOpen} onClose={() => !loading && setConfirmOpen(false)}>
        <div className="modal-title">🔒 Confirm Deposit</div>
        <div className="modal-subtitle">Review your vault details before locking ETH</div>
        <div className="modal-detail">
          <div className="modal-detail-row">
            <span className="modal-detail-key">Amount</span>
            <span className="modal-detail-val">{parseFloat(amount || 0).toFixed(4)} ETH</span>
          </div>
          <div className="modal-detail-row">
            <span className="modal-detail-key">Unlock Time</span>
            <span className="modal-detail-val">{unlockMs ? formatDate(unlockMs) : '—'}</span>
          </div>
          <div className="modal-detail-row">
            <span className="modal-detail-key">Duration</span>
            <span className="modal-detail-val">{diffDays} day{diffDays !== 1 ? 's' : ''}</span>
          </div>
        </div>
        <div className="modal-warning">⚠ ETH will be locked until the unlock time. This cannot be undone.</div>
        <div className="modal-actions">
          <button className="btn btn-secondary" style={{ flex:1 }}
            onClick={() => setConfirmOpen(false)} disabled={loading}>
            Cancel
          </button>
          <button className="btn btn-primary" style={{ flex:2 }}
            onClick={execute} disabled={loading}>
            {loading ? <><span className="spinner" /> Confirming…</> : 'Confirm & Lock'}
          </button>
        </div>
      </Modal>
    </>
  );
}
