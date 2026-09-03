// 🚀 Phase 1: Immer 제거 - 함수형 업데이트로 전환
// import { produce } from "immer"; // REMOVED
import type { StateCreator } from "zustand";
import {
  Element,
  ComponentElementProps,
} from "../../../types/core/store.types";
import { historyManager, type HistoryEntry } from "../history";
import { applySnapshotRestoreHistoryEntry } from "./snapshotRestore";
import { sanitizeElement } from "../../../adapters/canonical/legacyElementSanitizer";
import { createCompleteProps } from "../utils/elementHelpers";
import type { ElementsState } from "../elements";
import { getDB } from "../../../lib/db";
import {
  applyCanonicalHistoryEventsToActiveDocument,
  getCanonicalHistoryEventIds,
  type CanonicalHistoryNodeEvent,
} from "./canonicalHistoryEvents";
import { useCanonicalDocumentStore } from "../canonical/canonicalDocumentStore";
import { renameActiveCanonicalPageTitle } from "../canonical/pageTitleMutation";
import { enqueuePagePersistence } from "../../utils/pagePersistenceQueue";
import { bumpPageGuideRevision } from "../../workspace/canvas/interaction/pageGuideRevision";
import { visitCanonicalDocumentElements } from "../canonical/canonicalElementsView";
// 🚀 Phase 11: Feature Flags for WebGL-only mode
import {
  isWebGLCanvas,
  isCanvasCompareMode,
} from "../../../utils/featureFlags";

/**
 * Undo/Redo 액션 로직
 *
 * Zustand store의 set/get 함수를 받아 undo/redo 함수를 생성하는 팩토리 함수들입니다.
 * 히스토리 매니저를 통해 작업 내역을 관리하고, 메모리/iframe/데이터베이스를 동기화합니다.
 */

type SetState = Parameters<StateCreator<ElementsState>>[0];
type GetState = Parameters<StateCreator<ElementsState>>[1];

/**
 * undo/redo 결과 persist.
 *
 * 급감 가드와의 계약 (2026-07-15 사용자 승인): blanket allowShrink 금지 유지.
 * 대신 적용된 entry 의 canonical event deleteIds 로 산출한 **설명 가능한
 * 감소량** (`expectedShrinkNodeCount`) 을 전달 — 가드가
 * `nextCount ≥ prevCount − expected` 검증 통과 시에만 급감을 허용한다
 * (대량 paste 의 undo 가 DB 저장 차단 → 새로고침 시 undo 유실되던 결함 해소).
 * delta 를 초과하는 감소는 기존과 동일하게 차단 (fail-closed).
 */
async function persistActiveCanonicalDocument(
  expectedShrinkNodeCount?: number,
): Promise<void> {
  const canonical = useCanonicalDocumentStore.getState();
  const projectId = canonical.currentProjectId;
  if (!projectId) return;
  const doc = canonical.documents.get(projectId);
  if (!doc) return;
  const db = await getDB();
  await db.documents.put(projectId, doc, {
    reason: "history-undo-redo",
    ...(expectedShrinkNodeCount && expectedShrinkNodeCount > 0
      ? { expectedShrinkNodeCount }
      : {}),
  });
}

/** 적용 entry 들의 canonical event 에서 방향 기준 제거 node 수 산출 (union). */
function countExpectedShrinkNodes(
  entries: Array<
    | { data: { canonicalEvents?: CanonicalHistoryNodeEvent[] } }
    | null
    | undefined
  >,
  direction: "undo" | "redo",
): number {
  const deleteIdSet = new Set<string>();
  for (const entry of entries) {
    const events = entry?.data.canonicalEvents;
    if (!events || events.length === 0) continue;
    for (const id of getCanonicalHistoryEventIds(events, direction).deleteIds) {
      deleteIdSet.add(id);
    }
  }
  return deleteIdSet.size;
}

function applyPageTitleHistoryEntry(
  set: SetState,
  get: GetState,
  entry: NonNullable<ReturnType<typeof historyManager.undo>>,
  direction: "undo" | "redo",
): void {
  const event = entry.data.pageTitleEvent;
  if (!event) return;

  const state = get();
  const page = state.pages.find((candidate) => candidate.id === event.pageId);
  if (!page) return;

  const title = direction === "undo" ? event.before : event.after;
  const canonical = useCanonicalDocumentStore.getState();
  const projectId = canonical.currentProjectId;
  const document = projectId ? canonical.documents.get(projectId) : null;
  const canonicalPage = document?.children.find(
    (node) => node.id === event.pageId,
  );
  if (!canonicalPage) return;

  if (
    canonicalPage.name !== title &&
    !renameActiveCanonicalPageTitle(event.pageId, title)
  ) {
    return;
  }

  set((current) => ({
    pages: current.pages.map((candidate) =>
      candidate.id === event.pageId ? { ...candidate, title } : candidate,
    ),
  }));

  void enqueuePagePersistence(async () => {
    try {
      await persistActiveCanonicalDocument();
    } catch (error) {
      console.error("[applyPageTitleHistoryEntry] DB persist:", error);
    }
  });
}

