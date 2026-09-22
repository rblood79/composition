/**
 * ADR-232 Decision 6·7 — hydration 이관과 모드 전환.
 *
 * - **이관**: `pageLayout.placementModel` 이 없고 `pagePositions` 가 있으면 1회 수행한다.
 *   저장 좌표는 지우지 않는다 (휴면 — 롤백 경로가 읽는다).
 * - **새 문서**: `pagePositions` 가 없으면 `placementModel: "derived"` 만 기록한다.
 * - **복귀 (`"legacy"`)**: 표식을 바꾸는 명시 액션이다. 전환 순간 `pagePositions` 에 좌표가
 *   없는 (page × tier) 를 그때의 파생 위치로 `legacyFallback` 에 채운다 — 이관 뒤 추가된
 *   페이지가 좌표 없이 첫 칸에서 Home 과 겹치는 것을 막는다 (리뷰 round 3 m2).
 * - **재이관 (`"legacy"` → `"derived"`)**: 명시 액션. 입력은 `pagePositions ⊕ legacyFallback`.
 */

import type {
  BreakpointName,
  CompositionDocument,
  PagePositionPoint,
} from "@composition/shared";
import { BREAKPOINT_ORDER } from "../../../types/builder/responsive.types";
import { CANVAS_VIEWPORT } from "../../workspace/canvasBreakpoints";
import { isComponentsPageMirror } from "../../pages/systemComponentsPage";
import { readPageFrameSize } from "../../workspace/canvas/scene/pageFrameSize";
import {
  derivePagePositions,
  resolvePageLayout,
} from "../../workspace/canvas/scene/pagePlacement";
import {
  migratePagePositionsToPlacements,
  resolveMigrationPanCorrection,
  type MigrationResult,
} from "../../workspace/canvas/scene/pagePlacementMigration";
import { resolveHomePageId } from "../../workspace/canvas/scene/pagePlacementEdit";
import type { Page } from "../../../types/core/store.types";

/** `readPageFrameSize` 가 읽는 최소 모양 (store `elementsMap` · scene node 둘 다 만족). */
interface BodyLookupNode {
  type: string;
  props?: { style?: unknown } | null;
  deleted?: boolean;
}

export interface PagePlacementHydrationInput {
  document: CompositionDocument;
  pages: readonly Page[];
  elementsByPage: ReadonlyMap<string, ReadonlySet<string>>;
  elementsMap: ReadonlyMap<string, BodyLookupNode>;
  /** 활성 tier — 뷰포트 보정 기준. */
  activeBreakpoint: BreakpointName;
  /** 레이아웃이 발행한 페이지별 body 높이 (Components neutral 입력). */
  pageContentHeights?: ReadonlyMap<string, number>;
}

export interface PagePlacementHydrationResult {
  /** 문서에 기록할 `pageLayout` patch. 없으면 할 일 없음. */
  patch: {
    placementModel: "derived";
    placements?: Record<string, import("@composition/shared").PagePlacement>;
  } | null;
  /** 활성 tier 의 Home 저장 좌표 — 뷰포트 pan 보정 입력. */
  homeOrigin: PagePositionPoint | null;
  report: MigrationResult | null;
}

function buildPageSizes(
  input: PagePlacementHydrationInput,
  breakpoint: BreakpointName,
): Record<string, { width: number; height: number }> {
  const tier = CANVAS_VIEWPORT[breakpoint];
  const sizes: Record<string, { width: number; height: number }> = {};
  for (const page of input.pages) {
    const neutral = isComponentsPageMirror(page);
    sizes[page.id] = readPageFrameSize(
      page.id,
      input.elementsByPage,
      input.elementsMap,
      tier.width,
      tier.height,
      neutral
        ? {
            neutral: true,
            publishedContentHeight: input.pageContentHeights?.get(page.id),
          }
        : undefined,
    );
  }
  return sizes;
}

/**
 * hydration 1회 이관 판정 + 계산. 쓰기는 호출자가 한다 (순수).
 */
