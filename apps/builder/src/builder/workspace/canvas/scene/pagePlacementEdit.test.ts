/**
 * ADR-232 Phase 2 — 배치 편집 판정 단위 게이트 (G2 의 판정 층).
 *
 * live (G2) 는 실제 드래그로 같은 규칙을 다시 확인한다. 여기서는 정책 자체를 고정한다:
 * 칸 스냅 · absolute · 교환 · 첫 칸 거부 · Home 거부 · align · 칸 유일성.
 */
import { beforeAll, describe, expect, it } from "vitest";
import { initEngineWasm, isEngineReady } from "../wasm-bindings/engineWasm";
import { derivePagePositions, resolvePageLayout } from "./pagePlacement";
import {
  buildGridCells,
  findCellForDrop,
  findDuplicatePinnedCells,
  findPinnedOccupant,
  isPlacementEditable,
  resolveHomePageId,
  resolvePlacementForDrop,
  resolvePlacementsForAlign,
  type PlacementEditContext,
} from "./pagePlacementEdit";
import type { PagePlacement } from "@composition/shared";

const GAP = 80;
const W = 1920;
const H = 1080;
const STRIDE = W + GAP;
const ROW = H + GAP;

const pages = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ id: `p${i}` }));
const sizes = (n: number) =>
  Object.fromEntries(
    Array.from({ length: n }, (_, i) => [`p${i}`, { width: W, height: H }]),
  );

function ctxOf(
  n: number,
  placements: Record<string, PagePlacement> = {},
  overrides: Partial<PlacementEditContext> = {},
): PlacementEditContext {
  const layout = resolvePageLayout(
    { direction: "auto", gap: GAP, columns: 3 },
    "desktop",
  );
  const positions = derivePagePositions({
    pages: pages(n),
    pageSizes: sizes(n),
    pageLayout: { direction: "auto", gap: GAP, columns: 3, placements },
    activeBreakpoint: "desktop",
  })!;
  return {
    pages: pages(n),
    homePageId: "p0",
    positions,
    pageSizes: sizes(n),
    layout,
    placements,
    activeBreakpoint: "desktop",
    writeAsOverride: false,
    ...overrides,
  };
}

beforeAll(async () => {
  await initEngineWasm();
  expect(isEngineReady()).toBe(true);
});

describe("칸 격자", () => {
  it("열 x 는 stride, 행 y 는 파생 결과에서 읽는다 + 끝 빈 행 1", () => {
    const cells = buildGridCells(ctxOf(5));
    expect(cells.filter((c) => c.row === 1).map((c) => c.x)).toEqual([
      0,
      STRIDE,
      2 * STRIDE,
    ]);
    // 행 2 + 끝 빈 행 3
    expect(Math.max(...cells.map((c) => c.row))).toBe(3);
    expect(cells.find((c) => c.row === 2 && c.column === 1)?.y).toBe(ROW);
  });

  it("행 높이가 다르면 다음 행 경계가 따라간다", () => {
    const n = 5;
    const tallSizes = { ...sizes(n), p1: { width: W, height: 1600 } };
    const positions = derivePagePositions({
      pages: pages(n),
      pageSizes: tallSizes,
      pageLayout: { direction: "auto", gap: GAP, columns: 3 },
      activeBreakpoint: "desktop",
    })!;
    const cells = buildGridCells({
      ...ctxOf(n),
      positions,
      pageSizes: tallSizes,
    });
    expect(cells.find((c) => c.row === 2 && c.column === 1)?.y).toBe(1680);
  });

  it("absolute 페이지는 행 경계 후보가 아니다", () => {
    const placements = {
      p1: { style: { position: "absolute", left: 0, top: 9999 } },
    };
    const cells = buildGridCells(ctxOf(3, placements));
    expect(cells.some((c) => c.y === 9999)).toBe(false);
  });
});

