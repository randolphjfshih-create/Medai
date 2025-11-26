
import { Request, Response } from "express";
import { dialogueManager } from "../core/dialogueManager";

export async function webChatHandler(req: Request, res: Response) {
  const { userId, message } = req.body || {};
  if (!userId || !message) {
    return res.status(400).json({ error: "Missing userId or message" });
  }
  const result = await dialogueManager.handleUserMessage(String(userId), String(message));
  res.json({ reply: result.text, state: result.state });
}
