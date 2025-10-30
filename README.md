
# AI Medical Assistant LINE Bot (v2)

**更新重點**
- 修正 LINE 簽章驗證使用原始 raw body（避免 Verify OK、訊息卻不回）
- 新增 `/health` 健康檢查路由
- `webhook` 加上 `EVENT/REPLY` 調試 log
- 增加 `DISABLE_LLM_FOR_DEBUG` 環境變數，一鍵跳過 LLM 測通道

## 本地啟動
```bash
npm install
npm run dev
```
另開一個 terminal：
```bash
ngrok http 3000
```
把 `https://xxxx.ngrok-free.app/line-webhook` 填到 LINE Webhook URL → 按 Verify

## 重要環境變數
- `LINE_CHANNEL_ACCESS_TOKEN`
- `LINE_CHANNEL_SECRET`
- `OPENAI_API_KEY`（若 `DISABLE_LLM_FOR_DEBUG=true` 可先不設）
- `REDIS_URL`（沒設會改用記憶體）
- `DISABLE_LLM_FOR_DEBUG`（預設 false）

## 健康檢查
```
GET /health  -> "ok"
```

## 調試建議
- Render/Railway 上看 Logs，應見：`🟢 EVENT` → `📝 REPLY` → `✅ replied`
- 若 `replyToken` 逾時，先把 `DISABLE_LLM_FOR_DEBUG=true` 測通道
