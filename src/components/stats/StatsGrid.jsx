'use client';

export default function StatsGrid({ totalBalance, unlockedBalance, vaultCount, ethPrice }) {
  return (
    <div className="stats-grid">
      <div className="stat-card">
        <div className="stat-label">Total Locked</div>
        <div className="stat-value">
          {totalBalance.toFixed(3)}
          <span className="stat-unit">Ξ</span>
        </div>
        <div className="stat-sub">
          {ethPrice
            ? '≈ $' + (totalBalance * ethPrice).toLocaleString(undefined, { maximumFractionDigits: 0 })
            : `${vaultCount} vault${vaultCount !== 1 ? 's' : ''}`}
        </div>
      </div>

      <div className="stat-card">
        <div className="stat-label">Unlocked</div>
        <div className="stat-value" style={{ color: 'var(--green)' }}>
          {unlockedBalance.toFixed(3)}
          <span className="stat-unit">Ξ</span>
        </div>
        <div className="stat-sub">
          {vaultCount} active vault{vaultCount !== 1 ? 's' : ''}
        </div>
      </div>
    </div>
  );
}
