import {normalizeBars} from './market.js';
export function renderCandles4h(svg,bars,line){
 const data=normalizeBars(bars).slice(-32);
 if(data.length<2){svg.replaceChildren();return;}
 const width=850,height=240,pad=20;
 const all=[...data.map(b=>b.high),...data.map(b=>b.low)];
 if(line&&Number.isFinite(line.level))all.push(line.level);
 const min=Math.min(...all),max=Math.max(...all),range=Math.max(1,max-min);
 const y=v=>height-pad-(v-min)/range*(height-2*pad);
 const dx=(width-2*pad)/data.length;
 const ns='http://www.w3.org/2000/svg';
 svg.setAttribute('viewBox',`0 0 ${width} ${height}`);
 svg.replaceChildren();
 function el(tag,props){const e=document.createElementNS(ns,tag);Object.entries(props).forEach(([k,v])=>e.setAttribute(k,String(v)));svg.appendChild(e);return e;}
 for(let i=0;i<5;i++){
  const yy=pad+(height-2*pad)*i/4;
  el('line',{x1:0,y1:yy,x2:width,y2:yy,stroke:'#273a55','stroke-dasharray':'3 5','stroke-width':0.8});
 }
 data.forEach((b,i)=>{
  const x=pad+(i+0.5)*dx,col=b.close>=b.open?'#18bd91':'#f07082';
  el('line',{x1:x,y1:y(b.high),x2:x,y2:y(b.low),stroke:col,'stroke-width':1.6});
  el('rect',{x:x-dx*0.31,y:Math.min(y(b.close),y(b.open)),width:dx*.62,height:Math.max(1.5,Math.abs(y(b.close)-y(b.open))),fill:col,rx:1.4});
 });
 if(line?.level){
  const yy=y(line.level);
  el('line',{x1:4,x2:width,y1:yy,y2:yy,stroke:'#f0ad58','stroke-width':1.9,'stroke-dasharray':'6 4'});
  const label=el('text',{x:width-5,y:Math.max(12,yy-6),fill:'#f0bd73','font-size':15,'text-anchor':'end','font-weight':700});
  label.textContent=`${line.kind} ${line.level.toLocaleString('en-US',{maximumFractionDigits:1})}`;
 }
}
