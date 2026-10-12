# BTC4HBreakoutPulse v1.2.11｜右側價軸與標籤優先權

* 原有及更新 Node 自動化測試：`node --test tests/*.test.mjs`，40/40 通過。
* Chromium 右側價軸驗收：`python tests/right_axis_priority_browser.py`，通過。
  - 50 根與相同 K 棒間距；刻度位於右側。
  - 游標價與 NOW 重疊時游標價優先，不重疊則 NOW 保留，游標離開恢復 NOW。
  - 頂齊／底齊原始轉折 hover 時，結構價在右側，水平虛線穿過標籤中心。
  - 結構價格與 NOW 完全同價時結構優先；不同價時各自顯示。
  - 預測關卡水平線 hover 時同樣結構優先。
  - 滑鼠離開時即時清除懸停標籤。
* 合成 Pionex 格式 4H K 棒供離線測試；正式 Pionex Worker 網路連線需部署後確認。
* 本次只改價格軸和顯示優先權，未改選線、模型及凍結。
