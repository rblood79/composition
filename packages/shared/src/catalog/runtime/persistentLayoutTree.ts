/**
 * PersistentLayoutTree
 *
 * 엔진 WASM 트리를 clear() 없이 유지하는 클래스 (구 `persistentTaffyTree.ts` — ADR-923 Phase 6 개명).
 *
 * 매번 clear() + buildTreeBatch() 로 다시 짓지 않고,
 * 변경된 노드만 updateStyleRaw() / setChildren()으로 갱신하여
 * 엔진 내부 dirty cache 를 최대한 활용한다.
 *
 * 변경 감지 전략:
 * - _lastJsonMap: style JSON 문자열 비교 — 같으면 WASM 호출 스킵
 * - childrenHashMap: childIds.join(',') 비교 → 동일하면 setChildren 스킵
 * 엔진은 dirty 플래그가 있는 서브트리만 재계산하므로 변경 없는 노드는 O(1) 스킵된다.
 *
 * 사용 흐름:
 * 1. buildFull() — 초기 전체 트리 구축 (buildTreeBatch 1회 WASM 호출)
 * 2. updateNodeStyle() / updateChildren() — 프레임 단위 증분 갱신
 * 3. addNode() / removeNode() — 요소 추가/제거
 * 4. computeLayout() — 레이아웃 재계산
 * 5. getLayoutsBatch() — 전체 결과 수집
 * 6. reset() — 페이지 전환 시 전체 초기화
 *
 * @see compositionRoot.ts — `styleOf` (style 직렬화기, 유일한 호출자)
 * @see engine.ts — EngineLayout.updateStyleRaw() / createNodeRaw()
 */

import type { LayoutEngineAPI } from "./layoutEngine";
import type { EngineTraceNode, LayoutResult } from "./engineTypes";
import type { EngineNodeHandle } from "./layoutTypes";
import { encodeBatchBinary } from "./binaryProtocol";
import type { BinaryBatchInput } from "./binaryProtocol";

// ─── 타입 정의 ────────────────────────────────────────────────────────

/**
 * buildFull()에 전달되는 배치 노드 항목.
 *
 * `{style, children}` 에 elementId 가 추가되어 handleMap 구성에 사용된다.
 */
export interface PersistentBatchNode {
  /** `styleOf` 결과 — 이미 정규화된 Record (길이는 "Npx" 문자열, JSON 직렬화 가능) */
  style: Record<string, unknown>;
  /** batch 배열 내 자식 인덱스 참조 (post-order DFS 순서 보장) */
  children: number[];
  /** handleMap 구성 및 레이아웃 결과 역매핑에 사용 */
  elementId: string;
}

// ─── 클래스 ───────────────────────────────────────────────────────────

/**
 * 엔진 WASM 트리를 persistent하게 유지하는 래퍼 클래스.
 *
 * 매 프레임 clear() 대신 변경 감지 기반 증분 갱신으로
 * 엔진 내부 dirty cache 를 최대한 활용한다.
 */
export class PersistentLayoutTree {
  /**
   * 레이아웃 엔진 (ADR-916 Phase 0-A seam).
   *
   * `createLayoutEngine()` factory 경유로 주입된다. ADR-916 Taffy 완전 제거
   * (2026-07-06) 후 factory 는 자체 엔진(engine)을 단독 반환하며,
   * 이 클래스는 factory 만 교체하면 수정 없이 꽂힌다.
   */
  private engine: LayoutEngineAPI;
  private rootHandle: EngineNodeHandle | null = null;

  /**
   * elementId → 엔진 node handle 매핑.
   * O(1) handle 조회 및 레이아웃 결과 매핑에 사용.
   */
  private handleMap = new Map<string, EngineNodeHandle>();

  /**
   * elementId → 마지막으로 WASM에 전달한 JSON.
   * JSON 문자열 비교를 수행하며, 동일하면 WASM 호출을 스킵한다.
   */
  private _lastJsonMap = new Map<string, string>();

  /**
   * elementId → childIds.join(',') 해시.
   * 자식 구조 변경 여부를 O(1)로 감지한다.
   */
  private childrenHashMap = new Map<string, string>();

  /**
   * @param engine - (테스트용) 주입할 레이아웃 엔진. 생략 시
   *   `createLayoutEngine()` factory 로 자체 엔진(engine)을 획득한다.
   */
  constructor(engine: LayoutEngineAPI) {
    this.engine = engine;
  }

  // ─── 상태 조회 ──────────────────────────────────────────────────────

  /**
   * buildFull()이 성공적으로 호출되어 rootHandle이 설정된 상태인지 확인.
   */
  get isInitialized(): boolean {
    return this.rootHandle !== null;
  }

  /**
   * WASM 엔진이 초기화되어 사용 가능한 상태인지 확인.
   */
  get isAvailable(): boolean {
    return this.engine.isAvailable();
  }

