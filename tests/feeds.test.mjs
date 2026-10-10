import test from 'node:test';
import assert from 'node:assert/strict';
import {decodeScannerPayload,parseBinanceBars} from '../src/feeds.js';
import {formatBtcTabTitle,updateBtcTabTitle} from '../src/tab_title.js';
test('TradingView same JSON returns Pionex tab quote + Binance model quote separately',()=>{
 const q=decodeScannerPayload({data:[{s:'BINANCE:BTCUSDT',d:[82600.22]},{s:'PIONEX:BTCUSDT.P',d:[82605.38]}]});
 assert.equal(q.pionex,82605.38);assert.equal(q.spot,82600.22);
});
test('Binance klines parse correct open timestamp',()=>{
 const rows=parseBinanceBars([[1760000000000,'100','110','90','103','200']]);
 assert.equal(rows[0].ts,1760000000000);assert.equal(rows[0].close,103);
});
test('browser title keeps BTC quote',()=>{
 const doc={title:'BTC'};
 assert.equal(updateBtcTabTitle(82605.4,doc),true);
 assert.equal(doc.title,'BTC 82,605.4');
 assert.equal(updateBtcTabTitle(82605.4,doc),false);
 assert.equal(formatBtcTabTitle(null),'BTC');
});
