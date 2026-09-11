/** 목록 배지의 "N분 전" — i18n 키 + 인자만 돌려주고 문구는 호출자가 t() 로 만든다. */
export type RelativeTimeKey =
  "relJustNow" | "relMinutesAgo" | "relHoursAgo" | "relDaysAgo";

export function relativeTimeParts(
  iso: string,
  now: number = Date.now(),
): { key: RelativeTimeKey; count: number } {
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return { key: "relJustNow", count: 0 };
  const seconds = Math.max(0, Math.floor((now - then) / 1000));
  if (seconds < 60) return { key: "relJustNow", count: 0 };
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return { key: "relMinutesAgo", count: minutes };
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return { key: "relHoursAgo", count: hours };
  return { key: "relDaysAgo", count: Math.floor(hours / 24) };
}
