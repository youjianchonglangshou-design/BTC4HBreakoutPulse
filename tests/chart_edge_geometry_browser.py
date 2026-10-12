"""Visual geometry regression. Tests real SVG screen mapping and compact desktop fit.
Run: python tests/chart_edge_geometry_browser.py
The fixture is local; no online market endpoints are used.
"""
import json,re
from pathlib import Path
from playwright.sync_api import sync_playwright
base=Path(__file__).resolve().parents[1]
fixture=json.loads((base/'tests/replay_20261005.fixture.json').read_text())
html=re.sub(r'<link rel="stylesheet"[^>]*>','',(base/'index.html').read_text())
html=re.sub(r'<script type="module"[^>]*></script>','',html)
css=(base/'styles.css').read_text()
js=(base/'src/chart.js').read_text().replace("import {normalizeBars} from './market.js';",'')
js=re.sub(r'\bexport ', '', js)
js='const normalizeBars=xs=>(xs||[]).slice().sort((a,b)=>a.ts-b.ts);\n'+js+'\nwindow.renderCandles4h=renderCandles4h;'
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
 for width,height in [(1280,720),(1366,768),(1440,900),(1600,900)]:
  page=browser.new_page(viewport={'width':width,'height':height})
  page.set_content(html)
  page.add_style_tag(content=css)
  page.add_script_tag(content=js)
  page.evaluate('''({bars,now})=>{
   const closed=bars.filter(b=>b.ts+14400000<=now);
   const live=bars.find(b=>b.ts<=now&&b.ts+14400000>now)||null;
   window.renderCandles4h(document.querySelector('#candles'),closed,{kind:'底齊',level:82560},{now,currentPrice:82850.5,liveBar:live});
  }''',{'bars':fixture['fourHour'][-58:],'now':fixture['cut']})
  result=page.evaluate('''()=>{
   const svg=document.getElementById('candles'), b=svg.getBoundingClientRect(),t=svg.getScreenCTM();
   const tick=t.a*58+t.e, plotRight=t.a*1270+t.e;
   const nowRect=[...svg.querySelectorAll('rect')].find(e=>e.getAttribute('fill')==='#0b3444').getBoundingClientRect();
   const marker=svg.querySelector('[data-role="barrier-hover-hit"]');
   return {plotLeft:tick,plotRight,width:plotRight-tick,nowRight:nowRect.right,canvasLeft:b.left,canvasRight:b.right,
    letterbox:b.left-t.e,overflowX:document.documentElement.scrollWidth>innerWidth,
    overflowY:document.documentElement.scrollHeight>innerHeight,scrollHeight:document.documentElement.scrollHeight,
    svgAspect:+(b.width/b.height).toFixed(2),svgRenderedWidth:b.width,
    renderedBars:[...svg.querySelectorAll('rect')].filter(e=>['#20c79c','#f17a86'].includes(e.getAttribute('fill'))).length,
    hoverHit:!!marker};
  }''')
  assert not result['overflowX'],f'{width}: horizontal overflow {result}'
  assert not result['overflowY'],f'{width}: vertical overflow {result}'
  assert result['plotLeft']>=0 and result['plotLeft']-result['canvasLeft']<=65,f'{width}: left price scale still too far inward {result}'
  assert result['nowRight']<=result['canvasRight'] and result['canvasRight']-result['nowRight']<18,f'{width}: NOW label does not fill right-edge space {result}'
  assert abs(result['letterbox'])<2.1,f'{width}: SVG still letterboxed horizontally {result}'
  assert result['renderedBars']==48 and result['hoverHit'],f'{width}: visual features missing {result}'
  print(width,height,'PASS',json.dumps(result,ensure_ascii=False))
  page.close()
 # On small screens ensure no sideways scrollbar; compact mobile design still fits.
 page=browser.new_page(viewport={'width':390,'height':844})
 page.set_content(html);page.add_style_tag(content=css)
 assert page.evaluate('document.documentElement.scrollWidth<=window.innerWidth')
 print('390x844 PASS no horizontal overflow')
 page.close();browser.close()