/**
 * ADR-177 — `page-position` entry 적용 (undo/redo/goToIndex 공용).
 *
 * element 노드 경로와 별개 축: 스토어 breakpoint 스냅샷 + canonical
 * `pagePositions` root 필드 + persist 를 함께 갱신한다. 삭제된 pageId entry
 * 는 무시 (R3), 비-active breakpoint entry 는 스냅샷만 갱신 (화면 무변화).
 */
function applyPagePositionHistoryEntry(
  set: SetState,
  get: GetState,
  entry: NonNullable<ReturnType<typeof historyManager.undo>>,
  direction: "undo" | "redo",
): void {
  const event = entry.data.pagePositionEvent;
  if (!event || event.entries.length === 0) return;

  const state = get();
  const validPageIds = new Set(state.pages.map((page) => page.id));
  const activeBreakpoint = (
    state as ElementsState & {
      activeBreakpoint: import("@composition/shared").BreakpointName;
    }
  ).activeBreakpoint;

  const canonicalEntries: Array<{
    pageId: string;
    breakpoint: import("@composition/shared").BreakpointName;
    position: { x: number; y: number } | null;
  }> = [];

  set((prev) => {
    const nextByBreakpoint = { ...prev.pagePositionsByBreakpoint };
    let activeTouched = false;

    for (const item of event.entries) {
      if (!validPageIds.has(item.pageId)) continue;
      const position = direction === "undo" ? item.before : item.after;
      canonicalEntries.push({
        pageId: item.pageId,
        breakpoint: item.breakpoint,
        position: position ? { ...position } : null,
      });
      if (position === null) continue; // 문서 축만 정리 — 스토어 위치 유지
      const snapshot = { ...(nextByBreakpoint[item.breakpoint] ?? {}) };
      snapshot[item.pageId] = { ...position };
      nextByBreakpoint[item.breakpoint] = snapshot;
      if (item.breakpoint === activeBreakpoint) activeTouched = true;
    }

    return {
      pagePositions: activeTouched
        ? { ...(nextByBreakpoint[activeBreakpoint] ?? {}) }
        : prev.pagePositions,
      pagePositionsByBreakpoint: nextByBreakpoint,
      pagePositionsVersion: prev.pagePositionsVersion + 1,
    };
  });

  if (canonicalEntries.length > 0) {
    useCanonicalDocumentStore.getState().setPagePositions(canonicalEntries);
  }
  queueMicrotask(() => {
    void persistActiveCanonicalDocument().catch((error) => {
      console.error("[applyPagePositionHistoryEntry] DB persist:", error);
    });
  });
}

/**
 * ADR-181 — `page-guide` entry 적용 (undo/redo/goToIndex 공용).
 *
 * `page-position` 과 같은 비-element 축이되 **스토어 미러가 없다** — 가이드는
 * canonical `pageGuides` 에만 살기 때문에 `set()` 없이 canonical 만 되돌리고,
 * 화면 갱신은 개정 카운터로 알린다 (C11 (c) — 오버레이 패스 전용이라
 * `invalidateContent()` 는 부르지 않는다).
 *
 * 삭제된 pageId entry 는 무시한다 (ADR-177 R3 동형 — 페이지를 지운 뒤 undo 로
 * 그 페이지 가이드만 되살아나면 소유자 없는 데이터가 남는다).
 */
