'use client';
import { useState, useEffect } from 'react';

export default function Header({ wallet }) {
  const [theme, setTheme] = useState('dark');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme(t => t === 'dark' ? 'light' : 'dark');

  return (
    <header className="site-header">
      <div className="header-inner">
        {/* Logo */}
        <a className="logo" href="#">
          <div className="logo-icon">🔐</div>
          Timelocked<span className="logo-dim">Vault</span>
        </a>

        {/* Right side */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {wallet.isConnected && (
            <div className="network-badge">
              <div className="network-dot" />
              <span>{wallet.network?.name ?? 'Unknown Network'}</span>
            </div>
          )}

          <button
            className="theme-toggle"
            onClick={toggleTheme}
            title="Toggle theme"
          >
            {theme === 'dark' ? '🌙' : '☀️'}
          </button>

          <button
            className={`btn-wallet${wallet.isConnected ? ' connected' : ''}`}
            onClick={wallet.isConnected ? wallet.disconnect : wallet.connect}
            disabled={wallet.isConnecting}
          >
            <span>🦊</span>
            <span>
              {wallet.isConnecting
                ? 'Connecting…'
                : wallet.isConnected
                  ? wallet.truncatedAddress
                  : 'Connect Wallet'}
            </span>
          </button>
        </div>
      </div>

      {/* Wallet error banner */}
      {wallet.error && (
        <div style={{
          background: '#7c2d12', color: '#fed7aa',
          fontSize: 12, padding: '6px 24px', textAlign: 'center',
          fontFamily: 'JetBrains Mono, monospace',
        }}>
          ⚠ {wallet.error}
        </div>
      )}
    </header>
  );
}
