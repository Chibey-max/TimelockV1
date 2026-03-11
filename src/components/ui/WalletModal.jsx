"use client";
import { useState, useEffect } from "react";

// Global wallet registry — populated once, survives component remounts
if (typeof window !== "undefined" && !window.__walletRegistry) {
  window.__walletRegistry = { wallets: [], listeners: new Set() };

  const reg = window.__walletRegistry;

  window.addEventListener("eip6963:announceProvider", (e) => {
    const { info, provider } = e.detail;
    if (!reg.wallets.find((w) => w.info.uuid === info.uuid)) {
      reg.wallets.push({ info, provider });
      reg.listeners.forEach((fn) => fn([...reg.wallets]));
    }
  });

  window.dispatchEvent(new Event("eip6963:requestProvider"));

  // Legacy fallback — window.ethereum for MetaMask etc.
  setTimeout(() => {
    if (window.ethereum && !reg.wallets.find((w) => w.info.uuid === "legacy")) {
      const name = window.ethereum.isRabby
        ? "Rabby"
        : window.ethereum.isCoinbaseWallet
          ? "Coinbase Wallet"
          : window.ethereum.isBraveWallet
            ? "Brave Wallet"
            : window.ethereum.isMetaMask
              ? "MetaMask"
              : "Browser Wallet";
      reg.wallets.push({
        info: { name, icon: null, uuid: "legacy", rdns: "legacy" },
        provider: window.ethereum,
      });
      reg.listeners.forEach((fn) => fn([...reg.wallets]));
    }
  }, 300);
}

function useWalletRegistry() {
  const [wallets, setWallets] = useState(() =>
    typeof window !== "undefined"
      ? [...(window.__walletRegistry?.wallets || [])]
      : [],
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const reg = window.__walletRegistry;
    if (!reg) return;
    setWallets([...reg.wallets]); // sync immediately
    reg.listeners.add(setWallets);
    return () => reg.listeners.delete(setWallets);
  }, []);

  return wallets;
}

const EMOJI = {
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
  const wallets = useWalletRegistry();
  const [connecting, setConnecting] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isOpen) setError("");
  }, [isOpen]);

  if (!isOpen) return null;

  async function handleConnect(wallet) {
    setConnecting(wallet.info.uuid);
    setError("");
    try {
      await onConnect(wallet.provider);
      // onConnect is responsible for closing if needed
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
        background: "rgba(0,0,0,0.8)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
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
          boxShadow: "0 24px 64px rgba(0,0,0,0.6)",
        }}
      >
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
              fontSize: 24,
              cursor: "pointer",
              lineHeight: 1,
              padding: "0 4px",
            }}
          >
            ×
          </button>
        </div>

        {wallets.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {wallets.map((w) => (
              <button
                key={w.info.uuid}
                onClick={() => handleConnect(w)}
                disabled={!!connecting}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  padding: "13px 16px",
                  background: "var(--bg-elevated)",
                  border: "1px solid var(--border)",
                  borderRadius: 12,
                  cursor: connecting ? "not-allowed" : "pointer",
                  opacity: connecting && connecting !== w.info.uuid ? 0.4 : 1,
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
                {w.info.icon ? (
                  <img
                    src={w.info.icon}
                    alt={w.info.name}
                    style={{ width: 38, height: 38, borderRadius: 8 }}
                  />
                ) : (
                  <div
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: 8,
                      background: "var(--bg)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 22,
                    }}
                  >
                    {EMOJI[w.info.name] || "👛"}
                  </div>
                )}
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      fontSize: "0.9rem",
                      fontWeight: 600,
                      color: "var(--text-primary)",
                      fontFamily: "Syne, sans-serif",
                    }}
                  >
                    {w.info.name}
                  </div>
                  <div
                    style={{
                      fontSize: "0.65rem",
                      color: "var(--text-muted)",
                      marginTop: 2,
                    }}
                  >
                    {w.info.rdns !== "legacy" ? w.info.rdns : "Detected"}
                  </div>
                </div>
                <span
                  style={{
                    fontSize: 13,
                    color:
                      connecting === w.info.uuid
                        ? "var(--gold)"
                        : "var(--text-muted)",
                    minWidth: 70,
                    textAlign: "right",
                  }}
                >
                  {connecting === w.info.uuid ? "connecting…" : "→"}
                </span>
              </button>
            ))}
          </div>
        ) : (
          <div style={{ textAlign: "center", padding: "28px 0" }}>
            <div style={{ fontSize: 44, marginBottom: 12 }}>👛</div>
            <div
              style={{
                fontSize: "0.9rem",
                fontWeight: 600,
                color: "var(--text-primary)",
                marginBottom: 6,
              }}
            >
              No Wallet Detected
            </div>
            <div
              style={{
                fontSize: "0.73rem",
                color: "var(--text-secondary)",
                marginBottom: 20,
              }}
            >
              Install a browser wallet extension to continue
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
                    padding: "11px 14px",
                    background: "var(--bg-elevated)",
                    border: "1px solid var(--border)",
                    borderRadius: 10,
                    color: "var(--text-primary)",
                    textDecoration: "none",
                    fontSize: "0.82rem",
                  }}
                >
                  <span style={{ fontSize: 22 }}>{w.emoji}</span>
                  <span>Install {w.name}</span>
                  <span
                    style={{ marginLeft: "auto", color: "var(--text-muted)" }}
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
              padding: "9px 13px",
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