function applyPageGuideHistoryEntry(
  get: GetState,
  entry: NonNullable<ReturnType<typeof historyManager.undo>>,
  direction: "undo" | "redo",
): void {
  const event = entry.data.pageGuideEvent;
  if (!event || event.entries.length === 0) return;

  const validPageIds = new Set(get().pages.map((page) => page.id));
  const canonicalEntries = event.entries
    .filter((item) => validPageIds.has(item.pageId))
    .map((item) => ({
      pageId: item.pageId,
      breakpoint: item.breakpoint,
      // 배열/원소 모두 복사 — entry 는 히스토리에 남아 재적용되므로 소비자와
      // 저장소가 같은 객체를 공유하면 안 된다
      guides: (direction === "undo" ? item.before : item.after).map(
        (guide) => ({ ...guide }),
      ),
    }));
  if (canonicalEntries.length === 0) return;

  useCanonicalDocumentStore.getState().setPageGuides(canonicalEntries);
  bumpPageGuideRevision();
  queueMicrotask(() => {
    void persistActiveCanonicalDocument().catch((error) => {
      console.error("[applyPageGuideHistoryEntry] DB persist:", error);
    });
  });
}

/**
 * ADR-185 G-1 수리 — `page-lifecycle` entry 적용 (undo/redo/goToIndex 공용).
 *
 * 효과 방향: create+redo / delete+undo = **페이지 추가**, create+undo /
 * delete+redo = **페이지 제거**. 페이지 행 + 소속 요소 subtree + detach
 * 치환쌍 + breakpoint 위치 + 활성 페이지를 함께 되돌린다.
 *
 * canonical element 정렬은 여기서 직접 하지 않는다 — `set()` 의 pages
 * 토폴로지 변경이 page shell bridge (BuilderCore 구독) 를 동기 실행시켜
 * live 경로 (appendPageShell / removePageLocal) 와 같은 기제로 정렬된다.
 * positions 는 canonical `pagePositions` 직접 갱신 (ADR-177 적용기 동형).
 *
 * 적용이 활성 페이지를 바꾸면 entry 를 새 활성 스택으로 이관한다
 * (`migrateEntryToPage`) — history 가 페이지별 스택이라 이관 없이는 반대
 * 방향이 도달 불가. goToIndex 는 스택 내 index 산술을 보존해야 하므로
 * `migrate: false` 로 이관을 생략한다 (잔존: 패널 점프 후 해당 entry 의
 * 반대 방향은 원래 스택에서만 도달 가능).
 */
