/**
 * web3mini.js — Zero-dependency Web3 helper.
 * Gas estimated via OUR direct RPC fetch, not the wallet's RPC.
 * This prevents MetaMask/Infura inflating gas on production (Vercel).
 * Selectors verified: keccak256("transfer(address,uint256)") = a9059cbb ✅
 */

const SEL = {
  deposit:            'b6b55f25',
  withdraw:           '2e1a7d4d',
  withdrawAll:        '853828b6',
  getVaultCount:      '77e1296e',
  getVault:           'd99d13f5',
  getActiveVaults:    '57c57f72',
  getTotalBalance:    'd3d38193',
  getUnlockedBalance: '129de5bf',
};

const RPCS = [
  'https://ethereum-sepolia-rpc.publicnode.com',
  'https://sepolia.drpc.org',
  'https://rpc2.sepolia.org',
  'https://rpc.sepolia.org',
];

function prov() {
  return window.__activeProvider || window.ethereum;
}

async function directRpc(method, params = []) {
  let lastErr;
  for (const url of RPCS) {
    try {
      const res  = await fetch(url, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method, params }),
      });
      const json = await res.json();
      if (json.error) {
        lastErr = new Error(json.error.message || JSON.stringify(json.error));
        // Revert = definitive answer, stop trying other RPCs
        if (json.error.code === 3 || (json.error.message || '').toLowerCase().includes('revert')) throw lastErr;
        continue;
      }
      return json.result;
    } catch (e) {
      lastErr = e;
      if ((e.message || '').toLowerCase().includes('revert')) throw e;
      console.warn(`RPC ${url}:`, e.message);
    }
  }
  throw lastErr || new Error('All Sepolia RPCs failed');
}

const walletRpc = (method, params = []) => prov().request({ method, params });

// ── ABI encoding ──
const strip0x = s => s.replace(/^0x/i, '');
const pad32   = s => strip0x(s).padStart(64, '0');
const encAddr = a => pad32(a.toLowerCase());
const encUint = n => pad32(BigInt(n).toString(16));

// ── ABI decoding ──
function decUint(hex, wi = 0) { return BigInt('0x' + hex.slice(wi*64, wi*64+64)); }
function decBool(hex, wi = 0) { return hex.slice(wi*64, wi*64+64) !== '0'.repeat(64); }
function decUintArray(hex, pi) {
  const wo = Number(decUint(hex, pi)) / 32;
  const len = Number(decUint(hex, wo));
  return Array.from({ length: len }, (_, i) => decUint(hex, wo + 1 + i));
}

// ── ETH / Wei ──
export function parseEther(ethStr) {
  const [whole = '0', frac = ''] = String(ethStr).split('.');
  return BigInt(whole) * 10n**18n + BigInt((frac + '0'.repeat(18)).slice(0, 18));
}
export function formatEther(wei) {
  const w = BigInt(wei);
  const e = w / 10n**18n;
  const r = w % 10n**18n;
  return `${e}.${r.toString().padStart(18,'0').replace(/0+$/,'')||'0'}`;
}
export function formatGwei(wei) { return (Number(BigInt(wei)) / 1e9).toFixed(1); }

// ── Revert reason ──
function revertReason(err) {
  const msg = err?.data?.message || err?.message || String(err);
  if (msg.includes('Vault already active'))  return 'You already have an active vault. Withdraw it first.';
  if (msg.includes('Funds are locked'))      return 'Vault is still locked — unlock time not reached yet.';
  if (msg.includes('No active vault'))       return 'No active vault found.';
  if (msg.includes('Invalid unlock time'))   return 'Invalid unlock time — must be between now and 1 year.';
  if (msg.includes('Must send ETH'))         return 'Amount must be greater than 0.';
  if (msg.includes('Nothing to withdraw'))   return 'No unlocked vaults to withdraw.';
  if (msg.includes('Invalid vault'))         return 'Invalid vault ID.';
  const m = msg.match(/execution reverted: (.+)/i) || msg.match(/reverted with reason string '(.+)'/i);
  if (m) return m[1].trim();
  return null;
}

