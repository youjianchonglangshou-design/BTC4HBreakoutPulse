# BTC 4H Breakout Pulse · v1.0.1（Pionex 行情修正版）

獨立 GitHub Pages 靜態專案，對應 `https://youjianchonglangshou-design.github.io/BTC4HBreakoutPulse/`。

## 本次最重要的修正

**4H K 線、4H 頂齊／底齊、15M 貼線特徵、日線 20 日中軌、平均 K、00:00 結算，全都使用 Pionex `BTC_USDT_PERP`。** 畫面與瀏覽器頁籤 BTC 現價仍然每 10 秒查詢 `PIONEX:BTCUSDT.P`。不使用 Binance 歷史 K 線或即時價充作備援。

- 4H、15M、1D 歷史主通道：沿用原始 [BTCFLOWPulse](https://github.com/youjianchonglangshou-design/BTCFLOWPulse) 的 `TradingView chart WebSocket`（既有 `white-meadow-16bc` Worker 代理，URL `/api/monitor/tv-chart-ws`），其標的為 `PIONEX:BTCUSDT.P`。新的專案不需要另外部署 Worker；**但它確實依賴你已經在使用的既有 Worker**。
- 歷史備援：既有 Worker `/api/monitor/klines?symbol=BTC_USDT_PERP&interval=4H|15M|1D`。如果備援只取得少量歷史，模型可顯示資料不足或找不到有效關卡；**絕不暗換 Binance**。
- 現價主通道：TradingView Scanner；備援：既有 Worker `/api/monitor/tickers?type=PERP`。
- **日線中軌之上** → 研究「**4H 頂齊有效突破機率**」，00:00 收盤須大於已鎖定頂齊×1.0001。
- **日線中軌之下** → 研究「**4H 底齊有效跌破機率**」，00:00 收盤須小於已鎖定底齊×0.9999。標題、提示、歷史紀錄均使用「跌破」，不再用不精確的「突破結構」。
- 價格與瀏覽器頁籤 10 秒更新；K 線歷史約每 2 分鐘更新。20:00 以前推演動態機率，20:00 用完整 Pionex 已收線 15M 重建並鎖定，00:00 用 Pionex 4H 收盤驗證。關閉網頁無背景任務；重新開啟需可讀到當時歷史才能重建。
- 更換行情來源後，另開 v1.0.1 Pionex 凍結儲存區，**不把 v1.0.0 Binance 歷史預測誤當 Pionex 紀錄**。

## 重要研究限制

**v6.0 的概率參數仍是以 Binance 現貨九年歷史訓練，不是 Pionex 合約九年重訓。** 本次修正只確保即時圖、選線與推論所使用的行情一致，沒有憑空宣稱跨市場機率校準已完成。因此目前百分比是研究用機率估計，並非已驗證的 Pionex 合約歷史勝率。中軌斜率、平均 K 黃紫用於確認方向／顯示，尚無經認證的額外百分比加成。

## 更新已存在的 GitHub 儲存庫

把 `OVERWRITE_THESE.txt` 所列的檔案及資料夾按原路徑覆蓋到新儲存庫根目錄。若想一次更新，也可以直接將本 ZIP 內的全部檔案解壓後上傳。GitHub Pages 維持 `main` / `(root)`；無須 GitHub Actions 排程。

## 測試

```bash
npm test
python3 -m http.server 8000
# 瀏覽 http://localhost:8000/
```

新增了 Pionex-only 同源測試、Worker 備援與 TradingView WebSocket 模擬整合測試、方向詞彙測試；v6.0 的 131 個機率公式對照案例保留。詳細見 `TEST_REPORT.md`。
