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
 * 根據「目前已收集資訊 + 問診階段」，請 LLM 幫忙生下一句自然的問題
 */
async function buildDynamicQuestion(
  phase: BotState,
  session: SessionData,
  fallback: string
): Promise<string> {
  if (DISABLE_LLM) return fallback;

  const systemInstruction = `
你是一個「醫療預診對話小助手」，負責在看診前先和病人聊天與問診。
要點：
- 不可以下診斷、不可以建議具體醫療處置或用藥。
- 只能做「同理＋釐清症狀」的對話，幫真正的醫師整理資訊。
- 用溫暖、口語化的繁體中文，像門診護理師或住院醫師在聊天。
- 依照目前的問診階段（phase）發問，\`phase\` 只限定問題主題，實際用字遣詞可以自由一點。
- 話不要太長，1～3 句即可，最後一句一定要有一個清楚的問題。
- 可以簡短回應病人的上一句感受（例如「聽起來你已經不舒服一陣子了」），再接問題。
- 嚴禁出現「我覺得你是 XX 病」、「建議你吃 XX 藥」這類內容。
  `;

  const userContext = `
[phase]: ${phase}
[已知資訊節錄（給你參考，可以引用）]
- CC（主訴）: ${session.cc || ""}
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

請你根據 phase 決定下一個問題的重點：
- phase="RAPPORT": 打招呼、簡單寒暄、建立信任，最後要確認「能不能開始聊今天不舒服的地方」。
- phase="CC": 聚焦在「今天主要想解決什麼不舒服」，可以用一兩句同理，然後請他描述主訴。
- phase="HPI_ONSET": 針對發作時間與病程問，像是從什麼時候開始、突然還是慢慢變嚴重。
- phase="HPI_TRIGGER_RELIEF": 問什麼會讓症狀變好或變壞（活動、姿勢、休息、飲食等）。
- phase="HPI_QUALITY_SITE": 問症狀的性質（刺痛、悶痛、灼熱、壓迫…）和位置。
- phase="HPI_SEVERITY": 問嚴重程度 0–10 分，可以順便同理。
- phase="HPI_ASSOC": 問有沒有一起出現的其他症狀，例如發燒、胸痛、呼吸急促、嘔吐、腹瀉、頭暈、麻木等。
- phase="ROS": 依照一般症狀、呼吸、心血管、腸胃、泌尿、神經、皮膚做系統性掃描，可以請病人用列舉的方式說。
- phase="PMH": 問慢性病、過去手術或住院，以及是否有過類似狀況。
- phase="MEDS_ALLERGY": 問正在使用的處方藥／保健食品／中藥／自購藥，以及藥物/食物/環境過敏。
- phase="FH_SH": 問家族心血管疾病、糖尿病、中風、癌症，以及菸酒、檳榔、咖啡因、運動、睡眠習慣。

請輸出「一小段自然的對話內容」，最後一句要是一個問題。
不要多講任何關於診斷或治療的建議。
  `;

  try {
    const draft = await callLLM(systemInstruction, userContext);
    const safe = safetyFilter(draft || "");
    return safe || fallback;
  } catch {
    return fallback;
  }
}

export const dialogueManager = {
  handleUserMessage: async (userId: string, userMessage: string): Promise<{ text: string; state: BotState }> => {
    const s: SessionData = await getSession(userId);
    let state: BotState = s.state || "RAPPORT";

    // 小工具：更新 state + 存 session + 給下一題（由 LLM 生問題）
    async function moveTo(nextState: BotState, fallbackQuestion: string) {
      s.state = nextState;
      await setSession(userId, s);
      const question = await buildDynamicQuestion(nextState, s, fallbackQuestion);
      return { text: question, state: nextState };
    }

    switch (state) {
      case "RAPPORT":
        // 一開始沒有使用者內容，只是打招呼，所以這一步直接讓 LLM 發揮
        return moveTo(
          "CC",
          "嗨～我是預診小幫手，待會會先簡單了解你的狀況，再把重點整理給醫師。今天主要想處理什麼不舒服呢？"
        );

      case "CC":
        s.cc = userMessage;
        return moveTo(
          "HPI_ONSET",
          "了解，你主要是不舒服在這個部分。大概是從什麼時候開始的？是突然發生還是慢慢變嚴重？"
        );

      case "HPI_ONSET":
        s.hpi = s.hpi || {};
        s.hpi.onset = userMessage;
        return moveTo(
          "HPI_TRIGGER_RELIEF",
          "這個症狀有沒有什麼情況會特別加重或比較緩解？例如活動、休息、姿勢改變或是吃東西之後？"
        );

      case "HPI_TRIGGER_RELIEF":
        s.hpi = s.hpi || {};
        s.hpi.triggersReliefs = userMessage;
        return moveTo(
          "HPI_QUALITY_SITE",
          "想再多了解一下這個不舒服的感覺，是刺痛、悶痛、灼熱、壓迫還是說不上來？大概是在身體哪個位置呢？"
        );

      case "HPI_QUALITY_SITE":
        s.hpi = s.hpi || {};
        s.hpi.qualityAndSite = userMessage;
        return moveTo(
          "HPI_SEVERITY",
          "如果用 0 到 10 分來形容現在這個不舒服，0 分是完全不痛，10 分是最痛，現在大概會給幾分？"
        );

      case "HPI_SEVERITY":
        s.hpi = s.hpi || {};
        s.hpi.severity = userMessage;
        return moveTo(
          "HPI_ASSOC",
          "在這段期間，有沒有一起出現其他症狀？像是發燒、胸痛、呼吸變喘、噁心嘔吐、腹瀉、頭暈、手腳麻木之類的？如果有，可以幫我說一下。"
        );

      case "HPI_ASSOC":
        s.hpi = s.hpi || {};
        s.hpi.associated = userMessage;
        return moveTo(
          "ROS",
          "接下來會做一個簡單的全身檢查（ROS），看有沒有漏掉的地方。最近在體溫、咳嗽、胸悶心悸、腸胃（拉肚子、便祕）、小便、頭痛頭晕、皮膚疹子或搔癢方面，有沒有什麼特別的變化？如果都還好也可以說「沒有特別」。"
        );

      case "ROS":
        s.ros = userMessage;
        return moveTo(
          "PMH",
          "想再了解一下你過去的健康狀況：有沒有慢性病、平常固定追蹤的門診，或是以前住院、開刀的經驗？過去有沒有發生過跟這次很像的狀況？"
        );

      case "PMH":
        s.pmh = userMessage;
        return moveTo(
          "MEDS_ALLERGY",
          "目前有在規則使用的處方藥、保健食品或中藥嗎？另外是否有任何藥物、食物或環境（像是花粉、塵蟎）過敏的情形？可以盡量幫我列出來。"
        );

      case "MEDS_ALLERGY":
        s.medsAllergy = userMessage;
        return moveTo(
          "FH_SH",
          "最後想了解一下家族和生活習慣：家人當中有沒有高血壓、糖尿病、心臟病、中風或癌症？平常有沒有抽菸、喝酒、吃檳榔或大量咖啡因？運動和睡眠大概是什麼狀況呢？"
        );

      case "FH_SH":
        s.fhSh = userMessage;
        s.state = "END";
        await setSession(userId, s);
        const summaryForUser = await generatePatientReply(s);
        return { text: summaryForUser, state: "END" };

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
