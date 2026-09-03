export type NamePolicyLang = "zh" | "en";

const blockedPatterns: Array<{ pattern: RegExp; reason: "hate" | "sexual_minor" | "sexual_violence" | "threat" | "impersonation" }> = [
  { pattern: /(儿童色情|幼童色情|未成年性奴|child\s*(porn|sexual)|minor\s*(porn|sexual)|pedo(phile)?)/i, reason: "sexual_minor" },
  { pattern: /(强奸犯|迷奸|性侵者|rapist|date\s*rape)/i, reason: "sexual_violence" },
  { pattern: /(杀了你|杀人犯|恐怖分子|kill\s*you|murderer|terrorist)/i, reason: "threat" },
  { pattern: /(支那|黑鬼|尼哥|nigg(er|a)|chink|faggot|kike)/i, reason: "hate" },
  { pattern: /(官方客服|公安局官方|法院官方|政府官方|official\s*(police|government|court|support))/i, reason: "impersonation" },
];

export function validateSpName(value: string, lang: NamePolicyLang) {
  const clean = value.normalize("NFKC").trim();
  if (!clean) return lang === "zh" ? "请先填写一个称呼。" : "Add a name or nickname first.";
  if ([...clean].length > 24) return lang === "zh" ? "称呼最多 24 个字符。" : "Use 24 characters or fewer.";
  if (/https?:\/\/|www\.|@\w+|\b\d{7,}\b/i.test(clean)) {
    return lang === "zh" ? "称呼中不能包含网址、账号或长串联系方式。" : "Names cannot contain URLs, handles, or long contact numbers.";
  }
  const blocked = blockedPatterns.find((entry) => entry.pattern.test(clean));
  if (!blocked) return "";
  const messages = lang === "zh" ? {
    hate: "这个称呼包含针对群体的仇恨侮辱词，请换一个。",
    sexual_minor: "这个称呼涉及未成年人性剥削内容，不能使用。",
    sexual_violence: "这个称呼包含性暴力称谓，不能使用。",
    threat: "这个称呼包含明确暴力威胁或恐怖主义称谓，不能使用。",
    impersonation: "这个称呼可能冒充政府、司法或平台官方身份，不能使用。",
  } : {
    hate: "This name contains a targeted hate slur. Choose another name.",
    sexual_minor: "Names involving sexual exploitation of minors are not allowed.",
    sexual_violence: "Names containing sexual-violence labels are not allowed.",
    threat: "Names containing explicit violent threats or terrorist labels are not allowed.",
    impersonation: "This name may impersonate an official government, court, police, or support identity.",
  };
  return messages[blocked.reason];
}