describe("드롭 판정", () => {
  it("격자 안 → 그 칸에 고정", () => {
    const ctx = ctxOf(4);
    const result = resolvePlacementForDrop(ctx, "p3", {
      x: 2 * STRIDE + 40,
      y: 30,
    });
    expect(result.kind).toBe("pinned");
    expect(result.entries).toEqual([
      {
        pageId: "p3",
        placement: { style: { gridColumnStart: 3, gridRowStart: 1 } },
      },
    ]);
  });

  it("격자 밖 → absolute (음수 좌표 포함)", () => {
    const ctx = ctxOf(3);
    const result = resolvePlacementForDrop(ctx, "p2", { x: -4000, y: -500 });
    expect(result.kind).toBe("absolute");
    expect(result.entries[0].placement).toEqual({
      style: { position: "absolute", left: -4000, top: -500 },
    });
  });

  it("고정 칸에 놓으면 두 페이지를 교환한다 (entry 2)", () => {
    const placements = {
      p1: { style: { gridColumnStart: 3, gridRowStart: 1 } },
      p2: { style: { gridColumnStart: 2, gridRowStart: 2 } },
    };
    const ctx = ctxOf(4, placements);
    const result = resolvePlacementForDrop(ctx, "p2", {
      x: 2 * STRIDE + 10,
      y: 10,
    });
    expect(result.kind).toBe("swapped");
    expect(result.entries).toEqual([
      {
        pageId: "p2",
        placement: { style: { gridColumnStart: 3, gridRowStart: 1 } },
      },
      {
        pageId: "p1",
        placement: { style: { gridColumnStart: 2, gridRowStart: 2 } },
      },
    ]);
  });

  it("흐름 페이지가 있던 칸이면 고정만 하고 그 페이지는 재흐름에 맡긴다 (entry 1)", () => {
    const ctx = ctxOf(4);
    const result = resolvePlacementForDrop(ctx, "p3", {
      x: STRIDE + 10,
      y: 10,
    });
    expect(result.kind).toBe("pinned");
    expect(result.entries).toHaveLength(1);
  });

  it("첫 칸은 거부된다 (Home 의 흐름 원점)", () => {
    const ctx = ctxOf(4);
    const result = resolvePlacementForDrop(ctx, "p2", { x: 10, y: 10 });
    expect(result).toEqual({
      entries: [],
      kind: "rejected",
      reason: "first-cell-reserved",
    });
  });

  it("Home 은 어떤 드롭도 거부한다", () => {
    const ctx = ctxOf(4);
    for (const drop of [
      { x: 2 * STRIDE + 10, y: 10 },
      { x: -5000, y: -5000 },
    ]) {
      const result = resolvePlacementForDrop(ctx, "p0", drop);
      expect(result).toEqual({
        entries: [],
        kind: "rejected",
        reason: "home-immovable",
      });
    }
  });

  it("교환 상대가 Home 이면 거부한다", () => {
    const placements = {
      p0: { style: { gridColumnStart: 2, gridRowStart: 1 } },
    };
    const ctx = ctxOf(3, placements);
    const cells = buildGridCells(ctx);
    const target = cells.find((c) => c.column === 2 && c.row === 1)!;
    expect(findPinnedOccupant(ctx, target, "p1")).toBe("p0");
    const result = resolvePlacementForDrop(ctx, "p1", {
      x: target.x + 10,
      y: target.y + 10,
    });
    expect(result.kind).toBe("rejected");
  });
});

describe("tier override 쓰기", () => {
  it("토글 ON 이면 base 를 건드리지 않고 활성 tier 에만 쓴다", () => {
    const ctx = ctxOf(
      4,
      {},
      { writeAsOverride: true, activeBreakpoint: "mobile" },
    );
    const result = resolvePlacementForDrop(ctx, "p3", {
      x: 2 * STRIDE + 10,
      y: 10,
    });
    const placement = result.entries[0].placement!;
    expect(placement.style).toBeUndefined();
    expect(placement.responsive?.gridColumnStart).toEqual({ mobile: 3 });
    expect(placement.responsive?.gridRowStart).toEqual({ mobile: 1 });
    // 흐름/절대 전환 때 옛 키가 cascade 로 남지 않도록 계열 전체를 명시한다
    expect(placement.responsive?.position).toEqual({ mobile: "static" });
    expect(placement.responsive?.left).toEqual({ mobile: "auto" });
  });

  it("absolute override 는 line 을 auto 로 눌러 둔다", () => {
    const ctx = ctxOf(
      3,
      {},
      { writeAsOverride: true, activeBreakpoint: "tablet" },
    );
    const result = resolvePlacementForDrop(ctx, "p2", { x: -3000, y: 40 });
    const placement = result.entries[0].placement!;
    expect(placement.responsive?.position).toEqual({ tablet: "absolute" });
    expect(placement.responsive?.left).toEqual({ tablet: -3000 });
    expect(placement.responsive?.gridColumnStart).toEqual({ tablet: "auto" });
  });
});

