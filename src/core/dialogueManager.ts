import { getSession, setSession } from "./stateStore";
import { callLLM } from "./llmClient";
import { safetyFilter } from "./safetyFilter";
import { SessionData, BotState } from "../types/session";

const DISABLE_LLM = (process.env.DISABLE_LLM_FOR_DEBUG || "false").toLowerCase() === "true";

/**
 * LINE quick reply 選項
 */
export function nextQuickReplies(state?: BotState): string[] | undefined {
  switch (state) {
    case "RAPPORT": return ["可以開始", "好的"];
    case "CC": return ["頭痛", "喉嚨痛", "腹痛", "胸悶", "發燒", "其他"];
    case "HPI_ONSET": return ["突然", "逐漸", "不確定"];
    case "HPI_TRIGGER_RELIEF": return ["運動會加重", "休息會緩解", "吃東西會緩解", "不明顯"];
    case "HPI_QUALITY_SITE": return ["刺痛", "悶痛", "灼熱", "壓迫", "說不上來"];
    case "HPI_SEVERITY": return ["0","1","2","3","4","5","6","7","8","9","10"];
    case "HPI_ASSOC": return ["發燒", "胸痛", "呼吸急促", "嘔吐", "腹瀉", "頭暈", "麻木", "無"];
    case "ROS": return ["無明顯", "發燒", "咳嗽", "胸痛", "腹瀉", "血尿", "頭痛", "皮疹"];
    case "PMH": return ["無慢性病", "高血壓", "糖尿病", "心臟病", "氣喘", "其他"];
    case "MEDS_ALLERGY": return ["無用藥", "有慢箋", "保健品", "藥物過敏", "食物過敏", "環境過敏"];
    case "FH_SH": return ["家族心血管", "家族糖尿病", "抽菸", "喝酒", "運動規律", "睡眠差"];
    default: return undefined;
  }
}

/**
 * 檢查回答是否合理
 * - 回覆 "OK" 代表可接受
 * - 回覆 "REASK: xxx" 代表要留在同一題，請再追問一次
 */
async function evaluateAnswer(
  phase: BotState,
  answer: string,
  session: SessionData
): Promise<{ ok: boolean; followup?: string }> {
  if (DISABLE_LLM) return { ok: true };

  const text = (answer || "").trim();

  // 1) 大部分正常回答直接放行，避免一直 REASK
  //   - 長度夠長（>= 6 字）就當作有在認真回答，不再叫 LLM 判斷
  if (text.length >= 6) {
    return { ok: true };
  }

  // 2) 針對發作時間 HPI_ONSET：只要有「數字 + 時間單位」就視為 OK
  if (phase === "HPI_ONSET") {
    const hasTimeWord = /[天日週礼拜禮拜月年小時小时鐘钟分鐘分]/.test(text);
    const hasNumber = /[0-9０-９一二三四五六七八九十幾半]/.test(text);
    if (hasTimeWord && hasNumber) {
      return { ok: true };
    }
  }

  // 3) 針對嚴重程度 HPI_SEVERITY：只要有 0–10 的數字就視為 OK
  if (phase === "HPI_SEVERITY") {
    const m = text.match(/([0-9０-９])/);
    if (m) {
      const n = parseInt(m[1].replace(/[^0-9]/g, ""), 10);
      if (!isNaN(n) && n >= 0 && n <= 10) {
        return { ok: true };
      }
    }
  }

  // 4) 明顯敷衍 or 離題時，才請 LLM 幫忙重新問一次
  //    例如「不知道」「隨便」「哈哈」「呵呵」等
  const obviousBad = /^(不知道|隨便|沒差|不想講|看你|隨意|哈哈+|呵呵+|嗯嗯+|嗚嗚+)$/.test(text);
  if (!obviousBad && text.length > 0) {
    // 雖然很短，但看起來也不像亂打，就放行
    return { ok: true };
  }

  // 5) 真的覺得很敷衍的回答，才丟給 LLM 產生 REASK
  const systemInstruction = `
你是一個「醫療預診小助手」，負責幫忙判斷「病人的回答有沒有回答到問題」。
只做判斷，不做診斷，也不提供任何治療或用藥建議。

規則：
- 如果病人的回答跟目前問診階段 phase 的主題明顯相關，而且有提供一些實際資訊，
  請只輸出：OK
- 如果病人的回答很明顯離題、只有很短的字詞（像「不知道」「隨便」「哈哈」）、
  或是亂輸入（像是一串無意義的字），請輸出：
  REASK: ＋一小句繁體中文，重新用比較好懂的方式問同一題，
  並且可以簡短同理/說明你沒有聽懂。

嚴禁：
- 不可以出現任何疾病名稱、診斷結論。
- 不可以出現「建議你吃 XX 藥」「先不用看醫生」這種句子。
  `;

  const userContext = `
[phase]: ${phase}
[answer]: ${answer}

[目前已知資訊節錄，供你判斷參考]
- CC: ${session.cc || ""}
- HPI:
  - Onset & Course: ${session.hpi?.onset || ""}
  - Triggers/Relief: ${session.hpi?.triggersReliefs || ""}
  - Quality & Site: ${session.hpi?.qualityAndSite || ""}
  - Severity: ${session.hpi?.severity || ""}
  - Associated: ${session.hpi?.associated || ""}
- ROS: ${session.ros || ""}
- PMH: ${session.pmh || ""}
- Meds/Allergy: ${session.medsAllergy || ""}
- FH/SH: ${session.fhSh || ""}
  `;

  const raw = await callLLM(systemInstruction, userContext);
  const out = (raw || "").trim();

  if (out.startsWith("REASK:")) {
    return { ok: false, followup: out.replace(/^REASK:\s*/i, "") };
  }
  return { ok: true };
}

