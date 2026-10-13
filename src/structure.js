/* BTC 4H structural breakout v4 - pure JS, no network, no GitHub Actions.
   20:00 reference model, Binance spot 2017-2023 model training; Pionex current market data, 2024-2026 untouched holdout.
   For historical stress testing, not an execution / financial advice engine.
 */
export const BREAK_MODEL_V4 = Object.freeze({
  intercept:-1.1692980874966565,
  distance:{median:0.30639447814339316,mean:0.4436942647717704,scale:0.43991900556613506,coef:-0.9988704781098545},
  isTop:{median:0,mean:0.49800531914893614,scale:0.4999960212324717,coef:0.061816973238224195},
  period:'trained through 2023-12-31; holdout 2024-2026',
  scope:'20:00 (Asia/Taipei) to 00:00 +08 next day final 4H close',
  tolerancePct:0.00015, confirms:3, breakPct:0.00010, touchTolerancePct:0.00090
});
export function breakoutProbability({price, level, atr, kind}){
  const p=Number(price), q=Number(level), a=Number(atr);
  if(!Number.isFinite(p)||!Number.isFinite(q)||!Number.isFinite(a)||p<=0||q<=0||a<=0) throw Error('price, level, atr must be positive');
  if(kind!=='頂齊'&&kind!=='底齊')throw Error('kind must be 頂齊 or 底齊');
  const dir=kind==='頂齊'?1:-1;
  if((q-p)*dir<=0) return {status:'ALREADY_BEYOND',probability:null,reason:'此模型僅適用20:00時價格尚在關卡前方；回測/守住是不同事件'};
  const distance=Math.abs(q-p)/a, flag=dir===1?1:0;
  const z=BREAK_MODEL_V4.intercept+(distance-BREAK_MODEL_V4.distance.mean)/BREAK_MODEL_V4.distance.scale*BREAK_MODEL_V4.distance.coef+(flag-BREAK_MODEL_V4.isTop.mean)/BREAK_MODEL_V4.isTop.scale*BREAK_MODEL_V4.isTop.coef;
  return {status:'OK',probability:1/(1+Math.exp(-Math.max(-60,Math.min(60,z)))),distanceATR:distance,barrier:level,kind,condition:'20:00 已知資料，00:00 收盤有效穿越',warning:'機率主要由ATR標準化距離驅動；黃紫、斜率、歷史觸碰未經證明帶來穩定額外優勢'};
}
const N=x=>Number(x);
function asBar(b){return {ts:N(b.ts??b.time),open:N(b.open),high:N(b.high),low:N(b.low),close:N(b.close)};}
function near(a,b,tol=.00015){return Math.abs(a-b)<=Math.max(1e-9,Math.abs(b))*tol;}
/** flow.js 4H port. `asOf` is in UTC millis; bars must carry UTC bar-OPEN ts. No unclosed bars. */
export function scanHistoricalAlignments(input,asOf,config={}){
  const tol=config.openTolerancePct??BREAK_MODEL_V4.tolerancePct;
  const maxc=config.confirmBars??BREAK_MODEL_V4.confirms;
  const bars=input.map(asBar).filter(b=>b.ts+14400000<=asOf).sort((a,b)=>a.ts-b.ts);
  const events=[];
  for(let i=0;i<bars.length-1;i++){
    const s=bars[i],turn=bars[i+1];
    if(turn.ts!==s.ts+14400000)continue;
    const top=s.close>s.open&&turn.close<turn.open&&near(turn.open,s.close,tol);
    const floor=s.close<s.open&&turn.close>turn.open&&near(turn.open,s.close,tol);
    if(!top&&!floor)continue;
    for(let j=i+1;j<=Math.min(bars.length-1,i+maxc);j++){
      const b=bars[j];if(b.ts!==s.ts+(j-i)*14400000)break;
      if((top&&b.close<s.low)||(floor&&b.close>s.high)){
        events.push({id:`${s.ts}-${top?'T':'F'}`,kind:top?'頂齊':'底齊',level:s.close,formed:s.ts,turnTs:turn.ts,confirmed:b.ts+14400000,start:j+1});break;
      }
    }
  }
  return {bars,events};
}
function touchEpisodes(ev,bars,now,zoneTol){
 let n=0,last=-99, lastTs=null, crossCount=0,prev=null;
 const p=ev.level,top=ev.kind==='頂齊';
 for(let i=ev.start;i<bars.length;i++){
  const b=bars[i];if(b.ts+14400000>now)break;
  const touched=b.low<=p*(1+zoneTol)&&b.high>=p*(1-zoneTol);
  if(touched){if(i-last>2)n++;last=i;lastTs=b.ts+14400000;}
  const crossed=top?b.close>p*(1+.0001):b.close<p*(1-.0001);
  const previously=prev===null?false:prev;
  if(crossed&&!previously)crossCount++;
  prev=crossed;
 }
 return {episodes:n,lastTouch: lastTs,crossCount};
}
/**
 * Structure-first selection, v1.2.13.
 *
 * Strictly causal: only confirmed alignments at asOf are eligible.
 * Recent rotation is more relevant than arbitrary old price coincidences.
 * If recent bars have no forward-facing alignment, widen the historical search.
 * No hard max-touch filter: many touches can describe a box / absorption,
 * rather than making the level disappear from existence.
 *
 * This changes the selected sample population. Existing v6 probabilities were
 * trained on the previous selection rule and MUST be revalidated / calibrated.
 */
