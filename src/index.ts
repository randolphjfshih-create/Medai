
import "dotenv/config";
import express from "express";
import { lineWebhookHandler } from "./line/webhook";

const app = express();

// 讓 req.rawBody 可用於簽章驗證（LINE 需要原始位元組）
app.use(express.json({
  verify: (req: any, _res, buf) => { (req as any).rawBody = buf; }
}));

// 健康檢查
app.get("/health", (_req, res) => res.status(200).send("ok"));

// Webhook endpoint
app.post("/line-webhook", lineWebhookHandler);

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`✅ LINE Bot backend running on port ${port}`);
});
