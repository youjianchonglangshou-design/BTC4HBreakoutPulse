import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
const file=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const fixture=file('tests/replay_20261005.fixture.json');
function element(id=''){
 return {id,textContent:'',innerHTML:'',className:'',style:{},hidden:false,
  children:[],append(...els){this.children.push(...els);},appendChild(el){this.children.push(el);return el;},replaceChildren(...els){this.children=els;},
  setAttribute(){},getAttribute(){return null;},addEventListener(){}};
}
test('full browser entrypoint can hydrate quote/tab and 4H learned probability with mocked REST data',async()=>{
 const original={fetch:globalThis.fetch,DateNow:Date.now,setInterval:globalThis.setInterval,document:globalThis.document,localStorage:globalThis.localStorage};
 const elements=new Map();
 globalThis.document={title:'BTC',hidden:false,
  getElementById(id){if(!elements.has(id))elements.set(id,element(id));return elements.get(id);},
  createElement(){return element();},createElementNS(){return element();},addEventListener(){}};
 const fakeNow=Date.parse('2026-10-05T11:55:00Z');
 Date.now=()=>fakeNow;
 globalThis.setInterval=()=>0;
 globalThis.localStorage={getItem:()=>null,setItem:()=>{},length:0,key:()=>null};
 globalThis.fetch=async(url)=>{
  const u=new URL(url,'https://localhost/');
  if(u.pathname.startsWith('/model/'))return {ok:true,json:async()=>file(u.pathname.slice(1))};
  if(u.pathname.endsWith('/api/v3/klines')){
   const it=u.searchParams.get('interval'),key=it==='4h'?'fourHour':it==='15m'?'fifteenMin':'daily';
   const end=+(u.searchParams.get('endTime')||fakeNow),limit=+(u.searchParams.get('limit')||1000);
   const rows=fixture[key].filter(b=>b.ts<=Math.min(end,fakeNow)).slice(-limit)
     .map(b=>[b.ts,String(b.open),String(b.high),String(b.low),String(b.close),'1']);
   return {ok:true,json:async()=>rows};
  }
  if(u.hostname==='scanner.tradingview.com')return {ok:true,json:async()=>({data:[
   {s:'PIONEX:BTCUSDT.P',d:[86223.4]},{s:'BINANCE:BTCUSDT',d:[86216]}]})};
  throw Error('unexpected network '+url);
 };
 try{
  await import(`../src/app.js?int=${Math.random()}`);
  for(let i=0;i<45;i++){
   if(elements.get('probability')?.textContent?.includes('%')&&globalThis.document.title.includes('86,223.4'))break;
   await new Promise(r=>setTimeout(r,35));
  }
  const p=elements.get('probability')?.textContent;
  assert.match(p,/\d+\.\d%/,`probability: ${p}; error: ${elements.get('error')?.textContent}`);
  assert.equal(elements.get('livePrice').textContent,'86,223.4');
  assert.equal(globalThis.document.title,'BTC 86,223.4');
  assert.match(elements.get('midState').textContent,/中軌之/);
  assert.match(elements.get('freezeBadge').textContent,/動態/);
  assert.ok(elements.get('featureList').children.length>=3);
  assert.ok(elements.get('candles').children.length>=33);
 }finally{
  globalThis.fetch=original.fetch;Date.now=original.DateNow;globalThis.setInterval=original.setInterval;
  globalThis.document=original.document;globalThis.localStorage=original.localStorage;
 }
});
