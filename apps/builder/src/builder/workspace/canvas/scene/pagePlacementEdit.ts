/**
 * ADR-232 Phase 2 — 배치 편집 판정 (드래그 finish · Transform X/Y · nudge · align).
 *
 * 순수 함수만 둔다 — 좌표를 받아 **어떤 placement 를 쓸지** 정하고, 쓰기는 호출자가 한다
 * (store 액션 1개 · history entry 1개). 엔진의 명시 배치 겹침 허용 (`grid.rs:1190-1210`) 에
 * 기대지 않고 **쓰기 전에** 칸 유일성을 검사한다 (R9).
 *
 * 정책 (Decision 3 · 리뷰 m5):
 * - 격자 안에 놓으면 그 칸에 **고정** (`gridColumnStart/RowStart` longhand)
 * - 격자 밖이면 `position:absolute` + `left`/`top`
 * - 대상 칸을 **고정 페이지**가 차지하고 있으면 두 placement 를 **교환** (entry 2 · Cmd+Z 1회)
 * - 대상 칸에 **흐름 페이지**가 있으면 고정만 하고 그 페이지는 재흐름에 맡긴다 (쓰기 1)
 * - 대상이 **첫 칸** (Home 의 흐름 원점) 이면 거부
 * - **Home 은 이동 불가** — 어떤 편집도 거부 (사용자 결정 2026-09-22)
 */

import type {
  BreakpointName,
  PagePlacement,
  PagePositionPoint,
} from "@composition/shared";
import type { ResolvedPageLayout } from "./pagePlacement";

export interface PagePlacementEditEntry {
  pageId: string;
  placement: PagePlacement | null;
}

