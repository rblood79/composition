/**
 * ADR-232 G1 — 페이지 배치 파생 (합성 grid root) 단위 게이트.
 *
 * oracle = 현행 `calculatePagePositions` (기본 문서에서 Δ0 이어야 한다 — 이관 없는 새 문서의
 * 배치가 바뀌면 그 자체가 회귀다). 실제 wasm 엔진을 돌린다 — grid 의미를 흉내 내면
 * "TS 가 스스로와 정합" 만 확인하게 된다.
 */
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { initEngineWasm, isEngineReady } from "../wasm-bindings/engineWasm";
import { calculatePagePositions } from "./__tests__/legacyPagePositionsOracle";

/** 페이지별 frame 크기 (body 저작 크기). */
type PageFrameSizes = Readonly<
  Record<string, { width: number; height: number } | undefined>
>;
import {
  __resetPagePlacementEngine,
  __resetPagePlacementMemo,
  __setPagePlacementEngine,
  buildContainerStyle,
  derivePagePositions,
  derivePagePositionsMemo,
  __resetAutoColumns,
  DEFAULT_PAGE_LAYOUT_COLUMNS,
  getPagePlacementDerivationCount,
  MAX_PAGE_LAYOUT_COLUMNS,
  resolveAutoColumns,
  resetPagePlacementDerivationCount,
  resolvePageLayout,
  resolvePagePlacementStyle,
} from "./pagePlacement";
import type {
  BreakpointName,
  PageLayoutSettingsDocument,
} from "@composition/shared";

const GAP = 80;
const TIER: Record<BreakpointName, { width: number; height: number }> = {
  desktop: { width: 1920, height: 1080 },
  tablet: { width: 768, height: 1024 },
  mobile: { width: 390, height: 844 },
};

const pagesOf = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ id: `p${i}` }));

const uniformSizes = (n: number, bp: BreakpointName): PageFrameSizes =>
  Object.fromEntries(
    Array.from({ length: n }, (_, i) => [`p${i}`, { ...TIER[bp] }]),
  );

/** 현행 oracle 호출 — 같은 열 수 · gap · 원점(0) 으로 맞춘다. */
function oracle(
  n: number,
  bp: BreakpointName,
  direction: "auto" | "vertical" | "horizontal",
  columns: number,
  sizes: PageFrameSizes,
) {
  return calculatePagePositions(
    pagesOf(n),
    TIER[bp].width,
    TIER[bp].height,
    GAP,
    direction,
    // auto 열 수는 availableWidth 에서 도출된다 — columns 개가 정확히 들어가는 폭을 준다.
    columns * TIER[bp].width + (columns - 1) * GAP,
    0,
    sizes,
    undefined,
  );
}

const asMap = (positions: Record<string, { x: number; y: number }>) =>
  Object.fromEntries(
    Object.entries(positions).map(([id, p]) => [
      id,
      [Math.round(p.x), Math.round(p.y)],
    ]),
  );

beforeAll(async () => {
  await initEngineWasm();
  expect(isEngineReady()).toBe(true);
});

beforeEach(() => {
  __resetPagePlacementMemo();
  resetPagePlacementDerivationCount();
});

describe("G1 (a) 파생 = 현행 calculatePagePositions (균일 크기)", () => {
  const breakpoints: BreakpointName[] = ["desktop", "tablet", "mobile"];
  const directions = ["auto", "vertical", "horizontal"] as const;

  for (const bp of breakpoints) {
    for (const direction of directions) {
      for (const n of [1, 2, 3, 5, 7, 12, 30]) {
        it(`${bp} · ${direction} · 페이지 ${n}`, () => {
          const columns = 3;
          const sizes = uniformSizes(n, bp);
          const derived = derivePagePositions({
            pages: pagesOf(n),
            pageSizes: sizes,
            pageLayout: { direction, gap: GAP, columns },
            activeBreakpoint: bp,
          });
          expect(derived).not.toBeNull();
          expect(asMap(derived!)).toEqual(
            asMap(oracle(n, bp, direction, columns, sizes)),
          );
        });
      }
    }
  }
});

