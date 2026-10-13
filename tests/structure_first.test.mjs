import test from 'node:test';
import assert from 'node:assert/strict';
import {selectStructureCandidate,selectFirstBarrier,scanHistoricalAlignments,SEARCH_TIERS_4H} from '../src/structure.js';
const H=14_400_000,asOf=Date.parse('2026-10-13T12:00:00Z');
const ev=(kind,price,agoBars,id)=>({kind,level:price,id,formed:asOf-agoBars*H,turnTs:asOf-(agoBars-1)*H,confirmed:asOf-(agoBars-3)*H});
const pick=(events,kind,price=83000)=>selectStructureCandidate(events,{asOf,price,kind});

test('箱體：近期最高有效底齊優先，舊支撐再接近也不能取代',()=>{
 const e=[ev('底齊',82200,5,'recent-low'),ev('底齊',82600,10,'recent-high'),ev('底齊',82990,125,'old-near')];
 const line=pick(e,'底齊');
 assert.equal(line.id,'recent-high');assert.equal(line.searchWindowBars,50);
});
test('反覆箱體：不依摸線次數踢掉關卡；選線階段不再設硬性觸碰上限',()=>{
 const e=[ev('底齊',82700,12,'8+touches'),ev('底齊',81700,128,'old')];
 assert.equal(pick(e,'底齊').id,'8+touches');
});
test('波折下跌：近期仍有有效底齊就不去找歷史底齊',()=>{
 const e=[ev('底齊',82300,3,'swing1'),ev('底齊',82600,25,'swing2'),ev('底齊',82900,200,'old-near')];
 assert.equal(pick(e,'底齊').id,'swing2');
});
test('連續下殺：近期底齊都已位在現價上方，往左擴展找支撐',()=>{
 const e=[ev('底齊',83500,2,'already-broken'),ev('底齊',84000,6,'also-broken'),ev('底齊',81500,115,'historical')];
 const l=pick(e,'底齊',82000);
 assert.equal(l.id,'historical');assert.equal(l.searchWindowBars,150);
});
test('頂齊鏡像：近期最低有效頂齊優先於更早的近價水平線',()=>{
 const e=[ev('頂齊',84000,8,'new-1'),ev('頂齊',83500,4,'new-2'),ev('頂齊',83010,180,'old-near')];
 const l=pick(e,'頂齊');assert.equal(l.id,'new-2');assert.equal(l.searchWindowBars,50);
});
test('候選尚未確認、位於錯誤一側，均不可被選取',()=>{
 const e=[ev('頂齊',83001,2,'not-confirmed'),ev('頂齊',82700,8,'already-under')];
 e[0].confirmed=asOf+H;
 assert.equal(pick(e,'頂齊'),null);
});
test('as-of cutoff：選線不讀取20:00之後才確認的線',()=>{
 const e=[ev('底齊',82700,10,'good'),ev('底齊',82900,3,'future')];
 e[1].confirmed=asOf+H;
 assert.equal(pick(e,'底齊').id,'good');
});
test('遠距的近期線優先：標記為待驗證範圍，而非偷偷改選舊線',()=>{
 const e=[ev('頂齊',90000,4,'new-far'),ev('頂齊',83002,70,'old-close')];
 assert.equal(pick(e,'頂齊').id,'new-far');
});
test('沒有關卡、年齡超限、無效方向均不強制猜測',()=>{
 const e=[ev('底齊',80000,2250,'too-old')];
 assert.equal(pick(e,'底齊'),null);
 assert.equal(pick(e,'foo'),null);
 assert.deepEqual(SEARCH_TIERS_4H,[50,150,450,Infinity]);
});


test('end-to-end: confirmed 4H floor with >8 separate touches is still eligible',()=>{
 const T=Date.parse('2026-10-01T00:00:00Z');
 const bars=[
  {ts:T,open:100,close:90,high:105,low:85},
  {ts:T+H,open:90,close:96,high:103,low:89},
  {ts:T+2*H,open:96,close:106,high:108,low:94}
 ];
 // 10 episodes separated by two bars with NO price-range touch.
 for(let z=0;z<10;z++){
  for(let i=0;i<3;i++){
   const x=bars.length;
   bars.push(i===0?{ts:T+x*H,open:97,high:101,low:89.9,close:98}:
                 {ts:T+x*H,open:101,high:105,low:96,close:103});
  }
 }
 const cutoff=T+bars.length*H;
 const evt=scanHistoricalAlignments(bars,cutoff).events.find(e=>e.kind==='底齊'&&e.level===90);
 assert.ok(evt,'synthetic confirmed floor exists');
 const chosen=selectFirstBarrier(bars,cutoff,95,5,'底齊',{maxTouches:8,maxDistanceATR:3});
 assert.ok(chosen,'floor survives despite many touches');
 assert.equal(chosen.level,90);
 assert.ok(chosen.episodes>8,`episodes=${chosen.episodes}`);
 assert.equal(chosen.exceedsLegacyTouchLimit,true);
});

test('end-to-end: forming turn before confirmation is not a usable level',()=>{
 const T=Date.parse('2026-10-01T00:00:00Z');
 const bars=[{ts:T,open:100,close:90,high:105,low:85},
  {ts:T+H,open:90,close:96,high:100,low:89},
  {ts:T+2*H,open:96,close:106,high:108,low:94}];
 assert.equal(selectFirstBarrier(bars,T+2*H,95,5,'底齊'),null);
 assert.equal(selectFirstBarrier(bars,T+3*H,95,5,'底齊')?.level,90);
});
