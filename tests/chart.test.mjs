import test from 'node:test';
import assert from 'node:assert/strict';
import {buildVisibleCandles,chartGeometry,renderCandles4h,hoverTooltipGeometry} from '../src/chart.js';
const FOUR=14400000;
const now=Date.parse('2026-10-10T12:30:00Z');
const end=Date.parse('2026-10-10T12:00:00Z');
function candles(n=38){return Array.from({length:n},(_,i)=>{
  const ts=end-(n-i)*FOUR,open=81000+i*18,close=open+8;
  return {ts,open,high:close+16,low:open-20,close};
 });}
function node(tag='svg'){
 const self={tag,attrs:{},children:[],events:{},textContent:'',parent:null,
  setAttribute(k,v){this.attrs[k]=String(v);},
  appendChild(c){c.parent=this;this.children.push(c);return c;},
  replaceChildren(...c){this.children=c;c.forEach(x=>x.parent=this);},
  remove(){if(this.parent){this.parent.children=this.parent.children.filter(x=>x!==this);this.parent=null;}},
  addEventListener(n,cb){this.events[n]=cb;},
  dispatch(n,event={}){this.events[n]?.(event);}
 };return self;
}
function flatten(el){return [el,...el.children.flatMap(flatten)];}
test('4H chart includes only at-time verified closed candle plus current DISPLAY-ONLY bar',()=>{
 const closed=candles(),live={ts:end,open:82200,high:82235,low:82190,close:82210};
 const out=buildVisibleCandles(closed,now,live,82300);
 assert.equal(out.length,39);assert.equal(out.at(-1).forming,true);assert.equal(out.at(-1).close,82300);
 assert.equal(out.at(-1).high,82300);
 assert.deepEqual(closed.at(-1),candles().at(-1),'confirmed price bars unchanged');
 assert.ok(!buildVisibleCandles(closed,now,{...live,ts:end-FOUR},82300).some(b=>b.forming));
});
test('large SVG keeps price label and breathing orb; barrier label is NOT rendered by default, appears on hover, disappears on leave',()=>{
 const prev=globalThis.document;globalThis.document={createElementNS(_ns,t){return node(t);}};
 try{
  for(const kind of ['底齊','頂齊']){
   const svg=node();const data=candles();const target={kind,level:81650};
   renderCandles4h(svg,data,target,{now,currentPrice:82130});
   let all=flatten(svg);
   assert.equal(svg.attrs.viewBox,'0 0 1200 405');
   assert.ok(all.some(x=>x.tag==='text'&&x.textContent==='NOW 82,130.0'));
   assert.ok(!all.some(x=>x.tag==='text'&&x.textContent===`${kind} 81,650.0`),'never a persistent barrier label');
   assert.ok(all.some(x=>x.attrs.stroke==='#23d7ee'&&x.attrs['stroke-dasharray']==='8 7'));
   assert.ok(all.some(x=>x.attrs['stroke-dasharray']==='8 6'));
   assert.ok(all.filter(x=>x.tag==='animate').length>=3);
   const hit=all.find(x=>x.attrs['data-role']==='barrier-hover-hit');
   assert.ok(hit,'actual pointer hit region exists');
   assert.equal(hit.attrs['pointer-events'],'stroke');
   hit.dispatch('pointerenter');
   all=flatten(svg);
   assert.equal(all.filter(x=>x.tag==='text'&&x.textContent===`${kind} 81,650.0`).length,1,'label appears upon pointerenter');
   hit.dispatch('pointerenter');
   assert.equal(flatten(svg).filter(x=>x.tag==='text'&&x.textContent===`${kind} 81,650.0`).length,1,'no duplicate label');
   hit.dispatch('pointerleave');
   assert.ok(!flatten(svg).some(x=>x.tag==='text'&&x.textContent===`${kind} 81,650.0`),'label removed on leave');
   hit.dispatch('focus');
   assert.ok(flatten(svg).some(x=>x.tag==='text'&&x.textContent===`${kind} 81,650.0`),'keyboard focus works');
   hit.dispatch('blur');
   assert.ok(!flatten(svg).some(x=>x.tag==='text'&&x.textContent===`${kind} 81,650.0`),'keyboard blur works');
   const same=svg.children[0];renderCandles4h(svg,data,target,{now,currentPrice:82130});
   assert.equal(svg.children[0],same,'animations do not restart every 1s UI tick');
   renderCandles4h(svg,data,target,{now,currentPrice:82140});
   assert.ok(flatten(svg).some(x=>x.textContent==='NOW 82,140.0'));
   assert.ok(!flatten(svg).some(x=>x.textContent===`${kind} 81,650.0`),'new quote cannot make barrier label persistent');
   assert.ok(chartGeometry(data,target,82140));
  }
 }finally{globalThis.document=prev;}
});

