"""Real Chromium: current top/floor pulse, hover precedence, active switching and no false glow."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import re
root=Path(__file__).resolve().parents[1]
html=re.sub(r'<link rel="stylesheet"[^>]*>','', (root/'index.html').read_text())
html=re.sub(r'<script type="module"[^>]*></script>','',html)
css=(root/'styles.css').read_text()
chart=(root/'src/chart.js').read_text().replace("import {normalizeBars} from './market.js';", "const normalizeBars=xs=>[...xs].sort((a,b)=>a.ts-b.ts);")
chart=chart.replace('export function ','function ')+'\nwindow.renderCandles4h=renderCandles4h;'
fixture_src=(root/'tests/turn_markers_browser.py').read_text()
init=re.search(r"js='''(\(\) => \{.*?\})'''",fixture_src,re.S)
assert init
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
 page=browser.new_page(viewport={'width':1600,'height':900})
 page.set_content(html,wait_until='load')
 page.add_style_tag(content=css)
 page.add_script_tag(content=chart)
 page.evaluate(init.group(1))
 opts='''(selection,price=82960)=>{
  const ms=window._marks,bars=window._bars;
  document.querySelector('.top-quick').dataset.active=selection.includes('top')?'true':'false';
  document.querySelector('.floor-quick').dataset.active=selection.includes('floor')?'true':'false';
  window.renderCandles4h(document.querySelector('#candles'),bars,
    {kind:'底齊',level:ms[1].level},
    {now:bars.at(-1).ts+14400000,currentPrice:price,pivots:ms,
     activeBarriers: [selection.includes('top')?ms[0]:null,
                      selection.includes('floor')?ms[1]:null].filter(Boolean)});
 }'''
 page.evaluate(opts,'top,floor')
 svg=page.locator('svg#candles')
 for kind in ['頂齊','底齊']:
  mark=svg.locator(f'[data-role=alignment-turn-marker][data-kind="{kind}"]')
  assert mark.get_attribute('data-active')=='true'
  assert mark.locator('[data-role=active-turn-halo]').count()==1
  assert mark.locator('[data-role=active-turn-ring]').count()==1
  assert mark.locator('[data-role=turn-marker-hit]').count()==1
  assert mark.locator('[data-role=active-turn-halo]').get_attribute('pointer-events')=='none'
 assert svg.locator('[data-role=active-turn-halo]').count()==2
 # Check the browser is ACTUALLY animating the halo, not merely containing inert SVG tags.
 opacity=lambda: page.evaluate('''() => getComputedStyle(document.querySelector('[data-role="active-turn-halo"]')).opacity''')
 samples=[]
 for _ in range(6):
  samples.append(float(opacity()))
  page.wait_for_timeout(170)
 assert max(samples)-min(samples)>.025, f'breathing animation did not change opacity: {samples}'
 # Browser runtime geometry and speed, not only static test values.
 halo=svg.locator('[data-role="active-turn-halo"]').first
 ring=svg.locator('[data-role="active-turn-ring"]').first
 for part,expected_span in [(halo,6),(ring,4)]:
  sample=[]
  for _ in range(12):
   sample.append(part.evaluate('(el)=>el.r.animVal.value'))
   page.wait_for_timeout(160)
  assert max(sample)<=(15.1 if expected_span==6 else 12.1),f'new radius max too big: {sample}'
  assert max(sample)-min(sample)>(3.0 if expected_span==6 else 2.0),f'pulse too subtle or stopped: {sample}'
 assert halo.locator('animate').first.get_attribute('dur')=='2.1s'
 assert page.evaluate("getComputedStyle(document.querySelector('.top-quick')).animationDuration")=='2.3s'
 assert page.evaluate("getComputedStyle(document.querySelector('.floor-quick')).animationDuration")=='2.3s'
 print('PASS actual SVG radius samples stay ≤15/12 and continue visibly pulsing at 2.1s')
 assert page.evaluate("getComputedStyle(document.querySelector('.top-quick')).animationName")=='active-top-card'
 assert page.evaluate("getComputedStyle(document.querySelector('.floor-quick')).animationName")=='active-floor-card'
 page.wait_for_timeout(750)
 shot=root/'PREVIEW_v1.2.7_ACTIVE.png'
 page.screenshot(path=str(shot))
 print('PASS normal view: top red + floor green halos, card CSS glow, NOW label, exact active-only')
 # Hover prioritizes the legacy pivot guides and left price-axis tooltip.
 top=svg.locator('[data-role=alignment-turn-marker][data-kind="頂齊"]')
 coords=top.evaluate('(el)=>({x:Number(el.dataset.x),y:Number(el.dataset.y)})')
 pt=page.evaluate('''({x,y})=>{const s=document.querySelector('#candles');const a=new DOMPoint(x,y).matrixTransform(s.getScreenCTM());return {x:a.x,y:a.y}}''',coords)
 page.mouse.move(pt['x'],pt['y'])
 page.wait_for_function('document.querySelector("[data-role=pivot-axis-price-tag]")!==null')
 assert top.locator('[data-role=active-turn-halo]').count()==1
 assert svg.locator('[data-role=pivot-extension-line]').get_attribute('stroke')=='#f27585'
 assert svg.locator('[data-role=pivot-axis-price-tag]').get_attribute('data-kind')=='頂齊'
 assert svg.locator('text').filter(has_text='NOW').count()==1
 shot=root/'PREVIEW_v1.2.7_HOVER.png'
 page.screenshot(path=str(shot))
 print('PASS hovered active TOP: axis guide/tooltip wins without removing glow')
 page.mouse.move(25,25)
 assert svg.locator('[data-role=pivot-axis-price-tag]').count()==0
 # Change selections without changing price; must repaint.
 page.evaluate(opts,'floor')
 assert svg.locator('[data-role=active-turn-halo]').count()==1
 assert svg.locator('[data-role=active-turn-halo]').get_attribute('data-kind')=='底齊'
 assert svg.locator('[data-role=active-turn-exit][data-kind="頂齊"]').count()==1
 assert page.locator('.top-quick').get_attribute('data-active')=='false'
 assert page.locator('.floor-quick').get_attribute('data-active')=='true'
 # Price redraw every 10 seconds cannot activate other history markers.
 page.evaluate(opts,['floor',82980])
 assert svg.locator('[data-role=active-turn-halo]').count()==1
 assert svg.locator('text').filter(has_text='NOW').count()==1
 # Invalid / invisible selection -> NONE, even when same level.
 page.evaluate('''() => {const m=window._marks; window.renderCandles4h(document.querySelector('#candles'),window._bars,null,
  {now:window._bars.at(-1).ts+14400000,currentPrice:82980,pivots:m,
   activeBarriers:[{...m[0],id:'wrong-line-id'}]});}''')
 assert svg.locator('[data-role=active-turn-halo]').count()==0
 assert svg.locator('[data-role=alignment-turn-marker]').count()==2
 print('PASS active swap & 10-second quote redraw & false historical match suppressed')
 browser.close()
print('PASS v1.2.7 Chromium active marker scenarios')
