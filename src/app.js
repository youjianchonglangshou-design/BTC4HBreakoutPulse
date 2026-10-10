import {fetchKlines,fetchLatestKlines,fetchQuotes} from './feeds.js';
import {normalizeBars,atr14} from './market.js';
import {evaluate,freezeSnapshot,settlementForSnapshot} from './engine.js';
import {selectFirstBarrier} from './structure.js';
import {forecastWindow,taiwanDate,tpeClock,tpeTime,DAY} from './clock.js';
import {getFrozen,storeFrozen,getSettlement,storeSettlement,recentFrozenDates} from './storage.js';
import {renderCandles4h} from './chart.js';
import {updateBtcTabTitle} from './tab_title.js';
const $=id=>document.getElementById(id);
const S={fourHour:[],fifteenMin:[],daily:[],quotes:null,model:null,gate:null,
 historyUpdated:0,error:'',pollBusy:false,refreshBusy:false,initializing:true,lastPrediction:null};
const fmt=(n,d=1)=>Number.isFinite(n)?n.toLocaleString('en-US',{minimumFractionDigits:d,maximumFractionDigits:d}):'—';
const set=(id,str)=>{const e=$(id);if(e)e.textContent=String(str);};
const countdown=ms=>[Math.floor(Math.max(0,ms)/3600000),Math.floor(Math.max(0,ms)%3600000/60000),Math.floor(Math.max(0,ms)%60000/1000)].map(x=>String(x).padStart(2,'0')).join(':');
const ONE_HOUR=3600000;
function merge(old,rows,max=2700){return [...new Map([...old,...rows].map(r=>[r.ts,r])).values()].sort((a,b)=>a.ts-b.ts).slice(-max);}
function showError(){const el=$('error');el.hidden=!S.error;if(S.error)el.textContent=S.error;}
async function loadModel(){
 const [a,b]=await Promise.all(['model/v6.json','model/rule.json'].map(async p=>{
  const res=await fetch(p,{cache:'no-store'});if(!res.ok)throw Error(`${p} HTTP ${res.status}`);return res.json();
 }));S.model=a;S.gate=b;
}
async function loadHistory(initial=false){
 if(S.refreshBusy)return;S.refreshBusy=true;
 const tasks=initial?[
  ['fourHour',()=>fetchKlines('4h',2500)],['fifteenMin',()=>fetchKlines('15m',300)],['daily',()=>fetchKlines('1d',240)]
 ]:[
  ['fourHour',()=>fetchLatestKlines('4h',30)],['fifteenMin',()=>fetchLatestKlines('15m',300)],['daily',()=>fetchLatestKlines('1d',240)]
 ];
 const results=await Promise.allSettled(tasks.map(async([key,fn])=>({key,value:await fn()})));
 let failed=[];
 results.forEach((r,i)=>{
  if(r.status==='fulfilled'){
   const {key,value}=r.value;S[key]=merge(S[key],value,key==='fourHour'?2700:key==='fifteenMin'?500:270);}
  else failed.push(`${tasks[i][0]}: ${r.reason?.message||r.reason}`);
 });
 S.historyUpdated=Date.now();S.refreshBusy=false;S.initializing=false;
 S.error=failed.length?`K線載入部分失敗（可稍後重試）：${failed.join('；')}`:'';
 showError();render();
}
async function pollQuote(){
 if(S.pollBusy)return;S.pollBusy=true;
 try{
  const q=await fetchQuotes();S.quotes=q;
  const display=q.pionex??q.spot;
  if(display){updateBtcTabTitle(display);set('livePrice',fmt(display,1));}
  set('quoteSource',q.pionex?'PIONEX 永續合約現價':'Binance 現貨備援價格');
  set('connection',`10秒更新 · ${tpeClock(q.ts)}`);
 }catch(e){set('connection','即時行情連線失敗 · 重試中');S.error=e.message;showError();}
 finally{S.pollBusy=false;render();}
}
function extractQuotePrice(){return S.quotes?.spot??null;}
function createModelData(now){
 if(!S.model||!S.gate)return {status:'MODEL_LOADING',reason:'載入v6權重中'};
 return evaluate({fourHour:S.fourHour,fifteenMin:S.fifteenMin,daily:S.daily,
  model:S.model,gate:S.gate,price:extractQuotePrice(),asOf:now});
}
function freezeForDay(dayCut){
 if(!S.model||!S.gate||!S.fourHour.length||!S.fifteenMin.length||!S.daily.length)return null;
 // Do not freeze a cached 19:59 incomplete 15M or 4H bar as if it were the 20:00 close.
 // Seeing the first bar OPENING at/after the cutoff proves a post-cutoff historical refresh.
 if(!S.fifteenMin.some(b=>b.ts>=dayCut)||!S.fourHour.some(b=>b.ts>=dayCut))return {status:'FREEZE_WAIT_FOR_POST_CUTOFF_HISTORY'};
 const snapshot=freezeSnapshot({fourHour:S.fourHour,fifteenMin:S.fifteenMin,daily:S.daily,
  model:S.model,gate:S.gate,cut:dayCut});
 // NO_BARRIER is an honest immutable no-signal decision, not a forced score.
 if(['OK','NO_BARRIER'].includes(snapshot.status))return storeFrozen(taiwanDate(dayCut),snapshot);
 return snapshot;
}
function maybeFreezeAndSettle(now){
 if(S.initializing||!S.model||!S.gate)return;
 const current=forecastWindow(now);
 if(current.post&&!getFrozen(current.date))freezeForDay(current.cut);
 // Also reconstruct yesterday if opening the site after midnight, when 15m evidence is still available.
 const prior=forecastWindow(now-DAY);
 if(now>=prior.end&&!getFrozen(prior.date))freezeForDay(prior.cut);
 for(const date of recentFrozenDates()){
  const snap=getFrozen(date);
  if(!snap||getSettlement(date)||!snap.cut||now<snap.cut+4*ONE_HOUR)continue;
  const result=settlementForSnapshot(snap,S.fourHour,now);
  if(result.status==='SETTLED')storeSettlement(date,result);
 }
}
function setFeatureRows(rows){
 const el=$('featureList');el.replaceChildren();
 for(const [name,value] of rows){const div=document.createElement('div');div.className='feature';
  const l=document.createElement('span');l.textContent=name;const v=document.createElement('strong');v.textContent=value;
  div.append(l,v);el.append(div);
 }
}
function renderArchive(){
 const dates=recentFrozenDates(),el=$('archive');set('archiveCount',`${dates.length} 筆｜本裝置`);
 if(!dates.length){el.innerHTML='<p class="micro">尚無20:00凍結紀錄；日後若在有歷史資料的期間重新開啟，可嘗試重建20:00快照。</p>';return;}
 const t=document.createElement('table');
 const headers=['日期','預測關卡','價格','20:00 機率','00:00 收盤','結果'];
 const thead=document.createElement('thead'),tr=document.createElement('tr');
 for(const x of headers){const th=document.createElement('th');th.textContent=x;tr.append(th);}thead.append(tr);t.append(thead);
 const tb=document.createElement('tbody');
 dates.forEach(date=>{
  const snap=getFrozen(date),settle=getSettlement(date),row=document.createElement('tr');
  const cols=[date,snap.kind||'—',fmt(snap.line?.level,1),snap.status==='OK'?fmt(snap.prediction?.probability*100,1)+'%':'無有效關卡',fmt(settle?.close,1),
    settle?.status==='SETTLED'?(settle.success?'有效突破':'未有效突破'):'待 00:00 驗證'];
  cols.forEach((c,i)=>{const td=document.createElement('td');td.textContent=c;
   if(i===5&&settle?.status==='SETTLED')td.className=settle.success?'good':'bad';row.append(td);});tb.append(row);
 });t.append(tb);el.replaceChildren(t);
}
function renderLevels(pred,now){
 const last=S.fourHour.filter(b=>b.ts+4*ONE_HOUR<=now);
 const price=pred?.price??extractQuotePrice(),atr=pred?.atr??atr14(last,now);
 const top=Number.isFinite(price)&&atr>0?selectFirstBarrier(last,now,price,atr,'頂齊',{maxAgeDays:365,maxDistanceATR:3,maxTouches:8}):null;
 const floor=Number.isFinite(price)&&atr>0?selectFirstBarrier(last,now,price,atr,'底齊',{maxAgeDays:365,maxDistanceATR:3,maxTouches:8}):null;
 for(const [id,line] of [['top',top],['floor',floor]]){
  set(id==='top'?'topLevel':'floorLevel',line?fmt(line.level,1):'尚無有效關卡');
  set(id==='top'?'topDetail':'floorDetail',line?`確認 ${tpeTime(line.confirmed)} · 測試 ${line.episodes} 回`:'不強制選用過期舊線');
 }
 // On frozen days the active target must remain the immutable 20:00 line.
 const target=pred?.line??null;
 renderCandles4h($('candles'),last,target);
 set('historyStatus',S.fourHour.length>=300?`${last.length} 根4H已收線`:'K線不足');
 set('lineConfirmed',target?tpeTime(target.confirmed):'—');
 set('touchCount',target?`${target.episodes} 回`:'—');
 set('crossCount',target?`${target.crossCount} 次`:'—');
 set('distance',pred?.prediction?`${fmt(pred.prediction.distanceATR,3)} ATR`:'—');
}
function render(){
 const now=Date.now(),window=forecastWindow(now),pre=window.pre;
 set('clock',tpeClock(now));
 set('countdown',pre?countdown(window.cut-now):now<window.end?countdown(window.end-now):'00:00:00');
 set('phaseText',pre?'距離20:00凍結':'20:00機率已鎖定｜倒數00:00');
 maybeFreezeAndSettle(now);
 let snap=pre?createModelData(now):getFrozen(window.date);
 if(!pre&&!snap)snap={status:'FREEZE_PENDING',reason:'20:00 已停止動態推算，正以20:00之前已收線的歷史K線重建快照'};
 const frozen=!pre;
 $('freezeBadge').className=frozen?'chip frozen':'chip active';
 set('freezeBadge',frozen?'20:00 已凍結':'動態 · 10秒更新');
 set('freezeText',frozen?'預測關卡與機率鎖定；價格與瀏覽器頁籤仍每10秒更新。':'20:00 前持續推演；訓練只校準20:00時點，盤前機率屬實驗性。');
 if(snap?.daily){
  set('midState',`${snap.daily.side} · ${fmt(snap.daily.midline,1)}`);
  set('slopeState',`${snap.daily.slopeLabel}（${fmt(snap.daily.slopePctPerDay,3)}%／日）`);
  set('haState',`${snap.daily.averageK}色 · HA ${fmt(snap.daily.haClose,1)}`);
 }else{set('midState','資料不足');set('slopeState','—');set('haState','—');}
 if(snap?.status==='OK'){
  S.lastPrediction=snap;
  const p=snap.prediction,percent=p.probability*100;
  set('probName',snap.kind==='頂齊'?'4H 頂齊有效突破機率':'4H 底齊有效跌破機率');
  set('probability',`${fmt(percent,1)}%`);
  set('probInterpret',percent>=55?'突破能力較強':percent<=45?'突破能力偏弱':'接近中性');
  $('meterFill').style.width=`${Math.min(100,Math.max(0,percent))}%`;
  set('explanation',p.reason);
  setFeatureRows([
   ['預測目標',`${snap.kind} ${fmt(snap.line.level,1)}`],
   ['4H ATR（14）',fmt(snap.atr,1)],
   ['關卡距離',`${fmt(p.distanceATR,3)} ATR`],
   ['兩小時貼線規律',p.ruleApplied?'已觸發 · +15.0pp':'未觸發'],
   ['基礎模型機率',`${fmt(p.baseline*100,1)}%`],
   ['中軌、HA','決定觀測方向／顯示背景，未虛構加分']
  ]);
  renderLevels(snap,frozen?snap.cut:now);
 }else{
  set('probName',snap?.kind==='底齊'?'4H 底齊有效跌破機率':'4H 頂齊有效突破機率');
  set('probability','—');set('probInterpret','沒有可靠機率');$('meterFill').style.width='0%';
  set('explanation',snap?.reason||'正在讀取九年模型權重、4H及15M歷史與日線數據。');
  setFeatureRows([['狀態',snap?.status||'WAITING'],['原則','缺資料／無關卡時不猜測']]);
  renderLevels(snap,frozen?(snap.cut||now):now);
 }
 renderArchive();
}
async function initialize(){
 set('connection','啟動中');
 try{await loadModel();}catch(e){S.error='模型文件讀取失敗：'+e.message;showError();}
 // Begin live quotes while historical data is loading.
 void pollQuote();
 await loadHistory(true);
 void pollQuote();
 render();
}
setInterval(()=>{void pollQuote();},10000);
setInterval(()=>{void loadHistory(false);},120000);
// A short bounded catch-up loop at the 20:00 and 00:00 bar boundaries.
setInterval(()=>{
 const t=Date.now(),w=forecastWindow(t);
 const neededFreeze=w.post&&!getFrozen(w.date)&&t-w.cut<30*60000;
 const prior=forecastWindow(t-DAY);
 const neededSettlement=t>=prior.end&&!getSettlement(prior.date)&&t-prior.end<30*60000;
 if((neededFreeze||neededSettlement)&&t-S.historyUpdated>=12000)void loadHistory(false);
},10000);
setInterval(()=>render(),1000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden){void pollQuote();void loadHistory(false);}});
initialize();
