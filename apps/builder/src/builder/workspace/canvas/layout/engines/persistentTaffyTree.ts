/**
 * PersistentTaffyTree
 *
 * WASM Taffy 트리를 clear() 없이 유지하는 클래스.
 *
 * fullTreeLayout.ts의 매 프레임 clear() + buildTreeBatch() 패턴과 달리,
 * 변경된 노드만 updateStyleRaw() / setChildren()으로 갱신하여
 * Taffy internal dirty cache를 최대한 활용한다.
 *
 * 변경 감지 전략:
 * - _lastJsonMap: JSON 문자열 비교로 간접 의존성 변경까지 포착 (부모/형제 변경 → enrichment/display adapter 결과)
 * - childrenHashMap: childIds.join(',') 비교 → 동일하면 setChildren 스킵
 * Taffy는 dirty 플래그가 있는 서브트리만 재계산하므로 변경 없는 노드는 O(1) 스킵된다.
 *
 * 사용 흐름:
 * 1. buildFull() — 초기 전체 트리 구축 (buildTreeBatch 1회 WASM 호출)
 * 2. updateNodeStyle() / updateChildren() — 프레임 단위 증분 갱신
 * 3. addNode() / removeNode() — 요소 추가/제거
 * 4. computeLayout() — 레이아웃 재계산
 * 5. getLayoutsBatch() — 전체 결과 수집
 * 6. reset() — 페이지 전환 시 전체 초기화
 *
 * @see fullTreeLayout.ts — BatchNode 타입, taffyStyleToRecord() 결과 형식
 * @see compositionEngine.ts — CompositionEngineLayout.updateStyleRaw() / createNodeRaw()
 */

import { createLayoutEngine } from "../../wasm-bindings/layoutBridge";
import type { LayoutEngineAPI } from "../../wasm-bindings/layoutBridge";
import type {
  EngineTraceNode,
  LayoutResult,
} from "../../wasm-bindings/compositionEngine";
import type { TaffyNodeHandle } from "../../wasm-bindings/layoutTypes";
import { encodeBatchBinary } from "../../wasm-bindings/binaryProtocol";
import type { BinaryBatchInput } from "../../wasm-bindings/binaryProtocol";

// ─── 타입 정의 ────────────────────────────────────────────────────────

/**
 * buildFull()에 전달되는 배치 노드 항목.
 *
 * fullTreeLayout.ts의 BatchNode 인터페이스와 동일한 형태이며,
 * elementId 필드가 추가되어 handleMap 구성에 사용된다.
 */
export interface PersistentBatchNode {
  /** taffyStyleToRecord() 결과 — 이미 정규화된 Record (JSON 직렬화 가능) */
  style: Record<string, unknown>;
  /** batch 배열 내 자식 인덱스 참조 (post-order DFS 순서 보장) */
  children: number[];
  /** handleMap 구성 및 레이아웃 결과 역매핑에 사용 */
  elementId: string;
  /**
   * 이 노드를 `enrichWithIntrinsicSize` 에 넘길 때 쓴 available width.
   *
   * Step 4.5(height-for-width 재측정)는 "enrichment 가 어떤 폭을 가정했는가" 와 실배치
   * 폭을 비교해 재측정 여부를 정한다. 그 가정 폭을 style 로부터 **역추정**하면 grid
   * 자식에서 어긋난다 — grid 는 부모 폭이 아니라 **트랙 추정폭**을 넘기기 때문이다.
   * 어긋나면 "어느 폭에서도 단일줄" skip 이 잘못 발동해, 좁은 추정폭에서 계산된 2줄
   * 높이가 그대로 굳는다 (실측 `1fr auto`/400: DOM 20 / 엔진 40).
   *
   * WASM payload 는 `{style, children}` 만 뽑아 보내므로 이 필드는 직렬화되지 않는다.
   */
  enrichAvailWidth?: number;
}

// ─── 클래스 ───────────────────────────────────────────────────────────

