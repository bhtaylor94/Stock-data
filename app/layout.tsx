import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { StreamProvider } from './contexts/StreamContext'

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' })

export const metadata: Metadata = {
  title: 'AI Hedge Fund - Stock & Options Analysis',
  description: 'Real-time stock analysis with fundamentals, technical indicators, and options intelligence',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={`${inter.variable} font-sans antialiased bg-slate-950 text-slate-100`}>
        <StreamProvider>
          {children}
        </StreamProvider>
      </body>
    </html>
  )
}
