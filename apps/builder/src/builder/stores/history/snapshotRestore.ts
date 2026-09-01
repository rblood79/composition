/**
 * @fileoverview 스냅샷 복원 시퀀스 — ADR-180 Phase 2
 *
 * 복원 = canonical document 전체 교체. 시퀀스는 boot hydrate
 * (`usePageManager.ts` initializeProject — setDocument → 페이지 모델 파생 →
 * mirror 전체 교체 → 페이지 위치 초기화 → persist) 와 **동형**이다 (G2:
 * 복원 결과 == 같은 문서 새로고침 hydrate 결과).
 *
 * store 접근은 call-site 주입 (`get`) — `historyActions.ts` 의 SetState/GetState
 * 주입 스타일과 동일. `useStore` 를 직접 import 하면
 * index → elements → historyActions → 본 모듈 → index 순환이 생긴다
 * (ADR-116 G6-2 가 canonicalMutations 에서 DI 로 차단한 것과 같은 축).
 *
 * undo/redo 계약 (ADR-177 early-branch 동형): `snapshot-restore` entry 는
 * element 노드 경로 미진입 — undo = beforeSnapshot / redo = afterSnapshot
 * 재적용. 참조 스냅샷이 소실됐으면 (user 삭제 / system rolling) no-op + 경고
 * (R5 fallback).
 */

import type { StateCreator } from "zustand";
import type { CompositionDocument } from "@composition/shared";
import { deriveProjectEditorPageModelFromDocument } from "@composition/shared";

import type { ElementsState } from "../elements";
import type { PageLayoutDirection } from "../canvasSettings";
import { getDB } from "../../../lib/db";
import { useCanonicalDocumentStore } from "../canonical/canonicalDocumentStore";
import { canonicalDocumentToElements } from "../canonical/canonicalElementsView";
import { useViewportSyncStore } from "../../workspace/canvas/stores";
import { resolvePageLayoutAvailableWidth } from "../../workspace/canvas/pageLayoutConstants";
import { historyManager, type HistoryEntry } from "../history";
import { snapshotManager } from "./snapshots";

type GetState = Parameters<StateCreator<ElementsState>>[1];

/** canvasSettings 슬라이스 필드 — ElementsState 타입에는 없지만 combined store 에 존재 */
type StoreWithSettings = ElementsState & {
  pageGap: number;
  pageLayoutDirection: PageLayoutDirection;
};

/**
 * 문서 전체 교체 + 파생 재구축 + persist (복원 시퀀스 2~4단계).
 * restore 본 흐름과 undo/redo 재적용이 공유하는 유일한 적용 경로.
 *
 * preview 재송신은 별도 호출 없음 — `useIframeMessenger` 의
 * `[activeCanonicalDocument]` effect 가 setDocument 를 감지해 자동 재송신.
 */
export async function applySnapshotDocument(
  get: GetState,
  projectId: string,
  doc: CompositionDocument,
): Promise<void> {
  // 스냅샷 캐시본 격리 — store/persist 에 캐시 객체를 직접 노출하지 않는다
  // (snapshots.ts 캡처 격리와 동일 계약, JSON round-trip)
  const docCopy = JSON.parse(JSON.stringify(doc)) as CompositionDocument;

  // 1. canonical 1차 (ADR-122 HC #2) — documentVersion 증가
  useCanonicalDocumentStore.getState().setDocument(projectId, docCopy);

  // 2. 파생 재구축 — boot hydrate (usePageManager) 동형
  const store = get() as StoreWithSettings;
  const renderModel = deriveProjectEditorPageModelFromDocument(
    docCopy,
    projectId,
  );
  const storePages = renderModel.pages.map((page) => ({
    ...page,
    parent_id: page.parent_id ?? null,
  }));
  const elements = canonicalDocumentToElements(docCopy);
  store.hydrateProjectSnapshot(elements);

  const canvasSize = useViewportSyncStore.getState().canvasSize;
  const viewport = useViewportSyncStore.getState();
  store.initializePagePositions(
    storePages,
    canvasSize.width,
    canvasSize.height,
    store.pageGap,
    store.pageLayoutDirection,
    docCopy.pagePositions,
    resolvePageLayoutAvailableWidth(
      viewport.containerSize.width,
      viewport.zoom,
      viewport.pageLayoutPanelMetrics,
    ),
  );
  store.setPages(storePages);

  // 3. 현재 페이지 재정합 — 복원본에 없는 페이지면 첫 페이지로
  const state = get();
  const pageIds = new Set(storePages.map((page) => page.id));
  const nextPageId =
    state.currentPageId && pageIds.has(state.currentPageId)
      ? state.currentPageId
      : (storePages[0]?.id ?? null);
  if (nextPageId) {
    state.activatePage(nextPageId);
  }

  // 4. persist — 과거 문서로의 복원은 node 수 급감이 의도된 문서 교체이므로
  //    급감 가드의 명시 escape (allowShrink) 대상 (documentPersistGuard —
  //    "대량 삭제가 의도된 흐름에서만 true" 계약. undo 는 before 스냅샷이 보장)
  const db = await getDB();
  await db.documents.put(projectId, docCopy, {
    allowShrink: true,
    reason: "snapshot-restore",
  });
}

