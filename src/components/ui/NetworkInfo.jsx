'use client';

export default function NetworkInfo({ network, blockNumber, gasPrice, ethPrice }) {
  return (
    <div className="card" style={{ marginTop: 16 }}>
      <div className="card-title">Network Info</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div className="info-row">
          <span className="info-key">Network</span>
          <span className="info-val">{network?.name ?? '—'}</span>
        </div>
        <div className="info-row">
          <span className="info-key">Gas Price</span>
          <span className="info-val">{gasPrice ?? '—'}</span>
        </div>
        <div className="info-row">
          <span className="info-key">Block</span>
          <span className="info-val">
            {blockNumber != null ? '#' + blockNumber.toLocaleString() : '—'}
          </span>
        </div>
        <div className="info-row">
          <span className="info-key">ETH Price</span>
          <span className="info-val" style={{ color: 'var(--gold)' }}>
            {ethPrice ? '$' + ethPrice.toLocaleString() : '—'}
          </span>
        </div>
      </div>
    </div>
  );
}
