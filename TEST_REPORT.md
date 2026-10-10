# BTC4HBreakoutPulse v1.1.0 測試報告

## 本版變動
- 4H 全寬 SVG 大圖，40 根已完成／形成中 Pionex 4H K 線。
- NOW 圖內價格標籤、青色 10 秒價格虛線、呼吸光球。
- 4H 頂齊／底齊橙／粉色獨立水平虛線；機率大字圖下呈現，其餘資料集中下方。
- 上方重複現價完全移除；分頁標題 `BTC 86,223.4` 仍保持更新。
- 若 20:00 後凍結，仍繪製最新 K 線與最新 NOW 現價，但預測目標維持凍結值。

## 實際測試
1. `npm test`：17/17 通過（原本 15 項 + 大圖 2 項）。
2. v6.0 模型既有 131 組機率計算與歷史期望一致（包含在第 14 項模型測試）。
3. 原 Pionex TradingView 圖表 WebSocket 模擬整合測試通過；15M／1D、即時報價與不混用 Binance 行情測試通過。
4. 新圖表測試通過：獨立 4H LIVE bar 僅供展示、NOW 價格標籤、8 7 青色虛線、目標水平虛線、發光 SVG 動畫；每秒渲染無資料變化時不重新啟動動畫。
5. Playwright Chromium 在**無網路靜態測試頁**載入真實 CSS、真正 SVG 圖表程式及模擬 Pionex 歷史與即時價格成功；桌面／手機佈局截圖可生成、手機無水平溢出。
6. 壓縮包以 zipfile.testzip 與必要路徑檢驗。

## 未驗證範圍
- 此環境中的 Chromium 禁止訪問 localhost (`ERR_BLOCKED_BY_ADMINISTRATOR`)，因此沒有宣稱**真實網站** Chrome 全端到端連線成功。提供了節點整合測試與離線瀏覽器視覺測試。
- 舊 Worker 到 TradingView / Pionex 真正公開行情的連線，在部署到 GitHub Pages 後仍需現場確認。
- v6.0 原權重來自 Binance 現貨歷史；使用 Pionex 報價未重新訓練／重新校準。
