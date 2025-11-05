
import { Request, Response } from "express";
import { dialogueManager } from "../core/dialogueManager";
import { replyToLine } from "./lineClient";
import { validateLineSignature } from "./verifySignature";
import { pushToLine } from "./pushClient";
import { setSession } from "../core/stateStore";

export const lineWebhookHandler = async (req: Request & { rawBody?: Buffer }, res: Response) => {
  try {
    const isValid = validateLineSignature(req);
    if (!isValid) { console.warn("❌ Invalid LINE signature"); return res.status(403).send("forbidden"); }

    const events = (req.body as any).events || [];
    for (const event of events) {
      if (event.type === "message" && event.message.type === "text") {
        const userId = event.source.userId!;
        const userMessage = event.message.text.trim();

        if (["reset", "重新開始", "重置"].includes(userMessage.toLowerCase())) {
          await setSession(userId, {} as any);
          await replyToLine(event.replyToken, "已重新開始，請問你今天主要哪裡不舒服呢？");
          continue;
        }

        console.log("🟢 EVENT:", JSON.stringify({ userId, userMessage }));

        await replyToLine(event.replyToken, "收到，我正在幫你整理重點，馬上再跟你確認幾個小問題～");

        setImmediate(async () => {
          const replyText = await dialogueManager.handleUserMessage(userId, userMessage);
          console.log("📝 REPLY:", replyText);
          await pushToLine(userId, replyText);
        });
      }
    }
    res.status(200).send("OK");
  } catch (err) {
    console.error("❌ Webhook error:", err);
    res.status(500).send("error");
  }
};
