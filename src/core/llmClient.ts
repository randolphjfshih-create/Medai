
import OpenAI from "openai";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

export async function callLLM(systemInstruction: string, userContext: string): Promise<string> {
  const maxRetries = 2;
  let lastErr: any;

  for (let i = 0; i <= maxRetries; i++) {
    try {
      const completion = await client.chat.completions.create({
        model: MODEL,
        messages: [
          { role: "system", content: systemInstruction },
          { role: "user", content: userContext }
        ],
        temperature: 0.4,
        max_tokens: 180
      });
      const text = completion.choices[0]?.message?.content?.trim();
      return text || "我收到你的狀況了，我會幫你整理重點給醫師。想先知道今天主要哪裡不舒服呢？";
    } catch (err: any) {
      lastErr = err;
      const code = err?.status || err?.code;
      console.warn(`⚠️ LLM call failed (try ${i+1}/${maxRetries+1}):`, code || err?.message);
      if (![429, 500, 502, 503].includes(code)) break;
      await new Promise(r => setTimeout(r, 300 * (i + 1)));
    }
  }
  console.error("❌ LLM failed after retries:", lastErr?.message || lastErr);
  return "我剛剛有點忙碌，不過我已經記下你說的重點。能再描述一下這個不舒服大概從什麼時候開始嗎？";
}
