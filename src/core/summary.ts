import { SessionData } from "../types/session";

/**
 * 給醫師端使用的文字摘要
 * - 不對病人顯示
 * - 不做正式診斷，只提供「思考方向」提示
 */
export function buildDoctorSummary(userId: string, s: SessionData): string {
  const lines: string[] = [];

  lines.push(`ID: ${userId}`);

  // 1) 主訴與現病史
  if (s.cc) {
    lines.push("");
    lines.push("【主訴 CC】");
    lines.push(`- ${s.cc}`);
  }

  if (s.hpi) {
    const h = s.hpi;
    lines.push("");
    lines.push("【現病史 HPI】");
    if (h.onset) lines.push(`- 發作時間與病程: ${h.onset}`);
    if (h.triggersReliefs) lines.push(`- 誘發 / 緩解因素: ${h.triggersReliefs}`);
    if (h.qualityAndSite) lines.push(`- 症狀性質與部位: ${h.qualityAndSite}`);
    if (h.severity) lines.push(`- 嚴重程度 (0–10): ${h.severity}`);
    if (h.associated) lines.push(`- 伴隨症狀: ${h.associated}`);
  }

  // 2) 其他重要病史
  if (s.ros) {
    lines.push("");
    lines.push("【系統性問診 ROS（摘要）】");
    lines.push(`- ${s.ros}`);
  }
  if (s.pmh) {
    lines.push("");
    lines.push("【既往史 PMH】");
    lines.push(`- ${s.pmh}`);
  }
  if (s.medsAllergy) {
    lines.push("");
    lines.push("【用藥 / 過敏史】");
    lines.push(`- ${s.medsAllergy}`);
  }
  if (s.fhSh) {
    lines.push("");
    lines.push("【家族史 / 社會史】");
    lines.push(`- ${s.fhSh}`);
  }

  // 3) 病患體驗回饋（若有）
  if (s.satisfaction || s.recommend) {
    lines.push("");
    lines.push("【病患對 AI 預診流程的回饋】");
    if (s.satisfaction) {
      lines.push(`- 滿意度（病人原話）：${s.satisfaction}`);
    }
    if (s.recommend) {
      lines.push(`- 是否願意推薦他人使用：${s.recommend}`);
    }
  }

  // 4) 簡單的臨床思考方向（基於關鍵字的粗略提示，僅供參考）
  const textPool = [
    s.cc,
    s.hpi?.onset,
    s.hpi?.triggersReliefs,
    s.hpi?.qualityAndSite,
    s.hpi?.associated,
    s.ros,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  const systems: string[] = [];

  const pushOnce = (label: string) => {
    if (!systems.includes(label)) systems.push(label);
  };

  if (/(胸痛|胸悶|heart|chest)/.test(textPool)) {
    pushOnce("心血管系統（胸痛 / 胸悶相關）");
  }
  if (/(喘|呼吸|咳嗽|咳痰|shortness of breath|cough)/.test(textPool)) {
    pushOnce("呼吸系統（呼吸困難 / 咳嗽相關）");
  }
  if (/(腹痛|噁心|嘔吐|腹瀉|便祕|腹脹|diarrhea|constipation|abdominal)/.test(textPool)) {
    pushOnce("腸胃系統（腹痛 / 腸胃道症狀）");
  }
  if (/(頭痛|頭暈|麻木|無力|seizure|headache|dizzy)/.test(textPool)) {
    pushOnce("神經系統（頭痛 / 頭暈 / 神經學症狀）");
  }
  if (/(關節|膝|腰|背|肩|肌肉|扭到|拉傷|wrist|knee|back|shoulder)/.test(textPool)) {
    pushOnce("肌肉骨骼系統（關節 / 肌肉疼痛或外傷）");
  }
  if (/(血尿|頻尿|排尿困難|尿急|urine|urinary)/.test(textPool)) {
    pushOnce("泌尿系統（排尿相關症狀）");
  }
  if (/(發燒|fever|體重減輕|盜汗)/.test(textPool)) {
    pushOnce("全身性 / 感染性症候群（發燒 / 體重變化）");
  }

  if (systems.length) {
    lines.push("");
    lines.push("【初步臨床思考（系統層級，僅供參考）】");
    lines.push(
      "- 依目前文字資訊，問診可能較著重於以下系統評估（實際仍以醫師面診與理學檢查為準）："
    );
    for (const sys of systems) {
      lines.push(`  • ${sys}`);
    }
  }

  lines.push("");
  lines.push("【重要聲明】");
  lines.push(
    "以上內容僅為根據病人自述文字做的整理與思考方向提示，無法取代醫師面對面問診、理學檢查與完整臨床判斷；不得單獨視為正式診斷或治療建議。"
  );

  return lines.join("\n");
}

