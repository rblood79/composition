/**
 * composition-engine 동기 wrapper (ADR-916 Phase 2-B seam C-2a)
 *
 * 자체 레이아웃 엔진(`packages/composition-engine` 의 wasm-bindgen `LayoutEngine`)을
 * `LayoutEngineAPI`(layoutBridge.ts) 계약으로 노출한다. ADR-916 Taffy 완전 제거
 * (2026-07-06) 후 이 wrapper 가 `createLayoutEngine()` seam 의 유일 구현이다.
 *
 * ## 왜 얇은가
 *
 * 자체 pkg `LayoutEngine` 은 **이미 camelCase 16-메서드 = LayoutEngineAPI 이름 일치**
 * (wasm.rs `#[wasm_bindgen(js_name = ...)]` 로 계약 정합)라, 본 wrapper 는 이름 매핑
 * 없이 raw 반환(Uint32Array/Float32Array)만 number[]/Map 으로 변환한다.
 *
 * ## 동기 생성 (전역 캐시)
 *
 * 생성자는 `getCompositionEngineWasm()`(비동기 startup 로 미리 채워진 전역 캐시)에서
 * `new LayoutEngine()` 을 즉시 생성한다. WASM 미준비면 engine=null → isAvailable()
 * 이 lazy re-init.
 *
 */

import {
  getCompositionEngineWasm,
  isCompositionEngineReady,
  type RawCompositionLayoutEngine,
} from "./compositionEngineWasm";

