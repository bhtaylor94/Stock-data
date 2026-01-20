import type { Metadata } from 'next'
import './globals.css'
import { StreamProvider } from './contexts/StreamContext'
import AppShell from './components/shell/AppShell'

export const metadata: Metadata = {
  title: 'Strategy Automation Trading Platform',
  description: 'Strategy-first signal → gate → execute → manage → reconcile platform (broker-truth aligned).',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="bg-slate-950 text-slate-100">
        <StreamProvider>
          <AppShell>{children}</AppShell>
        </StreamProvider>
      </body>
    </html>
  )
}
