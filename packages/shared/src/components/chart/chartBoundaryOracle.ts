import type { PathMark, RectMark } from "@composition/specs";
const clouds = new Map<string, DOMPoint[]>();
/** 독립 브라우저 측정: 서로 다른 경로 순서에도 대응하도록 경계 거리를 대조한다. */
function cloud(path: SVGPathElement, count: number, filled = false): Array<DOMPoint> {
  const cacheKey = `${path.getAttribute("d")}:${path.getAttribute("fill-rule")}:${filled}:${count}`;
  const cached = clouds.get(cacheKey);
  if (cached) return cached;
  const length = path.getTotalLength();
  const samples = Array.from({length: count + 1}, (_, i) => path.getPointAtLength(length * i / count));
  const points = samples.map((point, i) => {
    if (!filled) return point;
    const before = samples[Math.max(0, i - 1)];
    const after = samples[Math.min(count, i + 1)];
    const dx = after.x - before.x, dy = after.y - before.y;
    const magnitude = Math.hypot(dx, dy);
    if (!magnitude) return point;
    // 완전한 링의 연결선/서브픽셀 틈은 채움 외곽이 아니다.
    // 접선의 양쪽 0.25px가 모두 채워져 있으면 내부 연결선으로 제외한다.
    const nx = -dy / magnitude * 0.25, ny = dx / magnitude * 0.25;
    return path.isPointInFill(new DOMPoint(point.x + nx, point.y + ny)) &&
      path.isPointInFill(new DOMPoint(point.x - nx, point.y - ny)) ? null : point;
  }).filter((point): point is DOMPoint => point !== null);
  clouds.set(cacheKey, points);
  return points;
}

export function compareBoundaries(
  actual: SVGPathElement,
  expected: PathMark | RectMark,
): number {
  const reference = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "path",
  );
  reference.setAttribute(
    "d",
    expected.kind === "path"
      ? expected.d
      : `M${expected.x},${expected.y}h${expected.w}v${expected.h}h${-expected.w}Z`,
  );
  if (expected.kind === "path" && expected.fillRule) reference.setAttribute("fill-rule", expected.fillRule);
  // 완전한 링의 outer→inner 연결선은 채움 내부다. 도형 외곽이 아닌 이 선은 제외한다.
  const filled = expected.kind === "rect" || expected.fillSeries !== undefined || expected.fillRole !== undefined;
  const a = cloud(actual, 1600, filled);
  const b = cloud(reference, 1600, filled);
  if (!a.length || !b.length) return Infinity;
  const distance = (sample: DOMPoint[], target: DOMPoint[]): number =>
    Math.max(
      ...sample
        .filter((_, i) => i % 40 === 0)
        .map((p) =>
          Math.min(...target.map((q) => Math.hypot(p.x - q.x, p.y - q.y))),
        ),
    );
  return Math.max(distance(a, b), distance(b, a));
}

