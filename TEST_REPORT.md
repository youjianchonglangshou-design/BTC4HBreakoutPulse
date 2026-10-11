# BTC4HBreakoutPulse v1.2.8｜Active 呼吸光第二輪微調

## 修改前後

| 項目 | v1.2.7 | v1.2.8 |
|---|---:|---:|
| Active 圖上光圈半徑 | 9–15 | 8–13 |
| Active 描邊環半徑 | 8–12 | 7–10 |
| 專用光暈模糊 | 4.2 | 3.6 |
| Active SVG 呼吸週期 | 2.1 秒 | 2.4 秒 |
| Active 卡片週期 | 2.3 秒 | 2.6 秒 |
| Active 卡片最大陰影 | 11px | 9px |
| NOW 呼吸週期 | 1.8 秒 | 1.8 秒，不變 |

## 相關測試

- `node --test tests/*.test.mjs`：**36／36 通過**。
- `python tests/active_pivots_browser.py`：**通過**，以 Chromium 真正驗證 Active 頂／底齊動畫半徑、透明度、hover、切換選線、報價重新渲染，且 NOW 保持原值。
- ZIP 檔必須含 `src/chart.js`、`styles.css`、`src/app.js`、`index.html`、`VERSION.json` 及測試，確認版號和動畫參數一致。

測試環境行情為合成 K 線，不等同實際 GitHub Pages / Pionex 連線驗證。
