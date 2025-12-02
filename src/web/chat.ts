
import { Request, Response } from "express";
import { dialogueManager } from "../core/dialogueManager";

export async function webChatHandler(req: Request, res: Response) {
  const { userId, message } = req.body as { userId?: string; message?: string };
  if (!userId || !message) {
    return res.status(400).json({ error: "Missing userId or message" });
  }

  try {
    const result = await dialogueManager.handleUserMessage(userId, message);
    return res.json({ reply: result.text, state: result.state });
  } catch (err) {
    console.error("❌ webChatHandler error:", err);
    return res.status(500).json({ error: "internal_error" });
  }
}
