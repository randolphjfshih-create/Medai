
import "dotenv/config";
import express from "express";
import path from "path";
import { lineWebhookHandler } from "./line/webhook";
import { doctorRouter } from "./line/doctor";
import { webChatHandler } from "./web/chat";

const app = express();

app.use(express.json({
  verify: (req: any, _res, buf) => {
    (req as any).rawBody = buf;
  }
}));

app.use("/public", express.static(path.join(__dirname, "../public")));
app.get("/health", (_req, res) => res.status(200).send("ok"));
app.get("/line-webhook", (_req, res) => res.status(200).send("LINE webhook endpoint is alive (expects POST)."));
app.post("/line-webhook", lineWebhookHandler);
app.post("/api/web-chat", webChatHandler);
app.use("/doctor", doctorRouter);

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`✅ Server on :${port}`));
