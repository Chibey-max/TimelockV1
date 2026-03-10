/**
 * web3mini.js — Zero-dependency Web3 helper.
 *
 * Supports ANY EVM wallet (MetaMask, Rabby, Coinbase, Brave, etc.)
 * via window.__activeProvider set by useWallet on connect.
 *
 * Selectors verified via Python keccak256:
 *   keccak256("") = c5d2460186f7...  ✅
 *   keccak256("transfer(address,uint256)") = a9059cbb  ✅
 */

// ── Verified function selectors ──
const SEL = {
  deposit: "b6b55f25", // deposit(uint256)
  withdraw: "2e1a7d4d", // withdraw(uint256)
  withdrawAll: "853828b6", // withdrawAll()
  getVaultCount: "77e1296e", // getVaultCount(address)
  getVault: "d99d13f5", // getVault(address,uint256)
  getActiveVaults: "57c57f72", // getActiveVaults(address)
  getTotalBalance: "d3d38193", // getTotalBalance(address)
  getUnlockedBalance: "129de5bf", // getUnlockedBalance(address)
};

// ── Use whichever wallet the user connected ──
function prov() {
  return window.__activeProvider || window.ethereum;
}

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

// ── RPC ──
const rpc = (method, params = []) => prov().request({ method, params });

const ethCall = (to, sel, params = "") =>
  rpc("eth_call", [{ to, data: "0x" + sel + params }, "latest"]);

// ── Gas estimation with 40% buffer ──
// Why 40%? Solidity loops (used in getActiveVaults, withdrawAll) have
// unpredictable gas costs based on array length. 40% covers edge cases
// without being wasteful. Unspent gas is always refunded.
async function estimateGas(from, to, sel, params, value = "0x0") {
  try {
    const raw = await rpc("eth_estimateGas", [
      {
        from,
        to,
        data: "0x" + sel + params,
        value,
      },
    ]);
    const estimated = BigInt(raw);
    const buffered = estimated + (estimated * 40n) / 100n; // +40%
    return "0x" + buffered.toString(16);
  } catch (err) {
    // Estimation reverted = tx will fail for a real reason (e.g. "Vault already active")
    // Re-throw so the UI can show the actual error message to the user
    const msg = err?.data?.message || err?.message || "";
    if (msg.includes("revert") || msg.includes("execution")) {
      throw new Error(extractRevertReason(msg));
    }
    // Non-revert estimation failure: use a safe fallback
    console.warn("Gas estimation failed, using fallback:", msg);
    return "0x30D40"; // 200,000 — safely covers all vault operations
  }
}

// Pull the human-readable reason out of a revert message
function extractRevertReason(msg) {
  const patterns = [
    /execution reverted: (.+)/i,
    /revert (.+)/i,
    /reverted with reason string '(.+)'/i,
  ];
  for (const p of patterns) {
    const m = msg.match(p);
    if (m) return m[1].trim();
  }
  if (msg.includes("Vault already active"))
    return "You already have an active vault";
  if (msg.includes("Funds are locked"))
    return "Vault is still locked — unlock time not reached";
  if (msg.includes("No active vault")) return "No active vault found";
  if (msg.includes("Invalid unlock time"))
    return "Unlock time must be between now and 1 year from now";
  if (msg.includes("Must send ETH")) return "Amount must be greater than 0";
  return msg.slice(0, 120) || "Transaction would fail — check your inputs";
}

async function sendTx(from, to, sel, params = "", value = "0x0") {
  const gas = await estimateGas(from, to, sel, params, value);
  return rpc("eth_sendTransaction", [
    {
      from,
      to,
      data: "0x" + sel + params,
      value,
      gas,
    },
  ]);
}

// ── Account / chain ──
export const requestAccounts = () => rpc("eth_requestAccounts");
export const getAccounts = () => rpc("eth_accounts");
export const getChainId = async () => parseInt(await rpc("eth_chainId"), 16);
export const getBlockNumber = async () =>
  parseInt(await rpc("eth_blockNumber"), 16);
export const getGasPrice = async () => BigInt(await rpc("eth_gasPrice"));

// ── Network switching ──
export async function switchToSepolia() {
  try {
    await rpc("wallet_switchEthereumChain", [{ chainId: "0xaa36a7" }]);
  } catch (err) {
    if (err.code === 4902) {
      await rpc("wallet_addEthereumChain", [
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

// ── Wait for tx confirmation ──
export async function waitForReceipt(txHash, maxAttempts = 60) {
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const receipt = await rpc("eth_getTransactionReceipt", [txHash]);
    if (receipt) {
      await new Promise((r) => setTimeout(r, 3000)); // let node state settle
      return receipt;
    }
  }
  throw new Error("Transaction timed out after 2 minutes");
}

// ── Write methods ──
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

// ── Read methods ──
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