export const SEARCH_TIERS_4H=Object.freeze([50,150,450,Infinity]);
export const SELECTION_RULE_VERSION='structure-first-v1';

/** Pure candidate selection, exported for tests and UI diagnostic audits. */
export function selectStructureCandidate(events,{asOf,price,kind,tiers=SEARCH_TIERS_4H,maxAgeDays=365}={}){
 const dir=kind==='頂齊'?1:kind==='底齊'?-1:0;
 if(!dir||!Number.isFinite(price)||price<=0||!Number.isFinite(asOf))return null;
 const eligible=events.filter(e=>
   e.kind===kind&&e.confirmed<=asOf&&e.confirmed>0&&e.formed<e.confirmed&&
   asOf-e.confirmed<=maxAgeDays*86400000&&
   (e.level-price)*dir>0);
 // Highest floor below the market / lowest top above the market *within the
 // first recent window that contains ANY valid, already-confirmed level*.
 for(const windowBars of tiers){
   const tier=eligible.filter(e=>!Number.isFinite(windowBars)||asOf-e.formed<=windowBars*14400000);
   if(!tier.length)continue;
   tier.sort((a,b)=>dir*(a.level-b.level)||(b.confirmed-a.confirmed));
   const picked=tier[0];
   return {...picked,searchWindowBars:windowBars,selectionRule:SELECTION_RULE_VERSION,
     recentCandidates:tier.length};
 }
 return null;
}

/**
 * maxDistanceATR has been RETAINED as old API input but is NOT an eligibility
 * filter. Rejecting a recently formed barrier just because it is 3+ ATR away
 * made the engine skip the user's current box and select an unrelated old line.
 * Instead we return distanceATR / outsideV6DistanceRange so the caller can
 * report that the original model is outside its validated distance domain.
 */
export function selectFirstBarrier(barHistory,asOf,price,atr,kind,{maxAgeDays=365,maxDistanceATR=3,maxTouches=8}={}){
 if(!Number.isFinite(atr)||atr<=0)return null;
 const {bars,events}=scanHistoricalAlignments(barHistory,asOf);
 const chosen=selectStructureCandidate(events,{asOf,price,kind,maxAgeDays});
 if(!chosen)return null;
 const hist=touchEpisodes(chosen,bars,asOf,.0009);
 const distanceATR=Math.abs(chosen.level-price)/atr;
 return {...chosen,...hist,distanceATR,
   outsideV6DistanceRange:distanceATR>maxDistanceATR,
   // Diagnostic only: old hard filter is intentionally disabled.
   exceedsLegacyTouchLimit:hist.episodes>maxTouches};
}
export function predictFromBars({bars,asOf,price,atr,aboveMidline}){
 const kind=aboveMidline?'頂齊':'底齊';
 const line=selectFirstBarrier(bars,asOf,price,atr,kind);
 if(!line) return {status:'NO_QUALIFIED_BARRIER',kind,probability:null,reason:'歷史尚未找到符合已確認、期限、距離、測試限制的第一道關卡'};
 return {...breakoutProbability({price,level:line.level,atr,kind}),level:line};
}
