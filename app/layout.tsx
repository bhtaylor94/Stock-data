import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AI Hedge Fund | Multi-Agent Investment Analysis',
  description: 'Real-time multi-agent investment analysis with 12 legendary investor personalities, live market data, and Greeks-based options intelligence.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
