import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
const file=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const fixture=file('tests/replay_20261005.fixture.json');
function element(id=''){
 return {id,textContent:'',innerHTML:'',className:'',style:{},hidden:false,children:[],attrs:{},append(...els){this.children.push(...els);},appendChild(el){this.children.push(el);return el;},replaceChildren(...els){this.children=els;},setAttribute(k,v){this.attrs[k]=v;},getAttribute(k){return this.attrs[k]??null;},addEventListener(){}};
}
// The original BTCFLOWPulse uses WebSocket messages framed as ~m~{utf8 bytes}~m~{payload}.
const frame=o=>{const json=JSON.stringify(o);return `~m~${new TextEncoder().encode(json).length}~m~${json}`;};
class FakeWS{
 static OPEN=1;static CONNECTING=0;
 constructor(url){assert.match(url,/tv-chart-ws/);this.readyState=0;this.handlers={};setTimeout(()=>{this.readyState=1;this.emit('open',{});},1);}
 addEventListener(name,cb){(this.handlers[name]??=[]).push(cb);}
 emit(name,p){for(const fn of this.handlers[name]||[])fn(p);}
 send(message){
  const m=message.match(/^~m~\d+~m~([\s\S]+)$/);if(!m)return;
  let msg;try{msg=JSON.parse(m[1]);}catch{return;}
  if(msg.m==='resolve_symbol'){assert.match(String(msg.p?.[2]),/PIONEX:BTCUSDT\.P/);return;}
  if(msg.m!=='create_series')return;
  const [session,seriesId,_series,_symbol,resolution,limit]=msg.p;
  const key=resolution==='240'?'fourHour':resolution==='15'?'fifteenMin':'daily';
  const rows=fixture[key].slice(-limit).map(b=>({v:[b.ts/1000,b.open,b.high,b.low,b.close,1]}));
  setTimeout(()=>{
   if(this.readyState!==1)return;
   this.emit('message',{data:frame({m:'timescale_update',p:[session,{[seriesId]:{s:rows}}]})});
   this.emit('message',{data:frame({m:'series_completed',p:[session,seriesId]})});
  },3);
 }
 close(){this.readyState=3;}
}
test('GitHub Pages entry loads Pionex chart 4H/15M/1D and Pionex quote; below midline language says 跌破',async()=>{
 const original={fetch:globalThis.fetch,now:Date.now,setInterval:globalThis.setInterval,document:globalThis.document,localStorage:globalThis.localStorage,WebSocket:globalThis.WebSocket};
 const elements=new Map();
 globalThis.document={title:'BTC',hidden:false,getElementById(id){if(!elements.has(id))elements.set(id,element(id));return elements.get(id);},createElement(){return element();},createElementNS(){return element();},querySelectorAll(){return [];},addEventListener(){}};
 const fakeNow=Date.parse('2026-10-05T11:55:00Z');Date.now=()=>fakeNow;
 globalThis.setInterval=()=>0;globalThis.WebSocket=FakeWS;
 globalThis.localStorage={getItem:()=>null,setItem:()=>{},length:0,key:()=>null};
 const requests=[];
 globalThis.fetch=async(url)=>{
  const u=new URL(url,'https://localhost/');requests.push(u.href);
  if(u.pathname.startsWith('/model/'))return {ok:true,json:async()=>file(u.pathname.slice(1))};
  if(u.hostname==='scanner.tradingview.com')return {ok:true,json:async()=>({data:[{s:'PIONEX:BTCUSDT.P',d:[86223.4]}]})};
  throw Error('unexpected URL '+url);
 };
 try{
  await import(`../src/app.js?test=${Math.random()}`);
  for(let i=0;i<130;i++){
   if(elements.get('probability')?.textContent?.match(/\d+\.\d%/)&&globalThis.document.title.includes('86,223.4'))break;
   await new Promise(r=>setTimeout(r,30));
  }
  const p=elements.get('probability')?.textContent;
  assert.match(p,/\d+\.\d%/,`probability: ${p}; info: ${elements.get('explanation')?.textContent}; err:${elements.get('error')?.textContent}`);
  assert.equal(elements.has('livePrice'),false,'Removed the old header quote');
  const chartChildren=elements.get('candles').children;
  assert.ok(chartChildren.some(x=>x.textContent==='NOW 86,223.4'),'Live quote is written INSIDE the Pionex 4H SVG');
  assert.ok(chartChildren.some(x=>x.attrs['stroke-dasharray']==='8 7'&&x.attrs.stroke==='#23d7ee'),'Live horizontal cyan price line');
  assert.ok(chartChildren.some(x=>x.attrs.stroke==='#26d9e9'),'Live price tag is outlined');
  assert.equal(globalThis.document.title,'BTC 86,223.4');
  assert.match(elements.get('midState').textContent,/中軌之/);
  assert.match(elements.get('chartSource').textContent,/PIONEX/);
  assert.match(elements.get('freezeBadge').textContent,/動態/);
  assert.ok(elements.get('featureList').children.length>=3);
  assert.ok(elements.get('summaryMid').textContent.includes('中軌之'));
  assert.ok(elements.get('summaryHA').textContent.length>1);
  assert.ok(elements.get('candles').children.length>=33);
  assert.ok(requests.every(u=>!u.includes('binance.vision')&&!u.includes('api.binance')));
  if(elements.get('midState').textContent.includes('中軌之下')){
   assert.match(elements.get('probName').textContent,/跌破/);
   assert.match(elements.get('summaryFloor').textContent,/\d|—/);
  }
 }finally{Object.assign(globalThis,{fetch:original.fetch,document:original.document,localStorage:original.localStorage,WebSocket:original.WebSocket,setInterval:original.setInterval});Date.now=original.now;}
});
