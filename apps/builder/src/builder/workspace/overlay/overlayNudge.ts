/**
 * ADR-027 Phase D2 — 편집기 첫 줄 상자를 Skia paragraph 원점으로 맞춘다.
 *
 * Skia 는 마지막 프레임에 element-local 좌표로 텍스트를 그린 자리 (drawX · drawY,
 * 자식 텍스트 노드면 그 offset 포함) 를 기록한다 (`recordTextDrawOrigin`). 오버레이는
 * 마운트 직후 DOM 첫 줄 상자 (line box top · 첫 글리프 left, 컨테이너 기준 · zoom 전) 를
 * 재고 그 차를 root 의 relative 오프셋으로 둔다 — Skia 단일행 center 가 글리프 ink 상자를
 * 가운데 두고 DOM 이 line box 를 가운데 두어 생기는 1~2px 가 이 값이다. 세로는 baseline 끼리
 * (D3) — 같은 line box 안에서도 두 엔진의 half-leading 배분이 달라 글리프가 1px 갈린다.
 */

export interface TextDrawOrigin {
  x: number;
  y: number;
  /** 첫 줄 baseline 의 paragraph top 기준 오프셋 (Skia lineMetrics[0].baseline). */
  baseline?: number;
}

export interface DomFirstLine {
  /**
   * 첫 글리프 run 의 left (Range 첫 rect). Skia 쪽도 paragraph 원점 + 첫 줄 `left` 라
   * 글리프끼리 비교한다 — 상자 left 끼리 맞추면 폭이 다른 center 정렬이 어긋난다 (live:
   * Save 라벨 Skia 상자 42 vs DOM 44 → dx 1 로 중심이 밀림). 텍스트가 비어 있으면 null.
   */
  textLeft: number | null;
  /** 첫 line box top. */
  lineTop: number;
  /** 첫 줄 baseline 의 line box top 기준 오프셋 (inline-block 0×0 probe 로 잰다). */
  baseline?: number;
}

export interface OverlayNudge {
  dx: number;
  dy: number;
}

/** 이보다 크면 기록이 다른 상태 (다른 크기·줄 수) 의 것 — 그 축은 보정하지 않는다. */
export const MAX_OVERLAY_NUDGE = 8;

const round = (value: number): number => Math.round(value * 100) / 100;

const clamp = (delta: number): number =>
  Math.abs(delta) > MAX_OVERLAY_NUDGE ? 0 : round(delta);

export function resolveOverlayNudge(
  skia: TextDrawOrigin | null,
  dom: DomFirstLine,
): OverlayNudge | null {
  if (!skia) return null;
  // D3 — baseline 끼리 (있으면). line box top 이 같아도 half-leading 안에서 글리프 자리가 1px
  //   갈렸다 (Text 4줄 · Heading 28: shift dy −1 CSS px). 한쪽만 있으면 종전 line box top.
  const dy =
    skia.baseline != null && dom.baseline != null
      ? skia.y + skia.baseline - (dom.lineTop + dom.baseline)
      : skia.y - dom.lineTop;
  return {
    dx: dom.textLeft == null ? 0 : clamp(skia.x - dom.textLeft),
    dy: clamp(dy),
  };
}
