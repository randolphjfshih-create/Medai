
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

  chiefComplaint?: string;
  onset?: string;
  quality?: string;
  associated?: string;
  history?: string;
  concern?: string;
}
