import { SessionData } from "../types/session";

/**
 * 給醫師端看的摘要（含「初步鑑別方向提示」與紅旗提醒）
 * 注意：
 * - 這是「臨床思考提示」，不是確診。
 * - 不提供處方/劑量/對病人指示。
 */
export function buildDoctorSummary(userId: string, s: SessionData): string {
  const lines: string[] = [];

  const cc = (s.cc || "").trim();
  const onset = (s.hpi?.onset || "").trim();
  const trig = (s.hpi?.triggersReliefs || "").trim();
  const qual = (s.hpi?.qualityAndSite || "").trim();
  const sev = (s.hpi?.severity || "").trim();
  const assoc = (s.hpi?.associated || "").trim();
  const ros = (s.ros || "").trim();
  const pmh = (s.pmh || "").trim();
  const meds = (s.medsAllergy || "").trim();
  const fhsh = (s.fhSh || "").trim();

  const allText = [cc, onset, trig, qual, sev, assoc, ros, pmh, meds, fhsh].join("\n").toLowerCase();

  lines.push(`ID: ${userId}`);
  if (cc) lines.push(`CC: ${cc}`);

  // HPI
  lines.push("");
  lines.push("HPI:");
  if (onset) lines.push(`  - Onset & Course: ${onset}`);
  if (trig) lines.push(`  - Triggers/Relief: ${trig}`);
  if (qual) lines.push(`  - Quality/Site: ${qual}`);
  if (sev) lines.push(`  - Severity (0–10): ${sev}`);
  if (assoc) lines.push(`  - Associated: ${assoc}`);

  // ROS/PMH/Meds/FHSH
  if (ros) { lines.push(""); lines.push("ROS:"); lines.push(`  ${ros}`); }
  if (pmh) { lines.push(""); lines.push("PMH:"); lines.push(`  ${pmh}`); }
  if (meds) { lines.push(""); lines.push("Meds/Allergy:"); lines.push(`  ${meds}`); }
  if (fhsh) { lines.push(""); lines.push("FH/SH:"); lines.push(`  ${fhsh}`); }

  // (Optional) patient experience survey if present in session
  // These fields are optional; if you already added them in SessionData they will show, otherwise ignored.
  const satisfaction = (s as any).satisfaction ? String((s as any).satisfaction).trim() : "";
  const recommend = (s as any).recommend ? String((s as any).recommend).trim() : "";
  if (satisfaction || recommend) {
    lines.push("");
    lines.push("Patient Experience:");
    if (satisfaction) lines.push(`  - Satisfaction: ${satisfaction}`);
    if (recommend) lines.push(`  - Recommend: ${recommend}`);
  }

  // --- Heuristic clinical thinking (doctor-facing) ---
  const ddx: string[] = [];
  const redFlags: string[] = [];

  const has = (k: string) => allText.includes(k);

  // Generic red flags
  if (has("胸痛") || has("chest pain") || has("胸悶")) redFlags.push("Chest pain/pressure: consider ACS/PE/aortic dissection depending on context; assess vitals, ECG, red flags.");
  if (has("呼吸") && (has("困難") || has("喘") || has("shortness"))) redFlags.push("Dyspnea: assess SpO2, respiratory distress; consider cardiopulmonary urgent causes.");
  if (has("意識") || has("昏迷") || has("seizure") || has("抽搐")) redFlags.push("Altered mental status/seizure: urgent neuro evaluation.");
  if (has("麻木") || has("無力") || has("說話") || has("口齒") || has("vision") || has("單側")) redFlags.push("Focal neurologic deficits: consider stroke/TIA; urgent evaluation.");
  if (has("高燒") || has("持續發燒") || has("rigor") || has("寒顫")) redFlags.push("Persistent high fever/rigors: consider severe infection/sepsis depending on vitals & risk factors.");

  // Symptom-specific DDx hints
  if (has("頭痛") || has("headache")) {
    ddx.push("Primary headache (tension-type / migraine): assess triggers, photophobia, nausea, prior pattern.");
    ddx.push("Secondary causes to consider: sinusitis, medication overuse, hypertension-related, infection depending on ROS.");
    if (has("突然") || has("thunderclap") || has("爆炸")) {
      redFlags.push("Thunderclap/sudden severe headache: consider SAH/vascular causes; urgent workup if suspected.");
    }
    if (has("發燒") || has("頸部僵硬") || has("neck stiffness")) {
      redFlags.push("Headache + fever/neck stiffness: consider meningitis/encephalitis; urgent evaluation if suspected.");
    }
  }

  if (has("手腕") || has("wrist") || has("腕")) {
    ddx.push("MSK: sprain/strain, tendinopathy/tenosynovitis (e.g., De Quervain) depending on location & use.");
    ddx.push("Arthritis/inflammatory causes: gout/pseudogout, RA flare if history/signs.");
    ddx.push("Fracture/occult injury if trauma or focal bony tenderness; consider imaging if indicated.");
    if (has("麻") || has("麻木") || has("tingling")) ddx.push("Nerve entrapment: carpal tunnel/ulnar neuropathy depending on distribution.");
  }

  if (has("腹痛") || has("abdominal pain")) {
    ddx.push("GI: gastritis/GERD, gastroenteritis depending on nausea/vomiting/diarrhea; assess dehydration.");
    ddx.push("Appendicitis/cholecystitis/diverticulitis depending on location, fever, peritoneal signs.");
    if (has("血便") || has("黑便") || has("吐血")) redFlags.push("GI bleeding symptoms: urgent evaluation depending on vitals/labs.");
  }

  if (has("咳嗽") || has("cough")) {
    ddx.push("Respiratory: viral URI/bronchitis; consider pneumonia if fever, pleuritic pain, focal signs.");
    if (has("咳血") || has("hemoptysis")) redFlags.push("Hemoptysis: evaluate urgently depending on volume/risk factors.");
  }

  if (has("頻尿") || has("血尿") || has("排尿") || has("dysuria")) {
    ddx.push("Urinary: UTI/pyelonephritis depending on fever/flank pain; consider stones if colicky pain/hematuria.");
    if (has("腰痛") && has("發燒")) redFlags.push("Flank pain + fever: consider pyelonephritis; assess promptly.");
  }

  // If no ddx inferred, provide generic reasoning note
  lines.push("");
  lines.push("Clinical Thinking (heuristic, for clinician):");
  if (ddx.length) {
    lines.push("  - Differential directions (non-diagnostic):");
    for (const item of ddx.slice(0, 6)) lines.push(`    • ${item}`);
  } else {
    lines.push("  - Differential directions: (insufficient signal from text; rely on clinician interview/PE).");
  }

  if (redFlags.length) {
    lines.push("");
    lines.push("Red Flags to consider / rule out:");
    for (const rf of Array.from(new Set(redFlags)).slice(0, 6)) lines.push(`  • ${rf}`);
  }

  lines.push("");
  lines.push("Note: The above is a preliminary triage-oriented suggestion for clinician use only; NOT a diagnosis. Final assessment requires clinician evaluation and physical exam.");

  return lines.join("\n");
}
