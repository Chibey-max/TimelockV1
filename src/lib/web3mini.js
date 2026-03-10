/**
 * web3mini.js — Zero-dependency Web3 helper.
 * Supports ANY EVM wallet via window.__activeProvider.
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

// ── Revert reason extractor ──
function extractRevertReason(err) {
  const msg =
    err?.data?.message || err?.data?.data || err?.message || String(err);
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
  if (msg.includes("Invalid vault ID")) return "Invalid vault ID.";
  // Generic revert
  const m =
    msg.match(/execution reverted: (.+)/i) ||
    msg.match(/reverted with reason string '(.+)'/i);
  if (m) return m[1].trim();
  return null; // no known reason — let caller decide
}

// Gas constants kept for reference only - do NOT send in transactions
// Let wallet calculate gas natively to avoid false insufficient funds errors
const GAS_LIMITS = {
  deposit: "0x27100", // 160,000
  withdraw: "0x186A0", // 100,000
  withdrawAll: "0x30D40", // 200,000
};

// Before sending, do a dry-run eth_call to catch reverts with zero gas cost
async function dryRun(from, to, sel, params, value = "0x0") {
  try {
    await rpc("eth_call", [
      { from, to, data: "0x" + sel + params, value },
      "latest",
    ]);
  } catch (err) {
    const reason = extractRevertReason(err);
    if (reason) throw new Error(reason);
    // eth_call can fail for non-revert reasons (e.g. node quirks) — ignore those
  }
}

async function sendTx(
  from,
  to,
  sel,
  params = "",
  value = "0x0",
  gasKey = "deposit",
) {
  // Send transaction WITHOUT gas field - let wallet estimate natively
  // This prevents false "insufficient funds" errors on Sepolia
  // Note: Removed dryRun eth_call as it can cause issues on some RPCs
  return rpc("eth_sendTransaction", [
    {
      from,
      to,
      data: "0x" + sel + params,
      value,
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

// ── Wait for confirmation ──
export async function waitForReceipt(txHash, maxAttempts = 60) {
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const receipt = await rpc("eth_getTransactionReceipt", [txHash]);
    if (receipt) {
      await new Promise((r) => setTimeout(r, 3000));
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
    "deposit",
  );
}
export async function withdraw(from, contract, vaultId) {
  return sendTx(
    from,
    contract,
    SEL.withdraw,
    encUint(vaultId),
    "0x0",
    "withdraw",
  );
}
export async function withdrawAll(from, contract) {
  return sendTx(from, contract, SEL.withdrawAll, "", "0x0", "withdrawAll");
}

// ── Reads ──
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
