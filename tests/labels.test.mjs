import test from 'node:test';
import assert from 'node:assert/strict';
import {getDirectionLabels} from '../src/labels.js';
test('below midline means 跌破底齊 everywhere, never 突破',()=>{
 const r=getDirectionLabels('底齊');
 assert.equal(r.title,'4H 底齊有效跌破機率');
 assert.equal(r.verb+r.object,'跌破底齊');
 assert.equal(r.success,'有效跌破');
 assert.equal(r.failure,'未有效跌破');
 assert.equal(r.weak,'跌破能力偏弱');
});
test('above midline means 突破頂齊 everywhere',()=>{
 const r=getDirectionLabels('頂齊');
 assert.equal(r.title,'4H 頂齊有效突破機率');
 assert.equal(r.verb+r.object,'突破頂齊');
 assert.equal(r.strong,'突破能力較強');
});
