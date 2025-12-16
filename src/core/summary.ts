
import { SessionData } from "../types/session";

export function buildDoctorSummary(userId: string, s: SessionData): string {
  const lines: string[] = [];
  lines.push(`ID: ${userId}`);
  if (s.cc) lines.push(`CC: ${s.cc}`);
  if (s.hpi) {
    lines.push("HPI:");
    if (s.hpi.onset) lines.push(`  - Onset & Course: ${s.hpi.onset}`);
    if (s.hpi.triggersReliefs) lines.push(`  - Triggers/Relief: ${s.hpi.triggersReliefs}`);
    if (s.hpi.qualityAndSite) lines.push(`  - Quality/Site: ${s.hpi.qualityAndSite}`);
    if (s.hpi.severity) lines.push(`  - Severity (0–10): ${s.hpi.severity}`);
    if (s.hpi.associated) lines.push(`  - Associated: ${s.hpi.associated}`);
  }
  if (s.ros) lines.push(`ROS: ${s.ros}`);
  if (s.pmh) lines.push(`PMH: ${s.pmh}`);
  if (s.medsAllergy) lines.push(`Meds/Allergy: ${s.medsAllergy}`);
  if (s.fhSh) lines.push(`FH/SH: ${s.fhSh}`);
  if (s.satisfaction) lines.push(`Satisfaction: ${s.satisfaction}`);
  if (s.recommend) lines.push(`Recommend: ${s.recommend}`);
  return lines.join("\n");
}
