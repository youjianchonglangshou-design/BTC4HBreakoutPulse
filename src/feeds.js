const BINANCE_HOSTS=['https://data-api.binance.vision','https://api.binance.com'];
const BAR_MS={"4h":4*3600000,"15m":900000,"1d":86400000};
const fetchTimeout=async(url,opts={},timeoutMs=10000)=>{
 const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),timeoutMs);
 try{
  const response=await fetch(url,{...opts,signal:ctrl.signal,cache:'no-store'});
  if(!response.ok)throw Error(`HTTP ${response.status} @ ${new URL(url).host}`);
  return await response.json();
 }finally{clearTimeout(timer);}
};
export function parseBinanceBars(payload){
 if(!Array.isArray(payload))throw Error('歷史回傳不是陣列');
 return payload.map(r=>({ts:+r[0],open:+r[1],high:+r[2],low:+r[3],close:+r[4],volume:+r[5]}))
 .filter(b=>Number.isFinite(b.ts)&&[b.open,b.high,b.low,b.close].every(x=>Number.isFinite(x)&&x>0)).sort((a,b)=>a.ts-b.ts);
}
async function requestKlines(interval,limit,endTime){
 let lastError;
 for(const host of BINANCE_HOSTS){
  try{
   const p=new URLSearchParams({symbol:'BTCUSDT',interval,limit:String(limit)});
   if(Number.isFinite(endTime))p.set('endTime',String(endTime));
   return parseBinanceBars(await fetchTimeout(`${host}/api/v3/klines?${p.toString()}`));
  }catch(e){lastError=e;}
 }
 throw Error(`Binance ${interval} 無法讀取：${lastError?.message}`);
}
export async function fetchKlines(interval,count){
 if(!BAR_MS[interval])throw Error('unsupported interval');
 const target=Math.min(3000,Math.max(1,count));
 let out=[],end=undefined;
 while(out.length<target){
  const batch=await requestKlines(interval,Math.min(1000,target-out.length),end);
  if(!batch.length)break;
  out=batch.concat(out);
  if(batch.length<Math.min(1000,target-out.length+batch.length))break;
  end=batch[0].ts-1;
  if(out.length>=target)break;
 }
 return [...new Map(out.map(b=>[b.ts,b])).values()].sort((a,b)=>a.ts-b.ts).slice(-target);
}
export async function fetchLatestKlines(interval,limit=350){return requestKlines(interval,limit);}
const valid=n=>Number.isFinite(n)&&n>0;
export function decodeScannerPayload(json){
 const rows=(json?.data||[]),find=code=>rows.find(r=>String(r.s).toUpperCase()===code)?.d;
 const pion=find('PIONEX:BTCUSDT.P'),spot=find('BINANCE:BTCUSDT');
 return {pionex:valid(+pion?.[0])?+pion[0]:null,spot:valid(+spot?.[0])?+spot[0]:null};
}
export async function fetchQuotes(){
 let primaryErr=null;
 try{
  const body={filter:[],options:{lang:'en'},symbols:{query:{types:[]},tickers:['PIONEX:BTCUSDT.P','BINANCE:BTCUSDT']},columns:['close'],range:[0,10]};
  const json=await fetchTimeout('https://scanner.tradingview.com/crypto/scan',{
   method:'POST',mode:'cors',headers:{Accept:'application/json','Content-Type':'text/plain'},body:JSON.stringify(body)
  },9000);
  const data=decodeScannerPayload(json);
  if(data.pionex&&data.spot)return {...data,source:'TradingView Scanner',ts:Date.now()};
  if(data.pionex&&!data.spot){
   try{const x=await fetchTimeout('https://data-api.binance.vision/api/v3/ticker/price?symbol=BTCUSDT',{},9000);
    if(valid(+x.price))return {pionex:data.pionex,spot:+x.price,source:'TradingView Pionex + Binance spot backup',ts:Date.now()};
   }catch{}
   return {...data,source:'TradingView Pionex only',ts:Date.now()};
  }
  if(data.spot)return {...data,source:'TradingView Binance spot only',ts:Date.now()};
  primaryErr=new Error('Scanner returned no BTC quotes');
 }catch(e){primaryErr=e;}
 try{
  const j=await fetchTimeout('https://data-api.binance.vision/api/v3/ticker/price?symbol=BTCUSDT',{},9000);
  if(!valid(+j.price))throw Error('Bad Binance ticker');
  return {pionex:null,spot:+j.price,source:'Binance Spot backup',ts:Date.now(),warning:primaryErr?.message};
 }catch(e){throw Error(`即時行情無法讀取：${primaryErr?.message}; ${e.message}`);}
}