function applyPageLifecycleHistoryEntry(
  set: SetState,
  get: GetState,
  entry: NonNullable<ReturnType<typeof historyManager.undo>>,
  direction: "undo" | "redo",
  options: { migrate: boolean; fromHistoryPageId: string | null },
): void {
  const event = entry.data.pageLifecycleEvent;
  if (!event) return;

  const op =
    (event.action === "create") === (direction === "redo") ? "add" : "remove";
  const state = get();
  const pageId = event.page.id;

  let nextElements = state.elements;
  let nextPages = state.pages;
  let nextCurrentPageId: string | null;

  if (op === "add") {
    if (state.pages.some((page) => page.id === pageId)) return; // 멱등 방어

    // detach 역적용 — root 는 instance 원형 복귀, detach 파생 descendants 제거
    if (event.detach.length > 0) {
      const rootPairs = new Map(
        event.detach.map((pair) => [pair.previous.id, pair]),
      );
      const detachDescendantIds = new Set(
        event.detach.flatMap((pair) =>
          pair.replacements.slice(1).map((element) => element.id),
        ),
      );
      nextElements = nextElements.flatMap((element) => {
        const pair = rootPairs.get(element.id);
        if (pair) return [cloneForHistory(pair.previous)];
        if (detachDescendantIds.has(element.id)) return [];
        return [element];
      });
    }
    nextElements = [
      ...nextElements,
      ...event.subtreeElements.map((element) => cloneForHistory(element)),
    ];
    const insertAt = Math.min(Math.max(event.pageIndex, 0), state.pages.length);
    nextPages = [
      ...state.pages.slice(0, insertAt),
      event.page,
      ...state.pages.slice(insertAt),
    ];
    const desired =
      event.action === "create"
        ? (event.nextCurrentPageId ?? pageId)
        : (event.prevCurrentPageId ?? state.currentPageId);
    nextCurrentPageId =
      desired && nextPages.some((page) => page.id === desired)
        ? desired
        : pageId;
  } else {
    if (!state.pages.some((page) => page.id === pageId)) return; // 멱등 방어

    const subtreeIds = new Set(
      state.elements
        .filter((element) => element.page_id === pageId)
        .map((element) => element.id),
    );
    const rootPairs = new Map(
      event.detach.map((pair) => [pair.previous.id, pair]),
    );
    nextElements = state.elements.flatMap((element) => {
      if (subtreeIds.has(element.id)) return [];
      const pair = rootPairs.get(element.id);
      if (pair) {
        return pair.replacements.map((replacement) =>
          cloneForHistory(replacement),
        );
      }
      return [element];
    });
    nextPages = state.pages.filter((page) => page.id !== pageId);
    const desired =
      event.action === "create"
        ? event.prevCurrentPageId
        : event.nextCurrentPageId;
    nextCurrentPageId =
      desired && nextPages.some((page) => page.id === desired)
        ? desired
        : (nextPages[0]?.id ?? null);
  }

  // breakpoint 별 위치 — add 는 기록 위치 복원, remove 는 전 breakpoint 제거
  const activeBreakpoint = (
    state as ElementsState & {
      activeBreakpoint: import("@composition/shared").BreakpointName;
    }
  ).activeBreakpoint;
  const nextByBreakpoint = { ...state.pagePositionsByBreakpoint };
  if (op === "add") {
    for (const item of event.positions) {
      const snapshot = { ...(nextByBreakpoint[item.breakpoint] ?? {}) };
      snapshot[pageId] = { ...item.position };
      nextByBreakpoint[item.breakpoint] = snapshot;
    }
  } else {
    for (const breakpoint of Object.keys(nextByBreakpoint)) {
      const key = breakpoint as keyof typeof nextByBreakpoint;
      const snapshot = { ...(nextByBreakpoint[key] ?? {}) };
      delete snapshot[pageId];
      nextByBreakpoint[key] = snapshot;
    }
  }

  const nextBodyElement =
    nextElements.find(
      (element) =>
        element.page_id === nextCurrentPageId && element.type === "body",
    ) ?? null;

  set(() => ({
    pages: nextPages,
    elements: nextElements,
    pagePositions: { ...(nextByBreakpoint[activeBreakpoint] ?? {}) },
    pagePositionsByBreakpoint: nextByBreakpoint,
    pagePositionsVersion: state.pagePositionsVersion + 1,
    currentPageId: nextCurrentPageId,
    selectedElementId: nextBodyElement?.id ?? null,
    selectedElementIds: nextBodyElement ? [nextBodyElement.id] : [],
    selectedElementIdsSet: new Set(nextBodyElement ? [nextBodyElement.id] : []),
    multiSelectMode: false,
    selectedElementProps: nextBodyElement
      ? createCompleteProps(nextBodyElement)
      : {},
    editingContextId: null,
    layoutVersion: state.layoutVersion + 1,
  }));
  // pages 토폴로지 변경으로 page shell bridge 가 canonical elements 를 재파생
  // (동기 구독) — 그 결과 위에서 index 를 재구축한다
  get()._rebuildIndexes();

  const canonicalPositionEntries = event.positions.map((item) => ({
    pageId,
    breakpoint: item.breakpoint,
    position: op === "add" ? { ...item.position } : null,
  }));
  if (canonicalPositionEntries.length > 0) {
    useCanonicalDocumentStore
      .getState()
      .setPagePositions(canonicalPositionEntries);
  }

  if (nextCurrentPageId) {
    historyManager.setCurrentPage(nextCurrentPageId);
    if (
      options.migrate &&
      options.fromHistoryPageId &&
      options.fromHistoryPageId !== nextCurrentPageId
    ) {
      historyManager.migrateEntryToPage(
        entry.id,
        options.fromHistoryPageId,
        nextCurrentPageId,
        direction === "undo" ? "redoable" : "done",
      );
    }
  }

  queueMicrotask(() => {
    // remove 방향은 의도된 대량 감소 — 급감 가드에 예상 감소량 명시
    void persistActiveCanonicalDocument(
      op === "remove" ? event.subtreeElements.length : undefined,
    ).catch((error) => {
      console.error("[applyPageLifecycleHistoryEntry] DB persist:", error);
    });
  });
}

function getHistorySourceElements(get: GetState): Element[] {
  const { elements: legacyElements } = get();
  return getActiveCanonicalHistoryElements() ?? legacyElements;
}

function getActiveCanonicalHistoryElements(): Element[] | null {
  const canonical = useCanonicalDocumentStore.getState();
  const projectId = canonical.currentProjectId;
  if (!projectId) return null;
  const doc = canonical.documents.get(projectId);
  if (!doc) return null;

  const elements: Element[] = [];
  visitCanonicalDocumentElements(doc, (element) => {
    elements.push(element);
  });
  return elements;
}

/**
 * 🚀 Phase 2: structuredClone 우선 사용 헬퍼
 * JSON.parse/stringify보다 2-5배 빠름
 */
