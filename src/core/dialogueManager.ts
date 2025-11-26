
import { getSession, setSession } from "./stateStore";
import { callLLM } from "./llmClient";
import { safetyFilter } from "./safetyFilter";
import { SessionData, BotState } from "../types/session";

const DISABLE_LLM = (process.env.DISABLE_LLM_FOR_DEBUG || "false").toLowerCase() === "true";

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

export const dialogueManager = {
  handleUserMessage: async (userId: string, userMessage: string): Promise<{ text: string; state: BotState }> => {
    const s: SessionData = await getSession(userId);
    let state: BotState = s.state || "RAPPORT";

    function ask(text: string, st: BotState) {
      s.state = st; 
      setSession(userId, s);
      return { text, state: st as BotState };
    }

    switch (state) {
      case "RAPPORT":
        return ask("嗨～我是預診小幫手。我會把你提供的重點整理給醫師，過程中也會盡量讓你放心。可以開始嗎？", "CC");

      case "CC":
        s.cc = userMessage;
        return ask("這個狀況大概何時開始？突然還是逐漸？（OPQRST：O）", "HPI_ONSET");

      case "HPI_ONSET":
        s.hpi = s.hpi || {};
        s.hpi.onset = userMessage;
        return ask("有沒有讓它更嚴重或比較緩解的因素？例如運動、休息、進食等。（OPQRST：P）", "HPI_TRIGGER_RELIEF");

      case "HPI_TRIGGER_RELIEF":
        s.hpi = s.hpi || {};
        s.hpi.triggersReliefs = userMessage;
        return ask("不舒服比較像哪一種？（刺痛/悶痛/灼熱/壓迫…）位置在哪裡？（OPQRST：Q & S）", "HPI_QUALITY_SITE");

      case "HPI_QUALITY_SITE":
        s.hpi = s.hpi || {};
        s.hpi.qualityAndSite = userMessage;
        return ask("嚴重程度 0–10 分，你會給幾分？（OPQRST：S）", "HPI_SEVERITY");

      case "HPI_SEVERITY":
        s.hpi = s.hpi || {};
        s.hpi.severity = userMessage;
        return ask("有沒有一起發生其他症狀？例如發燒、胸痛、呼吸急促、嘔吐、腹瀉、頭暈、麻木等。（OPQRST：A）", "HPI_ASSOC");

      case "HPI_ASSOC":
        s.hpi = s.hpi || {};
        s.hpi.associated = userMessage;
        return ask("做一輪快速檢查（ROS）：可以列出或回覆「無明顯」。一般：發燒/倦怠/盜汗/體重變化；呼吸：咳嗽/咳痰/喘；心血管：胸痛/心悸/呼吸困難/下肢水腫；腸胃：腹痛/嘔吐/腹瀉/便祕；泌尿：頻尿/血尿/排尿困難；神經：頭痛/頭暈/麻木/抽搐；皮膚：疹子/搔癢。", "ROS");

      case "ROS":
        s.ros = userMessage;
        return ask("既往史（PMH）：慢性病、過去手術或住院、是否有過往相似症狀。", "PMH");

      case "PMH":
        s.pmh = userMessage;
        return ask("用藥與過敏史：現用處方藥、保健用品/中藥/自購藥品，以及任何藥物/食物/環境過敏。", "MEDS_ALLERGY");

      case "MEDS_ALLERGY":
        s.medsAllergy = userMessage;
        return ask("家族史/社會史：家族是否有高血壓/糖尿病/心臟病/中風/癌症？生活習慣如菸/酒/檳榔/咖啡因/運動/睡眠狀況？", "FH_SH");

      case "FH_SH":
        s.fhSh = userMessage;
        s.state = "END";
        await setSession(userId, s);
        const summaryForUser = await generatePatientReply(s);
        return { text: summaryForUser, state: "END" };

      default:
        return { text: "我已把你的重點整理給醫師了，等等醫師會再跟你詳細確認喔 🙌 若要重新開始，請輸入「重新開始」。", state: "END" };
    }
  },
};

async function generatePatientReply(s: SessionData): Promise<string> {
  if (DISABLE_LLM) {
    return "感謝你詳細的說明，我已把重點整理好交給醫師。若此刻症狀突然加劇、呼吸困難或意識不清，請立刻告知現場人員。";
  }
  const systemInstruction = "你是預診小幫手，收束對話、避免診斷與用藥建議，提醒惡化時尋求協助。繁體中文、2–3句。";
  const userContext = `CC:${s.cc||""}; HPI:O=${s.hpi?.onset||""},P=${s.hpi?.triggersReliefs||""},Q/S=${s.hpi?.qualityAndSite||""},S=${s.hpi?.severity||""},A=${s.hpi?.associated||""}; ROS:${s.ros||""}; PMH:${s.pmh||""}; Meds/Allergy:${s.medsAllergy||""}; FH/SH:${s.fhSh||""}`;
  const draft = await callLLM(systemInstruction, userContext);
  return safetyFilter(draft);
}
