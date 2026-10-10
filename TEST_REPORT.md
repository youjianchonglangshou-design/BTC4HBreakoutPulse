# BTC 4H Breakout Pulse v1.0.1 — 測試與限制

- 執行：`node --test tests/*.test.mjs`：**15／15 項通過**，包含 v6.0 的 131 筆機率公式比對。
- 模擬 `PIONEX:BTCUSDT.P` WebSocket chart 的 4H、15M、1D 三種解析度，載入機率、K 線圖及即時頁籤價格。
- TradingView Scanner 不返回 Pionex 價格時，只允許既有 Worker 的 `BTC_USDT_PERP` 合約備援，不會偷偷切換成 Binance。
- Worker `/api/monitor/klines` 的標的、解析度、已收線時間檢驗；4H 最少 240 根已收線才評估。
- 中軌之上：突破頂齊；中軌之下：跌破底齊，含畫面標題、提示與結算。
- 20:00 凍結仍只使用在 20:00 之前已收線的完整 48 根 Pionex 15M；00:00 對應 4H 收線驗證。v6.0 131 個已知模型輸入與公式維持一致。
- 不在未取得 Pionex 報價或歷史資料時使用假值替代。

**未實測項目：** 自動化 Chromium 可啟動，但本執行環境阻擋對測試網頁 URL 的導覽，因此未宣稱完成真實瀏覽器畫面測試。 目前測試機器無法連線到使用者既有 Worker / TradingView 公開端點，因此不能聲稱線上行情連線已在本機端到端成功；整合測試採模擬 WebSocket 與 HTTP。用戶將檔案覆蓋至 GitHub Pages 後，需要觀察首頁顯示 `PIONEX · TV 圖表` 或 `PIONEX · Worker` 及實際 K 線價位。

**模型校準限制：** v6.0 仍使用歷史 Binance 現貨參數。改用 Pionex 現場 K 線不等於 Pionex 九年歷史重訓，使用機率請留意此域移轉差異。
