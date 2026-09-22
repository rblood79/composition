/**
 * ADR-232 G4 — 저장 좌표 → placement 이관 (BC).
 *
 * 판정 기준은 **Home 기준 상대 world 벡터 Δ0** 이다 (tier 3 모두). 화면 픽셀은 뷰포트가 세션
 * 상태라 reload 를 넘어 보존되는 양이 아니며, 이관 세션 안의 pan 보정만 따로 확인한다.
 *
 * fixture 는 ADR G4 행렬 + G0 로컬 문서 실측에서 온다 (혼합 승격 · 여러 행 · 불규칙 크기 ·
 * 빈 열 · Home 오프셋 317 · 음수 칸 · tier A→B→A · absolute→flow→absolute).
 */
import { beforeAll, describe, expect, it } from "vitest";
import { initEngineWasm, isEngineReady } from "../wasm-bindings/engineWasm";
import { derivePagePositions } from "./pagePlacement";
import {
  migratePagePositionsToPlacements,
  resolveMigrationPanCorrection,
  type MigrationInput,
} from "./pagePlacementMigration";
import type { BreakpointName, PagePlacement } from "@composition/shared";

const GAP = 80;
const TIER = {
  desktop: { width: 1920, height: 1080 },
  tablet: { width: 768, height: 1024 },
  mobile: { width: 390, height: 844 },
} as const;
const STRIDE = {
  desktop: TIER.desktop.width + GAP,
  tablet: TIER.tablet.width + GAP,
  mobile: TIER.mobile.width + GAP,
};
const COLUMNS = 3;

const pages = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ id: `p${i}` }));

function sizesFor(
  ids: readonly string[],
  breakpoint: BreakpointName,
  overrides: Record<string, { width: number; height: number }> = {},
) {
  return Object.fromEntries(
    ids.map((id) => [id, overrides[id] ?? { ...TIER[breakpoint] }]),
  );
}

function makeInput(
  n: number,
  positions: MigrationInput["pagePositions"],
  opts: {
    sizeOverrides?: Record<string, { width: number; height: number }>;
    columns?: number;
    systemPageIds?: Set<string>;
  } = {},
): MigrationInput {
  const ids = pages(n).map((p) => p.id);
  return {
    pages: pages(n),
    homePageId: "p0",
    systemPageIds: opts.systemPageIds ?? new Set(),
    pagePositions: positions,
    tiers: {
      desktop: { stride: STRIDE.desktop },
      tablet: { stride: STRIDE.tablet },
      mobile: { stride: STRIDE.mobile },
    },
    derive: (breakpoint, placements) =>
      derivePagePositions({
        pages: pages(n),
        pageSizes: sizesFor(ids, breakpoint, opts.sizeOverrides),
        pageLayout: {
          direction: "auto",
          gap: GAP,
          columns: opts.columns ?? COLUMNS,
          placements,
        },
        activeBreakpoint: breakpoint,
        systemPageIds: opts.systemPageIds,
      }),
  };
}

/** 이관 결과로 파생을 돌려 Home 기준 벡터를 재현한다. */
function derivedVectors(
  n: number,
  placements: Record<string, PagePlacement>,
  breakpoint: BreakpointName,
  opts: {
    sizeOverrides?: Record<string, { width: number; height: number }>;
    columns?: number;
  } = {},
) {
  const ids = pages(n).map((p) => p.id);
  const derived = derivePagePositions({
    pages: pages(n),
    pageSizes: sizesFor(ids, breakpoint, opts.sizeOverrides),
    pageLayout: {
      direction: "auto",
      gap: GAP,
      columns: opts.columns ?? COLUMNS,
      placements,
    },
    activeBreakpoint: breakpoint,
  })!;
  const home = derived.p0;
  return Object.fromEntries(
    ids
      .filter((id) => derived[id])
      .map((id) => [
        id,
        [
          Math.round(derived[id].x - home.x),
          Math.round(derived[id].y - home.y),
        ],
      ]),
  );
}

function storedVectors(
  positions: MigrationInput["pagePositions"],
  breakpoint: BreakpointName,
) {
  const entries = Object.entries(positions)
    .filter(([, byBp]) => byBp[breakpoint])
    .map(([id, byBp]) => [id, byBp[breakpoint]!] as const);
  const home = entries.find(([id]) => id === "p0")?.[1];
  if (!home) return {};
  return Object.fromEntries(
    entries.map(([id, p]) => [
      id,
      [Math.round(p.x - home.x), Math.round(p.y - home.y)],
    ]),
  );
}

beforeAll(async () => {
  await initEngineWasm();
  expect(isEngineReady()).toBe(true);
});

