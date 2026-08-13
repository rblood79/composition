/**
 * 수동 가이드 기록 진입점 — ADR-181 Phase 3
 *
 * `pageLayoutActions.alignPagesToScreen` (ADR-177) 과 같은 층·같은 어법이다:
 * 히스토리 entry 1개 + canonical batch write + persist 를 한 묶음으로 낸다.
 * 호출자(Phase 5 인터랙션)는 "무엇이 어떻게 바뀌었나" 만 넘긴다.
 *
 * **호출 시점은 finish 1회** (드래그 중 0회 — HC1). 드래그 중 좌표는 transient
 * 채널이 나르고, 여기까지 오는 것은 확정된 결과뿐이다.
 */

import type { BreakpointName, PageGuideLine } from "@composition/shared";

import { getDB } from "../../../../lib/db";
import { useCanonicalDocumentStore } from "../../../stores/canonical/canonicalDocumentStore";
import { historyManager } from "../../../stores/history";
import { bumpPageGuideRevision } from "../interaction/pageGuideRevision";

/**
 * canonical document 를 IndexedDB 에 저장 — `pageLayoutActions.ts` 의 동명
 * 로컬 헬퍼와 같은 5줄 (공용 심볼 추출은 별도 정리 대상, 현행 관례 준수).
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
 * 드래그 결과를 문서에 반영한다 — 생성/이동/삭제가 한 진입점 (ADR-181 Phase 5).
 *
 * 세 조작이 결국 "그 페이지의 목록이 어떻게 바뀌었나" 하나로 수렴하기 때문에
 * 분기가 여기 한 곳에만 있다. `commitPageGuideChanges` 가 무변경을 걸러내므로
 * 제자리에 놓은 드래그는 히스토리에 남지 않는다.
 *
 * **커밋하지 않는 경우**: 페이지 위가 아닌 곳에 놓은 생성 드래그. 소속이
 * 없는 가이드는 표현할 수 없다 (C9 — 가이드는 페이지 귀속).
 */
export function commitGuideDrag(
  drag: {
    kind: "create" | "move";
    guideId: string;
    axis: "x" | "y";
    pageId: string | null;
    position: number;
    removing: boolean;
    originPageId: string | null;
  },
  breakpoint: BreakpointName,
): void {
  const owner = drag.removing ? drag.originPageId : (drag.pageId ?? null);
  if (!owner) return;

  const before = readPageGuides(owner, breakpoint);
  const without = before.filter((line) => line.id !== drag.guideId);
  const after =
    drag.removing || (!drag.pageId && drag.kind === "create")
      ? without
      : [
          ...without,
          { id: drag.guideId, axis: drag.axis, position: drag.position },
        ];

  commitPageGuideChanges([{ pageId: owner, breakpoint, before, after }]);
}

export interface PageGuideChange {
  pageId: string;
  breakpoint: BreakpointName;
  /** 변경 전 목록 전체 (부분 diff 아님) */
  before: readonly PageGuideLine[];
  /** 변경 후 목록 전체 */
  after: readonly PageGuideLine[];
}

/**
 * 한 (pageId × breakpoint) 의 현재 가이드 목록.
 *
 * entry 부재를 빈 목록으로 읽는 것이 C9 계약이다 — 호출자가 `?? []` 를 각자
 * 쓰면 그 계약이 여러 곳으로 흩어진다.
 */
export function readPageGuides(
  pageId: string,
  breakpoint: BreakpointName,
): PageGuideLine[] {
  const canonical = useCanonicalDocumentStore.getState();
  const projectId = canonical.currentProjectId;
  if (!projectId) return [];
  const doc = canonical.documents.get(projectId);
  return doc?.pageGuides?.[pageId]?.[breakpoint] ?? [];
}

/**
 * 활성 breakpoint 의 전 페이지 가이드 — 렌더 패스용 (ADR-181 Phase 4).
 *
 * **빈 map 을 재사용한다**. `pageGuides` 필드가 아예 없는 것이 통상이고 이
 * 함수는 프레임마다 불리므로, 그 경로에서 할당이 0 이어야 한다.
 *
 * breakpoint 를 인자로 받는 이유는 의존을 드러내기 위해서다 — 활성
 * breakpoint 가 바뀌면 목록이 통째로 갈린다는 것(C9)이 시그니처에 보이고,
 * 테스트가 store 없이 돈다.
 */
