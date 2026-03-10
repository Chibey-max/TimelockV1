export function truncateAddr(addr) {
  if (!addr) return '';
  return addr.slice(0, 6) + '…' + addr.slice(-4);
}

export function formatDate(ts) {
  return new Date(ts).toLocaleDateString('en-US', {
    month:  'short',
    day:    'numeric',
    year:   'numeric',
    hour:   '2-digit',
    minute: '2-digit',
  });
}

export function formatCountdown(ts) {
  const diff = ts - Date.now();
  if (diff <= 0) return 'Now';
  const days  = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const mins  = Math.floor((diff % 3600000)  / 60000);
  if (days  > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

export function calcProgress(depositTime, unlockTime) {
  const now = Date.now();
  if (now >= unlockTime) return 100;
  if (now <= depositTime) return 0;
  return Math.min(100, Math.max(0,
    ((now - depositTime) / (unlockTime - depositTime)) * 100,
  ));
}

export function setDatetimeLocal(el, ms) {
  const d = new Date(ms);
  el.value = new Date(d - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

export function datetimeLocalToMs(val) {
  return new Date(val).getTime();
}
