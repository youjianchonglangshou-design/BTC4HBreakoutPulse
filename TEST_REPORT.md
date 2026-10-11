# BTC4HBreakoutPulse v1.2.5 覆核報告

2026-10-11｜修改範圍：**細節浮窗語意膠囊**、**轉折懸停時左側價格軸標籤**。未重新訓練機率模型、未改變 Pionex 取價、20:00 凍結與 00:00 驗證邏輯。

## 需求逐項覆核

| 需求 | 驗證結果 |
|---|---|
| 主畫面日線中軌/斜率/平均K三膠囊，與滑入浮窗顏色同步 | 通過，浮窗值欄皆使用同一套 `state-value[data-tone]` |
| 黃色平均K | 通過，`#FFEB3B` |
| 紫色平均K | 通過，`#B39DDB` |
| 中軌之下紅／中軌之上綠，斜率上斜綠、下斜紅等 | 通過，沿用 v1.2.4 `contextTone` 映射 |
| 頂齊／底齊的浮窗價位 | 通過，頂齊紅／底齊綠 |
| 浮窗內「預測目標」 | 通過，頂齊紅／底齊綠膠囊 |
| 滑到頂齊記號，左軸顯示紅色價位標籤 | 通過，實機 Chromium 移動滑鼠 |
| 滑到底齊記號，左軸顯示綠色價位標籤 | 通過，實機 Chromium 移動滑鼠 |
| 虛線穿過標籤的垂直中心 | 通過，座標逐項核對 `line.y1 === rect.y + rect.height / 2` |
| 懸停時不保留一般滑鼠水平十字虛線和一般滑鼠價位框 | 通過 |
| 左側既有刻度與結構價位重疊時 | 通過，重疊刻度暫隱，離開恢復 |
| 右側 NOW 價格 | 保留，不與左側結構標籤重疊 |
| 離開轉折記號 | 通過，移除結構線與價軸標籤 |
| v1.2.5 版本與快取參數 | 通過 |

## 實際測試

- `node --test tests/*.test.mjs`：**32 / 32 通過**。
- `python tests/pivot_axis_semantics_browser.py`：**通過**。真實 Chromium 紅綠轉折懸停與離開、價軸標籤的幾何對齊、三種日線配色浮窗、頂底齊浮窗、黃紫替換。
- `python tests/tradingview_interaction_browser.py`：**通過**。真實 Chromium K 棒 OHLC、十字游標、頂底齊懸停、NOW 報價重繪、390px 手機版無水平溢出。

以上瀏覽器測試使用合成 K 棒，驗證互動與排版，**不代表已實際連上生產環境 Pionex/Worker**。

請上傳到 `https://github.com/youjianchonglangshou-design/BTC4HBreakoutPulse`，**不可上傳到 SStateMarketTerminal**。
