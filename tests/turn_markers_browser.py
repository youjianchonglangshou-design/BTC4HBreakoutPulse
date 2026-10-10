"""Actual Chromium visual + semantic acceptance: arcs mark ORIGINAL turn bar, never confirmation.
Uses synthetic Pionex-shaped 4H candles; does not contact public API.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright
import re
root=Path(__file__).resolve().parents[1]
html=(root/'index.html').read_text()
html=re.sub(r'<link rel="stylesheet"[^>]*>', '', html)
html=re.sub(r'<script type="module"[^>]*></script>', '', html)
css=(root/'styles.css').read_text()
chart=(root/'src/chart.js').read_text()
chart=chart.replace("import {normalizeBars} from './market.js';", "const normalizeBars=xs=>[...(xs||[])].sort((a,b)=>a.ts-b.ts);")
chart=chart.replace('export function ','function ')
chart+='\nwindow.renderCandles4h=renderCandles4h;\n'
js='''() => {
 const four=14400000,base=Date.parse('2026-10-03T12:00:00Z'),now=base+49*four;
 const bars=Array.from({length:48},(_,i)=>{
   const keypoints=[[0,82600],[13,86500],[34,81800],[44,83200],[47,82900]];
   const k=keypoints.findIndex((x,j)=>j<keypoints.length-1&&i>=x[0]&&i<=keypoints[j+1][0]);
   const idx=Math.max(0,k),a=keypoints[idx],b=keypoints[idx+1];
   const price=a[1]+(b[1]-a[1])*(i-a[0])/(b[0]-a[0]);
   const open=price-35,close=price+35;
   return {ts:base+i*four,open,close,high:Math.max(open,close)+100,low:Math.min(open,close)-100};
 });
 // Distinct red/green arcs. Marks reference the first turn bars at 14 and 35.
 // Confirmation is deliberately 3 K bars later (16,37); the marker must NOT move there.
 bars[13]={ts:bars[13].ts,open:86200,close:86600,high:86730,low:86080}; // green source
 bars[14]={ts:bars[14].ts,open:86600,close:86380,high:86710,low:86280}; // red TURN
 bars[15]={ts:bars[15].ts,open:86380,close:86120,high:86500,low:85990}; // not confirmed
 bars[16]={ts:bars[16].ts,open:86120,close:86000,high:86190,low:85840}; // third confirms top
 bars[34]={ts:bars[34].ts,open:82120,close:81770,high:82200,low:81700}; // red source
 bars[35]={ts:bars[35].ts,open:81770,close:81950,high:82000,low:81690}; // green TURN
 bars[36]={ts:bars[36].ts,open:81950,close:82020,high:82120,low:81850}; // not confirmed
 bars[37]={ts:bars[37].ts,open:82020,close:82300,high:82400,low:81980}; // third confirms floor
 const marks=[
   {id:'TOP_13',kind:'頂齊',formed:bars[13].ts,turnTs:bars[14].ts,
    confirmed:bars[16].ts+four,level:bars[13].close},
   {id:'FLOOR_34',kind:'底齊',formed:bars[34].ts,turnTs:bars[35].ts,
    confirmed:bars[37].ts+four,level:bars[34].close}
 ];
 const put=(id,v)=>document.getElementById(id).textContent=v;
 put('countdown','18:30:05');put('connection','派網 10秒更新 · 01:30:05');
 put('historyStatus','2199 根派網4H已收線');put('chartSource','PIONEX · TV 圖表');
 put('summaryTop',marks[0].level.toFixed(1));put('summaryFloor',marks[1].level.toFixed(1));
 put('summaryMid','中軌之下 · 84,357.8');put('summarySlope','↑上斜 · 0.143%/日');
 put('summaryHA','紫色 · 82,786.5');put('probName','4H 底齊有效跌破機率');
 put('probability','15.3%');put('probInterpret','跌破能力偏弱');
 document.querySelector('.prob-pane').setAttribute('data-tone','bear-weak');
 document.querySelector('#summaryMid').setAttribute('data-tone','below');
 document.querySelector('#summaryMid').parentElement.setAttribute('data-tone','below');
 document.querySelector('#summarySlope').setAttribute('data-tone','rising');
 document.querySelector('#summarySlope').parentElement.setAttribute('data-tone','rising');
 document.querySelector('#summaryHA').setAttribute('data-tone','purple');
 document.querySelector('#summaryHA').parentElement.setAttribute('data-tone','purple');
 window.renderCandles4h(document.getElementById('candles'),bars,
  {kind:'底齊',level:marks[1].level},{now,currentPrice:bars[47].close,pivots:marks});
 window._marks=marks;window._bars=bars;
}'''
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
 page=browser.new_page(viewport={'width':1600,'height':900},device_scale_factor=1)
 page.set_content(html,wait_until='load')
 page.add_style_tag(content=css)
 page.add_script_tag(content=chart)
 page.evaluate(js)
 marks=page.locator('svg [data-role="alignment-turn-marker"]')
 assert marks.count()==2, f'expected two markers, found {marks.count()}'
 for kind,turn_index,confirm_index,color in [('頂齊',14,16,'#f27585'),('底齊',35,37,'#36d3a2')]:
  mark=marks.filter(has=page.locator(f'[data-kind="{kind}"]')) if False else page.locator(f'svg [data-role="alignment-turn-marker"][data-kind="{kind}"]')
  assert mark.count()==1
  times=mark.evaluate('(el)=>({t:el.dataset.turnTs,c:el.dataset.confirmedTs,x:Number(el.dataset.x),y:Number(el.dataset.y)})')
  source=page.evaluate('(i)=>({t:window._bars[i].ts})',turn_index)['t']
  future=page.evaluate('(i)=>({t:window._bars[i].ts})',confirm_index)['t']
  assert int(times['t'])==source,(kind,times,source)
  assert int(times['c'])==future+14400000,(kind,times,future)
  assert times['t']!=times['c'],(kind,times)
  assert mark.locator('path').get_attribute('stroke')==color
  text=mark.locator('title').text_content()
  assert '轉折 ' in text and '確認 ' in text
  print(f'PASS {kind}: mark at turning bar {turn_index}, confirmation bar {confirm_index}, color {color}')
 assert page.locator('svg [data-role="barrier-tooltip"]').count()==0
 assert page.locator('svg text').filter(has_text='NOW').count()==1
 page.screenshot(path='/mnt/data/BTC4HBreakoutPulse_v1.2.2_TURN_MARKERS_PREVIEW.png',full_page=True)
 # Confirm time embargo: if 'asOf' is before confirmation, a pre-computed future marker must not be displayed.
 page.evaluate('''() => window.renderCandles4h(document.getElementById('candles'),window._bars,null,
    {now:window._bars[15].ts+14400000,currentPrice:window._bars[15].close,pivots:window._marks})''')
 assert page.locator('svg [data-role="alignment-turn-marker"]').count()==0
 print('PASS no future-confirmed turn marker before confirmation')
 browser.close()
