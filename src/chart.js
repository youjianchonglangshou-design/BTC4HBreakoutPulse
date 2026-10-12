import {normalizeBars} from './market.js';

/** Pionex-only presentation. Current unfinished 4H is DISPLAY ONLY, never an alignment confirmation. */
// Right-aligned TradingView style price scale. 50 bars retain 48-bar width.
const W=1410,H=405,LEFT=8,RIGHT=1270,TOP=21,BOTTOM=354,GUTTER=1279;
const VIEW_COUNT=50;
const AXIS_LABEL_X=GUTTER+8,AXIS_LABEL_WIDTH=113;
const CROSS_HEIGHT=22,NOW_HEIGHT=25;
export const chartLayout={width:W,height:H,left:LEFT,right:RIGHT,gutter:GUTTER,count:VIEW_COUNT};
/** Draw priority: pivot / selected structure > generic cursor > NOW. NOW is NEVER hidden; labels are painted on top. */
export function axisLabelOverlaps(yA,heightA,yB,heightB,gap=3){
 return Number.isFinite(yA)&&Number.isFinite(yB)&&Math.abs(yA-yB)<=(heightA+heightB)/2+gap;
}
const OHLC_MS=4*3600_000;
const cache=new WeakMap();
const hoverState=new WeakMap();
const pivotHoverState=new WeakMap();
const ohlcHoverState=new WeakMap();
const rootHandlers=new WeakMap();
const lastActiveMarkers=new WeakMap();
const ns='http://www.w3.org/2000/svg';
const fmt=v=>Number(v).toLocaleString('en-US',{minimumFractionDigits:1,maximumFractionDigits:1});
const tpe=ts=>{
 const d=new Date(ts+8*3600_000);
 return `${String(d.getUTCMonth()+1).padStart(2,'0')}/${String(d.getUTCDate()).padStart(2,'0')} ${String(d.getUTCHours()).padStart(2,'0')}:00`;
};
const positive=n=>Number.isFinite(n)&&n>0;
const fullTpe=ts=>{const d=new Date(ts+8*3600_000);return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')} ${String(d.getUTCHours()).padStart(2,'0')}:00`;};
const fmtVolume=v=>{if(!Number.isFinite(v)||v<=0)return '—';if(v>=1e9)return (v/1e9).toFixed(2)+'B';if(v>=1e6)return (v/1e6).toFixed(2)+'M';if(v>=1e3)return (v/1e3).toFixed(2)+'K';return v.toFixed(2);};
/** Fixed-top TradingView-style OHLC string; never a native browser popup. */
export function formatChartOhlc(bar){
 if(!bar)return '滑鼠移入 K 棒查看開、高、低、收、漲跌幅及成交量';
 const change=(bar.close/bar.open-1)*100;
 return `${fullTpe(bar.ts)}${bar.forming?' · LIVE':''}  開 ${fmt(bar.open)}   高 ${fmt(bar.high)}   低 ${fmt(bar.low)}   收 ${fmt(bar.close)}   ${change>=0?'+':''}${change.toFixed(2)}%   量 ${fmtVolume(bar.volume)}`;
}
/** Pointer X is mapped to the candle column, never to a future or unrelated K. */
export function chartHoverCandleIndex(x,total,dx){return clamp(Math.floor((x-LEFT)/dx),0,total-1);}
const clamp=(n,lo,hi)=>Math.max(lo,Math.min(hi,n));
const TOOLTIP_WIDTH=136,TOOLTIP_HEIGHT=25;
/** Convert browser pointer coordinates to SVG viewBox coordinates, including responsive scaling. */
export function pointerSvgPosition(svg,event){
 if(Number.isFinite(event?.svgX))return {x:event.svgX,y:event.svgY??0};
 if(Number.isFinite(event?.clientX)&&Number.isFinite(event?.clientY)){
  const matrix=svg.getScreenCTM?.();
  if(matrix&&typeof matrix.inverse==='function'&&typeof svg.createSVGPoint==='function'){
   const point=svg.createSVGPoint();point.x=event.clientX;point.y=event.clientY;
   const result=point.matrixTransform(matrix.inverse());
   if(Number.isFinite(result.x)&&Number.isFinite(result.y))return {x:result.x,y:result.y};
  }
  const rect=svg.getBoundingClientRect?.();
  if(rect&&rect.width>0&&rect.height>0){
   const scale=Math.min(rect.width/W,rect.height/H);
   const offsetX=(rect.width-W*scale)/2;
   const offsetY=(rect.height-H*scale)/2;
   return {x:(event.clientX-rect.left-offsetX)/scale,y:(event.clientY-rect.top-offsetY)/scale};
  }
 }
 return {x:(LEFT+RIGHT)/2,y:0}; // keyboard focus / synthetic event
}
/** Cursor-following label stays INSIDE the candle plot, never inside the NOW price gutter. */
export function hoverTooltipGeometry(pointerX,lineY){
 const x=clamp(pointerX-TOOLTIP_WIDTH/2,LEFT+8,RIGHT-TOOLTIP_WIDTH-10);
 const y=lineY-TOOLTIP_HEIGHT-12<TOP+3
   ?clamp(lineY+12,TOP+3,BOTTOM-TOOLTIP_HEIGHT-4)
   :clamp(lineY-TOOLTIP_HEIGHT-12,TOP+3,BOTTOM-TOOLTIP_HEIGHT-4);
 return {x,y,width:TOOLTIP_WIDTH,height:TOOLTIP_HEIGHT};
}


export function buildVisibleCandles(confirmed,now,unfinished=null,livePrice=null){
 const closed=normalizeBars(confirmed).filter(b=>b.ts+OHLC_MS<=now).slice(-VIEW_COUNT);
 // The TV Pionex live 4H candle must begin no later than now and must not be confirmed.
 const candidate=unfinished&&unfinished.ts<=now&&unfinished.ts+OHLC_MS>now?unfinished:null;
 let live=null;
 if(candidate){
  const quote=positive(livePrice)?livePrice:candidate.close;
  live={...candidate,close:quote,high:Math.max(candidate.high,quote),low:Math.min(candidate.low,quote),forming:true};
 }
 return [...closed,...(live?[live]:[])].slice(-VIEW_COUNT);
}

/** Pure geometry helper tested independent of browser/svg. */
export function chartGeometry(candles,line,currentPrice){
 const nums=[];
 for(const b of candles){nums.push(b.high,b.low);}
 if(positive(line?.level))nums.push(line.level);
 if(positive(currentPrice))nums.push(currentPrice);
 const min=Math.min(...nums),max=Math.max(...nums);
 if(!Number.isFinite(min)||!Number.isFinite(max))return null;
 const s=Math.max(1,max-min),low=min-s*0.085,high=max+s*0.085;
 const y=v=>BOTTOM-(v-low)/(high-low)*(BOTTOM-TOP);
 const dx=(RIGHT-LEFT)/Math.max(1,candles.length);
 return {low,high,dx,y};
}

/** Turn marker belongs to the 1st opposite-color K candle in an alignment pair,
 * NOT the 2nd/3rd confirming candle. Markers become visible ONLY AFTER confirmation.
 * This function is pure and is used in deterministic tests.
 */
export function turnMarkerGeometry(visible,events,asOf,g=chartGeometry(visible,null,null)){
 if(!g)return [];
 const index=new Map(visible.map((bar,i)=>[bar.ts,i]));
 const positions=[];
 for(const ev of events||[]){
  if(!['頂齊','底齊'].includes(ev.kind)||!Number.isFinite(ev.confirmed)||ev.confirmed>asOf)continue;
  const turnTs=ev.turnTs??ev.formed+OHLC_MS;
  const i=index.get(turnTs),j=index.get(ev.formed);
  if(i===undefined||j===undefined||i!==j+1)continue;
  const source=visible[j],turn=visible[i];
  if(source.forming||turn.forming)continue;
  const high=Math.max(source.high,turn.high),low=Math.min(source.low,turn.low);
  // draw a 16px red crown ABOVE the turning pair or green bowl BELOW it;
  // avoid clipping at the chart top/bottom while remaining above/below the wick.
  const x=LEFT+(i+.5)*g.dx;
  const top=ev.kind==='頂齊';
  const y=top?clamp(g.y(high)-15,TOP+17,BOTTOM-12):clamp(g.y(low)+15,TOP+12,BOTTOM-17);
  positions.push({id:ev.id,kind:ev.kind,level:ev.level,formed:ev.formed,
   turnTs,confirmed:ev.confirmed,x,y});
 }
 return positions;
}

/** Match the exact confirmed alignment event, never a nearby old line.
 * It is legal for the selected line to exist outside the visible 50 bars;
 * in that case none of the historical markers will pulse.
 */
export function pivotMatchesActive(pivot,selected){
 if(!pivot||!selected||pivot.kind!==selected.kind)return false;
 if(!Number.isFinite(pivot.formed)||pivot.formed!==selected.formed)return false;
 if(pivot.id&&selected.id&&pivot.id!==selected.id)return false;
 return Number.isFinite(pivot.level)&&Number.isFinite(selected.level)&&Math.abs(pivot.level-selected.level)<1e-6;
}

/** Large market chart, full-width with old BTCFLOWPulse-style price marker in the right gutter. */
export function renderCandles4h(svg,bars,target,opts={}){
 const now=opts.now??Date.now();
 const price=positive(opts.currentPrice)?opts.currentPrice:null;
 const data=buildVisibleCandles(bars,now,opts.liveBar,price);
 const line=target&&positive(target.level)?target:null;
 const markerEvents=opts.pivots||[];
 const activeBarriers=opts.activeBarriers||[];
 const selectionSignature=activeBarriers.map(b=>b?`${b.kind}:${b.id}:${b.formed}:${b.level}`:'—').join(',');
 const signature=[data.length,...data.slice(-2).flatMap(b=>[b.ts,b.open,b.high,b.low,b.close]),line?.level,line?.kind,price,markerEvents.map(x=>x.id+':'+x.confirmed).join(','),selectionSignature].join('|');
 if(cache.get(svg)===signature)return;
 cache.set(svg,signature);
 // This SVG is redrawn every 10 seconds. Remove old root listeners first,
 // otherwise stale crosshairs and OHLC handlers accumulate indefinitely.
 const previousHandlers=rootHandlers.get(svg);
 if(previousHandlers){
  svg.removeEventListener?.('pointermove',previousHandlers.move);
  svg.removeEventListener?.('pointerleave',previousHandlers.leave);
 }
 svg.replaceChildren();
 svg.setAttribute('viewBox',`0 0 ${W} ${H}`);
 if(data.length<2)return;
 const g=chartGeometry(data,line,price);
 if(!g)return;
 const add=(name,attrs={},parent=svg)=>{
  const e=document.createElementNS(ns,name);
  Object.entries(attrs).forEach(([key,val])=>e.setAttribute(key,String(val)));
  parent.appendChild(e);return e;
 };
 const label=(text,attrs={},parent=svg)=>{const e=add('text',attrs,parent);e.textContent=text;return e;};
 const defs=add('defs');
 const ohlcBar=svg.closest?.('.chart-frame')?.querySelector?.('#chartOhlc')||null;
 const showOhlc=bar=>{if(ohlcBar){ohlcBar.textContent=formatChartOhlc(bar);ohlcBar.dataset.tone=bar?(bar.close>=bar.open?'up':'down'):'neutral';}};
 showOhlc(data.at(-1));
 const glow=add('filter',{id:'price-pulse-glow',x:'-250%',y:'-250%',width:'500%',height:'500%'},defs);
 add('feGaussianBlur',{stdDeviation:'5'},glow);
 // v1.2.7: slightly tighter glow for CURRENT structural turning points only.
 // Keep the NOW quote orb on its original, independent filter/animation.
 const activeGlow=add('filter',{id:'active-turn-pulse-glow',x:'-250%',y:'-250%',width:'500%',height:'500%'},defs);
 add('feGaussianBlur',{stdDeviation:'3.6'},activeGlow);
 add('rect',{x:RIGHT+13,y:TOP-9,width:W-RIGHT-18,height:BOTTOM-TOP+18,rx:10,fill:'#071725'});
 add('line',{x1:RIGHT+7,x2:RIGHT+7,y1:TOP-10,y2:BOTTOM+10,stroke:'#30526a','stroke-width':1,'stroke-dasharray':'4 6'});
 // Price scale moved to the RIGHT. Keep a compact margin on the left for more candles.
 // NOW always stays rendered, even when an active cursor / pivot / barrier label paints over it.
 const axisTicks=[];
 let nowTagGroup=null;
 let nowY=null;
 let focusLabel=null; // {kind, y, height}: pivot, barrier, or generic mouse cursor.
 function syncRightAxis(){
  // No visibility toggling based on distance: overlays are drawn later in SVG paint order.
  nowTagGroup?.setAttribute('visibility','visible');
  for(const tick of axisTicks){
   const conflictNow=nowY!==null&&axisLabelOverlaps(tick.y,12,nowY,NOW_HEIGHT);
   const conflictFocus=focusLabel&&axisLabelOverlaps(tick.y,12,focusLabel.y,focusLabel.height);
   tick.node.setAttribute('visibility',(conflictNow||conflictFocus)?'hidden':'visible');
  }
 }
 // price grids and scales
 for(let i=0;i<6;i++){
  const v=g.high-(g.high-g.low)*i/5,yy=g.y(v);
  add('line',{x1:LEFT,y1:yy,x2:RIGHT,y2:yy,stroke:'#244057','stroke-width':1,'stroke-dasharray':'3 7',opacity:.75});
  const tick=label(fmt(v),{x:GUTTER+10,y:yy+4,fill:'#7d98b4','font-size':10.5,'text-anchor':'start','data-role':'price-axis-tick'});
  axisTicks.push({node:tick,y:yy});
 }
 for(let i=0;i<=8;i++){
  const x=LEFT+(RIGHT-LEFT)*i/8;
  add('line',{x1:x,y1:TOP,x2:x,y2:BOTTOM,stroke:'#1b344c','stroke-width':1,opacity:.6});
 }
 label('PIONEX PERP · 4H',{x:GUTTER+10,y:TOP-12,fill:'#82a0b8','font-size':10,'font-weight':700});
 // candles. Real-time quote can change the current candle's display; confirmed history is untouched.
 const bodyW=Math.max(5,Math.min(22,g.dx*.60));
 data.forEach((b,i)=>{
  const x=LEFT+(i+.5)*g.dx,col=b.close>=b.open?'#20c79c':'#f17a86',p=add('g',{'data-role':'candle-bar','data-ts':b.ts});
  if(b.forming)add('rect',{x:x-g.dx*.46,y:TOP,width:g.dx*.92,height:BOTTOM-TOP,fill:'#1c685e',opacity:.14,rx:3},p);
  add('line',{x1:x,x2:x,y1:g.y(b.high),y2:g.y(b.low),stroke:col,'stroke-width':Math.max(1.4,bodyW*.10)},p);
  add('rect',{x:x-bodyW/2,y:Math.min(g.y(b.open),g.y(b.close)),width:bodyW,
   height:Math.max(2,Math.abs(g.y(b.open)-g.y(b.close))),fill:col,rx:1.5,
   stroke:b.forming?'#dcfff1':col,'stroke-width':b.forming?1.5:0},p);
  if(i===0||i===data.length-1||(i%6===0&&data.length-1-i>=4))label(tpe(b.ts),{x:clamp(x,LEFT+40,RIGHT-42),y:BOTTOM+26,fill:b.forming?'#5bddb8':'#7f9db7','font-size':9.7,'text-anchor':'middle'});
  if(b.forming)label('LIVE',{x,y:TOP-9,fill:'#65ecc2','font-size':11,'font-weight':800,'text-anchor':'middle'});
 });
 // Historical turns stay static. Only the exact currently selected TOP/FLOOR
 // acquires a restrained breathing halo, at its ORIGINAL turning candle.
 const previousActive=lastActiveMarkers.get(svg)||{};
 const currentActive={};
 const visiblePivots=turnMarkerGeometry(data,markerEvents,now,g);
 for(const pivot of visiblePivots){
  const top=pivot.kind==='頂齊',stroke=top?'#f27585':'#36d3a2';
  const selected=activeBarriers.find(b=>pivotMatchesActive(pivot,b));
  const isActive=Boolean(selected)&&!currentActive[pivot.kind];
  if(isActive)currentActive[pivot.kind]={id:pivot.id,x:pivot.x,y:pivot.y};
  const {x,y}=pivot;
  const path=top
   ?`M ${x-10} ${y+4} Q ${x} ${y-12} ${x+10} ${y+4}`
   :`M ${x-10} ${y-4} Q ${x} ${y+12} ${x+10} ${y-4}`;
  const group=add('g',{'data-role':'alignment-turn-marker',
   'data-kind':pivot.kind,'data-turn-ts':pivot.turnTs,
   'data-formed-ts':pivot.formed,'data-confirmed-ts':pivot.confirmed,
   'data-active':isActive?'true':'false',
   'data-x':x,'data-y':y,'aria-label':`${pivot.kind}轉折標記：${fmt(pivot.level)}${isActive?'（目前有效）':''}`});
  if(isActive){
   // Glow is paint-only and has no pointer hit area, so hover remains dominant.
   const cy=top?y-2:y+2;
   const halo=add('circle',{cx:x,cy,r:8,fill:stroke,opacity:.18,
     filter:'url(#active-turn-pulse-glow)','pointer-events':'none',
     'data-role':'active-turn-halo','data-kind':pivot.kind},group);
   add('animate',{attributeName:'r',values:'8;13;8',dur:'2.4s',repeatCount:'indefinite'},halo);
   add('animate',{attributeName:'opacity',values:'.19;.43;.19',dur:'2.4s',repeatCount:'indefinite'},halo);
   const ring=add('circle',{cx:x,cy,r:7,fill:'none',stroke,
     'stroke-width':1.5,opacity:.40,'pointer-events':'none',
     'data-role':'active-turn-ring'},group);
   add('animate',{attributeName:'r',values:'7;10;7',dur:'2.4s',repeatCount:'indefinite'},ring);
   add('animate',{attributeName:'opacity',values:'.28;.52;.28',dur:'2.4s',repeatCount:'indefinite'},ring);
   // One short fade-in when the active selection changes, not every 1-second UI tick.
   if(previousActive[pivot.kind]?.id!==pivot.id){
    add('animate',{attributeName:'opacity',values:'0;1',dur:'.42s',fill:'freeze'},group);
   }
  }
  add('path',{d:path,stroke,fill:'none','stroke-width':isActive?3.6:3.1,'stroke-linecap':'round',
   'stroke-linejoin':'round','pointer-events':'none'},group);
  add('circle',{cx:x,cy:top?y-2:y+2,r:isActive?3:2.3,fill:stroke,'pointer-events':'none'},group);
  // The marker keeps exactly its original hover affordance.
  const hit=add('circle',{cx:x,cy:y,r:16,fill:'transparent',
   'pointer-events':'all','data-role':'turn-marker-hit',cursor:'crosshair',tabindex:0,
   'aria-label':`${pivot.kind} 轉折 ${fmt(pivot.level)} ${fullTpe(pivot.turnTs)}`},group);
  group.__hoverHit=hit;
  group.__pivot=pivot;
 }
 // Fade the previous glowing point out when the active barrier changes.
 for(const kind of ['頂齊','底齊']){
  const previous=previousActive[kind],current=currentActive[kind];
  if(previous&&previous.id!==current?.id){
   const color=kind==='頂齊'?'#f27585':'#36d3a2';
   const ghost=add('g',{'data-role':'active-turn-exit','data-kind':kind,
     'pointer-events':'none'});
   add('circle',{cx:previous.x,cy:previous.y,r:10,fill:color,opacity:.21,
     filter:'url(#active-turn-pulse-glow)'},ghost);
   add('animate',{attributeName:'opacity',values:'.6;0',dur:'.46s',fill:'freeze'},ghost);
  }
 }
 lastActiveMarkers.set(svg,currentActive);
 // Frozen barrier remains visible as a dashed line, but NO label is created by default.
 // The hover hit-region is intentionally drawn last, above the live quote graphics.
 let barrierHover = null;
 if(line){
  const cy=g.y(line.level),color=line.kind==='底齊'?'#36d3a2':'#f27585';
  add('line',{x1:LEFT,x2:GUTTER,y1:cy,y2:cy,stroke:color,'stroke-width':1.9,'stroke-dasharray':'8 6',opacity:.94});
  add('circle',{cx:RIGHT,cy,r:3.4,fill:color});
  barrierHover={cy,color,kind:line.kind,level:line.level};
 }
 // Cyan live line + breathing orb + dedicated label replace former header quote.
 if(price!==null){
  const cy=g.y(price),tagY=Math.min(BOTTOM-26,Math.max(TOP+5,cy-12));
  add('line',{x1:LEFT,x2:GUTTER+5,y1:cy,y2:cy,stroke:'#23d7ee','stroke-width':1.5,'stroke-dasharray':'8 7',opacity:.9});
  nowY=tagY+NOW_HEIGHT/2;
 const halo=add('circle',{cx:GUTTER+3,cy,r:10,fill:'#24dcef',opacity:.34,filter:'url(#price-pulse-glow)'});
  add('animate',{attributeName:'r',values:'7;15;7',dur:'1.8s',repeatCount:'indefinite'},halo);
  add('animate',{attributeName:'opacity',values:'.45;.12;.45',dur:'1.8s',repeatCount:'indefinite'},halo);
  const orb=add('circle',{cx:GUTTER+3,cy,r:4.5,fill:'#efffff',stroke:'#28e0f0','stroke-width':2});
  add('animate',{attributeName:'r',values:'4;6;4',dur:'1.8s',repeatCount:'indefinite'},orb);
  nowTagGroup=add('g',{'data-role':'now-price-label'});
  add('rect',{x:AXIS_LABEL_X,y:tagY,width:AXIS_LABEL_WIDTH,height:NOW_HEIGHT,rx:7,fill:'#0b3444',stroke:'#26d9e9','stroke-width':1.6},nowTagGroup);
  label(`NOW ${fmt(price)}`,{x:AXIS_LABEL_X+5,y:tagY+17,fill:'#eeffff','font-size':11.3,'font-weight':850},nowTagGroup);
 }
 // Barrier line hover uses the SAME right-axis price scale and priority as a turn marker.
 let barrierFocused=false;
 let barrierTooltip=null;
 function clearBarrierHover(){
  barrierFocused=false;
  if(barrierTooltip){barrierTooltip.remove();barrierTooltip=null;}
  if(!pivotActive)focusLabel=null;
  syncRightAxis();
 }
 if(barrierHover){
  const {cy,color,kind,level}=barrierHover;
  const hit=add('line',{
   x1:LEFT,x2:RIGHT,y1:cy,y2:cy,stroke:'transparent','stroke-width':15,
   'pointer-events':'stroke',cursor:'crosshair','data-role':'barrier-hover-hit',
   tabindex:0,'aria-label':`${kind} ${fmt(level)}，水平線顯示關卡價格`
  });
  const state=hoverState.get(svg)||{active:false,x:(LEFT+RIGHT)/2,y:cy,kind,level};
  hoverState.set(svg,state);
  const show=(event)=>{
   const pt=pointerSvgPosition(svg,event);
   state.active=true;state.x=pt.x;state.y=cy;state.kind=kind;state.level=level;
   barrierFocused=true;
   if(!barrierTooltip){
    barrierTooltip=add('g',{'data-role':'barrier-tooltip','data-kind':kind,'pointer-events':'none'});
    add('rect',{x:AXIS_LABEL_X,y:cy-CROSS_HEIGHT/2,width:AXIS_LABEL_WIDTH,height:CROSS_HEIGHT,rx:5,
     fill:kind==='底齊'?'#0c5946':'#682c39',stroke:color,'stroke-width':1.1},barrierTooltip);
    label(`${kind} ${fmt(level)}`,{x:AXIS_LABEL_X+5,y:cy+4,
     fill:kind==='底齊'?'#eafff5':'#fff0f2','font-size':11.4,'font-weight':800},barrierTooltip);
   }
   if(!pivotActive)focusLabel={kind:'barrier',y:cy,height:CROSS_HEIGHT};
   syncRightAxis();
  };
  const hide=()=>{state.active=false;clearBarrierHover();};
  hit.addEventListener('pointerenter',show);
  hit.addEventListener('pointermove',show);
  hit.addEventListener('pointerleave',hide);
  hit.addEventListener('focus',()=>show({svgX:state.x,svgY:cy}));
  hit.addEventListener('blur',hide);
  if(state.active&&state.kind===kind&&state.level===level&&Math.abs(state.y-cy)<=11){
   show({svgX:state.x,svgY:cy});
  }else state.active=false;
 }else{
  const state=hoverState.get(svg);if(state)state.active=false;
 }
 // --- TradingView-inspired cursor: pinned OHLC in the top header, crosshair,
 //     price-axis cursor tag and date/time tag along the bottom axis. ---
 const cross=add('g',{'data-role':'chart-crosshair',visibility:'hidden','pointer-events':'none'});
 const vline=add('line',{stroke:'#b5c6dd','stroke-width':.9,'stroke-dasharray':'5 5',opacity:.82},cross);
 const hline=add('line',{stroke:'#b5c6dd','stroke-width':.9,'stroke-dasharray':'5 5',opacity:.76},cross);
 const priceBox=add('rect',{x:AXIS_LABEL_X,width:AXIS_LABEL_WIDTH,height:CROSS_HEIGHT,rx:5,fill:'#243549',stroke:'#91a8bf','stroke-width':.9,'data-role':'cursor-price-tag'},cross);
 const priceText=label('',{x:AXIS_LABEL_X+AXIS_LABEL_WIDTH/2,fill:'#f2f7ff','font-size':11.3,'font-weight':750,'text-anchor':'middle'},cross);
 const dateBox=add('rect',{y:BOTTOM+5,width:114,height:21,rx:5,fill:'#243549',stroke:'#6f8296','stroke-width':.9},cross);
 const dateText=label('',{y:BOTTOM+19,fill:'#f2f7ff','font-size':10,'font-weight':750,'text-anchor':'middle'},cross);
 // On a confirmed turn marker the focal point is its STRUCTURAL price label.
 // Do not simultaneously show the generic mouse-Y price tag or the second
 // horizontal crosshair, which could imply a different price level.
 const setPivotFocus=(active)=>{
  const visibility=active?'hidden':'visible';
  priceBox.setAttribute('visibility',visibility);
  priceText.setAttribute('visibility',visibility);
  hline.setAttribute('visibility',visibility);
  cross.setAttribute('data-pivot-focus',active?'true':'false');
 };
 const cursorState=ohlcHoverState.get(svg)||{active:false,x:LEFT,y:TOP};
 ohlcHoverState.set(svg,cursorState);
 const showCursor=(px,py)=>{
  if(px<LEFT||px>RIGHT||py<TOP||py>BOTTOM){cross.setAttribute('visibility','hidden');cursorState.active=false;if(!pivotActive&&!barrierFocused)focusLabel=null;syncRightAxis();return;}
  cursorState.active=true;cursorState.x=px;cursorState.y=py;
  const b=data[chartHoverCandleIndex(px,data.length,g.dx)];
  showOhlc(b);
  cross.setAttribute('visibility','visible');
  setPivotFocus(Boolean(pivotActive||barrierFocused));
  for(const [axis,value] of [['x1',px],['x2',px]])vline.setAttribute(axis,value);
  vline.setAttribute('y1',TOP);vline.setAttribute('y2',BOTTOM);
  hline.setAttribute('x1',LEFT);hline.setAttribute('x2',RIGHT);
  hline.setAttribute('y1',py);hline.setAttribute('y2',py);
  const labelY=clamp(py-CROSS_HEIGHT/2,TOP,BOTTOM-CROSS_HEIGHT);
  priceBox.setAttribute('y',labelY);
  priceText.setAttribute('y',labelY+CROSS_HEIGHT/2+3.9);
  priceText.textContent=fmt(g.low+(BOTTOM-py)/(BOTTOM-TOP)*(g.high-g.low));
  const dateX=clamp(px-57,LEFT+1,RIGHT-115);
  dateBox.setAttribute('x',dateX);dateText.setAttribute('x',dateX+57);
  dateText.textContent=tpe(b.ts);
  if(!pivotActive&&!barrierFocused)focusLabel={kind:'cursor',y:labelY+CROSS_HEIGHT/2,height:CROSS_HEIGHT};
  syncRightAxis();
 };
 // --- Historical turn-hover: temporary dashed extension from the ORIGINAL
 //     turning bar to the right, never from the confirmation candle. ---
 let pivotOverlay=null;
 let pivotActive=null;
 const pivotState=pivotHoverState.get(svg)||{active:false,id:null,x:LEFT};
 pivotHoverState.set(svg,pivotState);
 const hidePivot=()=>{
  pivotActive=null;pivotState.active=false;
  if(pivotOverlay){pivotOverlay.remove();pivotOverlay=null;}
  setPivotFocus(barrierFocused);
  focusLabel=barrierFocused?{kind:'barrier',y:barrierHover.cy,height:CROSS_HEIGHT}:cursorState.active?{kind:'cursor',y:clamp(cursorState.y-CROSS_HEIGHT/2,TOP,BOTTOM-CROSS_HEIGHT)+CROSS_HEIGHT/2,height:CROSS_HEIGHT}:null;
  syncRightAxis();
 };
 // On a pivot hover, draw the structurally significant label on RIGHT axis.
 // Guide passes through the EXACT vertical center of this label.
 const AXIS_TAG_X=AXIS_LABEL_X,AXIS_TAG_WIDTH=AXIS_LABEL_WIDTH,AXIS_TAG_HEIGHT=CROSS_HEIGHT;
 const showPivot=(pivot,px)=>{
  const yLine=g.y(pivot.level),red=pivot.kind==='頂齊';
  const color=red?'#f27585':'#36d3a2';
  const x=clamp(px,LEFT,RIGHT);
  if(!pivotOverlay || pivotActive!==pivot.id){
   if(pivotOverlay)pivotOverlay.remove();
   pivotOverlay=add('g',{'data-role':'pivot-level-overlay','data-kind':pivot.kind,
    'data-turn-ts':pivot.turnTs,'data-level':pivot.level,'pointer-events':'none'});
   // Dashed line spans the entire plot and ends inside the RIGHT price scale.
   add('line',{x1:LEFT,x2:GUTTER,y1:yLine,y2:yLine,stroke:color,
    'stroke-width':1.9,'stroke-dasharray':'8 6','data-role':'pivot-extension-line'},pivotOverlay);
   add('circle',{cx:pivot.x,cy:yLine,r:3.5,fill:color},pivotOverlay);
   const tag=add('g',{'data-role':'pivot-axis-price-tag','data-kind':pivot.kind,
    'data-center-y':yLine,'aria-label':`${pivot.kind} ${fmt(pivot.level)}`},pivotOverlay);
   add('rect',{x:AXIS_TAG_X,y:yLine-AXIS_TAG_HEIGHT/2,
    width:AXIS_TAG_WIDTH,height:AXIS_TAG_HEIGHT,rx:4,
    fill:red?'#682c39':'#0c5946',stroke:color,'stroke-width':1.2},tag);
   label(`${pivot.kind} ${fmt(pivot.level)}`,{x:AXIS_TAG_X+AXIS_TAG_WIDTH/2,y:yLine+3.8,
    fill:red?'#fff1f2':'#edfff6','font-size':11,'font-weight':850,
    'text-anchor':'middle'},tag);
   pivotActive=pivot.id;
  }
  // Structural price tooltip is painted above NOW; NOW always remains in the SVG.
  focusLabel={kind:'pivot',y:yLine,height:AXIS_TAG_HEIGHT};
  syncRightAxis();
  pivotOverlay.setAttribute('data-tooltip-x',AXIS_TAG_X);
  pivotOverlay.setAttribute('data-tooltip-y',yLine-AXIS_TAG_HEIGHT/2);
  pivotState.active=true;pivotState.id=pivot.id;pivotState.x=x;
  setPivotFocus(true);
  syncRightAxis();
 };

 const markerHitEntries=[];
 for(const el of svg.querySelectorAll?.('[data-role="alignment-turn-marker"]')||[]){
  if(el.__hoverHit && el.__pivot)markerHitEntries.push([el.__hoverHit,el.__pivot]);
 }
 // Node unit-test SVG stubs lack querySelectorAll. Map directly from children too.
 if(!markerHitEntries.length){for(const el of svg.children||[]){
  if(el.__hoverHit&&el.__pivot)markerHitEntries.push([el.__hoverHit,el.__pivot]);
 }}
 for(const [hit,pivot] of markerHitEntries){
  const show=e=>showPivot(pivot,pointerSvgPosition(svg,e).x);
  hit.addEventListener('pointerenter',show);
  hit.addEventListener('pointermove',show);
  hit.addEventListener('pointerleave',hidePivot);
  hit.addEventListener('focus',()=>showPivot(pivot,pivot.x));
  hit.addEventListener('blur',hidePivot);
 }
 const onMove=e=>{
  const pt=pointerSvgPosition(svg,e);
  // Decide whether this is still a pivot focus BEFORE rendering mouse-Y
  // controls, so the generic price tag returns immediately on pointer exit.
  if(pivotActive && !e.target?.closest?.('[data-role="turn-marker-hit"]') &&
      !markerHitEntries.some(([h])=>h===e.target))hidePivot();
  showCursor(pt.x,pt.y);
 };
 const onLeave=()=>{
  cross.setAttribute('visibility','hidden');cursorState.active=false;
  clearBarrierHover();showOhlc(data.at(-1));hidePivot();
  focusLabel=null;syncRightAxis();
 };
 svg.addEventListener('pointermove',onMove);
 svg.addEventListener('pointerleave',onLeave);
 rootHandlers.set(svg,{move:onMove,leave:onLeave});
 // After the 10-second quote redraw restore hover only while cursor is in chart.
 if(cursorState.active)showCursor(cursorState.x,cursorState.y);
 if(pivotState.active){
  const found=markerHitEntries.find(([,pivot])=>pivot.id===pivotState.id);
  if(found)showPivot(found[1],pivotState.x);
  else pivotState.active=false;
 }
 syncRightAxis();
}
