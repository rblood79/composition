/**
 * ADR-916 Phase 2-B seam 배선 (B2) — 실제 WASM 엔진 dual-load 어댑터
 *
 * `dualRunHarness.runDualLayout` 은 두 `LayoutEngineAPI` 인스턴스를 받는다.
 * 지금까지 `dualRunHarness.test.ts` 는 **mock**(주입 layoutFn)으로 diff 산술만
 * 검증했다 — 실제 두 WASM 엔진(자체 composition-engine vs 현행 Taffy)을 로드해
 * 같은 batch 를 먹이는 경로는 미구축이었다.
 *
 * 본 모듈은 그 미구축 경로를 채운다. 두 pkg 의 **raw wasm-bindgen 산출물**을
 * `LayoutEngineAPI` 계약(`number[]` / `Map<number, LayoutResult>`)으로 어댑트하는
 * 얇은 wrapper 를 제공한다.
 *
 * ## 왜 raw 어댑트가 필요한가
 *
 * - 자체 엔진(`LayoutEngine`)은 camelCase(LayoutEngineAPI 계약 그대로)지만 반환이
 *   raw `Uint32Array` / `Float32Array` 다. → `number[]` / `Map` 재구성 필요.
 * - Taffy 엔진(`TaffyLayoutEngine`)은 snake_case(`build_tree_batch` 등) + raw 반환.
 *   → 이름 매핑 + 타입 재구성 필요. (런타임에선 `taffyLayout.ts::TaffyLayout` 이
 *   이 역할을 하지만, 그건 전역 `getRustWasm()` 의존이라 vitest 에서 미가용 →
 *   테스트 fixture 전용 어댑터를 별도로 둔다.)
 *
 * ## pkg 의존 (빌드 산출물)
 *
 * 두 pkg(`packages/composition-engine/pkg`, `wasm-bindings/pkg`)는 gitignore 된
 * wasm-pack 산출물이다. 본 모듈을 소비하는 테스트는 pkg 존재를 전제하며,
 * vitest 가 `.wasm` 을 ES 모듈로 로드하려면 `vite-plugin-wasm` 이 vitest.config 에
 * 등록되어 있어야 한다(런타임 앱과 동일 `--target bundler` 산출물).
 *
 * ## seam 미배선 유지
 *
 * 본 모듈은 **테스트 fixture 전용**이다. createLayoutEngine seam(layoutBridge.ts)
 * 에 자체 엔진을 배선하지 않는다 — dual-run self-diff 0 통과가 flag 전환의 전제
 * (no-dormant-foundation-ahead-of-flip). 본 모듈은 그 self-diff 를 **측정**만 한다.
 */

import type { LayoutEngineAPI } from "../../wasm-bindings/layoutBridge";
import type { LayoutResult } from "../../wasm-bindings/taffyLayout";

/** raw wasm-bindgen 자체 엔진(`LayoutEngine`) 인스턴스의 최소 형태. */
interface RawSelfEngine {
  isAvailable(): boolean;
  buildTreeBatch(nodesJson: string): Uint32Array;
  buildTreeBatchBinary(data: Uint8Array): Uint32Array;
  hasBinaryProtocol(): boolean;
  createNodeRaw(styleJson: string): number;
  updateStyleRaw(handle: number, styleJson: string): void;
  setChildren(handle: number, children: Uint32Array): void;
  markDirty(handle: number): void;
  removeNode(handle: number): void;
  computeLayout(root: number, availW: number, availH: number): void;
  getLayoutsBatch(handles: Uint32Array): Float32Array;
  clear(): void;
  nodeCount(): number;
}

/** raw wasm-bindgen Taffy 엔진(`TaffyLayoutEngine`) 인스턴스의 최소 형태. */
interface RawTaffyEngine {
  build_tree_batch(nodesJson: string): Uint32Array;
  build_tree_batch_binary(data: Uint8Array): Uint32Array;
  create_node(styleJson: string): number;
  update_style(handle: number, styleJson: string): void;
  set_children(handle: number, children: Uint32Array): void;
  mark_dirty(handle: number): void;
  remove_node(handle: number): void;
  compute_layout(root: number, availW: number, availH: number): void;
  get_layouts_batch(handles: Uint32Array): Float32Array;
  clear(): void;
  node_count(): number;
}

/**
 * flat `[x0,y0,w0,h0, x1,...]` Float32Array 를 handle 순서대로 슬라이스해
 * `Map<handle, LayoutResult>` 로 재구성한다. (taffyLayout.ts::getLayoutsBatch 와
 * 동일 규약 — handle 당 4값.)
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
 * 자체 엔진(`LayoutEngine`, camelCase + raw 반환)을 `LayoutEngineAPI` 로 어댑트.
 * 이름은 이미 일치하므로 raw `Uint32Array`/`Float32Array` → `number[]`/`Map` 변환만.
 */
export function adaptSelfEngine(raw: RawSelfEngine): LayoutEngineAPI {
  return {
    isAvailable: () => raw.isAvailable(),
    buildTreeBatch: (nodesJson) => Array.from(raw.buildTreeBatch(nodesJson)),
    buildTreeBatchBinary: (data) => Array.from(raw.buildTreeBatchBinary(data)),
    hasBinaryProtocol: () => raw.hasBinaryProtocol(),
    createNodeRaw: (styleJson) => raw.createNodeRaw(styleJson),
    updateStyleRaw: (handle, styleJson) =>
      raw.updateStyleRaw(handle, styleJson),
    setChildren: (handle, children) =>
      raw.setChildren(handle, new Uint32Array(children)),
    markDirty: (handle) => raw.markDirty(handle),
    removeNode: (handle) => raw.removeNode(handle),
    computeLayout: (root, availW, availH) =>
      raw.computeLayout(root, availW, availH),
    getLayoutsBatch: (handles) =>
      flatToLayoutMap(handles, raw.getLayoutsBatch(new Uint32Array(handles))),
    clear: () => raw.clear(),
    nodeCount: () => raw.nodeCount(),
  };
}

/**
 * Taffy 엔진(`TaffyLayoutEngine`, snake_case + raw 반환)을 `LayoutEngineAPI` 로
 * 어댑트. 이름 매핑(snake→camel) + raw 타입 재구성.
 *
 * hasBinaryProtocol 은 `build_tree_batch_binary` 메서드 존재로 판정
 * (taffyLayout.ts::hasBinaryProtocol 규약과 동일).
 */
export function adaptTaffyEngine(raw: RawTaffyEngine): LayoutEngineAPI {
  return {
    isAvailable: () => true,
    buildTreeBatch: (nodesJson) => Array.from(raw.build_tree_batch(nodesJson)),
    buildTreeBatchBinary: (data) =>
      Array.from(raw.build_tree_batch_binary(data)),
    hasBinaryProtocol: () => typeof raw.build_tree_batch_binary === "function",
    createNodeRaw: (styleJson) => raw.create_node(styleJson),
    updateStyleRaw: (handle, styleJson) => raw.update_style(handle, styleJson),
    setChildren: (handle, children) =>
      raw.set_children(handle, new Uint32Array(children)),
    markDirty: (handle) => raw.mark_dirty(handle),
    removeNode: (handle) => raw.remove_node(handle),
    computeLayout: (root, availW, availH) =>
      raw.compute_layout(root, availW, availH),
    getLayoutsBatch: (handles) =>
      flatToLayoutMap(handles, raw.get_layouts_batch(new Uint32Array(handles))),
    clear: () => raw.clear(),
    nodeCount: () => raw.node_count(),
  };
}
