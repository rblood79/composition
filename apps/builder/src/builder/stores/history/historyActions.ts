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
import { getElementById, createCompleteProps } from "../utils/elementHelpers";
import {
  applyBatchDiffRedo,
  applyBatchDiffUndo,
  applyDiffRedo,
  applyDiffUndo,
  deserializeDiff,
  type SerializableElementDiff,
} from "../utils/elementDiff";
import type { ElementsState } from "../elements";
import { getDB } from "../../../lib/db";
import {
  areCanonicalMutationStoreActionsRegistered,
  setElementsCanonicalPrimary,
} from "@/adapters/canonical/canonicalMutations";
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
type HistoryCompatibilityElementMap<TElement extends Element = Element> = Map<
  string,
  TElement
>;

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

function syncHistoryElementsToCanonical(elements: Element[]): void {
  if (!areCanonicalMutationStoreActionsRegistered()) return;
  setElementsCanonicalPrimary(elements);
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
 * 토폴로지 변경이 page shell bridge (BuilderCore 구독) 를 동기 발화시켜
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

function getHistoryCompatibilityElementsMap(
  get: GetState,
): HistoryCompatibilityElementMap {
  return new Map(
    getHistorySourceElements(get).map((element) => [element.id, element]),
  );
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

function applyElementSnapshotBatch(
  currentElements: Element[],
  removeIds: Set<string>,
  upsertElements: Element[],
): Element[] {
  const upsertIds = new Set(upsertElements.map((element) => element.id));
  const retained = currentElements.filter(
    (element) => !removeIds.has(element.id) && !upsertIds.has(element.id),
  );
  return [...retained, ...upsertElements];
}

function applySerializedHistoryDiff(
  currentElements: Element[],
  diff: SerializableElementDiff,
  direction: "undo" | "redo",
): Element[] {
  const elementDiff = deserializeDiff(diff);
  return currentElements.map((element) => {
    if (element.id !== diff.elementId) return element;
    return direction === "undo"
      ? applyDiffUndo(element, elementDiff)
      : applyDiffRedo(element, elementDiff);
  });
}

function applySerializedHistoryDiffs(
  currentElements: Element[],
  diffs: SerializableElementDiff[],
  direction: "undo" | "redo",
): Element[] {
  const elementDiffs = diffs.map((diff) => deserializeDiff(diff));
  return direction === "undo"
    ? applyBatchDiffUndo(currentElements, elementDiffs)
    : applyBatchDiffRedo(currentElements, elementDiffs);
}

function resolveSelectedPropsAfterBatch(
  selectedElementId: string | null,
  selectedElementProps: ComponentElementProps,
  updatedElements: Element[],
): ComponentElementProps {
  if (!selectedElementId) return selectedElementProps;
  const selectedElement = updatedElements.find(
    (element) => element.id === selectedElementId,
  );
  return selectedElement ? createCompleteProps(selectedElement) : {};
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

function getHistoryDiffElementIds(entry: HistoryEntry): string[] {
  const ids = new Set<string>();
  if (entry.data.diff) ids.add(entry.data.diff.elementId);
  entry.data.diffs?.forEach((diff) => ids.add(diff.elementId));
  return [...ids];
}

async function upsertHistoryCompatibilityElements(
  elementIds: Iterable<string>,
  get: GetState,
): Promise<void> {
  const elementsMap = getHistoryCompatibilityElementsMap(get);
  const elementsToUpsert: Element[] = [];
  for (const id of elementIds) {
    const element = getElementById(elementsMap, id);
    if (element) elementsToUpsert.push(element);
  }
  // ADR-128: cloud upsert dead — IndexedDB persistence only.
  void elementsToUpsert;
  void get;
}

async function syncCloudCompatibilityForCanonicalEvents(
  _entry: HistoryEntry,
  _direction: "undo" | "redo",
  _get: GetState,
): Promise<void> {
  // ADR-128: cloud sync dead — IndexedDB persistence only.
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

    // 1. 메모리 상태 업데이트 (우선) - 안전한 데이터 복사
    let elementIdsToRemove: string[] = [];
    const elementsToRestore: Element[] = [];
    let prevProps: ComponentElementProps | null = null;
    let prevElement: Element | null = null;

    // produce 밖에서 안전하게 데이터 준비
    try {
      switch (entry.type) {
        case "add": {
          elementIdsToRemove = [entry.elementId];
          if (entry.data.childElements && entry.data.childElements.length > 0) {
            elementIdsToRemove.push(
              ...entry.data.childElements.map((child: Element) => child.id),
            );
          }
          break;
        }

        case "update": {
          // 🚀 Phase 2: structuredClone 사용
          if (entry.data.prevProps) {
            prevProps = cloneForHistory(entry.data.prevProps);
          }
          if (entry.data.prevElement) {
            prevElement = cloneForHistory(entry.data.prevElement);
          }
          break;
        }

        case "remove": {
          // 🚀 Phase 2: structuredClone 사용
          if (entry.data.element) {
            elementsToRestore.push(cloneForHistory(entry.data.element));
          }
          if (entry.data.childElements && entry.data.childElements.length > 0) {
            elementsToRestore.push(
              ...entry.data.childElements.map((child: Element) =>
                cloneForHistory(child),
              ),
            );
          }
          break;
        }

        case "batch": {
          // Batch update - 각 요소의 이전 props 저장
          break;
        }

        case "group": {
          // Group 생성 - 그룹 삭제 + 자식들 원래 부모로 이동 준비
          elementIdsToRemove = [entry.elementId]; // 그룹 요소 삭제
          break;
        }

        case "ungroup": {
          // Ungroup - 그룹 재생성 + 자식들 그룹 안으로 이동 준비
          if (entry.data.element) {
            // 🚀 Phase 2: structuredClone 사용
            elementsToRestore.push(cloneForHistory(entry.data.element));
          }
          break;
        }
      }
    } catch (error: unknown) {
      console.error("⚠️ 히스토리 데이터 준비 중 오류:", error);
      console.error("⚠️ 오류 상세:", {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        entryType: entry.type,
        elementId: entry.elementId,
      });
      set({ historyOperationInProgress: false });
      return;
    }

    // 🚀 Phase 1: Immer → 함수형 업데이트
    const currentState = {
      ...get(),
      elements: getHistorySourceElements(get),
    };

    let updatedElements = currentState.elements;
    let updatedSelectedElementId = currentState.selectedElementId;
    let updatedSelectedElementProps = currentState.selectedElementProps;
    const canonicalEventElements = applyCanonicalHistoryEventsToActiveDocument(
      entry.data.canonicalEvents,
      "undo",
    );
    const appliedCanonicalEvents = canonicalEventElements !== null;

    if (canonicalEventElements) {
      updatedElements = canonicalEventElements;
      const selection = resolveSelectionAfterCanonicalEvents(
        currentState.selectedElementId,
        currentState.selectedElementProps,
        updatedElements,
      );
      updatedSelectedElementId = selection.selectedElementId;
      updatedSelectedElementProps = selection.selectedElementProps;
    } else
      switch (entry.type) {
        case "add": {
          // 추가된 요소 제거 (역작업)
          updatedElements = currentState.elements.filter(
            (el) => !elementIdsToRemove.includes(el.id),
          );
          if (
            elementIdsToRemove.includes(currentState.selectedElementId || "")
          ) {
            updatedSelectedElementId = null;
            updatedSelectedElementProps = {};
          }
          break;
        }

        case "update": {
          if (entry.data.diff) {
            updatedElements = applySerializedHistoryDiff(
              currentState.elements,
              entry.data.diff,
              "undo",
            );
            updatedSelectedElementProps = resolveSelectedPropsAfterBatch(
              currentState.selectedElementId,
              currentState.selectedElementProps,
              updatedElements,
            );
            break;
          }

          // 이전 상태로 복원 (불변 업데이트)
          const elementIndex = currentState.elements.findIndex(
            (el) => el.id === entry.elementId,
          );
          if (elementIndex >= 0 && prevProps) {
            const element = currentState.elements[elementIndex];

            updatedElements = currentState.elements.map((el, i) =>
              i === elementIndex ? { ...el, props: prevProps } : el,
            );

            // 선택된 요소가 업데이트된 경우 selectedElementProps도 업데이트
            if (currentState.selectedElementId === entry.elementId) {
              const restoredElement = { ...element, props: prevProps };
              updatedSelectedElementProps = createCompleteProps(
                restoredElement,
                prevProps,
              );
            }
          } else if (elementIndex >= 0 && prevElement) {
            // 전체 요소가 저장된 경우
            updatedElements = currentState.elements.map((el, i) =>
              i === elementIndex ? { ...el, ...prevElement } : el,
            );
          } else {
            console.warn("⚠️ Undo 실패: 요소 또는 이전 데이터를 찾을 수 없음", {
              elementId: entry.elementId,
              elementFound: elementIndex >= 0,
              prevPropsFound: !!prevProps,
              prevElementFound: !!prevElement,
            });
          }
          break;
        }

        case "remove": {
          // 삭제된 요소와 자식 요소들 복원

          elementsToRestore.forEach((el, index) => {});

          updatedElements = [...currentState.elements, ...elementsToRestore];
          break;
        }

        case "batch": {
          if (entry.data.diffs?.length) {
            updatedElements = applySerializedHistoryDiffs(
              currentState.elements,
              entry.data.diffs,
              "undo",
            );
            updatedSelectedElementProps = resolveSelectedPropsAfterBatch(
              currentState.selectedElementId,
              currentState.selectedElementProps,
              updatedElements,
            );
          } else if (entry.data.prevElements && entry.data.elements) {
            const prevElements = entry.data.prevElements.map((element) =>
              cloneForHistory(element),
            );
            const nextIds = new Set(
              entry.data.elements.map((element) => element.id),
            );
            updatedElements = applyElementSnapshotBatch(
              currentState.elements,
              nextIds,
              prevElements,
            );
            updatedSelectedElementProps = resolveSelectedPropsAfterBatch(
              currentState.selectedElementId,
              currentState.selectedElementProps,
              updatedElements,
            );
          } else if (entry.data.batchUpdates) {
            // Batch update Undo - 각 요소의 이전 props 복원

            // 업데이트 맵 생성
            const updateMap = new Map<string, ComponentElementProps>();
            entry.data.batchUpdates.forEach(
              (update: {
                elementId: string;
                prevProps: ComponentElementProps;
              }) => {
                updateMap.set(update.elementId, update.prevProps);
              },
            );

            updatedElements = currentState.elements.map((el) => {
              const prevPropsForEl = updateMap.get(el.id);
              if (prevPropsForEl) {
                return { ...el, props: prevPropsForEl };
              }
              return el;
            });

            // 선택된 요소가 업데이트된 경우
            const selectedPrevProps = updateMap.get(
              currentState.selectedElementId || "",
            );
            if (selectedPrevProps) {
              const selectedEl = updatedElements.find(
                (el) => el.id === currentState.selectedElementId,
              );
              if (selectedEl) {
                updatedSelectedElementProps = createCompleteProps(
                  selectedEl,
                  selectedPrevProps,
                );
              }
            }
          }
          break;
        }

        case "group": {
          // Group 생성 Undo - 그룹 삭제 + 자식들 원래 parent로 이동

          // 1. 그룹 요소 삭제
          let filteredElements = currentState.elements.filter(
            (el) => !elementIdsToRemove.includes(el.id),
          );

          // 2. 자식 요소들을 원래 parent로 이동
          if (entry.data.elements) {
            const childUpdates = new Map<
              string,
              { parent_id: string | null }
            >();
            entry.data.elements.forEach((prevChild: Element) => {
              childUpdates.set(prevChild.id, {
                parent_id: prevChild.parent_id ?? null,
              });
            });

            filteredElements = filteredElements.map((el) => {
              const update = childUpdates.get(el.id);
              if (update) {
                return {
                  ...el,
                  parent_id: update.parent_id,
                };
              }
              return el;
            });
          }

          updatedElements = filteredElements;

          // 3. 선택 상태 업데이트
          if (
            elementIdsToRemove.includes(currentState.selectedElementId || "")
          ) {
            updatedSelectedElementId = null;
            updatedSelectedElementProps = {};
          }
          break;
        }

        case "ungroup": {
          // Ungroup Undo - 그룹 재생성 + 자식들 그룹 안으로 이동

          // 1. 그룹 요소 복원
          let restoredElements = [
            ...currentState.elements,
            ...elementsToRestore,
          ];

          // 2. 자식 요소들을 그룹 안으로 이동
          if (entry.data.elements) {
            const childIds = new Set(
              entry.data.elements.map((prevChild: Element) => prevChild.id),
            );

            restoredElements = restoredElements.map((el) => {
              if (childIds.has(el.id)) {
                return {
                  ...el,
                  parent_id: entry.elementId,
                };
              }
              return el;
            });
          }

          updatedElements = restoredElements;
          break;
        }
      }

    // HC#2 (canonical 1차) — legacy fallback (v1 IndexedDB entry 전용) 도
    // canonical 을 먼저 갱신하고, set 은 canonical 재파생 결과를 사용해
    // legacy mirror ↔ canonical 발산을 원천 차단 (ADR-122 §Residual 해소,
    // 2026-07-15 — 신규 entry 는 전부 canonicalEvents 부착이라 이 분기는
    // 구 IndexedDB v1 entry 전용).
    if (!appliedCanonicalEvents) {
      syncHistoryElementsToCanonical(updatedElements);
      updatedElements = getActiveCanonicalHistoryElements() ?? updatedElements;
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
      void appliedCanonicalEvents;
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

    // 1. 메모리 상태 업데이트 (우선) - 안전한 데이터 복사
    const elementsToAdd: Element[] = [];
    let elementIdsToRemove: string[] = [];
    let propsToUpdate: ComponentElementProps | null = null;
    let elementToUpdate: Element | null = null;

    // produce 밖에서 안전하게 데이터 준비
    try {
      switch (entry.type) {
        case "add": {
          // 🚀 Phase 2: structuredClone 사용
          if (entry.data.element) {
            elementsToAdd.push(cloneForHistory(entry.data.element));
          }
          if (entry.data.childElements && entry.data.childElements.length > 0) {
            elementsToAdd.push(
              ...entry.data.childElements.map((child: Element) =>
                cloneForHistory(child),
              ),
            );
          }
          break;
        }

        case "update": {
          // 🚀 Phase 2: structuredClone 사용
          if (entry.data.element) {
            elementToUpdate = cloneForHistory(entry.data.element);
          }
          if (entry.data.props) {
            propsToUpdate = cloneForHistory(entry.data.props);
          }
          break;
        }

        case "remove": {
          elementIdsToRemove = [entry.elementId];
          if (entry.data.childElements && entry.data.childElements.length > 0) {
            elementIdsToRemove.push(
              ...entry.data.childElements.map((child: Element) => child.id),
            );
          }
          break;
        }

        case "batch": {
          // Batch update Redo - newProps 데이터 준비
          break;
        }

        case "group": {
          // Group 생성 Redo - 그룹 요소 추가 준비
          // 🚀 Phase 2: structuredClone 사용
          if (entry.data.element) {
            elementsToAdd.push(cloneForHistory(entry.data.element));
          }
          break;
        }

        case "ungroup": {
          // Ungroup Redo - 그룹 요소 삭제 준비
          elementIdsToRemove = [entry.elementId];
          break;
        }
      }
    } catch (error) {
      console.warn("⚠️ 히스토리 데이터 준비 중 오류:", error);
      set({ historyOperationInProgress: false });
      return;
    }

    // 🚀 Phase 1: Immer → 함수형 업데이트
    const currentState = {
      ...get(),
      elements: getHistorySourceElements(get),
    };
    let updatedElements = currentState.elements;
    let updatedSelectedElementId = currentState.selectedElementId;
    let updatedSelectedElementProps = currentState.selectedElementProps;
    const canonicalEventElements = applyCanonicalHistoryEventsToActiveDocument(
      entry.data.canonicalEvents,
      "redo",
    );
    const appliedCanonicalEvents = canonicalEventElements !== null;

    if (canonicalEventElements) {
      updatedElements = canonicalEventElements;
      const selection = resolveSelectionAfterCanonicalEvents(
        currentState.selectedElementId,
        currentState.selectedElementProps,
        updatedElements,
      );
      updatedSelectedElementId = selection.selectedElementId;
      updatedSelectedElementProps = selection.selectedElementProps;
    } else
      switch (entry.type) {
        case "add": {
          // 요소와 자식 요소들 추가
          updatedElements = [...currentState.elements, ...elementsToAdd];
          break;
        }

        case "update": {
          // 업데이트 적용 (불변 업데이트)
          if (entry.data.diff) {
            updatedElements = applySerializedHistoryDiff(
              currentState.elements,
              entry.data.diff,
              "redo",
            );
            updatedSelectedElementProps = resolveSelectedPropsAfterBatch(
              currentState.selectedElementId,
              currentState.selectedElementProps,
              updatedElements,
            );
            break;
          }

          const elementIndex = currentState.elements.findIndex(
            (el) => el.id === entry.elementId,
          );
          if (elementIndex >= 0 && elementToUpdate) {
            updatedElements = currentState.elements.map((el, i) =>
              i === elementIndex ? { ...el, ...elementToUpdate } : el,
            );
            if (currentState.selectedElementId === entry.elementId) {
              updatedSelectedElementProps =
                createCompleteProps(elementToUpdate);
            }
          } else if (elementIndex >= 0 && propsToUpdate) {
            updatedElements = currentState.elements.map((el, i) =>
              i === elementIndex
                ? { ...el, props: { ...el.props, ...propsToUpdate } }
                : el,
            );
          }
          break;
        }

        case "remove": {
          // 요소와 자식 요소들 제거
          updatedElements = currentState.elements.filter(
            (el) => !elementIdsToRemove.includes(el.id),
          );
          if (
            elementIdsToRemove.includes(currentState.selectedElementId || "")
          ) {
            updatedSelectedElementId = null;
            updatedSelectedElementProps = {};
          }
          break;
        }

        case "batch": {
          if (entry.data.diffs?.length) {
            updatedElements = applySerializedHistoryDiffs(
              currentState.elements,
              entry.data.diffs,
              "redo",
            );
            updatedSelectedElementProps = resolveSelectedPropsAfterBatch(
              currentState.selectedElementId,
              currentState.selectedElementProps,
              updatedElements,
            );
          } else if (entry.data.prevElements && entry.data.elements) {
            const nextElements = entry.data.elements.map((element) =>
              cloneForHistory(element),
            );
            const prevIds = new Set(
              entry.data.prevElements.map((element) => element.id),
            );
            updatedElements = applyElementSnapshotBatch(
              currentState.elements,
              prevIds,
              nextElements,
            );
            updatedSelectedElementProps = resolveSelectedPropsAfterBatch(
              currentState.selectedElementId,
              currentState.selectedElementProps,
              updatedElements,
            );
          } else if (entry.data.batchUpdates) {
            // Batch update Redo - 각 요소의 newProps 적용

            // 업데이트 맵 생성
            const updateMap = new Map<string, ComponentElementProps>();
            entry.data.batchUpdates.forEach(
              (update: {
                elementId: string;
                newProps: ComponentElementProps;
              }) => {
                updateMap.set(update.elementId, update.newProps);
              },
            );

            updatedElements = currentState.elements.map((el) => {
              const newPropsForEl = updateMap.get(el.id);
              if (newPropsForEl) {
                return { ...el, props: { ...el.props, ...newPropsForEl } };
              }
              return el;
            });

            // 선택된 요소가 업데이트된 경우
            const selectedNewProps = updateMap.get(
              currentState.selectedElementId || "",
            );
            if (selectedNewProps) {
              const selectedEl = updatedElements.find(
                (el) => el.id === currentState.selectedElementId,
              );
              if (selectedEl) {
                updatedSelectedElementProps = createCompleteProps(selectedEl, {
                  ...selectedEl.props,
                  ...selectedNewProps,
                });
              }
            }
          }
          break;
        }

        case "group": {
          // Group 생성 Redo - 그룹 추가 + 자식들 그룹 안으로 이동

          // 1. 그룹 요소 추가
          let newElements = [...currentState.elements, ...elementsToAdd];

          // 2. 자식 요소들을 그룹 안으로 이동
          if (entry.data.elements) {
            const childIds = new Set(
              entry.data.elements.map((prevChild: Element) => prevChild.id),
            );

            newElements = newElements.map((el) => {
              if (childIds.has(el.id)) {
                return {
                  ...el,
                  parent_id: entry.elementId,
                };
              }
              return el;
            });
          }

          updatedElements = newElements;
          break;
        }

        case "ungroup": {
          // Ungroup Redo - 그룹 삭제 + 자식들 원래 parent로 이동

          // 1. 그룹 요소 삭제
          let filteredElements = currentState.elements.filter(
            (el) => !elementIdsToRemove.includes(el.id),
          );

          // 2. 자식 요소들을 원래 parent로 이동
          if (entry.data.elements) {
            const childUpdates = new Map<
              string,
              { parent_id: string | null }
            >();
            entry.data.elements.forEach((prevChild: Element) => {
              childUpdates.set(prevChild.id, {
                parent_id: prevChild.parent_id ?? null,
              });
            });

            filteredElements = filteredElements.map((el) => {
              const update = childUpdates.get(el.id);
              if (update) {
                return {
                  ...el,
                  parent_id: update.parent_id,
                };
              }
              return el;
            });
          }

          updatedElements = filteredElements;

          // 3. 선택 상태 업데이트
          if (
            elementIdsToRemove.includes(currentState.selectedElementId || "")
          ) {
            updatedSelectedElementId = null;
            updatedSelectedElementProps = {};
          }
          break;
        }
      }

    // HC#2 (canonical 1차) — undo 와 동일: legacy fallback (v1 entry 전용) 은
    // canonical 먼저 갱신 후 재파생 결과로 set (ADR-122 §Residual 해소).
    if (!appliedCanonicalEvents) {
      syncHistoryElementsToCanonical(updatedElements);
      updatedElements = getActiveCanonicalHistoryElements() ?? updatedElements;
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
      void appliedCanonicalEvents;
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
      let allEntriesAppliedAsCanonicalEvents = entries.length > 0;

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
        if (!entry.data.canonicalEvents?.length) {
          allEntriesAppliedAsCanonicalEvents = false;
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

      // HC#2 (canonical 1차) — undo/redo 와 동일: 혼합(v1 포함) 시퀀스는
      // canonical 먼저 갱신 후 재파생 결과로 set (ADR-122 §Residual 해소).
      if (!allEntriesAppliedAsCanonicalEvents) {
        syncHistoryElementsToCanonical(updatedElements);
        updatedElements =
          getActiveCanonicalHistoryElements() ?? updatedElements;
      }

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
  if (canonicalEventElements) {
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

  let updatedElements = elements;
  let updatedSelectedElementId = selectedElementId;
  let updatedSelectedElementProps = selectedElementProps;

  if (direction === "undo") {
    switch (entry.type) {
      case "add": {
        // 추가된 요소 제거
        const elementIdsToRemove = [entry.elementId];
        if (entry.data.childElements?.length) {
          elementIdsToRemove.push(
            ...entry.data.childElements.map((child: Element) => child.id),
          );
        }
        updatedElements = elements.filter(
          (el) => !elementIdsToRemove.includes(el.id),
        );
        if (elementIdsToRemove.includes(selectedElementId || "")) {
          updatedSelectedElementId = null;
          updatedSelectedElementProps = {};
        }
        break;
      }

      case "update": {
        if (entry.data.diff) {
          updatedElements = applySerializedHistoryDiff(
            elements,
            entry.data.diff,
            "undo",
          );
          updatedSelectedElementProps = resolveSelectedPropsAfterBatch(
            selectedElementId,
            selectedElementProps,
            updatedElements,
          );
          break;
        }

        const prevProps = entry.data.prevProps
          ? cloneForHistory(entry.data.prevProps)
          : null;
        const prevElement = entry.data.prevElement
          ? cloneForHistory(entry.data.prevElement)
          : null;
        const elementIndex = elements.findIndex(
          (el) => el.id === entry.elementId,
        );
        if (elementIndex >= 0 && prevProps) {
          updatedElements = elements.map((el, i) =>
            i === elementIndex ? { ...el, props: prevProps } : el,
          );
          if (selectedElementId === entry.elementId) {
            const restoredElement = {
              ...elements[elementIndex],
              props: prevProps,
            };
            updatedSelectedElementProps = createCompleteProps(
              restoredElement,
              prevProps,
            );
          }
        } else if (elementIndex >= 0 && prevElement) {
          updatedElements = elements.map((el, i) =>
            i === elementIndex ? { ...el, ...prevElement } : el,
          );
        }
        break;
      }

      case "remove": {
        // 삭제된 요소 복원 (중복 방지)
        const elementsToRestore: Element[] = [];
        const existingIds = new Set(elements.map((el) => el.id));
        if (entry.data.element && !existingIds.has(entry.data.element.id)) {
          elementsToRestore.push(cloneForHistory(entry.data.element));
          existingIds.add(entry.data.element.id);
        }
        if (entry.data.childElements?.length) {
          for (const child of entry.data.childElements) {
            if (!existingIds.has(child.id)) {
              elementsToRestore.push(cloneForHistory(child));
              existingIds.add(child.id);
            }
          }
        }
        updatedElements = [...elements, ...elementsToRestore];
        break;
      }

      case "batch": {
        if (entry.data.diffs?.length) {
          updatedElements = applySerializedHistoryDiffs(
            elements,
            entry.data.diffs,
            "undo",
          );
          updatedSelectedElementProps = resolveSelectedPropsAfterBatch(
            selectedElementId,
            selectedElementProps,
            updatedElements,
          );
        } else if (entry.data.prevElements && entry.data.elements) {
          const prevElements = entry.data.prevElements.map((element) =>
            cloneForHistory(element),
          );
          const nextIds = new Set(
            entry.data.elements.map((element) => element.id),
          );
          updatedElements = applyElementSnapshotBatch(
            elements,
            nextIds,
            prevElements,
          );
          updatedSelectedElementProps = resolveSelectedPropsAfterBatch(
            selectedElementId,
            selectedElementProps,
            updatedElements,
          );
        } else if (entry.data.batchUpdates) {
          const updateMap = new Map<string, ComponentElementProps>();
          entry.data.batchUpdates.forEach(
            (update: {
              elementId: string;
              prevProps: ComponentElementProps;
            }) => {
              updateMap.set(update.elementId, update.prevProps);
            },
          );
          updatedElements = elements.map((el) => {
            const prevPropsForEl = updateMap.get(el.id);
            return prevPropsForEl ? { ...el, props: prevPropsForEl } : el;
          });
          const selectedPrevProps = updateMap.get(selectedElementId || "");
          if (selectedPrevProps) {
            const selectedEl = updatedElements.find(
              (el) => el.id === selectedElementId,
            );
            if (selectedEl) {
              updatedSelectedElementProps = createCompleteProps(
                selectedEl,
                selectedPrevProps,
              );
            }
          }
        }
        break;
      }

      case "group": {
        // 그룹 삭제 + 자식들 원래 parent로
        let filteredElements = elements.filter(
          (el) => el.id !== entry.elementId,
        );
        if (entry.data.elements) {
          const childUpdates = new Map<string, { parent_id: string | null }>();
          entry.data.elements.forEach((prevChild: Element) => {
            childUpdates.set(prevChild.id, {
              parent_id: prevChild.parent_id ?? null,
            });
          });
          filteredElements = filteredElements.map((el) => {
            const update = childUpdates.get(el.id);
            return update
              ? {
                  ...el,
                  parent_id: update.parent_id,
                }
              : el;
          });
        }
        updatedElements = filteredElements;
        if (selectedElementId === entry.elementId) {
          updatedSelectedElementId = null;
          updatedSelectedElementProps = {};
        }
        break;
      }

      case "ungroup": {
        // 그룹 복원 + 자식들 그룹 안으로 (중복 방지)
        const elementsToRestore: Element[] = [];
        const existingIdsForUngroup = new Set(elements.map((el) => el.id));
        if (
          entry.data.element &&
          !existingIdsForUngroup.has(entry.data.element.id)
        ) {
          elementsToRestore.push(cloneForHistory(entry.data.element));
        }
        let restoredElements = [...elements, ...elementsToRestore];
        if (entry.data.elements) {
          const childIds = new Set(
            entry.data.elements.map((prevChild: Element) => prevChild.id),
          );
          restoredElements = restoredElements.map((el) => {
            return childIds.has(el.id)
              ? {
                  ...el,
                  parent_id: entry.elementId,
                }
              : el;
          });
        }
        updatedElements = restoredElements;
        break;
      }
    }
  } else {
    // Redo 방향
    switch (entry.type) {
      case "add": {
        // 요소 추가 (중복 방지)
        const existingIdsForAdd = new Set(elements.map((el) => el.id));
        const elementsToAdd: Element[] = [];
        if (
          entry.data.element &&
          !existingIdsForAdd.has(entry.data.element.id)
        ) {
          elementsToAdd.push(cloneForHistory(entry.data.element));
          existingIdsForAdd.add(entry.data.element.id);
        }
        if (entry.data.childElements?.length) {
          for (const child of entry.data.childElements) {
            if (!existingIdsForAdd.has(child.id)) {
              elementsToAdd.push(cloneForHistory(child));
              existingIdsForAdd.add(child.id);
            }
          }
        }
        updatedElements = [...elements, ...elementsToAdd];
        break;
      }

      case "update": {
        if (entry.data.diff) {
          updatedElements = applySerializedHistoryDiff(
            elements,
            entry.data.diff,
            "redo",
          );
          updatedSelectedElementProps = resolveSelectedPropsAfterBatch(
            selectedElementId,
            selectedElementProps,
            updatedElements,
          );
          break;
        }

        const propsToUpdate = entry.data.props
          ? cloneForHistory(entry.data.props)
          : null;
        const elementToUpdate = entry.data.element
          ? cloneForHistory(entry.data.element)
          : null;
        const elementIndex = elements.findIndex(
          (el) => el.id === entry.elementId,
        );
        if (elementIndex >= 0 && elementToUpdate) {
          updatedElements = elements.map((el, i) =>
            i === elementIndex ? { ...el, ...elementToUpdate } : el,
          );
          if (selectedElementId === entry.elementId) {
            updatedSelectedElementProps = createCompleteProps(elementToUpdate);
          }
        } else if (elementIndex >= 0 && propsToUpdate) {
          updatedElements = elements.map((el, i) =>
            i === elementIndex
              ? { ...el, props: { ...el.props, ...propsToUpdate } }
              : el,
          );
        }
        break;
      }

      case "remove": {
        const elementIdsToRemove = [entry.elementId];
        if (entry.data.childElements?.length) {
          elementIdsToRemove.push(
            ...entry.data.childElements.map((child: Element) => child.id),
          );
        }
        updatedElements = elements.filter(
          (el) => !elementIdsToRemove.includes(el.id),
        );
        if (elementIdsToRemove.includes(selectedElementId || "")) {
          updatedSelectedElementId = null;
          updatedSelectedElementProps = {};
        }
        break;
      }

      case "batch": {
        if (entry.data.diffs?.length) {
          updatedElements = applySerializedHistoryDiffs(
            elements,
            entry.data.diffs,
            "redo",
          );
          updatedSelectedElementProps = resolveSelectedPropsAfterBatch(
            selectedElementId,
            selectedElementProps,
            updatedElements,
          );
        } else if (entry.data.prevElements && entry.data.elements) {
          const nextElements = entry.data.elements.map((element) =>
            cloneForHistory(element),
          );
          const prevIds = new Set(
            entry.data.prevElements.map((element) => element.id),
          );
          updatedElements = applyElementSnapshotBatch(
            elements,
            prevIds,
            nextElements,
          );
          updatedSelectedElementProps = resolveSelectedPropsAfterBatch(
            selectedElementId,
            selectedElementProps,
            updatedElements,
          );
        } else if (entry.data.batchUpdates) {
          const updateMap = new Map<string, ComponentElementProps>();
          entry.data.batchUpdates.forEach(
            (update: {
              elementId: string;
              newProps: ComponentElementProps;
            }) => {
              updateMap.set(update.elementId, update.newProps);
            },
          );
          updatedElements = elements.map((el) => {
            const newPropsForEl = updateMap.get(el.id);
            return newPropsForEl
              ? { ...el, props: { ...el.props, ...newPropsForEl } }
              : el;
          });
          const selectedNewProps = updateMap.get(selectedElementId || "");
          if (selectedNewProps) {
            const selectedEl = updatedElements.find(
              (el) => el.id === selectedElementId,
            );
            if (selectedEl) {
              updatedSelectedElementProps = createCompleteProps(selectedEl, {
                ...selectedEl.props,
                ...selectedNewProps,
              });
            }
          }
        }
        break;
      }

      case "group": {
        // 그룹 요소 추가 (중복 방지)
        const existingIdsForGroup = new Set(elements.map((el) => el.id));
        const elementsToAdd: Element[] = [];
        if (
          entry.data.element &&
          !existingIdsForGroup.has(entry.data.element.id)
        ) {
          elementsToAdd.push(cloneForHistory(entry.data.element));
        }
        let newElements = [...elements, ...elementsToAdd];
        if (entry.data.elements) {
          const childIds = new Set(
            entry.data.elements.map((prevChild: Element) => prevChild.id),
          );
          newElements = newElements.map((el) => {
            return childIds.has(el.id)
              ? {
                  ...el,
                  parent_id: entry.elementId,
                }
              : el;
          });
        }
        updatedElements = newElements;
        break;
      }

      case "ungroup": {
        let filteredElements = elements.filter(
          (el) => el.id !== entry.elementId,
        );
        if (entry.data.elements) {
          const childUpdates = new Map<string, { parent_id: string | null }>();
          entry.data.elements.forEach((prevChild: Element) => {
            childUpdates.set(prevChild.id, {
              parent_id: prevChild.parent_id ?? null,
            });
          });
          filteredElements = filteredElements.map((el) => {
            const update = childUpdates.get(el.id);
            return update
              ? {
                  ...el,
                  parent_id: update.parent_id,
                }
              : el;
          });
        }
        updatedElements = filteredElements;
        if (selectedElementId === entry.elementId) {
          updatedSelectedElementId = null;
          updatedSelectedElementProps = {};
        }
        break;
      }
    }
  }

  return {
    elements: updatedElements,
    selectedElementId: updatedSelectedElementId,
    selectedElementProps: updatedSelectedElementProps,
  };
}

/**
 * 마지막 상태를 기준으로 canonical document와 cloud compatibility 동기화 (배치)
 */
async function syncDatabaseForEntries(
  entries: ReturnType<typeof historyManager.undo>[],
  direction: "undo" | "redo",
  get: GetState,
): Promise<void> {
  // 마지막 엔트리의 최종 상태만 동기화
  // 모든 중간 엔트리를 개별적으로 동기화하는 대신
  // 최종 elements 상태가 이미 메모리에 적용되어 있으므로
  // cloud compatibility에는 변경된 요소들만 업데이트

  const elementsMap = getHistoryCompatibilityElementsMap(get);

  // 영향받은 요소 ID 수집
  const affectedElementIds = new Set<string>();
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
    if (entry.data.canonicalEvents?.length) {
      const { upsertIds, deleteIds } = getCanonicalHistoryEventIds(
        entry.data.canonicalEvents,
        direction,
      );
      upsertIds.forEach((id) => affectedElementIds.add(id));
      deleteIds.forEach((id) => removedElementIds.add(id));
      continue;
    }

    if (direction === "undo") {
      switch (entry.type) {
        case "add":
          removedElementIds.add(entry.elementId);
          entry.data.childElements?.forEach((child: Element) =>
            removedElementIds.add(child.id),
          );
          break;
        case "update":
        case "batch":
          affectedElementIds.add(entry.elementId);
          entry.elementIds?.forEach((id) => affectedElementIds.add(id));
          getHistoryDiffElementIds(entry).forEach((id) =>
            affectedElementIds.add(id),
          );
          entry.data.batchUpdates?.forEach((u: { elementId: string }) =>
            affectedElementIds.add(u.elementId),
          );
          break;
        case "remove":
          affectedElementIds.add(entry.elementId);
          entry.data.childElements?.forEach((child: Element) =>
            affectedElementIds.add(child.id),
          );
          break;
        case "group":
          removedElementIds.add(entry.elementId);
          entry.data.elements?.forEach((el: Element) =>
            affectedElementIds.add(el.id),
          );
          break;
        case "ungroup":
          affectedElementIds.add(entry.elementId);
          entry.data.elements?.forEach((el: Element) =>
            affectedElementIds.add(el.id),
          );
          break;
      }
    } else {
      switch (entry.type) {
        case "add":
          affectedElementIds.add(entry.elementId);
          entry.data.childElements?.forEach((child: Element) =>
            affectedElementIds.add(child.id),
          );
          break;
        case "update":
        case "batch":
          affectedElementIds.add(entry.elementId);
          entry.elementIds?.forEach((id) => affectedElementIds.add(id));
          getHistoryDiffElementIds(entry).forEach((id) =>
            affectedElementIds.add(id),
          );
          entry.data.batchUpdates?.forEach((u: { elementId: string }) =>
            affectedElementIds.add(u.elementId),
          );
          break;
        case "remove":
          removedElementIds.add(entry.elementId);
          entry.data.childElements?.forEach((child: Element) =>
            removedElementIds.add(child.id),
          );
          break;
        case "group":
          affectedElementIds.add(entry.elementId);
          entry.data.elements?.forEach((el: Element) =>
            affectedElementIds.add(el.id),
          );
          break;
        case "ungroup":
          removedElementIds.add(entry.elementId);
          entry.data.elements?.forEach((el: Element) =>
            affectedElementIds.add(el.id),
          );
          break;
      }
    }
  }

  // ADR-128: cloud sync dead — IndexedDB persistence via persistActiveCanonicalDocument
  try {
    await persistActiveCanonicalDocument(removedElementIds.size);
    void affectedElementIds;
    void elementsMap;
  } catch (error) {
    console.warn("⚠️ GoToHistoryIndex DB 동기화 실패:", error);
  }
}
