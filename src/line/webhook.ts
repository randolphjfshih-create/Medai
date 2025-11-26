
import { Request, Response } from "express";
import { dialogueManager, nextQuickReplies } from "../core/dialogueManager";
import { replyToLine, pushToLine } from "./lineClient";
import { validateLineSignature } from "./verifySignature";
import { setSession } from "../core/stateStore";

export const lineWebhookHandler = async (req: Request & { rawBody?: Buffer }, res: Response) => {
  try {
    const isValid = validateLineSignature(req);
    if (!isValid) {
      console.warn("❌ Invalid LINE signature");
      return res.status(403).send("forbidden");
    }

    const events = (req.body as any).events || [];
    for (const event of events) {
      if (event.type === "message" && event.message.type === "text") {
        const userId = event.source.userId!;
        const userMessage = event.message.text.trim();

        if (["reset", "重新開始", "重置"].includes(userMessage.toLowerCase())) {
          await setSession(userId, {} as any);
          await replyToLine(event.replyToken, "已重新開始，先跟你打個招呼～今天我會把你提供的重點整理給醫師，可以嗎？");
          continue;
        }

        console.log("🟢 EVENT:", JSON.stringify({ userId, userMessage }));
        await replyToLine(event.replyToken, "收到，我正在幫你整理重點，馬上再跟你確認幾個小問題～");

        setImmediate(async () => {
          const result = await dialogueManager.handleUserMessage(userId, userMessage);
          const quick = nextQuickReplies(result.state);
          console.log("📝 REPLY:", result.text, "➡ quick:", quick);
          await pushToLine(userId, result.text, quick);
        });
      }
    }
    res.status(200).send("OK");
  } catch (err) {
    console.error("❌ Webhook error:", err);
    res.status(500).send("error");
  }
};