describe("G1 (b) 불규칙 높이 — 행 높이 = 행 최대 (rowMaxHeight 동형)", () => {
  it("desktop auto 3열, 2행에 걸친 5 페이지", () => {
    const heights = [1080, 1600, 900, 1080, 1080];
    const sizes: PageFrameSizes = Object.fromEntries(
      heights.map((h, i) => [`p${i}`, { width: 1920, height: h }]),
    );
    const derived = derivePagePositions({
      pages: pagesOf(5),
      pageSizes: sizes,
      pageLayout: { direction: "auto", gap: GAP, columns: 3 },
      activeBreakpoint: "desktop",
    });
    expect(asMap(derived!)).toEqual(
      asMap(oracle(5, "desktop", "auto", 3, sizes)),
    );
    // 둘째 행 y = 첫 행 최대 높이 (1600) + gap
    expect(Math.round(derived!.p3.y)).toBe(1680);
  });

  it("폭이 제각각이어도 auto 칸은 tier 폭 stride 를 유지한다", () => {
    const widths = [1920, 1200, 2400];
    const sizes: PageFrameSizes = Object.fromEntries(
      widths.map((w, i) => [`p${i}`, { width: w, height: 1080 }]),
    );
    const derived = derivePagePositions({
      pages: pagesOf(3),
      pageSizes: sizes,
      pageLayout: { direction: "auto", gap: GAP, columns: 3 },
      activeBreakpoint: "desktop",
    });
    expect(asMap(derived!)).toEqual(
      asMap(oracle(3, "desktop", "auto", 3, sizes)),
    );
    expect(Math.round(derived!.p2.x)).toBe(4000);
  });

  it("vertical 은 각 페이지 자기 높이로 쌓인다", () => {
    const heights = [1080, 1600, 900];
    const sizes: PageFrameSizes = Object.fromEntries(
      heights.map((h, i) => [`p${i}`, { width: 1920, height: h }]),
    );
    const derived = derivePagePositions({
      pages: pagesOf(3),
      pageSizes: sizes,
      pageLayout: { direction: "vertical", gap: GAP, columns: 3 },
      activeBreakpoint: "desktop",
    });
    expect(asMap(derived!)).toEqual(
      asMap(oracle(3, "desktop", "vertical", 3, sizes)),
    );
    expect(Math.round(derived!.p2.y)).toBe(1080 + GAP + 1600 + GAP);
  });

  it("horizontal 은 각 페이지 자기 폭으로 이어진다", () => {
    const widths = [1920, 800, 400];
    const sizes: PageFrameSizes = Object.fromEntries(
      widths.map((w, i) => [`p${i}`, { width: w, height: 1080 }]),
    );
    const derived = derivePagePositions({
      pages: pagesOf(3),
      pageSizes: sizes,
      pageLayout: { direction: "horizontal", gap: GAP, columns: 3 },
      activeBreakpoint: "desktop",
    });
    expect(asMap(derived!)).toEqual(
      asMap(oracle(3, "desktop", "horizontal", 3, sizes)),
    );
    expect(Math.round(derived!.p2.x)).toBe(1920 + GAP + 800 + GAP);
  });
});

