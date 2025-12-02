
import "dotenv/config";
import express from "express";
import path from "path";
import { lineWebhookHandler } from "./line/webhook";
import { doctorRouter } from "./line/doctor";
import { webChatHandler } from "./web/chat";

const app = express();

// 重要：為 LINE 簽章驗證保留 rawBody
app.use(express.json({
  verify: (req: any, _res, buf) => {
    (req as any).rawBody = buf;
  }
}));

// 靜態檔：public
app.use("/public", express.static(path.join(__dirname, "../public")));

// 健康檢查
app.get("/health", (_req, res) => res.status(200).send("ok"));

// LINE webhook
app.get("/line-webhook", (_req, res) => res.status(200).send("LINE webhook endpoint is alive (expects POST)."));
app.post("/line-webhook", lineWebhookHandler);

// Web 病患端聊天 API
app.post("/api/web-chat", webChatHandler);

// 醫師 Dashboard
app.use("/doctor", doctorRouter);

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`✅ Server on :${port}`));
