// Browser tab uses the SAME live PIONEX quote and the SAME current (or frozen)
// 20:00–00:00 probability as the main page. Never fetch or infer a second score.
const probabilityLabel={頂齊:'突破',底齊:'跌破'};

export function formatBtcTabTitle(price,forecast=null){
  const value=typeof price==='number'?price:Number(price);
  if(!Number.isFinite(value)||value<=0)return 'BTC';
  const digits=value>=1000?1:value>=1?2:4;
  const priceLabel=`BTC ${value.toLocaleString('en-US',{
    minimumFractionDigits:digits,maximumFractionDigits:digits,
  })}`;
  const direction=probabilityLabel[forecast?.kind];
  const probability=forecast?.probability;
  // No model/no selected barrier: do NOT make up a probability or retain an old one.
  if(!direction||typeof probability!=='number'||!Number.isFinite(probability)||probability<0||probability>1){
    return priceLabel;
  }
  return `${priceLabel}｜${(probability*100).toFixed(1)}% ${direction}`;
}

export function updateBtcTabTitle(price,doc=globalThis.document,forecast=null){
  if(!doc)return false;
  const title=formatBtcTabTitle(price,forecast);
  if(title==='BTC'||doc.title===title)return false;
  doc.title=title;
  return true;
}
