export interface SessionData {
  state?: 
    | "INTRO"
    | "ASK_CHIEF"
    | "ASK_ONSET"
    | "ASK_QUALITY"
    | "ASK_ASSOCIATED"
    | "ASK_HISTORY"
    | "ASK_CONCERN"
    | "END";

  chiefComplaint?: string;  // 病人主訴
  onset?: string;           // 什麼時候開始
  quality?: string;         // 症狀性質 (刺痛/悶/壓迫…)
  associated?: string;      // 伴隨症狀 / 紅旗候選
  history?: string;         // 既往史 / 慢性病 / 用藥
  concern?: string;         // 病人最擔心的點 (情緒價值)
}
