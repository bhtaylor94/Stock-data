'use client';
import { useState, useRef, useEffect, useCallback } from 'react';

// TODO: Set WS_URL to your home server WebSocket proxy when ready
// Proxy should authenticate with Schwab and forward stream messages
export const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? null;

export type StreamStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface StreamMessage {
  service: string;
  timestamp: number;
  data: unknown;
}

const BACKOFF_MS = [1000, 2000, 4000, 8000, 15000, 30000];

export function useStream() {
  const [status, setStatus] = useState<StreamStatus>('disconnected');
  const [lastMessage, setLastMessage] = useState<StreamMessage | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const retryRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const subscriptionsRef = useRef<Set<string>>(new Set());

  const disconnect = useCallback(() => {
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.onclose = null;
      wsRef.current.close();
      wsRef.current = null;
    }
    setStatus('disconnected');
    retryRef.current = 0;
  }, []);

  const connect = useCallback(() => {
    if (!WS_URL) return;
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    setStatus('connecting');
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      setStatus('connected');
      retryRef.current = 0;
      if (subscriptionsRef.current.size > 0) {
        ws.send(JSON.stringify({
          type: 'subscribe',
          services: Array.from(subscriptionsRef.current),
        }));
      }
    };

    ws.onmessage = (event) => {
      try {
        const msg: StreamMessage = JSON.parse(event.data as string);
        setLastMessage(msg);
      } catch {
        // ignore malformed messages
      }
    };

    ws.onerror = () => {
      setStatus('error');
    };

    ws.onclose = () => {
      wsRef.current = null;
      if (retryRef.current < BACKOFF_MS.length) {
        const delay = BACKOFF_MS[retryRef.current];
        retryRef.current += 1;
        setStatus('connecting');
        retryTimerRef.current = setTimeout(() => connect(), delay);
      } else {
        setStatus('error');
      }
    };
  }, []);

  const subscribe = useCallback((service: string) => {
    subscriptionsRef.current.add(service);
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'subscribe', services: [service] }));
    }
  }, []);

  const unsubscribe = useCallback((service: string) => {
    subscriptionsRef.current.delete(service);
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'unsubscribe', services: [service] }));
    }
  }, []);

  // Auto-connect on mount if WS_URL is set
  useEffect(() => {
    if (WS_URL) connect();
    return () => disconnect();
  }, [connect, disconnect]);

  return { status, subscribe, unsubscribe, lastMessage, connect, disconnect };
}
