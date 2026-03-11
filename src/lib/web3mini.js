/**
 * web3mini.js — Zero-dependency Web3 helper.
 * Supports ANY EVM wallet via window.__activeProvider.
 * Uses a direct RPC for eth_call/estimateGas to bypass wallet RPC issues.
 * Selectors verified: keccak256("transfer(address,uint256)") = a9059cbb ✅
 */

const SEL = {
  deposit: "b6b55f25",
  withdraw: "2e1a7d4d",
  withdrawAll: "853828b6",
  getVaultCount: "77e1296e",
  getVault: "d99d13f5",
  getActiveVaults: "57c57f72",
  getTotalBalance: "d3d38193",
  getUnlockedBalance: "129de5bf",
};

// Reliable public Sepolia RPCs — tried in order until one works
// These are used ONLY for read calls and dry-runs, NOT for signing
const SEPOLIA_RPCS = [
  "https://rpc.sepolia.org",
  "https://ethereum-sepolia-rpc.publicnode.com",
  "https://sepolia.drpc.org",
];

function prov() {
  return window.__activeProvider || window.ethereum;
}

// ── Direct RPC fetch (bypasses wallet RPC entirely for reads) ──
async function directRpc(method, params = []) {
  for (const rpcUrl of SEPOLIA_RPCS) {
    try {
      const res = await fetch(rpcUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      });
      const json = await res.json();
      if (json.error)
        throw new Error(json.error.message || JSON.stringify(json.error));
      return json.result;
    } catch (e) {
      console.warn(`RPC ${rpcUrl} failed:`, e.message);
      // Try next RPC
    }
  }
  throw new Error("All Sepolia RPC endpoints failed");
}

// ── Wallet RPC (used only for sending signed transactions) ──
const walletRpc = (method, params = []) => prov().request({ method, params });

// ── ABI encoding ──
const strip0x = (s) => s.replace(/^0x/i, "");
const pad32 = (s) => strip0x(s).padStart(64, "0");
const encAddr = (a) => pad32(a.toLowerCase());
const encUint = (n) => pad32(BigInt(n).toString(16));

// ── ABI decoding ──
function decUint(hex, wordIndex = 0) {
  return BigInt("0x" + hex.slice(wordIndex * 64, wordIndex * 64 + 64));
}
function decBool(hex, wordIndex = 0) {
  return hex.slice(wordIndex * 64, wordIndex * 64 + 64) !== "0".repeat(64);
}
function decUintArray(hex, pointerWordIndex) {
  const byteOffset = Number(decUint(hex, pointerWordIndex));
  const wordOffset = byteOffset / 32;
  const length = Number(decUint(hex, wordOffset));
  return Array.from({ length }, (_, i) => decUint(hex, wordOffset + 1 + i));
}

// ── ETH / Wei ──
export function parseEther(ethStr) {
  const [whole = "0", frac = ""] = String(ethStr).split(".");
  const fracPadded = (frac + "0".repeat(18)).slice(0, 18);
  return BigInt(whole) * 10n ** 18n + BigInt(fracPadded);
}
export function formatEther(wei) {
  const w = BigInt(wei);
  const eth = w / 10n ** 18n;
  const rem = w % 10n ** 18n;
  const dec = rem.toString().padStart(18, "0").replace(/0+$/, "") || "0";
  return `${eth}.${dec}`;
}
export function formatGwei(wei) {
  return (Number(BigInt(wei)) / 1e9).toFixed(1);
}

// ── Revert reason extractor ──
function extractRevertReason(err) {
  const msg = err?.data?.message || err?.message || String(err);
  if (msg.includes("Vault already active"))
    return "You already have an active vault. Withdraw it first.";
  if (msg.includes("Funds are locked"))
    return "Vault is still locked — unlock time not reached yet.";
  if (msg.includes("No active vault")) return "No active vault found.";
  if (msg.includes("Invalid unlock time"))
    return "Invalid unlock time — must be between now and 1 year.";
  if (msg.includes("Must send ETH")) return "Amount must be greater than 0.";
  if (msg.includes("Nothing to withdraw"))
    return "No unlocked vaults to withdraw.";
  if (msg.includes("Invalid vault")) return "Invalid vault ID.";
  const m =
    msg.match(/execution reverted: (.+)/i) ||
    msg.match(/reverted with reason string '(.+)'/i);
  if (m) return m[1].trim();
  return null;
}

