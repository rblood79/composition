/**
 * ADR-232 Decision 6 — 저장 좌표 → placement 1회 이관.
 *
 * 조건: `pageLayout.placementModel` 이 **없고** `pagePositions` 가 있다. tier 마다 전체 벡터로
 * 이관하며 보존 대상은 **Home 기준 상대 world 벡터** 다 (화면 픽셀은 뷰포트가 세션 상태라
 * reload 를 넘어 보존되는 양이 아니다 — 이관 세션 안에서만 pan 보정, 리뷰 round 2 h1).
 *
 * 갈래 3 (닫혀 있다):
 * 1. Home 제외, 정규화 좌표가 격자 칸과 같으면 (±1px) **그 칸에 고정** — auto 자리라도 고정한다
 *    (auto-placement 는 다른 페이지의 승격에 따라 밀리기 때문, 리뷰 round 1 h1).
 * 2. 칸이 아니면 **absolute** (음수 칸 포함 — grid line 은 ≥ 1 이라 칸으로 표현할 수 없다.
 *    G0 실측: 사용자 문서 2건에 Home 왼쪽 열 2 · Home 위 행 1).
 * 3. 파생 재실행 결과가 저장 벡터와 어긋나면 **Home 은 흐름 원점에 남기고 나머지 전부 absolute**
 *    (보수 갈래 — Home 불변식을 지키면서 벡터는 반드시 맞는다).
 *
 * tier 차분 (iv): desktop 은 base, tablet/mobile 은 **이전 tier cascade 결과와 다를 때만**
 * override 로 쓰고, 흐름으로 되돌려야 하는 tier 에는 명시 reset (`position:"static"` ·
 * line `"auto"`) 을 쓴다 — cascade 상속을 끊는 유일한 방법이다 (리뷰 m4).
 *
 * 전부 기본 흐름과 같으면 placement 를 하나도 쓰지 않는다 (v).
 */

import type {
  BreakpointName,
  PagePlacement,
  PagePositionPoint,
} from "@composition/shared";
import { BREAKPOINT_ORDER } from "../../../../types/builder/responsive.types";
import type { PagePositionMap } from "./pagePlacement";

const EPSILON = 1;

export interface MigrationTierInput {
  /** 그 tier 의 열 stride (페이지 폭 + gap). */
  stride: number;
}

export interface MigrationInput {
  /** canonical 순서 (시스템 페이지 포함). */
  pages: readonly { id: string }[];
  /** 첫 **사용자** 페이지. 흐름 원점이며 placement 를 갖지 않는다. */
  homePageId: string | null;
  systemPageIds: ReadonlySet<string>;
  pagePositions: Readonly<
    Record<string, Partial<Record<BreakpointName, PagePositionPoint>>>
  >;
  /** tier 별 열 stride. */
  tiers: Readonly<Record<BreakpointName, MigrationTierInput>>;
  /**
   * 후보 placement 로 파생을 다시 돌린다 (엔진 주입 — 이 모듈은 엔진을 모른다).
   * 엔진 미준비면 `null` 을 내며, 이관은 그 세션에서 보류된다.
   */
  derive: (
    breakpoint: BreakpointName,
    placements: Record<string, PagePlacement>,
  ) => PagePositionMap | null;
}

export interface MigrationTierReport {
  breakpoint: BreakpointName;
  /** 그 tier 에 저장 좌표가 있었는가. */
  hadPositions: boolean;
  pinned: string[];
  absolute: string[];
  /** 보수 갈래 (전체 absolute) 로 떨어졌는가. */
  fallback: boolean;
  /** Home 저장 좌표 (평행이동 기준) — 뷰포트 보정에 쓴다. */
  homeOrigin: PagePositionPoint | null;
  /** 검증 결과 — 정규화 벡터 최대 오차. */
  maxDelta: number;
}

