import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const html=read('index.html'),css=read('styles.css'),chart=read('src/chart.js'),app=read('src/app.js'),version=JSON.parse(read('VERSION.json'));
test('v1.2.9: compact chart first, lower row puts structure / daily context LEFT and large probability RIGHT',()=>{
 assert.match(html,/<section class="pane chart-pane"/);
 assert.ok(html.indexOf('class="chart-pane"')<html.indexOf('class="decision-ribbon"'));
 assert.ok(html.indexOf('class="quick-facts"')<html.indexOf('class="prob-pane"'));
 assert.match(css,/\.decision-ribbon\{display:grid;grid-template-columns:/);
 assert.equal((html.match(/id="probability"/g)||[]).length,1);
 assert.doesNotMatch(html,/id="meterFill"|class="signal-progress"|class="chart-subnote"/);
 assert.doesNotMatch(html,/20:00 前動態預測 · 20:00 同時鎖定關卡與機率 · 00:00 驗證/);
});
test('3 popup cards exist, include detailed fields and are hidden until hover/focus/tap',()=>{
 for(const item of ['top-quick','floor-quick','market-quick'])assert.match(html,new RegExp(`class="[^\"]*${item}`));
 for(const id of ['topConfirmed','topTouches','topCrosses','topDistance','floorConfirmed','floorTouches','floorCrosses','floorDistance','midState','slopeState','haState','featureList'])assert.match(html,new RegExp(`id="${id}"`));
 assert.match(css,/\.detail-popover\{display:none;/);
 assert.match(css,/@media\(hover:hover\)\{\.quick-card:hover>\.detail-popover\{display:block\}\}/);
 assert.match(app,/classList\.toggle|classList\.add\('is-open'\)/);
});
test('4H live chart 48 bars, compact NOW label, same target line without persistent tag',()=>{
 assert.match(html,/最近 48 根 4H/);
 assert.match(chart,/slice\(-48\)/);
 assert.match(chart,/LEFT=61,RIGHT=1061/);
 assert.match(chart,/width:113,height:25/);
 assert.match(chart,/'data-role':'barrier-hover-hit'/);
 assert.match(chart,/data-role':'barrier-tooltip'/);
 assert.match(html,/id="historyStatus"/);
});
test('visible version exactly v1.2.9, app cache bust, same Pionex quote frozen probability logic',()=>{
 assert.equal(version.version,'1.2.9');
 assert.match(html,/class="version-mark"[^>]*>v1\.2\.9</);
 assert.match(html,/src\/app\.js\?v=1\.2\.9/);
 assert.match(app,/src\/chart\.js\?v=1\.2\.9|\.\/chart\.js\?v=1\.2\.9/);
 assert.match(app,/10000\)/);
 assert.match(app,/freezeForDay/);
 assert.doesNotMatch(html,/Binance Spot · 最近/);
});
