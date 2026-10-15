/**
 * 등간격 스냅 (sequence) 탐색 비용 · 동치.
 *
 * 2026-10-15 측정: 평평한 5,000 시드 격자 (같은 열 형제 ≈ 830) 에서 drag p95 750 ms · long task
 * 188 회 — `resolveAxisSpacingSnap` 의 sequence 탐색이 쌍 (i, j) 마다 다른 이웃 k 를 전부 훑는
 * O(r³) 였다. 안쪽 k 루프는 함수 호출이 없어 호출 수 ratchet 이 못 잡으므로 여기서 막는다.
 *
 * 동치 오라클은 수정 전 구현을 그대로 옮긴 것이다 (`referenceAxisSpacingSnap`) — 결과 · 동률 순서
 * (먼저 나온 제안이 이긴다) 까지 같아야 한다.
 */
import { describe, expect, it } from "vitest";
import {
  resolveAxisSpacingSnap,
  resolveSnappedPosition,
  type SnapCandidateRect,
} from "./snapGuides";

const LINE_MATCH_EPS = 0.5;

// ── 수정 전 구현 (snapGuides.ts 4186aa59a 기준, 그대로) ──────────────────────────
interface Proj {
  lo: number;
  hi: number;
  orthoLo: number;
  orthoHi: number;
}
type Spacing = NonNullable<ReturnType<typeof resolveAxisSpacingSnap>>;
function project(c: SnapCandidateRect, axis: "x" | "y"): Proj {
  return axis === "x"
    ? { lo: c.x, hi: c.x + c.width, orthoLo: c.y, orthoHi: c.y + c.height }
    : { lo: c.y, hi: c.y + c.height, orthoLo: c.x, orthoHi: c.x + c.width };
}
function consider(best: Spacing | null, p: Spacing, threshold: number) {
  if (Math.abs(p.delta) > threshold) return best;
  if (!best || Math.abs(p.delta) < Math.abs(best.delta)) return p;
  return best;
}
function referenceAxisSpacingSnap(
  axis: "x" | "y",
  rawMin: number,
  movingLen: number,
  rawOrthoLo: number,
  rawOrthoHi: number,
  candidates: readonly SnapCandidateRect[],
  threshold: number,
): Spacing | null {
  const row: Proj[] = [];
  for (const c of candidates) {
    const p = project(c, axis);
    if (Math.min(p.orthoHi, rawOrthoHi) - Math.max(p.orthoLo, rawOrthoLo) > 0)
      row.push(p);
  }
  if (row.length === 0) return null;
  const rawCenter = rawMin + movingLen / 2;
  let best: Spacing | null = null;
  let left: Proj | null = null;
  let right: Proj | null = null;
  for (const p of row) {
    if (p.hi <= rawCenter && (!left || p.hi > left.hi)) left = p;
    if (p.lo >= rawCenter && (!right || p.lo < right.lo)) right = p;
  }
  if (left && right && right.lo - left.hi > movingLen) {
    const gap = (right.lo - left.hi - movingLen) / 2;
    const target = left.hi + gap;
    best = consider(
      best,
      {
        delta: target - rawMin,
        value: gap,
        segments: [
          { start: left.hi, end: target },
          { start: target + movingLen, end: right.lo },
        ],
        neighborOrtho: [
          { lo: left.orthoLo, hi: left.orthoHi },
          { lo: right.orthoLo, hi: right.orthoHi },
        ],
      },
      threshold,
    );
  }
  for (let i = 0; i < row.length; i++) {
    for (let j = 0; j < row.length; j++) {
      if (i === j) continue;
      const a = row[i];
      const b = row[j];
      const gap = b.lo - a.hi;
      if (gap < 0) continue;
      let blocked = false;
      for (let k = 0; k < row.length; k++) {
        if (k === i || k === j) continue;
        const c = row[k];
        if (c.lo >= a.hi - LINE_MATCH_EPS && c.hi <= b.lo + LINE_MATCH_EPS) {
          blocked = true;
          break;
        }
      }
      if (blocked) continue;
      const neighborOrtho = [
        { lo: a.orthoLo, hi: a.orthoHi },
        { lo: b.orthoLo, hi: b.orthoHi },
      ];
      const afterTarget = b.hi + gap;
      best = consider(
        best,
        {
          delta: afterTarget - rawMin,
          value: gap,
          segments: [
            { start: a.hi, end: b.lo },
            { start: b.hi, end: afterTarget },
          ],
          neighborOrtho,
        },
        threshold,
      );
      const beforeTarget = a.lo - gap - movingLen;
      best = consider(
        best,
        {
          delta: beforeTarget - rawMin,
          value: gap,
          segments: [
            { start: beforeTarget + movingLen, end: a.lo },
            { start: a.hi, end: b.lo },
          ],
          neighborOrtho,
        },
        threshold,
      );
    }
  }
  return best;
}

