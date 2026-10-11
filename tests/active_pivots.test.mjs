import test from 'node:test';
import assert from 'node:assert/strict';
import {pivotMatchesActive, renderCandles4h} from '../src/chart.js';
const FOUR=14400000,base=Date.parse('2026-10-01T00:00:00Z');
const bars=Array.from({length:18},(_,i)=>({ts:base+i*FOUR,open:82000+i*20,close:82008+i*20,high:82080+i*20,low:81970+i*20}));
const now=base+18*FOUR;
const pivots=[
 {id:'T1',kind:'頂齊',level:bars[2].close,formed:bars[2].ts,turnTs:bars[3].ts,confirmed:bars[5].ts+FOUR},
 {id:'F1',kind:'底齊',level:bars[6].close,formed:bars[6].ts,turnTs:bars[7].ts,confirmed:bars[9].ts+FOUR},
 {id:'T2',kind:'頂齊',level:bars[12].close,formed:bars[12].ts,turnTs:bars[13].ts,confirmed:bars[15].ts+FOUR}
];
function element(tag='svg'){
 return {tag, attrs:{},children:[],events:{},parent:null,textContent:'',
  setAttribute(k,v){this.attrs[k]=String(v);},
  appendChild(e){e.parent=this;this.children.push(e);return e;},
  replaceChildren(...xs){this.children=xs;xs.forEach(x=>x.parent=this);},
  remove(){if(this.parent){this.parent.children=this.parent.children.filter(x=>x!==this);this.parent=null;}},
  addEventListener(event,fn){this.events[event]=fn;},removeEventListener(event){delete this.events[event];},
  dispatch(event,data={}){this.events[event]?.(data);}
 };
}
const flat=(e)=>[e,...e.children.flatMap(flat)];
const matching=(svg,role)=>flat(svg).filter(e=>e.attrs['data-role']===role);
test('active match requires exact historical event identity, not just same price',()=>{
 assert.ok(pivotMatchesActive(pivots[0],{...pivots[0]}));
 assert.ok(!pivotMatchesActive(pivots[0],{...pivots[0],id:'other'}));
 assert.ok(!pivotMatchesActive(pivots[0],{...pivots[0],formed:pivots[0].formed+FOUR}));
 assert.ok(!pivotMatchesActive(pivots[0],{...pivots[0],kind:'底齊'}));
 assert.ok(!pivotMatchesActive(pivots[0],{...pivots[0],level:pivots[0].level+.1}));
 assert.ok(!pivotMatchesActive(pivots[0],null));
});
test('only the current TOP and FLOOR pulse; historical third marker remains static',()=>{
 const previous=globalThis.document;globalThis.document={createElementNS(_ns,tag){return element(tag);}};
 try{
  const svg=element();const opts={now,currentPrice:83000,pivots,activeBarriers:[pivots[0],pivots[1]]};
  renderCandles4h(svg,bars,null,opts);
  const marks=matching(svg,'alignment-turn-marker');assert.equal(marks.length,3);
  assert.deepEqual(marks.map(m=>m.attrs['data-active']),['true','true','false']);
  assert.deepEqual(matching(svg,'active-turn-halo').map(g=>g.attrs['data-kind']),['頂齊','底齊']);
  assert.equal(matching(svg,'active-turn-ring').length,2);
  assert.ok(matching(svg,'active-turn-halo').every(el=>el.attrs['pointer-events']==='none'));
  assert.ok(marks.every(el=>Boolean(el.__hoverHit)),'original hit areas preserved');
  assert.ok(flat(svg).some(el=>el.textContent==='NOW 83,000.0'),'NOW stays visible');
  const original=svg.children[0];renderCandles4h(svg,bars,null,opts);
  assert.equal(svg.children[0],original,'1-second unchanged render does not restart pulses');
  renderCandles4h(svg,bars,null,{...opts,currentPrice:83100});
  assert.equal(matching(svg,'active-turn-halo').length,2,'10-second quote redraw keeps exactly two glows');
  const newly=matching(svg,'alignment-turn-marker');assert.deepEqual(newly.map(m=>m.attrs['data-active']),['true','true','false']);
 }finally{globalThis.document=previous;}
});
test('changing current TOP turns off the old, fades to the new marker; absent visible match lights none',()=>{
 const previous=globalThis.document;globalThis.document={createElementNS(_ns,tag){return element(tag);}};
 try{
  const svg=element();const baseOpts={now,currentPrice:83100,pivots};
  renderCandles4h(svg,bars,null,{...baseOpts,activeBarriers:[pivots[0],pivots[1]]});
  renderCandles4h(svg,bars,null,{...baseOpts,activeBarriers:[pivots[2],pivots[1]]});
  assert.deepEqual(matching(svg,'alignment-turn-marker').map(m=>m.attrs['data-active']),['false','true','true']);
  assert.deepEqual(matching(svg,'active-turn-halo').map(h=>h.attrs['data-kind']),['底齊','頂齊']);
  assert.equal(matching(svg,'active-turn-exit').length,1,'old TOP fades out after selection switches');
  renderCandles4h(svg,bars,null,{...baseOpts,activeBarriers:[{...pivots[2],id:'offscreen'},null]});
  assert.equal(matching(svg,'active-turn-halo').length,0,'no historical marker falsely lights');
 }finally{globalThis.document=previous;}
});

test('v1.2.7 active-only animation has tighter 2.1s SVG radius, while NOW keeps 1.8s',()=>{
 const oldDoc=globalThis.document;globalThis.document={createElementNS(_ns,tag){return element(tag);}};
 try{
  const svg=element();renderCandles4h(svg,bars,null,{now,currentPrice:83000,pivots,activeBarriers:[pivots[0],pivots[1]]});
  const halo=matching(svg,'active-turn-halo'),ring=matching(svg,'active-turn-ring');
  assert.equal(halo.length,2);assert.equal(ring.length,2);
  for(const circle of halo){
   const animations=circle.children.filter(e=>e.tag==='animate');
   assert.deepEqual(animations.map(a=>a.attrs.attributeName),['r','opacity']);
   assert.equal(animations[0].attrs.values,'9;15;9');
   assert.equal(animations[0].attrs.dur,'2.1s');
   assert.equal(animations[1].attrs.values,'.19;.43;.19');
   assert.equal(circle.attrs.filter,'url(#active-turn-pulse-glow)');
  }
  for(const circle of ring){
   const animations=circle.children.filter(e=>e.tag==='animate');
   assert.equal(animations[0].attrs.values,'8;12;8');
   assert.equal(animations[0].attrs.dur,'2.1s');
  }
  const defs=flat(svg).find(e=>e.tag==='filter'&&e.attrs.id==='active-turn-pulse-glow');
  assert.equal(defs.children.find(e=>e.tag==='feGaussianBlur')?.attrs.stdDeviation,'4.2');
  // Dedicated live NOW marker should not inherit the new active-turn animation.
  const liveHalo=flat(svg).find(e=>e.tag==='circle'&&e.attrs.filter==='url(#price-pulse-glow)');
  assert.ok(liveHalo,'NOW keeps its independent live-quote glow filter');
  assert.equal(liveHalo.children.find(e=>e.tag==='animate')?.attrs.dur,'1.8s');
 }finally{globalThis.document=oldDoc;}
});
