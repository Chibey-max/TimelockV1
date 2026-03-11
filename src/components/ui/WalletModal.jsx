"use client";
import { useState, useEffect, useRef } from "react";

// Detect wallets ONCE globally — not inside the modal component
// This avoids the closure/remount issue where detected[] resets each time modal opens
let _cachedWallets = [];
let _listeners = new Set();

function notifyListeners() {
  _listeners.forEach((fn) => fn([..._cachedWallets]));
}

function initWalletDetection() {
  if (typeof window === "undefined") return;
  if (window.__walletDetectionInit) return;
  window.__walletDetectionInit = true;

  // EIP-6963: modern wallets announce themselves
  window.addEventListener("eip6963:announceProvider", (event) => {
    const { info, provider } = event.detail;
    if (!_cachedWallets.find((w) => w.info.uuid === info.uuid)) {
      _cachedWallets.push({ info, provider });
      notifyListeners();
    }
  });

  window.dispatchEvent(new Event("eip6963:requestProvider"));

  // Legacy fallback after 300ms — gives EIP-6963 wallets time to announce first
  setTimeout(() => {
    if (
      window.ethereum &&
      !_cachedWallets.find((w) => w.info.uuid === "legacy")
    ) {
      const name = window.ethereum.isRabby
        ? "Rabby"
        : window.ethereum.isCoinbaseWallet
          ? "Coinbase Wallet"
          : window.ethereum.isBraveWallet
            ? "Brave Wallet"
            : window.ethereum.isMetaMask
              ? "MetaMask"
              : "Browser Wallet";
      _cachedWallets.push({
        info: { name, icon: null, uuid: "legacy", rdns: "legacy" },
        provider: window.ethereum,
      });
      notifyListeners();
    }
  }, 300);
}

function useDetectedWallets() {
  const [wallets, setWallets] = useState(() => [..._cachedWallets]);

  useEffect(() => {
    initWalletDetection();
    // Subscribe to updates
    _listeners.add(setWallets);
    // Immediately sync in case wallets were detected before this component mounted
    setWallets([..._cachedWallets]);
    return () => _listeners.delete(setWallets);
  }, []);

  return wallets;
}

const WALLET_EMOJI = {
  MetaMask: "🦊",
  Rabby: "🐰",
  "Coinbase Wallet": "🔵",
  "Brave Wallet": "🦁",
  "Trust Wallet": "🛡",
  Rainbow: "🌈",
  Phantom: "👻",
  "OKX Wallet": "⭕",
};

