
import { Request } from "express";
import * as crypto from "crypto";
export function validateLineSignature(req: Request & { rawBody?: Buffer }): boolean {
  const channelSecret = process.env.LINE_CHANNEL_SECRET;
  if (!channelSecret) { console.warn("⚠️ LINE_CHANNEL_SECRET not set, skipping signature validation (dev mode)"); return true; }
  const signature = req.headers["x-line-signature"];
  if (!signature || typeof signature !== "string") return false;
  const body = req.rawBody ?? Buffer.from(JSON.stringify(req.body));
  const hmac = crypto.createHmac("sha256", channelSecret).update(body).digest("base64");
  return hmac === signature;
}
