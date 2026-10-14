// Direct browser port of v6.0 *trained* rule, no invented slope or HA bonuses.
export function calculateV6({kind,level,price,atr4h,bars15,model,gate}){
 if(!['頂齊','底齊'].includes(kind))return {status:'INVALID_DIRECTION'};
 if(![level,price,atr4h].every(Number.isFinite)||!(level>0&&price>0&&atr4h>0))return {status:'NO_INPUT'};
 const isTop=kind==='頂齊';
 if(isTop?price>=level:price<=level)return {status:'ALREADY_CROSSED'};
 const last8=bars15.slice(-8);
 if(last8.length!==8)return {status:'INSUFFICIENT_15M'};
 const hi=Math.max(...last8.map(x=>x.high)),lo=Math.min(...last8.map(x=>x.low));
 if(!Number.isFinite(hi)||!Number.isFinite(lo))return {status:'INVALID_15M'};
 const distanceATR=Math.abs(level-price)/atr4h;
 const feature=[distanceATR,Number(isTop)];
 let logit=model.intercept;
 for(let i=0;i<2;i++)logit+=((feature[i]-model.mean[i])/model.scale[i])*model.coef[i];
 const base=1/(1+Math.exp(-Math.max(-60,Math.min(60,logit))));
 const rangeEdge=(isTop?1:-1)*((hi+lo)/2-level)/atr4h;
 let node=0,tree=model.tree;
 while(tree.feature[node]>=0){
  const key=tree.features[tree.feature[node]];
  if(key!=='range_edge_8')break; // faithful v6 tree: stop if split uses unavailable live feature
  node=rangeEdge<=tree.threshold[node]?tree.left[node]:tree.right[node];
 }
 const applied=isTop&&node===7;
 const probability=Math.max(.01,Math.min(.99,base+(applied?gate.bonus_from_2023:0)));
 return {status:'OK',probability,baseline:base,ruleApplied:applied,distanceATR,rangeEdge,
  reason:applied?'頂齊＋前兩小時震盪中心貼線：v6 模型加成 15 個百分點':'依關卡距離／類型的歷史模型推算，未觸發貼線加成',
  definition:isTop?'00:00 收盤 > 頂齊 × 1.0001':'00:00 收盤 < 底齊 × 0.9999'};
}


/** v7.0: fitted logistic probabilities from structure-first-v1 20:00 BTC SPOT samples.
 * Slope, slope CHANGE, four slope states and HA yellow are real trained inputs,
 * not decorative badges or arbitrarily invented point bonuses.
 * Training history is BTCUSDT Binance SPOT, not Pionex PERP.
 */
export function calculateRegimeV7({kind,level,price,atr4h,daily,model}){
 if(!model||model.version!=='v7.0-structure-first-regime')return {status:'MODEL_NOT_V7'};
 if(!['頂齊','底齊'].includes(kind))return {status:'INVALID_DIRECTION'};
 const m=model.models?.[kind];
 if(!m||!daily)return {status:'DAILY_NOT_READY'};
 if(!(Number.isFinite(level)&&Number.isFinite(price)&&Number.isFinite(atr4h)&&level>0&&price>0&&atr4h>0))return {status:'NO_INPUT'};
 const dir=kind==='頂齊'?1:-1;
 if((level-price)*dir<=0)return {status:'ALREADY_CROSSED'};
 const distanceATR=Math.abs(level-price)/atr4h;
 if(distanceATR>3)return {status:'OUTSIDE_TRAINING_RANGE',distanceATR};
 const regime=daily.slopeState;
 const features={
  distance_atr:distanceATR,
  slope_pct:daily.slopePctPerDay,
  slope_change:daily.slopeImprovementPct,
  regime_rising:Number(regime==='rising'),
  regime_flattening:Number(regime==='flattening'),
  regime_falling:Number(regime==='falling'),
  ha_yellow:Number(daily.averageK==='黃'),
  mid_distance_pct:daily.midDistancePct
 };
 if(!m.features.every(name=>Number.isFinite(features[name])))return {status:'DAILY_FEATURE_MISSING'};
 const contributions={};let z=m.intercept;
 for(let i=0;i<m.features.length;i++){
  const name=m.features[i];const effect=(features[name]-m.mean[i])/m.scale[i]*m.coefs[i];
  contributions[name]=effect;z+=effect;
 }
 const sigmoid=x=>1/(1+Math.exp(-Math.max(-60,Math.min(60,x))));
 const probability=sigmoid(z);
 const slopeLogit=['slope_pct','slope_change','regime_rising','regime_flattening','regime_falling'].reduce((s,k)=>s+contributions[k],0);
 const haLogit=contributions.ha_yellow;
 const midDistLogit=contributions.mid_distance_pct;
 const slopePp=(probability-sigmoid(z-slopeLogit))*100;
 const haPp=(probability-sigmoid(z-haLogit))*100;
 const midDistPp=(probability-sigmoid(z-midDistLogit))*100;
 return {status:'OK',probability,baseline:sigmoid(z-slopeLogit-haLogit-midDistLogit),distanceATR,
  slopeEffectPp:slopePp,haEffectPp:haPp,midDistanceEffectPp:midDistPp,
  contributions,features,modelVersion:model.version,trainingSize:m.training_n,
  ruleApplied:false,
  reason:`九年歷史重訓：ATR 距離、中軌斜率及變化、上斜／平緩／走平中／下斜、平均 K 黃紫、中軌距離共同參與；${kind==='頂齊'?'突破':'跌破'}目標為 00:00 有效收破`,
  definition:kind==='頂齊'?'00:00 收盤 > 頂齊 × 1.0001':'00:00 收盤 < 底齊 × 0.9999'};
}
