# BTC4HBreakoutPulse v1.2.4｜轉折線延伸與焦點價格測試

## 需求覆核與程式改動

| 需求 | 實際處理 |
|---|---|
| 頂齊紅色轉折懸停 | 從左側價格軸 `x=61` 延伸到右側 `x=1070` 的紅色虛線 |
| 底齊綠色轉折懸停 | 同樣左側起始，綠色虛線 |
| 不再出現一般游標價格框 | 轉折懸停時隱藏左側游標價格 `rect` 與 `text` |
| 避免雙重水平線 | 轉折懸停時隱藏普通水平十字游標 |
| 聚焦轉折價位 | 圖內只顯示對應頂齊／底齊專屬價格提示（NOW 現價維持顯示） |
| 游標離開 | 轉折線／專屬標籤消失，普通價格游標恢復 |
| 10 秒價格變更 | 報價重繪時保留轉折聚焦並維持隱藏普通價格框 |
| 不變功能 | Pionex 4H、10 秒頁籤價格、20:00 凍結、00:00 驗證、v6.0 機率 |

## 已執行測試

- `node --test tests/*.test.mjs`：**30／30 通過**。改寫原本錯誤要求「從轉折 K 才開始畫線」的測試，明確驗證左軸起始及普通價格框顯示／隱藏。
- `python tests/tradingview_interaction_browser.py`：**通過**。Chromium 真實滑鼠移動驗證紅／綠轉折：左軸水平延伸、原左側價位框消失、專屬價位框存在、離開恢復、重新報價後仍有效。
- `python tests/turn_markers_browser.py`：**通過**。第三根才完成確認時，標記仍在第一根反轉 K，未確認標記不會提前出現。
- 瀏覽器 390px 寬度：無水平捲軸。
- ZIP 內確認 `src/chart.js` 對應上述修正；ZIP 完整性檢查通過。

瀏覽器測試使用合成 K 線，未對目前正式 GitHub Pages 的即時 Worker 連線進行實際驗證。

## 截圖

- `BTC4HBreakoutPulse_v1.2.4_TOP_TURN_HOVER.png`：頂齊紅線從左軸開始，普通游標價格框已消失。
- `BTC4HBreakoutPulse_v1.2.4_FLOOR_TURN_HOVER.png`：底齊綠線從左軸開始，普通游標價格框已消失。

正確上傳儲存庫：`https://github.com/youjianchonglangshou-design/BTC4HBreakoutPulse`。
