"""Chromium E2E: fixed-top OHLC, crosshair axis tags, historical turn extension, as-of markers."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import re
base=Path(__file__).resolve().parents[1]
html=(base/'index.html').read_text()
html=re.sub(r'<link rel="stylesheet"[^>]*>', '', html)
html=re.sub(r'<script type="module"[^>]*></script>', '', html)
css=(base/'styles.css').read_text()
js_chart=(base/'src/chart.js').read_text().replace("import {normalizeBars} from './market.js';", "const normalizeBars = xs=>[...(xs||[])].sort((a,b)=>a.ts-b.ts);")
js_chart=js_chart.replace('export function ', 'function ')+"\nwindow.renderCandles4h=renderCandles4h;"
# Reuse the confirmed source/turn/third-bar synthetic data from the existing browser acceptance test.
test_src=(base/'tests/turn_markers_browser.py').read_text()
init=re.search(r"js='''(\(\) => \{.*?\})'''",test_src,re.S)
assert init,"fixture missing"
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
 page=browser.new_page(viewport={'width':1600,'height':900},device_scale_factor=1)
 page.set_content(html,wait_until='load')
 page.add_style_tag(content=css)
 page.add_script_tag(content=js_chart)
 page.evaluate(init.group(1))
 svg=page.locator('#candles')
 assert page.locator('#chartOhlc').count()==1
 assert '開' in page.locator('#chartOhlc').inner_text(), 'last bar should show OHLC even without hover'
 assert svg.locator('g[data-role=chart-crosshair]').get_attribute('visibility')=='hidden'
 assert svg.locator('g[data-role=pivot-level-overlay]').count()==0
 # helper: browser proper SVG coords with responsive CTM (not guessed CSS positions)
 def move_svg(x,y,steps=5):
  pt=page.evaluate('''({x,y})=>{const s=document.querySelector('#candles');const p=new DOMPoint(x,y).matrixTransform(s.getScreenCTM());return {x:p.x,y:p.y}}''',{'x':x,'y':y})
  page.mouse.move(pt['x'],pt['y'],steps=steps)
  return pt
 move_svg(550,160)
 assert svg.locator('g[data-role=chart-crosshair]').get_attribute('visibility')=='visible'
 ohlc=page.locator('#chartOhlc').inner_text()
 assert '開' in ohlc and '高' in ohlc and '低' in ohlc and '收' in ohlc and '%' in ohlc and '量' in ohlc,ohlc
 axis=svg.locator('g[data-role=chart-crosshair]')
 assert axis.locator('line').count()==2
 assert axis.locator('rect').count()==2
 assert axis.locator('text').count()==2
 assert not svg.locator('g[data-role=pivot-level-overlay]').count()
 page.screenshot(path='/mnt/data/BTC4HBreakoutPulse_v1.2.3_OHLC_CROSSHAIR.png')
 print('PASS K棒：頂端 OHLC＋漲跌幅＋量、十字虛線、價格標籤、日期時間標籤')
 for kind,col in [('頂齊','#f27585'),('底齊','#36d3a2')]:
  mark=svg.locator(f'[data-role=alignment-turn-marker][data-kind="{kind}"]')
  hit=mark.locator('[data-role=turn-marker-hit]')
  assert hit.count()==1
  x=float(mark.get_attribute('data-x'));y=float(mark.get_attribute('data-y'))
  move_svg(x,y)
  page.wait_for_function("document.querySelector('g[data-role=pivot-level-overlay]') !== null")
  over=svg.locator('[data-role=pivot-level-overlay]')
  line=over.locator('[data-role=pivot-extension-line]')
  assert line.get_attribute('stroke')==col
  assert abs(float(line.get_attribute('x1'))-x)<.001,'horizontal guide must START at turning candle'
  assert line.get_attribute('x2')=='1070','extend right to price gutter'
  assert over.locator('text').text_content().startswith(kind)
  assert svg.locator('text').filter(has_text='NOW').count()==1
  if kind=='頂齊':
   page.screenshot(path='/mnt/data/BTC4HBreakoutPulse_v1.2.3_TOP_TURN_HOVER.png')
  else:
   page.screenshot(path='/mnt/data/BTC4HBreakoutPulse_v1.2.3_FLOOR_TURN_HOVER.png')
  # A marker has fully distinct hover overlay, not the prediction barrier line.
  move_svg(800,250)
  assert over.count()==0,kind+' overlay must disappear when pointer leaves'
  print('PASS '+kind+'：轉折標記 hover → 由原轉折時間延伸虛線＋價位標籤；離開消失')
 # quote redraw during real marker hover must preserve level, not create persistent stale guide
 mark=svg.locator('[data-role=alignment-turn-marker][data-kind="底齊"]')
 move_svg(float(mark.get_attribute('data-x')),float(mark.get_attribute('data-y')))
 assert svg.locator('[data-role=pivot-level-overlay]').count()==1
 page.evaluate('''()=>window.renderCandles4h(document.querySelector('#candles'),window._bars,{kind:'底齊',level:window._marks[1].level},
 {now:window._bars.at(-1).ts+14400000,currentPrice:83020,pivots:window._marks})''')
 assert svg.locator('text').filter(has_text='NOW 83,020.0').count()==1
 assert svg.locator('[data-role=pivot-level-overlay]').count()==1
 move_svg(830,290)
 assert svg.locator('[data-role=pivot-level-overlay]').count()==0
 print('PASS 派網 10 秒報價改變時浮動轉折線重畫、NOW 保留、離開清除')
 page.mouse.move(10,10)
 assert svg.locator('g[data-role=chart-crosshair]').get_attribute('visibility')=='hidden'
 # Narrow screen keeps the top OHLC row in-page rather than spilling horizontally.
 page.set_viewport_size({'width':390,'height':844})
 page.mouse.move(5,5)
 widths=page.evaluate('''()=>({scroll:document.documentElement.scrollWidth,inner:innerWidth})''')
 assert widths['scroll']<=widths['inner']+2, widths
 assert page.locator('#chartOhlc').is_visible()
 page.screenshot(path='/mnt/data/BTC4HBreakoutPulse_v1.2.3_MOBILE.png')
 print('PASS 手機版 390px：無水平溢出、頂端 OHLC 仍保留')
 browser.close()
print('PASS TradingView-style E2E all browser checks')
