'use client';
import { useState, useEffect } from 'react';
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, BarElement,
  Title, Tooltip, Legend,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

export default function VaultChart({ vaults, ethPrice }) {
  const [chartType, setChartType] = useState('balance');
  const [isDark,    setIsDark]    = useState(true);

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.getAttribute('data-theme') !== 'light');
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);

  const now        = Date.now();
  const gridColor  = isDark ? 'rgba(30,48,80,0.8)' : 'rgba(180,200,230,0.5)';
  const textColor  = isDark ? '#7a92b3' : '#3d5c85';

  const labels     = vaults.length ? vaults.map(v => `#${v.id}`) : ['No Vaults'];
  const amounts    = vaults.length ? vaults.map(v => v.amount)   : [0];
  const daysLeft   = vaults.length ? vaults.map(v => Math.max(0, Math.round((v.unlockTime - now) / 86400000))) : [0];
  const bgColors   = vaults.length ? vaults.map(v => now >= v.unlockTime ? 'rgba(34,197,94,0.6)' : 'rgba(245,166,35,0.6)') : ['rgba(30,48,80,0.4)'];
  const borderClrs = vaults.length ? vaults.map(v => now >= v.unlockTime ? '#22c55e' : '#f5a623') : ['#1e3050'];

  const data = {
    labels,
    datasets: [{
      label: chartType === 'balance' ? 'ETH Balance' : 'Days to Unlock',
      data: chartType === 'balance' ? amounts : daysLeft,
      backgroundColor: bgColors,
      borderColor: borderClrs,
      borderWidth: 1.5,
      borderRadius: 6,
    }],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(13,21,38,0.95)',
        borderColor: '#f5a623', borderWidth: 1,
        titleColor: '#e8edf5', bodyColor: '#7a92b3', padding: 10,
        callbacks: {
          label: ctx => chartType === 'balance'
            ? ` ${Number(ctx.raw).toFixed(4)} ETH${ethPrice ? '  ($' + (Number(ctx.raw) * ethPrice).toLocaleString() + ')' : ''}`
            : ` ${ctx.raw} days remaining`,
        },
      },
    },
    scales: {
      x: { grid: { color: gridColor }, ticks: { color: textColor, font: { family: 'JetBrains Mono', size: 11 } } },
      y: { grid: { color: gridColor }, ticks: { color: textColor, font: { family: 'JetBrains Mono', size: 11 } } },
    },
  };

  return (
    <div className="card" style={{ marginBottom: 20 }}>
      <div className="card-title" style={{ justifyContent: 'space-between' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          Vault Timeline
        </span>
        <div className="tab-group" style={{ marginBottom: 0, width: 'auto' }}>
          <button
            className={`tab${chartType === 'balance' ? ' active' : ''}`}
            onClick={() => setChartType('balance')}
          >
            Balance
          </button>
          <button
            className={`tab${chartType === 'timeline' ? ' active' : ''}`}
            onClick={() => setChartType('timeline')}
          >
            Unlock
          </button>
        </div>
      </div>
      <div style={{ height: 180, position: 'relative' }}>
        <Bar data={data} options={options} />
      </div>
    </div>
  );
}