export default function WalletModal({ isOpen, onClose, onConnect }) {
  const wallets = useDetectedWallets();
  const [connecting, setConnecting] = useState(null);
  const [error, setError] = useState("");

  // Reset error when modal opens
  useEffect(() => {
    if (isOpen) setError("");
  }, [isOpen]);

  if (!isOpen) return null;

  async function handleConnect(wallet) {
    setConnecting(wallet.info.uuid);
    setError("");
    try {
      await onConnect(wallet.provider);
      onClose();
    } catch (err) {
      setError(err.message?.slice(0, 100) || "Connection failed");
    } finally {
      setConnecting(null);
    }
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.75)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 500,
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border-bright)",
          borderRadius: 20,
          padding: 28,
          width: "100%",
          maxWidth: 400,
          boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 20,
          }}
        >
          <div>
            <div
              style={{
                fontFamily: "Syne, sans-serif",
                fontSize: "1.1rem",
                fontWeight: 700,
                color: "var(--text-primary)",
              }}
            >
              Connect Wallet
            </div>
            <div
              style={{
                fontSize: "0.7rem",
                color: "var(--text-secondary)",
                marginTop: 3,
              }}
            >
              Choose your wallet to continue
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: "var(--text-muted)",
              fontSize: 22,
              cursor: "pointer",
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>

        {/* Wallet list */}
        {wallets.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {wallets.map((wallet) => (
              <button
                key={wallet.info.uuid}
                onClick={() => handleConnect(wallet)}
                disabled={!!connecting}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  padding: "12px 16px",
                  background: "var(--bg-elevated)",
                  border: "1px solid var(--border)",
                  borderRadius: 12,
                  cursor: connecting ? "not-allowed" : "pointer",
                  opacity:
                    connecting && connecting !== wallet.info.uuid ? 0.5 : 1,
                  transition: "border-color 0.15s",
                  textAlign: "left",
                  width: "100%",
                }}
                onMouseEnter={(e) => {
                  if (!connecting)
                    e.currentTarget.style.borderColor = "var(--gold)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "var(--border)";
                }}
              >
                {wallet.info.icon ? (
                  <img
                    src={wallet.info.icon}
                    alt={wallet.info.name}
                    style={{ width: 36, height: 36, borderRadius: 8 }}
                  />
                ) : (
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 8,
                      background: "var(--bg)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 20,
                    }}
                  >
                    {WALLET_EMOJI[wallet.info.name] || "👛"}
                  </div>
                )}
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      fontSize: "0.85rem",
                      fontWeight: 600,
                      color: "var(--text-primary)",
                      fontFamily: "Syne, sans-serif",
                    }}
                  >
                    {wallet.info.name}
                  </div>
                  <div
                    style={{
                      fontSize: "0.65rem",
                      color: "var(--text-muted)",
                      marginTop: 2,
                    }}
                  >
                    {wallet.info.rdns !== "legacy"
                      ? wallet.info.rdns
                      : "Detected"}
                  </div>
                </div>
                {connecting === wallet.info.uuid ? (
                  <span style={{ fontSize: 13, color: "var(--gold)" }}>
                    connecting…
                  </span>
                ) : (
                  <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
                    →
                  </span>
                )}
              </button>
            ))}
          </div>
        ) : (
          /* No wallet detected */
          <div style={{ textAlign: "center", padding: "24px 0" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>👛</div>
            <div
              style={{
                fontSize: "0.85rem",
                fontWeight: 600,
                color: "var(--text-primary)",
                marginBottom: 6,
              }}
            >
              No Wallet Detected
            </div>
            <div
              style={{
                fontSize: "0.72rem",
                color: "var(--text-secondary)",
                marginBottom: 20,
              }}
            >
              Install a browser wallet extension to get started
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[
                { name: "MetaMask", url: "https://metamask.io", emoji: "🦊" },
                { name: "Rabby", url: "https://rabby.io", emoji: "🐰" },
                {
                  name: "Coinbase",
                  url: "https://wallet.coinbase.com",
                  emoji: "🔵",
                },
              ].map((w) => (
                <a
                  key={w.name}
                  href={w.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "10px 14px",
                    background: "var(--bg-elevated)",
                    border: "1px solid var(--border)",
                    borderRadius: 10,
                    color: "var(--text-primary)",
                    textDecoration: "none",
                    fontSize: "0.8rem",
                  }}
                >
                  <span style={{ fontSize: 20 }}>{w.emoji}</span>
                  <span>Install {w.name}</span>
                  <span
                    style={{
                      marginLeft: "auto",
                      fontSize: 12,
                      color: "var(--text-muted)",
                    }}
                  >
                    ↗
                  </span>
                </a>
              ))}
            </div>
          </div>
        )}

        {error && (
          <div
            style={{
              marginTop: 14,
              padding: "8px 12px",
              background: "rgba(239,68,68,0.1)",
              border: "1px solid rgba(239,68,68,0.3)",
              borderRadius: 8,
              fontSize: "0.75rem",
              color: "#f87171",
            }}
          >
            ⚠ {error}
          </div>
        )}

        <div
          style={{
            marginTop: 16,
            fontSize: "0.62rem",
            color: "var(--text-muted)",
            textAlign: "center",
          }}
        >
          Non-custodial — we never hold your keys.
        </div>
      </div>
    </div>
  );
}
