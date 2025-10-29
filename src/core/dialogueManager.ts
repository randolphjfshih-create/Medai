import { getSession, setSession } from "./stateStore";
import { callLLM } from "./llmClient";
import { safetyFilter } from "./safetyFilter";
import { SessionData } from "../types/session";
import { logInfo } from "../utils/logger";

export const dialogueManager = {
  handleUserMessage: async (userId: string, userMessage: string): Promise<string> => {
    // 1. 取 session
    const session: SessionData = await getSession(userId);

    // 2. 判斷目前狀態
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

    // 3. 存 session
    await setSession(userId, session);

    // 4. 用 LLM 幫句子變溫暖＋自然
    const systemInstruction = `
你是「預診小幫手」，職責：
- 安撫病人情緒，讓病人覺得被認真傾聽
- 幫病人把重點整理給醫師
- 不能提供診斷或治療建議
- 不能叫病人延後就醫
- 如果聽起來像是很急(呼吸惡化、意識不清、劇烈疼痛突發)，提醒立即請現場人員或急救，而不是等門診
請使用繁體中文，語氣口語化、兩三句內。
`;

    const userContext = `
病人剛剛說：「${userMessage}」
請你先用一小句回應他的感受 (共感/理解)，然後問下一個問題：
「${nextQuestion}」
`;

    const draft = await callLLM(systemInstruction, userContext);

    // 5. 安全審查 (擋診斷/處方/延後就醫)
    const safeReply = safetyFilter(draft);

    logInfo("session_after", session);
    return safeReply;
  },
};
