const SAFE_ABSOLUTE = /^https:\/\/[^\s<>"']+$/i;

export function safeImageSrc(raw: string, fallback: string): string {
  const value = raw.trim();
  if (!value) return fallback;
  if (/[\\\s<>"']/.test(value) || value.startsWith("//")) return fallback;
  if (value.startsWith("/")) return value;
  if (SAFE_ABSOLUTE.test(value)) return safeWebHref(value, fallback);
  return fallback;
}

export function safeWebHref(raw: string, fallback = ""): string {
  if (!SAFE_ABSOLUTE.test(raw.trim()) || raw.includes("\\")) return fallback;
  try {
    const url = new URL(raw.trim());
    return url.username || url.password ? fallback : url.href;
  } catch {
    return fallback;
  }
}
