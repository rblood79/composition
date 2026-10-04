/**
 * ADR-211 — Canvas 의 **비활성 창 트랙** (breakdown §2.2 · §2.5).
 *
 * 창 모드에서 범주가 넘치면 두 leg 가 플롯 아래에 같은 높이 (`windowTrackHeight`) 를 예약한다.
 * DOM 은 거기에 뷰 상태 RAC `Slider` 를 얹고 (창 이동은 Preview/Publish 소유), Canvas 는 같은
 * 자리에 트랙 막대와 시작 위치 (창 0) 의 thumb 만 정적으로 그린다 — 빌더는 상호작용 표면이
 * 아니다. 치수는 shared `Slider` md 실측 (P0: 트랙 8 · thumb 18) 을 미러한 상수다.
 */
import { circlePath } from "./dots";
import { r2 } from "../scales";
import type { PathMark, Rect } from "../types";

/** 트랙 막대 높이 (shared Slider md `.slider-track-bg`) */
export const CHART_WINDOW_TRACK_BAR = 8;
/** thumb 지름 (shared Slider md `.react-aria-SliderThumb`) */
export const CHART_WINDOW_THUMB = 18;

function roundedBarPath(x: number, y: number, w: number, h: number): string {
  const r = h / 2;
  if (w <= h) return circlePath(x + w / 2, y + r, Math.min(r, w / 2));
  return [
    `M${x + r},${y}`,
    `H${x + w - r}`,
    `A${r},${r} 0 0 1 ${x + w - r},${y + h}`,
    `H${x + r}`,
    `A${r},${r} 0 0 1 ${x + r},${y}`,
    "Z",
  ].join(" ");
}

export interface WindowTrackRange {
  /** 창 시작 index */
  start: number;
  /** 창 끝 (exclusive) */
  end: number;
  /** 범주 수 — Slider `maxValue` (thumb 위치 = index / n) */
  n: number;
}

/**
 * 트랙 막대 (`grid` 토큰 채움) + 창 채움 (`axis`, thumb 사이 — shared Slider `.slider-fill`) + thumb 2
 * (`axis` 토큰 채움, ADR-216 — `[start, end]` 두 손잡이). 네 마크 모두 `fillRole` 이라 시리즈
 * 팔레트를 쓰지 않는다 — 데이터가 아니라 컨트롤의 자리다. thumb 위치는 Slider 와 같은 `index / n`.
 * `range` 미지정은 211 의 창 0 (`[0, 0]` — 채움 폭 0, thumb 둘이 겹친다 — 호출자가 항상 준다).
 */
export function buildWindowTrackMarks(
  track: Rect,
  range: WindowTrackRange = { start: 0, end: 0, n: 1 },
): PathMark[] {
  if (track.w <= 0 || track.h <= 0) return [];
  const cy = track.y + track.h / 2;
  const barH = Math.min(CHART_WINDOW_TRACK_BAR, track.h);
  const bar: PathMark = {
    kind: "path",
    d: roundedBarPath(track.x, cy - barH / 2, track.w, barH),
    bbox: { x: track.x, y: cy - barH / 2, w: track.w, h: barH },
    fillRole: "grid",
  };
  const n = Math.max(1, range.n);
  const at = (index: number): number =>
    r2(track.x + (track.w * Math.min(Math.max(0, index), n)) / n);
  const x0 = at(range.start);
  const x1 = at(range.end);
  const fill: PathMark = {
    kind: "path",
    d: roundedBarPath(x0, cy - barH / 2, Math.max(0, x1 - x0), barH),
    bbox: { x: x0, y: cy - barH / 2, w: r2(Math.max(0, x1 - x0)), h: barH },
    fillRole: "axis",
  };
  const r = Math.min(CHART_WINDOW_THUMB, track.h) / 2;
  const thumb = (x: number): PathMark => ({
    kind: "path",
    d: circlePath(x, cy, r),
    bbox: { x: r2(x - r), y: cy - r, w: r * 2, h: r * 2 },
    fillRole: "axis",
  });
  return [bar, fill, thumb(x0), thumb(x1)];
}