/**
 * 사용자 복원 (패널 클릭) — 5단계 전체.
 * @returns 복원 수행 여부 (projectId/문서/대상 스냅샷 부재 시 false)
 */
export async function restoreSnapshot(
  get: GetState,
  snapshotId: string,
): Promise<boolean> {
  const canonical = useCanonicalDocumentStore.getState();
  const projectId = canonical.currentProjectId;
  if (!projectId) return false;
  const currentDoc = canonical.documents.get(projectId);
  if (!currentDoc) return false;

  await snapshotManager.loadProject(projectId);
  const target = snapshotManager.getSnapshot(projectId, snapshotId);
  if (!target) return false;

  // 복원 전 페이지 목록 캡처 — R4 clear 는 메모리 로드 페이지만으로는 부족하다
  // (히스토리 lazy 로드: 미방문 페이지의 IndexedDB 잔존분이 재방문 시 부활).
  // 복원 전/후 페이지 합집합을 전달해 프로젝트 페이지 전수를 clear 한다.
  const prevPageIds = get().pages.map((page) => page.id);

  // 1. 복원 직전 상태 자동 캡처 (undo 안전망 — system rolling 대상)
  const before = await snapshotManager.createSnapshot({
    projectId,
    doc: currentDoc,
    kind: "system",
    name: `복원 전 자동 저장 (${target.name})`,
  });

  // 2~4. 문서 교체 + 파생 재구축 + persist
  await applySnapshotDocument(get, projectId, target.doc);

  // 5. 타 페이지 히스토리 clear (R4 — stale delta 차단) + restore entry.
  //    현재 페이지 히스토리는 유지 — undo 가 restore entry 를 통과할 때
  //    before 전체본이 구 delta 의 전제 상태를 정확히 복원하므로 일관.
  const currentPageId = get().currentPageId;
  if (currentPageId) {
    const restoredPageIds = get().pages.map((page) => page.id);
    historyManager.clearOtherPageHistories(currentPageId, [
      ...prevPageIds,
      ...restoredPageIds,
    ]);
    historyManager.addEntry({
      type: "snapshot-restore",
      // 소비자 미해석 무해값 — page-position 의 elementId=pageId 관례 동일
      elementId: currentPageId,
      data: {
        snapshotRestoreEvent: {
          beforeSnapshotId: before.id,
          afterSnapshotId: target.id,
          snapshotName: target.name,
        },
      },
    });
  }
  return true;
}

/**
 * undo/redo/goToIndex 의 `snapshot-restore` entry 재적용 (early-branch 소비).
 * entry 를 새로 기록하지 않으며, 타 페이지 히스토리도 건드리지 않는다
 * (clear 는 최초 복원 시 1회 — 이미 소실된 히스토리는 재생 불가, R4 명시
 * 트레이드오프).
 */
export async function applySnapshotRestoreHistoryEntry(
  get: GetState,
  entry: HistoryEntry,
  direction: "undo" | "redo",
): Promise<void> {
  const event = entry.data.snapshotRestoreEvent;
  if (!event) return;
  const projectId = useCanonicalDocumentStore.getState().currentProjectId;
  if (!projectId) return;

  await snapshotManager.loadProject(projectId);
  const targetId =
    direction === "undo" ? event.beforeSnapshotId : event.afterSnapshotId;
  const snapshot = snapshotManager.getSnapshot(projectId, targetId);
  if (!snapshot) {
    // R5 fallback — 참조 스냅샷 소실 (user 삭제 / system rolling): no-op
    console.warn(
      "[SnapshotRestore] 참조 스냅샷 소실 — 적용 생략:",
      direction,
      event.snapshotName,
    );
    return;
  }
  await applySnapshotDocument(get, projectId, snapshot.doc);
}