describe("align — Home 제외 전부 흐름 복귀", () => {
  it("placement 가 있는 페이지만 지운다", () => {
    const placements = {
      p1: { style: { gridColumnStart: 3, gridRowStart: 1 } },
      p3: { style: { position: "absolute", left: -1000, top: 0 } },
    };
    expect(
      resolvePlacementsForAlign({
        pages: pages(4),
        homePageId: "p0",
        placements,
      }),
    ).toEqual([
      { pageId: "p1", placement: null },
      { pageId: "p3", placement: null },
    ]);
  });

  it("Home 은 대상이 아니다", () => {
    const placements = {
      p0: { style: { gridColumnStart: 2, gridRowStart: 1 } },
    };
    expect(
      resolvePlacementsForAlign({
        pages: pages(3),
        homePageId: "p0",
        placements,
      }),
    ).toEqual([]);
  });
});

describe("칸 유일성 (R9 — 엔진 겹침 허용에 기대지 않는다)", () => {
  it("같은 칸을 두 페이지가 고정하면 잡는다", () => {
    expect(
      findDuplicatePinnedCells({
        p1: { style: { gridColumnStart: 3, gridRowStart: 1 } },
        p2: { style: { gridColumnStart: 3, gridRowStart: 1 } },
      }),
    ).toEqual([{ cell: "3/1", pageIds: ["p1", "p2"] }]);
  });

  it("교환 결과는 유일성을 깨지 않는다", () => {
    const placements: Record<string, PagePlacement> = {
      p1: { style: { gridColumnStart: 3, gridRowStart: 1 } },
      p2: { style: { gridColumnStart: 2, gridRowStart: 2 } },
    };
    const ctx = ctxOf(4, placements);
    const result = resolvePlacementForDrop(ctx, "p2", {
      x: 2 * STRIDE + 10,
      y: 10,
    });
    const next = { ...placements };
    for (const entry of result.entries) {
      if (entry.placement === null) delete next[entry.pageId];
      else next[entry.pageId] = entry.placement;
    }
    expect(findDuplicatePinnedCells(next)).toEqual([]);
  });

  it("absolute 는 칸 점유가 아니다", () => {
    expect(
      findDuplicatePinnedCells({
        p1: { style: { position: "absolute", left: 0, top: 0 } },
        p2: { style: { position: "absolute", left: 0, top: 0 } },
      }),
    ).toEqual([]);
  });
});

describe("Home 식별", () => {
  it("시스템 페이지는 건너뛴다 — store 순서는 Components 가 앞에 온다 (live 실측 09-22)", () => {
    const withSystem = [
      { id: "page-components", system: true },
      { id: "home", system: false },
      { id: "p2", system: false },
    ];
    expect(resolveHomePageId(withSystem, (p) => p.system)).toBe("home");
    // 술어를 주지 않으면 첫 페이지 — 이 경로로 판정하면 Home 이 이동 가능해진다 (R10)
    expect(resolveHomePageId(withSystem)).toBe("page-components");
  });

  it("canonical 순서 첫 사용자 페이지가 Home 이고 편집 불가다", () => {
    expect(resolveHomePageId(pages(3))).toBe("p0");
    expect(isPlacementEditable("p0", "p0")).toBe(false);
    expect(isPlacementEditable("p1", "p0")).toBe(true);
  });
});

describe("파생과의 왕복 — 판정한 placement 가 실제로 그 칸을 만든다", () => {
  it("고정 판정 → 파생 → 같은 좌표", () => {
    const ctx = ctxOf(4);
    const drop = { x: 2 * STRIDE + 40, y: ROW + 30 };
    const result = resolvePlacementForDrop(ctx, "p3", drop);
    const cell = findCellForDrop(buildGridCells(ctx), drop, {
      width: W,
      height: H,
    })!;
    const next = derivePagePositions({
      pages: pages(4),
      pageSizes: sizes(4),
      pageLayout: {
        direction: "auto",
        gap: GAP,
        columns: 3,
        placements: Object.fromEntries(
          result.entries.map((e) => [e.pageId, e.placement!]),
        ),
      },
      activeBreakpoint: "desktop",
    })!;
    expect(Math.round(next.p3.x)).toBe(cell.x);
    expect(Math.round(next.p3.y)).toBe(cell.y);
  });

  it("absolute 판정 → 파생 → 놓은 좌표 그대로", () => {
    const ctx = ctxOf(3);
    const drop = { x: -4321, y: 765 };
    const result = resolvePlacementForDrop(ctx, "p2", drop);
    const next = derivePagePositions({
      pages: pages(3),
      pageSizes: sizes(3),
      pageLayout: {
        direction: "auto",
        gap: GAP,
        columns: 3,
        placements: { p2: result.entries[0].placement! },
      },
      activeBreakpoint: "desktop",
    })!;
    expect([Math.round(next.p2.x), Math.round(next.p2.y)]).toEqual([
      -4321, 765,
    ]);
  });
});
