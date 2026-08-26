/**
 * ADR-193 Phase 1 — colors.ts 스냅샷 게이트 (G1 light 불변 / dark 값 이관 무변경).
 *
 * 착수 시점 (2026-08-27, commit 4105e21e8 기준) 의 `lightColors` / `darkColors` 전 키 hex 를 고정한다.
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
  SEMANTIC_PALETTE_MAP,
  resolveSemanticHex,
  type SemanticPaletteToken,
} from "../semanticPaletteMap";

const LIGHT_SNAPSHOT = {
  accent: "#155dfc",
  "accent-hover": "#1f54c8",
  "accent-pressed": "#1447e6",
  "on-accent": "#ffffff",
  "accent-subtle": "#dbeafe",
  neutral: "#171717",
  "neutral-subdued": "#404040",
  "neutral-subtle": "#e5e5e5",
  "neutral-hover": "#c3c3c3",
  "neutral-pressed": "#a8a8a8",
  negative: "#fb2c36",
  "negative-hover": "#cb3a3a",
  "negative-pressed": "#b33333",
  "on-negative": "#ffffff",
  "negative-subtle": "#ffe2e2",
  informative: "#155dfc",
  "informative-subtle": "#dbeafe",
  positive: "#00a63e",
  "positive-subtle": "#dcfce7",
  notice: "#f54900",
  "notice-subtle": "#ffedd4",
  base: "#ffffff",
  raised: "#f9fafb",
  "layer-1": "#fafafa",
  "layer-2": "#fafafa",
  elevated: "#ffffff",
  disabled: "#e5e5e5",
  border: "#d4d4d4",
  "border-hover": "#a1a1a1",
  "border-disabled": "#f5f5f5",
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
} as const;

const DARK_SNAPSHOT = {
  accent: "#2b7fff",
  "accent-hover": "#3270d1",
  "accent-pressed": "#51a2ff",
  "on-accent": "#171717",
  "accent-subtle": "#1c398e",
  neutral: "#f5f5f5",
  "neutral-subdued": "#a1a1a1",
  "neutral-subtle": "#404040",
  "neutral-hover": "#363636",
  "neutral-pressed": "#2e2e2e",
  negative: "#ff6467",
  "negative-hover": "#d36060",
  "negative-pressed": "#ba5555",
  "on-negative": "#ffffff",
  "negative-subtle": "#82181a",
  informative: "#2b7fff",
  "informative-subtle": "#1c398e",
  positive: "#00c950",
  "positive-subtle": "#0d542b",
  notice: "#ff6900",
  "notice-subtle": "#7e2a0c",
  base: "#171717",
  raised: "#202023",
  "layer-1": "#262626",
  "layer-2": "#262626",
  elevated: "#262626",
  disabled: "#404040",
  border: "#404040",
  "border-hover": "#737373",
  "border-disabled": "#262626",
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
} as const;

describe("ADR-193 semanticPaletteMap — colors.ts 스냅샷", () => {
  it("lightColors 전 키가 착수 시점 값과 같다 (G1 light 불변)", () => {
    expect(lightColors).toEqual(LIGHT_SNAPSHOT);
  });

  it("darkColors 전 키가 착수 시점 값과 같다 (표 이관 무변경)", () => {
    expect(darkColors).toEqual(DARK_SNAPSHOT);
  });

  it("표의 모든 토큰이 colors.ts 양 테마에서 표 값으로 파생된다", () => {
    for (const token of Object.keys(SEMANTIC_PALETTE_MAP) as SemanticPaletteToken[]) {
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

  it("cssVar 는 전부 유일하고 named hue 는 --hue- 접두 (tint preset --indigo 류와 충돌 금지), hook 은 negative 만", () => {
    const vars = Object.values(SEMANTIC_PALETTE_MAP).map((e) => e.cssVar);
    expect(new Set(vars).size).toBe(vars.length);
    const STATUS = ["negative", "informative", "positive", "notice"];
    for (const [token, entry] of Object.entries(SEMANTIC_PALETTE_MAP)) {
      const base = token.replace(/-subtle$/, "");
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
    for (const k of ["gray", "gray-subtle", "green-named", "green-named-subtle"] as const) {
      expect(lightColors[k]).toMatch(/^#/);
      expect(darkColors[k]).toMatch(/^#/);
    }
    expect(lightColors.gray).toBe(TAILWIND_PALETTE.neutral[500]);
    expect(lightColors["green-named"]).toBe(lightColors.positive);
  });
});