export const dialogueManager = {
  handleUserMessage: async (userId: string, userMessage: string): Promise<{ text: string; state: BotState }> => {
    const s: SessionData = await getSession(userId);
    let state: BotState = s.state || "RAPPORT";

    async function moveTo(nextState: BotState, fallbackQuestion: string) {
      s.state = nextState;
      await setSession(userId, s);
      const question = await buildDynamicQuestion(nextState, s, fallbackQuestion);
      return { text: question, state: nextState };
    }

    switch (state) {
      case "RAPPORT":
        return moveTo(
          "CC",
          "嗨～我是預診小幫手，待會會先簡單了解你的狀況，再把重點整理給醫師。今天主要想處理什麼不舒服呢？"
        );

      case "CC": {
        s.cc = userMessage;
        return moveTo(
          "HPI_ONSET",
          "了解，你主要是不舒服在這個部分。大概是從什麼時候開始的？是突然發生還是慢慢變嚴重？"
        );
      }

      case "HPI_ONSET": {
        const evalResult = await evaluateAnswer("HPI_ONSET", userMessage, s);
        if (!evalResult.ok && evalResult.followup) {
          return { text: evalResult.followup, state: "HPI_ONSET" };
        }
        s.hpi = s.hpi || {};
        s.hpi.onset = userMessage;
        return moveTo(
          "HPI_TRIGGER_RELIEF",
          "這個症狀有沒有什麼情況會特別加重或比較緩解？例如活動、休息、姿勢改變或是吃東西之後？"
        );
      }

      case "HPI_TRIGGER_RELIEF": {
        const evalResult = await evaluateAnswer("HPI_TRIGGER_RELIEF", userMessage, s);
        if (!evalResult.ok && evalResult.followup) {
          return { text: evalResult.followup, state: "HPI_TRIGGER_RELIEF" };
        }
        s.hpi = s.hpi || {};
        s.hpi.triggersReliefs = userMessage;
        return moveTo(
          "HPI_QUALITY_SITE",
          "想再多了解一下這個不舒服的感覺，是刺痛、悶痛、灼熱、壓迫還是說不上來？大概是在身體哪個位置呢？"
        );
      }

      case "HPI_QUALITY_SITE": {
        const evalResult = await evaluateAnswer("HPI_QUALITY_SITE", userMessage, s);
        if (!evalResult.ok && evalResult.followup) {
          return { text: evalResult.followup, state: "HPI_QUALITY_SITE" };
        }
        s.hpi = s.hpi || {};
        s.hpi.qualityAndSite = userMessage;
        return moveTo(
          "HPI_SEVERITY",
          "如果用 0 到 10 分來形容現在這個不舒服，0 分是完全不痛，10 分是最痛，現在大概會給幾分？"
        );
      }

      case "HPI_SEVERITY": {
        const evalResult = await evaluateAnswer("HPI_SEVERITY", userMessage, s);
        if (!evalResult.ok && evalResult.followup) {
          return { text: evalResult.followup, state: "HPI_SEVERITY" };
        }
        s.hpi = s.hpi || {};
        s.hpi.severity = userMessage;
        return moveTo(
          "HPI_ASSOC",
          "在這段期間，有沒有一起出現其他症狀？像是發燒、胸痛、呼吸變喘、噁心嘔吐、腹瀉、頭暈、手腳麻木之類的？如果有，可以幫我說一下。"
        );
      }

      case "HPI_ASSOC": {
        const evalResult = await evaluateAnswer("HPI_ASSOC", userMessage, s);
        if (!evalResult.ok && evalResult.followup) {
          return { text: evalResult.followup, state: "HPI_ASSOC" };
        }
        s.hpi = s.hpi || {};
        s.hpi.associated = userMessage;
        return moveTo(
          "ROS",
          "接下來會做一個簡單的全身檢查（ROS），看有沒有漏掉的地方。最近在體溫、咳嗽、胸悶心悸、腸胃（拉肚子、便祕）、小便、頭痛頭暈、皮膚疹子或搔癢方面，有沒有什麼特別的變化？如果都還好也可以說「沒有特別」。"
        );
      }

      case "ROS": {
        const evalResult = await evaluateAnswer("ROS", userMessage, s);
        if (!evalResult.ok && evalResult.followup) {
          return { text: evalResult.followup, state: "ROS" };
        }
        s.ros = userMessage;
        return moveTo(
          "PMH",
          "想再了解一下你過去的健康狀況：有沒有慢性病、平常固定追蹤的門診，或是以前住院、開刀的經驗？過去有沒有發生過跟這次很像的狀況？"
        );
      }

      case "PMH": {
        const evalResult = await evaluateAnswer("PMH", userMessage, s);
        if (!evalResult.ok && evalResult.followup) {
          return { text: evalResult.followup, state: "PMH" };
        }
        s.pmh = userMessage;
        return moveTo(
          "MEDS_ALLERGY",
          "目前有在規則使用的處方藥、保健食品或中藥嗎？另外是否有任何藥物、食物或環境（像是花粉、塵蟎）過敏的情形？可以盡量幫我列出來。"
        );
      }

      case "MEDS_ALLERGY": {
        const evalResult = await evaluateAnswer("MEDS_ALLERGY", userMessage, s);
        if (!evalResult.ok && evalResult.followup) {
          return { text: evalResult.followup, state: "MEDS_ALLERGY" };
        }
        s.medsAllergy = userMessage;
        return moveTo(
          "FH_SH",
          "最後想了解一下家族和生活習慣：家人當中有沒有高血壓、糖尿病、心臟病、中風或癌症？平常有沒有抽菸、喝酒、吃檳榔或大量咖啡因？運動和睡眠大概是什麼狀況呢？"
        );
      }

      case "FH_SH": {
        const evalResult = await evaluateAnswer("FH_SH", userMessage, s);
        if (!evalResult.ok && evalResult.followup) {
          return { text: evalResult.followup, state: "FH_SH" };
        }
        s.fhSh = userMessage;
        s.state = "END";
        await setSession(userId, s);
        const summaryForUser = await generatePatientReply(s);
        return { text: summaryForUser, state: "END" };
      }

      default:
        return {
          text: "我已把你的重點整理給醫師了，等等醫師會再跟你詳細確認喔 🙌 若要重新開始，請輸入「重新開始」。",
          state: "END"
        };
    }
  },
};