/**
 * Computed layout result for a single node.
 * (구 taffyLayout.ts:166 — ADR-916 Taffy 완전 제거로 본 파일이 타입 소스)
 */
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
export type EngineTraceEvent = { measure_pass: boolean } & (
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

/**
 * flat `[x0,y0,w0,h0,b0, x1,...]` Float32Array 를 handle 순서대로 슬라이스해
 * `Map<handle, LayoutResult>` 로 재구성한다(ADR-923 Phase 2 — handle 당 **5값**,
 * b = baseline. 엔진 get_layouts_batch stride 와 반드시 일치해야 한다).
 */
function flatToLayoutMap(
  handles: number[],
  flat: Float32Array,
): Map<number, LayoutResult> {
  const result = new Map<number, LayoutResult>();
  for (let i = 0; i < handles.length; i++) {
    const off = i * 5;
    result.set(handles[i], {
      x: flat[off],
      y: flat[off + 1],
      width: flat[off + 2],
      height: flat[off + 3],
      baseline: flat[off + 4],
    });
  }
  return result;
}

/**
 * composition-engine 의 고수준 TypeScript wrapper.
 * API 는 `LayoutEngineAPI`(batch 계약)를 구현한다.
 */
export class CompositionEngineLayout {
  private engine: RawCompositionLayoutEngine | null = null;
  private initFailed = false;

  constructor() {
    this.tryInit();
  }

  /** 전역 캐시(startup 로 로드)에서 엔진 인스턴스 생성 시도. */
  private tryInit(): void {
    if (this.initFailed) return;
    if (!isCompositionEngineReady()) return;

    const mod = getCompositionEngineWasm();
    if (!mod?.LayoutEngine) return;

    try {
      this.engine = new mod.LayoutEngine();
    } catch (err) {
      this.initFailed = true;
      if (import.meta.env.DEV) {
        console.warn(
          "[CompositionEngineLayout] WASM engine 생성 실패, 폴백:",
          err,
        );
      }
      this.engine = null;
    }
  }

  /** 엔진 사용 가능 여부(미준비 시 lazy re-init). */
  isAvailable(): boolean {
    if (!this.engine && !this.initFailed && isCompositionEngineReady()) {
      this.tryInit();
    }
    return this.engine !== null;
  }

  // ── batch tree 구축 ──────────────────────────────────────────────────

  buildTreeBatch(nodesJson: string): number[] {
    if (!this.engine)
      throw new Error("CompositionEngineLayout: WASM engine not initialized");
    return Array.from(this.engine.buildTreeBatch(nodesJson));
  }

  buildTreeBatchBinary(data: Uint8Array): number[] {
    if (!this.engine)
      throw new Error("CompositionEngineLayout: WASM engine not initialized");
    return Array.from(this.engine.buildTreeBatchBinary(data));
  }

  /** 자체 엔진은 JSON 경로만 지원(binary protocol 미구현 → false). */
  hasBinaryProtocol(): boolean {
    if (!this.engine) return false;
    return this.engine.hasBinaryProtocol();
  }

  // ── 증분 갱신 ────────────────────────────────────────────────────────

  createNodeRaw(styleJson: string): LayoutNodeHandle {
    if (!this.engine)
      throw new Error("CompositionEngineLayout: WASM engine not initialized");
    return this.engine.createNodeRaw(styleJson);
  }

  updateStyleRaw(handle: LayoutNodeHandle, styleJson: string): void {
    if (!this.engine)
      throw new Error("CompositionEngineLayout: WASM engine not initialized");
    this.engine.updateStyleRaw(handle, styleJson);
  }

  setChildren(handle: LayoutNodeHandle, children: LayoutNodeHandle[]): void {
    if (!this.engine)
      throw new Error("CompositionEngineLayout: WASM engine not initialized");
    this.engine.setChildren(handle, new Uint32Array(children));
  }

  markDirty(handle: LayoutNodeHandle): void {
    if (!this.engine)
      throw new Error("CompositionEngineLayout: WASM engine not initialized");
    this.engine.markDirty(handle);
  }

  removeNode(handle: LayoutNodeHandle): void {
    if (!this.engine)
      throw new Error("CompositionEngineLayout: WASM engine not initialized");
    this.engine.removeNode(handle);
  }

  // ── 레이아웃 계산/수집 ────────────────────────────────────────────────

  computeLayout(
    root: LayoutNodeHandle,
    availableWidth: number,
    availableHeight: number,
  ): void {
    if (!this.engine)
      throw new Error("CompositionEngineLayout: WASM engine not initialized");
    this.engine.computeLayout(root, availableWidth, availableHeight);
  }

  getLayout(handle: LayoutNodeHandle): LayoutResult {
    if (!this.engine)
      throw new Error("CompositionEngineLayout: WASM engine not initialized");
    const json = this.engine.getLayout(handle);
    try {
      return JSON.parse(json) as LayoutResult;
    } catch {
      return { x: 0, y: 0, width: 0, height: 0 };
    }
  }

  getLayoutsBatch(
    handles: LayoutNodeHandle[],
  ): Map<LayoutNodeHandle, LayoutResult> {
    if (!this.engine)
      throw new Error("CompositionEngineLayout: WASM engine not initialized");
    const flat = this.engine.getLayoutsBatch(new Uint32Array(handles));
    return flatToLayoutMap(handles, flat);
  }

  // ── 판정 트레이스 (ADR-183 — 디버그 채널) ────────────────────────────

  /**
   * 트레이스 게이트 토글. 성공 시 true, 엔진 미준비면 false.
   *
   * 디버그 채널은 프로덕션 흐름을 깨면 안 되므로 다른 메서드와 달리 throw
   * 하지 않는다.
   */
  enableLayoutTrace(enabled: boolean): boolean {
    if (!this.engine) return false;
    this.engine.enableLayoutTrace(enabled);
    return true;
  }

  /** 노드 판정 트레이스 조회. 엔진 미준비/파싱 실패 시 null. */
  getLayoutTrace(handle: LayoutNodeHandle): EngineTraceNode | null {
    if (!this.engine) return null;
    try {
      return JSON.parse(this.engine.getLayoutTrace(handle)) as EngineTraceNode;
    } catch {
      return null;
    }
  }

  // ── 상태 ─────────────────────────────────────────────────────────────

  clear(): void {
    if (!this.engine)
      throw new Error("CompositionEngineLayout: WASM engine not initialized");
    this.engine.clear();
  }

  nodeCount(): number {
    if (!this.engine) return 0;
    return this.engine.nodeCount();
  }

  /** WASM 엔진 인스턴스 해제. dispose 시 호출. */
  dispose(): void {
    if (this.engine) {
      this.engine.free();
      this.engine = null;
    }
  }
}
