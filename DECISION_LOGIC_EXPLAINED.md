# AI Hedge Fund - Decision Logic Deep Dive

## Overview of the Decision System

The AI uses a **multi-layered scoring system** that combines quantitative metrics with qualitative data to produce trading recommendations. The system is designed to be **conservative and accurate** rather than aggressive, with built-in calibration to prevent overconfidence.

## Step-by-Step Decision Process

### Phase 1: Data Collection

The system makes parallel API calls to gather comprehensive data:

```typescript
// Schwab API
- Real-time quote (price, volume, change)
- 1-year daily price history (252+ candles)
- Options chains (strikes, expiries, Greeks)

// Finnhub API  
- Company profile (sector, industry, market cap)
- Fundamental metrics (P/E, ROE, debt ratios, etc.)
- News articles (last 30 days)
- Sentiment analysis
- Analyst recommendations
- Price targets
- Insider transactions (last 90 days)
- Earnings calendar
```

### Phase 2: Technical Analysis (9-Point Score)

**How it works**: Each technical indicator is evaluated pass/fail. Passing = +1 point, failing = 0 points. Maximum score = 9.

#### 1. **Price vs SMA50** (Simple Moving Average, 50 days)
```typescript
if (price > sma50 * 1.02) {
  score += 1; // Price is 2%+ above SMA50 = uptrend confirmed
}
```
**Reasoning**: A stock trading above its 50-day average indicates bullish momentum. The 2% buffer prevents false signals from minor fluctuations.

#### 2. **Price vs SMA200** (200-day moving average)
```typescript
if (price > sma200) {
  score += 1; // Above 200 SMA = long-term uptrend
}
```
**Reasoning**: The 200-day SMA is a critical long-term trend indicator. Institutions watch this closely.

#### 3. **SMA50 vs SMA200** (Golden/Death Cross)
```typescript
if (sma50 > sma200) {
  score += 1; // Golden cross = bullish
}
```
**Reasoning**: When the 50 SMA crosses above 200 SMA ("Golden Cross"), it's a powerful bullish signal. Opposite is "Death Cross."

#### 4. **RSI - Relative Strength Index**
```typescript
if (rsi > 30 && rsi < 70) {
  score += 1; // RSI in healthy range (not overbought/oversold)
}
```
**Reasoning**: RSI measures momentum. <30 = oversold, >70 = overbought. We want stocks in the "normal" range with room to run.

#### 5. **MACD - Moving Average Convergence Divergence**
```typescript
const macdLine = ema12 - ema26;
const signalLine = 9-day EMA of macdLine;

if (macdLine > 0 && macdLine > signalLine) {
  score += 1; // Positive MACD with bullish crossover
}
```
**Reasoning**: MACD above zero = bullish trend. MACD above signal line = strengthening momentum.

#### 6. **Bollinger Bands Position**
```typescript
const upperBand = sma20 + (2 * stdDev);
const lowerBand = sma20 - (2 * stdDev);

if (price > lowerBand && price < upperBand * 0.95) {
  score += 1; // Price in lower 95% of bands = room to expand
}
```
**Reasoning**: Bollinger Bands show volatility. We want price not at the upper extreme (which would indicate overbought).

#### 7. **Volume vs Average**
```typescript
if (currentVolume > avgVolume * 1.5) {
  score += 1; // High volume = conviction behind the move
}
```
**Reasoning**: Volume confirms price action. High volume on up days = institutional accumulation.

#### 8. **Price vs 52-Week High**
```typescript
if (price < high52Week * 0.9) {
  score += 1; // At least 10% below 52-week high = room to grow
}
```
**Reasoning**: Stocks near all-time highs face resistance. We prefer stocks with upside headroom.

#### 9. **ATR - Average True Range** (Volatility Check)
```typescript
const atrPercent = (atr / price) * 100;

if (atrPercent < 5) {
  score += 1; // Volatility under control
}
```
**Reasoning**: Extremely high volatility = high risk. We prefer stable, tradeable volatility.