test('hover tooltip tracks pointer X in chart coordinates and NEVER occupies the NOW right gutter, even when level equals price',()=>{
 const prev=globalThis.document;globalThis.document={createElementNS(_ns,t){return node(t);}};
 try{
  for(const kind of ['底齊','頂齊']){
   const svg=node(),data=candles();
   renderCandles4h(svg,data,{kind,level:82130},{now,currentPrice:82130});
   const hit=flatten(svg).find(x=>x.attrs['data-role']==='barrier-hover-hit');
   assert.ok(hit);
   assert.equal(hit.attrs.x2,'1061','hover coverage ends at plot boundary, not NOW gutter');
   const rects=[];
   for(const x of [140,540,1030]){
    hit.dispatch('pointermove',{svgX:x,svgY:Number(hit.attrs.y1)});
    const tooltip=flatten(svg).find(x=>x.attrs['data-role']==='barrier-tooltip');
    assert.ok(tooltip);
    const tx=Number(tooltip.attrs['data-tooltip-x']);
    rects.push(tx);
    assert.ok(tx>=61&&tx+136<=1061,'floating label stays inside plot to avoid NOW label overlap');
    assert.equal(flatten(svg).filter(x=>x.textContent===`${kind} 82,130.0`).length,1);
   }
   assert.ok(rects[0]<rects[1]&&rects[1]<rects[2],`tooltip must MOVE left-to-right with mouse, got ${rects}`);
   hit.dispatch('pointerleave');
   assert.equal(flatten(svg).filter(x=>x.attrs['data-role']==='barrier-tooltip').length,0);
  }
  // The geometry is clamped away from the RIGHT gutter, no matter where the cursor is.
  assert.ok(hoverTooltipGeometry(1100,200).x+136<1070);
 }finally{globalThis.document=prev;}
});

// New pivot-marking contract: appearance requires completed confirmation, but x must
// be tied to the ORIGINAL opposite-color turning bar rather than to confirming K.
import {scanHistoricalAlignments} from '../src/structure.js';
import {turnMarkerGeometry} from '../src/chart.js';
test('pivot markers use first opposite-color turn bar, even if wick-break confirms at 3rd K',()=>{
 const base=Date.parse('2026-10-09T00:00:00Z');
 const ohlc=[
  [100,112,96,110],    // 0 green source -> red turn 1: 頂齊 level 110
  [110,115,100,108],   // 1 red: initial turning K (mark HERE)
  [108,111,101,106],   // 2 red: close 106 not through green low 96
  [106,109,93,95],     // 3 red: close 95 < source low 96 (confirm after 3)
  [95,99,88,90],       // 4 red source -> green turn 5: 底齊 level 90
  [90,94,86,92],       // 5 green: initial turning K (mark HERE)
  [92,100,90,99],      // 6 green: close 99 == red high 99, not confirm
  [99,108,94,101],     // 7 green: close 101 > red high 99 (confirm after 3)
  [101,109,99,105]     // 8 green
 ];
 const bars=ohlc.map(([open,high,low,close],i)=>({ts:base+i*FOUR,open,high,low,close}));
 const beforeConfirm=base+3*FOUR;
 assert.equal(scanHistoricalAlignments(bars,beforeConfirm).events.length,0,'do not show any unconfirmed events');
 const cutoff=base+bars.length*FOUR;
 const {events}=scanHistoricalAlignments(bars,cutoff);
 assert.equal(events.length,2,'one top and one floor confirmed');
 const top=events.find(e=>e.kind==='頂齊'),floor=events.find(e=>e.kind==='底齊');
 assert.equal(top.formed,bars[0].ts);
 assert.equal(top.turnTs,bars[1].ts);
 assert.equal(top.confirmed,bars[3].ts+FOUR);
 assert.equal(floor.formed,bars[4].ts);
 assert.equal(floor.turnTs,bars[5].ts);
 assert.equal(floor.confirmed,bars[7].ts+FOUR);
 const pts=turnMarkerGeometry(bars,events,cutoff);
 assert.deepEqual(pts.map(p=>p.turnTs),[bars[1].ts,bars[5].ts]);
 assert.deepEqual(pts.map(p=>p.kind),['頂齊','底齊']);
 assert.notEqual(pts[0].turnTs,top.confirmed);
 assert.notEqual(pts[1].turnTs,floor.confirmed);
 // No future confirmation data at an earlier asOf, even if future events mistakenly passed.
 assert.equal(turnMarkerGeometry(bars,events,base+3*FOUR).length,0);
 const previous=globalThis.document;globalThis.document={createElementNS(_ns,t){return node(t);}};
 try{
  const svg=node();
  renderCandles4h(svg,bars,{kind:'頂齊',level:110},{now:cutoff,currentPrice:104,pivots:events});
  const nodes=flatten(svg),marks=nodes.filter(el=>el.attrs['data-role']==='alignment-turn-marker');
  assert.equal(marks.length,2);
  assert.equal(marks[0].attrs['data-turn-ts'],String(bars[1].ts));
  assert.equal(marks[1].attrs['data-turn-ts'],String(bars[5].ts));
  assert.equal(marks[0].children.find(x=>x.tag==='path').attrs.stroke,'#f27585');
  assert.equal(marks[1].children.find(x=>x.tag==='path').attrs.stroke,'#36d3a2');
  const previewPath=svg.children[0];
  renderCandles4h(svg,bars,{kind:'頂齊',level:110},{now:cutoff,currentPrice:104,pivots:events});
  assert.equal(svg.children[0],previewPath,'without change chart is not needlessly redrawn');
  const nextSvg=node();
  renderCandles4h(nextSvg,bars,null,{now:base+3*FOUR,currentPrice:104,pivots:events});
  assert.equal(flatten(nextSvg).filter(el=>el.attrs['data-role']==='alignment-turn-marker').length,0,
    'no retroactive confirmed marker before it was confirmed');
 }finally{globalThis.document=previous;}
});
