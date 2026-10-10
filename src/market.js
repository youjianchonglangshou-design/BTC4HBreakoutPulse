// SState-compatible daily HA + 20-period Bollinger midline; excludes CCI entirely.
const DAY=86400000;
export const asBar=r=>({ts:Number(r.ts??r.time),open:Number(r.open),high:Number(r.high),low:Number(r.low),close:Number(r.close),volume:Number(r.volume??0)});
export function normalizeBars(rows){
  return [...new Map((rows||[]).map(asBar).filter(x=>Number.isFinite(x.ts)&&[x.open,x.high,x.low,x.close].every(v=>Number.isFinite(v)&&v>0)).map(x=>[x.ts,x])).values()].sort((a,b)=>a.ts-b.ts);
}
export function atr14(rows,asOf=Infinity){
 const bars=normalizeBars(rows).filter(b=>b.ts+14400000<=asOf);
 if(bars.length<15)return null;
 const xs=[];
 for(let i=bars.length-14;i<bars.length;i++){
  const b=bars[i],prev=bars[i-1];
  xs.push(Math.max(b.high-b.low,Math.abs(b.high-prev.close),Math.abs(b.low-prev.close)));
 }
 return xs.reduce((a,b)=>a+b,0)/xs.length;
}
/** SStateMarketTerminal monitor-engine.js: five-point linear regression of the
 * 20-day Bollinger midline, compared with the previous five-point regression.
 * This is a display feature; v6.0 probability weights remain unchanged. */
export function midlineSlopeRegime(mids){
 const slopePctPerDay=raw=>{
  const vals=raw.map(Number);
  if(vals.length<2 || !vals.every(Number.isFinite))return 0;
  const mean=vals.reduce((a,b)=>a+b,0)/vals.length;
  if(Math.abs(mean)<1e-18)return 0;
  const xm=(vals.length-1)/2;
  let den=0,top=0;
  for(let i=0;i<vals.length;i++){
   den+=(i-xm)**2;
   top+=(i-xm)*(vals[i]-mean);
  }
  return den>0?(top/den)/Math.abs(mean)*100:0;
 };
 const recent=mids.slice(-5),prior=mids.length>=10?mids.slice(-10,-5):mids.slice(0,-5);
 const recentSlope=slopePctPerDay(recent);
 const previousSlope=prior.length>=2?slopePctPerDay(prior):recentSlope;
 const improvement=recentSlope-previousSlope;
 if(recentSlope>=0.12)return {state:'rising',label:'上斜',symbol:'↑',value:recentSlope,previousSlope,improvement};
 if(recentSlope>-.25)return {state:'flat',label:'平緩',symbol:'→',value:recentSlope,previousSlope,improvement};
 if(recentSlope>=-.65 && improvement>=.12)return {state:'flattening',label:'下降走平中',symbol:'↘',value:recentSlope,previousSlope,improvement};
 return {state:'falling',label:'下斜',symbol:'↓',value:recentSlope,previousSlope,improvement};
}

export function dailySignal(input,now=Date.now(),override=null){
 let bars=normalizeBars(input),start=Math.floor(now/DAY)*DAY;
 bars=bars.filter(b=>b.ts<=start);
 if(override){
  const b=asBar(override);
  if(b.ts!==start||![b.open,b.high,b.low,b.close].every(v=>Number.isFinite(v)&&v>0))return null;
  bars=bars.filter(x=>x.ts!==start).concat(b).sort((a,b)=>a.ts-b.ts);
 }
 if(bars.length<35)return null;
 const ha=[];let po=0,pc=0;
 for(let i=0;i<bars.length;i++){
  const c=bars[i],hc=(c.open+c.high+c.low+c.close)/4,ho=i?(po+pc)/2:(c.open+c.close)/2;
  ha.push({close:hc,open:ho});po=ho;pc=hc;
 }
 const mids=[];
 for(let i=0;i<bars.length;i++){
  if(i<19){mids.push(null);continue;}
  mids.push(bars.slice(i-19,i+1).reduce((s,x)=>s+x.close,0)/20);
 }
 const latest=ha.at(-1),mid=mids.at(-1);
 if(!(mid>0))return null;
 const regime=midlineSlopeRegime(mids.filter(Number.isFinite));
 return {averageK:latest.close>=latest.open?'黃':'紫',haClose:latest.close,haOpen:latest.open,midline:mid,
   above:latest.close>=mid,side:latest.close>=mid?'中軌之上':'中軌之下',
   slopePctPerDay:regime.value,slopeLabel:regime.label,slopeState:regime.state,slopeSymbol:regime.symbol,
   slopeImprovementPct:regime.improvement,
   midDistancePct:(latest.close/mid-1)*100,barTime:bars.at(-1).ts};
}
export function buildPartialDaily(bars15,cut){
 const todayStart=Math.floor((cut-1)/DAY)*DAY;
 const bars=normalizeBars(bars15).filter(b=>b.ts>=todayStart&&b.ts+900000<=cut);
 // Strict: all 48 x 15m candles from 08:00 to 20:00 Taiwan available.
 if(cut-todayStart===12*3600000 && (bars.length!==48 || bars[0].ts!==todayStart || bars.at(-1).ts!==cut-900000 || bars.some((b,i)=>i>0&&b.ts!==bars[i-1].ts+900000)))return null;
 if(!bars.length)return null;
 return {ts:todayStart,open:bars[0].open,high:Math.max(...bars.map(b=>b.high)),low:Math.min(...bars.map(b=>b.low)),close:bars.at(-1).close};
}
