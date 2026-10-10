// All model boundaries are absolute UTC offsets; TPE is UTC+8 without DST.
export const MINUTE=60_000, HOUR=60*MINUTE, DAY=24*HOUR;
export const TPE_OFFSET=8*HOUR;
export function taiwanDate(ts=Date.now()){
  const d=new Date(ts+TPE_OFFSET);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`;
}
export function tpeClock(ts=Date.now()){
  const d=new Date(ts+TPE_OFFSET);
  return [d.getUTCHours(),d.getUTCMinutes(),d.getUTCSeconds()].map(x=>String(x).padStart(2,'0')).join(':');
}
export function tpeTime(ts){
  if(!Number.isFinite(ts))return '—';
  return `${taiwanDate(ts)} ${tpeClock(ts).slice(0,5)}`;
}
export function tpeDayStart(ts){return Math.floor((ts+TPE_OFFSET)/DAY)*DAY-TPE_OFFSET;}
export function tpeHour(ts){return new Date(ts+TPE_OFFSET).getUTCHours();}
export function cutoffAt20(ts){return tpeDayStart(ts)+20*HOUR;}
export function forecastWindow(ts){
  const cut=cutoffAt20(ts);
  return {date:taiwanDate(ts),cut, end:cut+4*HOUR,pre:ts<cut,post:ts>=cut};
}
