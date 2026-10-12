import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const r=f=>readFileSync(new URL('../'+f,import.meta.url),'utf8');
const html=r('index.html'),app=r('src/app.js'),css=r('styles.css'),chart=r('src/chart.js');
test('three detail popover daily values reuse all three summary semantic tones',()=>{
 for(const name of ['midState','slopeState','haState'])assert.match(html,new RegExp(`class="state-value detail-state-value" id="${name}"`));
 for(const [a,b] of [['summaryMid','midState'],['summarySlope','slopeState'],['summaryHA','haState']]){
  assert.ok(app.includes(`['${a}',ctx.`));
  assert.ok(app.includes(`['${b}',ctx.`));
 }
 for(const color of ['#FFEB3B','#B39DDB'])assert.ok(css.includes(color));
 assert.match(css,/\.context-detail-row \.detail-state-value/);
 assert.match(css,/\.top-detail \.popup-title b/);
 assert.match(css,/\.floor-detail \.popup-title b/);
 assert.match(app,/name==='預測目標'/);
 assert.match(css,/\.feature-target-pill\[data-kind="底齊"\]/);
});
test('pivot extension crosses middle of a dedicated RIGHT-axis tag',()=>{
 assert.match(chart,/AXIS_TAG_X=AXIS_LABEL_X,AXIS_TAG_WIDTH=AXIS_LABEL_WIDTH,AXIS_TAG_HEIGHT=CROSS_HEIGHT/);
 assert.match(chart,/'data-role':'pivot-axis-price-tag'/);
 assert.match(chart,/y:yLine-AXIS_TAG_HEIGHT\/2/);
 assert.match(chart,/x1:LEFT,x2:GUTTER,y1:yLine,y2:yLine/);
 assert.match(chart,/focusLabel=\{kind:'pivot',y:yLine,height:AXIS_TAG_HEIGHT\}/);
 assert.doesNotMatch(chart,/const x=clamp\(px,LEFT,RIGHT\),pos=hoverTooltipGeometry\(x,yLine\)/);
});
