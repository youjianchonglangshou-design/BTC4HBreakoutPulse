import test from 'node:test';
import assert from 'node:assert/strict';
import {formatBtcTabTitle,updateBtcTabTitle} from '../src/tab_title.js';

const top = p => ({kind:'頂齊',probability:p});
const floor = p => ({kind:'底齊',probability:p});

test('live Pionex price + model percent + exactly matching direction shown together',()=>{
 assert.equal(formatBtcTabTitle(83032.9,floor(.074)),'BTC 83,032.9｜7.4% 跌破');
 assert.equal(formatBtcTabTitle(87052.1,top(.542)),'BTC 87,052.1｜54.2% 突破');
 assert.equal(formatBtcTabTitle(999.45,floor(.136)),'BTC 999.45｜13.6% 跌破');
});

test('10-second quote updates while probability stays unchanged after 20:00',()=>{
 const doc={title:'BTC'};
 const frozen=floor(.074);
 assert.equal(updateBtcTabTitle(83032.9,doc,frozen),true);
 assert.equal(doc.title,'BTC 83,032.9｜7.4% 跌破');
 assert.equal(updateBtcTabTitle(83040.6,doc,frozen),true);
 assert.equal(doc.title,'BTC 83,040.6｜7.4% 跌破');
 assert.equal(updateBtcTabTitle(83040.6,doc,frozen),false);
});

test('pre-20:00 probability and direction dynamically update with live model',()=>{
 const doc={title:'BTC'};
 updateBtcTabTitle(87052.1,doc,top(.542));
 assert.equal(doc.title,'BTC 87,052.1｜54.2% 突破');
 updateBtcTabTitle(87052.1,doc,top(.573));
 assert.equal(doc.title,'BTC 87,052.1｜57.3% 突破');
 updateBtcTabTitle(87052.1,doc,floor(.433));
 assert.equal(doc.title,'BTC 87,052.1｜43.3% 跌破');
});

test('no model or missing 4H barrier never displays a fabricated or stale percent',()=>{
 const doc={title:'BTC 83,032.9｜7.4% 跌破'};
 assert.equal(updateBtcTabTitle(83222,doc,null),true);
 assert.equal(doc.title,'BTC 83,222.0');
 for(const guess of [floor(null),top(NaN),top(Infinity),top(-.2),floor(1.7),{kind:'unknown',probability:.9},{}]){
  assert.equal(formatBtcTabTitle(83032.9,guess),'BTC 83,032.9');
 }
 assert.equal(formatBtcTabTitle(null,floor(.74)),'BTC');
});