describe("G1 (c) 칸 고정 longhand · absolute 음수 inset", () => {
  const sizes = uniformSizes(4, "desktop");

  it("고정 칸은 그 칸에, 흐름은 남은 칸을 채운다", () => {
    const derived = derivePagePositions({
      pages: pagesOf(4),
      pageSizes: sizes,
      pageLayout: {
        direction: "auto",
        gap: GAP,
        columns: 3,
        placements: {
          p1: { style: { gridColumnStart: 3, gridRowStart: 1 } },
        },
      },
      activeBreakpoint: "desktop",
    });
    expect(asMap(derived!)).toEqual({
      p0: [0, 0],
      p1: [4000, 0],
      p2: [2000, 0],
      p3: [0, 1160],
    });
  });

  it("빈 열은 0 폭으로 접히지 않는다 — 고정 폭 track (round 2 m3)", () => {
    const derived = derivePagePositions({
      pages: pagesOf(2),
      pageSizes: uniformSizes(2, "desktop"),
      pageLayout: {
        direction: "auto",
        gap: GAP,
        columns: 3,
        placements: { p1: { style: { gridColumnStart: 3, gridRowStart: 1 } } },
      },
      activeBreakpoint: "desktop",
    });
    // 둘째 열이 비어도 셋째 칸 x 는 4000 (접히면 2000 이 된다)
    expect(Math.round(derived!.p1.x)).toBe(4000);
  });

  it("absolute 는 음수 inset 을 그대로 쓴다 (Components 시스템 열 −2000)", () => {
    const derived = derivePagePositions({
      pages: pagesOf(2),
      pageSizes: uniformSizes(2, "desktop"),
      pageLayout: {
        direction: "auto",
        gap: GAP,
        columns: 3,
        placements: {
          p1: { style: { position: "absolute", left: -2000, top: 0 } },
        },
      },
      activeBreakpoint: "desktop",
    });
    expect(asMap(derived!)).toEqual({ p0: [0, 0], p1: [-2000, 0] });
  });

  it("absolute 로 빠진 페이지의 칸은 뒤 페이지가 채운다", () => {
    const derived = derivePagePositions({
      pages: pagesOf(3),
      pageSizes: uniformSizes(3, "desktop"),
      pageLayout: {
        direction: "auto",
        gap: GAP,
        columns: 3,
        placements: {
          p1: { style: { position: "absolute", left: 9000, top: 9000 } },
        },
      },
      activeBreakpoint: "desktop",
    });
    expect(Math.round(derived!.p2.x)).toBe(2000);
  });

  it("row span 은 다음 행 흐름을 밀어낸다", () => {
    const derived = derivePagePositions({
      pages: pagesOf(4),
      pageSizes: uniformSizes(4, "desktop"),
      pageLayout: {
        direction: "auto",
        gap: GAP,
        columns: 3,
        placements: {
          p0: { style: { gridRowStart: 1, gridRowEnd: 3 } },
        },
      },
      activeBreakpoint: "desktop",
    });
    expect(Math.round(derived!.p3.y)).toBe(1160);
    expect(Math.round(derived!.p3.x)).toBe(2000);
  });
});

describe("G1 (d) tier override — root 열 수 · 페이지 칸이 mobile 에서만", () => {
  it("mobile 열 수 override 는 mobile 에서만 적용된다", () => {
    const layout: PageLayoutSettingsDocument = {
      direction: "auto",
      gap: GAP,
      columns: 3,
      responsive: { columns: { mobile: 6 } },
    };
    expect(resolvePageLayout(layout, "desktop").columns).toBe(3);
    expect(resolvePageLayout(layout, "tablet").columns).toBe(3);
    expect(resolvePageLayout(layout, "mobile").columns).toBe(6);

    const mobile = derivePagePositions({
      pages: pagesOf(7),
      pageSizes: uniformSizes(7, "mobile"),
      pageLayout: layout,
      activeBreakpoint: "mobile",
    });
    // 6열이면 7번째가 둘째 행 첫 칸
    expect(Math.round(mobile!.p6.x)).toBe(0);
    expect(Math.round(mobile!.p5.x)).toBe(5 * (390 + GAP));
  });

  it("페이지 칸 override 가 responsive eligibility·cascade 를 통과한다", () => {
    const placements = {
      p1: {
        style: {},
        responsive: {
          gridColumnStart: { mobile: 3 },
          gridRowStart: { mobile: 1 },
        },
      },
    };
    expect(resolvePagePlacementStyle(placements.p1, "desktop")).toEqual({});
    expect(resolvePagePlacementStyle(placements.p1, "tablet")).toEqual({});
    expect(resolvePagePlacementStyle(placements.p1, "mobile")).toEqual({
      gridColumnStart: 3,
      gridRowStart: 1,
    });

    const desktop = derivePagePositions({
      pages: pagesOf(2),
      pageSizes: uniformSizes(2, "desktop"),
      pageLayout: { direction: "auto", gap: GAP, columns: 3, placements },
      activeBreakpoint: "desktop",
    });
    expect(Math.round(desktop!.p1.x)).toBe(2000);

    const mobile = derivePagePositions({
      pages: pagesOf(2),
      pageSizes: uniformSizes(2, "mobile"),
      pageLayout: { direction: "auto", gap: GAP, columns: 3, placements },
      activeBreakpoint: "mobile",
    });
    expect(Math.round(mobile!.p1.x)).toBe(2 * (390 + GAP));
  });

  it("eligibility 밖 키는 override 로 들어오지 못한다", () => {
    const style = resolvePagePlacementStyle(
      {
        style: {},
        // gridAutoFlow 는 eligible 이 아니다 — direction 이 breakpoint 공통인 이유
        responsive: { gridAutoFlow: { mobile: "column" } },
      },
      "mobile",
    );
    expect(style).toEqual({});
  });

  it("direction 은 breakpoint 공통이다", () => {
    const layout: PageLayoutSettingsDocument = {
      direction: "vertical",
      gap: GAP,
      columns: 3,
    };
    for (const bp of ["desktop", "tablet", "mobile"] as BreakpointName[]) {
      expect(resolvePageLayout(layout, bp).direction).toBe("vertical");
    }
  });
});

