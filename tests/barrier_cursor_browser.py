"""Chromium E2E: cursor-following chart hover, real pointer movements, no NOW label overlap."""
from pathlib import Path
from playwright.sync_api import sync_playwright
base=Path(__file__).resolve().parents[1]
source=(base/'src/chart.js').read_text()
source=source.replace("import {normalizeBars} from './market.js';", "const normalizeBars = xs => [...(xs||[])].sort((a,b)=>a.ts-b.ts);")
source=source.replace('export function ', 'function ')
source+='\nwindow.renderCandles4h=renderCandles4h;\n'
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
 page=browser.new_page(viewport={'width':1440,'height':750},device_scale_factor=1)
 page.set_content('<!doctype html><html lang="zh-Hant"><body style="background:#071321;color:#fff"><h3>4H 水平線游標跟隨測試</h3><svg id="candles" viewBox="0 0 1200 460" style="width:1200px;height:460px;display:block;background:#08192a"></svg></body></html>')
 page.add_script_tag(content=source)
 page.evaluate('''() => {
  const FOUR=14400000,now=Date.parse('2026-10-10T12:30:00Z');
  const bars=Array.from({length:35},(_,i)=>{const b=82540+Math.sin(i*.49)*290;
    return {ts:now-(35-i)*FOUR-30*60000,open:b,high:b+140,low:b-170,close:b+60};});
  // Intentionally identical price and barrier -- this MUST NOT overlap the right NOW tag.
  window.marketBars=bars;window.marketNow=now;window.latestQuote=82600;
  window.drawKind=kind=>window.renderCandles4h(document.querySelector('#candles'),window.marketBars,
    {kind,level:82600},{now:window.marketNow,currentPrice:window.latestQuote});
  window.drawKind('底齊');
 }''')
 svg=page.locator('#candles')
 for kind in ('底齊','頂齊'):
  if kind=='頂齊': page.evaluate("window.drawKind('頂齊')")
  page.mouse.move(1210,695)
  assert page.locator('[data-role=barrier-tooltip]').count()==0
  hit=page.locator('[data-role=barrier-hover-hit]')
  assert hit.count()==1
  points=[]
  for pos in (180,530,975):
   xy=page.evaluate('''(pos)=>{const l=document.querySelector('[data-role=barrier-hover-hit]');
    const p=new DOMPoint(pos,+l.getAttribute('y1')).matrixTransform(l.getScreenCTM());
    return {x:p.x,y:p.y};}''',pos)
   page.mouse.move(xy['x'],xy['y'],steps=7)
   page.wait_for_function("document.querySelector('[data-role=barrier-tooltip]') !== null")
   bbox=page.evaluate('''()=>{const t=document.querySelector('[data-role=barrier-tooltip]');
    const b=t.getBBox(),m=t.getCTM();
    const q=document.querySelector('#candles text');
    return {x:+t.dataset.tooltipX,y:+t.dataset.tooltipY,w:b.width,h:b.height,
      transform:t.getAttribute('transform'),content:t.textContent};}''')
   assert bbox['content']==f'{kind} 82,600.0',bbox
   assert 79<=bbox['x']<=1006-158-8,bbox
   points.append(bbox['x'])
   if kind=='底齊' and pos==530:
    page.screenshot(path='/mnt/data/BTC4HBreakoutPulse_v1.1.4_cursor_hover.png')
  assert points[0]<points[1]<points[2],f'{kind} label did not follow cursor: {points}'
  assert svg.locator('text').filter(has_text='NOW 82,600.0').count()==1
  # Re-render chart at the same pointer position with a different LIVE quote.
  # The tooltip must remain anchored by the cursor, not jump to the right edge.
  page.evaluate('''() => {
    window.latestQuote=82610;
    window.drawKind(document.querySelector('[data-role=barrier-tooltip]')?.textContent.startsWith('底齊')?'底齊':'頂齊');
  }''')
  new_box=page.evaluate('''()=>{const t=document.querySelector('[data-role=barrier-tooltip]');
    return t&&{x:+t.dataset.tooltipX,text:t.textContent};}''')
  assert new_box and new_box['x']==points[-1], f'quote-refresh moved tooltip incorrectly: {new_box}'
  assert svg.locator('text').filter(has_text='NOW 82,610.0').count()==1
  page.evaluate('window.latestQuote=82600')
  page.mouse.move(1210,695)
  page.wait_for_function("document.querySelector('[data-role=barrier-tooltip]') === null")
  assert svg.locator('text').filter(has_text=f'{kind} 82,600.0').count()==0
  print(f'PASS {kind}: 3 cursor X positions -> tooltip X {points}; no NOW overlap; leave removes tooltip')
 page.screenshot(path='/mnt/data/BTC4HBreakoutPulse_v1.1.4_cursor_hidden.png')
 browser.close()