**Technical Score Range**: 0-9 points
- 7-9 = Strong technicals (uptrend with good momentum)
- 4-6 = Mixed technicals (sideways or weak trend)
- 0-3 = Weak technicals (downtrend)

### Phase 3: Fundamental Analysis (9-Point Score)

**How it works**: Same as technical - each metric is pass/fail. Maximum score = 9.

#### 1. **P/E Ratio (Price-to-Earnings)**
```typescript
if (pe > 0 && pe < 25) {
  score += 1; // Reasonable valuation
}
```
**Reasoning**: P/E shows how expensive a stock is relative to earnings. <25 = not overvalued (tech stocks may go higher). Negative P/E = unprofitable.

#### 2. **P/B Ratio (Price-to-Book)**
```typescript
if (pb > 0 && pb < 5) {
  score += 1; // Trading below 5x book value
}
```
**Reasoning**: P/B compares price to book value (assets minus liabilities). <5 = reasonable for most stocks.

#### 3. **ROE (Return on Equity)**
```typescript
if (roe > 15) {
  score += 1; // Generating strong returns for shareholders
}
```
**Reasoning**: ROE measures profitability. >15% = company efficiently generates profits from equity. Warren Buffett loves high ROE.

#### 4. **ROA (Return on Assets)**
```typescript
if (roa > 5) {
  score += 1; // Efficiently using assets
}
```
**Reasoning**: ROA measures how well company uses assets to generate profit. >5% = solid efficiency.

#### 5. **Debt-to-Equity Ratio**
```typescript
if (debtEquity < 2) {
  score += 1; // Manageable debt load
}
```
**Reasoning**: Debt/Equity shows financial leverage. <2 = healthy balance sheet. High debt = risk during economic downturns.

#### 6. **Current Ratio**
```typescript
if (currentRatio > 1.5) {
  score += 1; // Strong liquidity
}
```
**Reasoning**: Current ratio = current assets / current liabilities. >1.5 = can easily pay short-term debts.

#### 7. **Profit Margin**
```typescript
if (profitMargin > 10) {
  score += 1; // Strong profitability
}
```
**Reasoning**: Profit margin = net income / revenue. >10% = healthy margins. Software companies often have 20%+.

#### 8. **Revenue Growth**
```typescript
if (revenueGrowth > 10) {
  score += 1; // Growing top line
}
```
**Reasoning**: Revenue growth >10% YoY = expanding business. Growth stocks need this.

#### 9. **EPS Growth**
```typescript
if (epsGrowth > 15) {
  score += 1; // Earnings accelerating
}
```
**Reasoning**: EPS growth >15% = profits growing faster than revenue (margin expansion). Very bullish.

**Fundamental Score Range**: 0-9 points
- 7-9 = Excellent fundamentals (healthy, profitable, growing)
- 4-6 = Decent fundamentals (some strengths, some weaknesses)
- 0-3 = Poor fundamentals (financial distress or overvalued)

### Phase 4: Combined Score Calculation

```typescript
const combinedScore = technicalScore + fundamentalScore; // Max 18
```

**Score Interpretation**:
- **14-18**: STRONG BUY territory
- **11-13**: BUY territory  
- **7-10**: HOLD territory
- **4-6**: SELL territory
- **0-3**: STRONG SELL territory

### Phase 5: Confidence Calibration

This is where the system gets sophisticated. The **base confidence** is determined by the combined score:

```typescript
if (combinedScore >= 14) {
  baseConfidence = 75 + (combinedScore - 14) * 5;
  // Score 14 = 75%, Score 18 = 95%
}
else if (combinedScore >= 11) {
  baseConfidence = 60 + (combinedScore - 11) * 5;
  // Score 11 = 60%, Score 13 = 70%
}
else if (combinedScore >= 7) {
  baseConfidence = 40 + (combinedScore - 7) * 5;
  // Score 7 = 40%, Score 10 = 55%
}
else if (combinedScore >= 4) {
  baseConfidence = 55 + (7 - combinedScore) * 5;
  // Lower scores get higher confidence for SELL
}
else {
  baseConfidence = 70 + (4 - combinedScore) * 5;
  // Very poor scores = high confidence SELL
}
```