  // ─── 초기 트리 구축 ─────────────────────────────────────────────────

  /**
   * 전체 트리 초기 구축.
   *
   * post-order 순회 결과(batch)를 받아서
   * buildTreeBatch() 1회 WASM 호출로 전체 트리를 구축하고
   * handleMap / childrenHashMap / _lastJsonMap을 초기화한다.
   *
   * post-order 배열의 마지막 요소가 루트이므로 rootHandle = handles[last].
   *
   * @param rootElementId  - 루트 요소 ID (handles[last] 검증용)
   * @param batch          - DFS post-order BatchNode 배열 (리프 먼저, 루트 마지막)
   * @param filteredChildIds - elementId → 필터링된 자식 ID 배열
   *   (implicit style 적용 후 실제 렌더링 대상 자식만 포함)
   * @returns WASM에서 반환된 handle 배열 (batch와 동일 순서)
   */
  buildFull(
    rootElementId: string,
    batch: PersistentBatchNode[],
    filteredChildIds: Map<string, string[]>,
  ): EngineNodeHandle[] {
    // 1. WASM 호출 — binary protocol 사용 가능 시 TypedArray, 아니면 JSON fallback
    let handles: number[];
    if (this.engine.hasBinaryProtocol()) {
      const binaryInput: BinaryBatchInput[] = batch.map((n) => ({
        style: n.style,
        children: n.children,
      }));
      const binaryData = encodeBatchBinary(binaryInput);
      handles = this.engine.buildTreeBatchBinary(binaryData);
    } else {
      const batchPayload = batch.map((n) => ({
        style: n.style,
        children: n.children,
      }));
      handles = this.engine.buildTreeBatch(JSON.stringify(batchPayload));
    }

    // 1.5. handles 길이 검증 — WASM 반환값이 batch와 불일치하면 데이터 손상 방지
    if (handles.length !== batch.length) {
      console.error(
        `[PersistentLayoutTree] buildFull: handles 길이 불일치 (expected=${batch.length}, actual=${handles.length}). 트리 초기화 스킵.`,
      );
      return [];
    }

    // 2. 내부 맵 초기화 후 새 상태로 구성
    this.handleMap.clear();
    this.childrenHashMap.clear();
    this._lastJsonMap.clear();

    for (let i = 0; i < batch.length; i++) {
      const node = batch[i];
      this.handleMap.set(node.elementId, handles[i]);
      this._lastJsonMap.set(node.elementId, JSON.stringify(node.style));

      // childrenHashMap: filteredChildIds 기준 (implicit style 적용 후 실제 자식)
      const childIds = filteredChildIds.get(node.elementId);
      const childHash =
        childIds && childIds.length > 0 ? childIds.join(",") : "";
      this.childrenHashMap.set(node.elementId, childHash);
    }

    // post-order에서 루트는 항상 배열의 마지막 항목
    this.rootHandle = handles[handles.length - 1];

    if ((import.meta as ImportMeta & { env?: { DEV?: boolean } }).env?.DEV) {
      const rootNode = batch[batch.length - 1];
      if (rootNode && rootNode.elementId !== rootElementId) {
        console.warn(
          "[PersistentLayoutTree] buildFull: batch 마지막 요소가 rootElementId와 불일치.",
          { expected: rootElementId, actual: rootNode.elementId },
        );
      }
    }

    return handles;
  }

  // ─── 증분 갱신 ──────────────────────────────────────────────────────

  /**
   * 노드 스타일 증분 갱신.
   *
   * JSON 문자열 비교로 실제 변경 여부를 판단한다.
   * DFS 순회 중 계산되는 스타일은 부모/형제/자식 컨텍스트에 의존하므로,
   * Store 레벨 dirty tracking만으로는 모든 변경을 포착할 수 없다.
   * JSON 비교는 직렬화된 입력 전체를 비교하므로 의존 경로와 무관하게 정확하다.
   *
   * 엔진은 내부적으로 mark_dirty()를 호출하므로 다음 computeLayout()에서
   * 해당 노드와 조상 노드만 재계산된다.
   *
   * styleRecord는 `styleOf` 로 이미 정규화된 상태여야 한다.
   * (숫자 dimension이 "Npx" 문자열로 변환된 상태)
   *
   * @param elementId   - 업데이트할 요소 ID
   * @param styleRecord - `styleOf` 결과 (이미 정규화된 Record)
   * @returns true if 실제로 스타일이 변경되어 WASM 호출이 발생한 경우
   */
  updateNodeStyle(
    elementId: string,
    styleRecord: Record<string, unknown>,
  ): boolean {
    const handle = this.handleMap.get(elementId);
    if (handle === undefined) return false;

    // JSON 직렬화 + 비교 — 같으면 WASM 호출 스킵
    const json = JSON.stringify(styleRecord);
    const existingJson = this._lastJsonMap.get(elementId);

    if (existingJson === json) {
      return false;
    }

    // `styleOf` 결과는 이미 "Npx" 형식으로 정규화되어 있으므로
    // normalizeStyle() 이중 변환을 방지하기 위해 updateStyleRaw() 사용
    this.engine.updateStyleRaw(handle, json);
    this._lastJsonMap.set(elementId, json);
    return true;
  }