// ── 결정적 난수 (mulberry32) ─────────────────────────────────────────────
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 0.25 격자 좌표 — EPS (0.5) 경계 · 0 폭 · 겹침 · 중복 rect 가 자주 나오게 */
function randomCase(seed: number) {
  const r = rng(seed);
  const q = (max: number) => Math.round(r() * max * 4) / 4;
  const n = 1 + Math.floor(r() * 14);
  const candidates: SnapCandidateRect[] = [];
  for (let i = 0; i < n; i++) {
    if (i > 0 && r() < 0.1) {
      candidates.push({ ...candidates[Math.floor(r() * i)], id: `d${i}` });
      continue;
    }
    candidates.push({
      id: `c${i}`,
      x: q(120),
      y: q(120),
      width: r() < 0.1 ? q(1) : q(40),
      height: r() < 0.1 ? q(1) : q(40),
    });
  }
  return {
    axis: (r() < 0.5 ? "x" : "y") as "x" | "y",
    rawMin: q(140) - 10,
    movingLen: r() < 0.1 ? 0 : q(30),
    orthoLo: q(100),
    orthoSpan: q(60),
    candidates,
    threshold: r() < 0.2 ? 0.5 : q(40),
  };
}

describe("등간격 스냅 sequence — 탐색 비용 · 동치", () => {
  it("수정 전 구현과 결과 · 동률 순서까지 같다 (무작위 4,000 건)", () => {
    let snapped = 0;
    for (let seed = 1; seed <= 4000; seed++) {
      const c = randomCase(seed);
      const args = [
        c.axis,
        c.rawMin,
        c.movingLen,
        c.orthoLo,
        c.orthoLo + c.orthoSpan,
        c.candidates,
        c.threshold,
      ] as const;
      const expected = referenceAxisSpacingSnap(...args);
      if (expected) snapped += 1;
      expect(resolveAxisSpacingSnap(...args), `seed ${seed}`).toEqual(expected);
    }
    // 오라클이 대부분 null 이면 동치가 빈 말이 된다 — 흡착이 실제로 일어나는 사례가 충분해야 한다
    expect(snapped).toBeGreaterThan(1000);
  });

  it("같은 열에 2,000 개가 쌓여도 한 번의 판정이 200 ms 안 (O(r³) 재발 방지)", () => {
    // 평평한 시드 격자의 한 열: 폭 160 · 높이 60 · 세로 간격 20
    const candidates: SnapCandidateRect[] = Array.from(
      { length: 2000 },
      (_, i) => ({ id: `n${i}`, x: 0, y: i * 80, width: 160, height: 60 }),
    );
    const started = performance.now();
    const result = resolveSnappedPosition(
      { x: 3, y: 2000 * 80 + 5 },
      { width: 160, height: 60 },
      candidates,
      8,
    );
    const elapsed = performance.now() - started;
    // 마지막 칸 아래 같은 간격 (20) 자리로 흡착 — 기능이 그대로인지도 같이 본다
    expect(result.position.y).toBe(2000 * 80);
    expect(elapsed).toBeLessThan(200);
  });
});
