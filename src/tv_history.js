const PREFIX="~m~";

function utf8Bytes(text){
  return new TextEncoder().encode(String(text)).length;
}
function frame(payload){
  const text=typeof payload==="string"?payload:JSON.stringify(payload);
  return `${PREFIX}${utf8Bytes(text)}${PREFIX}${text}`;
}
function encode(method,params=[]){
  return frame(JSON.stringify({m:method,p:params}));
}
function randomId(prefix){
  return `${prefix}_${Math.random().toString(36).slice(2,14)}`;
}

export function parseTvFrames(input){
  const text=typeof input==="string"?input:new TextDecoder().decode(input);
  const out=[];
  let offset=0;
  while(offset<text.length){
    const start=text.indexOf(PREFIX,offset);
    if(start<0)break;
    const lenEnd=text.indexOf(PREFIX,start+PREFIX.length);
    if(lenEnd<0)break;
    const byteLength=Number(text.slice(start+PREFIX.length,lenEnd));
    if(!Number.isInteger(byteLength)||byteLength<0){offset=lenEnd+PREFIX.length;continue;}
    const payloadStart=lenEnd+PREFIX.length;
    let payloadEnd=payloadStart,bytes=0;
    while(payloadEnd<text.length&&bytes<byteLength){
      const cp=text.codePointAt(payloadEnd);
      const ch=String.fromCodePoint(cp);
      bytes+=utf8Bytes(ch);
      payloadEnd+=ch.length;
    }
    if(bytes!==byteLength)break;
    out.push(text.slice(payloadStart,payloadEnd));
    offset=payloadEnd;
  }
  return out;
}

export function normalizeTvBar(row){
  const values=Array.isArray(row)?row:row?.v;
  if(!Array.isArray(values)||values.length<6)return null;
  const offset=values.length>=7?1:0;
  let ts=Number(values[offset]);
  const open=Number(values[offset+1]),high=Number(values[offset+2]),low=Number(values[offset+3]),close=Number(values[offset+4]),volume=Number(values[offset+5]??0);
  if(!Number.isFinite(ts)||![open,high,low,close].every(Number.isFinite))return null;
  if(ts<1e12)ts*=1000;
  return {ts,open,high,low,close,volume:Number.isFinite(volume)?volume:0,live:false,source:"TradingView PIONEX chart"};
}

export function workerChartWsUrl(baseUrl){
  const u=new URL(baseUrl);
  u.protocol=u.protocol==="https:"?"wss:":"ws:";
  u.pathname="/api/monitor/tv-chart-ws";
  u.search="";
  u.hash="";
  return u.toString();
}

export function fetchTradingViewHistory({
  workerBaseUrl,
  symbol="PIONEX:BTCUSDT.P",
  bars=128,
  resolution="15",
  timeoutMs=15000,
}={}){
  const target=Math.max(2,Math.min(2500,Math.trunc(Number(bars)||128)));
  const wsUrl=workerChartWsUrl(workerBaseUrl);
  return new Promise((resolve,reject)=>{
    const ws=new WebSocket(wsUrl);
    const chartSession=randomId("cs");
    const symbolId="symbol_1",seriesId="series_1";
    const byTime=new Map();
    let settled=false;
    const timer=setTimeout(()=>finishError(new Error("TradingView chart history timeout")),timeoutMs);

    const cleanup=()=>{
      clearTimeout(timer);
      try{if(ws.readyState===WebSocket.OPEN||ws.readyState===WebSocket.CONNECTING)ws.close(1000,"history complete");}catch(_){}
    };
    const finishError=(err)=>{
      if(settled)return;settled=true;cleanup();reject(err);
    };
    const finishOk=()=>{
      if(settled)return;
      const rows=[...byTime.values()].sort((a,b)=>a.ts-b.ts).slice(-target);
      if(rows.length<2)return finishError(new Error(`TradingView ${resolution} history returned only ${rows.length} bars`));
      settled=true;cleanup();resolve({bars:rows,source:`TradingView chart WebSocket · PIONEX ${resolution}`,endpoint:wsUrl});
    };
    const handleText=(text)=>{
      for(const payload of parseTvFrames(text)){
        if(payload.startsWith("~h~")){
          try{ws.send(frame(payload));}catch(_){}
          continue;
        }
        let raw;try{raw=JSON.parse(payload);}catch{continue;}
        const type=raw?.m,params=raw?.p||[];
        if(["protocol_error","critical_error","symbol_error","series_error"].includes(type)){
          finishError(new Error(`TradingView chart rejected request: ${type} ${params.at(-1)||""}`.trim()));
          return;
        }
        if(type==="timescale_update"&&params[0]===chartSession){
          const series=params?.[1]?.[seriesId];
          for(const row of (series?.s||[])){
            const bar=normalizeTvBar(row);
            if(bar)byTime.set(bar.ts,bar);
          }
        }
        if(type==="series_completed"&&params[0]===chartSession&&params[1]===seriesId){
          finishOk();
          return;
        }
      }
    };

    ws.addEventListener("open",()=>{
      try{
        ws.send(encode("set_auth_token",["unauthorized_user_token"]));
        ws.send(encode("chart_create_session",[chartSession,""]));
        ws.send(encode("switch_timezone",[chartSession,"Etc/UTC"]));
        const descriptor={symbol,adjustment:"splits",session:"regular"};
        ws.send(encode("resolve_symbol",[chartSession,symbolId,`=${JSON.stringify(descriptor)}`]));
        ws.send(encode("create_series",[chartSession,seriesId,"s1",symbolId,resolution,target,""]));
      }catch(e){finishError(e);}
    });
    ws.addEventListener("message",async(event)=>{
      try{
        let data=event.data;
        if(typeof Blob!=="undefined"&&data instanceof Blob)data=await data.text();
        else if(data instanceof ArrayBuffer)data=new TextDecoder().decode(data);
        handleText(String(data));
      }catch(e){finishError(e);}
    });
    ws.addEventListener("error",()=>finishError(new Error("TradingView chart WebSocket connection failed")));
    ws.addEventListener("close",(event)=>{
      if(!settled)finishError(new Error(`TradingView chart WebSocket closed ${event.code}`));
    });
  });
}
