"""Real Chromium visual proof of v1.2.1 semantic color contract; synthetic BTC prices."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import re
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
 page.set_content(html,wait_until='load')
 page.add_style_tag(content=css)
 page.add_script_tag(content=chart)
 setup='''([kind,pct,mid,slope,ha])=>{
   const put=(id,text)=>document.getElementById(id).textContent=text;
   put('countdown','19:47:31');put('connection','派網 10秒更新 · 00:12:23');
   put('chartSource','PIONEX · TV 圖表');put('historyStatus','2200 根派網4H已收線');
   put('summaryTop','83,206.0');put('summaryFloor','82,560.0');
   put('topDetail','確認 10/10 04:00 · 測試 0 回');put('floorDetail','確認 10/10 16:00 · 測試 0 回');
   put('topConfirmed','2026-10-10 04:00');put('floorConfirmed','2026-10-10 16:00');
   put('topTouches','0 回');put('floorTouches','0 回');put('topCrosses','0 次');put('floorCrosses','0 次');
   put('topDistance','0.39 ATR');put('floorDistance','0.61 ATR');
   const below=mid==='below',yellow=ha==='yellow';
   put('midState',(below?'中軌之下':'中軌之上')+' · 84,357.8');
   put('summaryMid',(below?'中軌之下':'中軌之上')+' · 84,357.8');
   put('slopeState',slope==='rising'?'上斜（0.241%／日）':slope==='falling'?'下斜（-0.480%／日）':'下降走平中（-0.32%／日）');
   put('summarySlope',slope==='rising'?'↑上斜 · 0.241%/日':slope==='falling'?'↓下斜 · -0.480%/日':'↘下降走平中 · -0.320%/日');
   put('haState',(yellow?'黃色':'紫色')+' · HA 82,707.1');
   put('summaryHA',(yellow?'黃色':'紫色')+' · 82,707.1');
   for(const [id,tone] of [['summaryMid',mid],['summarySlope',slope],['summaryHA',ha]]){
     const el=document.getElementById(id);el.dataset.tone=tone;el.parentElement.dataset.tone=tone;
   }
   const tone=pct===50?'neutral':kind==='頂齊'?(pct>50?'bull-strong':'bull-weak'):(pct>50?'bear-strong':'bear-weak');
   document.querySelector('.prob-pane').dataset.tone=tone;
   put('probName',kind==='頂齊'?'4H 頂齊有效突破機率':'4H 底齊有效跌破機率');
   put('probability',pct.toFixed(1)+'%');put('probInterpret',pct>50?'偏向有效穿越':'有效穿越機率偏低');
   put('freezeBadge','動態 · 10秒更新');
   document.getElementById('freezeBadge').className='chip active';
   put('explanation','依關卡距離與歷史事件推算，本示範僅用於確認視覺語意。');
   put('lineConfirmed','2026-10-10 16:00');put('touchCount','0 回');put('crossCount','0 次');put('distance','0.61 ATR');
   const now=Date.parse('2026-10-10T15:00:00Z'),FOUR=14400000;
   const prices=Array.from({length:48},(_,i)=>{
     const trend=i<16?84340+(i*115):i<30?86200-(i-16)*265:82140+(i-30)*75;
     const open=trend+Math.sin(i*1.11)*156,close=trend+Math.cos(i*.8)*155;
     return {ts:Math.floor(now/FOUR)*FOUR-(48-i)*FOUR,open,high:Math.max(open,close)+160,low:Math.min(open,close)-145,close};
   });
   window.renderCandles4h(document.getElementById('candles'),prices,{kind,level:kind==='頂齊'?83206:82560},{now,currentPrice:82966.0});
 }'''
 scenarios=[('bear_weak','底齊',15.7,'below','rising','purple','#f4aa70'),('bull_strong','頂齊',57.3,'above','rising','yellow','#43e2b0'),('bear_strong','底齊',60.2,'below','falling','purple','#ff8190'),('bull_weak','頂齊',43.0,'above','flattening','yellow','#f4b66a')]
 for name,kind,pct,mid,slope,ha,color in scenarios:
  page.evaluate(setup,[kind,pct,mid,slope,ha])
  page.wait_for_timeout(300)
  prob=page.locator('#probability')
  computed=prob.evaluate('(el)=>getComputedStyle(el).color')
  # Compute exact expected colors in browser.
  expected=page.evaluate('(hex)=>{const e=document.createElement("span");e.style.color=hex;document.body.append(e);const x=getComputedStyle(e).color;e.remove();return x}',color)
  assert computed==expected,(name,computed,expected)
  assert page.locator('.state-pill').count()==3
  assert page.locator('#summaryHA').get_attribute('data-tone')==ha
  assert page.locator('#summaryMid').get_attribute('data-tone')==mid
  scroll=page.evaluate('''()=>({w:document.documentElement.scrollWidth,iw:innerWidth,h:document.documentElement.scrollHeight,ih:innerHeight})''')
  assert scroll['w']<=scroll['iw']+1,scroll
  assert scroll['h']<=scroll['ih']+5,scroll
  if name in ['bear_weak','bull_strong']:
   target=Path('/mnt/data')/f'BTC4HBreakoutPulse_v1.2.1_{name}.png'
   page.screenshot(path=str(target),full_page=True)
   print(f'SCREENSHOT {target}')
  print(f'PASS {name}: {pct}% = {computed}; three capsules; no scrolling')
 # On hover of a capsule, detailed popup stays in overlay.
 page.locator('.market-quick').hover()
 assert page.locator('.market-quick .detail-popover').is_visible()
 assert page.evaluate('document.documentElement.scrollHeight<=innerHeight+5')
 page.mouse.move(1570,880)
 assert not page.locator('.market-quick .detail-popover').is_visible()
 # chart line and label use matching semantic colors
 for kind,expected in [('頂齊','#f27585'),('底齊','#36d3a2')]:
  page.evaluate(setup,[kind,15.7 if kind=='底齊' else 57.3,'below' if kind=='底齊' else 'above','rising','purple'])
  e=page.locator('svg line[stroke-dasharray="8 6"]')
  assert e.count()==1
  assert e.get_attribute('stroke')==expected
  assert page.locator('[data-role="barrier-tooltip"]').count()==0
 print('PASS hover details, barriers, tooltip hidden, and all color states')
 browser.close()
