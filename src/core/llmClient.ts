import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function callLLM(systemInstruction: string, userContext: string): Promise<string> {
  const completion = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: systemInstruction },
      { role: "user", content: userContext },
    ],
    temperature: 0.4,
  });

  const text = completion.choices[0]?.message?.content;
  return text || "我有收到你的狀況，我會幫你整理給醫師。可以再跟我說，你主要是哪裡不舒服呢？";
}
