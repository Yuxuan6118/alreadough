/**
 * The AI used to write "用户" / "the user" in the summary and memories she reads. Shown with her own name instead
 * (the stored text is left as it was). Without a name the text is shown unchanged.
 */
export function withHerName(text: string, name: string) {
  const own = name.trim();
  if (!own || !text) return text;
  return text.replace(/用户/g, own).replace(/\b[Tt]he user's\b/g, `${own}'s`).replace(/\b[Tt]he user\b/g, own);
}
