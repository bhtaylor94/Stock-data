// lib/schwabStream.ts
// Schwab WebSocket Streaming Client
// Handles real-time market data streaming from Schwab API

import { getSchwabAccessToken } from './schwab';

// ============================================================
// TYPES
// ============================================================

export type StreamingService = 
  | 'LEVELONE_EQUITIES'
  | 'LEVELONE_OPTIONS'
  | 'ACCT_ACTIVITY'
  | 'CHART_EQUITY';

export interface StreamMessage {
  service: StreamingService | 'ADMIN';
  requestid: string;
  command: 'LOGIN' | 'SUBS' | 'UNSUBS' | 'ADD' | 'LOGOUT';
  parameters?: any;
}

export interface EquityQuote {
  symbol: string;
  bid: number;
  ask: number;
  last: number;
  bidSize: number;
  askSize: number;
  volume: number;
  lastSize: number;
  high: number;
  low: number;
  close: number;
  open: number;
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
  impliedVolatility: number;
  theoreticalValue: number;
  intrinsicValue: number;
  timeValue: number;
  daysToExpiration: number;
  timestamp: number;
}

export type QuoteUpdateCallback = (quote: EquityQuote | OptionQuote) => void;
export type AccountUpdateCallback = (update: any) => void;
export type ConnectionCallback = (connected: boolean) => void;

// ============================================================
// SCHWAB STREAMING CLIENT (SINGLETON)
// ============================================================

class SchwabStreamingClient {
  private ws: WebSocket | null = null;
  private token: string | null = null;
  private isAuthenticated = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 2000;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private requestId = 0;

  // Subscriptions
  private equitySubscriptions = new Set<string>();
  private optionSubscriptions = new Set<string>();
  private accountSubscriptions = new Set<string>();

  // Callbacks
  private quoteCallbacks = new Map<string, Set<QuoteUpdateCallback>>();
  private accountCallbacks = new Set<AccountUpdateCallback>();
  private connectionCallbacks = new Set<ConnectionCallback>();

  constructor() {
    if (typeof window === 'undefined') {
      console.warn('[SchwabStream] WebSocket not available in server environment');
    }
  }

  // ============================================================
  // CONNECTION MANAGEMENT
  // ============================================================

  async connect(): Promise<boolean> {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      console.log('[SchwabStream] Already connected');
      return true;
    }

