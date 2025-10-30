
import { Request, Response } from "express";
import { dialogueManager } from "../core/dialogueManager";
import { replyToLine } from "./lineClient";
import { validateLineSignature } from "./verifySignature";

export const lineWebhookHandler = async (req: Request & { rawBody?: Buffer }, res: Response) => {
  try {
    // 確認來源是 LINE
    const isValid = validateLineSignature(req);
    if (!isValid) {
      console.warn("❌ Invalid LINE signature");
      return res.status(403).send("forbidden");
    }

    const events = (req.body as any).events;
    if (!Array.isArray(events)) {
      return res.status(200).send("no events");
    }

    for (const event of events) {
      if (event.type === "message" && event.message.type === "text") {
        const userId = event.source.userId;
        const userMessage = event.message.text;

        if (!userId) continue;

        console.log("🟢 EVENT:", JSON.stringify({ userId, userMessage }));

        const replyText = await dialogueManager.handleUserMessage(userId, userMessage);
        console.log("📝 REPLY:", replyText);

        await replyToLine(event.replyToken, replyText);
        console.log("✅ replied");
      }
    }

    res.status(200).send("OK");
  } catch (err) {
    console.error("❌ Webhook error:", err);
    res.status(500).send("error");
  }
};