**Why this matters**: A score of 14/18 gives 75% base confidence - the system is saying "based on hard data, I'm 75% confident this is a good buy." Higher scores increase confidence, but it's capped at 95% to prevent overconfidence.

### Phase 6: Confidence Adjustments (Secondary Factors)

After base confidence is set, we adjust based on qualitative factors:

#### News Sentiment Adjustment
```typescript
if (newsSentiment === 'BULLISH') {
  confidenceAdjustment += 5;
  reasoning.push('+5% confidence: Bullish news sentiment');
}
else if (newsSentiment === 'BEARISH') {
  confidenceAdjustment -= 5;
  reasoning.push('-5% confidence: Bearish news sentiment');
}
```

#### Analyst Consensus Adjustment
```typescript
if (buyPercent >= 70) {
  confidenceAdjustment += 5;
  reasoning.push(`+5% confidence: ${buyPercent}% of analysts recommend buying`);
}
else if (buyPercent <= 30) {
  confidenceAdjustment -= 5;
  reasoning.push(`-5% confidence: Only ${buyPercent}% of analysts recommend buying`);
}
```

#### Insider Activity Adjustment
```typescript
if (insiderActivity === 'BUYING') {
  confidenceAdjustment += 3;
  reasoning.push('+3% confidence: Insider buying detected');
}
else if (insiderActivity === 'SELLING') {
  confidenceAdjustment -= 2;
  reasoning.push('-2% confidence: Insider selling');
}
```

#### Price Target Adjustment
```typescript
const targetUpside = ((analystTargetPrice - currentPrice) / currentPrice) * 100;

if (targetUpside > 20) {
  confidenceAdjustment += 5;
  reasoning.push(`+5% confidence: ${targetUpside}% upside to analyst target`);
}
else if (targetUpside < -10) {
  confidenceAdjustment -= 5;
  reasoning.push(`-5% confidence: Analysts see ${targetUpside}% downside`);
}
```

**Maximum Adjustments**: +18% / -17%

### Phase 7: Chart Pattern Bonus/Penalty

Professional chart patterns get special treatment:

```typescript
// CONFIRMED patterns only (not "forming")
if (chartPatterns.actionable && chartPatterns.confirmed.length > 0) {
  
  // Bullish patterns (for BUY recommendations)
  if (pattern === 'Cup & Handle' && confidence >= 70) {
    patternBonus += 12;
  }
  else if (pattern === 'Inverse Head & Shoulders' && confidence >= 70) {
    patternBonus += 10;
  }
  else if (pattern === 'Double Bottom' && confidence >= 70) {
    patternBonus += 10;
  }
  
  // Bearish patterns (penalize BUY recommendations)
  if (suggestion === 'BUY' && pattern === 'Head & Shoulders') {
    patternBonus -= 12;
  }
  else if (suggestion === 'BUY' && pattern === 'Double Top') {
    patternBonus -= 10;
  }
}

// Conflicting patterns = heavy penalty
if (chartPatterns.hasConflict) {
  patternBonus = -15;
}
```

**Why this matters**: A confirmed Cup & Handle pattern with 70%+ confidence is a powerful bullish signal - worth +12% confidence. But if there are conflicting patterns (both bullish and bearish), we penalize -15% because uncertainty is high.

### Phase 8: Final Confidence Calculation

```typescript
const finalConfidence = Math.min(95, Math.max(25, 
  baseConfidence + confidenceAdjustment + patternBonus
));
```

