
import axios from "axios";
const TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN || "";

export async function replyToLine(replyToken: string, text: string) {
  if (!TOKEN) { console.error("❌ Missing LINE_CHANNEL_ACCESS_TOKEN"); return; }
  try {
    const resp = await axios.post(
      "https://api.line.me/v2/bot/message/reply",
      { replyToken, messages: [{ type: "text", text }] },
      { headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" }, timeout: 7000 }
    );
    console.log("✅ LINE reply API ok:", resp.status, resp.statusText);
  } catch (err: any) {
    if (err.response) console.error("❌ LINE reply API error:", err.response.status, err.response.data);
    else console.error("❌ LINE reply API error:", err.message);
  }
}
