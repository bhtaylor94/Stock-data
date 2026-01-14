// app/hooks/useRealtimeGreeks.ts
// React hook for subscribing to real-time options Greeks updates

import { useState, useEffect } from 'react';
import { schwabStream, OptionQuote } from '../../lib/schwabStream';

export interface RealtimeGreeks {
  symbol: string;
  price: number;
  bid: number;
  ask: number;
  volume: number;
  openInterest: number;
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
  rho: number;
  impliedVolatility: number;
  theoreticalValue: number;
  intrinsicValue: number;
  timeValue: number;
  daysToExpiration: number;
  lastUpdate: number;
}

export function useRealtimeGreeks(optionSymbol: string | null) {
  const [greeks, setGreeks] = useState<RealtimeGreeks | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);

  useEffect(() => {
    if (!optionSymbol) return;

    const upperSymbol = optionSymbol.toUpperCase();
    let isSubscribed = true;

    schwabStream.connect().then(connected => {
      if (!connected || !isSubscribed) return;

      const callback = (quote: OptionQuote) => {
        if (!isSubscribed) return;

        setGreeks({
          symbol: quote.symbol,
          price: quote.last || quote.bid || quote.ask || 0,
          bid: quote.bid,
          ask: quote.ask,
          volume: quote.volume,
          openInterest: quote.openInterest,
          delta: quote.delta,
          gamma: quote.gamma,
          theta: quote.theta,
          vega: quote.vega,
          rho: quote.rho,
          impliedVolatility: quote.impliedVolatility,
          theoreticalValue: quote.theoreticalValue,
          intrinsicValue: quote.intrinsicValue,
          timeValue: quote.timeValue,
          daysToExpiration: quote.daysToExpiration,
          lastUpdate: quote.timestamp,
        });

        setIsStreaming(true);
      };

      schwabStream.subscribeOption([upperSymbol], callback);
    });

    return () => {
      isSubscribed = false;
      schwabStream.unsubscribeOption([upperSymbol]);
    };
  }, [optionSymbol]);

  return { greeks, isStreaming };
}

// Hook for multiple options contracts
export function useRealtimeGreeksMultiple(optionSymbols: string[]) {
  const [greeksMap, setGreeksMap] = useState<Map<string, RealtimeGreeks>>(new Map());
  const [isStreaming, setIsStreaming] = useState(false);

  useEffect(() => {
    if (!optionSymbols || optionSymbols.length === 0) return;

    const upperSymbols = optionSymbols.map(s => s.toUpperCase());
    let isSubscribed = true;

    schwabStream.connect().then(connected => {
      if (!connected || !isSubscribed) return;

      const callback = (quote: OptionQuote) => {
        if (!isSubscribed) return;

        setGreeksMap(prev => {
          const next = new Map(prev);
          next.set(quote.symbol, {
            symbol: quote.symbol,
            price: quote.last || quote.bid || quote.ask || 0,
            bid: quote.bid,
            ask: quote.ask,
            volume: quote.volume,
            openInterest: quote.openInterest,
            delta: quote.delta,
            gamma: quote.gamma,
            theta: quote.theta,
            vega: quote.vega,
            rho: quote.rho,
            impliedVolatility: quote.impliedVolatility,
            theoreticalValue: quote.theoreticalValue,
            intrinsicValue: quote.intrinsicValue,
            timeValue: quote.timeValue,
            daysToExpiration: quote.daysToExpiration,
            lastUpdate: quote.timestamp,
          });
          return next;
        });

        setIsStreaming(true);
      };

      schwabStream.subscribeOption(upperSymbols, callback);
    });

    return () => {
      isSubscribed = false;
      schwabStream.unsubscribeOption(upperSymbols);
    };
  }, [optionSymbols.join(',')]);

  return { greeksMap, isStreaming };
}
