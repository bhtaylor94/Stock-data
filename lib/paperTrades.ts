export type PaperTradeMode = 'PAPER';

export type PaperTrade = {
  id: string;
  createdAt: string;
  symbol: string;
  companyName?: string;
  instrument: 'STOCK' | 'OPTION';
  side: 'BUY' | 'SELL';
  // Options
  optionType?: 'CALL' | 'PUT';
  strike?: number;
  expiration?: string;
  // Sizing
  quantity: number; // shares or contracts
  entryPrice: number; // per share or per option (not x100)
  // Context
  confidence?: number;
  reasons?: string[];
  invalidation?: string;
};

const STORAGE_KEY = 'aihf.paperTrades.v1';

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try { return JSON.parse(raw) as T; } catch { return fallback; }
}

export function getPaperTrades(): PaperTrade[] {
  if (typeof window === 'undefined') return [];
  return safeParse<PaperTrade[]>(window.localStorage.getItem(STORAGE_KEY), []);
}

export function savePaperTrades(trades: PaperTrade[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(trades));
}

export function addPaperTrade(trade: Omit<PaperTrade, 'id' | 'createdAt'>): PaperTrade {
  const next: PaperTrade = {
    id: 'pt_' + Math.random().toString(36).slice(2) + Date.now().toString(36),
    createdAt: new Date().toISOString(),
    ...trade,
  };
  const trades = getPaperTrades();
  trades.unshift(next);
  savePaperTrades(trades);
  return next;
}

export function removePaperTrade(id: string) {
  const trades = getPaperTrades().filter(t => t.id !== id);
  savePaperTrades(trades);
}
