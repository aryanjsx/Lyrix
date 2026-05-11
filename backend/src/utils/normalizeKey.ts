export function normalizeKey(raw: string): string {
  return raw.toLowerCase().trim().replace(/\s+/g, " ");
}
