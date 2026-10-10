import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {evaluate,freezeSnapshot,settlementForSnapshot} from '../src/engine.js';
import {tpeClock,taiwanDate,forecastWindow} from '../src/clock.js';
const read=x=>JSON.parse(fs.readFileSync(new URL(x,import.meta.url),'utf8'));
const fixture=read('./replay_20261005.fixture.json'),model=read('../model/v6.json'),gate=read('../model/rule.json');
test('TPE boundaries are exact UTC+8, no US stock market DST',()=>{
 const cut=Date.parse('2026-10-05T12:00:00Z');
 assert.equal(taiwanDate(cut),'2026-10-05');
 assert.equal(tpeClock(cut),'20:00:00');
 assert.equal(forecastWindow(cut-1).pre,true);
 assert.equal(forecastWindow(cut).post,true);
 assert.equal(forecastWindow(cut).end,cut+4*3600000);
});
test('as-of-only strict20 requires 48 fully completed 15m candles and past 4H, never a new quote',()=>{
 const {cut,fourHour,fifteenMin,daily}=fixture;
 const snap=freezeSnapshot({fourHour,fifteenMin,daily,model,gate,cut});
 assert.ok(['OK','NO_BARRIER'].includes(snap.status),JSON.stringify(snap));
 // Add a massive future price spike; it must NOT affect the frozen 20:00 prediction.
 const future15=[...fifteenMin,{ts:cut,open:100000,high:300000,low:10,close:300000}];
 const future4=[...fourHour,{ts:cut,open:100000,high:300000,low:10,close:300000}];
 const snap2=freezeSnapshot({fourHour:future4,fifteenMin:future15,daily,model,gate,cut});
 assert.equal(snap2.status,snap.status);
 assert.equal(snap2.price,snap.price);
 assert.equal(snap2.line?.level,snap.line?.level);
 assert.equal(snap2.prediction?.probability,snap.prediction?.probability);
 const missing=fifteenMin.filter(b=>b.ts!==cut-900000);
 const invalid=freezeSnapshot({fourHour,fifteenMin:missing,daily,model,gate,cut});
 assert.equal(invalid.status,'FREEZE_HISTORY_INCOMPLETE');
});
test('before20 v6 preplay uses live price and preserves market side/structure',()=>{
 const {cut,fourHour,fifteenMin,daily}=fixture;
 const current=fifteenMin.find(b=>b.ts===cut-900000)?.close;
 const x=evaluate({fourHour,fifteenMin,daily,model,gate,price:current,asOf:cut-10000});
 assert.ok(['OK','NO_BARRIER'].includes(x.status),JSON.stringify(x));
 assert.ok(['頂齊','底齊'].includes(x.kind));
 assert.ok(['黃','紫'].includes(x.daily.averageK));
});
test('settlement cannot happen before00 even if a future partial candle is supplied',()=>{
 const {cut,fourHour,fifteenMin,daily}=fixture;
 const snap=freezeSnapshot({fourHour,fifteenMin,daily,model,gate,cut});
 if(snap.status!=='OK')return;
 const future4=[...fourHour,{ts:cut,open:snap.price,high:100000,low:1,close:snap.price+100}];
 assert.equal(settlementForSnapshot(snap,future4,cut+3*3600000).status,'PENDING');
 const settle=settlementForSnapshot(snap,future4,cut+4*3600000);
 assert.equal(settle.status,'SETTLED');
 assert.equal(settle.success,snap.kind==='頂齊'?settle.close>snap.line.level*1.0001:settle.close<snap.line.level*.9999);
});

test('daily HA below midline selects the lower Pionex 4H floor (跌破), not the 4H top',()=>{
 const modified=fixture.daily.map((b,i)=>{
  if(i<fixture.daily.length-21||i===fixture.daily.length-1)return b;
  return {...b,open:b.open*1.05,high:b.high*1.05,low:b.low*1.05,close:b.close*1.05};
 });
 const result=evaluate({fourHour:fixture.fourHour,fifteenMin:fixture.fifteenMin,daily:modified,
  price:86223.4,asOf:Date.parse('2026-10-05T11:55:00Z'),model,gate});
 assert.equal(result.status,'OK');
 assert.equal(result.daily.side,'中軌之下');
 assert.equal(result.kind,'底齊');
 assert.ok(result.line.level<result.price);
 assert.equal(result.prediction.definition,'00:00 收盤 < 底齊 × 0.9999');
});
