'use client';
import React, { createContext, useContext } from 'react';
import { useStream, StreamStatus, StreamMessage } from '@/lib/streamClient';

interface StreamContextValue {
  status: StreamStatus;
  lastMessage: StreamMessage | null;
  subscribe: (service: string) => void;
  unsubscribe: (service: string) => void;
  connect: () => void;
  disconnect: () => void;
}

const StreamContext = createContext<StreamContextValue>({
  status: 'disconnected',
  lastMessage: null,
  subscribe: () => {},
  unsubscribe: () => {},
  connect: () => {},
  disconnect: () => {},
});

export function StreamProvider({ children }: { children: React.ReactNode }) {
  const stream = useStream();
  return (
    <StreamContext.Provider value={stream}>
      {children}
    </StreamContext.Provider>
  );
}

export function useStreamContext() {
  return useContext(StreamContext);
}
