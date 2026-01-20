export async function runStrategiesForSymbol(symbol: string) {
  return {
    symbol,
    action: "NO_TRADE",
    confidence: 0,
    reasons: [],
    scannedAt: Date.now()
  };
}
