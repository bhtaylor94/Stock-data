# 📡 Schwab Streaming API Setup Guide

## Overview

Schwab provides real-time WebSocket streaming for:
- Level 1 quotes (price, volume, bid/ask)
- Options chains (live Greeks updates)
- Account updates (positions, orders)
- Chart data (time & sales)

## Requirements

### 1. Streaming API Access
- You need to apply for "Streaming" product on developer.schwab.com
- Same app credentials (APP_KEY, APP_SECRET) work for streaming
- No additional cost - it's FREE like the other APIs

### 2. Apply for Streaming Access

**Steps:**
1. Go to https://developer.schwab.com
2. Login to your account
3. Navigate to "My Apps"
4. Select your existing app ("AI Hedge Fund" or whatever you named it)
5. Click "Add API Product"
6. Select "Streaming"
7. Submit application
8. Wait for approval (usually 1-2 business days)

### 3. Verify Access

Once approved, you'll see in your app dashboard:
- ✅ Market Data Production
- ✅ Accounts and Trading Production
- ✅ **Streaming** ← NEW!

## WebSocket Endpoints

**Production:**
```
wss://api.schwabapi.com/trader/v1/stream
```

**Authentication:**
- Uses same access token as REST API
- Token passed as query parameter or in initial message
- Token expires after 30 minutes (same as REST)

## Streaming Services Available

### Level 1 Equity Quotes
```json
{
  "service": "LEVELONE_EQUITIES",
  "requestid": "1",
  "command": "SUBS",
  "parameters": {
    "keys": "AAPL,MSFT,GOOGL",
    "fields": "0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15"
  }
}
```

**Fields:**
- 0: Symbol
- 1: Bid Price
- 2: Ask Price
- 3: Last Price
- 4: Bid Size
- 5: Ask Size
- 6: Total Volume
- 7: Last Size
- 8: High Price
- 9: Low Price
- 10: Close Price
- 11: Exchange
- 12: Marginable
- 13: Description
- 14: Last ID
- 15: Open Price

### Level 1 Options Quotes
```json
{
  "service": "LEVELONE_OPTIONS",
  "requestid": "2",
  "command": "SUBS",
  "parameters": {
    "keys": "AAPL_011725C265",
    "fields": "0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,41"
  }
}
```

**Key Fields for Greeks:**
- 14: Delta
- 15: Gamma
- 16: Theta
- 17: Vega
- 18: Rho
- 19: Implied Volatility
- 20: Theoretical Option Value
- 21: Intrinsic Value
- 22: Time Value
- 23: Expiration Day
- 24: Days to Expiration

### Account Activity
```json
{
  "service": "ACCT_ACTIVITY",
  "requestid": "3",
  "command": "SUBS",
  "parameters": {
    "keys": "ACCOUNT_HASH",
    "fields": "0,1,2,3"
  }
}
```

**Updates on:**
- Order fills
- Position changes
- Balance updates
- Trade confirmations

## WebSocket Flow

### 1. Connection
```typescript
const ws = new WebSocket('wss://api.schwabapi.com/trader/v1/stream');

ws.onopen = () => {
  // Send login request
  ws.send(JSON.stringify({
    service: "ADMIN",
    requestid: "0",
    command: "LOGIN",
    parameters: {
      token: accessToken,
      version: "1.0"
    }
  }));
};
```

### 2. Login Response
```json
{
  "response": [
    {
      "service": "ADMIN",
      "requestid": "0",
      "command": "LOGIN",
      "timestamp": 1705161234567,
      "content": {
        "code": 0,
        "msg": "Success"
      }
    }
  ]
}
```

### 3. Subscribe to Services
```typescript
// Subscribe to stock quotes
ws.send(JSON.stringify({
  service: "LEVELONE_EQUITIES",
  requestid: "1",
  command: "SUBS",
  parameters: {
    keys: "AAPL,MSFT,GOOGL",
    fields: "0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15"
  }
}));
```

### 4. Receive Updates
```json
{
  "data": [
    {
      "service": "LEVELONE_EQUITIES",
      "timestamp": 1705161235567,
      "command": "SUBS",
      "content": [
        {
          "key": "AAPL",
          "1": 260.45,  // Bid
          "2": 260.50,  // Ask
          "3": 260.48,  // Last
          "6": 45678900, // Volume
          "8": 262.10,  // High
          "9": 258.30   // Low
        }
      ]
    }
  ]
}
```

## Rate Limits

**Streaming:**
- Max 1 connection per app
- Max 300 subscriptions per connection
- Updates every 100ms for Level 1 data
- No throttling on updates received

**Best Practices:**
- Keep connection alive with heartbeat
- Reconnect on disconnect
- Unsubscribe when component unmounts
- Batch subscription requests

## Error Handling

**Common Errors:**
```json
// Invalid token
{
  "response": [
    {
      "service": "ADMIN",
      "command": "LOGIN",
      "content": {
        "code": 21,
        "msg": "Authorization failed"
      }
    }
  ]
}

// Invalid symbol
{
  "response": [
    {
      "service": "LEVELONE_EQUITIES",
      "command": "SUBS",
      "content": {
        "code": 22,
        "msg": "Invalid symbol"
      }
    }
  ]
}
```

**Error Codes:**
- 0: Success
- 21: Authorization failed (refresh token)
- 22: Invalid symbol
- 23: Invalid field
- 24: Rate limit exceeded
- 25: Service unavailable

## Implementation Strategy

### Phase 4A: Basic Connection (Day 1)
1. Create WebSocket client
2. Implement login flow
3. Add reconnection logic
4. Test with single symbol

### Phase 4B: Stock Streaming (Day 2)
1. Subscribe to stock quotes
2. Create React hooks
3. Update Stock Analysis UI
4. Add streaming indicator

### Phase 4C: Portfolio Streaming (Day 3)
1. Subscribe to account activity
2. Update portfolio in real-time
3. Show live P&L updates
4. Add position change alerts

### Phase 4D: Options Streaming (Day 4)
1. Subscribe to options quotes
2. Live Greeks updates
3. Update Options Intel UI
4. Unusual activity detection

## Testing Strategy

### Local Development
```bash
# Test connection
npm run dev

# Open browser console
# Watch WebSocket traffic in Network tab
# Filter: WS (WebSocket)
```

### Production Testing
1. Deploy to Vercel
2. Test on real Schwab account
3. Monitor for disconnections
4. Verify update frequency

## Cost

**FREE** - Schwab streaming is included at no cost with Market Data Production access.

## Next Steps

1. **Apply for Streaming API** (if not done yet)
2. **Wait for approval** (1-2 business days)
3. **Start implementation** (this guide)
4. **Test thoroughly** before production
5. **Deploy** and enjoy live updates!

---

**Ready to apply for streaming access?**

Visit: https://developer.schwab.com → My Apps → Add API Product → Streaming