describe("G1 (e) 메모 — 키 불변이면 엔진 호출 0", () => {
  const input = () => ({
    pages: pagesOf(5),
    pageSizes: uniformSizes(5, "desktop"),
    pageLayout: {
      direction: "auto" as const,
      gap: GAP,
      columns: 3,
    },
    activeBreakpoint: "desktop" as BreakpointName,
  });

  it("같은 입력 10회 → 파생 1회", () => {
    for (let i = 0; i < 10; i++) derivePagePositionsMemo(input());
    expect(getPagePlacementDerivationCount()).toBe(1);
  });

  it("frame 크기 벡터가 바뀌면 다시 계산한다", () => {
    derivePagePositionsMemo(input());
    const changed = input();
    changed.pageSizes = {
      ...changed.pageSizes,
      p1: { width: 1920, height: 1600 },
    };
    derivePagePositionsMemo(changed);
    expect(getPagePlacementDerivationCount()).toBe(2);
  });

  it("breakpoint · 열 수 · placement 각각이 키에 들어 있다", () => {
    derivePagePositionsMemo(input());
    derivePagePositionsMemo({ ...input(), activeBreakpoint: "mobile" });
    derivePagePositionsMemo({
      ...input(),
      pageLayout: { direction: "auto", gap: GAP, columns: 4 },
    });
    derivePagePositionsMemo({
      ...input(),
      pageLayout: {
        direction: "auto",
        gap: GAP,
        columns: 3,
        placements: { p1: { style: { gridColumnStart: 3, gridRowStart: 1 } } },
      },
    });
    expect(getPagePlacementDerivationCount()).toBe(4);
  });
});

describe("G1 (f) tier reset — 명시 reset 이 cascade 상속을 끊는다", () => {
  it("desktop absolute · mobile static + line auto → mobile 흐름 복귀", () => {
    const placements = {
      p1: {
        style: { position: "absolute", left: -2000, top: 0 },
        responsive: {
          position: { mobile: "static" },
          left: { mobile: "auto" },
          top: { mobile: "auto" },
        },
      },
    };
    const desktop = derivePagePositions({
      pages: pagesOf(2),
      pageSizes: uniformSizes(2, "desktop"),
      pageLayout: { direction: "auto", gap: GAP, columns: 3, placements },
      activeBreakpoint: "desktop",
    });
    expect(Math.round(desktop!.p1.x)).toBe(-2000);

    // tablet 은 desktop cascade 상속 (override 없음) → 여전히 absolute
    const tablet = derivePagePositions({
      pages: pagesOf(2),
      pageSizes: uniformSizes(2, "tablet"),
      pageLayout: { direction: "auto", gap: GAP, columns: 3, placements },
      activeBreakpoint: "tablet",
    });
    expect(Math.round(tablet!.p1.x)).toBe(-2000);

    const mobile = derivePagePositions({
      pages: pagesOf(2),
      pageSizes: uniformSizes(2, "mobile"),
      pageLayout: { direction: "auto", gap: GAP, columns: 3, placements },
      activeBreakpoint: "mobile",
    });
    expect(Math.round(mobile!.p1.x)).toBe(390 + GAP);
    expect(Math.round(mobile!.p1.y)).toBe(0);
  });

  it("line 을 auto 로 되돌리면 흐름 칸으로 돌아온다", () => {
    const placements = {
      p1: {
        style: { gridColumnStart: 3, gridRowStart: 1 },
        responsive: {
          gridColumnStart: { mobile: "auto" },
          gridRowStart: { mobile: "auto" },
        },
      },
    };
    const desktop = derivePagePositions({
      pages: pagesOf(2),
      pageSizes: uniformSizes(2, "desktop"),
      pageLayout: { direction: "auto", gap: GAP, columns: 3, placements },
      activeBreakpoint: "desktop",
    });
    expect(Math.round(desktop!.p1.x)).toBe(4000);

    const mobile = derivePagePositions({
      pages: pagesOf(2),
      pageSizes: uniformSizes(2, "mobile"),
      pageLayout: { direction: "auto", gap: GAP, columns: 3, placements },
      activeBreakpoint: "mobile",
    });
    expect(Math.round(mobile!.p1.x)).toBe(390 + GAP);
  });
});

