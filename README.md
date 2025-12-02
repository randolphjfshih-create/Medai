
# AI Medical Assistant LINE Bot v7 (Voice Edition)

功能：
- LINE 預診問診流程（RAPPORT → CC → HPI(OPQRST) → ROS → PMH → MEDS/ALLERGY → FH/SH）
- 醫師端 Dashboard：`/doctor`（Basic Auth）可查看每個使用者的病例摘要、封存紀錄
- Web 病患端假「視訊診間」：`/public/ai-patient.html`
  - 左邊聊天室
  - 右邊 AI 虛擬醫師影片（假視訊）
  - 透過 `/api/web-chat` 調用同一套問診流程
  - ✅ 使用者可按 🎙️ 麥克風用「語音輸入」
  - ✅ AI 回覆可用瀏覽器 TTS 念出來（使用者可用 checkbox 開/關）

## 影片放哪？

請將你準備好的「假視訊」影片檔（例如 MP4）放在

`public/doctor-loop.mp4`

部署後，前端會透過：

`<video src="/public/doctor-loop.mp4" ...>`

來載入。

> 若你想改檔名或改路徑，只要同步修改 `public/ai-patient.html` 裡 `<video>` 的 `src` 即可。

## 語音相關說明

- 語音輸入：使用瀏覽器 Web Speech API（SpeechRecognition），建議用 Chrome / Edge 測試。
- 語音輸出：使用瀏覽器 SpeechSynthesis 將 AI 回覆（已過 safety filter）唸出來。
- 若瀏覽器不支援，按鈕會自動 disabled 或僅顯示文字，不會影響文字問診流程。
