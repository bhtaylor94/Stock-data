// Starter universe: core ETFs + ~100 large/mega-cap US equities.
// Later: replace with live S&P 500 constituents feed.

export const DEFAULT_UNIVERSE: string[] = [
  // ETFs
  'SPY','QQQ','IWM','DIA','VOO','VTI','XLK','XLF','XLE','XLV','XLI','XLP','XLY','XLU','XLB','XLRE','XLC',

  // Mega / large caps (approx top names)
  'AAPL','MSFT','NVDA','AMZN','META','GOOGL','GOOG','TSLA','BRK.B','LLY','AVGO','JPM','V','MA','XOM','UNH','COST','PG','HD','MRK',
  'ABBV','KO','PEP','ADBE','CRM','WMT','BAC','CVX','ORCL','NFLX','TMO','ACN','LIN','MCD','AMD','CSCO','INTC','QCOM','TXN','AMGN',
  'DHR','NKE','ABT','PFE','PM','WFC','MS','GS','BLK','SCHW','AXP','UPS','CAT','BA','GE','HON','UNP','DE','LMT','RTX',
  'SPGI','CB','PGR','MMC','AON','C','LOW','SBUX','TGT','DIS','BKNG','CMCSA','INTU','NOW','IBM','AMAT','MU','ADI','LRCX','KLAC',
  'ISRG','SYK','MDT','VRTX','REGN','GILD','ZTS','CI','ELV','DUK','SO','NEE','COP','SLB','EOG','OKE','FDX','ADP','CSX','NSC',
  'TJX','CME','ICE','PLD','EQIX','PSA','O','SNPS','CDNS','PANW','CRWD','FTNT','SHOP','UBER','PYPL','SQ','TSM','ASML'
].map((s) => s.toUpperCase());
