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
  | "END";

export interface SessionData {
  userId: string;

  // 👇👇 新增的語言欄位（一定要有）
  lang?: "zh" | "en";

  // 狀態
  state?: BotState;

  // 主訴
  cc?: string;

  // 現病史
  hpi?: {
    onset?: string;
    triggersReliefs?: string;
    qualityAndSite?: string;
    severity?: string;
    associated?: string;
  };

  // 系統性問診
  ros?: string;

  // 既往史
  pmh?: string;

  // 用藥 + 過敏
  medsAllergy?: string;

  // 家族史 / 社會史
  fhSh?: string;
}
