import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {calculateRegimeV7} from '../src/model.js';
const model=JSON.parse(readFileSync(new URL('../model/regime_v7.json',import.meta.url),'utf8'));
const cases=JSON.parse(readFileSync(new URL('../research/parity_v7_cases.json',import.meta.url),'utf8'));
const root=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('v7 is genuinely newly trained on new structure-first sample with explicit SState inputs',()=>{
 assert.equal(model.selector,'structure-first-v1 [50,150,450,infinity]');
 for(const kind of ['頂齊','底齊']){
  const m=model.models[kind];
  for(const f of ['distance_atr','slope_pct','slope_change','regime_rising','regime_flattening','regime_falling','ha_yellow','mid_distance_pct']){
   assert.ok(m.features.includes(f),kind+' missing '+f);
  }
  assert.ok(m.training_n>300);
  assert.notEqual(m.coefs[m.features.indexOf('ha_yellow')],0);
  assert.notEqual(m.coefs[m.features.indexOf('slope_pct')],0);
 }
});
test('JS probabilities reproduce Python trained samples for TOP and FLOOR',()=>{
 assert.ok(cases.length>=20);
 for(const c of cases){
  const p=calculateRegimeV7({kind:c.kind,level:c.level,price:c.price,atr4h:c.atr,daily:c.daily,model});
  assert.equal(p.status,'OK',c.date);
  assert.ok(Math.abs(p.probability-c.expectedProbability)<1e-11,`${c.date}: JS ${p.probability} vs Python ${c.expectedProbability}`);
 }
});
test('SState slope changes predicted probability, before 20:00',()=>{
 for(const kind of ['頂齊','底齊']){
  const c=cases.find(c=>c.kind===kind);
  const a=calculateRegimeV7({kind,level:c.level,price:c.price,atr4h:c.atr,daily:c.daily,model});
  const b=calculateRegimeV7({kind,level:c.level,price:c.price,atr4h:c.atr,daily:{...c.daily,slopePctPerDay:0.17,slopeImprovementPct:0.28,slopeState:'rising'},model});
  const d=calculateRegimeV7({kind,level:c.level,price:c.price,atr4h:c.atr,daily:{...c.daily,slopePctPerDay:-0.5,slopeImprovementPct:-0.3,slopeState:'falling'},model});
  assert.ok(Math.abs(b.probability-d.probability)>1e-4,kind);
  assert.ok(Number.isFinite(a.slopeEffectPp));
 }
});
test('HA Yellow / Purple REALLY changes prediction',()=>{
 for(const kind of ['頂齊','底齊']){
  const c=cases.find(c=>c.kind===kind);
  const base={kind,level:c.level,price:c.price,atr4h:c.atr,model};
  const yellow=calculateRegimeV7({...base,daily:{...c.daily,averageK:'黃'}});
  const purple=calculateRegimeV7({...base,daily:{...c.daily,averageK:'紫'}});
  assert.ok(Math.abs(yellow.probability-purple.probability)>1e-5,kind);
  assert.ok(Number.isFinite(yellow.haEffectPp));
 }
});
test('new model refuses a level outside prior training distance',()=>{
 const c=cases.find(c=>c.kind==='底齊');
 assert.equal(calculateRegimeV7({kind:'底齊',level:c.price-4*c.atr,price:c.price,atr4h:c.atr,daily:c.daily,model}).status,'OUTSIDE_TRAINING_RANGE');
});
test('main app uses new coefficients AND no longer renders misleading after-20:00 probability override',()=>{
 const app=root('src/app.js'),engine=root('src/engine.js'),html=root('index.html');
 assert.match(app,/model\/regime_v7\.json/);
 assert.match(engine,/calculateRegimeV7\(/);
 assert.match(app,/slopeEffectPp/);
 assert.match(app,/haEffectPp/);
 assert.doesNotMatch(app,/intrabarBreakoutStatus\(/);
 assert.doesNotMatch(html,/id="liveBreakoutPanel"/);
 assert.match(app,/freezeForDay/);
 assert.match(html,/<span id="modelName">v7\.0<\/span>/);
 assert.match(root('src/storage.js'),/btc4h-breakout-v1\.3\.0-REGIME/);
});
