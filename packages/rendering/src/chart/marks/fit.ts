/** ADR-306 — 최소제곱 직선 (scatter 추세선 · 주석 trend 가 같이 쓴다). */
/** 최소제곱 직선 (ztd `linearFit`) — 점이 둘 미만이거나 x 가 모두 같으면 null. */
export function linearFit(
  pts: readonly { x: number; y: number }[],
): { slope: number; at: (x: number) => number } | null {
  const n = pts.length;
  if (n < 2) return null;
  let mx = 0;
  let my = 0;
  for (const q of pts) {
    mx += q.x;
    my += q.y;
  }
  mx /= n;
  my /= n;
  let sxy = 0;
  let sxx = 0;
  for (const q of pts) {
    sxy += (q.x - mx) * (q.y - my);
    sxx += (q.x - mx) ** 2;
  }
  if (!(sxx > 0)) return null;
  const slope = sxy / sxx;
  return { slope, at: (x) => my + slope * (x - mx) };
}
