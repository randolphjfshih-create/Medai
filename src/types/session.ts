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

/**
 * 問診過程中所累積的狀態
 * - 所有欄位設為 optional，方便逐步填入
 */
export interface SessionData {
  /** 問診目前進行到哪一個階段 */
  state?: BotState;

  /** 偏好的對話語言（簡單使用 zh / en） */
  lang?: "zh" | "en";

  /** 主訴（病人用自己的話描述今天最想解決的問題） */
  cc?: string;

  /** 現病史 HPI（分段記錄） */
  hpi?: {
    onset?: string;             // 發作時間與病程
    triggersReliefs?: string;   // 誘發與緩解因素
    qualityAndSite?: string;    // 症狀性質與部位
    severity?: string;          // 嚴重程度 (0–10)
    associated?: string;        // 伴隨症狀
  };

  /** 系統性問診 ROS（文字摘要） */
  ros?: string;

  /** 既往史 PMH */
  pmh?: string;

  /** 用藥 / 過敏史 */
  medsAllergy?: string;

  /** 家族史 / 社會史 */
  fhSh?: string;

  /** 病患主觀滿意度（原始回答） */
  satisfaction?: string;

  /** 病患是否願意推薦此 AI 預診流程（原始回答） */
  recommend?: string;
}