describe("G1 (g) Home 은 흐름 원점이다", () => {
  it("placement 가 없으면 첫 페이지가 항상 (0,0)", () => {
    for (const direction of ["auto", "vertical", "horizontal"] as const) {
      const derived = derivePagePositions({
        pages: pagesOf(4),
        pageSizes: uniformSizes(4, "desktop"),
        pageLayout: { direction, gap: GAP, columns: 3 },
        activeBreakpoint: "desktop",
      });
      expect(asMap(derived!).p0).toEqual([0, 0]);
    }
  });

  it("다른 페이지가 absolute 로 나가도 Home 은 원점에 남는다", () => {
    const derived = derivePagePositions({
      pages: pagesOf(3),
      pageSizes: uniformSizes(3, "desktop"),
      pageLayout: {
        direction: "auto",
        gap: GAP,
        columns: 3,
        placements: {
          p1: { style: { position: "absolute", left: -5000, top: -5000 } },
          p2: { style: { position: "absolute", left: 5000, top: 5000 } },
        },
      },
      activeBreakpoint: "desktop",
    });
    expect(asMap(derived!).p0).toEqual([0, 0]);
  });
});

describe("placementModel — 읽기 모드는 placement 존재가 아니라 모델이 정한다", () => {
  it("모델이 없고 저장 좌표가 있으면 저장 좌표를 읽는다 (이관 직전 프레임)", () => {
    const derived = derivePagePositions({
      pages: pagesOf(2),
      pageSizes: uniformSizes(2, "desktop"),
      pageLayout: { direction: "auto", gap: GAP, columns: 3 },
      legacyPositions: {
        p0: { desktop: { x: 317, y: 0 } },
        p1: { desktop: { x: 2317, y: 0 } },
      },
      activeBreakpoint: "desktop",
    });
    expect(asMap(derived!)).toEqual({ p0: [317, 0], p1: [2317, 0] });
  });

  it("모델도 저장 좌표도 없으면 흐름이다 (새 문서)", () => {
    const derived = derivePagePositions({
      pages: pagesOf(2),
      pageSizes: uniformSizes(2, "desktop"),
      pageLayout: { direction: "auto", gap: GAP, columns: 3 },
      activeBreakpoint: "desktop",
    });
    expect(asMap(derived!)).toEqual({ p0: [0, 0], p1: [2000, 0] });
  });

  it("시스템 페이지 좌표만 있는 문서는 흐름이다 (사용자 좌표가 판정 기준)", () => {
    const derived = derivePagePositions({
      pages: [{ id: "page-components" }, { id: "p0" }, { id: "p1" }],
      pageSizes: {
        "page-components": { width: 1920, height: 1080 },
        p0: { width: 1920, height: 1080 },
        p1: { width: 1920, height: 1080 },
      },
      pageLayout: { direction: "auto", gap: GAP, columns: 3 },
      systemPageIds: new Set(["page-components"]),
      legacyPositions: { "page-components": { desktop: { x: -2000, y: 0 } } },
      activeBreakpoint: "desktop",
    });
    expect(asMap(derived!)).toEqual({
      "page-components": [-2000, 0],
      p0: [0, 0],
      p1: [2000, 0],
    });
  });

  it('"legacy" 는 저장 좌표를 그대로 쓴다 (흐름 0)', () => {
    const derived = derivePagePositions({
      pages: pagesOf(3),
      pageSizes: uniformSizes(3, "desktop"),
      pageLayout: {
        direction: "auto",
        gap: GAP,
        columns: 3,
        placementModel: "legacy",
        placements: { p1: { style: { gridColumnStart: 3, gridRowStart: 1 } } },
        legacyFallback: { desktop: { p2: { x: 777, y: 888 } } },
      },
      legacyPositions: {
        p0: { desktop: { x: 10, y: 20 } },
        p1: { desktop: { x: 30, y: 40 } },
      },
      activeBreakpoint: "desktop",
    });
    expect(asMap(derived!)).toEqual({
      p0: [10, 20],
      p1: [30, 40],
      p2: [777, 888],
    });
  });

  it('"derived" 는 placement 가 비어 있어도 합법이다 (기본 흐름)', () => {
    const derived = derivePagePositions({
      pages: pagesOf(2),
      pageSizes: uniformSizes(2, "desktop"),
      pageLayout: {
        direction: "auto",
        gap: GAP,
        columns: 3,
        placementModel: "derived",
      },
      legacyPositions: { p0: { desktop: { x: 999, y: 999 } } },
      activeBreakpoint: "desktop",
    });
    expect(asMap(derived!)).toEqual({ p0: [0, 0], p1: [2000, 0] });
  });
});

