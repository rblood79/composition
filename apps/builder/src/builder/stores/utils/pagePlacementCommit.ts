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
import {
  PAGE_PLACEMENT_STYLE_KEYS,
  isComponentsPage,
} from "@composition/shared";
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
import { getDB } from "../../../lib/db";
import {
  buildLegacyFallback,
  resolvePagePlacementHydration,
} from "./pagePlacementHydration";

/** 문서가 파생 모드인가 — 편집 라우팅의 단일 판정. */
export function isDerivedPlacementActive(): boolean {
  return readActiveDocument()?.pageLayout?.placementModel === "derived";
}

/**
 * `"legacy"` 는 **배치 편집이 잠긴다** (Decision 7). 저장 좌표는 복귀용 스냅샷이므로
 * 그 상태에서 좌표를 쓰면 되돌아갈 지점이 사라진다.
 */
export function isPlacementEditingLocked(): boolean {
  return readActiveDocument()?.pageLayout?.placementModel === "legacy";
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
    const neutral = isComponentsPage(page);
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
      state.pages.filter(isComponentsPage).map((page) => page.id),
    ),
    legacyPositions: doc?.pagePositions,
  });
  if (!positions) return null;

  const placements = pageLayout.placements ?? {};
  return {
    pages: state.pages,
    // store 순서는 시스템 Components 페이지가 앞에 온다 — Home 은 첫 **사용자** 페이지다.
    homePageId: resolveHomePageId(state.pages, isComponentsPage),
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
  if (isPlacementEditingLocked()) return true; // 잠김 — 저장 좌표도 쓰지 않는다
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
  if (isPlacementEditingLocked()) return true; // 잠김 — 저장 좌표도 쓰지 않는다
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
  if (isPlacementEditingLocked()) return true; // 잠김 — 저장 좌표도 쓰지 않는다
  const ctx = buildPlacementEditContext();
  if (!ctx) return false;
  commitEntries(resolvePlacementsForAlign(ctx), ctx.placements);
  return true;
}

/** Home 은 배치 편집 대상이 아니다 — UI 비활성 판정. */
export function isPagePlacementEditable(pageId: string): boolean {
  if (isPlacementEditingLocked()) return false;
  if (!isDerivedPlacementActive()) return true;
  const pages = useStore.getState().pages;
  return isPlacementEditable(
    pageId,
    resolveHomePageId(pages, isComponentsPage),
  );
}

// ─────────────────────────────────────────────
// ADR-232 Decision 7 — 읽기 모드 전환 (복귀 · 재이관)
// ─────────────────────────────────────────────

function buildHydrationInput() {
  const doc = readActiveDocument();
  if (!doc) return null;
  const state = useStore.getState();
  return {
    document: doc,
    pages: state.pages,
    elementsByPage: state.pageIndex.elementsByPage,
    elementsMap: state.elementsMap,
    activeBreakpoint: (
      state as typeof state & { activeBreakpoint: BreakpointName }
    ).activeBreakpoint,
    pageContentHeights: useViewportSyncStore.getState().pageContentHeights,
  };
}

/**
 * `"derived"` → `"legacy"` 복귀.
 *
 * 표식·placement 를 **지우지 않는다** — 지우면 다음 hydration 이 이관 조건을 다시 만족해
 * 재이관이 돌아버린다 (리뷰 round 2 h2). 전환 순간 `pagePositions` 에 좌표가 없는
 * (page × tier) 를 그때의 파생 위치로 `legacyFallback` 에 채운다 (round 3 m2).
 */
export function setPagePlacementModelLegacy(): boolean {
  const input = buildHydrationInput();
  if (!input) return false;
  const fallback = buildLegacyFallback(input);
  useCanonicalDocumentStore.getState().setPageLayout({
    placementModel: "legacy",
    legacyFallback: fallback,
  });
  return true;
}

/**
 * `"legacy"` → `"derived"` 재이관 (명시 액션).
 *
 * placement 를 초기화한 뒤 `pagePositions ⊕ legacyFallback` 을 입력으로 Decision 6 을 다시 돈다.
 */
export function setPagePlacementModelDerived(): boolean {
  const input = buildHydrationInput();
  if (!input) return false;
  const doc = input.document;
  const merged: NonNullable<typeof doc.pagePositions> = {
    ...(doc.pagePositions ?? {}),
  };
  for (const [breakpoint, entries] of Object.entries(
    doc.pageLayout?.legacyFallback ?? {},
  )) {
    for (const [pageId, point] of Object.entries(entries ?? {})) {
      merged[pageId] = {
        ...(merged[pageId] ?? {}),
        [breakpoint as BreakpointName]:
          merged[pageId]?.[breakpoint as BreakpointName] ?? point,
      };
    }
  }
  const result = resolvePagePlacementHydration({
    ...input,
    document: {
      ...doc,
      pagePositions: merged,
      pageLayout: { ...doc.pageLayout, placementModel: undefined },
    },
  });
  if (!result.patch) return false;
  useCanonicalDocumentStore.getState().setPageLayout({
    ...result.patch,
    placements: result.patch.placements ?? {},
  });
  return true;
}