export function readPageGuidesByPage(
  breakpoint: BreakpointName,
): ReadonlyMap<string, readonly PageGuideLine[]> {
  const canonical = useCanonicalDocumentStore.getState();
  const projectId = canonical.currentProjectId;
  if (!projectId) return EMPTY_GUIDE_MAP;
  const pageGuides = canonical.documents.get(projectId)?.pageGuides;
  if (!pageGuides) return EMPTY_GUIDE_MAP;

  let result: Map<string, readonly PageGuideLine[]> | null = null;
  for (const pageId of Object.keys(pageGuides)) {
    const guides = pageGuides[pageId]?.[breakpoint];
    if (!guides || guides.length === 0) continue;
    (result ??= new Map()).set(pageId, guides);
  }
  return result ?? EMPTY_GUIDE_MAP;
}

/**
 * 드래그 스냅용 가이드 라인 (scene 좌표) — ADR-181 Phase 6.
 *
 * **드래그 시작 시 1회만** 부른다 (C2 — 후보 수집 상한 계약). 프레임 경로에서
 * 부르면 ADR-179 R1 이 막아 둔 그 비용이 그대로 돌아온다.
 *
 * `excludePageIds` 는 **드래그 대상 페이지**다. 가이드는 페이지-로컬이라
 * 페이지와 함께 움직이므로, 자기 가이드에 자기가 흡착하면 어디서도 떨어지지
 * 않는다.
 */
export function collectGuideSnapLines(
  breakpoint: BreakpointName,
  pagePositions: Readonly<Record<string, { x: number; y: number } | undefined>>,
  excludePageIds?: ReadonlySet<string>,
): { x: number[]; y: number[] } {
  const lines = { x: [] as number[], y: [] as number[] };
  for (const [pageId, guides] of readPageGuidesByPage(breakpoint)) {
    if (excludePageIds?.has(pageId)) continue;
    const origin = pagePositions[pageId];
    if (!origin) continue;
    for (const guide of guides) {
      if (guide.axis === "x") lines.x.push(origin.x + guide.position);
      else lines.y.push(origin.y + guide.position);
    }
  }
  return lines;
}

const EMPTY_GUIDE_MAP: ReadonlyMap<string, readonly PageGuideLine[]> =
  new Map();

function sameGuideList(
  left: readonly PageGuideLine[],
  right: readonly PageGuideLine[],
): boolean {
  if (left.length !== right.length) return false;
  for (let i = 0; i < left.length; i++) {
    const a = left[i];
    const b = right[i];
    if (a.id !== b.id || a.axis !== b.axis || a.position !== b.position) {
      return false;
    }
  }
  return true;
}

/** 실제로 달라진 항목만 남긴다 (lazy write — 순수 함수) */
export function filterChangedGuideEntries(
  changes: readonly PageGuideChange[],
): PageGuideChange[] {
  return changes.filter(
    (change) => !sameGuideList(change.before, change.after),
  );
}

/**
 * 가이드 변경을 확정한다 — 히스토리 1 entry + canonical + persist + 재렌더.
 *
 * 변경 없는 항목은 걸러내고, 전부 없으면 **아무것도 하지 않는다** (히스토리에
 * 빈 entry 가 쌓이면 Cmd+Z 가 시각적으로 무반응인 구간을 만든다).
 */
export function commitPageGuideChanges(
  changes: readonly PageGuideChange[],
): void {
  const effective = filterChangedGuideEntries(changes);
  if (effective.length === 0) return;

  historyManager.addEntry({
    type: "page-guide",
    // 소비자 미해석 무해값 (ADR-177 breakdown §5 C5 동형)
    elementId: effective[0].pageId,
    data: {
      pageGuideEvent: {
        entries: effective.map((change) => ({
          pageId: change.pageId,
          breakpoint: change.breakpoint,
          before: change.before.map((guide) => ({ ...guide })),
          after: change.after.map((guide) => ({ ...guide })),
        })),
      },
    },
  });

  useCanonicalDocumentStore.getState().setPageGuides(
    effective.map((change) => ({
      pageId: change.pageId,
      breakpoint: change.breakpoint,
      guides: change.after.map((guide) => ({ ...guide })),
    })),
  );
  bumpPageGuideRevision();

  queueMicrotask(() => {
    void (async () => {
      try {
        const db = await getDB();
        await persistActiveCanonicalDocument(db);
      } catch (error) {
        console.error("[commitPageGuideChanges] DB persist:", error);
      }
    })();
  });
}
