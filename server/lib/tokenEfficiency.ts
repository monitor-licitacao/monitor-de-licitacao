const DEFAULT_MAX_CHARS = 12_000;

/**
 * Reduces prompt size before LLM calls. Works on single-line blobs (Regra 7.2):
 * truncation applies even when the input has no newline characters.
 */
export function filterKeywordsBeforeAI(
  text: string,
  keywords: string[] = [],
  maxChars: number = DEFAULT_MAX_CHARS
): string {
  if (!text) return '';

  const normalizedKeywords = keywords
    .map((keyword) => keyword.trim().toLowerCase())
    .filter(Boolean);

  const segments = text.includes('\n') ? text.split('\n') : [text];

  let filtered = segments;
  if (normalizedKeywords.length > 0) {
    const keywordMatches = segments.filter((segment) => {
      const lower = segment.toLowerCase();
      return normalizedKeywords.some((keyword) => lower.includes(keyword));
    });
    if (keywordMatches.length > 0) {
      filtered = keywordMatches;
    }
  }

  let result = filtered.join('\n');
  if (result.length > maxChars) {
    result = result.slice(0, maxChars);
  }
  return result;
}

export { DEFAULT_MAX_CHARS as TOKEN_EFFICIENCY_DEFAULT_MAX_CHARS };
