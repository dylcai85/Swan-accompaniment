/** "build abc1234 · 2026-10-19 01:40 UTC" from a short commit id and an ISO timestamp. */
export function formatBuildStamp(id: string, isoTime: string): string {
  const d = new Date(isoTime);
  if (Number.isNaN(d.getTime())) return `build ${id}`;
  const time = d.toISOString().slice(0, 16).replace('T', ' ');
  return `build ${id} · ${time} UTC`;
}
