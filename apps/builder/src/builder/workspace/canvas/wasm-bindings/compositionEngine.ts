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
}

/** Opaque handle to a layout node. */
export type LayoutNodeHandle = number;

/**
 * flat `[x0,y0,w0,h0, x1,...]` Float32Array 를 handle 순서대로 슬라이스해
 * `Map<handle, LayoutResult>` 로 재구성한다(handle 당 4값).
 */
function flatToLayoutMap(
  handles: number[],
  flat: Float32Array,
): Map<number, LayoutResult> {
  const result = new Map<number, LayoutResult>();
  for (let i = 0; i < handles.length; i++) {
    const off = i * 4;
    result.set(handles[i], {
      x: flat[off],
      y: flat[off + 1],
      width: flat[off + 2],
      height: flat[off + 3],
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
