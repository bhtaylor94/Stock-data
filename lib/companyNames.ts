// lib/companyNames.ts
// Lightweight ticker -> company name map used by UI components.
// Keep this intentionally small; UI falls back to ticker when missing.

export const COMPANY_NAMES: Record<string, string> = {
  AAPL: 'Apple Inc.',
  MSFT: 'Microsoft Corp.',
  NVDA: 'NVIDIA Corp.',
  AMZN: 'Amazon.com, Inc.',
  GOOGL: 'Alphabet Inc. (Class A)',
  GOOG: 'Alphabet Inc. (Class C)',
  META: 'Meta Platforms, Inc.',
  TSLA: 'Tesla, Inc.',
  SPY: 'SPDR S&P 500 ETF Trust',
  QQQ: 'Invesco QQQ Trust',
  IWM: 'iShares Russell 2000 ETF',
  DIA: 'SPDR Dow Jones Industrial Average ETF Trust',
  VTI: 'Vanguard Total Stock Market ETF',
  VOO: 'Vanguard S&P 500 ETF',
};