  /**
   * 노드와 조상을 명시적으로 dirty 마킹.
   * 자식 height 변경 시 부모 auto height 재계산을 강제한다.
   */
  markDirty(elementId: string): boolean {
    const handle = this.handleMap.get(elementId);
    if (handle === undefined) return false;
    this.engine.markDirty(handle);
    return true;
  }

  /**
   * 자식 구조 증분 갱신.
   *
   * childIds.join(',') 비교로 자식 추가/제거/순서 변경을 감지하고,
   * 변경된 경우에만 setChildren()을 호출한다.
   *
   * childIds에 포함된 elementId 중 handleMap에 없는 항목은 무시한다.
   * (addNode()로 먼저 노드를 생성해야 함)
   *
   * @param parentId  - 부모 요소 ID
   * @param childIds  - 필터링된 자식 ID 배열 (실제 렌더링 순서)
   * @returns true if 실제로 자식 구조가 변경되어 WASM 호출이 발생한 경우
   */
  updateChildren(parentId: string, childIds: string[]): boolean {
    const parentHandle = this.handleMap.get(parentId);
    if (parentHandle === undefined) return false;

    const hash = childIds.join(",");
    if (this.childrenHashMap.get(parentId) === hash) return false; // 변경 없음 → 스킵

    // handleMap에 존재하는 자식만 포함 (미등록 ID 방어)
    const childHandles = childIds
      .map((id) => this.handleMap.get(id))
      .filter((h): h is EngineNodeHandle => h !== undefined);

    this.engine.setChildren(parentHandle, childHandles);
    this.childrenHashMap.set(parentId, hash);
    return true;
  }

  // ─── 노드 추가/제거 ─────────────────────────────────────────────────

  /**
   * 새 노드를 트리에 추가.
   *
   * addNode() 후 반드시 부모의 updateChildren()을 호출하여
   * 트리 구조에 연결해야 한다.
   *
   * styleRecord는 `styleOf` 로 이미 정규화된 상태여야 한다.
   *
   * @param elementId   - 새 요소 ID
   * @param styleRecord - `styleOf` 결과 (이미 정규화된 Record)
   * @returns 생성된 엔진 node handle
   */
  addNode(
    elementId: string,
    styleRecord: Record<string, unknown>,
  ): EngineNodeHandle {
    const json = JSON.stringify(styleRecord);
    // normalizeStyle() 이중 변환 방지를 위해 createNodeRaw() 사용
    const handle = this.engine.createNodeRaw(json);
    this.handleMap.set(elementId, handle);
    this._lastJsonMap.set(elementId, json);
    // childrenHashMap은 updateChildren() 호출 시 설정
    return handle;
  }

  /**
   * 노드를 트리에서 제거.
   *
   * WASM 엔진에서 handle을 해제하고 내부 맵에서 모두 삭제한다.
   * 부모의 updateChildren()은 별도로 호출하여 참조를 제거해야 한다.
   *
   * 존재하지 않는 elementId는 무시된다.
   */
  removeNode(elementId: string): void {
    const handle = this.handleMap.get(elementId);
    if (handle === undefined) return;

    try {
      this.engine.removeNode(handle);
    } finally {
      // WASM 예외 시에도 내부 맵 정리 보장 — stale handle 방지
      this.handleMap.delete(elementId);
      this._lastJsonMap.delete(elementId);
      this.childrenHashMap.delete(elementId);
    }
  }

  // ─── 레이아웃 계산 / 결과 수집 ──────────────────────────────────────

  /**
   * 레이아웃 재계산.
   *
   * 엔진 내부 dirty cache 덕분에 변경되지 않은 서브트리는 자동으로 스킵된다.
   * updateNodeStyle() / updateChildren() / addNode() 로 dirty된 노드와
   * 그 조상 노드만 재계산하므로, 전체 트리 재계산 대비 O(변경된 노드 수)로 동작한다.
   *
   * @throws buildFull()이 아직 호출되지 않은 경우 Error
   */
  computeLayout(availableWidth: number, availableHeight: number): void {
    if (this.rootHandle === null) {
      throw new Error(
        "[PersistentLayoutTree] computeLayout: 트리가 초기화되지 않았습니다. buildFull()을 먼저 호출하세요.",
      );
    }
    this.engine.computeLayout(this.rootHandle, availableWidth, availableHeight);
  }

