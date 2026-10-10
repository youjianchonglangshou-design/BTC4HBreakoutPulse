# BTC4HBreakoutPulse v1.2.1 — 交易語意配色

GitHub Pages 純前端：Pionex BTC 永續 4H 結構機率預測。

## v1.2.1 修改

- **頂齊＝壓力紅**：紅點、左側強調邊線、圖上水平虛線與滑鼠浮動標籤，使用相同紅色。 **底齊＝支撐綠**：上述元素使用綠色。
- **三組日線膠囊**：中軌位置、中軌斜率、平均 K，各用獨立圓角膠囊。滑鼠移入整個中軌資訊區時，原有詳細面板仍會出現。
- **日線平均 K 固定色碼**：黃色 `#FFEB3B`、紫色 `#B39DDB`，包含顯示文字與配套的深色底。
- **日線中軌位置**：之上用綠色，之下用紅色。
- **中軌斜率參照 SStateMarketTerminal** `monitor-engine.js`：以近 5 日、前 5 日布林中軌的線性回歸斜率比較，分類為上斜（綠）、平緩（灰藍）、下降走平中（橘）、下斜（紅）。不是單純依當下斜率正負分組。
- **機率文字色彩**（不改動機率數值）：中軌之上預測突破頂齊，>50% 綠、<50% 橘；中軌之下預測跌破底齊，>50% 紅、<50% 橘；剛好 50% 灰；沒有有效機率時為中性色。數字旁的「偏弱／偏強」文字照原邏輯保留。
- **顯示版本** `v1.2.1`，並更新瀏覽器快取參數。

## 保留的既有功能

- Pionex 4H/15M/日線取數、TradingView Worker／Pionex 備援。
- 每 10 秒更新 Pionex 報價與瀏覽器頁籤價格。
- 20:00 凍結關卡和機率、00:00 驗證；凍結後行情繼續更新。
- 4H 頂底齊水平線滑鼠移入時顯示跟隨游標的圖內浮動標籤；NOW 價格始終在右側。
- 大圖與單頁緊湊排版、詳細資料 hover／點擊顯示。
- v6.0 模型**係數及機率公式不變**。模型原以 Binance 現貨歷史訓練，改用 Pionex 行情後尚未獨立重新校準。

## 部署

下載 `BTC4HBreakoutPulse_v1.2.1_SEMANTIC_OVERWRITE.zip`，解壓後**保留原檔案路徑**覆蓋 GitHub `BTC4HBreakoutPulse` 儲存庫 `main` 根目錄。GitHub Pages 仍使用 `main` / root；不需要 GitHub Actions 或其他新排程。

## 本機測試

```bash
node --test tests/*.test.mjs
python tests/compact_layout_browser.py
python tests/color_visual_browser.py
```

需 Python Playwright 與 Chromium。瀏覽器測試使用**模擬行情**，不代表已驗證部署後的 Worker 線上連線。
