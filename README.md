# AI Medical Assistant LINE Bot

病患預問診 AI 助手 (LINE Bot 版)  
- 幫助病患在看診前先描述主要不適、時間線、嚴重度、伴隨症狀、慢性病/用藥、最擔心的點  
- 幫醫師節省前 1~2 分鐘蒐集主訴  
- 禁止 AI 對病人下診斷/開藥/叫病人延後就醫

## 功能流程 (高層)
1. LINE 使用者傳訊息
2. 後端記錄他們目前問診流程 state
3. LLM 生成人性化回覆 (口吻安撫 + 問下一題)
4. safetyFilter 擋住違規醫療建議
5. 回傳訊息給 LINE

## 專案架構
- `src/index.ts`: 啟動 Express server，並註冊 `/line-webhook`
- `src/line/webhook.ts`: 接收 LINE webhook，轉給 dialogueManager
- `src/line/lineClient.ts`: 回覆訊息給 LINE
- `src/core/dialogueManager.ts`: 問診狀態機 (主訴 / 起始時間 / 症狀性質 / 伴隨症狀 / 既往史 / 最擔心的事)
- `src/core/llmClient.ts`: 呼叫 LLM，產生溫和語氣
- `src/core/safetyFilter.ts`: 禁止診斷、禁止處方、禁止延後就醫
- `src/core/stateStore.ts`: 用 Redis 記使用者 session
- `src/types/session.ts`: session 的資料格式
- `src/utils/logger.ts`: 簡單 log

## 環境變數
請複製 `.env.example` 成 `.env`，並填入：
- LINE_CHANNEL_ACCESS_TOKEN
- LINE_CHANNEL_SECRET
- OPENAI_API_KEY
- REDIS_URL
- PORT

## 本地啟動
```bash
npm install
npm run dev
```

你需要一個可被 LINE 呼叫的 public HTTPS webhook。
本地可以用 ngrok:
```bash
ngrok http 3000
```
把 ngrok 產生的 URL 設成 LINE Developers 裡的 webhook URL：
`https://xxxxx.ngrok-free.app/line-webhook`

## 安全注意
這個 bot:
- 不會提供診斷
- 不會建議吃藥或用藥
- 不會叫病人「明天再看就好」
- 遇到危急症狀 (呼吸困難惡化、意識模糊等) 會提醒立刻尋求現場協助或急救，而不是等門診

## 後續延伸
- 把 `stateStore` 的資料寫進資料庫 (Postgres) 以便產生醫師摘要 (SOAP)
- 新增 `clinicalSummaryService`，自動產生給醫師看的重點(主訴、HPI、紅旗)
- 新增醫院後台 / 醫師介面
