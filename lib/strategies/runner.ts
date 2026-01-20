export async function runStrategiesForSymbol(symbol: string) {
  // Placeholder deterministic signal
  return {
    symbol,
    action: "NO_TRADE",
    confidence: 0,
    strategy: "NONE",
    reasons: [],
    scannedAt: Date.now()
  };
}
