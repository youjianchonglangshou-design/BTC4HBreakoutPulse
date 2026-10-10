import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {calculateV6} from '../src/model.js';
const json=file=>JSON.parse(fs.readFileSync(new URL(file,import.meta.url),'utf8'));
const model=json('../model/v6.json'),gate=json('../model/rule.json');
test('v6: 131 Python vs native browser formula parity',()=>{
 for(const c of json('./v6_parity_cases.json')){
  const p=c.input;
  const result=calculateV6({kind:p.kind,level:p.level,price:p.price,atr4h:p.atr4h,
   bars15:p.candles15m.map(b=>({high:b.h,low:b.l})),model,gate});
  assert.equal(result.status,'OK',c.date);
  assert.equal(result.ruleApplied,c.ruleFired,c.date);
  assert.ok(Math.abs(result.probability-c.probability)<1e-10,`${c.date} ${result.probability} expected ${c.probability}`);
 }
});
test('v6: refuses already-crossed barrier',()=>{
 assert.equal(calculateV6({kind:'頂齊',level:100,price:101,atr4h:5,bars15:[],model,gate}).status,'ALREADY_CROSSED');
 assert.equal(calculateV6({kind:'底齊',level:100,price:99,atr4h:5,bars15:[],model,gate}).status,'ALREADY_CROSSED');
});
