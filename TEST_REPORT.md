# BTC4HBreakoutPulse v1.2.3 — TradingView 游標及歷史轉折水平線｜測試報告

## 修改目標與已完成內容

1. K 棒移入滑鼠時，**圖表頂端 OHLC 固定資訊列**顯示該根 K 的台灣日期時間、開高低收、漲跌幅及成交量。游標離開圖表時恢復顯示最新 K 的數據，移除原先在 K 棒旁出現的瀏覽器原生 `<title>` 白色提示框。
2. 圖表中顯示 **TradingView 風格十字虛線**：垂直時間線、水平價位線、左側游標價格標籤及下方 K 棒日期時間標籤。游標離開後全部消失。
3. **所有可見的已確認轉折記號**（紅頂齊／綠底齊）各自都有加大但透明的互動命中區。滑鼠移到記號時，從該記號所對應的**第一根反向轉折 K** 水平延伸到右側，暫時顯示同規格價格標籤。滑鼠離開時整組移除；不會讓未選中的歷史線常駐。
4. 即時 `NOW` Pionex 價格線、原本選出的預測關卡線、10 秒報價更新、20:00 凍結、00:00 驗證、v6.0 訓練權重均維持。
5. 清除 10 秒 SVG 重繪前的舊根節點事件監聽器，避免長時間開啟後堆疊多次十字線與 OHLC 更新。

## 實際執行

- `node --test tests/*.test.mjs`：**30/30 通過**。其中新增「頂端 OHLC 格式／TPE 時間／成交量」與「轉折標記懸停延伸線建立、刪除」單元測試。
- `python tests/turn_markers_browser.py`：**通過**。Chromium 實際渲染，頂齊、底齊皆標示原始轉折 K，不會畫在後續第三根確認 K；尚未確認的事件不提前出現。
- `python tests/tradingview_interaction_browser.py`：**通過**。Chromium 實際滑鼠移動，檢查 OHLC 頂端更新、交叉虛線及雙軸標籤、紅頂齊與綠底齊懸停延伸／離開消失、NOW 仍然存在、10 秒重繪、390px 手機無水平溢出。
- ZIP 完整性：`zipfile.testzip()`；且核對覆蓋 ZIP 內新版 `src/chart.js` 具有新增行為程式碼。

實機檢查的歷史 K 棒為**合成測試資料**。不代表已與使用者線上 TradingView 所見每一個真實頂齊、底齊逐點核對；Pionex 公開行情通道亦未在這些離線模擬測試中連線驗證。

## 交付截圖（離線模擬數據）

- `BTC4HBreakoutPulse_v1.2.3_OHLC_CROSSHAIR.png`
- `BTC4HBreakoutPulse_v1.2.3_TOP_TURN_HOVER.png`
- `BTC4HBreakoutPulse_v1.2.3_FLOOR_TURN_HOVER.png`
- `BTC4HBreakoutPulse_v1.2.3_MOBILE.png`

部署儲存庫：`https://github.com/youjianchonglangshou-design/BTC4HBreakoutPulse`，**勿誤上傳到 SStateMarketTerminal**。
