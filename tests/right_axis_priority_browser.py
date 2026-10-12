"""Real Chromium acceptance: right-side price axis, 50 unchanged-width bars and overlap precedence.
Uses synthetic Pionex-formatted data only; no live market connection.
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
js_chart=js_chart.replace('export function ','function ').replace('export const chartLayout','const chartLayout').replace('export const chartLayout','const chartLayout')
js_chart+='\nwindow.renderCandles4h=renderCandles4h;window.chartLayout=chartLayout;\n'
base=Path(__file__).resolve().parents[1]
test_src=(base/'tests/turn_markers_browser.py').read_text()
fixture=re.search(r"js='''(\(\) => \{.*?\})'''",test_src,re.S).group(1)
fixture=fixture.replace('base+49*four','base+51*four')
fixture=fixture.replace('length:48','length:50').replace('[47,82900]','[49,82900]').replace('bars[47]','bars[49]')
fixture=fixture.replace('BTC4HBreakoutPulse','BTC4HBreakoutPulse')
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
 page=browser.new_page(viewport={'width':1440,'height':900},device_scale_factor=1)
 page.set_content(html,wait_until='load')
 page.add_style_tag(content=css)
 page.add_script_tag(content=js_chart)
 page.evaluate(fixture)
 svg=page.locator('#candles')
 assert page.locator('.version-mark').inner_text()=='v1.2.12'
 assert '最近 50 根' in page.locator('.chart-title strong').inner_text()
 assert page.evaluate('''()=>window.chartLayout.left===8 && window.chartLayout.count===50 && (window.chartLayout.right-window.chartLayout.left)/50>25''')
 assert svg.locator('[data-role="price-axis-tick"]').count()==6
 assert all(float(svg.locator('[data-role="price-axis-tick"]').nth(i).get_attribute('x'))>=1280 for i in range(6))
 assert svg.locator('[data-role="now-price-label"]').count()==1
 assert svg.locator('[data-role="candle-bar"]').count()==50
 print('PASS right-side price ticks, 50 same-width Pionex 4H candles')
 def move_svg(x,y,steps=6):
  pt=page.evaluate('''({x,y})=>{const s=document.querySelector('#candles');const p=new DOMPoint(x,y).matrixTransform(s.getScreenCTM());return {x:p.x,y:p.y}}''',{'x':x,'y':y})
  page.mouse.move(pt['x'],pt['y'],steps=steps)
 def show(tag): return tag.get_attribute('visibility')!='hidden'
 def now_tag(): return svg.locator('[data-role="now-price-label"]')
 def cursor_tag():return svg.locator('[data-role="cursor-price-tag"]')
 # Move away from future price, hover other Y: NOW remains visible when tags do not overlap.
 move_svg(600,160)
 assert show(now_tag()),'NOW must remain visible if cursor price far away'
 assert show(cursor_tag())
 assert float(cursor_tag().get_attribute('x'))>=1279
 page.screenshot(path='/mnt/data/BTC4HBreakoutPulse_v1.2.12_CURSOR_FAR.png')
 # Cursor exactly where NOW label sits -> priority cursor over a still-visible NOW label.
 price_label=page.evaluate('''()=>{const el=document.querySelector('[data-role="now-price-label"] rect');return {center:Number(el.getAttribute('y'))+Number(el.getAttribute('height'))/2}}''')
 move_svg(550,price_label['center'])
 assert show(now_tag()),'NOW must remain visible even under generic cursor overlay'
 assert show(cursor_tag()),'generic cursor label must stay visible'
 assert page.evaluate("document.querySelector('[data-role=now-price-label]').compareDocumentPosition(document.querySelector('[data-role=chart-crosshair]')) & Node.DOCUMENT_POSITION_FOLLOWING"), 'cursor SVG must be painted over NOW'
 page.screenshot(path='/mnt/data/BTC4HBreakoutPulse_v1.2.12_CURSOR_OVERLAP.png')
 move_svg(570,160)
 assert show(now_tag()),'NOW must remain visible after leaving collision region'
 print('PASS cursor tag wins on overlap, NOW remains visible on overlap and separation')
 # Hover pivot marker while forced quote=the structural level (same price): pivot wins, NOW remains visible behind tooltip.
 floor=page.evaluate('''()=>window._marks.find(m=>m.kind==='底齊')''')
 def redraw(quote,target=None):
  page.evaluate('''({quote,target})=>window.renderCandles4h(document.querySelector('#candles'),window._bars,target,{now:window._bars.at(-1).ts+14400000,currentPrice:quote,pivots:window._marks})''',{'quote':quote,'target':target})
 redraw(floor['level'])
 pivot=svg.locator('[data-role="alignment-turn-marker"][data-kind="底齊"]')
 move_svg(float(pivot.get_attribute('data-x')),float(pivot.get_attribute('data-y')))
 page.wait_for_function("document.querySelector('[data-role=pivot-axis-price-tag]') !== null")
 struct_tag=svg.locator('[data-role=pivot-axis-price-tag]')
 guide=svg.locator('[data-role=pivot-extension-line]')
 assert show(struct_tag)
 assert page.evaluate("document.querySelector('[data-role=now-price-label]').compareDocumentPosition(document.querySelector('[data-role=pivot-axis-price-tag]')) & Node.DOCUMENT_POSITION_FOLLOWING"), 'pivot SVG must paint over NOW'
 assert show(now_tag()),'NOW must remain visible beneath pivot overlay'
 assert not show(cursor_tag()),'pivot must also suppress generic cursor price'
 assert float(struct_tag.locator('rect').get_attribute('x'))>=1279
 assert float(struct_tag.locator('rect').get_attribute('y'))+11==float(guide.get_attribute('y1'))
 page.screenshot(path='/mnt/data/BTC4HBreakoutPulse_v1.2.12_PIVOT_OVERLAP.png')
 print('PASS pivot tag > cursor and NOW when overlapping; right price scale and line centered')
 # Top pivot gets identical precedence: a quote at the top pivot's level is covered.
 top=page.evaluate('''()=>window._marks.find(m=>m.kind==='頂齊')''')
 redraw(top['level'])
 topmark=svg.locator('[data-role="alignment-turn-marker"][data-kind="頂齊"]')
 move_svg(float(topmark.get_attribute('data-x')),float(topmark.get_attribute('data-y')))
 page.wait_for_function("document.querySelector('[data-role=pivot-axis-price-tag]') !== null")
 assert show(now_tag()),'NOW must remain visible beneath top pivot overlay'
 assert show(svg.locator('[data-role=pivot-axis-price-tag]'))
 assert svg.locator('[data-role=pivot-axis-price-tag]').get_attribute('data-kind')=='頂齊'
 print('PASS top resistance tag has same priority as floor support')
 # 10-second quote redraw: a NEW NOW label must remain in SVG beneath hovered pivot.
 redraw(floor['level']+0.4)
 pivot=svg.locator('[data-role="alignment-turn-marker"][data-kind="底齊"]')
 move_svg(float(pivot.get_attribute('data-x')),float(pivot.get_attribute('data-y')))
 page.wait_for_function("document.querySelector('[data-role=pivot-axis-price-tag]') !== null")
 assert show(now_tag()),'NOW must stay visible after realtime quote redraw on overlapping pivot'
 assert svg.locator('[data-role=pivot-axis-price-tag]').count()==1
 print('PASS live quote redraw preserves underlying NOW and overlaid pivot label')
 # Different quote must preserve NOW while hovered pivot is far apart.
 redraw(floor['level']+4500)
 pivot=svg.locator('[data-role="alignment-turn-marker"][data-kind="底齊"]')
 move_svg(float(pivot.get_attribute('data-x')),float(pivot.get_attribute('data-y')))
 page.wait_for_function("document.querySelector('[data-role=pivot-axis-price-tag]') !== null")
 assert show(now_tag()),'NOW remains if 2 tags do not overlap'
 print('PASS structural pivot tag and NOW coexist when y values are separated')
 # Hover directly over selected barrier that exactly equals quote: barrier priority.
 redraw(floor['level'],{'kind':'底齊','level':floor['level']})
 cy=page.evaluate('''()=>Number(document.querySelector('[data-role=barrier-hover-hit]').getAttribute('y1'))''')
 move_svg(780,cy)
 page.wait_for_function("document.querySelector('[data-role=barrier-tooltip]') !== null")
 assert show(now_tag()),'NOW must remain visible beneath barrier overlay'
 assert not show(cursor_tag()),'selected line must win over generic cursor tag'
 assert page.evaluate("document.querySelector('[data-role=now-price-label]').compareDocumentPosition(document.querySelector('[data-role=barrier-tooltip]')) & Node.DOCUMENT_POSITION_FOLLOWING"), 'barrier tooltip SVG must paint over NOW'
 assert float(svg.locator('[data-role=barrier-tooltip] rect').get_attribute('x'))>=1279
 page.screenshot(path='/mnt/data/BTC4HBreakoutPulse_v1.2.12_BARRIER_OVERLAP.png')
 move_svg(600,145)
 assert show(now_tag()),'NOW remains visible after pointer leaves'
 assert not svg.locator('[data-role=barrier-tooltip]').count(),'barrier tag vanishes on mouse leave'
 print('PASS barrier tag priority, mouse exit cleanup')
 widths=page.evaluate('''()=>({scroll:document.documentElement.scrollWidth,inner:innerWidth})''')
 assert widths['scroll']<=widths['inner']+1,widths
 print('PASS 1440 desktop no horizontal overflow')
 browser.close()
print('PASS v1.2.12 Chromium right-axis priority E2E')
