
import { getSession, setSession } from "./stateStore";
import { callLLM } from "./llmClient";
import { safetyFilter } from "./safetyFilter";
import { SessionData } from "../types/session";

const DISABLE_LLM = (process.env.DISABLE_LLM_FOR_DEBUG || "false").toLowerCase() === "true";

export const dialogueManager = {
  handleUserMessage: async (userId: string, userMessage: string): Promise<string> => {
    const session: SessionData = await getSession(userId);
    let state = session.state || "INTRO";
    let nextQuestion = "";

    switch (state) {
      case "INTRO":
        nextQuestion = "嗨～我是預診小幫手。我會把你現在最不舒服、最想讓醫師知道的重點記下來，醫師看診時會優先看到這些。我不是醫師，不會開藥或做診斷喔！今天你主要哪裡不舒服呢？";
        session.state = "ASK_CHIEF";
        break;
      case "ASK_CHIEF":
        session.chiefComplaint = userMessage;
        nextQuestion = "這個狀況大概是什麼時候開始的？是突然發生，還是慢慢越來越明顯？";
        session.state = "ASK_ONSET";
        break;
      case "ASK_ONSET":
        session.onset = userMessage;
        nextQuestion = "了解～那這種不舒服比較像哪一種？例如：刺痛？悶悶壓著？灼熱？還是別的？";
        session.state = "ASK_QUALITY";
        break;
      case "ASK_QUALITY":
        session.quality = userMessage;
        nextQuestion = "還有一起發生別的狀況嗎？像是發燒、冒冷汗、呼吸很喘、想吐、頭暈，或手腳麻木？";
        session.state = "ASK_ASSOCIATED";
        break;
      case "ASK_ASSOCIATED":
        session.associated = userMessage;
        nextQuestion = "你平常有固定在吃的藥或有慢性病嗎？（我會寫給醫師，醫師可以更快判斷風險）";
        session.state = "ASK_HISTORY";
        break;
      case "ASK_HISTORY":
        session.history = userMessage;
        nextQuestion = "最後想幫你寫進重點：這件事情讓你最擔心的是什麼？我會直接幫你標成優先給醫師看。";
        session.state = "ASK_CONCERN";
        break;
      case "ASK_CONCERN":
        session.concern = userMessage;
        nextQuestion = "謝謝你告訴我，我已經整理好了。等一下醫師看診時，會先看到你剛剛說的重點，會特別注意你最擔心的那一塊。如果此刻有突然變得很喘、快昏倒或劇烈疼痛加劇，請立刻告訴現場人員，這真的很重要。";
        session.state = "END";
        break;
      default:
        nextQuestion = "我已經把你的重點留給醫師了，等等醫師會再跟你詳細確認喔 🙌";
        session.state = "END";
        break;
    }

    await setSession(userId, session);

    if (DISABLE_LLM) {
      return `我在這裡～已收到你的訊息，先測試通道正常 ✅\n${nextQuestion}`;
    }

    const systemInstruction = `
你是「預診小幫手」。任務：以溫和口吻蒐集病人主訴與關鍵資訊，協助醫師節省問診時間。
絕對禁止：
- 提供診斷、疾病名稱、鑑別診斷機率
- 提供治療/用藥/劑量/非處方建議
- 建議延後就醫
允許：
- 行政指引（等候、帶證件）
- 若出現危急徵兆（呼吸惡化、意識改變、劇烈胸痛突發等），提醒立即尋求現場協助或急救（這不是診斷）
語氣：繁體中文、親切、2~3 句內，先簡短共感，再問下一題。
輸出只包含要發給病人的文字，勿加任何標記。
`;

    const userContext = `
病人剛剛說：「${userMessage}」
請先用一小句回應他的感受 (共感/理解)，然後問下一個問題：
「${nextQuestion}」
`;

    const draft = await callLLM(systemInstruction, userContext);
    const safeReply = safetyFilter(draft);
    return safeReply;
  },
};
