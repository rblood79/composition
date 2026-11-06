/**
 * ADR-193에서 시작한 colors.ts 전체 키 스냅샷 게이트.
 *
 * 초기 값(2026-08-27, commit 4105e21e8)에 이후 승인된 역할·S2 기본값 변경을 반영한다.
 * status/named hue 가 `semanticPaletteMap.ts` 표에서 파생되도록 바뀐 뒤에도 값이 하나도 움직이지 않았음을
 * 기계로 판정 — 표를 잘못 옮기면 여기서 RED. 신규 4 키 (gray / green-named +subtle) 는 §0-3 결손 보완으로
 * 착수 시점 CSS 매핑 (neutral-500/200, green-600/100) 과 같은 단계를 light 에 두고 dark 는 기존 규칙을 따른다.
 *
 * 값을 의도적으로 바꿀 때는 표 → 재생성 → 이 스냅샷 순으로 갱신하고 CHANGELOG 에 사용자-가시 엔트리를 남긴다.
 */
import { describe, expect, it } from "vitest";
import { TAILWIND_PALETTE } from "../generated/tailwindPalette";
import { darkColors, lightColors } from "../colors";
import {
  resolveSemanticStateColors,
  SEMANTIC_PALETTE_MAP,
  resolveSemanticHex,
  type SemanticPaletteToken,
} from "../semanticPaletteMap";

const LIGHT_SNAPSHOT = {
  "selection-accent": "#3b63fb",
  "selection-accent-hover": "#274dea",
  "selection-negative": "#d73220",
  "selection-negative-hover": "#b72818",
  "accent-fill": "#3b63fb",
  "focus-ring": "#4b75ff",
  "accent-fill-hover": "#274dea",
  "negative-fill": "#d73220",
  "negative-fill-hover": "#b72818",

  accent: "#155dfc",
  "accent-hover": "#1f54c8",
  "accent-pressed": "#1447e6",
  "on-accent": "#ffffff",
  "accent-subtle": "#dbeafe",
  "accent-content": "#1447e6",
  "accent-content-hover": "#193cb8",
  "neutral-content": "#292929",
  "neutral-content-hover": "#131313",
  "neutral-fill": "#292929",
  "neutral-surface": "#e9e9e9",
  "neutral-surface-hover": "#e1e1e1",
  "neutral-outline": "#dadada",
  "neutral-outline-hover": "#c6c6c6",
  "on-neutral": "#ffffff",
  neutral: "#171717",
  "neutral-subdued": "#505050",
  "field-placeholder": "#717171",
  "neutral-subtle": "#e5e5e5",
  // ADR-293 (2026-10-30): Tone 단계 (neutralToSkiaColors) · 진한 바탕 한 단 (결정 4) — 종전 #c3c3c3 · #a8a8a8
  "neutral-hover": "#d4d4d4",
  "neutral-pressed": "#a1a1a1",
  "neutral-fill-hover": "#131313",
  "neutral-fill-pressed": "#131313",
  negative: "#fb2c36",
  "on-negative": "#ffffff",
  "negative-subtle": "#ffe2e2",
  informative: "#155dfc",
  "informative-subtle": "#dbeafe",
  positive: "#00a63e",
  "positive-subtle": "#dcfce7",
  notice: "#f54900",
  "notice-subtle": "#ffedd4",
  // 기존 overlay/picker 역할과 S2 1.8.2 공통 surface 계약을 함께 고정한다.
  "overlay-backdrop": "#00000070",
  "popover-outline": "#ffffff00",
  "popover-background": "#ffffff",
  "collection-item-focus": "#e1e1e1",
  "picker-background": "#e9e9e9",
  "picker-background-hover": "#e1e1e1",
  "picker-content": "#292929",
  "picker-content-hover": "#131313",
  "picker-content-disabled": "#c6c6c6",
  "picker-checkbox-base": "#ffffff",
  base: "#ffffff",
  raised: "#f9fafb",
  "layer-1": "#f8f8f8",
  "layer-2": "#ffffff",
  elevated: "#ffffff",
  disabled: "#e9e9e9",
  "disabled-content": "#c6c6c6",
  border: "#d4d4d4",
  "border-hover": "#a1a1a1",
  "border-disabled": "#dadada",
  transparent: "transparent",
  white: "#ffffff",
  black: "#000000",
  purple: "#9810fa",
  "purple-subtle": "#f3e8ff",
  yellow: "#f0b100",
  "yellow-subtle": "#fef9c2",
  red: "#e7000b",
  "red-subtle": "#ffe2e2",
  orange: "#f54900",
  "orange-subtle": "#ffedd4",
  blue: "#155dfc",
  "blue-subtle": "#dbeafe",
  indigo: "#432dd7",
  "indigo-subtle": "#e0e7ff",
  cyan: "#0092b8",
  "cyan-subtle": "#cefafe",
  pink: "#e60076",
  "pink-subtle": "#fce7f3",
  fuchsia: "#c800de",
  "fuchsia-subtle": "#fae8ff",
  magenta: "#c6005c",
  "magenta-subtle": "#fce7f3",
  celery: "#5ea500",
  "celery-subtle": "#ecfcca",
  chartreuse: "#7ccf00",
  "chartreuse-subtle": "#ecfcca",
  turquoise: "#00bba7",
  "turquoise-subtle": "#cbfbf1",
  seafoam: "#00786f",
  "seafoam-subtle": "#cbfbf1",
  cinnamon: "#973c00",
  "cinnamon-subtle": "#fef3c6",
  brown: "#733e0a",
  "brown-subtle": "#fef9c2",
  silver: "#99a1af",
  "silver-subtle": "#f3f4f6",
  gray: "#737373",
  "gray-subtle": "#e5e5e5",
  "green-named": "#00a63e",
  "green-named-subtle": "#dcfce7",
  "negative-strong": "#82181a",
  "positive-strong": "#0d542b",
  "informative-strong": "#1c398e",
  // ADR-215 — chart 팔레트 (chartPaletteMap.ts, 테마 공용)
  "chart-categorical-1": "#0fb5ae",
  "chart-categorical-2": "#4046ca",
  "chart-categorical-3": "#f68511",
  "chart-categorical-4": "#de3d82",
  "chart-categorical-5": "#7e84fa",
  "chart-categorical-6": "#72e06a",
  "chart-categorical-7": "#147af3",
  "chart-categorical-8": "#7326d3",
  "chart-accent-1": "#142bbb",
  "chart-accent-2": "#3660f0",
  "chart-accent-3": "#6896ff",
  "chart-accent-4": "#acccff",
  "notice-strong": "#7e2a0c",
} as const;