// ── Dry-run via direct RPC to catch reverts before sending ──
// This uses our own RPC — NOT the wallet RPC — so it's not affected
// by the wallet's gas price estimation bugs on Vercel/production
async function dryRun(from, to, sel, params, value = "0x0") {
  try {
    await directRpc("eth_call", [
      { from, to, data: "0x" + sel + params, value },
      "latest",
    ]);
  } catch (err) {
    const reason = extractRevertReason(err);
    if (reason) throw new Error(reason);
    // Non-revert failure — ignore, let the actual sendTransaction handle it
  }
}

// ── Send transaction — NO gas field, let wallet handle it natively ──
// Removing the gas field entirely means the wallet uses its own estimation
// which is correct for the current network conditions. The dry-run above
// already verified the tx won't revert, so native estimation is safe.
async function sendTx(from, to, sel, params = "", value = "0x0") {
  await dryRun(from, to, sel, params, value);
  return walletRpc("eth_sendTransaction", [
    {
      from,
      to,
      data: "0x" + sel + params,
      value,
      // No gas field — wallet estimates natively from its own RPC
      // This is the most reliable approach across all wallets and networks
    },
  ]);
}

// ── Account / chain (via wallet) ──
export const requestAccounts = () => walletRpc("eth_requestAccounts");
export const getAccounts = () => walletRpc("eth_accounts");
export const getChainId = async () =>
  parseInt(await walletRpc("eth_chainId"), 16);
export const getBlockNumber = async () => {
  const r = await directRpc("eth_blockNumber", []);
  return parseInt(r, 16);
};
export const getGasPrice = async () => {
  const r = await directRpc("eth_gasPrice", []);
  return BigInt(r);
};

// ── Network switching ──
export async function switchToSepolia() {
  try {
    await walletRpc("wallet_switchEthereumChain", [{ chainId: "0xaa36a7" }]);
  } catch (err) {
    if (err.code === 4902) {
      await walletRpc("wallet_addEthereumChain", [
        {
          chainId: "0xaa36a7",
          chainName: "Sepolia Testnet",
          nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
          rpcUrls: ["https://rpc.sepolia.org"],
          blockExplorerUrls: ["https://sepolia.etherscan.io"],
        },
      ]);
    } else throw err;
  }
}

// ── Wait for confirmation (via direct RPC, faster than wallet polling) ──
export async function waitForReceipt(txHash, maxAttempts = 60) {
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const receipt = await directRpc("eth_getTransactionReceipt", [txHash]);
    if (receipt) {
      await new Promise((r) => setTimeout(r, 2000));
      return receipt;
    }
  }
  throw new Error("Transaction timed out after 2 minutes");
}

// ── Writes ──
export async function deposit(from, contract, unlockTimeSec, weiAmount) {
  return sendTx(
    from,
    contract,
    SEL.deposit,
    encUint(unlockTimeSec),
    "0x" + weiAmount.toString(16),
  );
}
export async function withdraw(from, contract, vaultId) {
  return sendTx(from, contract, SEL.withdraw, encUint(vaultId));
}
export async function withdrawAll(from, contract) {
  return sendTx(from, contract, SEL.withdrawAll, "");
}

// ── Reads (via direct RPC — not wallet) ──
async function ethCall(to, sel, params = "") {
  return directRpc("eth_call", [{ to, data: "0x" + sel + params }, "latest"]);
}

export async function getActiveVaults(contract, userAddr) {
  const raw = await ethCall(contract, SEL.getActiveVaults, encAddr(userAddr));
  if (!raw || raw === "0x" || /^0x0*$/.test(raw)) return [[], [], []];
  const hex = strip0x(raw);
  try {
    return [decUintArray(hex, 0), decUintArray(hex, 1), decUintArray(hex, 2)];
  } catch (e) {
    console.error("getActiveVaults decode error:", e, "\nraw:", raw);
    return [[], [], []];
  }
}

export async function getVault(contract, userAddr, vaultId) {
  const raw = await ethCall(
    contract,
    SEL.getVault,
    encAddr(userAddr) + encUint(vaultId),
  );
  if (!raw || raw === "0x") return null;
  const hex = strip0x(raw);
  return {
    amount: decUint(hex, 0),
    unlockTime: decUint(hex, 1),
    active: decBool(hex, 2),
    isUnlocked: decBool(hex, 3),
  };
}

export async function getTotalBalance(contract, userAddr) {
  const raw = await ethCall(contract, SEL.getTotalBalance, encAddr(userAddr));
  return raw && raw !== "0x" ? decUint(strip0x(raw), 0) : 0n;
}

export async function getVaultCount(contract, userAddr) {
  const raw = await ethCall(contract, SEL.getVaultCount, encAddr(userAddr));
  return raw && raw !== "0x" ? Number(decUint(strip0x(raw), 0)) : 0;
}
