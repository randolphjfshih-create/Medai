
import axios from "axios";

const TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN || "";

type QuickReplies = string[] | undefined;

export async function replyToLine(replyToken: string, text: string, quickReplies?: QuickReplies) {
  if (!TOKEN) { console.error("❌ Missing LINE_CHANNEL_ACCESS_TOKEN"); return; }
  const message: any = { type: "text", text };
  if (quickReplies && quickReplies.length) {
    message.quickReply = {
      items: quickReplies.map((label) => ({
        type: "action",
        action: { type: "message", label, text: label }
      }))
    };
  }
  try {
    const resp = await axios.post(
      "https://api.line.me/v2/bot/message/reply",
      { replyToken, messages: [message] },
      { headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" }, timeout: 7000 }
    );
    console.log("✅ LINE reply API ok:", resp.status, resp.statusText);
  } catch (err: any) {
    if (err.response) console.error("❌ LINE reply API error:", err.response.status, err.response.data);
    else console.error("❌ LINE reply API error:", err.message);
  }
}

export async function pushToLine(userId: string, text: string, quickReplies?: QuickReplies) {
  if (!TOKEN) { console.error("❌ Missing LINE_CHANNEL_ACCESS_TOKEN"); return; }
  const message: any = { type: "text", text };
  if (quickReplies && quickReplies.length) {
    message.quickReply = {
      items: quickReplies.map((label) => ({
        type: "action",
        action: { type: "message", label, text: label }
      }))
    };
  }
  try {
    const resp = await axios.post(
      "https://api.line.me/v2/bot/message/push",
      { to: userId, messages: [message] },
      { headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" }, timeout: 7000 }
    );
    console.log("✅ LINE push API:", resp.status);
  } catch (err: any) {
    if (err.response) console.error("❌ LINE push API error:", err.response.status, err.response.data);
    else console.error("❌ LINE push API error:", err.message);
  }
}
