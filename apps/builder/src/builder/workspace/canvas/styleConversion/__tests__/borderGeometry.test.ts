/**
 * ADR-219 P1 — border 기하 helper 단위 테스트
 *
 * 1. `resolveCssCornerRadii` — CSS Backgrounds 3 §4.5 예제 6 + 균일 반경이 기존
 *    `clampCornerRadii` 와 같은 값 (HC1 경계: 균일 문서 무변경).
 * 2. `resolveBorderGeometry` — 우선순위 longhand ?? shorthand 다중값 ?? shorthand ?? base.
 * 3. 레이아웃 `parseBorder` 와 폭 판독 동치 (px/number 입력).
 * 4. `resolveInnerCornerRadii` — 변 폭 0 코너의 테이퍼 (P0 spike 발견).
 */
import { describe, expect, it } from "vitest";
import {
  BORDER_GEOMETRY_KEYS,
  resolveBorderGeometry,
  resolveCssCornerRadii,
  resolveInnerCornerRadii,
} from "../borderGeometry";
import { clampCornerRadii } from "../../skia/nodeRendererClip";
import { parseBorder } from "../../layout/engines/utils";

describe("resolveCssCornerRadii — CSS §4.5 비례 축소", () => {
  it("한 코너만 큰 반경은 축소되지 않는다 (100×100 [80,0,0,0] → 80, clamp 는 50)", () => {
    expect(resolveCssCornerRadii([80, 0, 0, 0], 100, 100)).toEqual([
      80, 0, 0, 0,
    ]);
    expect(clampCornerRadii([80, 0, 0, 0], 100, 100)).toEqual([50, 0, 0, 0]);
  });

  it("인접 두 코너 합이 변 길이를 넘으면 전체에 같은 계수 (100×100 [80,80,0,0] → 50)", () => {
    expect(resolveCssCornerRadii([80, 80, 0, 0], 100, 100)).toEqual([
      50, 50, 0, 0,
    ]);
  });

  it("계수는 네 변 중 최소 — 한 변이 결정하면 다른 변의 코너도 같이 줄어든다", () => {
    // top: 100/(60+60) = 0.833 · left: 100/(60+20) = 1.25 → f = 0.833 전체
    const r = resolveCssCornerRadii([60, 60, 0, 20], 100, 100);
    expect(r.map((v) => Math.round(v * 1000) / 1000)).toEqual([
      50, 50, 0, 16.667,
    ]);
  });

  it("직사각형: 짧은 변이 계수를 정한다 (200×100 [80,80,80,80] → 50)", () => {
    expect(resolveCssCornerRadii([80, 80, 80, 80], 200, 100)).toEqual([
      50, 50, 50, 50,
    ]);
  });

  it("합이 변 길이 이하면 그대로 (100×100 [30,30,30,30])", () => {
    expect(resolveCssCornerRadii([30, 30, 30, 30], 100, 100)).toEqual([
      30, 30, 30, 30,
    ]);
  });

  it("음수 반경은 0, 크기 0 상자는 전부 0", () => {
    expect(resolveCssCornerRadii([-5, 10, 10, 10], 100, 100)).toEqual([
      0, 10, 10, 10,
    ]);
    expect(resolveCssCornerRadii([10, 10, 10, 10], 0, 100)).toEqual([
      0, 0, 0, 0,
    ]);
  });

  it("균일 반경은 기존 clampCornerRadii 와 같은 값 (HC1 — 균일 문서 무변경)", () => {
    const sizes: Array<[number, number]> = [
      [100, 100],
      [200, 40],
      [17, 33],
      [1, 1],
    ];
    for (const [w, h] of sizes) {
      for (const r of [0, 4, 8, 12, 20, 50, 80, 999]) {
        expect(resolveCssCornerRadii([r, r, r, r], w, h)).toEqual(
          clampCornerRadii([r, r, r, r], w, h),
        );
      }
    }
  });
});

