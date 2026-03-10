"use client";
import { useState, useEffect } from "react";

export default function Header({ wallet }) {
  const [theme, setTheme] = useState("dark");

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  return (
    <header className="site-header">
      <div className="header-inner">
        <a className="logo" href="#">
          <div className="logo-icon">🔐</div>
          Timelocked<span className="logo-dim">Vault</span>
        </a>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {wallet.isConnected && !wallet.isWrongNet && (
            <div className="network-badge">
              <div className="network-dot" />
              <span>{wallet.network?.name ?? "Unknown Network"}</span>
            </div>
          )}

          <button
            className="theme-toggle"
            onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
            title="Toggle theme"
          >
            {theme === "dark" ? "🌙" : "☀️"}
          </button>

          <button
            className={`btn-wallet${wallet.isConnected ? " connected" : ""}`}
            onClick={wallet.isConnected ? wallet.disconnect : wallet.connect}
            disabled={wallet.isConnecting}
          >
            <span>🦊</span>
            <span>
              {wallet.isConnecting
                ? "Connecting…"
                : wallet.isConnected
                  ? wallet.truncatedAddress
                  : "Connect Wallet"}
            </span>
          </button>
        </div>
      </div>

      {/* Wrong network banner */}
      {wallet.isWrongNet && (
        <div
          style={{
            background: "#7c2d12",
            color: "#fed7aa",
            fontSize: 12,
            padding: "8px 24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 12,
            fontFamily: "JetBrains Mono, monospace",
          }}
        >
          ⚠ Wrong network — this app runs on Sepolia Testnet
          <button
            onClick={wallet.switchNetwork}
            style={{
              background: "#f5a623",
              color: "#0d0a00",
              border: "none",
              borderRadius: 6,
              padding: "3px 10px",
              fontSize: 11,
              fontWeight: 700,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            Switch to Sepolia
          </button>
        </div>
      )}

      {/* General error banner */}
      {wallet.error && !wallet.isWrongNet && (
        <div
          style={{
            background: "#450a0a",
            color: "#fca5a5",
            fontSize: 12,
            padding: "6px 24px",
            textAlign: "center",
            fontFamily: "JetBrains Mono, monospace",
          }}
        >
          ⚠ {wallet.error}
        </div>
      )}
    </header>
  );
}
