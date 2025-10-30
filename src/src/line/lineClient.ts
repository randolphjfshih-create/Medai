
import axios from "axios";

const CHANNEL_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN || "";

export async function replyToLine(replyToken: string, text: string) {
  if (!CHANNEL_ACCESS_TOKEN) {
    console.error("❌ Missing LINE_CHANNEL_ACCESS_TOKEN");
    return;
  }

  await axios.post(
    "https://api.line.me/v2/bot/message/reply",
    {
      replyToken,
      messages: [{ type: "text", text }],
    },
    {
      headers: {
        Authorization: `Bearer ${CHANNEL_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
    }
  );
}
