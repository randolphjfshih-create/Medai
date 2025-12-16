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
    // 滿意度 & 推薦（體驗相關）
    case "SATISFACTION": return ["非常滿意", "還可以", "普通", "不太滿意"];
    case "RECOMMEND": return ["會", "可能會", "不一定", "不會"];
    default: return undefined;
  }
}

/**
 * 檢查回答是否合理（放寬標準，避免一直 REASK）
 * - ok=true 代表可接受
 * - ok=false 且 followup 有字，代表要留在同一題，請再追問一次
 */
async function evaluateAnswer(
  phase: BotState,
  answer: string,
  session: SessionData
): Promise<{ ok: boolean; followup?: string }> {
  if (DISABLE_LLM) return { ok: true };

  const text = (answer || "").trim();

  // 1) 大部分正常回答直接放行，避免一直 REASK
  //   - 長度夠長（>= 6 字）就當作有在認真回答
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
  const obviousBad = /^(不知道|隨便|沒差|不想講|看你|隨意|哈哈+|呵呵+|嗯嗯+|嗚嗚+)$/.test(text);
  if (!obviousBad && text.length > 0) {
    // 雖然很短，但看起來也不像亂打，就放行
    return { ok: true };
  }

  // 5) 真的覺得很敷衍的回答，才丟給 LLM 產生 REASK
  const preferredLanguage = session.lang || "zh";

  const systemInstruction = `
你是一個「醫療預診小助手」，負責幫忙判斷「病人的回答有沒有回答到問題」。
只做判斷，不做診斷，也不提供任何治療或用藥建議。

preferred_language:
- "zh": 用溫暖的繁體中文回答。
- "en": 回覆使用自然的英文。

規則：
- 如果病人的回答跟目前問診階段 phase 的主題明顯相關，而且有提供一些實際資訊，
  請只輸出：OK
- 如果病人的回答很明顯離題、只有很短的字詞（像「不知道」「隨便」「哈哈」）、
  或是亂輸入（像是一串無意義的字），請輸出：
  REASK: ＋一小句話，重新用比較好懂的方式問同一題，
  並且可以簡短同理/說明你沒有聽懂。

嚴禁：
- 不可以出現任何疾病名稱、診斷結論。
- 不可以出現「建議你吃 XX 藥」「先不用看醫生」這種句子。
  `;

  const userContext = `
[phase]: ${phase}
[answer]: ${answer}
[preferred_language]: ${preferredLanguage}

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

/**
 * 根據「目前已收集資訊 + 問診階段」，請 LLM 幫忙生下一句自然的問題
 */
async function buildDynamicQuestion(
  phase: BotState,
  session: SessionData,
  fallback: string
): Promise<string> {
  if (DISABLE_LLM) return fallback;

  const preferredLanguage = session.lang || "zh";

  const systemInstruction = `
你是一個「醫療預診對話小助手」，負責在看診前先和病人聊天與問診。
要點：
- 不可以下診斷、不可以建議具體醫療處置或用藥。
- 只能做「同理＋釐清症狀」的對話，幫真正的醫師整理資訊。
- 語言使用：
  - 如果 preferred_language = "zh"，請用口語化繁體中文。
  - 如果 preferred_language = "en"，請用自然的英文。
- 依照目前的問診階段（phase）發問，phase 只限定問題主題，實際用字遣詞可以自由一點。
- 話不要太長，1～3 句即可，最後一句一定要有一個清楚的問題。
- 可以簡短回應病人的感受，例如「聽起來你已經不舒服一陣子了」，再接問題。
- 嚴禁出現「我覺得你是 XX 病」「建議你吃 XX 藥」這類內容。
  `;

  const userContext = `
[phase]: ${phase}
[preferred_language]: ${preferredLanguage}

[已知資訊節錄（給你參考，可以引用）]
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

請你根據 phase 決定下一個問題的重點：
- phase="RAPPORT": 打招呼、簡單寒暄、建立信任（實務上這一段在其他邏輯處理，這裡主要用在後續）。
- phase="CC": 聚焦在「今天主要想解決什麼不舒服」，可以用一兩句同理，然後請他描述主訴。
- phase="HPI_ONSET": 針對發作時間與病程問，像是從什麼時候開始、突然還是慢慢變嚴重。
- phase="HPI_TRIGGER_RELIEF": 問什麼會讓症狀變好或變壞（活動、姿勢、休息、飲食等）。
- phase="HPI_QUALITY_SITE": 問症狀的性質（刺痛、悶痛、灼熱、壓迫…）和位置。
- phase="HPI_SEVERITY": 問嚴重程度 0–10 分，可以順便同理。
- phase="HPI_ASSOC": 問有沒有一起出現其他症狀，例如發燒、胸痛、呼吸急促、嘔吐、腹瀉、頭暈、麻木等。
- phase="ROS": 做系統性掃描，可以請病人用列舉的方式說有/沒有。
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

    // 方便共用的小工具：切換狀態＋問下一題
    async function moveTo(nextState: BotState, fallbackQuestion: string) {
      s.state = nextState;
      await setSession(userId, s);
      const question = await buildDynamicQuestion(nextState, s, fallbackQuestion);
      return { text: question, state: nextState };
    }

    // 簡單語言偵測：有中文就當 zh，否則 en
    function detectLang(text: string): "zh" | "en" {
      return /[\u4e00-\u9fff]/.test(text) ? "zh" : "en";
    }

    switch (state) {
      case "RAPPORT": {
        if (!s.lang) {
          s.lang = detectLang(userMessage || "");
        }
        await setSession(userId, s);

        const zh = "嗨～我是 AI 預診小幫手，先跟你打聲招呼！  我等等會一步一步了解你的狀況，幫你把重點整理給醫師。如果你準備好了，可以先跟我說說。";
        const en = "Hi! I'm your AI pre-consultation assistant.  Just saying hello first. I'll ask a few questions to better understand how you're feeling and summarize it for the doctor. When you're ready, you can start sharing.";

        s.state = "CC";
        await setSession(userId, s);
        return {
          text: s.lang === "en" ? en : zh,
          state: "CC"
        };
      }

      case "CC": {
        // 主訴不檢查：頭痛、手腕痛、胸悶… 這種短句都直接接受
        s.cc = userMessage;
        await setSession(userId, s);

        const zhFallback = "了解，你今天主要是因為這個不舒服來的。想再跟你確認一下，這個狀況大概是從什麼時候開始？是突然發生，還是慢慢變嚴重？";
        const enFallback = "Got it, thank you for sharing. I'd like to understand when this started. When did you first notice this problem, and did it come on suddenly or gradually?";

        return moveTo("HPI_ONSET", s.lang === "en" ? enFallback : zhFallback);
      }

      case "HPI_ONSET": {
        const evalResult = await evaluateAnswer("HPI_ONSET", userMessage, s);
        if (!evalResult.ok && evalResult.followup) {
          return { text: evalResult.followup, state: "HPI_ONSET" };
        }
        s.hpi = s.hpi || {};
        s.hpi.onset = userMessage;
        await setSession(userId, s);

        const zhFallback = "這個不舒服有沒有發現什麼情況會特別加重或比較緩解？例如活動、休息、姿勢改變，或是吃東西前後？";
        const enFallback = "Have you noticed anything that makes it better or worse? For example, movement, rest, changes in posture, or eating?";

        return moveTo("HPI_TRIGGER_RELIEF", s.lang === "en" ? enFallback : zhFallback);
      }

      case "HPI_TRIGGER_RELIEF": {
        const evalResult = await evaluateAnswer("HPI_TRIGGER_RELIEF", userMessage, s);
        if (!evalResult.ok && evalResult.followup) {
          return { text: evalResult.followup, state: "HPI_TRIGGER_RELIEF" };
        }
        s.hpi = s.hpi || {};
        s.hpi.triggersReliefs = userMessage;
        await setSession(userId, s);

        const zhFallback = "想再多了解一下這個不舒服的感覺，是刺痛、悶痛、灼熱、壓迫，還是說不上來的那種？大概是在身體哪個位置呢？";
        const enFallback = "Could you describe what the discomfort feels like—sharp, dull, burning, tight, or something else? And where exactly is it located?";

        return moveTo("HPI_QUALITY_SITE", s.lang === "en" ? enFallback : zhFallback);
      }

      case "HPI_QUALITY_SITE": {
        const evalResult = await evaluateAnswer("HPI_QUALITY_SITE", userMessage, s);
        if (!evalResult.ok && evalResult.followup) {
          return { text: evalResult.followup, state: "HPI_QUALITY_SITE" };
        }
        s.hpi = s.hpi || {};
        s.hpi.qualityAndSite = userMessage;
        await setSession(userId, s);

        const zhFallback = "如果用 0 到 10 分來形容現在這個不舒服，0 分是完全不痛，10 分是最痛，你覺得大概會給幾分？";
        const enFallback = "If 0 means no pain at all and 10 is the worst pain you can imagine, what number would you give your discomfort right now?";

        return moveTo("HPI_SEVERITY", s.lang === "en" ? enFallback : zhFallback);
      }

      case "HPI_SEVERITY": {
        const evalResult = await evaluateAnswer("HPI_SEVERITY", userMessage, s);
        if (!evalResult.ok && evalResult.followup) {
          return { text: evalResult.followup, state: "HPI_SEVERITY" };
        }
        s.hpi = s.hpi || {};
        s.hpi.severity = userMessage;
        await setSession(userId, s);

        const zhFallback = "在這段期間，有沒有一起出現其他症狀？像是發燒、胸痛、呼吸變喘、噁心嘔吐、腹瀉、頭暈、手腳麻木之類的，如果有可以幫我稍微描述一下。";
        const enFallback = "During this period, have you noticed any other symptoms, like fever, chest pain, shortness of breath, nausea, vomiting, diarrhea, dizziness, or numbness?";

        return moveTo("HPI_ASSOC", s.lang === "en" ? enFallback : zhFallback);
      }

      case "HPI_ASSOC": {
        const evalResult = await evaluateAnswer("HPI_ASSOC", userMessage, s);
        if (!evalResult.ok && evalResult.followup) {
          return { text: evalResult.followup, state: "HPI_ASSOC" };
        }
        s.hpi = s.hpi || {};
        s.hpi.associated = userMessage;
        await setSession(userId, s);

        const zhFallback = "接下來我會做一個簡單的全身檢查（問問題的那種），看看有沒有容易被忽略的地方。最近在體溫、咳嗽、胸悶心悸、腸胃（拉肚子、便祕）、小便、頭痛頭暈、皮膚疹子或搔癢方面，有沒有什麼特別的變化？如果都還好也可以說「沒有特別」。";
        const enFallback = "Next, I’ll briefly check for other body systems by asking a few questions. Recently, have you noticed anything unusual like fever, cough, chest tightness or palpitations, diarrhea or constipation, changes in urination, headaches, dizziness, skin rashes, or itching? If everything feels normal, you can also say so.";

        return moveTo("ROS", s.lang === "en" ? enFallback : zhFallback);
      }

      case "ROS": {
        const evalResult = await evaluateAnswer("ROS", userMessage, s);
        if (!evalResult.ok && evalResult.followup) {
          return { text: evalResult.followup, state: "ROS" };
        }
        s.ros = userMessage;
        await setSession(userId, s);

        const zhFallback = "想再了解一下你過去的健康狀況：有沒有慢性病、平常固定追蹤的門診，或是以前住院、開刀的經驗？過去有沒有發生過跟這次很像的狀況？";
        const enFallback = "I’d also like to know a bit about your past health. Do you have any chronic conditions, regular follow-up at clinics, or history of hospitalizations or surgeries? Have you ever experienced something similar to this before?";

        return moveTo("PMH", s.lang === "en" ? enFallback : zhFallback);
      }

      case "PMH": {
        const evalResult = await evaluateAnswer("PMH", userMessage, s);
        if (!evalResult.ok && evalResult.followup) {
          return { text: evalResult.followup, state: "PMH" };
        }
        s.pmh = userMessage;
        await setSession(userId, s);

        const zhFallback = "目前有在規則使用的處方藥、保健食品或中藥嗎？另外是否有任何藥物、食物或環境（像是花粉、塵蟎）過敏的情形？可以盡量幫我列出來。";
        const enFallback = "Are you currently taking any prescription medications, supplements, or herbal medicines? And do you have any known allergies to medications, foods, or environmental factors like pollen or dust mites? Please list as much as you can.";

        return moveTo("MEDS_ALLERGY", s.lang === "en" ? enFallback : zhFallback);
      }

      case "MEDS_ALLERGY": {
        const evalResult = await evaluateAnswer("MEDS_ALLERGY", userMessage, s);
        if (!evalResult.ok && evalResult.followup) {
          return { text: evalResult.followup, state: "MEDS_ALLERGY" };
        }
        s.medsAllergy = userMessage;
        await setSession(userId, s);

        const zhFallback = "最後想了解一下家族和生活習慣：家人當中有沒有高血壓、糖尿病、心臟病、中風或癌症？平常有沒有抽菸、喝酒、吃檳榔或大量咖啡因？運動和睡眠大概是什麼狀況呢？";
        const enFallback = "Lastly, I’d like to know about your family and lifestyle. Do any close family members have high blood pressure, diabetes, heart disease, stroke, or cancer? And how about your own habits—smoking, alcohol, betel nut, caffeine intake, exercise, and sleep?";

        return moveTo("FH_SH", s.lang === "en" ? enFallback : zhFallback);
      }

      case "FH_SH": {
        const evalResult = await evaluateAnswer("FH_SH", userMessage, s);
        if (!evalResult.ok && evalResult.followup) {
          return { text: evalResult.followup, state: "FH_SH" };
        }
        s.fhSh = userMessage;

        // 問診結束前：加入病人端體驗問卷（滿意度）
        const zhQ =
          "好的，謝謝你這麼詳細的說明 🙏 在結束之前，想快速請教一下，你對剛才這段 AI 預診問答的整體感受如何？\n\n你可以跟我說：非常滿意、還可以、普通或不太滿意～";
        const enQ =
          "Thank you for sharing all these details 🙏 Before we finish, I'd like to quickly ask: how do you feel about this AI pre-consultation overall?\n\nYou can answer something like: very satisfied, okay, average, or not very satisfied.";

        return moveTo("SATISFACTION", s.lang === "en" ? enQ : zhQ);
      }

      case "SATISFACTION": {
        // 病人怎麼回答都接受，純蒐集體驗回饋
        s.satisfaction = userMessage;

        const zhQ =
          "感謝你的回饋，我會把這些意見帶給團隊 🙌\n\n最後一題就好：如果未來有朋友或家人想在看醫師前，先跟 AI 簡單聊聊、幫忙整理重點，你覺得你會願意推薦他們使用這個服務嗎？";
        const enQ =
          "Thank you for your feedback — it’s very helpful for improving this service 🙌\n\nLast question: if your friends or family needed to quickly talk to an AI to organize their thoughts before seeing a doctor, would you recommend this service to them?";

        return moveTo("RECOMMEND", s.lang === "en" ? enQ : zhQ);
      }

      case "RECOMMEND": {
        s.recommend = userMessage;
        s.state = "END";
        await setSession(userId, s);

        const summaryForUser = await generatePatientReply(s);
        return { text: summaryForUser, state: "END" };
      }

      default:
        return {
          text: s.lang === "en"
            ? "I’ve summarized your key information for the doctor. They will go through the details with you shortly. If you’d like to start again, you can type \"restart\"."
            : "我已經把你的重點整理給醫師了，等等醫師會再跟你詳細確認喔 🙌 若要重新開始，請輸入「重新開始」。",
          state: "END"
        };
    }
  },
};

