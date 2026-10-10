# BTC4HBreakoutPulse v1.1.3 回歸測試報告

## 真正修正的問題

v1.1.2 的 `src/chart.js` 仍在每次重新繪圖時直接建立底齊／頂齊標籤；過去的 `tests/chart.test.mjs` 更誤把標籤「常駐」當成預期行為。該版本的「17／17 通過」**不能**作為 Hover 需求已完成的證據。

v1.1.3 將頂齊／底齊右側標籤改為：**預設不存在；指標移進虛線 18px 感應區才建立；離開立即刪除**。支援 `focus`／`blur` 鍵盤互動。持續顯示的 NOW 即時報價標籤不受影響。

## 測試執行與結果

1. `node --test tests/*.test.mjs`：**17／17 通過**。新版圖表測試有明確驗證初始不顯示、hover 顯示、leave 隱藏、focus 顯示、blur 隱藏、重繪後不再顯示，以及 NOW 報價維持。
2. `python tests/barrier_hover_browser.py`：**Chromium 實際滑鼠互動通過**。底齊、頂齊兩種情況均證實「初始隱藏 → 滑鼠移至水平線顯示 → 滑鼠移開隱藏」，NOW 常駐。
3. `unzip -t`：覆蓋版、完整專案版 ZIP 檔完整性通過；確認壓縮檔中的 `src/chart.js` 不含舊版直接畫出常駐標籤的程式。

瀏覽器測試在完全離線的 Chromium DOM 與合成 K 線上執行，**驗證的是 UI 互動**，並非宣稱已測通線上 GitHub Pages／Pionex API。Pionex 資料介面、20:00 凍結邏輯、v6 模型公式沒有修改。
