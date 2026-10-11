"""Chromium smoke test for the actual browser document.title formatter.
No remote API/localhost navigation is necessary; app integration is separately
verified with the Pionex historical feed fixture by app.integration.test.mjs.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright

root=Path(__file__).resolve().parents[1]
script=(root/'src/tab_title.js').read_text().replace('export function ','function ')
script+='\nwindow.tabTitle={formatBtcTabTitle,updateBtcTabTitle};'
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
 page=browser.new_page(viewport={'width':1000,'height':300})
 page.set_content('<!doctype html><title>BTC</title><main><h1>BTC 4H 頂齊／底齊</h1></main>')
 page.add_script_tag(content=script)
 def tab(price,pct,kind):
  return page.evaluate('''([price,pct,kind])=>{window.tabTitle.updateBtcTabTitle(price,document,{probability:pct,kind});return document.title}''',[price,pct,kind])
 assert tab(83032.9,.074,'底齊')=='BTC 83,032.9｜7.4% 跌破'
 assert tab(87052.1,.542,'頂齊')=='BTC 87,052.1｜54.2% 突破'
 assert tab(87052.1,.573,'頂齊')=='BTC 87,052.1｜57.3% 突破'
 # Frozen score remains constant; quote alone moves independently.
 assert tab(83032.9,.074,'底齊')=='BTC 83,032.9｜7.4% 跌破'
 assert tab(83040.1,.074,'底齊')=='BTC 83,040.1｜7.4% 跌破'
 assert page.evaluate('''() => {window.tabTitle.updateBtcTabTitle(83040.1,document,null);return document.title}''')=='BTC 83,040.1'
 print('PASS Chromium document.title: live price, model % and direction, frozen score, no-signal fallback')
 browser.close()
