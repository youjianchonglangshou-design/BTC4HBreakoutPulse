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