function cloneForHistory<T>(value: T): T {
  try {
    if (typeof structuredClone === "function") {
      return structuredClone(value);
    }
  } catch {
    // structuredClone 실패 시 JSON fallback
  }
  try {
    const json = JSON.stringify(value);
    if (json === undefined) return value;
    return JSON.parse(json) as T;
  } catch {
    return value;
  }
}

function resolveSelectionAfterCanonicalEvents(
  selectedElementId: string | null,
  selectedElementProps: ComponentElementProps,
  updatedElements: Element[],
): {
  selectedElementId: string | null;
  selectedElementProps: ComponentElementProps;
} {
  if (!selectedElementId) {
    return { selectedElementId, selectedElementProps };
  }
  const selectedElement = updatedElements.find(
    (element) => element.id === selectedElementId,
  );
  return selectedElement
    ? {
        selectedElementId,
        selectedElementProps: createCompleteProps(selectedElement),
      }
    : {
        selectedElementId: null,
        selectedElementProps: {},
      };
}

/**
 * Undo 액션 생성 팩토리
 *
 * @param set - Zustand store의 set 함수
 * @param get - Zustand store의 get 함수
 * @returns undo 함수 구현체
 */
export const createUndoAction = (set: SetState, get: GetState) => async () => {
  try {
    const state = get();
    const { currentPageId } = state;
    if (!currentPageId) {
      return;
    }

    // 히스토리 작업 시작 표시
    set({ historyOperationInProgress: true });

    // historyManager에서 항목 가져오기
    const undoSourcePageId = historyManager.getCurrentPageId();
    const entry = historyManager.undo();
    if (!entry) {
      set({ historyOperationInProgress: false });
      return;
    }

    // ADR-177: page-position entry 는 element 노드 경로 미진입 (early-branch)
    if (entry.type === "page-position") {
      applyPagePositionHistoryEntry(set, get, entry, "undo");
      set({ historyOperationInProgress: false });
      return;
    }

    // ADR-185 G-1: page-lifecycle entry 도 element 노드 경로 미진입 —
    // 적용 후 활성 페이지가 바뀌면 entry 를 그 스택으로 이관 (undo → redoable)
    if (entry.type === "page-lifecycle") {
      applyPageLifecycleHistoryEntry(set, get, entry, "undo", {
        migrate: true,
        fromHistoryPageId: undoSourcePageId,
      });
      set({ historyOperationInProgress: false });
      return;
    }

    // ADR-181: page-guide entry 도 element 노드 경로 미진입 (early-branch)
    if (entry.type === "page-guide") {
      applyPageGuideHistoryEntry(get, entry, "undo");
      set({ historyOperationInProgress: false });
      return;
    }

    // ADR-180: snapshot-restore entry 는 문서 전체 교체 (early-branch) —
    // undo = beforeSnapshot 재적용 (persist 포함, snapshotRestore.ts)
    if (entry.type === "snapshot-restore") {
      await applySnapshotRestoreHistoryEntry(get, entry, "undo");
      set({ historyOperationInProgress: false });
      return;
    }

    if (entry.type === "page-title") {
      applyPageTitleHistoryEntry(set, get, entry, "undo");
      set({ historyOperationInProgress: false });
      return;
    }

    const currentState = {
      ...get(),
      elements: getHistorySourceElements(get),
    };

    let updatedElements = currentState.elements;
    let updatedSelectedElementId = currentState.selectedElementId;
    let updatedSelectedElementProps = currentState.selectedElementProps;
    // ADR-124: IDB load/upgrade 가 migrate 를 끝낸다. apply 는 canonicalEvents 만.
    const canonicalEventElements = applyCanonicalHistoryEventsToActiveDocument(
      entry.data.canonicalEvents,
      "undo",
    );

    if (canonicalEventElements) {
      updatedElements = canonicalEventElements;
      const selection = resolveSelectionAfterCanonicalEvents(
        currentState.selectedElementId,
        currentState.selectedElementProps,
        updatedElements,
      );
      updatedSelectedElementId = selection.selectedElementId;
      updatedSelectedElementProps = selection.selectedElementProps;
    }

    set({
      elements: updatedElements,
      selectedElementId: updatedSelectedElementId,
      selectedElementProps: updatedSelectedElementProps,
    });

    // 🔧 CRITICAL: elementsMap 재구축 (Undo 후 인덱스 동기화)
    get()._rebuildIndexes();

    // 2. iframe 업데이트
    // 🚀 Phase 11: WebGL-only 모드에서는 iframe 통신 스킵
    const isWebGLOnly = isWebGLCanvas() && !isCanvasCompareMode();
    if (!isWebGLOnly && typeof window !== "undefined" && window.parent) {
      try {
        window.parent.postMessage(
          {
            type: "ELEMENTS_UPDATED",
            payload: { elements: updatedElements.map(sanitizeElement) },
          },
          window.location.origin,
        );
      } catch (error) {
        console.warn("postMessage 직렬화 실패:", error);
      }
    }

    // 3. Canonical document persistence (ADR-128: cloud compatibility sync dead)
    try {
      await persistActiveCanonicalDocument(
        countExpectedShrinkNodes([entry], "undo"),
      );
    } catch (dbError) {
      console.warn("⚠️ 데이터베이스 업데이트 실패 (메모리는 정상):", dbError);
    }
  } catch (error) {
    console.error("Undo 시 오류:", error);
  } finally {
    // 히스토리 작업 종료 표시
    set({ historyOperationInProgress: false });
  }
};