**Hard Limits**:
- **Maximum**: 95% (never 100% - markets are uncertain)
- **Minimum**: 25% (never 0% - there's always some probability)

### Phase 9: Regime Detection & Meta-Calibration

The system also detects market regime to fine-tune confidence:

```typescript
function computeRegime(priceHistory, sma50, sma200) {
  const atrPercent = (ATR / price) * 100;
  const trendStrength = Math.abs(sma50 - sma200) / price * 100;
  
  if (atrPercent >= 4) return 'HIGH_VOL';
  if (trendStrength >= 2) return 'TREND';
  return 'RANGE';
}

// Regime adjustments
if (regime === 'TREND') conf += 3; // Trend-following works better in trends
if (regime === 'HIGH_VOL') conf -= 4; // High volatility = lower confidence
```

**Regimes Explained**:
- **TREND**: Clear direction (50 SMA far from 200 SMA) - confidence +3%
- **RANGE**: Sideways market - no adjustment
- **HIGH_VOL**: ATR >4% of price - confidence -4% (harder to predict)

### Phase 10: Completeness Check

```typescript
// How much data do we have?
const dataPoints = [
  fundamentals ? 1 : 0,
  technicals ? 1 : 0,
  news ? 1 : 0,
  analysts ? 1 : 0,
  insiders ? 1 : 0
].reduce((a,b) => a+b) / 5 * 100;

if (dataPoints >= 90) conf += 4; // Have all data = +4%
if (dataPoints < 80) conf -= 12; // Missing data = -12%
```

**Why this matters**: If we have all 5 data sources (fundamentals, technicals, news, analysts, insiders), we boost confidence by 4%. If we're missing >20% of data, we reduce confidence by 12%.

### Phase 11: Agreement Threshold

```typescript
// How many factors agree on direction?
const bullishFactors = [
  technicalScore >= 5 ? 1 : 0,
  fundamentalScore >= 5 ? 1 : 0,
  newsSentiment === 'BULLISH' ? 1 : 0,
  analystConsensus >= 70 ? 1 : 0,
  insiderActivity === 'BUYING' ? 1 : 0,
].reduce((a,b) => a+b);

if (agreementCount >= 5) conf += 6; // All 5 agree = +6%
if (agreementCount === 4) conf += 2; // 4 agree = +2%
if (agreementCount < 3) conf -= 10; // Disagreement = -10%
```

**Why this matters**: If all 5 major factors (technical, fundamental, news, analysts, insiders) agree on BUY, we boost confidence by 6%. If fewer than 3 agree, we reduce by 10%.

## Real-World Example Walkthrough

Let's analyze **AAPL** (Apple) as of a hypothetical date:

### Step 1: Data Collection
```
Price: $180.00
SMA50: $170.00
SMA200: $165.00
RSI: 62
P/E: 28
ROE: 42%
News sentiment: 78% bullish
Analyst consensus: 85% buy
Insider activity: Net buying $2M
Chart pattern: Cup & Handle (82% confidence)
```

### Step 2: Technical Score
```
✓ Price > SMA50 * 1.02 → $180 > $173.40 = TRUE (+1)
✓ Price > SMA200 → $180 > $165 = TRUE (+1)
✓ SMA50 > SMA200 → $170 > $165 = TRUE (+1)
✓ RSI in range → 30 < 62 < 70 = TRUE (+1)
✓ MACD positive and above signal → TRUE (+1)
✓ Price in lower Bollinger → TRUE (+1)
✗ Volume > 1.5x avg → FALSE (0)
✓ Price < 52-week high * 0.9 → TRUE (+1)
✓ ATR < 5% → TRUE (+1)

Technical Score: 8/9
```

### Step 3: Fundamental Score
```
✗ P/E < 25 → 28 > 25 = FALSE (0)
✓ P/B < 5 → TRUE (+1)
✓ ROE > 15% → 42% > 15% = TRUE (+1)
✓ ROA > 5% → TRUE (+1)
✓ Debt/Equity < 2 → TRUE (+1)
✓ Current Ratio > 1.5 → TRUE (+1)
✓ Profit Margin > 10% → TRUE (+1)
✓ Revenue Growth > 10% → TRUE (+1)
✓ EPS Growth > 15% → TRUE (+1)

Fundamental Score: 8/9
```

### Step 4: Combined Score
```
Combined Score = 8 + 8 = 16/18
```

### Step 5: Base Confidence
```
Score 16 is in the 14-18 range (STRONG BUY)
baseConfidence = 75 + (16 - 14) * 5 = 85%
```

### Step 6: Adjustments
```
News (78% bullish) → +5%
Analysts (85% buy) → +5%
Insiders (buying) → +3%
Price target (+25% upside) → +5%

Total adjustments: +18%
```

### Step 7: Pattern Bonus
```
Cup & Handle confirmed at 82% → +12%
```

### Step 8: Final Calculation
```
Base: 85%
Adjustments: +18%
Pattern: +12%
Subtotal: 115%

Capped at 95%: finalConfidence = 95%
```

### Step 9: Recommendation
```
Type: BUY
Strategy: Strong Buy - Excellent Fundamentals & Technicals
Confidence: 95%
Risk Level: LOW
```

### Reasoning Output:
```
• Combined Score: 16/18 (Technical 8/9 + Fundamental 8/9)
• +5% confidence: Bullish news sentiment (78%)
• +5% confidence: 85% of analysts recommend buying
• +3% confidence: Insider buying detected
• +5% confidence: 25% upside to analyst target
• +12% confidence: CONFIRMED BULLISH Cup & Handle pattern (82%)
```

## Key Design Principles

### 1. **Conservative by Design**
- Hard cap at 95% (never 100%)
- Hard floor at 25% (never 0%)
- Strict agreement requirements for high confidence
- Heavy penalties for missing data or disagreement

### 2. **Multi-Factor Validation**
- Requires alignment across technical, fundamental, qualitative
- Single strong factor can't override multiple weak factors
- Designed to prevent false positives

### 3. **Transparency**
- Every confidence adjustment is explained
- Users see exactly why score is what it is
- Detailed breakdowns available

### 4. **Continuous Calibration**
- Tracks actual outcomes vs predicted confidence
- Measures win rates by confidence bucket
- Provides feedback loop for improvement

### 5. **Pattern Recognition Rigor**
- Uses strict mathematical criteria
- Requires volume confirmation
- Detects conflicts between patterns
- Only applies bonuses to confirmed patterns (not forming)

## Confidence Bucket Interpretation

After all calculations, the final confidence is bucketed:

**HIGH (75-95%)**:
- Strong agreement across all factors
- Complete data available
- Confirmed chart patterns aligned
- Low-medium volatility environment
- **Expected win rate: 70-80%**

**MED (60-74%)**:
- Good agreement (4/5 factors align)
- Most data available
- May have forming (not confirmed) patterns
- Normal volatility
- **Expected win rate: 60-70%**

**LOW (25-59%)**:
- Mixed signals (3 or fewer factors agree)
- Missing some data
- Conflicting patterns or high volatility
- **Expected win rate: 50-60%**

## What the System Does NOT Do

**Not ML/AI** in the traditional sense:
- No neural networks
- No black-box predictions
- No learning from past trades (yet)
- Pure rule-based scoring with calibration

**Not Predictive** of specific prices:
- Doesn't say "will reach $200"
- Says "has 85% probability of upward movement"

**Not High-Frequency**:
- Daily timeframe focus
- Not suitable for scalping or day trading

## Summary

The decision logic is a **multi-layered scoring system** that:
1. Evaluates 18 hard metrics (technical + fundamental)
2. Adjusts for 5 qualitative factors (news, analysts, insiders, targets, patterns)
3. Applies regime detection and completeness checks
4. Calibrates confidence conservatively
5. Caps at 95% and floors at 25%
6. Provides full transparency in reasoning

The result is a **confidence-calibrated recommendation** (BUY/SELL/HOLD) with specific reasoning, designed to be accurate and actionable.