const DARK_SNAPSHOT = {
  "selection-accent": "#5681ff",
  "selection-accent-hover": "#6995fe",
  "selection-negative": "#fc432e",
  "selection-negative-hover": "#ff6756",
  "accent-fill": "#345bf8",
  "focus-ring": "#4069fd",
  "accent-fill-hover": "#2549e5",
  "negative-fill": "#cd2e1d",
  "negative-fill-hover": "#b12617",

  accent: "#2b7fff",
  "accent-hover": "#3270d1",
  "accent-pressed": "#51a2ff",
  "on-accent": "#ffffff",
  "accent-subtle": "#1c398e",
  "accent-content": "#51a2ff",
  "accent-content-hover": "#8ec5ff",
  "neutral-content": "#dbdbdb",
  "neutral-content-hover": "#f2f2f2",
  "neutral-fill": "#dbdbdb",
  "neutral-surface": "#2c2c2c",
  "neutral-surface-hover": "#323232",
  "neutral-outline": "#393939",
  "neutral-outline-hover": "#444444",
  "on-neutral": "#111111",
  neutral: "#f5f5f5",
  "neutral-subdued": "#afafaf",
  "field-placeholder": "#8a8a8a",
  "neutral-subtle": "#404040",
  "neutral-hover": "#525252",
  "neutral-pressed": "#737373",
  "neutral-fill-hover": "#f2f2f2",
  "neutral-fill-pressed": "#f2f2f2",
  negative: "#ff6467",
  "on-negative": "#ffffff",
  "negative-subtle": "#82181a",
  informative: "#2b7fff",
  "informative-subtle": "#1c398e",
  positive: "#00c950",
  "positive-subtle": "#0d542b",
  notice: "#ff6900",
  "notice-subtle": "#7e2a0c",
  // 기존 overlay/picker 역할과 S2 1.8.2 공통 surface 계약을 함께 고정한다.
  "overlay-backdrop": "#00000070",
  "popover-outline": "#323232",
  "popover-background": "#222222",
  "collection-item-focus": "#323232",
  "picker-background": "#2c2c2c",
  "picker-background-hover": "#323232",
  "picker-content": "#dbdbdb",
  "picker-content-hover": "#f2f2f2",
  "picker-content-disabled": "#444444",
  "picker-checkbox-base": "#111111",
  base: "#111111",
  raised: "#202023",
  "layer-1": "#1b1b1b",
  "layer-2": "#222222",
  elevated: "#222222",
  disabled: "#2c2c2c",
  "disabled-content": "#444444",
  border: "#404040",
  "border-hover": "#737373",
  "border-disabled": "#393939",
  transparent: "transparent",
  white: "#ffffff",
  black: "#000000",
  purple: "#ad46ff",
  "purple-subtle": "#59168b",
  yellow: "#fdc700",
  "yellow-subtle": "#733e0a",
  red: "#ff6467",
  "red-subtle": "#82181a",
  orange: "#ff6900",
  "orange-subtle": "#7e2a0c",
  blue: "#2b7fff",
  "blue-subtle": "#1c398e",
  indigo: "#615fff",
  "indigo-subtle": "#312c85",
  cyan: "#00b8db",
  "cyan-subtle": "#104e64",
  pink: "#f6339a",
  "pink-subtle": "#861043",
  fuchsia: "#e12afb",
  "fuchsia-subtle": "#721378",
  magenta: "#ec003f",
  "magenta-subtle": "#8b0836",
  celery: "#7ccf00",
  "celery-subtle": "#35530e",
  chartreuse: "#9ae600",
  "chartreuse-subtle": "#35530e",
  turquoise: "#00d5be",
  "turquoise-subtle": "#0b4f4a",
  seafoam: "#00bba7",
  "seafoam-subtle": "#0b4f4a",
  cinnamon: "#e17100",
  "cinnamon-subtle": "#7b3306",
  brown: "#a65f00",
  "brown-subtle": "#733e0a",
  silver: "#6a7282",
  "silver-subtle": "#1e2939",
  gray: "#a1a1a1",
  "gray-subtle": "#404040",
  "green-named": "#00c950",
  "green-named-subtle": "#0d542b",
  "negative-strong": "#ffc9c9",
  "positive-strong": "#b9f8cf",
  "informative-strong": "#bedbff",
  // ADR-215 — chart 팔레트 (chartPaletteMap.ts, 테마 공용)
  "chart-categorical-1": "#0fb5ae",
  "chart-categorical-2": "#4046ca",
  "chart-categorical-3": "#f68511",
  "chart-categorical-4": "#de3d82",
  "chart-categorical-5": "#7e84fa",
  "chart-categorical-6": "#72e06a",
  "chart-categorical-7": "#147af3",
  "chart-categorical-8": "#7326d3",
  "chart-accent-1": "#142bbb",
  "chart-accent-2": "#3660f0",
  "chart-accent-3": "#6896ff",
  "chart-accent-4": "#acccff",
  "notice-strong": "#ffd6a7",
} as const;

