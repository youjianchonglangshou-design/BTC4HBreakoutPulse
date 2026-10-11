# BTC4HBreakoutPulse v1.2.7｜Active 呼吸光微調測試報告

## 變更範圍

1. 頂齊與底齊有效轉折點的外圍光暈最大半徑 17→15、描邊環最大半徑 14→12。
2. 活動光暈專用模糊濾鏡 5→4.2；動畫週期 1.8→2.1 秒（頂底齊兩者一致）。
3. 同步略為縮小下方 Active 卡片陰影範圍，呼吸週期 2.0→2.3 秒。
4. NOW 現價光點、歷史靜態標記、hover 顯示、Active 關卡切換、20:00 凍結及 v6.0 模型維持原邏輯。

## 執行測試

- `npm test`（`node --test tests/*.test.mjs`）：**36/36 通過**。
- `python tests/active_pivots_browser.py`：Chromium 真實渲染並取樣 `SVGAnimatedLength.animVal` 半徑，證實呼吸光 max ≤ 15、細環 max ≤ 12，且有可見幅度變化；驗證 2.1s SVG、2.3s 卡片、NOW 獨立 1.8s、滑鼠 hover、Active 切換、10 秒報價重繪均正常。
- 影片僅作為原版呼吸範圍/速度參考；瀏覽器測試採合成 K 線，不代表線上 Pionex Worker 已經驗證。

## 上線

請將 `BTC4HBreakoutPulse_v1.2.7_PULSE_TUNING_OVERWRITE.zip` 解壓後保留路徑，覆蓋 **BTC4HBreakoutPulse** 儲存庫 `main` 分支。
