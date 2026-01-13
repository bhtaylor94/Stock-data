// app/contexts/StreamContext.tsx
// React context for managing global streaming state

'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { schwabStream } from '../../lib/schwabStream';

interface StreamContextValue {
  isConnected: boolean;
  isConnecting: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
  subscriptions: {
    equities: string[];
    options: string[];
    accounts: string[];
  };
}

const StreamContext = createContext<StreamContextValue | null>(null);

export function StreamProvider({ children }: { children: ReactNode }) {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [subscriptions, setSubscriptions] = useState({
    equities: [] as string[],
    options: [] as string[],
    accounts: [] as string[],
  });

  useEffect(() => {
    // Listen for connection changes
    const unsubscribe = schwabStream.onConnectionChange(connected => {
      setIsConnected(connected);
      setIsConnecting(false);

      // Update subscriptions list
      if (connected) {
        setSubscriptions(schwabStream.getSubscriptions());
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const connect = async () => {
    setIsConnecting(true);
    await schwabStream.connect();
  };

  const disconnect = () => {
    schwabStream.disconnect();
  };

  return (
    <StreamContext.Provider
      value={{
        isConnected,
        isConnecting,
        connect,
        disconnect,
        subscriptions,
      }}
    >
      {children}
    </StreamContext.Provider>
  );
}

export function useStream() {
  const context = useContext(StreamContext);
  if (!context) {
    throw new Error('useStream must be used within StreamProvider');
  }
  return context;
}

// Hook for components that just need to know connection status
export function useStreamingStatus() {
  const { isConnected, isConnecting } = useStream();
  return { isConnected, isConnecting };
}