    try {
      // Get fresh access token
      const tokenResult = await getSchwabAccessToken('streaming');
      if (!tokenResult.token) {
        console.error('[SchwabStream] Failed to get access token:', tokenResult.error);
        return false;
      }

      this.token = tokenResult.token;

      // Create WebSocket connection
      console.log('[SchwabStream] Connecting to Schwab WebSocket...');
      this.ws = new WebSocket('wss://api.schwabapi.com/trader/v1/stream');

      // Setup event handlers
      this.ws.onopen = () => this.handleOpen();
      this.ws.onmessage = (event) => this.handleMessage(event);
      this.ws.onerror = (error) => this.handleError(error);
      this.ws.onclose = (event) => this.handleClose(event);

      return true;
    } catch (error) {
      console.error('[SchwabStream] Connection error:', error);
      return false;
    }
  }

  disconnect() {
    console.log('[SchwabStream] Disconnecting...');
    
    // Clear heartbeat
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    // Send logout
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.send({
        service: 'ADMIN',
        requestid: this.getRequestId(),
        command: 'LOGOUT',
      });
    }

    // Close WebSocket
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.isAuthenticated = false;
    this.notifyConnectionChange(false);
  }

  private handleOpen() {
    console.log('[SchwabStream] WebSocket opened, logging in...');
    this.reconnectAttempts = 0;

    // Send login request
    this.send({
      service: 'ADMIN',
      requestid: this.getRequestId(),
      command: 'LOGIN',
      parameters: {
        token: this.token,
        version: '1.0',
      },
    });
  }

  private handleMessage(event: MessageEvent) {
    try {
      const data = JSON.parse(event.data);
      
      // Handle login response
      if (data.response) {
        for (const response of data.response) {
          if (response.service === 'ADMIN' && response.command === 'LOGIN') {
            if (response.content?.code === 0) {
              console.log('[SchwabStream] Login successful');
              this.isAuthenticated = true;
              this.notifyConnectionChange(true);
              this.startHeartbeat();
              this.resubscribeAll();
            } else {
              console.error('[SchwabStream] Login failed:', response.content);
              this.disconnect();
            }
          }
        }
      }

      // Handle data updates
      if (data.data) {
        for (const update of data.data) {
          this.processUpdate(update);
        }
      }

    } catch (error) {
      console.error('[SchwabStream] Message parse error:', error);
    }
  }

  private handleError(error: Event) {
    console.error('[SchwabStream] WebSocket error:', error);
  }

  private handleClose(event: CloseEvent) {
    console.log('[SchwabStream] WebSocket closed:', event.code, event.reason);
    this.isAuthenticated = false;
    this.notifyConnectionChange(false);

    // Attempt reconnect
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`[SchwabStream] Reconnecting... (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
      setTimeout(() => this.connect(), this.reconnectDelay * this.reconnectAttempts);
    } else {
      console.error('[SchwabStream] Max reconnect attempts reached');
    }
  }

  private startHeartbeat() {
    // Send heartbeat every 30 seconds to keep connection alive
    this.heartbeatInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.send({
          service: 'ADMIN',
          requestid: this.getRequestId(),
          command: 'LOGOUT', // This is actually used as a ping
        });
      }
    }, 30000);
  }

  // ============================================================
  // SUBSCRIPTION MANAGEMENT
  // ============================================================

  subscribeEquity(symbols: string[], callback: QuoteUpdateCallback) {
    if (!Array.isArray(symbols) || symbols.length === 0) return;

    // Add symbols to subscriptions
    symbols.forEach(symbol => {
      this.equitySubscriptions.add(symbol.toUpperCase());
      
      // Add callback
      if (!this.quoteCallbacks.has(symbol)) {
        this.quoteCallbacks.set(symbol, new Set());
      }
      this.quoteCallbacks.get(symbol)!.add(callback);
    });

    // Send subscription if connected
    if (this.isAuthenticated) {
      this.send({
        service: 'LEVELONE_EQUITIES',
        requestid: this.getRequestId(),
        command: 'SUBS',
        parameters: {
          keys: symbols.join(',').toUpperCase(),
          fields: '0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15',
        },
      });
    }
  }

  unsubscribeEquity(symbols: string[], callback?: QuoteUpdateCallback) {
    if (!Array.isArray(symbols) || symbols.length === 0) return;

    symbols.forEach(symbol => {
      const upperSymbol = symbol.toUpperCase();
      
      // Remove callback
      if (callback && this.quoteCallbacks.has(upperSymbol)) {
        this.quoteCallbacks.get(upperSymbol)!.delete(callback);
        
        // Remove symbol if no more callbacks
        if (this.quoteCallbacks.get(upperSymbol)!.size === 0) {
          this.quoteCallbacks.delete(upperSymbol);
          this.equitySubscriptions.delete(upperSymbol);
        }
      } else {
        // Remove all callbacks for symbol
        this.quoteCallbacks.delete(upperSymbol);
        this.equitySubscriptions.delete(upperSymbol);
      }
    });

    // Send unsubscribe if connected
    if (this.isAuthenticated && symbols.length > 0) {
      this.send({
        service: 'LEVELONE_EQUITIES',
        requestid: this.getRequestId(),
        command: 'UNSUBS',
        parameters: {
          keys: symbols.join(',').toUpperCase(),
        },
      });
    }
  }

  subscribeOption(symbols: string[], callback: QuoteUpdateCallback) {
    if (!Array.isArray(symbols) || symbols.length === 0) return;

    // Add symbols to subscriptions
    symbols.forEach(symbol => {
      this.optionSubscriptions.add(symbol.toUpperCase());
      
      // Add callback
      if (!this.quoteCallbacks.has(symbol)) {
        this.quoteCallbacks.set(symbol, new Set());
      }
      this.quoteCallbacks.get(symbol)!.add(callback);
    });

    // Send subscription if connected
    if (this.isAuthenticated) {
      this.send({
        service: 'LEVELONE_OPTIONS',
        requestid: this.getRequestId(),
        command: 'SUBS',
        parameters: {
          keys: symbols.join(',').toUpperCase(),
          fields: '0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25',
        },
      });
    }
  }

  unsubscribeOption(symbols: string[], callback?: QuoteUpdateCallback) {
    if (!Array.isArray(symbols) || symbols.length === 0) return;

    symbols.forEach(symbol => {
      const upperSymbol = symbol.toUpperCase();
      
      if (callback && this.quoteCallbacks.has(upperSymbol)) {
        this.quoteCallbacks.get(upperSymbol)!.delete(callback);
        
        if (this.quoteCallbacks.get(upperSymbol)!.size === 0) {
          this.quoteCallbacks.delete(upperSymbol);
          this.optionSubscriptions.delete(upperSymbol);
        }
      } else {
        this.quoteCallbacks.delete(upperSymbol);
        this.optionSubscriptions.delete(upperSymbol);
      }
    });

    if (this.isAuthenticated && symbols.length > 0) {
      this.send({
        service: 'LEVELONE_OPTIONS',
        requestid: this.getRequestId(),
        command: 'UNSUBS',
        parameters: {
          keys: symbols.join(',').toUpperCase(),
        },
      });
    }
  }

  subscribeAccount(accountHash: string, callback: AccountUpdateCallback) {
    this.accountSubscriptions.add(accountHash);
    this.accountCallbacks.add(callback);

    if (this.isAuthenticated) {
      this.send({
        service: 'ACCT_ACTIVITY',
        requestid: this.getRequestId(),
        command: 'SUBS',
        parameters: {
          keys: accountHash,
          fields: '0,1,2,3',
        },
      });
    }
  }

  unsubscribeAccount(accountHash: string, callback?: AccountUpdateCallback) {
    this.accountSubscriptions.delete(accountHash);
    
    if (callback) {
      this.accountCallbacks.delete(callback);
    }

    if (this.isAuthenticated) {
      this.send({
        service: 'ACCT_ACTIVITY',
        requestid: this.getRequestId(),
        command: 'UNSUBS',
        parameters: {
          keys: accountHash,
        },
      });
    }
  }

  private resubscribeAll() {
    // Resubscribe to all active subscriptions after reconnect
    if (this.equitySubscriptions.size > 0) {
      this.send({
        service: 'LEVELONE_EQUITIES',
        requestid: this.getRequestId(),
        command: 'SUBS',
        parameters: {
          keys: Array.from(this.equitySubscriptions).join(','),
          fields: '0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15',
        },
      });
    }

    if (this.optionSubscriptions.size > 0) {
      this.send({
        service: 'LEVELONE_OPTIONS',
        requestid: this.getRequestId(),
        command: 'SUBS',
        parameters: {
          keys: Array.from(this.optionSubscriptions).join(','),
          fields: '0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25',
        },
      });
    }

    if (this.accountSubscriptions.size > 0) {
      Array.from(this.accountSubscriptions).forEach(accountHash => {
        this.send({
          service: 'ACCT_ACTIVITY',
          requestid: this.getRequestId(),
          command: 'SUBS',
          parameters: {
            keys: accountHash,
            fields: '0,1,2,3',
          },
        });
      });
    }
  }

  // ============================================================
  // DATA PROCESSING
  // ============================================================

  private processUpdate(update: any) {
    const { service, content } = update;

    if (service === 'LEVELONE_EQUITIES') {
      this.processEquityUpdate(content);
    } else if (service === 'LEVELONE_OPTIONS') {
      this.processOptionUpdate(content);
    } else if (service === 'ACCT_ACTIVITY') {
      this.processAccountUpdate(content);
    }
  }

  private processEquityUpdate(content: any[]) {
    for (const item of content) {
      const quote: EquityQuote = {
        symbol: item.key || item['0'],
        bid: item['1'] || 0,
        ask: item['2'] || 0,
        last: item['3'] || 0,
        bidSize: item['4'] || 0,
        askSize: item['5'] || 0,
        volume: item['6'] || 0,
        lastSize: item['7'] || 0,
        high: item['8'] || 0,
        low: item['9'] || 0,
        close: item['10'] || 0,
        open: item['15'] || 0,
        timestamp: Date.now(),
      };

      // Notify callbacks
      const callbacks = this.quoteCallbacks.get(quote.symbol);
      if (callbacks) {
        callbacks.forEach(cb => cb(quote));
      }
    }
  }

  private processOptionUpdate(content: any[]) {
    for (const item of content) {
      const quote: OptionQuote = {
        symbol: item.key || item['0'],
        bid: item['1'] || 0,
        ask: item['2'] || 0,
        last: item['3'] || 0,
        volume: item['8'] || 0,
        openInterest: item['9'] || 0,
        delta: item['14'] || 0,
        gamma: item['15'] || 0,
        theta: item['16'] || 0,
        vega: item['17'] || 0,
        rho: item['18'] || 0,
        impliedVolatility: item['19'] || 0,
        theoreticalValue: item['20'] || 0,
        intrinsicValue: item['21'] || 0,
        timeValue: item['22'] || 0,
        daysToExpiration: item['24'] || 0,
        timestamp: Date.now(),
      };

      // Notify callbacks
      const callbacks = this.quoteCallbacks.get(quote.symbol);
      if (callbacks) {
        callbacks.forEach(cb => cb(quote));
      }
    }
  }

  private processAccountUpdate(content: any[]) {
    for (const item of content) {
      // Notify account callbacks
      this.accountCallbacks.forEach(cb => cb(item));
    }
  }

  // ============================================================
  // CONNECTION CALLBACKS
  // ============================================================

  onConnectionChange(callback: ConnectionCallback) {
    this.connectionCallbacks.add(callback);
    
    // Immediately notify of current state
    callback(this.isAuthenticated);
    
    // Return unsubscribe function
    return () => this.connectionCallbacks.delete(callback);
  }

  private notifyConnectionChange(connected: boolean) {
    this.connectionCallbacks.forEach(cb => cb(connected));
  }

  // ============================================================
  // UTILITIES
  // ============================================================

  private send(message: StreamMessage) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.warn('[SchwabStream] Cannot send message - WebSocket not open');
    }
  }

  private getRequestId(): string {
    return (++this.requestId).toString();
  }

  isConnected(): boolean {
    return this.isAuthenticated && this.ws?.readyState === WebSocket.OPEN;
  }

  getSubscriptions() {
    return {
      equities: Array.from(this.equitySubscriptions),
      options: Array.from(this.optionSubscriptions),
      accounts: Array.from(this.accountSubscriptions),
    };
  }
}

// Export singleton instance
export const schwabStream = new SchwabStreamingClient();
