# BTC4HBreakoutPulse v1.2.12｜NOW 常駐、游標/結構疊蓋實測

## 修改範圍

僅改圖表右側價格軸的標籤圖層：NOW 在任何情況下都保持 `visibility=visible`，游標價格、頂齊/底齊和預測目標價格標籤按 SVG 繪製順序顯示在 NOW 上方；不再因數值靠近而隱藏 NOW。

## 測試

- `npm test`：41/41 通過。
- `python tests/right_axis_priority_browser.py`：Chromium 真實滑鼠測試，通過。
- 檢查游標與 NOW 同價、頂齊/底齊與 NOW 同價、預測關卡與 NOW 同價、兩者分離時、滑鼠離開及即時報價重新繪製。
- 驗證 NOW 群組始終 visible；相同位置的游標/轉折/預測關卡標籤以後繪製的 SVG 元素顯示在上層。
- 未實測正式 GitHub Pages/Worker 線上連線。