describe("resolveBorderGeometry — 우선순위", () => {
  it("빈 style → 0 · base 만 있으면 base", () => {
    expect(resolveBorderGeometry({}).radii).toEqual([0, 0, 0, 0]);
    expect(resolveBorderGeometry(undefined).widths).toEqual([0, 0, 0, 0]);
    const g = resolveBorderGeometry(
      {},
      { borderRadius: 8, borderWidth: "1px" },
    );
    expect(g.radii).toEqual([8, 8, 8, 8]);
    expect(g.widths).toEqual([1, 1, 1, 1]);
    expect(g.uniformRadius).toBe(8);
    expect(g.uniformWidth).toBe(1);
    expect(g.hasRadiusLonghand).toBe(false);
  });

  it("shorthand 단일값이 base 를 덮는다 (px · number · rem)", () => {
    expect(
      resolveBorderGeometry({ borderRadius: "12px" }, { borderRadius: 8 })
        .radii,
    ).toEqual([12, 12, 12, 12]);
    expect(resolveBorderGeometry({ borderWidth: 3 }).widths).toEqual([
      3, 3, 3, 3,
    ]);
    expect(resolveBorderGeometry({ borderRadius: "1rem" }).uniformRadius).toBe(
      16,
    );
  });

  it("shorthand 다중값 (1~4) 은 CSS 전개 규칙 — 2값 tl=br · 3값 tr=bl", () => {
    expect(resolveBorderGeometry({ borderRadius: "8px 4px" }).radii).toEqual([
      8, 4, 8, 4,
    ]);
    expect(
      resolveBorderGeometry({ borderRadius: "8px 4px 2px" }).radii,
    ).toEqual([8, 4, 2, 4]);
    expect(resolveBorderGeometry({ borderRadius: "80px 0 0 0" }).radii).toEqual(
      [80, 0, 0, 0],
    );
    expect(
      resolveBorderGeometry({ borderWidth: "1px 2px 3px 4px" }).widths,
    ).toEqual([1, 2, 3, 4]);
    expect(
      resolveBorderGeometry({ borderRadius: "8px 4px 2px" }).uniformRadius,
    ).toBeNull();
  });

  it("타원 표기 `8px / 4px` 는 가로 반경만 (원형 한정)", () => {
    expect(resolveBorderGeometry({ borderRadius: "8px / 4px" }).radii).toEqual([
      8, 8, 8, 8,
    ]);
  });

  it("longhand 가 shorthand 와 base 를 이기고, 없는 칸은 shorthand → base 순", () => {
    const g = resolveBorderGeometry(
      { borderRadius: "4px", borderTopLeftRadius: "12px" },
      { borderRadius: 8 },
    );
    expect(g.radii).toEqual([12, 4, 4, 4]);
    expect(g.hasRadiusLonghand).toBe(true);
    expect(g.uniformRadius).toBeNull();

    const w = resolveBorderGeometry({ borderLeftWidth: 0 }, { borderWidth: 1 });
    expect(w.widths).toEqual([1, 1, 1, 0]);
    expect(w.hasWidthLonghand).toBe(true);
    expect(w.uniformWidth).toBeNull();
  });

  it("longhand 4 가 같으면 uniform 으로 접힌 값", () => {
    const g = resolveBorderGeometry({
      borderTopWidth: 2,
      borderRightWidth: "2px",
      borderBottomWidth: 2,
      borderLeftWidth: 2,
    });
    expect(g.uniformWidth).toBe(2);
    expect(g.hasWidthLonghand).toBe(true);
  });

  it("border 단축 (`1px solid red`) 은 폭 shorthand 가 없을 때만 폴백", () => {
    expect(resolveBorderGeometry({ border: "1px solid red" }).widths).toEqual([
      1, 1, 1, 1,
    ]);
    expect(
      resolveBorderGeometry({ border: "1px solid red", borderWidth: 3 }).widths,
    ).toEqual([3, 3, 3, 3]);
  });

  it("음수·비정상 값은 0 · 못 읽는 단위는 다음 우선순위로", () => {
    expect(resolveBorderGeometry({ borderRadius: -4 }).radii).toEqual([
      0, 0, 0, 0,
    ]);
    expect(
      resolveBorderGeometry(
        { borderTopLeftRadius: "auto" },
        { borderRadius: 6 },
      ).radii,
    ).toEqual([6, 6, 6, 6]);
  });

  it("축 키 집합은 10개 (shorthand 2 + longhand 8)", () => {
    expect(BORDER_GEOMETRY_KEYS.size).toBe(10);
  });
});

describe("resolveBorderGeometry ↔ layout parseBorder 동치 (폭)", () => {
  const cases: Array<Record<string, unknown>> = [
    {},
    { borderWidth: 2 },
    { borderWidth: "1px 2px 3px 4px" },
    { borderWidth: "1px 2px" },
    { border: "3px solid #ccc" },
    { border: "solid 2px red", borderTopWidth: 5 },
    { borderTopWidth: "1px", borderLeftWidth: 0 },
    { borderWidth: 1, borderBottomWidth: "4px" },
  ];
  for (const style of cases) {
    it(JSON.stringify(style), () => {
      const g = resolveBorderGeometry(style);
      const p = parseBorder(style);
      expect(g.widths).toEqual([p.top, p.right, p.bottom, p.left]);
    });
  }
});

describe("resolveInnerCornerRadii — 안쪽 타원 반경", () => {
  it("코너 가로 반경은 세로변 폭, 세로 반경은 가로변 폭을 뺀다", () => {
    // widths [t r b l] = [2, 10, 6, 14], radii [24, 8, 32, 0]
    const inner = resolveInnerCornerRadii([24, 8, 32, 0], [2, 10, 6, 14]);
    expect(inner.rx).toEqual([24 - 14, 0, 32 - 10, 0]);
    expect(inner.ry).toEqual([24 - 2, 8 - 2, 32 - 6, 0]);
  });

  it("변 폭 0 코너는 그 축 반경이 그대로 — 띠가 호를 따라 가늘어진다 (P0 spike)", () => {
    const inner = resolveInnerCornerRadii([20, 20, 20, 20], [6, 6, 0, 0]);
    expect(inner.rx[0]).toBe(20); // left 0
    expect(inner.ry[0]).toBe(14); // top 6
    expect(inner.rx[2]).toBe(14); // right 6
    expect(inner.ry[2]).toBe(20); // bottom 0
  });
});