/**
 * 問診結束後，給病人一個「收尾＋安全提醒」的 LLM 回覆
 */
async function generatePatientReply(s: SessionData): Promise<string> {
  if (DISABLE_LLM) {
    return "感謝你詳細的說明，我已把重點整理好交給醫師。若此刻症狀突然加劇、呼吸困難或意識不清，請立刻告知現場人員。";
  }
  const systemInstruction = `
你是預診小幫手，現在問診告一個段落，需要幫忙做「對病人的收尾回應」。
要求：
- 不做診斷、不給具體醫療或用藥建議。
- 用 2～3 句繁體中文，簡單整理今天聽到的重點，表達同理。
- 提醒：真正的診斷與治療會由醫師來做決定。
- 若有胸痛、呼吸困難、意識改變等可能的危險訊號，溫和提醒若症狀突然明顯惡化，要立即告知現場人員或尋求急救協助。
  `;
  const userContext = `
CC:${s.cc || ""};
HPI:O=${s.hpi?.onset || ""},P=${s.hpi?.triggersReliefs || ""},Q/S=${s.hpi?.qualityAndSite || ""},S=${s.hpi?.severity || ""},A=${s.hpi?.associated || ""};
ROS:${s.ros || ""};
PMH:${s.pmh || ""};
Meds/Allergy:${s.medsAllergy || ""};
FH/SH:${s.fhSh || ""};
  `;
  const draft = await callLLM(systemInstruction, userContext);
  return safetyFilter(draft);
}
