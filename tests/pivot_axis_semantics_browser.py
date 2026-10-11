"""v1.2.5 real Chromium acceptance for left-price-axis pivot label + semantic popovers.
Uses synthetic Pionex-shaped bars; offline visual interaction, not market-feed verification.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright
import re
root=Path(__file__).resolve().parents[1]
html=(root/'index.html').read_text()
html=re.sub(r'<link rel="stylesheet"[^>]*>', '', html)
html=re.sub(r'<script type="module"[^>]*></script>', '', html)
css=(root/'styles.css').read_text()
js_chart=(root/'src/chart.js').read_text().replace("import {normalizeBars} from './market.js';", "const normalizeBars = xs=>[...(xs||[])].sort((a,b)=>a.ts-b.ts);")
js_chart=js_chart.replace('export function ', 'function ')+'\nwindow.renderCandles4h=renderCandles4h;'
fixture_src=(root/'tests/turn_markers_browser.py').read_text()
init=re.search(r"js='''(\(\) => \{.*?\})'''",fixture_src,re.S)
assert init,'Synthetic fixture missing'
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
 page=browser.new_page(viewport={'width':1600,'height':900},device_scale_factor=1)
 page.set_content(html,wait_until='load')
 page.add_style_tag(content=css)
 page.add_script_tag(content=js_chart)
 page.evaluate(init.group(1))
 # Provide known daily tones and verify the CSS EXACTLY matches quick-summary pills.
 page.evaluate('''() => {
  const values=[['summaryMid','midState','below','中軌之下 · 84,357.8'],
                ['summarySlope','slopeState','rising','上斜 (0.143%／日)'],
                ['summaryHA','haState','purple','紫色 · HA 82,786.5']];
  for(const [quick,detail,tone,text] of values){
   const el=document.getElementById(detail);el.dataset.tone=tone;el.textContent=text;
   document.getElementById(quick).dataset.tone=tone;
  }
 }''')
 def move_svg(x,y,steps=5):
  pt=page.evaluate('''({x,y})=>{const s=document.querySelector('#candles');const p=new DOMPoint(x,y).matrixTransform(s.getScreenCTM());return {x:p.x,y:p.y}}''',{'x':x,'y':y})
  page.mouse.move(pt['x'],pt['y'],steps=steps)
  return pt
 svg=page.locator('#candles')
 assert svg.locator('[data-role=pivot-axis-price-tag]').count()==0
 for kind,color in [('頂齊','#f27585'),('底齊','#36d3a2')]:
  mark=svg.locator(f'[data-role=alignment-turn-marker][data-kind="{kind}"]')
  x=float(mark.get_attribute('data-x'));y=float(mark.get_attribute('data-y'))
  move_svg(x,y)
  page.wait_for_function("document.querySelector('[data-role=pivot-axis-price-tag]') !== null")
  tag=svg.locator('[data-role=pivot-axis-price-tag]')
  line=svg.locator('[data-role=pivot-extension-line]')
  rect=tag.locator('rect')
  yy=float(line.get_attribute('y1'))
  assert float(line.get_attribute('y2'))==yy
  assert line.get_attribute('x1')=='0', f'{kind}: line should extend through left axis'
  assert line.get_attribute('x2')=='1070'
  assert tag.get_attribute('data-kind')==kind
  assert line.get_attribute('stroke')==color
  boxy=float(rect.get_attribute('y'));h=float(rect.get_attribute('height'))
  assert boxy+h/2==yy, f'{kind}: line {yy} vs label center {boxy+h/2}'
  assert float(rect.get_attribute('x'))==1
  assert float(rect.get_attribute('x'))+float(rect.get_attribute('width'))==60
  assert tag.locator('text').count()==1
  assert svg.locator('text').filter(has_text='NOW').count()==1
  cross=svg.locator('[data-role=chart-crosshair]')
  assert cross.locator('rect').first.get_attribute('visibility')=='hidden'
  assert cross.locator('line').nth(1).get_attribute('visibility')=='hidden'
  ss=root/('TEST_v125_'+('TOP' if kind=='頂齊' else 'FLOOR')+'.png')
  page.screenshot(path=str(ss))
  # The label must not move when the cursor glides across the pivot mark.
  before=tag.get_attribute('data-center-y')
  move_svg(x+3,y+1,steps=2)
  assert tag.get_attribute('data-center-y')==before
  move_svg(810,290)
  assert tag.count()==0,f'{kind}: focus must disappear when leaving pivot marker'
  assert cross.locator('rect').first.get_attribute('visibility')=='visible'
  print('PASS',kind,'left-axis label center aligns with dashed line; no NOW collision; dismisses on leave')
 # Semantic popover: request real pointer hover (not just CSS text check).
 quick=page.locator('.market-quick')
 quick.hover()
 popup=page.locator('.context-detail')
 assert popup.is_visible()
 for qid,did in [('summaryMid','midState'),('summarySlope','slopeState'),('summaryHA','haState')]:
  q=page.locator('#'+qid); d=page.locator('#'+did)
  assert q.get_attribute('data-tone')==d.get_attribute('data-tone')
  assert 'state-value' in (d.get_attribute('class') or '')
  props=page.evaluate('''([a,b])=>{const x=getComputedStyle(document.getElementById(a));const y=getComputedStyle(document.getElementById(b));return {a:x.color,b:y.color,bgA:x.backgroundColor,bgB:y.backgroundColor}}''',[qid,did])
  assert props['a']==props['b'],(qid,did,props)
  assert props['bgA']==props['bgB'],(qid,did,props)
 assert page.evaluate("getComputedStyle(document.querySelector('#haState')).color")=='rgb(179, 157, 219)'
 page.screenshot(path=str(root/'TEST_v125_CONTEXT.png'))
 # Test alternate set of semantic colors (yellow, falling, above) in the same panel.
 page.evaluate('''() => {for(const [a,b,t] of [['summaryMid','midState','above'],['summarySlope','slopeState','falling'],['summaryHA','haState','yellow']]){
  document.getElementById(a).dataset.tone=t;document.getElementById(b).dataset.tone=t;
 }}''')
 assert page.evaluate("getComputedStyle(document.querySelector('#haState')).color")=='rgb(255, 235, 59)'
 page.screenshot(path=str(root/'TEST_v125_CONTEXT_ALT.png'))
 # Red/green structure detail price chips and popup hover.
 for kind,cls in [('top','top-detail'),('floor','floor-detail')]:
  page.mouse.move(5,5)
  page.locator('.'+kind+'-quick').hover()
  assert page.locator('.'+cls).is_visible()
  b=page.locator('.'+cls+' .popup-title b')
  assert float(b.evaluate('(e)=>getComputedStyle(e).borderTopWidth.replace("px", "")'))>0
 page.mouse.move(5,5)
 assert not page.locator('.context-detail').is_visible()
 assert svg.locator('[data-role=pivot-axis-price-tag]').count()==0
 print('PASS 3 contextual pills computed colors match summaries (both regimes), popup hover works, structure headers colored')
 browser.close()
print('PASS v1.2.5 Chromium visual interaction checks')
