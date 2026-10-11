# BTC4HBreakoutPulse v1.2.9｜動態分頁籤報價＋機率

## 需求與已驗證行為

- 使用與首頁 `NOW` 相同的 Pionex BTC_USDT_PERP 報價，與首頁大字機率相同的 v6.0 預測結果，不另行抓取或運算一組機率。
- 中軌之下：`BTC 83,032.9｜7.4% 跌破`。
- 中軌之上：`BTC 87,052.1｜54.2% 突破`。
- Pionex 報價每 10 秒取得，分頁籤跟著最新報價同步更新；20:00 前機率隨模型動態更新。
- 20:00 後讀取已凍結的原始預測，分頁籤機率固定，但價格每 10 秒仍更新。
- 預測缺資料、無有效 4H 關卡、無法有效產生機率時，只顯示 `BTC 價格`，不能顯示舊機率或虛構機率。
- 不改 K 線來源、模型權重、Active 呼吸動畫或圖表排版。

## 執行測試

1. `node --test tests/*.test.mjs`：40／40 通過。包含既有 Pionex API / 歷史 K 線 / 20:00 凍結 / 131 組 v6.0 對照與新增的分頁籤測試。
2. `python tests/tab_title_browser.py`：Chromium 真實 `document.title` 測試通過；模擬漲跌方向、價格更新、凍結不改機率、無訊號退回只顯示價格。
3. `python tests/active_pivots_browser.py`：Chromium 圖表舊功能回歸測試通過（Active 紅綠呼吸、懸停、切換 active、報價重繪、NOW）。

## 局限

Chromium 分頁籤測試使用模擬輸入；Pionex 網路取數使用既有程式路徑，不代表已在使用者的線上 GitHub Pages 以真實 API 完成現場驗證。原有 v6.0 Binance 現貨訓練與 Pionex 永續報價的校準限制維持不變。
