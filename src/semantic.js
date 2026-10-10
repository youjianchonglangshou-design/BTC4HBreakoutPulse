/** UI colors have market meaning; never reinterpret weak downside odds as bullish green. */
export const PALETTE=Object.freeze({yellow:'#FFEB3B',purple:'#B39DDB',resistance:'#f27585',support:'#36d3a2'});
export function probabilityTone(kind,percent){
 if(!Number.isFinite(percent)||!['頂齊','底齊'].includes(kind))return 'unknown';
 if(percent===50)return 'neutral';
 if(kind==='頂齊')return percent>50?'bull-strong':'bull-weak';
 return percent>50?'bear-strong':'bear-weak';
}
export function contextTone(daily){
 if(!daily)return {mid:'unknown',slope:'unknown',ha:'unknown'};
 const slopeLabel=daily.slopeLabel;
 const slope=daily.slopeState||({'上斜':'rising','平緩':'flat','走平':'flat','下降走平中':'flattening','下斜':'falling'}[slopeLabel]||'unknown');
 return {mid:daily.above?'above':'below',slope,ha:daily.averageK==='黃'?'yellow':daily.averageK==='紫'?'purple':'unknown'};
}
