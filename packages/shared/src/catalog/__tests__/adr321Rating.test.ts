import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { resolveToken, type TokenRef } from "@composition/rendering";
import { getPrimitiveBinding } from "../bindings";
import { COMPONENT_RULES_TABLE } from "../generated/componentRulesTable";
import {
  catalogRatingBox,
  catalogRatingScaledStarPaths,
  catalogRatingStarColor,
  catalogRatingStarPaths,
  catalogRatingStarFills,
  RATING_STAR_COUNT,
  RATING_STAR_GAP,
} from "../rule/rating";
import { catalogRatingStart, catalogRatingValue } from "../runtime/rating";

/**
 * ADR-321 G4 — the Rating rule against spectrum-design-data's `rating` (the frozen copy
 * `fixtures/adr321-design-data.json` — dataset 4.7.0) and the effective value (Decision 8). Expected
 * values are written out by hand from the fixture and the decision's rule, not from the functions.
 */
interface RatingFixture {
  rating: {
    options: {
      value: { minimum: number; maximum: number; multipleOf: number };
      size: string[];
    };
    dimensions: {
      iconSize: { px: { S: number; M: number } };
      width: { px: { S: number; M: number } };
      paddingVertical: { px: { S: number; M: number } };
      cornerRadius: { px: { S: number; M: number } };
      iconGap: { px: number };
    };
    colors: Record<string, { light?: number[]; dark?: number[] }>;
  };
}
const fixture = JSON.parse(
  readFileSync(
    new URL("./fixtures/adr321-design-data.json", import.meta.url),
    "utf8",
  ),
) as RatingFixture;
const dims = fixture.rating.dimensions;