/**
 * WASM Taffy 트리를 persistent하게 유지하는 래퍼 클래스.
 *
 * 매 프레임 clear() 대신 변경 감지 기반 증분 갱신으로
 * Taffy internal dirty cache를 최대한 활용한다.
 */
export class PersistentTaffyTree {
  /**
   * 레이아웃 엔진 (ADR-916 Phase 0-A seam).
   *
   * `createLayoutEngine()` factory 경유로 주입된다. ADR-916 Taffy 완전 제거
   * (2026-07-06) 후 factory 는 자체 엔진(composition-engine)을 단독 반환하며,
   * 이 클래스는 factory 만 교체하면 수정 없이 꽂힌다.
   */
  private taffy: LayoutEngineAPI;
  private rootHandle: TaffyNodeHandle | null = null;

  /**
   * elementId → Taffy node handle 매핑.
   * O(1) handle 조회 및 레이아웃 결과 매핑에 사용.
   */
  private handleMap = new Map<string, TaffyNodeHandle>();

  /**
   * elementId → 마지막으로 WASM에 전달한 JSON.
   * 간접 의존성 변경 감지(부모/형제 변경 → enrichment/display adapter 결과 변경)를 위해
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
   *   `createLayoutEngine()` factory 로 자체 엔진(composition-engine)을 획득한다.
   */
  constructor(engine?: LayoutEngineAPI) {
    this.taffy = engine ?? createLayoutEngine();
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
    return this.taffy.isAvailable();
  }

  // ─── 초기 트리 구축 ─────────────────────────────────────────────────

  /**
   * 전체 트리 초기 구축.
   *
   * fullTreeLayout.ts의 DFS post-order 순회 결과(batch)를 받아서
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
  ): TaffyNodeHandle[] {
    // 1. WASM 호출 — binary protocol 사용 가능 시 TypedArray, 아니면 JSON fallback
    let handles: number[];
    if (this.taffy.hasBinaryProtocol()) {
      const binaryInput: BinaryBatchInput[] = batch.map((n) => ({
        style: n.style,
        children: n.children,
      }));
      const binaryData = encodeBatchBinary(binaryInput);
      handles = this.taffy.buildTreeBatchBinary(binaryData);
    } else {
      const batchPayload = batch.map((n) => ({
        style: n.style,
        children: n.children,
      }));
      handles = this.taffy.buildTreeBatch(JSON.stringify(batchPayload));
    }

    // 1.5. handles 길이 검증 — WASM 반환값이 batch와 불일치하면 데이터 손상 방지
    if (handles.length !== batch.length) {
      console.error(
        `[PersistentTaffyTree] buildFull: handles 길이 불일치 (expected=${batch.length}, actual=${handles.length}). 트리 초기화 스킵.`,
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

    if (import.meta.env.DEV) {
      const rootNode = batch[batch.length - 1];
      if (rootNode && rootNode.elementId !== rootElementId) {
        console.warn(
          "[PersistentTaffyTree] buildFull: batch 마지막 요소가 rootElementId와 불일치.",
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
   * JSON 비교는 DFS 계산 결과를 직접 비교하여 의존 경로와 무관하게 정확하다.
   *
   * Taffy는 내부적으로 mark_dirty()를 호출하므로 다음 computeLayout()에서
   * 해당 노드와 조상 노드만 재계산된다.
   *
   * styleRecord는 taffyStyleToRecord()로 이미 정규화된 상태여야 한다.
   * (숫자 dimension이 "Npx" 문자열로 변환된 상태)
   *
   * @param elementId   - 업데이트할 요소 ID
   * @param styleRecord - taffyStyleToRecord() 결과 (이미 정규화된 Record)
   * @returns true if 실제로 스타일이 변경되어 WASM 호출이 발생한 경우
   */
  updateNodeStyle(
    elementId: string,
    styleRecord: Record<string, unknown>,
  ): boolean {
    const handle = this.handleMap.get(elementId);
    if (handle === undefined) return false;

    // JSON 직렬화 + 비교 — 간접 의존성 변경까지 포착
    // (부모/형제 변경 → enrichment/display adapter/implicit style 변경 →
    //  dirty 마킹 없이도 스타일이 달라질 수 있음)
    const json = JSON.stringify(styleRecord);
    const existingJson = this._lastJsonMap.get(elementId);

    if (existingJson === json) {
      return false;
    }

    // taffyStyleToRecord() 결과는 이미 "Npx" 형식으로 정규화되어 있으므로
    // normalizeStyle() 이중 변환을 방지하기 위해 updateStyleRaw() 사용
    this.taffy.updateStyleRaw(handle, json);
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
    this.taffy.markDirty(handle);
    return true;
  }

