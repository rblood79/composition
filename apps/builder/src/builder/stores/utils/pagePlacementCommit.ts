/**
 * ADR-232 Phase 2 — 배치 편집 쓰기 1지점.
 *
 * 드래그 finish · Styles Transform X/Y · 방향키 nudge · align 이 전부 여기로 들어온다.
 * 저장 좌표를 쓰던 `updatePagePosition` / `updatePagePositionsBatch` / `alignPagesToScreen` 의
 * 파생 모드 대응물이며, 쓰기는 **canonical `pageLayout.placements` 한 곳** 이다
 * (store 미러 없음 — 위치는 파생값이므로 저장할 것이 없다).
 *
 * history 는 기존 `"page-position"` 스택에 `pagePlacementEvent` payload 로 들어간다 — 새 스택
 * 0 (R8). 옛 `pagePositionEvent` 는 legacy·저장된 이력을 위해 그대로 남는다.
 */

import type {
  BreakpointName,
  PagePlacement,
  PagePositionPoint,
} from "@composition/shared";
import { PAGE_PLACEMENT_STYLE_KEYS } from "@composition/shared";
import { useStore } from "../index";
import { useCanonicalDocumentStore } from "../canonical/canonicalDocumentStore";
import { persistActiveCanonicalDocument } from "../canonical/persistActiveCanonicalDocument";
import { historyManager } from "../history";
import { useViewportSyncStore } from "../../workspace/canvas/stores";
import { readPageFrameSize } from "../../workspace/canvas/scene/pageFrameSize";
import {
  derivePagePositionsMemo,
  resolvePageLayout,
} from "../../workspace/canvas/scene/pagePlacement";
import {
  findDuplicatePinnedCells,
  isPlacementEditable,
  resolveHomePageId,
  resolvePlacementForDrop,
  resolvePlacementsForAlign,
  type PagePlacementEditEntry,
  type PlacementEditContext,
} from "../../workspace/canvas/scene/pagePlacementEdit";
import { isComponentsPageMirror } from "../../pages/systemComponentsPage";
import { getDB } from "../../../lib/db";

/** 문서가 파생 모드인가 — 편집 라우팅의 단일 판정. */
export function isDerivedPlacementActive(): boolean {
  return readActiveDocument()?.pageLayout?.placementModel === "derived";
}

function readActiveDocument() {
  const canonical = useCanonicalDocumentStore.getState();
  const projectId = canonical.currentProjectId;
  return projectId ? canonical.documents.get(projectId) : undefined;
}

/**
 * tier override 로 쓸지 — ADR-154 개정 1 과 같은 규칙 (비-desktop + 해당 tier 토글 ON).
 * 토글 ON 은 "그 tier 에 이미 명시 override 가 있다" 로 읽는다. 없으면 base 에 쓴다.
 */
function shouldWriteAsOverride(
  placement: PagePlacement | undefined,
  activeBreakpoint: BreakpointName,
): boolean {
  if (activeBreakpoint === "desktop") return false;
  const responsive = placement?.responsive;
  if (!responsive) return false;
  return PAGE_PLACEMENT_STYLE_KEYS.some(
    (key) => responsive[key]?.[activeBreakpoint] !== undefined,
  );
}

/** 현재 상태에서 편집 판정 context 를 만든다. 파생 모드가 아니면 null. */
export function buildPlacementEditContext(
  pageId?: string,
): PlacementEditContext | null {
  const doc = readActiveDocument();
  const pageLayout = doc?.pageLayout;
  if (pageLayout?.placementModel !== "derived") return null;

  const state = useStore.getState();
  const activeBreakpoint = (
    state as typeof state & { activeBreakpoint: BreakpointName }
  ).activeBreakpoint;
  const { canvasSize, pageContentHeights } = useViewportSyncStore.getState();
  const pageSizes: Record<string, { width: number; height: number }> = {};
  for (const page of state.pages) {
    const neutral = isComponentsPageMirror(page);
    pageSizes[page.id] = readPageFrameSize(
      page.id,
      state.pageIndex.elementsByPage,
      state.elementsMap,
      canvasSize.width,
      canvasSize.height,
      neutral
        ? {
            neutral: true,
            publishedContentHeight: pageContentHeights.get(page.id),
          }
        : undefined,
    );
  }
  const positions = derivePagePositionsMemo({
    pages: state.pages,
    pageSizes,
    pageLayout,
    activeBreakpoint,
    systemPageIds: new Set(
      state.pages.filter(isComponentsPageMirror).map((page) => page.id),
    ),
    legacyPositions: doc?.pagePositions,
  });
  if (!positions) return null;

  const placements = pageLayout.placements ?? {};
  return {
    pages: state.pages,
    // store 순서는 시스템 Components 페이지가 앞에 온다 — Home 은 첫 **사용자** 페이지다.
    homePageId: resolveHomePageId(state.pages, isComponentsPageMirror),
    positions,
    pageSizes,
    layout: resolvePageLayout(pageLayout, activeBreakpoint),
    placements,
    activeBreakpoint,
    writeAsOverride: shouldWriteAsOverride(
      pageId ? placements[pageId] : undefined,
      activeBreakpoint,
    ),
  };
}

