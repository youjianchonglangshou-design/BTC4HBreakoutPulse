"""Chromium end-to-end OFFLINE using real v7 app (mocked Pionex streaming data).
Tests: pre20 quote -> model probability; 20:00 freeze; after20 quote only.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright
import re, json, base64
from datetime import datetime,timezone
root=Path(__file__).resolve().parents[1]
fixture=json.loads((root/'tests/replay_20261005.fixture.json').read_text())
cut=int(datetime(2026,10,5,12,tzinfo=timezone.utc).timestamp()*1000)
clock=cut-3*60*1000
cache={}
def module_url(file):
 p=(root/'src'/file).resolve()
 if p in cache:return cache[p]
 source=p.read_text()
 def rewrite(m):
  rel=m.group(2).split('?')[0]
  dep=(p.parent/rel).resolve();assert dep.parent==root/'src',dep
  return m.group(1)+module_url(dep.name)+m.group(1)
 source=re.sub(r"(['\"])(\./[^'\"]+\.js(?:\?[^'\"]*)?)\1",rewrite,source)
 url='data:text/javascript;base64,'+base64.b64encode(source.encode()).decode()
 cache[p]=url;return url

setup='''(() => {
 const fixture=__FIXTURE__;
 let clock=__CLOCK__;
 let quote=86320.0;
 Date.now=()=>clock;
 window.__test={getQuote:()=>quote,setQuote:v=>quote=v,setClock:v=>clock=v,clock:()=>clock};
 const memory=new Map();
 Object.defineProperty(window,'localStorage',{configurable:true,value:{
    getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,v),
    get length(){return memory.size},key:i=>[...memory.keys()][i]||null
 }});
 window.fetch=async (url)=> {
    const u=String(url);
    if(u.endsWith('model/regime_v7.json'))return {ok:true,json:async()=>(__MODEL__)};
    if(u.includes('scanner.tradingview.com'))return {ok:true,json:async()=>({data:[{s:'PIONEX:BTCUSDT.P',d:[quote]}]})};
    throw new Error('Unexpected external URL '+u);
 };
 const enc=new TextEncoder();
 const frame=o=>{const j=JSON.stringify(o);return `~m~${enc.encode(j).length}~m~${j}`;};
 window.WebSocket=class FakeWS {
   static OPEN=1;static CONNECTING=0;
   constructor(){this.readyState=0;this.handlers={};setTimeout(()=>{this.readyState=1;this.emit('open',{});},1)}
   addEventListener(event,cb){(this.handlers[event]??=[]).push(cb)}
   emit(e,p){for(const f of this.handlers[e]||[])f(p)}
   send(raw){const m=raw.match(/^~m~\\d+~m~([\\s\\S]+)$/);if(!m)return;
     let msg;try{msg=JSON.parse(m[1])}catch{return}
     if(msg.m!=='create_series')return;
     const [session,id,_,__,res,limit]=msg.p;
     const key=res==='240'?'fourHour':res==='15'?'fifteenMin':'daily';
     const rows=fixture[key].slice(-limit).map(b=>({v:[b.ts/1000,b.open,b.high,b.low,b.close,b.volume||1]}));
     setTimeout(()=>{this.emit('message',{data:frame({m:'timescale_update',p:[session,{[id]:{s:rows}}]})});this.emit('message',{data:frame({m:'series_completed',p:[session,id]})});},2);
   }
   close(){this.readyState=3}
 };
})()'''
setup=setup.replace('__FIXTURE__',json.dumps(fixture,ensure_ascii=False)).replace('__CLOCK__',str(clock)).replace('__MODEL__',json.dumps(json.loads((root/'model/regime_v7.json').read_text()),ensure_ascii=False))
html=re.sub(r'<link rel="stylesheet"[^>]*>','',(root/'index.html').read_text())
html=re.sub(r'<script type="module"[^>]*></script>','',html)
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
 page=browser.new_page(viewport={'width':1600,'height':900},device_scale_factor=1)
 errors=[];page.on('pageerror',lambda err:errors.append(str(err)))
 page.set_content(html,wait_until='load');page.add_style_tag(content=(root/'styles.css').read_text());page.add_script_tag(content=setup)
 page.add_script_tag(type='module',content='import '+json.dumps(module_url('app.js'))+';')
 try:page.wait_for_function("document.getElementById('probability')?.textContent.endsWith('%')",timeout=12000)
 except Exception:
  print('ERRORS',errors[:5]);print('STATE',page.evaluate("() => ({error:document.querySelector('#error')?.innerText,prob:document.querySelector('#probability')?.innerText,title:document.title})"));raise
 before=page.locator('#probability').inner_text();print('pre20',before,'tab',page.title());
 assert 'v1.3.0' in page.locator('.version-mark').inner_text()
 assert page.locator('#explanation').inner_text().find('斜率')>=0
 assert '黃紫' in page.locator('#featureList').inner_text()
 assert page.locator('#freezeBadge').inner_text().startswith('動態')
 page.evaluate('''() => {window.__test.setQuote(85920);document.dispatchEvent(new Event('visibilitychange'));}''')
 page.wait_for_function("document.querySelector('#connection')?.textContent.includes('10秒更新')",timeout=11000)
 # Event can select a different barrier, so we don't assume output is still present.
 assert '%' in page.locator('#probability').inner_text()
 page.screenshot(path=str(root/'PREVIEW_v1.3.0_REGIME_PRE20.png'))
 print('pre20 after quote:',page.locator('#probability').inner_text(),page.title())
 # cross 20:00 -> use 15m historical snapshot
 page.evaluate('''ts=>{window.__test.setClock(ts);document.dispatchEvent(new Event('visibilitychange'));}''',cut+2*60*1000)
 try:page.wait_for_function("document.querySelector('#freezeBadge')?.textContent.includes('已凍結')",timeout=13000)
 except Exception:print('POST ERROR',errors);raise
 freeze=page.locator('#probability').inner_text();print('frozen',freeze,'tab',page.title())
 assert 'liveBreakoutPanel' not in page.content()
 page.screenshot(path=str(root/'PREVIEW_v1.3.0_REGIME_FROZEN.png'))
 page.evaluate('''() => {window.__test.setQuote(81555);document.dispatchEvent(new Event('visibilitychange'));}''')
 page.wait_for_function("document.title.includes('81,555')",timeout=12000)
 assert page.locator('#probability').inner_text()==freeze,'frozen probability mutated after 20:00'
 assert not errors,'Unexpected JS errors: '+str(errors[:6])
 print('PASS v7 real Chromium actual UI; 20:00 frozen, after20 quote only, slope and HA present')
 browser.close()
