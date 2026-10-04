export interface LayoutResult {
  x: number;
  y: number;
  width: number;
  height: number;
  /**
   * border-box 상단 기준 in-flow baseline (ADR-923 Phase 2 — 엔진 출력 계약).
   * 원천 없는 노드는 엔진이 height(bottom 폴백, CSS 2.1 §10.8.1)로 해소해 내보낸다.
   * optional: 엔진 경유가 아닌 mock/합성 LayoutResult 는 생략 가능.
   */
  baseline?: number;
}

/** Opaque handle to a layout node. */
export type LayoutNodeHandle = number;

/**
 * 엔진 판정 트레이스 이벤트 (ADR-183 — 디버그 채널).
 *
 * Wire 계약은 Rust `trace.rs::TraceEvent` 의 internally-tagged serde JSON 과
 * 1:1 이다 — variant/필드 rename 은 양쪽 동시 갱신 (native 테스트
 * `tests/layout_trace.rs` 의 JSON 계약이 감시). 트레이스는 **엔진의 자기
 * 보고**이지 정합 oracle 이 아니다 — oracle 은 Chrome parity fixture (R4).
 */
type EngineTraceEvent = { measure_pass: boolean } & (
  | {
      type: "IncrementalSkip";
      reason: "Hit" | "NoPrev" | "Dirty" | "AvailChanged";
      avail: [number, number];
    }
  | {
      type: "UsedSizeClamp";
      axis: "Inline" | "Block";
      bound: "Min" | "Max";
      from: number;
      to: number;
    }
  | {
      type: "AutoMinFloor";
      item: number;
      source: "ContentMinScalar" | "ContentMainFallback" | "SpecifiedSizeMin";
      floor: number;
    }
  | { type: "ShrinkToFitReentry"; axis: "Inline" | "Block"; settled: number }
  | {
      type: "IntrinsicMeasure";
      hit: boolean;
      generation: number;
      min: number;
      max: number;
    }
  | {
      type: "FlexItemResolve";
      item: number;
      used_main: number;
      prev_avail: number;
    }
  | {
      type: "GridTrackResolve";
      stage: "Contribution" | "AutoStretch";
      axis: "Inline" | "Block";
      /** 미해소 트랙 토큰(Rust NAN)은 serde_json 이 null 로 내보낸다. */
      tracks: (number | null)[];
    }
);

/** 노드 1개의 트레이스 보고 (`tree.rs::trace_json` 스키마). */
export interface EngineTraceNode {
  handle: number;
  /** false 는 "게이트가 꺼져 있다" — "판정이 없었다"(events 빈 배열)와 구분. */
  enabled: boolean;
  /** 노드당 상한(MAX_EVENTS_PER_NODE) 초과로 버려진 개수. */
  dropped: number;
  events: EngineTraceEvent[];
}