describe("컨테이너 style — direction 매핑", () => {
  it("horizontal 은 justifyContent:start 가 있어야 한다 (없으면 x 발산)", () => {
    const style = buildContainerStyle(
      resolvePageLayout({ direction: "horizontal", gap: GAP }, "desktop"),
    );
    expect(style.gridAutoFlow).toBe("column");
    expect(style.justifyContent).toBe("start");
  });

  it("auto 열 track 은 tier 페이지 폭 고정이다", () => {
    for (const bp of ["desktop", "tablet", "mobile"] as BreakpointName[]) {
      const style = buildContainerStyle(
        resolvePageLayout({ direction: "auto", gap: GAP, columns: 3 }, bp),
      );
      expect(style.gridTemplateColumns).toEqual(
        Array(3).fill(`${TIER[bp].width}px`),
      );
    }
  });

  it("vertical 은 1열이다", () => {
    const style = buildContainerStyle(
      resolvePageLayout(
        { direction: "vertical", gap: GAP, columns: 5 },
        "desktop",
      ),
    );
    expect(style.gridTemplateColumns).toEqual(["1920px"]);
  });
});

describe("엔진 미준비 폴백 (부팅 초기 — G0 §4)", () => {
  it("엔진이 준비되지 않았으면 null (호출자는 이전 값 유지)", () => {
    __setPagePlacementEngine({
      isAvailable: () => false,
    } as unknown as Parameters<typeof __setPagePlacementEngine>[0]);
    const derived = derivePagePositions({
      pages: pagesOf(2),
      pageSizes: uniformSizes(2, "desktop"),
      pageLayout: { direction: "auto", gap: GAP, columns: 3 },
      activeBreakpoint: "desktop",
    });
    expect(derived).toBeNull();
    __resetPagePlacementEngine();
  });

  it("페이지가 0 이면 엔진을 부르지 않고 빈 map", () => {
    __setPagePlacementEngine({
      isAvailable: () => false,
    } as unknown as Parameters<typeof __setPagePlacementEngine>[0]);
    expect(
      derivePagePositions({
        pages: [],
        pageSizes: {},
        activeBreakpoint: "desktop",
      }),
    ).toEqual({});
    __resetPagePlacementEngine();
  });

  it("메모는 null 을 캐시하지 않는다 — 엔진이 준비되면 즉시 계산", () => {
    __setPagePlacementEngine({
      isAvailable: () => false,
    } as unknown as Parameters<typeof __setPagePlacementEngine>[0]);
    const input = {
      pages: pagesOf(2),
      pageSizes: uniformSizes(2, "desktop"),
      pageLayout: { direction: "auto" as const, gap: GAP, columns: 3 },
      activeBreakpoint: "desktop" as BreakpointName,
    };
    expect(derivePagePositionsMemo(input)).toBeNull();
    __resetPagePlacementEngine();
    expect(asMap(derivePagePositionsMemo(input)!)).toEqual({
      p0: [0, 0],
      p1: [2000, 0],
    });
  });
});

/**
 * ADR-232 후속 (사용자 보고 2026-09-23 — "column count 변경 시 반영이 되지 않는다").
 *
 * grid 는 명시 track 밖의 line 번호에 implicit track 을 만들고 auto-placement 가 그 격자를
 * 쓴다 → 3열에서 3번 칸에 고정한 페이지 하나가 열 수 설정을 통째로 무력화했다.
 */