/**
 * 問診結束後，給病人一個「收尾＋安全提醒」的 LLM 回覆（支援中英）
 */
async function generatePatientReply(s: SessionData): Promise<string> {
  const lang = s.lang || "zh";

  if (DISABLE_LLM) {
    if (lang === "en") {
      return "Thank you for sharing all this information. I’ve organized it for the doctor to review. If you feel suddenly much worse, especially with chest pain, trouble breathing, or altered consciousness, please let the staff know immediately or seek urgent help.";
    }
    return "感謝你詳細的說明，我已把重點整理好交給醫師。若此刻症狀突然加劇、胸痛、呼吸困難或意識不清，請立刻告知現場人員或盡快就醫。";
  }

  const systemInstruction = `
你是預診小幫手，現在問診告一個段落，需要幫忙做「對病人的收尾回應」。
preferred_language:
- "zh": 請用 2～3 句溫暖的繁體中文。
- "en": 請用 2～3 句自然的英文。

要求：
- 不做診斷、不給具體醫療或用藥建議。
- 簡單整理今天聽到的重點，表達同理。
- 提醒：真正的診斷與治療會由醫師來做決定。
- 若有胸痛、呼吸困難、意識改變等可能的危險訊號，溫和提醒若症狀突然明顯惡化，要立即告知現場人員或尋求急救協助。
  `;

  const userContext = `
[preferred_language]: ${lang}
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
