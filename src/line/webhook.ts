import { Request, Response } from "express";
import { dialogueManager } from "../core/dialogueManager";
import { replyToLine } from "./lineClient";
import { validateLineSignature } from "./verifySignature";

export const lineWebhookHandler = async (req: Request, res: Response) => {
  try {
    // 基本安全檢查：確認來源真的是 LINE
    const isValid = validateLineSignature(req);
    if (!isValid) {
      console.warn("❌ Invalid LINE signature");
      return res.status(403).send("forbidden");
    }

    const events = req.body.events;
    if (!Array.isArray(events)) {
      return res.status(200).send("no events");
    }

    for (const event of events) {
      if (event.type === "message" && event.message.type === "text") {
        const userId = event.source.userId;
        const userMessage = event.message.text;

        if (!userId) continue;

        const replyText = await dialogueManager.handleUserMessage(userId, userMessage);

        await replyToLine(event.replyToken, replyText);
      }
    }

    res.status(200).send("OK");
  } catch (err) {
    console.error("❌ Webhook error:", err);
    res.status(500).send("error");
  }
};

if (event.type === "message" && event.message.type === "text") {
  console.log("🟢 EVENT:", JSON.stringify(event)); // 看得到 userId / message
  const replyText = await dialogueManager.handleUserMessage(userId, userMessage);
  console.log("📝 REPLY:", replyText); // 看即將回什麼
  await replyToLine(event.replyToken, replyText);
  console.log("✅ replied");
}