import { useStore } from "../../../stores";
import { historyManager } from "../../../stores/history";
import { useCanonicalDocumentStore } from "../../../stores/canonical/canonicalDocumentStore";
import { getDB } from "../../../../lib/db";
import { useViewportSyncStore } from "../stores";
import { PAGE_STACK_GAP } from "../pageLayoutConstants";

type BreakpointName = import("@composition/shared").BreakpointName;

/**
 * canonical document 를 IndexedDB 에 저장 — `elements.ts` 등의 동명 로컬 헬퍼와
 * 같은 5줄 (공용 심볼 추출은 별도 정리 대상, 현행 관례 준수).
 */
async function persistActiveCanonicalDocument(
  db: Awaited<ReturnType<typeof getDB>>,
): Promise<void> {
  const canonical = useCanonicalDocumentStore.getState();
  const projectId = canonical.currentProjectId;
  if (!projectId) return;
  const doc = canonical.documents.get(projectId);
  if (!doc) return;
  await db.documents.put(projectId, doc);
}

/**
 * 현재 breakpoint의 page 크기와 Settings의 배치 방향으로 모든 page를 재배치한다.
 * breakpoint 전환 자체는 page 위치를 변경하지 않으며, 이 명시적 command만 호출한다.
 *
 * ADR-177 Phase 2: 명시적 사용자 명령이므로 이동 결과를 문서 데이터로 기록한다 —
 * 전 페이지 재배치를 **단일 batch 히스토리 entry** 로 (Cmd+Z 1회 전체 복귀,
 * HC5) + canonical `pagePositions` batch 기록 + persist. 위치 무변경이면 전부
 * no-op (lazy write).
 */
export function alignPagesToScreen(): void {
  const { canvasSize } = useViewportSyncStore.getState();
  const { initializePagePositions, pageLayoutDirection, pages } =
    useStore.getState();

  if (pages.length === 0 || canvasSize.width <= 0 || canvasSize.height <= 0) {
    return;
  }

  const storeState = useStore.getState();
  const beforePositions = { ...storeState.pagePositions };
  const activeBreakpoint = (
    storeState as typeof storeState & { activeBreakpoint: BreakpointName }
  ).activeBreakpoint;

  initializePagePositions(
    pages,
    canvasSize.width,
    canvasSize.height,
    PAGE_STACK_GAP,
    pageLayoutDirection,
  );

  const afterPositions = useStore.getState().pagePositions;
  const entries = pages.flatMap((page) => {
    const before = beforePositions[page.id];
    const after = afterPositions[page.id];
    if (!before || !after) return [];
    if (before.x === after.x && before.y === after.y) return [];
    return [
      {
        pageId: page.id,
        breakpoint: activeBreakpoint,
        before: { ...before },
        after: { ...after },
      },
    ];
  });
  if (entries.length === 0) return;

  historyManager.addEntry({
    type: "page-position",
    elementId: entries[0].pageId,
    data: { pagePositionEvent: { entries } },
  });
  useCanonicalDocumentStore.getState().setPagePositions(
    entries.map((entry) => ({
      pageId: entry.pageId,
      breakpoint: entry.breakpoint,
      position: entry.after,
    })),
  );
  queueMicrotask(() => {
    void (async () => {
      try {
        const db = await getDB();
        await persistActiveCanonicalDocument(db);
      } catch (error) {
        console.error("[alignPagesToScreen] DB persist:", error);
      }
    })();
  });
}
