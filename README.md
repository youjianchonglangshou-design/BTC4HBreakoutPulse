# BTC 4H Breakout Pulse · v1.1.4（Pionex 4H 大圖／價格呼吸光版）

獨立 GitHub Pages 靜態專案，對應 `https://youjianchonglangshou-design.github.io/BTC4HBreakoutPulse/`。

## v1.1.3 大圖排版與 10 秒價格標籤

- 主畫面改為 **Pionex 4H 全寬 K 線圖**（最近最多 40 根），不用小型左側圖。支援即時 4H 形成中 K 線的圖形顯示，**確認結構與機率推論仍只用已收線 K**。
- 延續舊 BTCFLOWPulse `src/ui.js` 視覺設計：**青色價格水平虛線、右側 NOW 價格標籤、會呼吸的發光小圓球**；圖表右側獨立留白給標籤，避免價格資訊壓住 K 線。
- 上方重複的即時價欄位已移除；**瀏覽器分頁 BTC 價格仍維持每 10 秒更新**，圖內價格也跟著更新。
- 預測目標的 4H 頂齊／底齊用另一條暖色虛線表示；價位標籤只在滑鼠移到虛線時顯示。2026/10/10 20:00 凍結後 **目標與百分比保持不變，圖表與 NOW 仍更新**。
- 維持 v6.0 大字機率，下方兩欄濃縮 4H 頂底齊、確認時間、觸碰回合、日線中軌斜率與平均 K 黃紫、機率理由。手機版單欄且避免水平溢出。
- 這是純前端 **排版與即時圖表改版**，**未重訓或改寫 v6.0 模型權重**。

## Pionex 行情與突破語意

**4H K 線、4H 頂齊／底齊、15M 貼線特徵、日線 20 日中軌、平均 K、00:00 結算，全都使用 Pionex `BTC_USDT_PERP`。** 畫面與瀏覽器頁籤 BTC 現價仍然每 10 秒查詢 `PIONEX:BTCUSDT.P`。不使用 Binance 歷史 K 線或即時價充作備援。

- 4H、15M、1D 歷史主通道：沿用原始 [BTCFLOWPulse](https://github.com/youjianchonglangshou-design/BTCFLOWPulse) 的 `TradingView chart WebSocket`（既有 `white-meadow-16bc` Worker 代理，URL `/api/monitor/tv-chart-ws`），其標的為 `PIONEX:BTCUSDT.P`。新的專案不需要另外部署 Worker；**但它確實依賴你已經在使用的既有 Worker**。
- 歷史備援：既有 Worker `/api/monitor/klines?symbol=BTC_USDT_PERP&interval=4H|15M|1D`。如果備援只取得少量歷史，模型可顯示資料不足或找不到有效關卡；**絕不暗換 Binance**。
- 現價主通道：TradingView Scanner；備援：既有 Worker `/api/monitor/tickers?type=PERP`。
- **日線中軌之上** → 研究「**4H 頂齊有效突破機率**」，00:00 收盤須大於已鎖定頂齊×1.0001。
- **日線中軌之下** → 研究「**4H 底齊有效跌破機率**」，00:00 收盤須小於已鎖定底齊×0.9999。標題、提示、歷史紀錄均使用「跌破」，不再用不精確的「突破結構」。
- 價格與瀏覽器頁籤 10 秒更新；K 線歷史約每 2 分鐘更新。20:00 以前推演動態機率，20:00 用完整 Pionex 已收線 15M 重建並鎖定，00:00 用 Pionex 4H 收盤驗證。鎖定後不修改概率，但圖表與價格仍保持更新。關閉網頁無背景任務；重新開啟需可讀到當時歷史才能重建。
- 沿用 v1.0.1 Pionex 凍結儲存區，**不把 v1.0.0 Binance 歷史預測誤當 Pionex 紀錄**。

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

保留 Pionex-only 同源測試、Worker 備援與 TradingView WebSocket 模擬整合測試、方向詞彙測試；v6.0 的 131 個機率公式對照案例保留。詳細見 `TEST_REPORT.md`。

額外新增 `tests/chart.test.mjs` 確認即時價格標籤／虛線／呼吸動畫、已收線與 LIVE K 分離；`tests/visual_smoke.py` 以 Chromium 離線渲染桌面／手機版面（需安裝 Playwright），不測試實際公開 API。


## v1.1.3

- 移除上方品牌與大標題，縮短上方版面
- 預測時段倒數移到派網 10 秒更新膠囊左側
- 倒數與派網更新改為相同規格膠囊
- 派網 4H 已收線根數移到圖表右下角


## v1.1.3 真正修正標籤 Hover

- 修正前版程式碼未被實際更換的錯誤。現在預設**沒有**頂齊／底齊標籤節點。
- 滑鼠進入水平虛線的 18px 感應範圍才建立標籤，移出即移除，亦支援鍵盤焦點。
- NOW 即時價格標籤維持常駐，每 10 秒行情與凍結邏輯不變。
- 瀏覽器改版檔案路徑帶 v1.1.3，避免載入舊版快取。


## v1.1.4 游標跟隨標籤定位修復

- 只有滑鼠滑過水平虛線才建立頂齊／底齊標籤，離開立即刪除。
- 標籤根據滑鼠在 SVG 的真實座標跟隨左右移動；不再固定在右側價籤區。
- 限制標籤在 K 線繪圖區內，避免與右側 `NOW` 即時價格標籤重疊（即使兩個價位完全相同）。
- 10 秒價格更新導致圖重畫時，游標仍在虛線上的標籤保留原位置。
- 專門增加 Node DOM 幾何測試及 Chromium 滑鼠左／中／右跟隨驗證。
