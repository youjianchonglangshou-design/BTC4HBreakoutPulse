/** BTCFLOWPulse proven public market-data pipeline, Pionex PERP exclusively.
 * TV chart protocol via the user's existing Worker, plus official Pionex Worker REST fallback.
 * Deliberately NO Binance ticker/candle substitutions. */
import {fetchTradingViewHistory} from './tv_history.js';
export const PIONEX_SYMBOL='BTC_USDT_PERP';
export const TV_SYMBOL='PIONEX:BTCUSDT.P';
export const WORKER='https://white-meadow-16bc.youjianchonglangshou.workers.dev';
const TV_SCAN='https://scanner.tradingview.com/crypto/scan';
const BAR_MS={'4h':14400000,'15m':900000,'1d':86400000};
const PIONEX_INTERVAL={'4h':'4H','15m':'15M','1d':'1D'};
const MAX_BARS={'4h':2400,'15m':500,'1d':300};
const good=n=>Number.isFinite(n)&&n>0;
async function fetchJSON(url,options={},timeout=12000){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeout);
 try{
  const response=await fetch(url,{...options,signal:controller.signal,cache:'no-store'});
  if(!response.ok)throw Error(`HTTP ${response.status} @ ${new URL(url).host}`);
  const j=await response.json();if(j?.ok===false)throw Error(j.error||j.message||'Worker API error');return j;
 }finally{clearTimeout(timer);}
}
export function normalizePionexKlines(payload,interval){
 const step=BAR_MS[interval];
 if(!Array.isArray(payload))throw Error('Pionex historical data is not an array');
 return [...new Map(payload.map(r=>{
  const t=Array.isArray(r)?r[0]:r?.time??r?.ts??r?.timestamp;
  let ts=Number(t);if(ts>0&&ts<1e12)ts*=1000;
  const [open,high,low,close,volume]=Array.isArray(r)?r.slice(1,6):[r?.open,r?.high,r?.low,r?.close,r?.volume];
  return {ts,open:+open,high:+high,low:+low,close:+close,volume:+(volume??0)};
 }).filter(x=>Number.isFinite(x.ts)&&x.ts%step===0&&[x.open,x.high,x.low,x.close].every(good)).map(x=>[x.ts,x])).values()].sort((a,b)=>a.ts-b.ts);
}
export async function fetchWorkerPionexKlines(interval,count,{refresh=false}={}){
 if(!BAR_MS[interval])throw Error('unsupported interval');
 const url=new URL('/api/monitor/klines',WORKER);
 url.searchParams.set('symbol',PIONEX_SYMBOL);
 url.searchParams.set('interval',PIONEX_INTERVAL[interval]);
 url.searchParams.set('limit',String(Math.min(300,count)));
 if(refresh)url.searchParams.set('refresh','1');
 const j=await fetchJSON(url.toString());
 const bars=normalizePionexKlines(j.klines??[],interval);
 if(!bars.length)throw Error(`Worker Pionex ${PIONEX_INTERVAL[interval]} history empty`);
 return {bars,source:`Worker Pionex ${PIONEX_SYMBOL} ${PIONEX_INTERVAL[interval]}`,fetchedAt:j.fetched_at};
}
export async function fetchPionexKlines(interval,count,{timeoutMs=25000}={}){
 if(!BAR_MS[interval])throw Error('unsupported interval');
 const target=Math.max(2,Math.min(MAX_BARS[interval],Math.trunc(count)||2));
 try{
  const r=await fetchTradingViewHistory({workerBaseUrl:WORKER,symbol:TV_SYMBOL,
   resolution:interval==='4h'?'240':interval==='1d'?'1D':'15',bars:target,timeoutMs});
  const bars=normalizePionexKlines(r.bars,interval);
  if(bars.length<2)throw Error('TradingView Pionex candles insufficient');
  return {bars,source:`TradingView chart → ${TV_SYMBOL} ${interval}`,fetchedAt:Date.now()};
 }catch(tvError){
  try{
   const rest=await fetchWorkerPionexKlines(interval,target);
   return {...rest,warning:`TradingView chart unavailable: ${tvError.message}`};
  }catch(workerError){throw Error(`PIONEX ${interval} history failed: TV ${tvError.message}; Worker ${workerError.message}`);}
 }
}
export const fetchKlines=(interval,count)=>fetchPionexKlines(interval,count);
export const fetchLatestKlines=(interval,count)=>fetchPionexKlines(interval,count,{timeoutMs:18000});
export function decodeScannerPayload(json){
 const r=(json?.data||[]).find(x=>String(x?.s||'').toUpperCase()===TV_SYMBOL);
 const n=Number(r?.d?.[0]);return {pionex:good(n)?n:null,spot:null};
}
export async function fetchQuotes(){
 let scanError=null;
 try{
  const body={filter:[],options:{lang:'en'},symbols:{query:{types:[]},tickers:[TV_SYMBOL]},columns:['close'],range:[0,10]};
  const j=await fetchJSON(TV_SCAN,{method:'POST',mode:'cors',headers:{Accept:'application/json','Content-Type':'text/plain'},body:JSON.stringify(body)},9000);
  const p=decodeScannerPayload(j).pionex;
  if(good(p))return {pionex:p,source:`TradingView Scanner ${TV_SYMBOL}`,ts:Date.now()};
  throw Error('Pionex BTC quote absent from Scanner');
 }catch(e){scanError=e;}
 try{
  const j=await fetchJSON(`${WORKER}/api/monitor/tickers?type=PERP`,{},9000);
  const r=(j.tickers||[]).find(x=>String(x.symbol||'').toUpperCase()===PIONEX_SYMBOL);
  const p=Number(r?.price);
  if(!good(p))throw Error('Pionex BTC_USDT_PERP quote absent');
  return {pionex:p,source:'Worker Pionex PERP backup',ts:Date.now(),warning:scanError.message};
 }catch(e){throw Error(`PIONEX 即時行情無法讀取：TV ${scanError.message}; Worker ${e.message}`);}
}
