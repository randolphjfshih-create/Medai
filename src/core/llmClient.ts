import OpenAI from "openai";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

export async function callLLM(systemInstruction: string, userContext: string): Promise<string> {
  const maxRetries = 2;
  let lastErr: any;

  for (let i = 0; i <= maxRetries; i++) {
    try {
      // Node 18+ 內建 AbortController
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 6500); // 6.5s 逾時保護

      const completion = await client.chat.completions.create(
        {
          model: MODEL,
          messages: [
            { role: "system", content: systemInstruction },
            { role: "user", content: userContext },
          ],
          temperature: 0.4,
          max_tokens: 180,
        },
        {
          // ✅ 正確放在第二個參數
          signal: controller.signal,
          // 也可選擇性加上 timeout（SDK 會當作 fetch timeout）
          // timeout: 7000,
        }
      );

      clearTimeout(timer);
      const text = completion.choices[0]?.message?.content?.trim();
      return text || "我收到你的狀況了，我會幫你整理重點給醫師。想先知道今天主要哪裡不舒服呢？";
    } catch (err: any) {
      lastErr = err;
      const code = err?.status || err?.code;
      console.warn(`⚠️ LLM call failed (try ${i+1}/${maxRetries+1}):`, code || err?.message);
      // 只對 429/5xx/逾時 重試
      if (![429, 500, 502, 503, "ECONNABORTED", "AbortError"].includes(code)) break;
      await new Promise(r => setTimeout(r, 300 * (i + 1)));
    }
  }

  console.error("❌ LLM failed after retries:", lastErr?.message || lastErr);
  return "我剛剛有點忙碌，不過我已經記下你說的重點。能再描述一下這個不舒服大概從什麼時候開始嗎？";
}
