// lib/schwabStream.ts
// WebSocket client for real-time Schwab market data streaming
// STANDALONE VERSION - No dependencies on other files

// ============================================================
// TYPES
// ============================================================

export interface EquityQuote {
  symbol: string;
  bid: number;
  ask: number;
  last: number;
  volume: number;
  high: number;
  low: number;
  close: number;
  change: number;
  changePercent: number;
  timestamp: number;
}

export interface OptionQuote {
  symbol: string;
  bid: number;
  ask: number;
  last: number;
  volume: number;
  openInterest: number;
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
  rho: number;
  volatility: number;
  timestamp: number;
}

type MessageCallback = (data: EquityQuote | OptionQuote) => void;

interface Subscription {
  service: string;
  command: string;
  parameters?: {
    keys?: string;
    fields?: string;
  };
}

// ============================================================
// TOKEN FETCHING (Standalone - no imports needed)
// ============================================================

async function getAccessToken(): Promise<string | null> {
  const appKey = process.env.SCHWAB_APP_KEY?.trim();
  const appSecret = process.env.SCHWAB_APP_SECRET?.trim();
  const refreshToken = process.env.SCHWAB_REFRESH_TOKEN?.trim();

  if (!appKey || !appSecret || !refreshToken) {
    console.error('[SchwabStream] Missing credentials');
    return null;
  }

  try {
    const basic = Buffer.from(`${appKey}:${appSecret}`).toString('base64');
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    });

    const response = await fetch('https://api.schwabapi.com/v1/oauth/token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${basic}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });

    if (!response.ok) {
      console.error('[SchwabStream] Token fetch failed:', response.status);
      return null;
    }

    const data = await response.json();
    return data.access_token || null;
  } catch (error) {
    console.error('[SchwabStream] Token error:', error);
    return null;
  }
}

// ============================================================
// WEBSOCKET CLIENT
// ============================================================

class SchwabStreamClient {
  private ws: WebSocket | null = null;
  private isConnected = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 2000;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private subscriptions = new Map<string, Set<MessageCallback>>();
  private activeSubscriptions = new Set<string>();

  async connect(): Promise<boolean> {
    if (this.isConnected) return true;

    console.log('[SchwabStream] Connecting...');

    try {
      const token = await getAccessToken();
      if (!token) {
        console.error('[SchwabStream] No access token available');
        return false;
      }

      const wsUrl = `wss://api.schwabapi.com/trader/v1/stream?token=${token}`;
      
      if (typeof window !== 'undefined') {
        this.ws = new WebSocket(wsUrl);
      } else {
        console.warn('[SchwabStream] WebSocket not available in server environment');
        return false;
      }

      return new Promise((resolve) => {
        if (!this.ws) {
          resolve(false);
          return;
        }

        this.ws.onopen = () => {
          console.log('[SchwabStream] Connected');
          this.isConnected = true;
          this.reconnectAttempts = 0;
          this.startHeartbeat();
          this.resubscribeAll();
          resolve(true);
        };

        this.ws.onmessage = (event) => {
          this.handleMessage(event.data);
        };

        this.ws.onerror = (error) => {
          console.error('[SchwabStream] WebSocket error:', error);
          resolve(false);
        };

        this.ws.onclose = () => {
          console.log('[SchwabStream] Connection closed');
          this.isConnected = false;
          this.stopHeartbeat();
          this.attemptReconnect();
        };
      });
    } catch (error) {
      console.error('[SchwabStream] Connection error:', error);
      return false;
    }
  }

