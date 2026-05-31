export function parseMentionId(text: string): string | undefined {
  return text.match(/\[@[^\]]*\]\(root:\/\/user\/([^)]+)\)/)?.[1];
}

// Splits a trailing @mention off the end of a string.
// Returns [textWithoutMention, userId | undefined]
export function extractTrailingMention(text: string): [string, string | undefined] {
  const m = text.match(/^(.*)\s+\[@[^\]]*\]\(root:\/\/user\/([^)]+)\)\s*$/);
  if (!m) return [text.trim(), undefined];
  return [m[1].trim(), m[2]];
}