describe("고정 칸은 격자를 넓히지 못한다 (열 수 설정이 정본)", () => {
  const sizes = uniformSizes(4, "desktop");
  const pin = (style: Record<string, string | number>) => ({
    p2: { style },
  });

  it("열 수를 줄이면 그 밖의 고정 칸은 마지막 열로 clamp 되고 흐름도 따라 접힌다", () => {
    const derived = derivePagePositions({
      pages: pagesOf(4),
      pageSizes: sizes,
      pageLayout: {
        direction: "auto",
        gap: GAP,
        columns: 2,
        placements: pin({ gridColumnStart: 3, gridRowStart: 2 }),
      },
      activeBreakpoint: "desktop",
    });
    const stride = TIER.desktop.width + GAP;
    // 고정 페이지 = (2열, 2행) 으로 clamp
    expect(asMap(derived!).p2).toEqual([stride, 1160]);
    // 나머지는 2열 흐름 — implicit 3번째 열이 생기지 않는다
    expect(asMap(derived!).p0).toEqual([0, 0]);
    expect(asMap(derived!).p1).toEqual([stride, 0]);
    expect(asMap(derived!).p3).toEqual([0, 1160]);
  });

  it("열 수를 다시 늘리면 문서의 고정 칸이 그대로 돌아온다 (clamp 는 파생 시점만)", () => {
    const layout = {
      direction: "auto" as const,
      gap: GAP,
      placements: pin({ gridColumnStart: 3, gridRowStart: 2 }),
    };
    const stride = TIER.desktop.width + GAP;
    const narrow = derivePagePositions({
      pages: pagesOf(4),
      pageSizes: sizes,
      pageLayout: { ...layout, columns: 2 },
      activeBreakpoint: "desktop",
    });
    const wide = derivePagePositions({
      pages: pagesOf(4),
      pageSizes: sizes,
      pageLayout: { ...layout, columns: 3 },
      activeBreakpoint: "desktop",
    });
    expect(asMap(narrow!).p2).toEqual([stride, 1160]);
    expect(asMap(wide!).p2).toEqual([stride * 2, 1160]);
  });

  it("clamp 뒤 같은 칸이 겹치면 뒤 페이지는 흐름으로 돌아간다 (겹쳐 그리지 않는다)", () => {
    const derived = derivePagePositions({
      pages: pagesOf(4),
      pageSizes: sizes,
      pageLayout: {
        direction: "auto",
        gap: GAP,
        columns: 2,
        placements: {
          p1: { style: { gridColumnStart: 3, gridRowStart: 1 } },
          p2: { style: { gridColumnStart: 4, gridRowStart: 1 } },
        },
      },
      activeBreakpoint: "desktop",
    });
    const map = asMap(derived!);
    const cells = Object.values(map).map((xy) => xy.join(","));
    expect(new Set(cells).size).toBe(cells.length);
  });

  it("span 등 숫자가 아닌 line 값은 손대지 않는다", () => {
    const derived = derivePagePositions({
      pages: pagesOf(2),
      pageSizes: uniformSizes(2, "desktop"),
      pageLayout: {
        direction: "auto",
        gap: GAP,
        columns: 2,
        placements: {
          p1: { style: { gridColumnStart: 2, gridColumnEnd: "span 1" } },
        },
      },
      activeBreakpoint: "desktop",
    });
    expect(asMap(derived!).p1).toEqual([TIER.desktop.width + GAP, 0]);
  });
});

/**
 * ADR-232 후속 (2026-09-23 사용자 요청) — `columns: "auto"`.
 *
 * ADR 은 컨테이너 폭을 뷰포트에 묶는 안 (대안 D) 을 **기본 모델로는** 기각했다 (zoom 마다 칸이
 * 바뀌면 위치가 뷰 상태가 된다). 여기서는 사용자가 명시적으로 고르는 모드이고, 파생 입력은
 * zoom 이 아니라 그 zoom 에서 나온 **정수 열 수** 라 메모가 연속값을 타지 않는다.
 */