  /**
   * vw/vh 기준 viewport (border-box page 크기 = breakpoint). 엔진이 값 변화를 감지해
   * 다음 computeLayout 의 증분 skip 을 무효화한다.
   */
  setViewport(width: number, height: number): void {
    this.engine.setViewport(width, height);
  }

  /**
   * 전체 노드 레이아웃 결과를 일괄 수집.
   *
   * handleMap의 모든 handle에 대해 getLayoutsBatch()를 호출한다.
   * Float32Array 기반 배치 호출이므로 N번의 get_layout() 개별 호출보다 효율적이다.
   *
   * @returns handle → LayoutResult 매핑 (x, y, width, height)
   */
  getLayoutsBatch(): Map<EngineNodeHandle, LayoutResult> {
    const handles = Array.from(this.handleMap.values());
    return this.engine.getLayoutsBatch(handles);
  }

  /**
   * 요청된 elementId의 레이아웃 결과만 수집한다.
   *
   * `computeLayout()`은 여전히 persistent root에서 수행되어야 한다. 부모 used-size
   * 전파와 엔진 dirty-cache 경계를 이 메서드가 임의로 잘라서는 안 되기 때문이다.
   * 이 메서드는 계산 이후의 결과 전달만 O(k)로 제한하는 seam이며, 전체 문서
   * `getLayoutsBatch()`를 targeted publish 경로에서 호출하는 것을 금지하는 계약이다.
   * 등록되지 않은 ID는 fail-closed로 건너뛰고 중복 ID는 한 번만 요청한다.
   *
   * @param elementIds - 결과가 필요한 semantic element ID iterable
   * @returns elementId → LayoutResult 매핑
   */
  getLayoutsForIds(elementIds: Iterable<string>): Map<string, LayoutResult> {
    const requestedHandles: EngineNodeHandle[] = [];
    const elementIdsByHandle = new Map<EngineNodeHandle, string>();
    const seenElementIds = new Set<string>();

    for (const elementId of elementIds) {
      if (seenElementIds.has(elementId)) continue;
      seenElementIds.add(elementId);
      const handle = this.handleMap.get(elementId);
      if (handle === undefined || elementIdsByHandle.has(handle)) continue;
      requestedHandles.push(handle);
      elementIdsByHandle.set(handle, elementId);
    }

    if (requestedHandles.length === 0) return new Map();

    const layouts = this.engine.getLayoutsBatch(requestedHandles);
    const result = new Map<string, LayoutResult>();
    for (const [handle, layout] of layouts) {
      const elementId = elementIdsByHandle.get(handle);
      if (elementId !== undefined) result.set(elementId, layout);
    }
    return result;
  }

  // ─── 조회 유틸리티 ──────────────────────────────────────────────────

  /**
   * WASM 엔진에서 관리 중인 활성 노드 수.
   */
  nodeCount(): number {
    return this.engine.nodeCount();
  }

  // ─── 판정 트레이스 (ADR-183 — 디버그 채널) ──────────────────────────

  /**
   * 엔진 판정 트레이스 게이트 토글. 성공 시 true, 엔진 미준비/채널 미지원이면
   * false. **살아 있는 트리에 켜는 것이 채널의 존재 이유다** — 문제 노드를
   * fresh 트리로 다시 풀면 skip 게이트·측정 캐시를 타지 않아 캐시 계열 오진이
   * 사각이 된다 (ADR-183 Decision 1).
   */
  enableLayoutTrace(enabled: boolean): boolean {
    return this.engine.enableLayoutTrace?.(enabled) ?? false;
  }

  /**
   * elementId 의 판정 트레이스 조회 (handleMap 경유 element id → handle 변환).
   * 미등록 element / 게이트 미지원이면 null. 판독 포맷은 Phase 3 헬퍼 소관 —
   * 여기는 wire 스키마(`EngineTraceNode`) 그대로 돌려준다.
   */
  getLayoutTraceForElement(elementId: string): EngineTraceNode | null {
    const handle = this.handleMap.get(elementId);
    if (handle === undefined) return null;
    return this.engine.getLayoutTrace?.(handle) ?? null;
  }

  // ─── 초기화 / 정리 ──────────────────────────────────────────────────

  /**
   * 전체 트리 초기화.
   *
   * 페이지 전환 등 완전히 새로운 트리가 필요한 경우 호출한다.
   * WASM 엔진의 clear()와 내부 맵을 모두 초기화한다.
   * 이후 buildFull()을 다시 호출해야 한다.
   */
  reset(): void {
    if (this.engine.isAvailable()) {
      this.engine.clear();
    }
    this.rootHandle = null;
    this.handleMap.clear();
    this._lastJsonMap.clear();
    this.childrenHashMap.clear();
  }
}
