export type BotState =
  | "RAPPORT"
  | "CC"
  | "HPI_ONSET"
  | "HPI_TRIGGER_RELIEF"
  | "HPI_QUALITY_SITE"
  | "HPI_SEVERITY"
  | "HPI_ASSOC"
  | "ROS"
  | "PMH"
  | "MEDS_ALLERGY"
  | "FH_SH"
  | "SATISFACTION"
  | "RECOMMEND"
  | "END";

export interface SessionData {
  // 👇 改成 optional，這樣 {} 也可以被當成 SessionData 使用
  userId?: string;

  // 對話語言：預設先用 zh，偵測到英文就變 en
  lang?: "zh" | "en";

  state?: BotState;

  cc?: string;

  hpi?: {
    onset?: string;
    triggersReliefs?: string;
    qualityAndSite?: string;
    severity?: string;
    associated?: string;
  };

  ros?: string;
  pmh?: string;
  medsAllergy?: string;
  fhSh?: string;

  // 🆕 病患體驗問卷
  satisfaction?: string; // 滿意度
  recommend?: string;    // 是否推薦
}