describe('columns: "auto" — 보이는 캔버스 폭에서 열 수', () => {
  const W = TIER.desktop.width;

  it("열 수 = 보이는 scene 폭에 들어가는 개수 (마지막 열 뒤 gap 은 제외)", () => {
    // zoom 1 에 정확히 2열 (2×1920 + 80)
    expect(resolveAutoColumns(2 * W + GAP, 1, W, GAP)).toBe(2);
    // 1px 모자라면 1열
    expect(resolveAutoColumns(2 * W + GAP - 1, 1, W, GAP)).toBe(1);
    // zoom 0.5 → 보이는 scene 폭이 2배 (3920 → 7840 = 3열 분 7760 은 되고 4열 분 7920 은 모자람)
    expect(resolveAutoColumns(2 * W + GAP, 0.5, W, GAP)).toBe(3);
    expect(resolveAutoColumns(4 * W + 3 * GAP, 1, W, GAP)).toBe(4);
  });

  it("최소 1 · 최대 24 로 묶이고 비정상 입력은 기본값", () => {
    expect(resolveAutoColumns(10, 1, W, GAP)).toBe(1);
    expect(resolveAutoColumns(1e7, 1, W, GAP)).toBe(MAX_PAGE_LAYOUT_COLUMNS);
    expect(resolveAutoColumns(0, 1, W, GAP)).toBe(DEFAULT_PAGE_LAYOUT_COLUMNS);
    expect(resolveAutoColumns(1000, 0, W, GAP)).toBe(
      DEFAULT_PAGE_LAYOUT_COLUMNS,
    );
  });

  it("resolvePageLayout 이 auto 를 호출자가 준 정수로 해석한다", () => {
    const layout = resolvePageLayout(
      { direction: "auto", gap: GAP, columns: "auto" },
      "desktop",
      5,
    );
    expect(layout.columnsAuto).toBe(true);
    expect(layout.columns).toBe(5);
    const fixed = resolvePageLayout(
      { direction: "auto", gap: GAP, columns: 3 },
      "desktop",
    );
    expect(fixed.columnsAuto).toBe(false);
    expect(fixed.columns).toBe(3);
  });

  it("auto 로 파생한 배치 = 같은 열 수를 숫자로 준 배치", () => {
    const sizes = uniformSizes(5, "desktop");
    const auto = derivePagePositions({
      pages: pagesOf(5),
      pageSizes: sizes,
      pageLayout: { direction: "auto", gap: GAP, columns: "auto" },
      activeBreakpoint: "desktop",
      autoColumns: 2,
    });
    const fixed = derivePagePositions({
      pages: pagesOf(5),
      pageSizes: sizes,
      pageLayout: { direction: "auto", gap: GAP, columns: 2 },
      activeBreakpoint: "desktop",
    });
    expect(asMap(auto!)).toEqual(asMap(fixed!));
  });

  it("정수가 그대로면 엔진을 다시 부르지 않는다 (zoom 연속 변화 비용 0)", () => {
    const input = (autoColumns: number) => ({
      pages: pagesOf(4),
      pageSizes: uniformSizes(4, "desktop"),
      pageLayout: {
        direction: "auto" as const,
        gap: GAP,
        columns: "auto" as const,
      },
      activeBreakpoint: "desktop" as BreakpointName,
      autoColumns,
    });
    resetPagePlacementDerivationCount();
    derivePagePositionsMemo(input(3));
    expect(getPagePlacementDerivationCount()).toBe(1);
    derivePagePositionsMemo(input(3));
    derivePagePositionsMemo(input(3));
    expect(getPagePlacementDerivationCount()).toBe(1);
    derivePagePositionsMemo(input(2));
    expect(getPagePlacementDerivationCount()).toBe(2);
  });

  it("열 수를 안 쓴 문서는 auto 다 (기본값 — 2026-09-23 사용자 판정)", () => {
    const implicit = resolvePageLayout(
      { direction: "auto", gap: GAP },
      "desktop",
      5,
    );
    expect(implicit.columnsAuto).toBe(true);
    expect(implicit.columns).toBe(5);
    // 숫자를 명시한 문서는 그대로 고정 — 기본값 변경이 기존 설정을 덮지 않는다.
    const explicit = resolvePageLayout(
      { direction: "auto", gap: GAP, columns: 3 },
      "desktop",
      5,
    );
    expect(explicit.columnsAuto).toBe(false);
    expect(explicit.columns).toBe(3);
  });

  it("뷰포트를 아직 못 읽었으면 기본 정수로 떨어진다", () => {
    __resetAutoColumns();
    const layout = resolvePageLayout(
      { direction: "auto", gap: GAP },
      "desktop",
    );
    expect(layout.columns).toBe(DEFAULT_PAGE_LAYOUT_COLUMNS);
  });

  it("tier override 도 auto 를 쓴다 (mobile 만 auto)", () => {
    const layout = {
      direction: "auto" as const,
      gap: GAP,
      columns: 3,
      responsive: { columns: { mobile: "auto" as const } },
    };
    expect(resolvePageLayout(layout, "desktop", 7).columns).toBe(3);
    expect(resolvePageLayout(layout, "desktop", 7).columnsAuto).toBe(false);
    expect(resolvePageLayout(layout, "mobile", 7).columns).toBe(7);
    expect(resolvePageLayout(layout, "mobile", 7).columnsAuto).toBe(true);
  });
});