/** G4 (a) normalized-world Δ0 — 모든 fixture × tier. */
function expectVectorParity(
  n: number,
  positions: MigrationInput["pagePositions"],
  opts: {
    sizeOverrides?: Record<string, { width: number; height: number }>;
    columns?: number;
    systemPageIds?: Set<string>;
  } = {},
) {
  const result = migratePagePositionsToPlacements(
    makeInput(n, positions, opts),
  );
  expect(result.deferred).toBe(false);
  for (const breakpoint of [
    "desktop",
    "tablet",
    "mobile",
  ] as BreakpointName[]) {
    const stored = storedVectors(positions, breakpoint);
    if (Object.keys(stored).length === 0) continue;
    const derived = derivedVectors(n, result.placements, breakpoint, opts);
    for (const [id, want] of Object.entries(stored)) {
      expect({ breakpoint, id, got: derived[id] }).toEqual({
        breakpoint,
        id,
        got: want,
      });
    }
  }
  return result;
}

describe("G4 (a) normalized-world Δ0", () => {
  it("기본 흐름 문서 — placement 쓰기 0 (v)", () => {
    const positions = {
      p0: { desktop: { x: 0, y: 0 } },
      p1: { desktop: { x: 2000, y: 0 } },
      p2: { desktop: { x: 4000, y: 0 } },
      p3: { desktop: { x: 0, y: 1160 } },
    };
    const result = expectVectorParity(4, positions);
    expect(result.placements).toEqual({});
  });

  it("Home 오프셋 317 (leftInset) 이 정규화로 사라진다", () => {
    const positions = {
      p0: { desktop: { x: 317, y: 0 } },
      p1: { desktop: { x: 2317, y: 0 } },
      p2: { desktop: { x: 4317, y: 0 } },
    };
    const result = expectVectorParity(3, positions);
    expect(result.placements).toEqual({});
    expect(result.tiers[0].homeOrigin).toEqual({ x: 317, y: 0 });
  });

  it("혼합 승격 — 손 배치 1 + 나머지 흐름 (round 1 h1 재현)", () => {
    const positions = {
      p0: { desktop: { x: 0, y: 0 } },
      p1: { desktop: { x: 2000, y: 0 } },
      p2: { desktop: { x: 4000, y: 0 } },
      p3: { desktop: { x: 111, y: 3000 } },
    };
    const result = expectVectorParity(4, positions);
    expect(result.placements.p3?.style?.position).toBe("absolute");
    // 흐름에 남은 페이지가 승격 때문에 밀리지 않았다
    expect(derivedVectors(4, result.placements, "desktop").p1).toEqual([
      2000, 0,
    ]);
  });

  it("여러 행 + 불규칙 높이 (행 최대)", () => {
    const sizeOverrides = { p1: { width: 1920, height: 1600 } };
    const positions = {
      p0: { desktop: { x: 0, y: 0 } },
      p1: { desktop: { x: 2000, y: 0 } },
      p2: { desktop: { x: 4000, y: 0 } },
      p3: { desktop: { x: 0, y: 1680 } },
      p4: { desktop: { x: 2000, y: 1680 } },
    };
    expectVectorParity(5, positions, { sizeOverrides });
  });

  it("빈 열 — 3열 중 2열만 차고 3열에 고정된 페이지 (round 2 m3)", () => {
    const positions = {
      p0: { desktop: { x: 0, y: 0 } },
      p1: { desktop: { x: 4000, y: 0 } },
    };
    const result = expectVectorParity(2, positions);
    expect(result.placements.p1?.style).toEqual({
      gridColumnStart: 3,
      gridRowStart: 1,
    });
  });

  it("음수 칸 (Home 왼쪽 열 · Home 위 행) — absolute 갈래 (G0 실측)", () => {
    const positions = {
      p0: { desktop: { x: 2000, y: 1160 } },
      p1: { desktop: { x: 0, y: 1160 } },
      p2: { desktop: { x: 2000, y: 0 } },
      p3: { desktop: { x: 4000, y: 1160 } },
    };
    const result = expectVectorParity(4, positions);
    expect(result.placements.p1?.style?.position).toBe("absolute");
    expect(result.placements.p2?.style?.position).toBe("absolute");
    // 음수 칸은 **그 페이지만** absolute 로 간다 — 보수 갈래 (전체 absolute) 로 떨어지지 않는다.
    //   음수 열을 칸으로 보내면 엔진이 auto 로 흘려 검증이 깨지고 문서 전체가 absolute 가 된다.
    expect(result.tiers[0].fallback).toBe(false);
    expect(result.placements.p3?.style).toEqual({
      gridColumnStart: 2,
      gridRowStart: 1,
    });
  });

  it("tier A→B→A — desktop/mobile 배치가 다르고 tablet 은 저장값 없음", () => {
    const positions = {
      p0: { desktop: { x: 0, y: 0 }, mobile: { x: 0, y: 0 } },
      p1: { desktop: { x: 2000, y: 0 }, mobile: { x: 0, y: 924 } },
      p2: { desktop: { x: 4000, y: 0 }, mobile: { x: 470, y: 924 } },
    };
    const result = expectVectorParity(3, positions);
    // mobile 만 달라졌으므로 override 가 mobile 키에만 있다
    expect(result.placements.p1?.responsive?.gridRowStart).toEqual({
      mobile: 2,
    });
    expect(result.placements.p1?.responsive?.gridColumnStart).toEqual({
      mobile: 1,
    });
  });

  it("absolute → flow → absolute (tier 마다 성격이 갈린다)", () => {
    const positions = {
      p0: {
        desktop: { x: 0, y: 0 },
        tablet: { x: 0, y: 0 },
        mobile: { x: 0, y: 0 },
      },
      p1: {
        desktop: { x: 333, y: 4000 },
        tablet: { x: 848, y: 0 },
        mobile: { x: 77, y: 5000 },
      },
    };
    const result = expectVectorParity(2, positions);
    expect(result.placements.p1?.style?.position).toBe("absolute");
    // tablet 은 **기본 흐름 자리** 라 placement 없이 맞는다 → 명시 reset 만 실린다.
    //   (reset 이 없으면 cascade 로 desktop 의 absolute 가 tablet 까지 샌다 — m4)
    expect(result.placements.p1?.responsive?.position?.tablet).toBe("static");
    expect(result.placements.p1?.responsive?.gridColumnStart?.tablet).toBe(
      "auto",
    );
    expect(result.placements.p1?.responsive?.left?.tablet).toBe("auto");
    expect(result.placements.p1?.responsive?.position?.mobile).toBe("absolute");
  });

  it("시스템 페이지는 이관 대상이 아니다 (파생 기본값이 왼쪽 열에 둔다)", () => {
    const positions = {
      p0: { desktop: { x: 0, y: 0 } },
      p1: { desktop: { x: 2000, y: 0 } },
      "page-components": { desktop: { x: -2000, y: 0 } },
    };
    const result = migratePagePositionsToPlacements(
      makeInput(2, positions, { systemPageIds: new Set(["page-components"]) }),
    );
    expect(result.placements["page-components"]).toBeUndefined();
  });
});

