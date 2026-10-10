import test from 'node:test';
import assert from 'node:assert/strict';
import {decodeScannerPayload,normalizePionexKlines,PIONEX_SYMBOL,TV_SYMBOL,fetchQuotes,fetchWorkerPionexKlines} from '../src/feeds.js';
import {formatBtcTabTitle,updateBtcTabTitle} from '../src/tab_title.js';
test('Scanner MUST use PIONEX:BTCUSDT.P, ignores Binance quote even if present',()=>{
 const data=decodeScannerPayload({data:[{s:'BINANCE:BTCUSDT',d:[82600.22]},{s:TV_SYMBOL,d:[82605.38]}]});
 assert.deepEqual(data,{pionex:82605.38,spot:null});
 assert.equal(decodeScannerPayload({data:[{s:'BINANCE:BTCUSDT',d:[77777]}]}).pionex,null);
});
test('4H Pionex Worker candle payload normalized by UTC bucket',()=>{
 const bars=normalizePionexKlines([{time:1760054400000,open:'100',high:'110',low:'90',close:'103',volume:'20'}],'4h');
 assert.equal(bars.length,1);assert.equal(bars[0].close,103);
});
test('Pionex worker klines API uses BTC_USDT_PERP with 4H and 1D',async()=>{
 const orig=globalThis.fetch,calls=[];
 globalThis.fetch=async(url)=>{
  calls.push(new URL(url));return {ok:true,json:async()=>({klines:[
   {time:1760054400000,open:'100',high:'102',low:'99',close:'101'},
   {time:1760068800000,open:'101',high:'103',low:'100',close:'102'}]})};
 };
 try{
  const data=await fetchWorkerPionexKlines('4h',200);
  assert.equal(data.bars.length,2);
  assert.equal(calls[0].searchParams.get('symbol'),PIONEX_SYMBOL);
  assert.equal(calls[0].searchParams.get('interval'),'4H');
 }finally{globalThis.fetch=orig;}
});
test('Pionex-only scanner failure falls back to Pionex Worker ticker, never Binance',async()=>{
 const original=globalThis.fetch,urls=[];
 globalThis.fetch=async(url)=>{
  urls.push(String(url));
  if(String(url).includes('scanner.tradingview.com'))return {ok:true,json:async()=>({data:[]})};
  if(String(url).includes('/api/monitor/tickers'))return {ok:true,json:async()=>({tickers:[{symbol:'BTC_USDT_PERP',price:'81555.25'}]})};
  throw Error('unknown URL');
 };
 try{const q=await fetchQuotes();assert.equal(q.pionex,81555.25);assert.equal(urls.length,2);assert.ok(urls.every(u=>!u.includes('binance')));}
 finally{globalThis.fetch=original;}
});
test('Browser tab keeps Pionex BTC quote',()=>{
 const doc={title:'BTC'};
 assert.equal(updateBtcTabTitle(82605.4,doc),true);
 assert.equal(doc.title,'BTC 82,605.4');
 assert.equal(updateBtcTabTitle(82605.4,doc),false);
 assert.equal(formatBtcTabTitle(null),'BTC');
});
