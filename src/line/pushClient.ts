
import axios from "axios";
const TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN || "";

export async function pushToLine(userId: string, text: string) {
  if (!TOKEN) { console.error("❌ Missing LINE_CHANNEL_ACCESS_TOKEN"); return; }
  try {
    const resp = await axios.post(
      "https://api.line.me/v2/bot/message/push",
      { to: userId, messages: [{ type: "text", text }] },
      { headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" }, timeout: 7000 }
    );
    console.log("✅ LINE push API:", resp.status);
  } catch (err: any) {
    if (err.response) console.error("❌ LINE push API error:", err.response.status, err.response.data);
    else console.error("❌ LINE push API error:", err.message);
  }
}
