
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

export interface HPIBlock {
  onset?: string;
  triggersReliefs?: string;
  qualityAndSite?: string;
  severity?: string;
  associated?: string;
}

export interface SessionData {
  state?: BotState;
  cc?: string;
  hpi?: HPIBlock;
  ros?: string;
  pmh?: string;
  medsAllergy?: string;
  fhSh?: string;
}
