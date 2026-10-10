"""Real Chromium interaction test for barrier label: absent -> mouse hover -> absent."""
from __future__ import annotations
from pathlib import Path
from playwright.sync_api import sync_playwright
base=Path(__file__).resolve().parents[1]
# Run the unchanged chart renderer inside a real Chromium DOM without network access.
source=(base/'src/chart.js').read_text()
source=source.replace("import {normalizeBars} from './market.js';", "const normalizeBars = xs => [...(xs||[])].sort((a,b)=>a.ts-b.ts);")
source=source.replace('export function ', 'function ')
source+='\nwindow.renderCandles4h=renderCandles4h;\n'
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
  page=browser.new_page(viewport={'width':1300,'height':680},device_scale_factor=1)
  page.set_content('<!doctype html><html lang="zh-Hant"><body style="background:#071321;color:#fff"><h3>4H 水平線互動驗證（模擬 K 線）</h3><svg id="candles" viewBox="0 0 1200 460" style="width:1200px;height:460px;display:block;background:#08192a"></svg></body></html>')
  page.add_script_tag(content=source)
  page.evaluate('''() => {
   const FOUR=14400000,now=Date.parse('2026-10-10T12:30:00Z');
   const bars=Array.from({length:35},(_,i)=>{const base=82540+Math.sin(i*.49)*290;
     return {ts:now-(35-i)*FOUR-30*60000,open:base,high:base+140,low:base-170,close:base+60};});
   window.drawKind=kind=>window.renderCandles4h(document.querySelector('#candles'),bars,
     {kind,level:kind==='底齊'?82440:82700},{now,currentPrice:82600});
   window.drawKind('底齊');
  }''')
  svg=page.locator('#candles')
  for kind in ('底齊','頂齊'):
   if kind=='頂齊':page.evaluate("window.drawKind('頂齊')")
   def none():
    assert page.locator('#candles [data-role="barrier-tooltip"]').count()==0, f'{kind}: tooltip unexpectedly visible'
    assert svg.locator('text').filter(has_text=f'{kind} ').count()==0, f'{kind}: stale text'
   # Ensure no tooltip at default
   page.mouse.move(1200,650)
   none()
   assert svg.locator('text').filter(has_text='NOW').count()==1
   line=page.locator('#candles [data-role="barrier-hover-hit"]')
   assert line.count()==1
   xy=page.evaluate('''() => {let l=document.querySelector('[data-role="barrier-hover-hit"]');
    let p=new DOMPoint(680,Number(l.getAttribute('y1'))).matrixTransform(l.getScreenCTM());
    return {x:p.x,y:p.y};}''')
   page.mouse.move(xy['x'],xy['y'])
   page.wait_for_function("document.querySelector('[data-role=barrier-tooltip]') !== null")
   assert svg.locator('text').filter(has_text=f'{kind} ').count()==1, f'{kind}: tooltip failed to appear on real hover'
   if kind=='底齊':page.screenshot(path='/mnt/data/BTC4HBreakoutPulse_v1.1.3_hover_shown.png')
   page.mouse.move(1200,650)
   page.wait_for_function("document.querySelector('[data-role=barrier-tooltip]') === null")
   none()
   if kind=='底齊':page.screenshot(path='/mnt/data/BTC4HBreakoutPulse_v1.1.3_default_hidden.png')
   print(f'PASS {kind}: no label by default / hover shows / leave removes / NOW remains')
  browser.close()
finally:
 pass
