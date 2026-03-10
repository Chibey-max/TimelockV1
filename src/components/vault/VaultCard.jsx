'use client';
import { formatDate, formatCountdown, calcProgress } from '@/lib/utils';

export default function VaultCard({ vault, ethPrice, onWithdraw, onDetails }) {
  const isUnlocked = Date.now() >= vault.unlockTime;
  const progress   = calcProgress(vault.depositTime, vault.unlockTime);

  return (
    <div className={`vault-card ${isUnlocked ? 'unlocked' : 'locked'}`}>
      <div className="vault-header">
        <span className="vault-id-badge">
          VAULT #{String(vault.id).padStart(3, '0')}
        </span>
        <span className={`vault-status ${isUnlocked ? 'unlocked' : 'locked'}`}>
          <span className="vault-status-dot" />
          {isUnlocked ? 'UNLOCKED' : 'LOCKED'}
        </span>
      </div>

      <div className="vault-amount">
        {vault.amount.toFixed(4)}
        <span className="vault-amount-unit"> ETH</span>
      </div>
      {ethPrice && (
        <div className="vault-usd">
          ≈ ${(vault.amount * ethPrice).toLocaleString(undefined, { maximumFractionDigits: 2 })}
        </div>
      )}

      <div className="vault-meta">
        <div>
          <div className="vault-meta-label">Unlock Time</div>
          <div className="vault-meta-value">{formatDate(vault.unlockTime)}</div>
        </div>
        <div>
          <div className="vault-meta-label">{isUnlocked ? 'Status' : 'Remaining'}</div>
          <div className="vault-meta-value">
            {isUnlocked ? '✅ Ready' : formatCountdown(vault.unlockTime)}
          </div>
        </div>
      </div>

      <div className="lock-progress">
        <div className="lock-progress-label">
          <span>Lock Progress</span>
          <span>{Math.round(progress)}%</span>
        </div>
        <div className="progress-track">
          <div
            className={`progress-fill ${isUnlocked ? 'unlocked' : 'locked'}`}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="vault-actions">
        {isUnlocked
          ? <button className="btn btn-success btn-sm" onClick={() => onWithdraw(vault)}>⬆ Withdraw</button>
          : <button className="btn btn-secondary btn-sm" disabled>🔒 Locked</button>
        }
        <button className="btn btn-secondary btn-sm" onClick={() => onDetails(vault.id)}>
          Details
        </button>
      </div>
    </div>
  );
}
