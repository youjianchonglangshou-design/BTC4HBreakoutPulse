"""Chromium offline layout/interaction test with realistic sample prices (not live market)."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import json,re
root=Path(__file__).resolve().parents[1]
html=(root/'index.html').read_text()
html=re.sub(r'<link rel="stylesheet"[^>]*>', '', html)
html=re.sub(r'<script type="module"[^>]*></script>', '', html)
css=(root/'styles.css').read_text()
chart=(root/'src/chart.js').read_text().replace("import {normalizeBars} from './market.js';",'')
chart=re.sub(r'\bexport ', '', chart)
chart='const normalizeBars=xs=>(xs||[]).slice().sort((a,b)=>a.ts-b.ts);\n'+chart+'\nwindow.renderCandles4h=renderCandles4h;'
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
 page=browser.new_page(viewport={'width':1600,'height':900},device_scale_factor=1)
 page.set_content(html,wait_until='load');page.add_style_tag(content=css);page.add_script_tag(content=chart)
 # Exercise UI with realistic 48 Pionex-like 4H bars; no fabricated live-feed claim.
 page.evaluate('''() => {
  const put=(id,x)=>document.getElementById(id).textContent=x;
  put('countdown','19:47:31');put('connection','派網 10秒更新 · 00:12:23');
  put('chartSource','PIONEX · TV 圖表');put('historyStatus','2200 根派網4H已收線');
  put('summaryTop','83,206.0');put('summaryFloor','82,560.0');
  put('topDetail','確認 10/10 04:00 · 1 回');put('floorDetail','確認 10/10 16:00 · 0 回');
  put('topConfirmed','2026-10-10 04:00');put('floorConfirmed','2026-10-10 16:00');
  put('topTouches','1 回');put('floorTouches','0 回');put('topCrosses','0 次');put('floorCrosses','0 次');
  put('topDistance','0.39 ATR');put('floorDistance','0.61 ATR');
  put('midState','中軌之下 · 84,357.8');put('slopeState','上斜（0.241%／日）');put('haState','紫色 · HA 82,707.1');
  put('summaryMid','中軌之下 · 84,357.8');put('summarySlope','上斜 · 0.241%/日');put('summaryHA','紫色 · 82,707.1');
  put('probName','4H 底齊有效跌破機率');put('probability','25.6%');put('probInterpret','跌破能力偏弱');
  put('freezeBadge','20:00 已凍結');document.getElementById('freezeBadge').className='chip frozen';
  put('explanation','依關卡距離／類型的歷史模型推算，未觸發貼線加成');
  put('lineConfirmed','2026-10-10 16:00');put('touchCount','0 回');put('crossCount','0 次');put('distance','0.61 ATR');
  document.getElementById('featureList').innerHTML='<div class="feature"><span>預測目標</span><strong>底齊 82,560.0</strong></div><div class="feature"><span>4H ATR (14)</span><strong>710.8</strong></div><div class="feature"><span>兩小時貼線規律</span><strong>未觸發</strong></div><div class="feature"><span>基礎模型機率</span><strong>16.6%</strong></div><div class="feature"><span>中軌 / HA</span><strong>顯示背景</strong></div>';
  const now=Date.parse('2026-10-10T15:30:00Z'),FOUR=14400000;
  const prices=Array.from({length:48},(_,i)=>{
    const trend=i<16?84340+(i*115):i<30?86200-(i-16)*265:82140+(i-30)*75;
    const open=trend+Math.sin(i*1.11)*156,close=trend+Math.cos(i*.8)*155;
    return {ts:Math.floor((now/FOUR)-48+i)*FOUR,open,high:Math.max(open,close)+160,low:Math.min(open,close)-145,close};
  });
  window.renderCandles4h(document.getElementById('candles'),prices,{kind:'底齊',level:82560},{now,currentPrice:82966.0});
 }''')
 assert page.locator('.chart-subnote').count()==0
 assert page.locator('.meter').count()==0
 assert page.locator('.version-mark').inner_text()=='v1.2.1'
 assert page.locator('#candles text').filter(has_text='NOW 82,966.0').count()==1
 assert page.locator('#candles text').filter(has_text='底齊 82,560.0').count()==0
 dims=page.evaluate('''()=>({scrollH:document.documentElement.scrollHeight,innerH:innerHeight,scrollW:document.documentElement.scrollWidth,innerW:innerWidth,chart:document.querySelector('.chart-pane').getBoundingClientRect().height,bar:document.querySelector('.decision-ribbon').getBoundingClientRect().height})''')
 print('desktop dimensions:',dims)
 assert dims['scrollW']<=dims['innerW']+1,'Desktop horizontal scroll'
 assert dims['scrollH']<=dims['innerH']+5,'Desktop vertical scroll (collapsed archive)'
 assert page.locator('.prob-pane').bounding_box()['x']>page.locator('.quick-facts').bounding_box()['x']
 assert page.locator('#probability').inner_text()=='25.6%'
 page.screenshot(path='/mnt/data/BTC4HBreakoutPulse_v1.2.1_DESKTOP.png',full_page=True)
 # Hover/tap details open in overlay without increasing document scroll-height.
 for target in ('.top-quick','.floor-quick','.market-quick'):
  page.locator(target).hover()
  panel=page.locator(target+' .detail-popover')
  assert panel.is_visible(),target+' panel failed to open'
  h=page.evaluate('document.documentElement.scrollHeight')
  assert h<=dims['innerH']+5,f'{target} popover unexpectedly extends document'
  if target=='.market-quick':
   assert panel.get_by_text('模型判斷',exact=False).count()>0
   page.screenshot(path='/mnt/data/BTC4HBreakoutPulse_v1.2.1_HOVER_CONTEXT.png',full_page=True)
  page.mouse.move(1510,800)
  assert not panel.is_visible(),target+' did not hide on pointer leave'
 # Re-run chart-level tooltip check.
 hit=page.locator('[data-role=barrier-hover-hit]');assert hit.count()==1
 xy=page.evaluate('''()=>{const l=document.querySelector('[data-role=barrier-hover-hit]');const p=new DOMPoint(600,Number(l.getAttribute('y1'))).matrixTransform(l.getScreenCTM());return {x:p.x,y:p.y}}''')
 page.mouse.move(xy['x'],xy['y'])
 assert page.locator('[data-role=barrier-tooltip]').count()==1
 page.mouse.move(1510,800)
 assert page.locator('[data-role=barrier-tooltip]').count()==0
 # Common desktop resolutions: ensure the essential row remains visible.
 for width,height in ((1440,900),(1366,768),(1280,720)):
  page.set_viewport_size({'width':width,'height':height})
  stat=page.evaluate('''()=>({sh:document.documentElement.scrollHeight,sw:document.documentElement.scrollWidth,ih:innerHeight,iw:innerWidth})''')
  assert stat['sw']<=stat['iw']+1,f'{width}px desktop horizontal scroll'
  assert stat['sh']<=stat['ih']+5,f'{width}x{height} desktop vertical scroll: {stat}'
 # mobile: controls stack, no horizontal scroll; tapping opens/closes details.
 mobile_ctx=browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True,device_scale_factor=1)
 mobile=mobile_ctx.new_page();mobile.set_content(html,wait_until='load');mobile.add_style_tag(content=css)
 mobile.screenshot(path='/mnt/data/BTC4HBreakoutPulse_v1.2.1_MOBILE.png',full_page=True)
 assert mobile.evaluate('document.documentElement.scrollWidth<=innerWidth+1'), 'Mobile overflow'
 mobile.add_script_tag(content=(root/'src/app.js').read_text().split('// Summary cards behave like TennisRatio rating panels:')[1].join([]) if False else '// Summary cards behave like TennisRatio rating panels:'+ (root/'src/app.js').read_text().split('// Summary cards behave like TennisRatio rating panels:')[1])
 mobile.locator('.floor-quick').tap()
 assert mobile.locator('.floor-quick .detail-popover').is_visible(),'Tap should expand'
 mobile.locator('.floor-quick').tap()
 assert not mobile.locator('.floor-quick .detail-popover').is_visible(),'Second tap should close'
 mobile_ctx.close()
 print('PASS: 1600x900 full dashboard, chart, dynamic popup hover, line hover, mobile tap/no horizontal scroll')
 browser.close()
