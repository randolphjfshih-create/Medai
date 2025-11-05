
import "dotenv/config";
import express from "express";
import { lineWebhookHandler } from "./line/webhook";

const app = express();

app.use(express.json({ verify: (req: any, _res, buf) => { (req as any).rawBody = buf; } }));

app.get("/health", (_req, res) => res.status(200).send("ok"));
app.get("/line-webhook", (_req, res) => res.status(200).send("LINE webhook endpoint is alive (expects POST)."));
app.post("/line-webhook", lineWebhookHandler);

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`✅ LINE Bot backend running on port ${port}`));
