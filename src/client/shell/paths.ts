export function safeNextPath(value: string | null | undefined): string {
  if (!value) return "/";
  if (!value.startsWith("/") || value.startsWith("//") || /[\u0000-\u0020\u007f\\]/.test(value) || /%(?:0[0-9a-f]|1[0-9a-f]|20|7f|5c)/i.test(value)) return "/";
  try {
    const base = "https://pokeshowdown.invalid";
    const resolved = new URL(value, base);
    if (resolved.origin !== base) return "/";
    return `${resolved.pathname}${resolved.search}${resolved.hash}`;
  } catch {
    return "/";
  }
}
