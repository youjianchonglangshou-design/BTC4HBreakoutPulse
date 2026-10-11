# BTC4HBreakoutPulse v1.2.6｜目前有效頂底齊呼吸光測試

日期：2026-10-11

## 新版互動要求

1. 依實際 `selectFirstBarrier` 選到的目前頂齊（紅）、底齊（綠），**同時**對應到圖表原始轉折 K，才啟用呼吸光。
2. 歷史其餘轉折標記保持靜態；每種結構最多一個點亮。
3. 不使用「價格接近」作為匹配條件；確認 `id / kind / formed / level`，避免亮到同價位的舊線。
4. 關卡不在最近 48 根可見 K 時，不亮錯誤的歷史點；下方已選到的關卡卡片仍維持柔和邊框微光。
5. 呼吸圈設 `pointer-events:none`，不遮擋原始 hover。懸停轉折的價軸標籤、虛線延伸、NOW 價標全部保留。
6. 切換關卡時舊點淡出、新點淡入；圖表每 10 秒更新報價不會改變哪個歷史標記有效。
7. 20:00 後保留原有凍結的關卡與機率，不用 20:00 後價格再選一次當次預測關卡。

## 自動化測試

- `node --test tests/*.test.mjs` ： **35／35 通過**。
- 新增 `tests/active_pivots.test.mjs`：匹配識別、只亮現行頂／底、歷史不亮、缺失不亂亮、關卡切換、10 秒重繪。
- `python tests/active_pivots_browser.py`：Chromium 實際 SVG/DOM 與 CSS 呼吸透明度變化、紅綠卡片、游標優先權、左價軸標籤、NOW 保留、切換淡出及 quote 重繪 **全數通過**。
- 已產生 `PREVIEW_v1.2.6_ACTIVE.png`、`PREVIEW_v1.2.6_HOVER.png`（合成行情，僅作 UI 測試）。

## 未動項目與限制

- 使用原本 Pionex 4H／15M／日線和即時報價；未修改資料介面。
- 20:00 凍結、00:00 驗證和 v6.0 機率模型權重不變。
- 本次 Chromium 測試使用合成 K 線；正式 GitHub Pages 與線上 Worker 的取價狀態需部署後核對。