const rgbOf = (value: unknown): number[] => {
  const text = String(value).trim();
  const hex = /^#([0-9a-f]{6})/i.exec(text);
  if (hex) {
    const n = Number.parseInt(hex[1]!, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const rgb = /^rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/.exec(text);
  if (rgb) return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];
  throw new Error(`색을 읽을 수 없다: ${text}`);
};

describe("ADR-321 G4 — Rating 의 rule = design-data", () => {
  const rule = COMPONENT_RULES_TABLE.Rating!;

  it("별 다섯 (사용자 결정 6) · 크기 S · M (design-data `size`)", () => {
    expect(RATING_STAR_COUNT).toBe(5);
    expect(fixture.rating.options.size).toEqual(["s", "m"]);
    expect(Object.keys(rule.sizes).sort()).toEqual(["M", "S"]);
  });

  it("별 · 간격 · 세로 padding · radius", () => {
    for (const size of ["S", "M"] as const) {
      const box = catalogRatingBox(size);
      expect(box.star).toBe(dims.iconSize.px[size]);
      // 상자 = 별 줄 × (별 + 세로 padding × 2) — S 16·5 + 4·4 = 96 × 24, M 18·5 + 4·4 = 106 × 32.
      expect([box.width, box.height]).toEqual(
        size === "S" ? [96, 24] : [106, 32],
      );
      expect(box.height).toBe(
        dims.iconSize.px[size] + dims.paddingVertical.px[size] * 2,
      );
      const block = rule.sizes[size]!;
      expect([block.width, block.height]).toEqual([box.width, box.height]);
      const radius =
        typeof block.borderRadius === "string"
          ? Number.parseFloat(
              String(resolveToken(block.borderRadius as TokenRef, "light")),
            )
          : block.borderRadius;
      expect(radius).toBe(dims.cornerRadius.px[size]);
    }
    expect(RATING_STAR_GAP).toBe(dims.iconGap.px);
  });

  it("전체 폭 토큰 (legacy 104 · 128) 은 쓰지 않는다 — 별 줄과 다르다 (breakdown §5.6)", () => {
    expect(dims.width.px).toEqual({ S: 104, M: 128 });
    expect(catalogRatingBox("S").width).not.toBe(dims.width.px.S);
    expect(catalogRatingBox("M").width).not.toBe(dims.width.px.M);
  });

  it("별 색 — neutral content · 강조 accent content · 비활성 disabled content (light · dark)", () => {
    const cases = [
      [{ emphasized: false, disabled: false }, "icon"],
      [{ emphasized: true, disabled: false }, "iconEmphasized"],
      [{ emphasized: false, disabled: true }, "iconDisabled"],
      [{ emphasized: true, disabled: true }, "iconDisabled"],
    ] as const;
    for (const [input, key] of cases)
      for (const theme of ["light", "dark"] as const) {
        const expected = fixture.rating.colors[key]![theme];
        if (!expected) continue;
        expect(
          rgbOf(resolveToken(catalogRatingStarColor(input), theme)),
          `${key} ${theme}`,
        ).toEqual(expected);
      }
  });

  it("D2 — design-data 의 prop + 확장 isReadOnly + 폼 필드 label · name (결정 5)", () => {
    expect(
      Object.keys(getPrimitiveBinding("Rating")!.props.accepts).sort(),
    ).toEqual(
      [
        "value",
        "defaultValue",
        "size",
        "isEmphasized",
        "isDisabled",
        "isReadOnly",
        "label",
        "name",
      ].sort(),
    );
  });
});

describe("ADR-321 Decision 8 — 유효값 (정답표)", () => {
  it("입력 모드: 0 ~ 5 로 자르고 정수로 (RAC Slider 의 단계 맞춤)", () => {
    const table: [unknown, number][] = [
      [0, 0],
      [1, 1],
      [2.4, 2],
      [2.5, 3],
      [4.6, 5],
      [6, 5],
      [-1, 0],
      ["3", 3],
      ["", 0],
      ["x", 0],
      [null, 0],
      [undefined, 0],
      [Number.NaN, 0],
      [Number.POSITIVE_INFINITY, 0],
    ];
    for (const [raw, expected] of table)
      expect(catalogRatingValue(raw, false), String(raw)).toBe(expected);
  });

  it("표시 전용: 0 ~ 5 로 자르고 0.5 단위로", () => {
    const table: [unknown, number][] = [
      [2.3, 2.5],
      [2.2, 2],
      [2.5, 2.5],
      [2.75, 3],
      [0.24, 0],
      [0.25, 0.5],
      [6, 5],
      [-0.5, 0],
      ["4.5", 4.5],
    ];
    for (const [raw, expected] of table)
      expect(catalogRatingValue(raw, true), String(raw)).toBe(expected);
  });

  it("시작 값 = value → defaultValue", () => {
    expect(catalogRatingStart({ value: 4, defaultValue: 2 })).toBe(4);
    expect(catalogRatingStart({ defaultValue: 2 })).toBe(2);
    expect(catalogRatingStart({})).toBe(0);
    expect(catalogRatingStart({ defaultValue: 2.5 })).toBe(3);
    expect(catalogRatingStart({ defaultValue: 2.5, isReadOnly: true })).toBe(
      2.5,
    );
  });

  it("별 채움 — 값 이하 = 채움, 0.5 = 반쪽, 그 뒤 = 빈 별", () => {
    expect(catalogRatingStarFills(0)).toEqual(Array(5).fill("empty"));
    expect(catalogRatingStarFills(3)).toEqual([
      "full",
      "full",
      "full",
      "empty",
      "empty",
    ]);
    expect(catalogRatingStarFills(2.5)).toEqual([
      "full",
      "full",
      "half",
      "empty",
      "empty",
    ]);
    expect(catalogRatingStarFills(5)).toEqual(Array(5).fill("full"));
    expect(catalogRatingStarFills(0.5)).toEqual([
      "half",
      "empty",
      "empty",
      "empty",
      "empty",
    ]);
  });
});

/** The installed S2 icon's path (`@react-spectrum/s2/icons/<name>.mjs` — the builder's dependency). */
const installedS2Path = (name: string): string =>
  /d: "([^"]+)"/.exec(
    readFileSync(
      new URL(
        `../../../../../apps/builder/node_modules/@react-spectrum/s2/icons/${name}.mjs`,
        import.meta.url,
      ),
      "utf8",
    ),
  )![1]!;

describe("ADR-321 — 별 path (S2 Star · StarFilled)", () => {
  it("the paths are the installed S2 icons'", () => {
    expect(catalogRatingStarPaths()).toEqual({
      outline: installedS2Path("Star"),
      filled: installedS2Path("StarFilled"),
    });
  });

  it("Canvas 의 path = S2 경로를 별 px 로 늘인 것", () => {
    const filled = installedS2Path("StarFilled");
    expect(filled.startsWith("M11.495 2.414 12.7 5.597")).toBe(true);
    // 18 px = 20 viewBox × 0.9 — 「M11.495 2.414」 → 「M10.346 2.173」.
    expect(
      catalogRatingScaledStarPaths(18).filled.startsWith("M10.346 2.173"),
    ).toBe(true);
    // (Compact numbers — 「.735.94」 is two numbers: at 20 px every number and command stays.)
    const numbers = (d: string) =>
      (d.match(/-?(?:\d+\.?\d*|\.\d+)/g) ?? []).map(Number);
    const commands = (d: string) => d.replace(/[^a-zA-Z]/g, "");
    for (const [scaled, raw] of [
      [catalogRatingScaledStarPaths(20).filled, filled],
      [catalogRatingScaledStarPaths(20).outline, installedS2Path("Star")],
    ] as const) {
      expect(numbers(scaled)).toEqual(numbers(raw));
      expect(commands(scaled)).toBe(commands(raw));
    }
  });
});
