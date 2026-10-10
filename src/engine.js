import {atr14,dailySignal,buildPartialDaily,normalizeBars} from './market.js';
import {selectFirstBarrier} from './structure.js';
import {calculateV6} from './model.js';
import {cutoffAt20,DAY} from './clock.js';

export const FOUR_HOURS=14400000, FIFTEEN=900000;
export function closedBefore(bars,asOf,interval){return normalizeBars(bars).filter(b=>b.ts+interval<=asOf);}

/** Evidence available at `asOf` only; quote is solely a pre-20:00 spot price.
 * Forecast exactly 20:00-00:00 TPE. All inputs can be audited in UI. */
export function evaluate({fourHour,fifteenMin,daily,model,gate,price,asOf,strict20=false}){
 const four=closedBefore(fourHour,asOf,FOUR_HOURS),m15=closedBefore(fifteenMin,asOf,FIFTEEN);
 const atr=atr14(four,asOf);
 if(four.length<300||m15.length<8||!(atr>0))return {status:'HISTORY_SHORT',reason:`4H ${four.length}/300，已收線15M ${m15.length}/8`};
 let dailyOverride=null,spotPrice=price;
 if(strict20){
  if(asOf!==cutoffAt20(asOf))return {status:'INCORRECT_CUTOFF',reason:'封存時刻必須為台灣20:00'};
  dailyOverride=buildPartialDaily(m15,asOf);
  const b=m15.at(-1);
  if(!dailyOverride||!b||b.ts!==asOf-FIFTEEN)return {status:'FREEZE_HISTORY_INCOMPLETE',reason:'20:00 歷史15M不完整，不允許拿20:00之後現價補算'};
  spotPrice=b.close;
 }else{
  if(!(Number.isFinite(spotPrice)&&spotPrice>0))return {status:'NO_SPOT_QUOTE',reason:'無同市場即時價格，不使用派網合約價冒充現貨'};
  // Intraday HA and BB may change with last spot quote. Historical day high/low
  // from the completed 15m bars and today's true daily OHLC (prior to asOf).
  const utcDay=Math.floor(asOf/DAY)*DAY;
  const day=normalizeBars(daily).find(b=>b.ts===utcDay);
  if(day){dailyOverride={...day,close:spotPrice,high:Math.max(day.high,spotPrice),low:Math.min(day.low,spotPrice)};}
 }
 const dailyState=dailySignal(daily,asOf,dailyOverride);
 if(!dailyState)return {status:'DAILY_NOT_READY',reason:'日線資料不足，不能自動判斷中軌上方／下方'};
 const kind=dailyState.above?'頂齊':'底齊';
 const line=selectFirstBarrier(four,asOf,spotPrice,atr,kind,{maxAgeDays:365,maxDistanceATR:3,maxTouches:8});
 const primary={status:'NO_BARRIER',kind,price:spotPrice,atr,daily:dailyState,
    fourCount:four.length,m15Count:m15.length,reason:'沒有符合期限／ATR距離／反覆觸碰上限的已確認4H關卡，不硬湊機率'};
 if(!line)return primary;
 const fit=calculateV6({kind,level:line.level,price:spotPrice,atr4h:atr,bars15:m15,model,gate});
 if(fit.status!=='OK')return {...primary,status:fit.status,line,reason:'所選4H關卡無法計算v6機率：'+fit.status};
 return {status:'OK',kind,price:spotPrice,atr,daily:dailyState,line,prediction:fit,
   fourCount:four.length,m15Count:m15.length,asOf,
   source:'Binance BTCUSDT SPOT 歷史 + 同市場現貨推論',
   caveat:'v6 模型僅以20:00快照訓練；20:00以前的動態推演尚未獨立校準。'};
}
export function settlementForSnapshot(snapshot,bar4h,asOf=Date.now()){
 if(snapshot?.status!=='OK'||!Number.isFinite(snapshot.cut)||!snapshot.line)return {status:'NOT_PREDICTED'};
 if(asOf<snapshot.cut+FOUR_HOURS)return {status:'PENDING'};
 const candle=normalizeBars(bar4h).find(b=>b.ts===snapshot.cut);
 if(!candle)return {status:'PENDING'};
 const kind=snapshot.kind,level=snapshot.line.level;
 return {status:'SETTLED',kind,level,close:candle.close,
   success:kind==='頂齊'?candle.close>level*1.0001:candle.close<level*.9999,
   candleTs:candle.ts,settlementTs:candle.ts+FOUR_HOURS};
}
export function freezeSnapshot({fourHour,fifteenMin,daily,model,gate,cut}){
 const item=evaluate({fourHour,fifteenMin,daily,model,gate,asOf:cut,strict20:true});
 if(item.status!=='OK')return item;
 return {...item,cut,freezeSource:'20:00 UTC+8 歷史快照，16:00～20:00 的15M全部收線後重建',frozenAt:cut};
}
