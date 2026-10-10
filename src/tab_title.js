// Browser tab: use the exact same PIONEX/TradingView live quote as the main chart.
// This module never fetches prices or starts an independent polling timer.
export function formatBtcTabTitle(price) {
  const value=typeof price==='number'?price:Number(price);
  if (!Number.isFinite(value)||value<=0) return 'BTC';
  const digits=value>=1000?1:value>=1?2:4;
  return `BTC ${value.toLocaleString('en-US',{
    minimumFractionDigits:digits,maximumFractionDigits:digits,
  })}`;
}

export function updateBtcTabTitle(price, doc=globalThis.document) {
  if (!doc) return false;
  const title=formatBtcTabTitle(price);
  if (title==='BTC' || doc.title===title) return false;
  doc.title=title;
  return true;
}
