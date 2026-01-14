// app/hooks/useRealtimePrice.ts
// React hook for subscribing to real-time stock price updates

import { useState, useEffect, useRef } from 'react';
import { schwabStream, EquityQuote, OptionQuote } from '../../lib/schwabStream';

export interface RealtimePrice {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  bid: number;
  ask: number;
  volume: number;
  high: number;
  low: number;
  open: number;
  lastUpdate: number;
}

export function useRealtimePrice(symbol: string | null, initialPrice?: number) {
  const [price, setPrice] = useState<RealtimePrice | null>(() => {
    if (symbol && initialPrice) {
      return {
        symbol: symbol.toUpperCase(),
        price: initialPrice,
        change: 0,
        changePercent: 0,
        bid: initialPrice,
        ask: initialPrice,
        volume: 0,
        high: initialPrice,
        low: initialPrice,
        open: initialPrice,
        lastUpdate: Date.now(),
      };
    }
    return null;
  });

  const [isStreaming, setIsStreaming] = useState(false);
  const prevPriceRef = useRef<number>(initialPrice || 0);

  useEffect(() => {
    if (!symbol) return;

    const upperSymbol = symbol.toUpperCase();
    let isSubscribed = true;

    // Connect if not already connected
    schwabStream.connect().then(connected => {
      if (!connected || !isSubscribed) return;

      // Subscribe to updates
      const callback = (quote: EquityQuote | OptionQuote) => {
        if (!isSubscribed) return;

        // Type guard: ensure it's an EquityQuote
        if (!('high' in quote)) return;

        const currentPrice = quote.last || quote.bid || quote.ask || 0;
        const prevPrice = prevPriceRef.current || currentPrice;
        const change = currentPrice - prevPrice;
        const changePercent = prevPrice > 0 ? (change / prevPrice) * 100 : 0;

        setPrice({
          symbol: quote.symbol,
          price: currentPrice,
          change: Math.round(change * 100) / 100,
          changePercent: Math.round(changePercent * 100) / 100,
          bid: quote.bid,
          ask: quote.ask,
          volume: quote.volume,
          high: quote.high,
          low: quote.low,
          open: quote.open,
          lastUpdate: quote.timestamp,
        });

        setIsStreaming(true);
      };

      schwabStream.subscribeEquity([upperSymbol], callback);

      // Store initial price
      if (initialPrice) {
        prevPriceRef.current = initialPrice;
      }
    });

    // Cleanup
    return () => {
      isSubscribed = false;
      schwabStream.unsubscribeEquity([upperSymbol]);
    };
  }, [symbol, initialPrice]);

  return { price, isStreaming };
}

// Hook for multiple symbols
export function useRealtimePrices(symbols: string[]) {
  const [prices, setPrices] = useState<Map<string, RealtimePrice>>(new Map());
  const [isStreaming, setIsStreaming] = useState(false);

  useEffect(() => {
    if (!symbols || symbols.length === 0) return;

    const upperSymbols = symbols.map(s => s.toUpperCase());
    let isSubscribed = true;

    schwabStream.connect().then(connected => {
      if (!connected || !isSubscribed) return;

      const callback = (quote: EquityQuote | OptionQuote) => {
        if (!isSubscribed) return;

        // Type guard: ensure it's an EquityQuote
        if (!('high' in quote)) return;

        const currentPrice = quote.last || quote.bid || quote.ask || 0;
        
        setPrices(prev => {
          const next = new Map(prev);
          const existing = next.get(quote.symbol);
          const prevPrice = existing?.price || currentPrice;
          const change = currentPrice - prevPrice;
          const changePercent = prevPrice > 0 ? (change / prevPrice) * 100 : 0;

          next.set(quote.symbol, {
            symbol: quote.symbol,
            price: currentPrice,
            change: Math.round(change * 100) / 100,
            changePercent: Math.round(changePercent * 100) / 100,
            bid: quote.bid,
            ask: quote.ask,
            volume: quote.volume,
            high: quote.high,
            low: quote.low,
            open: quote.open,
            lastUpdate: quote.timestamp,
          });

          return next;
        });

        setIsStreaming(true);
      };

      schwabStream.subscribeEquity(upperSymbols, callback);
    });

    return () => {
      isSubscribed = false;
      schwabStream.unsubscribeEquity(upperSymbols);
    };
  }, [symbols.join(',')]);

  return { prices, isStreaming };
}