/**
 * Redo 액션 생성 팩토리
 *
 * @param set - Zustand store의 set 함수
 * @param get - Zustand store의 get 함수
 * @returns redo 함수 구현체
 */
export const createRedoAction = (set: SetState, get: GetState) => async () => {
  try {
    const state = get();
    if (!state.currentPageId) return;

    // 히스토리 작업 시작 표시
    set({ historyOperationInProgress: true });

    const redoSourcePageId = historyManager.getCurrentPageId();
    const entry = historyManager.redo();
    if (!entry) {
      set({ historyOperationInProgress: false });
      return;
    }

    // ADR-177: page-position entry 는 element 노드 경로 미진입 (early-branch)
    if (entry.type === "page-position") {
      applyPagePositionHistoryEntry(set, get, entry, "redo");
      set({ historyOperationInProgress: false });
      return;
    }

    // ADR-185 G-1: page-lifecycle entry 도 element 노드 경로 미진입 —
    // 적용 후 활성 페이지가 바뀌면 entry 를 그 스택으로 이관 (redo → done)
    if (entry.type === "page-lifecycle") {
      applyPageLifecycleHistoryEntry(set, get, entry, "redo", {
        migrate: true,
        fromHistoryPageId: redoSourcePageId,
      });
      set({ historyOperationInProgress: false });
      return;
    }

    // ADR-181: page-guide entry 도 element 노드 경로 미진입 (early-branch)
    if (entry.type === "page-guide") {
      applyPageGuideHistoryEntry(get, entry, "redo");
      set({ historyOperationInProgress: false });
      return;
    }

    // ADR-180: snapshot-restore entry 는 문서 전체 교체 (early-branch) —
    // redo = afterSnapshot 재적용 (persist 포함, snapshotRestore.ts)
    if (entry.type === "snapshot-restore") {
      await applySnapshotRestoreHistoryEntry(get, entry, "redo");
      set({ historyOperationInProgress: false });
      return;
    }

    if (entry.type === "page-title") {
      applyPageTitleHistoryEntry(set, get, entry, "redo");
      set({ historyOperationInProgress: false });
      return;
    }

    const currentState = {
      ...get(),
      elements: getHistorySourceElements(get),
    };
    let updatedElements = currentState.elements;
    let updatedSelectedElementId = currentState.selectedElementId;
    let updatedSelectedElementProps = currentState.selectedElementProps;
    // ADR-124: IDB load/upgrade 가 migrate 를 끝낸다. apply 는 canonicalEvents 만.
    const canonicalEventElements = applyCanonicalHistoryEventsToActiveDocument(
      entry.data.canonicalEvents,
      "redo",
    );

    if (canonicalEventElements) {
      updatedElements = canonicalEventElements;
      const selection = resolveSelectionAfterCanonicalEvents(
        currentState.selectedElementId,
        currentState.selectedElementProps,
        updatedElements,
      );
      updatedSelectedElementId = selection.selectedElementId;
      updatedSelectedElementProps = selection.selectedElementProps;
    }

    set({
      elements: updatedElements,
      selectedElementId: updatedSelectedElementId,
      selectedElementProps: updatedSelectedElementProps,
    });

    // 🔧 CRITICAL: elementsMap 재구축 (Redo 후 인덱스 동기화)
    get()._rebuildIndexes();

    // 2. iframe 업데이트
    // 🚀 Phase 11: WebGL-only 모드에서는 iframe 통신 스킵
    const isWebGLOnly = isWebGLCanvas() && !isCanvasCompareMode();
    if (!isWebGLOnly && typeof window !== "undefined" && window.parent) {
      try {
        window.parent.postMessage(
          {
            type: "ELEMENTS_UPDATED",
            payload: { elements: updatedElements.map(sanitizeElement) },
          },
          window.location.origin,
        );
      } catch (error) {
        console.warn("postMessage 직렬화 실패:", error);
      }
    }

    // 3. Canonical document persistence (ADR-128: cloud compatibility sync dead)
    try {
      await persistActiveCanonicalDocument(
        countExpectedShrinkNodes([entry], "redo"),
      );
    } catch (dbError) {
      console.warn("⚠️ 데이터베이스 업데이트 실패 (메모리는 정상):", dbError);
    }
  } catch (error) {
    console.error("Redo 시 오류:", error);
  } finally {
    // 히스토리 작업 종료 표시
    set({ historyOperationInProgress: false });
  }
};

