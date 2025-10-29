import "dotenv/config";
import express from "express";
import { lineWebhookHandler } from "./line/webhook";

const app = express();

// LINE 會用 JSON POST 打進來
app.use(express.json());

// Webhook endpoint
app.post("/line-webhook", lineWebhookHandler);

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`✅ LINE Bot backend running on port ${port}`);
});
