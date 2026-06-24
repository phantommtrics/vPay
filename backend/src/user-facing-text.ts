/** Strip third-party provider names from text shown in the app. */
export function sanitizeUserFacingText(text: string | null | undefined): string | null {
  if (!text) return text ?? null;

  return text
    .replace(/\bstripe\b/gi, 'card')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([,.!?])/g, '$1')
    .trim();
}
