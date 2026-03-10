import './globals.css';

export const metadata = {
  title: 'TimelockedVault — Secure ETH Time-Locks',
  description: 'Lock ETH on-chain until a future date with TimelockedVault',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
