import test from 'node:test';
import assert from 'node:assert/strict';
import {buildVisibleCandles,chartGeometry,renderCandles4h} from '../src/chart.js';
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
  dispatch(n){this.events[n]?.();}
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
   assert.equal(svg.attrs.viewBox,'0 0 1200 460');
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