describe("ADR-193 semanticPaletteMap — colors.ts 스냅샷", () => {
  it("lightColors 전 키가 현재 의미 색상 계약과 같다", () => {
    // (2026-10-28: the only keys added since are the derived hover · pressed of the table's base
    //  tokens — `resolveSemanticStateColors`; every snapshot key keeps its value, hand pairs win.
    //  2026-10-30 ADR-293: negative hover · pressed 손값 삭제 → 같은 혼합 (결정 2), neutral hover ·
    //  pressed 는 Tone 단계 값, neutral-fill-* 추가 (결정 4). ADR-290: accent-content · -hover 추가,
    //  dark on-accent 흰색 (결정 1).)
    expect(lightColors).toEqual({
      ...resolveSemanticStateColors("light"),
      ...LIGHT_SNAPSHOT,
    });
  });

  it("darkColors 전 키가 현재 의미 색상 계약과 같다", () => {
    expect(darkColors).toEqual({
      ...resolveSemanticStateColors("dark"),
      ...DARK_SNAPSHOT,
    });
  });

  it("표의 모든 토큰이 colors.ts 양 테마에서 표 값으로 파생된다", () => {
    for (const token of Object.keys(
      SEMANTIC_PALETTE_MAP,
    ) as SemanticPaletteToken[]) {
      expect(lightColors[token], `light ${token}`).toBe(
        resolveSemanticHex(token, "light"),
      );
      expect(darkColors[token], `dark ${token}`).toBe(
        resolveSemanticHex(token, "dark"),
      );
      const { light, dark } = SEMANTIC_PALETTE_MAP[token];
      expect(TAILWIND_PALETTE[light[0]][light[1]]).toMatch(/^#[0-9a-f]{6}$/);
      expect(TAILWIND_PALETTE[dark[0]][dark[1]]).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it("cssVar 는 전부 유일하고 status(-subtle/-strong 포함) 는 --{token}, named hue 는 --hue- 접두 (tint preset --indigo 류와 충돌 금지), hook 은 negative 만", () => {
    const vars = Object.values(SEMANTIC_PALETTE_MAP).map((e) => e.cssVar);
    expect(new Set(vars).size).toBe(vars.length);
    const STATUS = ["negative", "informative", "positive", "notice"];
    for (const [token, entry] of Object.entries(SEMANTIC_PALETTE_MAP)) {
      const base = token.replace(/-(subtle|strong)$/, "");
      if (STATUS.includes(base)) {
        expect(entry.cssVar, token).toBe(`--${token}`);
      } else {
        expect(entry.cssVar, token).toMatch(/^--hue-/);
      }
      if (token === "negative") {
        expect((entry as { hook?: string }).hook).toBe("--color-invalid");
      } else {
        expect((entry as { hook?: string }).hook).toBeUndefined();
      }
    }
  });

  it("Skia 결손 행 (Badge gray 캔버스 비가시) 이 닫혔다 — gray / green-named 가 undefined 가 아니다", () => {
    for (const k of [
      "gray",
      "gray-subtle",
      "green-named",
      "green-named-subtle",
    ] as const) {
      expect(lightColors[k]).toMatch(/^#/);
      expect(darkColors[k]).toMatch(/^#/);
    }
    expect(lightColors.gray).toBe(TAILWIND_PALETTE.neutral[500]);
    expect(lightColors["green-named"]).toBe(lightColors.positive);
  });
});
