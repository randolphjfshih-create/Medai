
const blacklistPatterns = [
  /(診斷|判斷|我覺得你是|你應該是|看起來是).{0,10}(感冒|流感|心肌|中風|骨折|肺炎|腸胃炎|.*病)/i,
  /(吃|服用).{0,10}(藥|藥物|普拿疼|止痛藥|抗生素|消炎藥)/i,
  /(不用|先不要|不需要).{0,5}(看醫生|急診|就醫)/i,
  /(明天再|改天再|之後再).{0,8}(看|就醫|處理)/i,
];

const fallback = "這一部分需要醫師親自評估。我已經幫你把狀況記下來，等一下醫師會先看你的重點。如果此刻覺得症狀突然變得很嚴重（像是呼吸困難惡化、快昏倒、劇烈疼痛瞬間加劇），請立刻告知現場人員或尋求急救協助，這真的很重要。";

export function safetyFilter(text: string): string {
  if (!text) return fallback;
  for (const pattern of blacklistPatterns) {
    if (pattern.test(text)) return fallback;
  }
  return text;
}