export interface MigrationResult {
  placements: Record<string, PagePlacement>;
  tiers: MigrationTierReport[];
  /** 엔진 미준비 등으로 이관을 수행하지 못했다. */
  deferred: boolean;
}

function absoluteStyle(
  point: PagePositionPoint,
): Record<string, number | string> {
  return {
    position: "absolute",
    left: Math.round(point.x),
    top: Math.round(point.y),
  };
}

function pinnedStyle(column: number, row: number): Record<string, number> {
  return { gridColumnStart: column, gridRowStart: row };
}

/**
 * 그 좌표가 **열 격자** 위에 있는가 (칸 후보의 1차 조건).
 *
 * Home 기준 음수 (왼쪽 열 · 위 행) 는 칸이 될 수 없다 — CSS grid line 은 ≥ 1 이라 Home 보다
 * 앞선 칸을 표현할 수 없다 (G0 실측: 사용자 문서 2건). 음수를 칸으로 보내면 엔진이 auto 로
 * 흘려 검증이 깨지고 **문서 전체가 보수 갈래 (전부 absolute) 로 떨어진다**.
 */
function isOnColumnGrid(point: PagePositionPoint, stride: number): boolean {
  if (point.x < -EPSILON || point.y < -EPSILON) return false;
  const column = Math.round(point.x / stride);
  return column >= 0 && Math.abs(point.x - column * stride) <= EPSILON;
}

/** 칸 후보 → (column, row). 행 목록은 **칸 후보들의 y** 로만 만든다 (absolute 가 행을 오염시키지 않도록). */
function resolveCellCandidate(
  point: PagePositionPoint,
  stride: number,
  rowYs: readonly number[],
): { column: number; row: number } | null {
  if (!isOnColumnGrid(point, stride)) return null;
  const column = Math.round(point.x / stride);
  const row = rowYs.findIndex((y) => Math.abs(y - point.y) <= EPSILON);
  if (row < 0) return null;
  return { column: column + 1, row: row + 1 };
}

function styleEquals(
  a: Record<string, string | number> | undefined,
  b: Record<string, string | number> | undefined,
): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

/** 흐름 복귀 명시 reset — cascade 상속을 끊는다 (리뷰 m4). */
const FLOW_RESET: Record<string, string> = {
  position: "static",
  left: "auto",
  top: "auto",
  gridColumnStart: "auto",
  gridRowStart: "auto",
};

/** 같은 칸을 두 페이지가 고정하면 (엔진은 허용한다) 이관을 보수 갈래로 보낸다 (R9). */
function hasDuplicatePinnedCells(
  styles: Record<string, Record<string, string | number> | undefined>,
): boolean {
  const seen = new Set<string>();
  for (const style of Object.values(styles)) {
    if (!style || style.position === "absolute") continue;
    const column = style.gridColumnStart;
    const row = style.gridRowStart;
    if (column === undefined || row === undefined) continue;
    const key = `${column}/${row}`;
    if (seen.has(key)) return true;
    seen.add(key);
  }
  return false;
}