// ── Gas estimation via OUR RPC — key fix for Vercel ──
// MetaMask on production (HTTPS) uses Infura which inflates payable gas estimates.
// We estimate via our own fetch RPC and pass the explicit gas value to the wallet.
// The wallet then uses OUR estimate instead of recalculating via Infura.
async function estimateGas(from, to, data, value = '0x0') {
  try {
    const raw = await directRpc('eth_estimateGas', [{ from, to, data, value }]);
    const est = BigInt(raw);
    // +30% buffer, capped at 500k
    const gas = est + (est * 30n / 100n);
    return '0x' + (gas > 500000n ? 500000n : gas).toString(16);
  } catch (err) {
    const reason = revertReason(err);
    if (reason) throw new Error(reason); // Contract would revert — show user why
    return '0x493E0'; // 300,000 fallback for network errors only
  }
}

async function sendTx(from, to, sel, params = '', value = '0x0') {
  const data = '0x' + sel + params;
  const gas  = await estimateGas(from, to, data, value);
  return walletRpc('eth_sendTransaction', [{ from, to, data, value, gas }]);
}

// ── Public API ──
export const requestAccounts = () => walletRpc('eth_requestAccounts');
export const getAccounts     = () => walletRpc('eth_accounts');
export const getChainId      = async () => parseInt(await walletRpc('eth_chainId'), 16);
export const getBlockNumber  = async () => parseInt(await directRpc('eth_blockNumber', []), 16);
export const getGasPrice     = async () => BigInt(await directRpc('eth_gasPrice', []));

export async function switchToSepolia() {
  try {
    await walletRpc('wallet_switchEthereumChain', [{ chainId: '0xaa36a7' }]);
  } catch (err) {
    if (err.code === 4902) {
      await walletRpc('wallet_addEthereumChain', [{
        chainId: '0xaa36a7', chainName: 'Sepolia Testnet',
        nativeCurrency: { name:'ETH', symbol:'ETH', decimals:18 },
        rpcUrls: ['https://rpc.sepolia.org'],
        blockExplorerUrls: ['https://sepolia.etherscan.io'],
      }]);
    } else throw err;
  }
}

export async function waitForReceipt(txHash, maxAttempts = 40) {
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise(r => setTimeout(r, 1500));
    try {
      const receipt = await directRpc('eth_getTransactionReceipt', [txHash]);
      if (receipt) { await new Promise(r => setTimeout(r, 1000)); return receipt; }
    } catch { /* keep polling */ }
  }
  throw new Error('Transaction timed out after 2 minutes');
}

export async function deposit(from, contract, unlockTimeSec, weiAmount) {
  return sendTx(from, contract, SEL.deposit, encUint(unlockTimeSec), '0x' + weiAmount.toString(16));
}
export async function withdraw(from, contract, vaultId) {
  return sendTx(from, contract, SEL.withdraw, encUint(vaultId));
}
export async function withdrawAll(from, contract) {
  return sendTx(from, contract, SEL.withdrawAll, '');
}

async function ethCall(to, sel, params = '') {
  return directRpc('eth_call', [{ to, data: '0x' + sel + params }, 'latest']);
}

export async function getActiveVaults(contract, userAddr) {
  const raw = await ethCall(contract, SEL.getActiveVaults, encAddr(userAddr));
  if (!raw || raw === '0x' || /^0x0*$/.test(raw)) return [[], [], []];
  const hex = strip0x(raw);
  try { return [decUintArray(hex,0), decUintArray(hex,1), decUintArray(hex,2)]; }
  catch (e) { console.error('getActiveVaults decode:', e); return [[],[],[]]; }
}

export async function getVault(contract, userAddr, vaultId) {
  const raw = await ethCall(contract, SEL.getVault, encAddr(userAddr) + encUint(vaultId));
  if (!raw || raw === '0x') return null;
  const hex = strip0x(raw);
  return { amount: decUint(hex,0), unlockTime: decUint(hex,1), active: decBool(hex,2), isUnlocked: decBool(hex,3) };
}

export async function getTotalBalance(contract, userAddr) {
  const raw = await ethCall(contract, SEL.getTotalBalance, encAddr(userAddr));
  return raw && raw !== '0x' ? decUint(strip0x(raw), 0) : 0n;
}

export async function getVaultCount(contract, userAddr) {
  const raw = await ethCall(contract, SEL.getVaultCount, encAddr(userAddr));
  return raw && raw !== '0x' ? Number(decUint(strip0x(raw), 0)) : 0;
}
