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
 const slope=(mids.at(-1)/mids.at(-2)-1)*100;
 // Simple mean 5-day midline slope (for display, not a learned v6 factor).
 const vals=mids.slice(-6);const slope5=vals.length===6&&vals.every(Number.isFinite)?
  100*vals.slice(1).reduce((s,x,i)=>s+(x/vals[i]-1),0)/5:slope;
 const prev=mids.slice(-11,-6);
 const prevSlope=prev.length===5&&prev.every(Number.isFinite)?100*prev.slice(1).reduce((s,x,i)=>s+(x/prev[i]-1),0)/4:0;
 const isRising=slope5>=0.12,flat=slope5>-.25;
 const slopeLabel=isRising?'上斜':flat?'走平':slope5>=-.65&&slope5-prevSlope>=.12?'下降走平中':'下斜';
 return {averageK:latest.close>=latest.open?'黃':'紫',haClose:latest.close,haOpen:latest.open,midline:mid,
   above:latest.close>=mid,side:latest.close>=mid?'中軌之上':'中軌之下',slopePctPerDay:slope5,slopeLabel,
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