export function migratePagePositionsToPlacements(
  input: MigrationInput,
): MigrationResult {
  /** 후보 placement 로 파생을 돌려 Home 기준 정규화 벡터의 최대 오차를 낸다. */
  const verifyAgainst = (
    styles: Record<string, Record<string, string | number>>,
    normalized: Record<string, PagePositionPoint>,
    userIds: readonly string[],
    breakpoint: BreakpointName,
  ): number => {
    const derived = input.derive(
      breakpoint,
      Object.fromEntries(
        Object.entries(styles).map(([id, style]) => [id, { style }]),
      ),
    );
    if (!derived) return Number.POSITIVE_INFINITY;
    const derivedHome = input.homePageId
      ? derived[input.homePageId]
      : derived[userIds[0]];
    let max = 0;
    for (const id of userIds) {
      const point = derived[id];
      if (!point) return Number.POSITIVE_INFINITY;
      max = Math.max(
        max,
        Math.abs(point.x - (derivedHome?.x ?? 0) - normalized[id].x),
        Math.abs(point.y - (derivedHome?.y ?? 0) - normalized[id].y),
      );
    }
    return max;
  };

  const tiers: MigrationTierReport[] = [];
  /** tier 별 최종 style (없으면 흐름). */
  const styleByTier = new Map<
    BreakpointName,
    Record<string, Record<string, string | number> | undefined>
  >();

  for (const breakpoint of BREAKPOINT_ORDER) {
    const stride = input.tiers[breakpoint].stride;
    const stored: Record<string, PagePositionPoint> = {};
    for (const page of input.pages) {
      const point = input.pagePositions[page.id]?.[breakpoint];
      if (point) stored[page.id] = point;
    }
    const userIds = input.pages
      .map((page) => page.id)
      .filter((id) => !input.systemPageIds.has(id) && stored[id] !== undefined);
    const home = input.homePageId ? stored[input.homePageId] : undefined;
    const hadPositions = userIds.length > 0;
    if (!hadPositions) {
      tiers.push({
        breakpoint,
        hadPositions: false,
        pinned: [],
        absolute: [],
        fallback: false,
        homeOrigin: null,
        maxDelta: 0,
      });
      styleByTier.set(breakpoint, {});
      continue;
    }

    // (i) Home 기준 평행이동 — leftInset 류 오프셋 제거
    const origin = home ?? stored[userIds[0]];
    const normalized: Record<string, PagePositionPoint> = {};
    for (const id of userIds) {
      normalized[id] = {
        x: stored[id].x - origin.x,
        y: stored[id].y - origin.y,
      };
    }

    // 행 후보 = **열 격자 위에 있는 페이지** 의 y 만 (Home 포함, y=0). absolute 로 갈 페이지의
    //   y 가 섞이면 행 번호가 밀려 칸이 어긋난다 (Home 위 행이 row 1 을 가져간다).
    const rowYs = [
      ...new Set(
        userIds
          .filter((id) => isOnColumnGrid(normalized[id], stride))
          .map((id) => normalized[id].y),
      ),
    ].sort((a, b) => a - b);

    // (v) 기본 흐름이 이미 그 벡터면 placement 를 하나도 쓰지 않는다.
    //   Decision 6 (ii) 의 "auto 자리라도 고정" 은 **일부만 승격되는 문서**를 위한 규칙이다
    //   (승격된 페이지 때문에 auto 자리가 밀리는 것 방지, round 1 h1). 전부 기본 흐름인
    //   문서까지 고정하면 새 문서마다 쓸모없는 placement 가 생긴다.
    const flowDelta = verifyAgainst({}, normalized, userIds, breakpoint);
    if (flowDelta <= EPSILON) {
      tiers.push({
        breakpoint,
        hadPositions: true,
        pinned: [],
        absolute: [],
        fallback: false,
        homeOrigin: origin ? { ...origin } : null,
        maxDelta: flowDelta,
      });
      styleByTier.set(breakpoint, {});
      continue;
    }

    // (ii) 칸이면 고정, 아니면 absolute (Home 제외)
    const candidate: Record<string, Record<string, string | number>> = {};
    const pinned: string[] = [];
    const absolute: string[] = [];
    for (const id of userIds) {
      if (id === input.homePageId) continue;
      const cell = resolveCellCandidate(normalized[id], stride, rowYs);
      if (cell) {
        candidate[id] = pinnedStyle(cell.column, cell.row);
        pinned.push(id);
      } else {
        candidate[id] = absoluteStyle(normalized[id]);
        absolute.push(id);
      }
    }
    // 시스템 페이지는 저장 좌표가 있어도 기본값 (파생이 왼쪽 열에 둔다) — 이관 대상 아님.

    // (iii) 파생 재실행 → 정규화 벡터 Δ0 검증 + 칸 유일성 (R9)
    const verify = (styles: Record<string, Record<string, string | number>>) =>
      hasDuplicatePinnedCells(styles)
        ? Number.POSITIVE_INFINITY
        : verifyAgainst(styles, normalized, userIds, breakpoint);

    let maxDelta = verify(candidate);
    let fallback = false;
    let finalStyles = candidate;
    if (!(maxDelta <= EPSILON)) {
      // 보수 갈래 — Home 은 흐름 원점, 나머지 전부 absolute
      fallback = true;
      finalStyles = {};
      for (const id of userIds) {
        if (id === input.homePageId) continue;
        finalStyles[id] = absoluteStyle(normalized[id]);
      }
      maxDelta = verify(finalStyles);
    }
    if (!Number.isFinite(maxDelta)) {
      // 보수 갈래까지 재현하지 못했다 = 엔진 미준비 (파생 null). 다음 세션에 다시 시도한다.
      return { placements: {}, tiers, deferred: true };
    }

    tiers.push({
      breakpoint,
      hadPositions: true,
      pinned: fallback ? [] : pinned,
      absolute: fallback
        ? userIds.filter((id) => id !== input.homePageId)
        : absolute,
      fallback,
      homeOrigin: origin ? { ...origin } : null,
      maxDelta,
    });
    styleByTier.set(
      breakpoint,
      Object.fromEntries(
        input.pages.map((page) => [page.id, finalStyles[page.id]]),
      ),
    );
  }

  // (iv) tier 차분 — desktop base · 이후 tier 는 cascade 결과와 다를 때만 override
  const placements: Record<string, PagePlacement> = {};
  for (const page of input.pages) {
    if (page.id === input.homePageId) continue;
    if (input.systemPageIds.has(page.id)) continue;
    const base = styleByTier.get("desktop")?.[page.id];
    const responsive: Record<string, Record<string, string | number>> = {};
    let inherited = base;
    for (const breakpoint of BREAKPOINT_ORDER) {
      if (breakpoint === "desktop") continue;
      const tierStyle = styleByTier.get(breakpoint)?.[page.id];
      const report = tiers.find((t) => t.breakpoint === breakpoint);
      if (!report?.hadPositions) continue; // 저장값 없는 tier 는 건드리지 않는다 (cascade 유지)
      if (styleEquals(tierStyle, inherited)) {
        inherited = tierStyle;
        continue;
      }
      const write = tierStyle ?? FLOW_RESET;
      // 흐름으로 되돌릴 때는 계열 전체 명시 reset, 아니면 그 style + 반대 계열 reset
      const merged: Record<string, string | number> = tierStyle
        ? { ...FLOW_RESET, ...tierStyle }
        : { ...FLOW_RESET };
      for (const [key, value] of Object.entries(merged)) {
        responsive[key] = { ...(responsive[key] ?? {}), [breakpoint]: value };
      }
      void write;
      inherited = tierStyle;
    }
    if (!base && Object.keys(responsive).length === 0) continue; // (v)
    const placement: PagePlacement = {};
    if (base) placement.style = base;
    if (Object.keys(responsive).length > 0) placement.responsive = responsive;
    placements[page.id] = placement;
  }

  return { placements, tiers, deferred: false };
}

/**
 * 이관 세션 뷰포트 보정 — `screen = world × zoom + pan` 이므로 world 가 −H 만큼 옮겨지면
 * pan 은 `+H × zoom` 이다 (리뷰 round 3 m1). 활성 tier 의 H 로 **한 번만**.
 */
export function resolveMigrationPanCorrection(
  pan: PagePositionPoint,
  homeOrigin: PagePositionPoint | null,
  zoom: number,
): PagePositionPoint {
  if (!homeOrigin) return pan;
  return {
    x: pan.x + homeOrigin.x * zoom,
    y: pan.y + homeOrigin.y * zoom,
  };
}
