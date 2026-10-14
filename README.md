# BTC4HBreakoutPulse v1.3.0

## 新版用途

20:00 **以前**自動預測下一根 BTC PERP 4H 能否有效突破頂齊（中軌上）或跌破底齊（中軌下）。20:00 凍結預測、00:00 以 4H 收線結果驗證。未收線前絕不事後修改預測。

### v7.0 真正用到的因素

1. BTC 4H 頂齊／底齊：近期 50 根、150 根、450 根、再回溯歷史的結構優先選線。
2. 關卡距離（ATR）；頂齊與底齊方向採用**分開擬合的模型**。
3. 日線中軌位置及 HA 相對中軌距離。
4. 日線中軌斜率、上斜／平緩／下降走平中／下斜、斜率變化。
5. 日線平均 K 黃色／紫色。

上述因素已全部用歷史資料訓練為 Logistic 係數，實際應用在瀏覽器 `src/model.js` 的 `calculateRegimeV7()`。每日 20:00 的截面訓練期間 2017–2022，2023 驗證，2024–2026 後段檢查。完整數據與實際績效請看 [RETRAIN_REPORT.md](RETRAIN_REPORT.md)。**目前加入斜率、黃紫的版本驗證績效沒有超越純距離模型；這是實驗版，不宣稱更準。**

### 部署

不用 GitHub Actions 或 Cloudflare 新部署。把覆蓋 ZIP 中的所有檔案（維持路徑）上傳到 **BTC4HBreakoutPulse** 儲存庫 GitHub Pages。新增 `model/regime_v7.json` 是必要檔案。

- 派網 4H／15M／1D K 線、最新價格和頁籤價格維持原本公開 API／Worker 流程。
- 目前 10 秒價格更新、右側價格軸、50 根 4H、Active 呼吸光及懸停功能保留。
- 新版凍結紀錄獨立儲存於瀏覽器，不拿舊 v6 20:00 紀錄冒充 v7。

### 測試

`npm test` / `python tests/regime_v7_browser.py`。

本專案未依賴 Remote Desktop、本機檔案或使用者電腦作為**即時行情資料來源**。研究資料取自九年 Binance 現貨檔案；正式行情仍為 Pionex PERP。