  disconnect(): void {
    console.log('[SchwabStream] Disconnecting');
    this.isConnected = false;
    this.stopHeartbeat();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  subscribeEquity(symbols: string[], callback: MessageCallback): void {
    const service = 'LEVELONE_EQUITIES';
    const key = `${service}:${symbols.join(',')}`;

    if (!this.subscriptions.has(key)) {
      this.subscriptions.set(key, new Set());
    }
    this.subscriptions.get(key)!.add(callback);

    if (this.isConnected) {
      this.sendSubscription({
        service,
        command: 'SUBS',
        parameters: {
          keys: symbols.join(','),
          fields: '0,1,2,3,4,5,8,9',
        },
      });
      this.activeSubscriptions.add(key);
    }
  }

  unsubscribeEquity(symbols: string[], callback: MessageCallback): void {
    const service = 'LEVELONE_EQUITIES';
    const key = `${service}:${symbols.join(',')}`;

    const callbacks = this.subscriptions.get(key);
    if (callbacks) {
      callbacks.delete(callback);
      if (callbacks.size === 0) {
        this.subscriptions.delete(key);
        this.activeSubscriptions.delete(key);

        if (this.isConnected) {
          this.sendSubscription({
            service,
            command: 'UNSUBS',
            parameters: {
              keys: symbols.join(','),
            },
          });
        }
      }
    }
  }

  subscribeOption(symbols: string[], callback: MessageCallback): void {
    const service = 'LEVELONE_OPTIONS';
    const key = `${service}:${symbols.join(',')}`;

    if (!this.subscriptions.has(key)) {
      this.subscriptions.set(key, new Set());
    }
    this.subscriptions.get(key)!.add(callback);

    if (this.isConnected) {
      this.sendSubscription({
        service,
        command: 'SUBS',
        parameters: {
          keys: symbols.join(','),
          fields: '0,1,2,3,4,8,10,11,12,13,14,15,16',
        },
      });
      this.activeSubscriptions.add(key);
    }
  }

  unsubscribeOption(symbols: string[], callback: MessageCallback): void {
    const service = 'LEVELONE_OPTIONS';
    const key = `${service}:${symbols.join(',')}`;

    const callbacks = this.subscriptions.get(key);
    if (callbacks) {
      callbacks.delete(callback);
      if (callbacks.size === 0) {
        this.subscriptions.delete(key);
        this.activeSubscriptions.delete(key);

        if (this.isConnected) {
          this.sendSubscription({
            service,
            command: 'UNSUBS',
            parameters: {
              keys: symbols.join(','),
            },
          });
        }
      }
    }
  }

  isConnectedToStream(): boolean {
    return this.isConnected;
  }

  getActiveSubscriptions(): string[] {
    return Array.from(this.activeSubscriptions);
  }

  private sendSubscription(sub: Subscription): void {
    if (!this.ws || !this.isConnected) return;

    const message = {
      requests: [sub],
    };

    try {
      this.ws.send(JSON.stringify(message));
      console.log('[SchwabStream] Sent subscription:', sub.service, sub.command);
    } catch (error) {
      console.error('[SchwabStream] Failed to send subscription:', error);
    }
  }

  private handleMessage(data: string): void {
    try {
      const message = JSON.parse(data);

      if (message.response) {
        console.log('[SchwabStream] Response:', message.response);
      } else if (message.data) {
        this.processDataUpdate(message.data);
      } else if (message.notify) {
        console.log('[SchwabStream] Notification:', message.notify);
      }
    } catch (error) {
      console.error('[SchwabStream] Failed to parse message:', error);
    }
  }

  private processDataUpdate(data: any[]): void {
    for (const item of data) {
      const service = item.service;
      const content = item.content;

      if (!content) continue;

      for (const update of content) {
        if (service === 'LEVELONE_EQUITIES') {
          this.processEquityUpdate(update);
        } else if (service === 'LEVELONE_OPTIONS') {
          this.processOptionUpdate(update);
        }
      }
    }
  }

  private processEquityUpdate(update: any): void {
    const quote: EquityQuote = {
      symbol: update.key || update['1'] || '',
      bid: update['2'] || 0,
      ask: update['3'] || 0,
      last: update['4'] || 0,
      volume: update['8'] || 0,
      high: update['6'] || 0,
      low: update['7'] || 0,
      close: update['9'] || 0,
      change: update['10'] || 0,
      changePercent: update['11'] || 0,
      timestamp: Date.now(),
    };

    this.subscriptions.forEach((callbacks, key) => {
      if (key.includes('LEVELONE_EQUITIES') && key.includes(quote.symbol)) {
        callbacks.forEach((callback) => callback(quote));
      }
    });
  }

  private processOptionUpdate(update: any): void {
    const quote: OptionQuote = {
      symbol: update.key || update['0'] || '',
      bid: update['2'] || 0,
      ask: update['3'] || 0,
      last: update['4'] || 0,
      volume: update['8'] || 0,
      openInterest: update['10'] || 0,
      delta: update['11'] || 0,
      gamma: update['12'] || 0,
      theta: update['13'] || 0,
      vega: update['14'] || 0,
      rho: update['15'] || 0,
      volatility: update['16'] || 0,
      timestamp: Date.now(),
    };

    this.subscriptions.forEach((callbacks, key) => {
      if (key.includes('LEVELONE_OPTIONS') && key.includes(quote.symbol)) {
        callbacks.forEach((callback) => callback(quote));
      }
    });
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatInterval = setInterval(() => {
      if (this.ws && this.isConnected) {
        try {
          this.ws.send(JSON.stringify({ heartbeat: Date.now() }));
        } catch (error) {
          console.error('[SchwabStream] Heartbeat failed:', error);
        }
      }
    }, 30000);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[SchwabStream] Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

    console.log(`[SchwabStream] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

    setTimeout(() => {
      this.connect();
    }, delay);
  }

  private resubscribeAll(): void {
    console.log('[SchwabStream] Resubscribing to active subscriptions');
    const subscriptionsToResend = Array.from(this.activeSubscriptions);
    this.activeSubscriptions.clear();

    for (const key of subscriptionsToResend) {
      const [service, symbols] = key.split(':');
      const symbolList = symbols.split(',');
      const callbacks = this.subscriptions.get(key);

      if (callbacks && callbacks.size > 0) {
        const callback = callbacks.values().next().value;
        if (service.includes('EQUITIES')) {
          this.subscribeEquity(symbolList, callback);
        } else if (service.includes('OPTIONS')) {
          this.subscribeOption(symbolList, callback);
        }
      }
    }
  }
}

export const schwabStream = new SchwabStreamClient();
