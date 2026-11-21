// Web addresses in a letter become links, both in the in-app 来信 and in the email.
// Only http(s) addresses count, plus a bare "alreadough.com/..." (read as https). Closing punctuation stays text.
const ADDRESS = /(https?:\/\/[^\s<>"'，。！？、；：（）【】「」《》]+|(?<![\w./@])alreadough\.com(?:\/[^\s<>"'，。！？、；：（）【】「」《》]*)?)/gi;
const TRAILING = /[.,!?;:)\]]+$/;

export type LetterPart = { text: string; href?: string };

export function letterParts(line: string): LetterPart[] {
  const parts: LetterPart[] = [];
  let last = 0;
  for (const match of line.matchAll(ADDRESS)) {
    const start = match.index ?? 0;
    const raw = match[0];
    const address = raw.replace(TRAILING, "");
    if (start > last) parts.push({ text: line.slice(last, start) });
    parts.push({ text: address, href: /^https?:\/\//i.test(address) ? address : `https://${address}` });
    last = start + address.length;
  }
  if (last < line.length) parts.push({ text: line.slice(last) });
  return parts;
}