/**
 * 특정 히스토리 인덱스로 직접 이동 (중간 렌더링 없이)
 *
 * historyManager.goToIndex로 모든 엔트리를 가져온 후
 * 한 번에 상태를 업데이트하여 중간 과정이 화면에 표시되지 않도록 합니다.
 *
 * @param set - Zustand store의 set 함수
 * @param get - Zustand store의 get 함수
 * @returns goToHistoryIndex 함수 구현체
 */
export const createGoToHistoryIndexAction =
  (set: SetState, get: GetState) => async (targetIndex: number) => {
    try {
      const state = {
        ...get(),
        elements: getHistorySourceElements(get),
      };
      const { currentPageId } = state;
      if (!currentPageId) return;

      // 히스토리 작업 시작 표시
      set({ historyOperationInProgress: true });

      // historyManager에서 모든 엔트리를 한 번에 가져옴
      const result = historyManager.goToIndex(targetIndex);
      if (!result) {
        set({ historyOperationInProgress: false });
        return;
      }

      const { entries, direction } = result;

      // 현재 상태를 가져와서 누적 업데이트
      const { elements: sourceElements } = state;
      let updatedElements = sourceElements;
      let updatedSelectedElementId = state.selectedElementId;
      let updatedSelectedElementProps = state.selectedElementProps;

      // 모든 엔트리를 순차적으로 메모리에 적용 (렌더링 없이)
      for (const entry of entries) {
        // ADR-177: page-position entry 는 element 경로 미진입 — 자체 적용 후
        // canonical full-sync 판정에서도 제외 (element 축 무변경).
        if (entry.type === "page-position") {
          applyPagePositionHistoryEntry(set, get, entry, direction);
          continue;
        }
        if (entry.type === "page-title") {
          applyPageTitleHistoryEntry(set, get, entry, direction);
          continue;
        }
        // ADR-181: page-guide 도 동일 — canonical 만 갱신 (스토어 미러 없음),
        // canonical full-sync 판정 제외 (element 축 무변경).
        if (entry.type === "page-guide") {
          applyPageGuideHistoryEntry(get, entry, direction);
          continue;
        }
        // ADR-185 G-1: page-lifecycle 도 element 경로 미진입 — 자체 적용 후
        // 누적 기준을 store 에서 재취득 (snapshot-restore 동형). 스택 내
        // index 산술 보존을 위해 이관은 생략 (migrate: false — 함수 doc 참조).
        if (entry.type === "page-lifecycle") {
          applyPageLifecycleHistoryEntry(set, get, entry, direction, {
            migrate: false,
            fromHistoryPageId: null,
          });
          const refreshed = get();
          updatedElements = refreshed.elements;
          updatedSelectedElementId = refreshed.selectedElementId;
          updatedSelectedElementProps = refreshed.selectedElementProps;
          continue;
        }
        // ADR-180: snapshot-restore entry 는 문서 전체 교체 — 적용 후 누적
        // 기준(updatedElements)을 store 에서 재취득하고 계속 진행. canonical
        // full-sync 판정 제외 (applySnapshotDocument 가 canonical 1차 수행).
        if (entry.type === "snapshot-restore") {
          await applySnapshotRestoreHistoryEntry(get, entry, direction);
          const refreshed = get();
          updatedElements = refreshed.elements;
          updatedSelectedElementId = refreshed.selectedElementId;
          updatedSelectedElementProps = refreshed.selectedElementProps;
          continue;
        }
        const applyResult = applyHistoryEntry(
          entry,
          direction,
          updatedElements,
          updatedSelectedElementId,
          updatedSelectedElementProps,
        );
        updatedElements = applyResult.elements;
        updatedSelectedElementId = applyResult.selectedElementId;
        updatedSelectedElementProps = applyResult.selectedElementProps;
      }

      // applyHistoryEntry 가 migrate→canonicalEvents 로 이미 canonical doc 을
      // 갱신한다. goTo 혼합 시퀀스용 legacy sync-before-set 경로는 없다.

      // 최종 상태 한 번에 업데이트 (렌더링은 여기서만 발생)
      set({
        elements: updatedElements,
        selectedElementId: updatedSelectedElementId,
        selectedElementProps: updatedSelectedElementProps,
      });

      // elementsMap 재구축
      get()._rebuildIndexes();

      // iframe 업데이트
      const isWebGLOnly = isWebGLCanvas() && !isCanvasCompareMode();
      if (!isWebGLOnly && typeof window !== "undefined" && window.parent) {
        try {
          window.parent.postMessage(
            {
              type: "ELEMENTS_UPDATED",
              payload: { elements: updatedElements.map(sanitizeElement) },
            },
            window.location.origin,
          );
        } catch (error) {
          console.warn("postMessage 직렬화 실패:", error);
        }
      }

      // 데이터베이스 동기화 (마지막 상태만)
      await syncDatabaseForEntries(entries, direction, get);
    } catch (error) {
      console.error("GoToHistoryIndex 시 오류:", error);
    } finally {
      set({ historyOperationInProgress: false });
    }
  };

