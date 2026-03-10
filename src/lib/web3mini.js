/**
 * web3mini.js — Zero-dependency Web3 helper using window.ethereum.
 * Selectors verified via correct Keccak-256 against known test vectors:
 *   keccak256("") = c5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470 ✅
 *   keccak256("transfer(address,uint256)") = a9059cbb ✅
 */

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
const rpc = (method, params = []) =>
  window.ethereum.request({ method, params });
const ethCall = (to, sel, params = "") =>
  rpc("eth_call", [{ to, data: "0x" + sel + params }, "latest"]);
const sendTx = (from, to, sel, params = "", value = "0x0") =>
  rpc("eth_sendTransaction", [{ from, to, data: "0x" + sel + params, value }]);

export const requestAccounts = () => rpc("eth_requestAccounts");
export const getAccounts = () => rpc("eth_accounts");
export const getChainId = async () => parseInt(await rpc("eth_chainId"), 16);
export const getBlockNumber = async () =>
  parseInt(await rpc("eth_blockNumber"), 16);
export const getGasPrice = async () => BigInt(await rpc("eth_gasPrice"));

export async function waitForReceipt(txHash, maxAttempts = 60) {
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const receipt = await rpc("eth_getTransactionReceipt", [txHash]);
    if (receipt) {
      await new Promise((r) => setTimeout(r, 3000));
      return receipt;
    }
  }
  throw new Error("Transaction timed out");
}

// ── Writes ──
export function deposit(from, contract, unlockTimeSec, weiAmount) {
  return sendTx(
    from,
    contract,
    SEL.deposit,
    encUint(unlockTimeSec),
    "0x" + weiAmount.toString(16),
  );
}
export function withdraw(from, contract, vaultId) {
  return sendTx(from, contract, SEL.withdraw, encUint(vaultId));
}
export function withdrawAll(from, contract) {
  return sendTx(from, contract, SEL.withdrawAll, "");
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