export interface GridCell {
  column: number;
  row: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PlacementEditContext {
  /** canonical 순서. `pages[0]` 이 Home (흐름 원점, 이동 불가). */
  pages: readonly { id: string }[];
  /** 현재 파생 위치 (칸 격자의 행 경계를 여기서 읽는다). */
  positions: Readonly<Record<string, PagePositionPoint>>;
  pageSizes: Readonly<
    Record<string, { width: number; height: number } | undefined>
  >;
  layout: ResolvedPageLayout;
  placements: Readonly<Record<string, PagePlacement | undefined>>;
  activeBreakpoint: BreakpointName;
  /** tier 토글 ON 이면 override 로 쓴다 (ADR-154 개정 1 과 같은 규칙). */
  writeAsOverride: boolean;
}

/** Home = canonical 순서 첫 페이지. 이동 불가 (placement 를 갖지 않는다). */
export function resolveHomePageId(
  pages: readonly { id: string }[],
): string | null {
  return pages[0]?.id ?? null;
}

export function isPlacementEditable(
  pageId: string,
  pages: readonly { id: string }[],
): boolean {
  return pageId !== resolveHomePageId(pages);
}

/** placement 가 absolute 인가 (활성 tier 해석 결과 기준). */
export function isAbsolutePlacementStyle(
  style: Record<string, string | number> | undefined,
): boolean {
  return style?.position === "absolute";
}

/**
 * 현재 화면의 칸 격자.
 *
 * 열 x 는 결정적 (`column * (trackWidth + gap)`) 이지만 **행 y 는 행 최대 높이**라 파생
 * 결과에서 읽는다 — 사용자가 보고 있는 칸과 같은 격자여야 드롭 판정이 어긋나지 않는다.
 * 마지막 행 아래에 빈 행 하나를 더 둔다 (끝에 놓기).
 */
export function buildGridCells(ctx: PlacementEditContext): GridCell[] {
  const { layout } = ctx;
  if (layout.direction === "horizontal") return [];
  const columns = layout.direction === "vertical" ? 1 : layout.columns;
  const stride = layout.trackWidth + layout.gap;

  const flowYs = new Set<number>();
  let lastRowHeight = 0;
  for (const page of ctx.pages) {
    const point = ctx.positions[page.id];
    if (!point) continue;
    const style = ctx.placements[page.id];
    // absolute 페이지는 격자 밖 — 행 경계 후보가 아니다.
    if (style?.style?.position === "absolute") continue;
    if (point.x < 0) continue;
    flowYs.add(point.y);
  }
  const rows = [...flowYs].sort((a, b) => a - b);
  if (rows.length === 0) rows.push(0);

  const rowHeights = rows.map((y) => {
    let height = 0;
    for (const page of ctx.pages) {
      const point = ctx.positions[page.id];
      if (!point || point.y !== y) continue;
      height = Math.max(height, ctx.pageSizes[page.id]?.height ?? 0);
    }
    return height || layout.trackWidth;
  });
  lastRowHeight = rowHeights[rowHeights.length - 1] ?? 0;

  const cells: GridCell[] = [];
  rows.forEach((y, rowIndex) => {
    for (let column = 0; column < columns; column++) {
      cells.push({
        column: column + 1,
        row: rowIndex + 1,
        x: column * stride,
        y,
        width: layout.trackWidth,
        height: rowHeights[rowIndex],
      });
    }
  });
  // 끝에 놓기용 빈 행
  const trailingY = (rows[rows.length - 1] ?? 0) + lastRowHeight + layout.gap;
  for (let column = 0; column < columns; column++) {
    cells.push({
      column: column + 1,
      row: rows.length + 1,
      x: column * stride,
      y: trailingY,
      width: layout.trackWidth,
      height: lastRowHeight || layout.trackWidth,
    });
  }
  return cells;
}

/** 놓은 상자의 중심이 들어간 칸. 없으면 null (격자 밖 → absolute). */
export function findCellForDrop(
  cells: readonly GridCell[],
  dropped: PagePositionPoint,
  size: { width: number; height: number },
): GridCell | null {
  const cx = dropped.x + size.width / 2;
  const cy = dropped.y + size.height / 2;
  for (const cell of cells) {
    if (
      cx >= cell.x &&
      cx < cell.x + cell.width &&
      cy >= cell.y &&
      cy < cell.y + cell.height
    ) {
      return cell;
    }
  }
  return null;
}

/** 그 칸을 **고정**으로 차지한 페이지 (있으면). */
export function findPinnedOccupant(
  ctx: PlacementEditContext,
  cell: GridCell,
  exceptPageId: string,
): string | null {
  for (const page of ctx.pages) {
    if (page.id === exceptPageId) continue;
    const style = ctx.placements[page.id]?.style;
    if (!style || style.position === "absolute") continue;
    if (
      Number(style.gridColumnStart) === cell.column &&
      Number(style.gridRowStart) === cell.row
    ) {
      return page.id;
    }
  }
  return null;
}

function pinnedPlacement(cell: GridCell): PagePlacement {
  return {
    style: { gridColumnStart: cell.column, gridRowStart: cell.row },
  };
}

function absolutePlacement(point: PagePositionPoint): PagePlacement {
  return {
    style: {
      position: "absolute",
      left: Math.round(point.x),
      top: Math.round(point.y),
    },
  };
}

/** base 를 건드리지 않고 활성 tier override 로만 쓴다 (tier 토글 ON). */
function asOverride(
  base: PagePlacement | undefined,
  next: PagePlacement,
  breakpoint: BreakpointName,
): PagePlacement {
  const responsive: Record<string, Record<string, string | number>> = {
    ...((base?.responsive ?? {}) as Record<
      string,
      Record<string, string | number>
    >),
  };
  // 흐름/절대 전환 때 옛 키가 cascade 로 남지 않도록 placement 계열 전체를 이 tier 에 명시한다.
  const style = next.style ?? {};
  const reset: Record<string, string | number> =
    style.position === "absolute"
      ? {
          position: "absolute",
          left: style.left ?? 0,
          top: style.top ?? 0,
          gridColumnStart: "auto",
          gridRowStart: "auto",
        }
      : {
          position: "static",
          left: "auto",
          top: "auto",
          gridColumnStart: style.gridColumnStart ?? "auto",
          gridRowStart: style.gridRowStart ?? "auto",
        };
  for (const [key, value] of Object.entries(reset)) {
    responsive[key] = { ...(responsive[key] ?? {}), [breakpoint]: value };
  }
  return { ...base, responsive };
}

export interface PlacementDropResult {
  entries: PagePlacementEditEntry[];
  /** 판정 사유 — 하니스·로그용. */
  kind: "pinned" | "swapped" | "absolute" | "rejected";
  reason?: string;
}

/**
 * 드롭 1건 → 쓸 entry 목록.
 *
 * 반환 entry 가 0 이면 쓰지 않는다 (거부 또는 무변경).
 */
export function resolvePlacementForDrop(
  ctx: PlacementEditContext,
  pageId: string,
  dropped: PagePositionPoint,
): PlacementDropResult {
  if (!isPlacementEditable(pageId, ctx.pages)) {
    return { entries: [], kind: "rejected", reason: "home-immovable" };
  }
  const size = ctx.pageSizes[pageId] ?? {
    width: ctx.layout.trackWidth,
    height: ctx.layout.trackWidth,
  };
  const cells = buildGridCells(ctx);
  const cell = findCellForDrop(cells, dropped, size);
  const write = (target: string, placement: PagePlacement | null) => ({
    pageId: target,
    placement:
      placement && ctx.writeAsOverride
        ? asOverride(ctx.placements[target], placement, ctx.activeBreakpoint)
        : placement,
  });

  if (!cell) {
    return {
      entries: [write(pageId, absolutePlacement(dropped))],
      kind: "absolute",
    };
  }
  if (cell.column === 1 && cell.row === 1) {
    // 첫 칸은 Home 의 흐름 원점 — 다른 페이지가 고정할 수 없다.
    return { entries: [], kind: "rejected", reason: "first-cell-reserved" };
  }
  const occupant = findPinnedOccupant(ctx, cell, pageId);
  if (occupant) {
    if (!isPlacementEditable(occupant, ctx.pages)) {
      return { entries: [], kind: "rejected", reason: "home-immovable" };
    }
    const movingFrom = ctx.placements[pageId];
    const occupantPlacement = movingFrom?.style
      ? { style: { ...movingFrom.style } }
      : null;
    return {
      entries: [
        write(pageId, pinnedPlacement(cell)),
        write(occupant, occupantPlacement),
      ],
      kind: "swapped",
    };
  }
  return { entries: [write(pageId, pinnedPlacement(cell))], kind: "pinned" };
}

/**
 * align — Home 을 제외한 모든 페이지의 placement 를 지워 흐름으로 되돌린다.
 *
 * tier override 도 같이 지운다 (base 만 지우면 override 가 살아남아 그 tier 만 어긋난다).
 */
export function resolvePlacementsForAlign(
  ctx: Pick<PlacementEditContext, "pages" | "placements">,
): PagePlacementEditEntry[] {
  const home = resolveHomePageId(ctx.pages);
  const entries: PagePlacementEditEntry[] = [];
  for (const page of ctx.pages) {
    if (page.id === home) continue;
    if (ctx.placements[page.id] === undefined) continue;
    entries.push({ pageId: page.id, placement: null });
  }
  return entries;
}

/**
 * 고정 칸 유일성 검사 — 쓰기 전에 돌린다.
 *
 * 엔진은 같은 칸에 두 페이지를 겹쳐 놓는 것을 허용하므로 (`grid.rs:1190-1210`) 이 검사가
 * 유일한 방어선이다. 위반 (pageId, cell) 목록을 낸다 — 비어 있어야 쓴다.
 */
export function findDuplicatePinnedCells(
  placements: Readonly<Record<string, PagePlacement | undefined>>,
): Array<{ cell: string; pageIds: string[] }> {
  const byCell = new Map<string, string[]>();
  for (const [pageId, placement] of Object.entries(placements)) {
    const style = placement?.style;
    if (!style || style.position === "absolute") continue;
    const column = style.gridColumnStart;
    const row = style.gridRowStart;
    if (column === undefined || row === undefined) continue;
    const key = `${column}/${row}`;
    byCell.set(key, [...(byCell.get(key) ?? []), pageId]);
  }
  return [...byCell.entries()]
    .filter(([, ids]) => ids.length > 1)
    .map(([cell, pageIds]) => ({ cell, pageIds }));
}
