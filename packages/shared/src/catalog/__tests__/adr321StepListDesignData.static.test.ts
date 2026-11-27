import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { resolveToken, type TokenRef } from "@composition/rendering";
import { getPrimitiveBinding } from "../bindings";
import { COMPONENT_RULES_TABLE } from "../generated/componentRulesTable";
import {
  STEP_COLORS,
  STEP_LAYOUT,
  STEP_SIZES,
  STEP_VISUAL_BORDER,
} from "../rule/stepList";

/**
 * ADR-321 G1 — the StepList rule's values against spectrum-design-data's `steplist` (the frozen copy
 * `fixtures/adr321-design-data.json` — dataset 4.7.0, read 2026-11-27 with the design-data MCP; the
 * installed 3.9.1 package has neither the `size` option nor the bindings). The fixture is the
 * reference: a rule value that leaves it is listed below with its reason, or the test fails.
 */

type Sizes = Record<"S" | "M" | "L" | "XL", number>;
interface DesignDataFixture {
  $source: { dataset: string; readOn: string };
  steplist: {
    options: { size: string[]; orientation: string[] };
    dimensions: {
      visualSize: { px: Sizes };
      textToVisualGap: { px: Sizes };
      labelFontSize: { px: Sizes };
      labelLineHeight: { multiplier: number };
      visualBorderWidth: { px: number };
      trackThickness: { px: number };
      noToken: string[];
    };
    colors: Record<string, { light?: number[]; dark?: number[] }>;
  };
}
const fixture = JSON.parse(
  readFileSync(
    new URL("./fixtures/adr321-design-data.json", import.meta.url),
    "utf8",
  ),
) as DesignDataFixture;

type Rgb = readonly [number, number, number];
const rgbOf = (value: unknown): Rgb => {
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
const resolved = (ref: string, theme: "light" | "dark"): Rgb =>
  rgbOf(resolveToken(ref as TokenRef, theme));
const px = (ref: unknown): number => {
  const value =
    typeof ref === "string" ? resolveToken(ref as TokenRef, "light") : ref;
  return typeof value === "number" ? value : Number.parseFloat(String(value));
};

const { dimensions, colors, options } = fixture.steplist;
const step = COMPONENT_RULES_TABLE.Step!;

/**
 * 저장소에 같은 이름의 색 토큰이 없어 가장 가까운 기존 TokenRef 로 둔 자리 (새 테마 토큰을 만들지
 * 않는다 — breakdown §5.3). 값이 fixture 와 다른 theme 를 적는다 — 그 밖의 theme 는 같아야 한다.
 */
const SUBSTITUTED: Readonly<
  Record<string, { differs: readonly ("light" | "dark")[]; reason: string }>
> = {
  visualIncompleteBorder: {
    differs: ["light"],
    reason:
      "neutral-visual-color (gray 500 / 600) 의 alias 가 없다 — {color.field-placeholder} (gray 600 / 600): dark 는 같고 light 는 한 단 진하다",
  },
  trackRest: {
    differs: ["light"],
    reason: "위와 같은 토큰 (neutral-visual-color)",
  },
  trackCompletedEmphasized: {
    differs: ["light", "dark"],
    reason:
      "accent-visual-color (accent 800 / 900) 의 alias 가 없다 — 강조 표식과 같은 {color.accent} (accent 900 / 800), 한 단 차이",
  },
};

describe("ADR-321 — StepList rule = design-data steplist (fixture)", () => {
  it("fixture 는 dataset 버전과 조회 날짜를 적는다", () => {
    expect(fixture.$source.dataset).toBe("4.7.0");
    expect(fixture.$source.readOn).toBe("2026-11-27");
  });

  it("크기 · 방향 — binding 이 받는 값 = 스키마의 값", () => {
    expect([...STEP_SIZES]).toEqual(
      options.size.map((size) => size.toUpperCase()),
    );
    expect(Object.keys(COMPONENT_RULES_TABLE.StepList!.sizes)).toEqual(
      options.size.map((size) => size.toUpperCase()),
    );
    expect(
      getPrimitiveBinding("StepList")?.props.accepts?.orientation?.options?.map(
        (option) => option.value,
      ),
    ).toEqual(options.orientation);
  });

  it.each(STEP_SIZES)(
    "치수 %s — 표식 · 글자와 표식 간격 · 라벨 글자",
    (size) => {
      const block = step.sizes[size]!;
      expect(block.iconSize).toBe(dimensions.visualSize.px[size]);
      expect(block.iconGap).toBe(dimensions.textToVisualGap.px[size]);
      expect(px(block.fontSize)).toBe(dimensions.labelFontSize.px[size]);
    },
  );

  it("라벨 행간 — 저장소 사다리 (design-data 1.3 배수와 1.5 px 안)", () => {
    for (const size of STEP_SIZES) {
      const block = step.sizes[size]!;
      const want =
        dimensions.labelFontSize.px[size] *
        dimensions.labelLineHeight.multiplier;
      expect(Math.abs(px(block.lineHeight) - want)).toBeLessThanOrEqual(1.5);
    }
  });

  it("남음 표식의 테두리 · 선 두께", () => {
    expect(px(STEP_VISUAL_BORDER)).toBe(dimensions.visualBorderWidth.px);
    expect(STEP_LAYOUT.trackThickness).toBe(dimensions.trackThickness.px);
  });

  it("토큰이 없는 값 넷은 fixture 가 이름을 들고 rule 이 정한다 (breakdown §5.3)", () => {
    expect(dimensions.noToken).toEqual([
      "Width (step)",
      "Height (step)",
      "Spacing (step to track)",
      "Label (text adjustment)",
    ]);
    // (정한 값 — 여기 적힌 수가 바뀌면 breakdown 의 근거도 같이 고친다.)
    expect(STEP_LAYOUT).toEqual({
      trackThickness: 2,
      trackGap: 4,
      minTrack: 16,
      textSeparation: 8,
    });
  });

  it("색 — design-data 가 낸 light · dark 값 그대로, 대체한 셋은 사유와 함께", () => {
    const differs: string[] = [];
    for (const [name, entry] of Object.entries(colors)) {
      const ref = STEP_COLORS[name as keyof typeof STEP_COLORS];
      expect(ref, name).toBeTypeOf("string");
      for (const theme of ["light", "dark"] as const) {
        const want = entry[theme];
        if (!want) continue;
        if (resolved(ref, theme).join() !== want.join())
          differs.push(`${name}.${theme}`);
      }
    }
    expect(differs.sort()).toEqual(
      Object.entries(SUBSTITUTED)
        .flatMap(([name, { differs: themes, reason }]) => {
          expect(reason.length).toBeGreaterThan(10);
          return themes.map((theme) => `${name}.${theme}`);
        })
        .sort(),
    );
  });
});
