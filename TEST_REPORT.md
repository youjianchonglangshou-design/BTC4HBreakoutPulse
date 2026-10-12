# v1.2.10｜有效 K 線繪圖區加寬測試紀錄

- 修改 `src/chart.js` 固定座標：W 1200→1410；LEFT 61→58；RIGHT 1061→1270；GUTTER 1070→1279。
- 修改 `styles.css` SVG 原始寬高比與桌面高度限制，避免 `preserveAspectRatio="meet"` 產生左右 letterbox。
- 保留 48 根 K 棒、Pionex 4H 歷史、十字游標、頂底齊轉折懸停、Active 呼吸光、NOW 價格與 20:00 凍結。

## 原有程式測試

`node --test tests/*.test.mjs` → **40/40 通過**。

## Chromium 真實像素量測（相同歷史 Pionex 格式資料）

| 寬度 | 修改前 K 線實際繪製寬度 | 修改後 | 差異 |
|---|---:|---:|---:|
| 1280px | 809.9px | 1050.4px | +29.7% |
| 1440px | 1012.3px | 1187.9px | +17.3% |

`python tests/chart_edge_geometry_browser.py` → 1280×720、1366×768、1440×900、1600×900 通過；390×844 無水平溢出。檢查包含：真實 SVG 的 CTM、圖表左軸位置、NOW 標籤離右界距離、是否存在左右 letterbox、捲軸、48 根 K 棒及虛線懸停元素。

**測試資料是本地 fixture，沒有宣稱已驗證線上 Worker。**