  /**
   * 노드의 마지막 스타일 JSON 문자열 반환 (display 전환 감지용).
   */
  getLastJson(elementId: string): string | undefined {
    return this._lastJsonMap.get(elementId);
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
      .filter((h): h is TaffyNodeHandle => h !== undefined);

    this.taffy.setChildren(parentHandle, childHandles);
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
   * styleRecord는 taffyStyleToRecord()로 이미 정규화된 상태여야 한다.
   *
   * @param elementId   - 새 요소 ID
   * @param styleRecord - taffyStyleToRecord() 결과 (이미 정규화된 Record)
   * @returns 생성된 Taffy node handle
   */
  addNode(
    elementId: string,
    styleRecord: Record<string, unknown>,
  ): TaffyNodeHandle {
    const json = JSON.stringify(styleRecord);
    // normalizeStyle() 이중 변환 방지를 위해 createNodeRaw() 사용
    const handle = this.taffy.createNodeRaw(json);
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
      this.taffy.removeNode(handle);
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
   * Taffy internal dirty cache 덕분에 변경되지 않은 서브트리는 자동으로 스킵된다.
   * updateNodeStyle() / updateChildren() / addNode() 로 dirty된 노드와
   * 그 조상 노드만 재계산하므로, 전체 트리 재계산 대비 O(변경된 노드 수)로 동작한다.
   *
   * @throws buildFull()이 아직 호출되지 않은 경우 Error
   */
  computeLayout(availableWidth: number, availableHeight: number): void {
    if (this.rootHandle === null) {
      throw new Error(
        "[PersistentTaffyTree] computeLayout: 트리가 초기화되지 않았습니다. buildFull()을 먼저 호출하세요.",
      );
    }
    this.taffy.computeLayout(this.rootHandle, availableWidth, availableHeight);
  }

  /**
   * 전체 노드 레이아웃 결과를 일괄 수집.
   *
   * handleMap의 모든 handle에 대해 getLayoutsBatch()를 호출한다.
   * Float32Array 기반 배치 호출이므로 N번의 get_layout() 개별 호출보다 효율적이다.
   *
   * @returns handle → LayoutResult 매핑 (x, y, width, height)
   */
  getLayoutsBatch(): Map<TaffyNodeHandle, LayoutResult> {
    const handles = Array.from(this.handleMap.values());
    return this.taffy.getLayoutsBatch(handles);
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
    const requestedHandles: TaffyNodeHandle[] = [];
    const elementIdsByHandle = new Map<TaffyNodeHandle, string>();
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

    const layouts = this.taffy.getLayoutsBatch(requestedHandles);
    const result = new Map<string, LayoutResult>();
    for (const [handle, layout] of layouts) {
      const elementId = elementIdsByHandle.get(handle);
      if (elementId !== undefined) result.set(elementId, layout);
    }
    return result;
  }

  /**
   * presentation layout lane용 dirty compute 진입점.
   *
   * `dirtyElementIds`는 used-size 전파가 끝난 layout root 집합이어야 한다. 엔진은
   * persistent root에서 `computeLayout()`을 수행하지만, dirty cache가 해당 root와
   * 조상만 재계산하고 결과 수집은 `resultElementIds`로 제한한다. 따라서 이 메서드는
   * page-root 전체 계산이 없다고 주장하지 않으며, 호출부가 parent promotion을 먼저
   * 완료했는지 검증할 수 있는 명시적 경계를 제공한다.
   *
   * @param dirtyElementIds - style/children 변경으로 dirty 처리할 root ID 집합
   * @param resultElementIds - layout 결과가 필요한 affected subtree ID 집합
   * @returns elementId → LayoutResult 매핑
   */
  computeDirtyLayoutForIds(
    dirtyElementIds: Iterable<string>,
    resultElementIds: Iterable<string>,
    availableWidth: number,
    availableHeight: number,
  ): Map<string, LayoutResult> {
    const dirtyIds = new Set<string>();
    for (const elementId of dirtyElementIds) {
      if (this.handleMap.has(elementId)) dirtyIds.add(elementId);
    }
    if (dirtyIds.size === 0) return new Map();

    for (const elementId of dirtyIds) {
      this.markDirty(elementId);
    }
    this.computeLayout(availableWidth, availableHeight);
    return this.getLayoutsForIds(resultElementIds);
  }

  // ─── 조회 유틸리티 ──────────────────────────────────────────────────

  /**
   * elementId에 대응하는 Taffy node handle 반환.
   * 존재하지 않으면 undefined.
   */
  getHandle(elementId: string): TaffyNodeHandle | undefined {
    return this.handleMap.get(elementId);
  }

  /**
   * handle에 대응하는 elementId 역매핑 반환.
   *
   * getLayoutsBatch() 결과를 elementId 기반 Map으로 변환할 때 사용한다.
   * handleMap을 순회하므로 O(N) — 빈번한 호출 시 역방향 Map 캐시를 고려할 것.
   *
   * @param handle - 조회할 Taffy node handle
   * @returns 해당 elementId, 없으면 undefined
   */
  getElementId(handle: TaffyNodeHandle): string | undefined {
    for (const [id, h] of this.handleMap) {
      if (h === handle) return id;
    }
    return undefined;
  }

  /**
   * 전체 elementId → handle 매핑 반환.
   * 읽기 전용 접근에 사용 (Map 자체를 외부에서 수정하지 말 것).
   */
  getAllHandles(): Map<string, TaffyNodeHandle> {
    return this.handleMap;
  }

  /**
   * 해당 elementId의 노드가 트리에 존재하는지 확인.
   */
  hasNode(elementId: string): boolean {
    return this.handleMap.has(elementId);
  }

  /**
   * WASM 엔진에서 관리 중인 활성 노드 수.
   */
  nodeCount(): number {
    return this.taffy.nodeCount();
  }

  // ─── 판정 트레이스 (ADR-183 — 디버그 채널) ──────────────────────────

  /**
   * 엔진 판정 트레이스 게이트 토글. 성공 시 true, 엔진 미준비/채널 미지원이면
   * false. **살아 있는 트리에 켜는 것이 채널의 존재 이유다** — 문제 노드를
   * fresh 트리로 다시 풀면 skip 게이트·측정 캐시를 타지 않아 캐시 계열 오진이
   * 사각이 된다 (ADR-183 Decision 1).
   */
  enableLayoutTrace(enabled: boolean): boolean {
    return this.taffy.enableLayoutTrace?.(enabled) ?? false;
  }

  /**
   * elementId 의 판정 트레이스 조회 (handleMap 경유 element id → handle 변환).
   * 미등록 element / 게이트 미지원이면 null. 판독 포맷은 Phase 3 헬퍼 소관 —
   * 여기는 wire 스키마(`EngineTraceNode`) 그대로 돌려준다.
   */
  getLayoutTraceForElement(elementId: string): EngineTraceNode | null {
    const handle = this.handleMap.get(elementId);
    if (handle === undefined) return null;
    return this.taffy.getLayoutTrace?.(handle) ?? null;
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
    if (this.taffy.isAvailable()) {
      this.taffy.clear();
    }
    this.rootHandle = null;
    this.handleMap.clear();
    this._lastJsonMap.clear();
    this.childrenHashMap.clear();
  }
}