export function resolvePagePlacementHydration(
  input: PagePlacementHydrationInput,
): PagePlacementHydrationResult {
  const pageLayout = input.document.pageLayout;
  if (pageLayout?.placementModel) {
    return { patch: null, homeOrigin: null, report: null };
  }
  const pagePositions = input.document.pagePositions;
  const systemPageIds = new Set(
    input.pages.filter(isComponentsPageMirror).map((page) => page.id),
  );
  const hasUserPositions =
    pagePositions !== undefined &&
    Object.entries(pagePositions).some(
      ([pageId, byBp]) =>
        !systemPageIds.has(pageId) &&
        Object.values(byBp ?? {}).some((point) => point !== undefined),
    );
  if (!hasUserPositions) {
    // 새 문서 (또는 시스템 좌표뿐) — 이관할 것이 없다. 표식만 기록한다.
    return {
      patch: { placementModel: "derived" },
      homeOrigin: null,
      report: null,
    };
  }

  const sizesByTier = Object.fromEntries(
    BREAKPOINT_ORDER.map((breakpoint) => [
      breakpoint,
      buildPageSizes(input, breakpoint),
    ]),
  ) as Record<
    BreakpointName,
    Record<string, { width: number; height: number }>
  >;
  const layout = resolvePageLayout(pageLayout, "desktop");

  const report = migratePagePositionsToPlacements({
    pages: input.pages,
    homePageId: resolveHomePageId(input.pages, isComponentsPageMirror),
    systemPageIds,
    pagePositions: pagePositions ?? {},
    tiers: Object.fromEntries(
      BREAKPOINT_ORDER.map((breakpoint) => [
        breakpoint,
        { stride: CANVAS_VIEWPORT[breakpoint].width + layout.gap },
      ]),
    ) as Record<BreakpointName, { stride: number }>,
    derive: (breakpoint, placements) =>
      derivePagePositions({
        pages: input.pages,
        pageSizes: sizesByTier[breakpoint],
        pageLayout: {
          ...pageLayout,
          direction: pageLayout?.direction ?? "auto",
          gap: layout.gap,
          columns: pageLayout?.columns ?? layout.columns,
          placements,
        },
        activeBreakpoint: breakpoint,
        systemPageIds,
      }),
  });

  if (report.deferred) {
    // 엔진 미준비 — 표식을 쓰지 않는다. 다음 hydration 이 다시 시도한다.
    return { patch: null, homeOrigin: null, report };
  }

  const activeTier = report.tiers.find(
    (tier) => tier.breakpoint === input.activeBreakpoint,
  );
  return {
    patch:
      Object.keys(report.placements).length > 0
        ? { placementModel: "derived", placements: report.placements }
        : { placementModel: "derived" },
    homeOrigin: activeTier?.homeOrigin ?? null,
    report,
  };
}

export { resolveMigrationPanCorrection };

/**
 * `"legacy"` 전환 시 채울 `legacyFallback` — `pagePositions` 에 좌표가 없는 (page × tier) 만.
 *
 * 값은 그때의 **파생 위치 (Home 기준 상대)** 다. 비워 두면 이관 뒤 추가된 페이지가 legacy 에서
 * 좌표 없이 흐름으로 남아 첫 칸 (Home) 과 겹친다 (round 3 m2 재현).
 */
export function buildLegacyFallback(
  input: PagePlacementHydrationInput,
): Partial<Record<BreakpointName, Record<string, PagePositionPoint>>> {
  const pageLayout = input.document.pageLayout;
  const pagePositions = input.document.pagePositions ?? {};
  const systemPageIds = new Set(
    input.pages.filter(isComponentsPageMirror).map((page) => page.id),
  );
  const homePageId = resolveHomePageId(input.pages, isComponentsPageMirror);
  const out: Partial<
    Record<BreakpointName, Record<string, PagePositionPoint>>
  > = {};
  for (const breakpoint of BREAKPOINT_ORDER) {
    const derived = derivePagePositions({
      pages: input.pages,
      pageSizes: buildPageSizes(input, breakpoint),
      pageLayout,
      activeBreakpoint: breakpoint,
      systemPageIds,
    });
    if (!derived) continue;
    const home = homePageId ? derived[homePageId] : undefined;
    const tierEntry: Record<string, PagePositionPoint> = {};
    for (const page of input.pages) {
      if (pagePositions[page.id]?.[breakpoint]) continue;
      const point = derived[page.id];
      if (!point) continue;
      tierEntry[page.id] = {
        x: Math.round(point.x - (home?.x ?? 0)),
        y: Math.round(point.y - (home?.y ?? 0)),
      };
    }
    if (Object.keys(tierEntry).length > 0) out[breakpoint] = tierEntry;
  }
  return out;
}
