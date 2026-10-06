/** Safe filename for the download attribute: display name only, never a path. */
export function safeDownloadName(fileName: string, fallback: string): string {
  const base = fileName.split(/[\\/]/).pop()?.trim() ?? "";
  if (base.length === 0 || base === "." || base === "..") return fallback;
  return base.slice(0, 180);
}