describe("G4 (a) 보수 갈래 — 검증 실패 시 Home 제외 전부 absolute", () => {
  it("파생이 저장 벡터를 재현하지 못하면 전체 absolute 로 떨어진다", () => {
    // 같은 칸을 두 페이지가 차지하는 저장 좌표 (엔진 겹침 허용을 이관이 흡수해선 안 된다)
    const positions = {
      p0: { desktop: { x: 0, y: 0 } },
      p1: { desktop: { x: 2000, y: 0 } },
      p2: { desktop: { x: 2000, y: 0 } },
    };
    const result = migratePagePositionsToPlacements(makeInput(3, positions));
    expect(result.tiers[0].fallback).toBe(true);
    expect(result.placements.p1?.style?.position).toBe("absolute");
    expect(result.placements.p2?.style?.position).toBe("absolute");
    // Home 은 흐름 원점에 남는다
    expect(result.placements.p0).toBeUndefined();
    const derived = derivedVectors(3, result.placements, "desktop");
    expect(derived.p1).toEqual([2000, 0]);
    expect(derived.p2).toEqual([2000, 0]);
  });
});

describe("G4 (b) 이관 세션 뷰포트 보정", () => {
  it("newPan = oldPan + H × zoom (world −H 이동의 화면 상쇄)", () => {
    const pan = { x: 40, y: 10 };
    const next = resolveMigrationPanCorrection(pan, { x: 317, y: 0 }, 0.5);
    expect(next).toEqual({ x: 40 + 317 * 0.5, y: 10 });
    // 화면 좌표 불변: screen = world*zoom + pan
    const screenBefore = 317 * 0.5 + pan.x;
    const screenAfter = 0 * 0.5 + next.x;
    expect(screenAfter).toBe(screenBefore);
  });

  it("Home 원점이 없으면 보정하지 않는다", () => {
    expect(resolveMigrationPanCorrection({ x: 5, y: 6 }, null, 1)).toEqual({
      x: 5,
      y: 6,
    });
  });
});

describe("엔진 미준비", () => {
  it("파생이 null 이면 이관을 보류한다 (다음 세션에 다시 시도)", () => {
    const positions = {
      p0: { desktop: { x: 0, y: 0 } },
      p1: { desktop: { x: 7, y: 9 } },
    };
    const input = { ...makeInput(2, positions), derive: () => null };
    const result = migratePagePositionsToPlacements(input);
    expect(result.deferred).toBe(true);
    expect(result.placements).toEqual({});
  });
});