/**
 * 히스토리 엔트리를 메모리 상태에 적용 (렌더링 없이)
 */
function applyHistoryEntry(
  entry: ReturnType<typeof historyManager.undo>,
  direction: "undo" | "redo",
  elements: Element[],
  selectedElementId: string | null,
  selectedElementProps: ComponentElementProps,
): {
  elements: Element[];
  selectedElementId: string | null;
  selectedElementProps: ComponentElementProps;
} {
  if (!entry) {
    return { elements, selectedElementId, selectedElementProps };
  }

  const canonicalEventElements = applyCanonicalHistoryEventsToActiveDocument(
    entry.data.canonicalEvents,
    direction,
  );
  if (!canonicalEventElements) {
    // events 없거나 doc 미적재 — 상태 유지 (IDB migrate 경계 밖 entry)
    return { elements, selectedElementId, selectedElementProps };
  }

  const selection = resolveSelectionAfterCanonicalEvents(
    selectedElementId,
    selectedElementProps,
    canonicalEventElements,
  );
  return {
    elements: canonicalEventElements,
    selectedElementId: selection.selectedElementId,
    selectedElementProps: selection.selectedElementProps,
  };
}

async function syncDatabaseForEntries(
  entries: ReturnType<typeof historyManager.undo>[],
  direction: "undo" | "redo",
  _get: GetState,
): Promise<void> {
  // 마지막 엔트리의 최종 상태만 동기화 — cloud compatibility sync 는 dead
  // (ADR-128). shrink 가드용 deleteIds 만 모은다.
  const removedElementIds = new Set<string>();

  for (const entry of entries) {
    if (!entry) continue;
    // ADR-177: page-position entry 는 element DB 동기화 대상 아님 — persist 는
    // applyPagePositionHistoryEntry 가 자체 수행 (elementId=pageId 오인 방지).
    if (entry.type === "page-position") continue;
    if (entry.type === "page-title") continue;
    // ADR-181: page-guide 도 동일 — persist 는 applyPageGuideHistoryEntry 가
    // 자체 수행 (elementId=pageId 오인 방지).
    if (entry.type === "page-guide") continue;
    // ADR-180: snapshot-restore 도 동일 — persist 는 applySnapshotDocument 가
    // allowShrink 명시로 자체 수행 (elementId=pageId 무해값).
    if (entry.type === "snapshot-restore") continue;
    // ADR-185 G-1: page-lifecycle 도 동일 — persist 는
    // applyPageLifecycleHistoryEntry 가 자체 수행 (elementId=pageId 무해값).
    if (entry.type === "page-lifecycle") continue;

    const events = entry.data.canonicalEvents;
    if (!events || events.length === 0) continue;

    const { deleteIds } = getCanonicalHistoryEventIds(events, direction);
    deleteIds.forEach((id) => removedElementIds.add(id));
  }

  // ADR-128: cloud sync dead — IndexedDB persistence via persistActiveCanonicalDocument
  try {
    await persistActiveCanonicalDocument(removedElementIds.size);
  } catch (error) {
    console.warn("⚠️ GoToHistoryIndex DB 동기화 실패:", error);
  }
}
