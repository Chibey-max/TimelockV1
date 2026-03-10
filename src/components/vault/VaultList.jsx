"use client";
import { useState } from "react";
import VaultCard from "./VaultCard";
import WithdrawAll from "./WithdrawAll";
import Modal from "@/components/ui/Modal";
import {
  withdraw,
  waitForReceipt,
  getVault,
  formatEther,
} from "@/lib/web3mini";
import { CONTRACT_ADDRESS, NETWORKS } from "@/lib/contract";
import { formatDate, truncateAddr } from "@/lib/utils";

export default function VaultList({
  vaults,
  isLoading,
  isConnected,
  isWrongNet,
  address,
  chainId,
  ethPrice,
  onRefresh,
  onSuccess,
  toast,
  switchNetwork,
}) {
  const [withdrawVault, setWithdrawVault] = useState(null);
  const [loading, setLoading] = useState(false);

  const unlockedVaults = vaults.filter((v) => Date.now() >= v.unlockTime);
  const unlockedBalance = unlockedVaults.reduce((s, v) => s + v.amount, 0);

  async function executeWithdraw() {
    if (!withdrawVault) return;
    setLoading(true);
    try {
      const txHash = await withdraw(
        address,
        CONTRACT_ADDRESS,
        withdrawVault.id,
      );
      setWithdrawVault(null);
      toast.info(
        "Transaction Submitted",
        `Withdrawing Vault #${withdrawVault.id}…`,
      );

      const net = NETWORKS[chainId] || { explorer: "" };
      if (net.explorer) {
        toast.info(
          "Transaction Sent",
          `<a href="${net.explorer}/tx/${txHash}" target="_blank" style="color:var(--blue);text-decoration:underline;">${txHash.slice(0, 10)}…${txHash.slice(-6)} ↗</a>`,
          12000,
        );
      }

      await waitForReceipt(txHash);
      toast.success("Withdrawal Successful!", "ETH returned to your wallet");
      onSuccess?.();
    } catch (err) {
      if (err.code === 4001 || err.code === "ACTION_REJECTED")
        toast.warning("Cancelled", "You rejected the transaction");
      else toast.error("Withdrawal Failed", err.message?.slice(0, 100));
    } finally {
      setLoading(false);
    }
  }

  async function showDetails(id) {
    try {
      const v = await getVault(CONTRACT_ADDRESS, address, id);
      if (!v) return toast.error("Not Found", "Vault not found on-chain");
      const eth = parseFloat(formatEther(v.amount)).toFixed(4);
      const unlock = formatDate(Number(v.unlockTime) * 1000);
      toast.info(
        `Vault #${id}`,
        `${eth} ETH · Unlocks ${unlock} · ${v.isUnlocked ? "✅ Unlocked" : "🔒 Locked"}`,
      );
    } catch (err) {
      toast.error("Error", err.message?.slice(0, 60));
    }
  }

  return (
    <>
      <div className="card">
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 16,
          }}
        >
          <div className="card-title" style={{ marginBottom: 0 }}>
            Active Vaults
          </div>
          <button className="btn btn-sm btn-secondary" onClick={onRefresh}>
            ↻ Refresh
          </button>
        </div>

        {/* Not connected */}
        {!isConnected && (
          <div className="connect-prompt">
            <div className="connect-icon">🏦</div>
            <div className="connect-title">No Wallet Connected</div>
            <div className="connect-sub">
              Connect your wallet to view your vaults
            </div>
          </div>
        )}

        {/* Wrong network */}
        {isConnected && isWrongNet && (
          <div className="connect-prompt">
            <div className="connect-icon">⚠️</div>
            <div className="connect-title">Wrong Network</div>
            <div className="connect-sub">
              Switch to Sepolia Testnet to view and manage your vaults
            </div>
            <button className="btn btn-primary" onClick={switchNetwork}>
              Switch to Sepolia
            </button>
          </div>
        )}

        {/* Loading skeletons */}
        {isConnected && isLoading && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div className="skeleton" style={{ height: 100 }} />
            <div className="skeleton" style={{ height: 100 }} />
          </div>
        )}

        {/* Empty */}
        {isConnected && !isLoading && vaults.length === 0 && (
          <div className="empty-state">
            <div className="empty-icon">🔓</div>
            <div className="empty-title">No Active Vaults</div>
            <div className="empty-sub">Create a deposit to get started</div>
          </div>
        )}

        {/* Vault cards - only show if connected and on correct network */}
        {isConnected && !isWrongNet && !isLoading && vaults.length > 0 && (
          <div className="vault-list">
            {vaults.map((v) => (
              <VaultCard
                key={v.id}
                vault={v}
                ethPrice={ethPrice}
                onWithdraw={setWithdrawVault}
                onDetails={showDetails}
              />
            ))}
          </div>
        )}

        {/* Withdraw all - only show if connected and on correct network */}
        {unlockedBalance > 0 && !isWrongNet && (
          <WithdrawAll
            unlockedBalance={unlockedBalance}
            unlockedCount={unlockedVaults.length}
            address={address}
            chainId={chainId}
            onSuccess={onSuccess}
            toast={toast}
          />
        )}
      </div>

      {/* Single withdraw modal */}
      <Modal
        isOpen={!!withdrawVault}
        onClose={() => !loading && setWithdrawVault(null)}
      >
        <div className="modal-title">⬆ Confirm Withdrawal</div>
        <div className="modal-subtitle">
          Withdrawing from Vault #{withdrawVault?.id}
        </div>
        <div className="modal-detail">
          <div className="modal-detail-row">
            <span className="modal-detail-key">Amount</span>
            <span className="modal-detail-val">
              {withdrawVault?.amount?.toFixed(4)} ETH
            </span>
          </div>
          <div className="modal-detail-row">
            <span className="modal-detail-key">Recipient</span>
            <span className="modal-detail-val">{truncateAddr(address)}</span>
          </div>
          <div className="modal-detail-row">
            <span className="modal-detail-key">Gas Est.</span>
            <span className="modal-detail-val">~0.0003 ETH</span>
          </div>
        </div>
        <div className="modal-actions">
          <button
            className="btn btn-secondary"
            style={{ flex: 1 }}
            onClick={() => setWithdrawVault(null)}
            disabled={loading}
          >
            Cancel
          </button>
          <button
            className="btn btn-success"
            style={{ flex: 2 }}
            onClick={executeWithdraw}
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="spinner" /> Withdrawing…
              </>
            ) : (
              "Confirm Withdrawal"
            )}
          </button>
        </div>
      </Modal>
    </>
  );
}
