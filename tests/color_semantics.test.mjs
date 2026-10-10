import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {probabilityTone,contextTone,PALETTE} from '../src/semantic.js';
import {midlineSlopeRegime} from '../src/market.js';
import {renderCandles4h} from '../src/chart.js';

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const css=read('styles.css'),html=read('index.html'),app=read('src/app.js');
function node(tag='svg'){
 return {tag,attrs:{},children:[],events:{},textContent:'',parent:null,
  setAttribute(k,v){this.attrs[k]=String(v);},appendChild(c){c.parent=this;this.children.push(c);return c;},
  replaceChildren(...c){this.children=c;c.forEach(x=>x.parent=this);},
  remove(){if(this.parent){this.parent.children=this.parent.children.filter(x=>x!==this);this.parent=null;}},
  addEventListener(n,cb){this.events[n]=cb;}}
}
const flatten=x=>[x,...x.children.flatMap(flatten)];
const four=14400000,now=Date.parse('2026-10-10T12:30:00Z');
const bars=Array.from({length:40},(_,i)=>({ts:now-(41-i)*four,open:84000+i*10,high:84300+i*10,low:83500+i*10,close:84020+i*10}));

test('semantic colors: resistance red, support green; EXACT HA yellow/purple',()=>{
 assert.equal(PALETTE.yellow,'#FFEB3B');assert.equal(PALETTE.purple,'#B39DDB');
 assert.match(css,/#FFEB3B/);assert.match(css,/#B39DDB/);
 assert.match(css,/\.top-dot\{background:#f27585/);
 assert.match(css,/\.floor-dot\{background:#36d3a2/);
 assert.match(html,/class="market-mini-line state-pill"/);
 assert.equal((html.match(/class="market-mini-line state-pill"/g)||[]).length,3);
});
test('upside only GREEN above 50%; bearish high RED, bearish low AMBER, equal neutral',()=>{
 assert.equal(probabilityTone('頂齊',57),'bull-strong');
 assert.equal(probabilityTone('頂齊',43),'bull-weak');
 assert.equal(probabilityTone('底齊',15.7),'bear-weak');
 assert.equal(probabilityTone('底齊',49.9),'bear-weak');
 assert.equal(probabilityTone('底齊',60),'bear-strong');
 assert.equal(probabilityTone('頂齊',50),'neutral');
 assert.equal(probabilityTone('底齊',50),'neutral');
 assert.equal(probabilityTone('底齊',NaN),'unknown');
 for(const tone of ['bull-strong','bull-weak','bear-strong','bear-weak','neutral'])assert.ok(css.includes(`.prob-pane[data-tone="${tone}"]`));
 assert.match(app,/updatePalette\(snap\.daily,snap\.kind,percent\)/);
});
test('market context: SState slope and HA coloring from state',()=>{
 assert.deepEqual(contextTone({above:false,slopeState:'falling',averageK:'紫'}),{mid:'below',slope:'falling',ha:'purple'});
 assert.deepEqual(contextTone({above:true,slopeLabel:'下降走平中',averageK:'黃'}),{mid:'above',slope:'flattening',ha:'yellow'});
 assert.match(css,/\.state-value\[data-tone="below"\]/);
 assert.match(css,/\.state-value\[data-tone="rising"\]/);
 assert.match(css,/\.state-value\[data-tone="flat"\]/);
 assert.match(css,/\.state-value\[data-tone="flattening"\]/);
 assert.match(css,/\.state-value\[data-tone="falling"\]/);
});
test('SState 5-point regression slope category thresholds',()=>{
 const arr=(start,pct,n)=>Array.from({length:n},(_,i)=>start*Math.pow(1+pct/100,i));
 assert.equal(midlineSlopeRegime(arr(100,0.3,10)).label,'上斜');
 assert.equal(midlineSlopeRegime(arr(100,0,10)).label,'平緩');
 assert.equal(midlineSlopeRegime(arr(100,-0.9,10)).label,'下斜');
 const flattened=[...arr(100,-0.85,5),...arr(96.5,-0.4,5)];
 assert.equal(midlineSlopeRegime(flattened).label,'下降走平中');
});
test('graph line and cursor-tooltip color correspond to support/resistance',()=>{
 const previous=globalThis.document;globalThis.document={createElementNS(_ns,tag){return node(tag);}};
 try{
  for(const [kind,color] of [['頂齊','#f27585'],['底齊','#36d3a2']]){
   const svg=node();renderCandles4h(svg,bars,{kind,level:84100},{now,currentPrice:84200});
   const all=flatten(svg);assert.ok(all.some(x=>x.attrs.stroke===color && x.attrs['stroke-dasharray']==='8 6'),`${kind} line color`);
   const hit=all.find(x=>x.attrs['data-role']==='barrier-hover-hit');assert.ok(hit);
   hit.events.pointermove({svgX:600,svgY:200});
   const hovered=flatten(svg);assert.ok(hovered.some(x=>x.attrs.stroke===color && x.tag==='rect'),`${kind} tooltip border`);
  }
 }finally{globalThis.document=previous;}
});