function commitEntries(
  entries: PagePlacementEditEntry[],
  placements: Readonly<Record<string, PagePlacement | undefined>>,
): boolean {
  if (entries.length === 0) return false;
  const next: Record<string, PagePlacement | undefined> = { ...placements };
  for (const entry of entries) {
    if (entry.placement === null) delete next[entry.pageId];
    else next[entry.pageId] = entry.placement;
  }
  // R9 — 엔진은 같은 칸에 두 페이지를 허용한다. 쓰기 전에 막는 것이 유일한 방어선이다.
  const duplicates = findDuplicatePinnedCells(next);
  if (duplicates.length > 0) {
    console.warn("[pagePlacement] 고정 칸 중복 — 쓰기 취소", duplicates);
    return false;
  }

  const changed = entries.filter(
    (entry) =>
      JSON.stringify(placements[entry.pageId] ?? null) !==
      JSON.stringify(entry.placement ?? null),
  );
  if (changed.length === 0) return false;

  useCanonicalDocumentStore.getState().setPagePlacements(
    changed.map((entry) => ({
      pageId: entry.pageId,
      placement: entry.placement,
    })),
  );
  historyManager.addEntry({
    type: "page-position",
    elementId: changed[0].pageId,
    data: {
      pagePlacementEvent: {
        entries: changed.map((entry) => ({
          pageId: entry.pageId,
          before: placements[entry.pageId] ?? null,
          after: entry.placement,
        })),
      },
    },
  });
  // 파생은 문서 변경을 구독해 자동으로 다시 돈다 — store 미러 갱신 없음.
  queueMicrotask(() => {
    void (async () => {
      try {
        const db = await getDB();
        await persistActiveCanonicalDocument(db);
      } catch (error) {
        console.error("[pagePlacement] DB persist:", error);
      }
    })();
  });
  return true;
}

/**
 * 좌표 1건 커밋 (드래그 finish · X/Y 입력 · nudge 공통).
 *
 * 파생 모드가 아니면 `false` — 호출자가 기존 저장 좌표 경로로 내려간다.
 */
export function commitPagePlacementFromPoint(
  pageId: string,
  point: PagePositionPoint,
): boolean {
  const ctx = buildPlacementEditContext(pageId);
  if (!ctx) return false;
  const result = resolvePlacementForDrop(ctx, pageId, point);
  if (result.entries.length === 0) return true; // 거부도 "파생 모드가 처리했다"
  commitEntries(result.entries, ctx.placements);
  return true;
}

/** 다중 드래그 finish — 페이지별 판정을 모아 entry 1개로 쓴다 (Cmd+Z 1회). */
export function commitPagePlacementsFromPoints(
  moved: ReadonlyArray<{ pageId: string; position: PagePositionPoint }>,
): boolean {
  const ctx = buildPlacementEditContext();
  if (!ctx) return false;
  const entries: PagePlacementEditEntry[] = [];
  let placements = ctx.placements;
  for (const item of moved) {
    const result = resolvePlacementForDrop(
      { ...ctx, placements },
      item.pageId,
      item.position,
    );
    if (result.entries.length === 0) continue;
    const next: Record<string, PagePlacement | undefined> = { ...placements };
    for (const entry of result.entries) {
      if (entry.placement === null) delete next[entry.pageId];
      else next[entry.pageId] = entry.placement;
      const existing = entries.findIndex((e) => e.pageId === entry.pageId);
      if (existing >= 0) entries[existing] = entry;
      else entries.push(entry);
    }
    placements = next;
  }
  commitEntries(entries, ctx.placements);
  return true;
}

/** align — Home 제외 전부 흐름 복귀. */
export function commitPagePlacementAlign(): boolean {
  const ctx = buildPlacementEditContext();
  if (!ctx) return false;
  commitEntries(resolvePlacementsForAlign(ctx), ctx.placements);
  return true;
}

/** Home 은 배치 편집 대상이 아니다 — UI 비활성 판정. */
export function isPagePlacementEditable(pageId: string): boolean {
  if (!isDerivedPlacementActive()) return true;
  const pages = useStore.getState().pages;
  return isPlacementEditable(
    pageId,
    resolveHomePageId(pages, isComponentsPageMirror),
  );
}
