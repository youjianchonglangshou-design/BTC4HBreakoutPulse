// v1.3.0 intentionally removes v1.2.14 retrospective live market status UI.
// Frozen pre20 probability is primary; price alone keeps updating after cutoff.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('after-20:00 post-hoc observed breakdown no longer overwrites pre20 forecast screen',()=>{
 const app=read('src/app.js'),html=read('index.html');
 assert.doesNotMatch(app,/import \{intrabarBreakoutStatus\}/);
 assert.doesNotMatch(app,/intrabarBreakoutStatus\(/);
 assert.doesNotMatch(html,/id="liveBreakoutPanel"/);
 assert.match(app,/getFrozen\(window.date\)/);
 assert.match(app,/updateBtcTabTitle\(extractQuotePrice\(\),document,tabForecast\)/);
});
