export function stripTags(input: string): string {
  return input.replace(/<[^>]*>/g, "");
}

export function sanitizeString(input: unknown, max = 256): string {
  if (typeof input !== "string") return "";
  const trimmed = input.trim();
  const clean = stripTags(trimmed).slice(0, max);
  return clean;
}

export function sanitizeDomain(input: unknown): string {
  const s = sanitizeString(input, 256).toLowerCase();
  // allow a-z 0-9 . - only
  const filtered = s.replace(/[^a-z0-9.-]/g, "");
  return filtered;
}

export function numericString(input: unknown, maxLen = 32): string {
  const s = typeof input === "string" ? input : String(input ?? "");
  return s.replace(/[^0-9+]/g, "").slice(0, maxLen);
}

