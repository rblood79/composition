// @vitest-environment jsdom
/**
 * ADR-227 Phase 2 — `resolveThemeSnapshot` (pure) — G2 unit 축. (옛 store 의 `installThemeSnapshot` 은
 * ADR-248 4e-9 에서 옛 store 와 함께 빠졌다 — catalog theme 은 `catalogRuntime/theme.ts`.)
 *
 * 축별 비기본값 · reset (델타 제거 = seed) · 명시 hover/pressed 우선 · root user-defined fallback ·
 * cssVars 한 벌 · 설치 1회 = themeVersion +1 · notifyLayoutChange 1 · THEME_VARS replace 1.
 */
import type { ThemeDefinition } from "@composition/shared";
import {
  createThemeDefinition,
  DEFAULT_THEME_PRESET,
} from "@composition/shared";
import { radius as radiusSeed } from "@composition/rendering";
import { describe, expect, it, vi } from "vitest";

vi.mock("../../../builder/workspace/canvas/skia/useSkiaNode", () => ({
  notifyLayoutChange: vi.fn(),
}));

import { DEFAULT_BASE_TYPOGRAPHY } from "../../../builder/fonts/customFonts";
import { hexToOklch, oklchToHex } from "../oklchToHex";
import {
  colorTokenCssVarName,
  resolveThemeSnapshot,
} from "../resolveThemeSnapshot";
import { RADIUS_BASE_PX, resolveRadiusTokens } from "../radiusScaleToSkia";
import {
  createAccentColorTokens,
  mixWithBlackSrgb,
  TINT_PRESETS,
} from "../tintToSkiaColors";

const SEED = DEFAULT_BASE_TYPOGRAPHY;
const theme = (
  tokens: ThemeDefinition["tokens"] = {},
  preset = DEFAULT_THEME_PRESET,
) => createThemeDefinition("t", "T", preset, tokens);
const resolve = (t: ThemeDefinition, rootTokens?: ThemeDefinition["tokens"]) =>
  resolveThemeSnapshot(t, { rootTokens, baseTypographySeed: SEED });
const varOf = (s: ReturnType<typeof resolve>, name: string, dark = false) =>
  s.cssVars.find((v) => v.name === name && v.isDark === dark)?.value;

describe("resolveThemeSnapshot — seed (preset 파생) 는 종전 setter 결과와 같다", () => {
  it("blue · neutral · md → accent 5 = createAccentColorTokens(blue) · radius md 배율 1 · --tint var(--blue) · neutral 11 단계", () => {
    const s = resolve(theme());
    const { c, h } = TINT_PRESETS.blue;
    expect(s.colors.light.accent).toBe(
      createAccentColorTokens(c, h, "light").accent,
    );
    expect(s.colors.dark["accent-hover"]).toBe(
      createAccentColorTokens(c, h, "dark")["accent-hover"],
    );
    expect(s.radius.md).toBe(8); // ADR-295 — S2 default
    expect(s.radius.xs).toBe(2);
    expect(varOf(s, "--tint")).toBe("var(--blue)");
    expect(varOf(s, "--radius-md")).toBe("8px");
    expect(
      s.cssVars.filter(
        (v) => v.name.startsWith("--color-neutral-") && !v.isDark,
      ),
    ).toHaveLength(11);
    expect(s.base).toEqual(SEED);
    expect(s.warnings).toEqual([]);
  });

  it("accent-subtle 파생 색은 DOM과 Canvas에 동일하게 전달하고 명시 토큰을 우선한다", () => {
    const seed = resolve(theme());
    for (const dark of [false, true]) {
      for (const key of ["accent-subtle", "border-hover"]) {
        expect(varOf(seed, `--${key}`, dark)).toBe(
          seed.colors[dark ? "dark" : "light"][key],
        );
      }
    }
    const explicit = resolve(
      theme({
        "color.accent-subtle": {
          type: "color",
          value: "#123456",
          source: "spec-token",
        },
      }),
    );
    for (const dark of [false, true]) {
      expect(varOf(explicit, "--accent-subtle", dark)).toBe("#123456");
      expect(explicit.colors[dark ? "dark" : "light"]["accent-subtle"]).toBe(
        "#123456",
      );
      expect(
        explicit.cssVars.filter(
          (v) => v.name === "--accent-subtle" && v.isDark === dark,
        ),
      ).toHaveLength(1);
    }
  });

  it("radiusScale lg → 1.5 배 (xs/2xl 도 스케일 — 종전 Skia 는 안 했다, DOM 과 맞춤)", () => {
    const s = resolve(
      theme({}, { ...DEFAULT_THEME_PRESET, radiusScale: "lg" }),
    );
    // ADR-295 — S2 표 (xs 2 · sm 4 · md 8 · lg 10 · xl 16 · 2xl 24) × 1.5
    expect(s.radius).toMatchObject({
      none: 0,
      xs: 3,
      sm: 6,
      md: 12,
      lg: 15,
      xl: 24,
      "2xl": 36,
      full: 9999,
    });
    expect(varOf(s, "--radius-2xl")).toBe("36px");
  });
});

describe("resolveThemeSnapshot — 명시 델타 (축별 비기본값 · reset · 우선순위)", () => {
  it("color.accent hex → tint 대체: 두 leg 가 같은 (c,h) 파생 · DOM --tint 는 hex 자체 · chart 팔레트까지", () => {
    const s = resolve(
      theme({
        "color.accent": {
          type: "color",
          value: "#c53631",
          source: "spec-token",
        },
      }),
    );
    const o = hexToOklch("#c53631")!;
    const expected = createAccentColorTokens(o.c, o.h, "light");
    expect(s.colors.light.accent).toBe(expected.accent);
    expect(s.colors.light["accent-hover"]).toBe(expected["accent-hover"]);
    expect(s.colors.light["chart-accent-1"]).toBe(expected["chart-accent-1"]);
    expect(varOf(s, "--tint")).toBe("#c53631");
    // 빨강 계열로 접혔다 (L 55%)
    const px = parseInt(s.colors.light.accent.slice(1, 3), 16);
    expect(px).toBeGreaterThan(150);
  });

  it("color.<key> (neutral) 명시 → 양 모드 값 · DOM 의미 변수 (--fg) · 미명시 파생 neutral-fill-hover 는 base 에서 mix", () => {
    const s = resolve(
      theme({
        "color.neutral": {
          type: "color",
          value: "#112233",
          source: "spec-token",
        },
      }),
    );
    expect(s.colors.light.neutral).toBe("#112233");
    expect(s.colors.dark.neutral).toBe("#112233");
    expect(varOf(s, "--fg")).toBe("#112233");
    expect(varOf(s, "--fg", true)).toBe("#112233");
    // 진한 바탕 neutral 의 hover 는 neutral-fill-* — 밝은 바탕 (neutral-subtle) 의 neutral-hover 는 그대로
    //   (ADR-293 결정 4: 종전엔 neutral 에서 neutral-hover 를 혼합해 ToggleButton hover 가 검정에 가까워졌다)
    expect(s.colors.light["neutral-fill-hover"]).toBe(
      mixWithBlackSrgb("#112233", 85),
    );
    expect(varOf(s, "--neutral-fill-hover")).toBe(mixWithBlackSrgb("#112233", 85));
    expect(s.colors.light["neutral-hover"]).toBe(
      resolve(theme({})).colors.light["neutral-hover"],
    );
    expect(colorTokenCssVarName("neutral")).toBe("--fg");
    expect(colorTokenCssVarName("accent-hover")).toBe("--accent-hover");
  });

  it("명시 hover 가 파생보다 우선 — color.negative + color.negative-hover 둘 다 명시", () => {
    const s = resolve(
      theme({
        "color.negative": {
          type: "color",
          value: "#ff0000",
          source: "spec-token",
        },
        "color.negative-hover": {
          type: "color",
          value: "#aa0000",
          source: "spec-token",
        },
      }),
    );
    expect(s.colors.light["negative-hover"]).toBe("#aa0000");
    expect(s.colors.light["negative-pressed"]).toBe(
      mixWithBlackSrgb("#ff0000", 75),
    );
    expect(varOf(s, "--negative-hover")).toBe("#aa0000");
  });

  it("typography.text-sm 16 → Skia 맵 16 · DOM --text-sm 16px · line-height 비율은 lh/size 로 다시", () => {
    const s = resolve(
      theme({
        "typography.text-sm": {
          type: "number",
          value: 16,
          source: "spec-token",
        },
        "typography.text-sm--line-height": {
          type: "number",
          value: 24,
          source: "spec-token",
        },
      }),
    );
    expect(s.typography["text-sm"]).toBe(16);
    expect(varOf(s, "--text-sm")).toBe("16px");
    expect(varOf(s, "--text-sm--line-height")).toBe("1.5");
    expect(s.typography["text-base"]).toBe(16); // 다른 키 seed 그대로
  });

  it("typography.base-* 3 키 → base typography · radius.md 12 · shadow.md · focus.ring-width 3", () => {
    const s = resolve(
      theme({
        "typography.base-font-family": {
          type: "string",
          value: "Inter",
          source: "spec-token",
        },
        "typography.base-font-size": {
          type: "number",
          value: 18,
          source: "spec-token",
        },
        "radius.md": { type: "number", value: 12, source: "spec-token" },
        "shadow.md": {
          type: "string",
          value: "0 0 4px red",
          source: "spec-token",
        },
        "focus.ring-width": { type: "number", value: 3, source: "spec-token" },
        "focus.ring-color": {
          type: "color",
          value: "#00ff00",
          source: "spec-token",
        },
      }),
    );
    expect(s.base).toEqual({ ...SEED, fontFamily: "Inter", fontSize: 18 });
    expect(s.radius.md).toBe(12);
    expect(varOf(s, "--radius-md")).toBe("12px");
    expect(s.shadows.light.md).toBe("0 0 4px red");
    expect(s.shadows.dark.md).toBe("0 0 4px red");
    expect(varOf(s, "--shadow-md")).toBe("0 0 4px red");
    expect(varOf(s, "--focus-ring-width")).toBe("3px");
    expect(varOf(s, "--focus-ring")).toBe("#00ff00");
  });

  it("reset — 델타를 지우면 seed 와 같은 snapshot (색 · radius · cssVars 길이)", () => {
    const seed = resolve(theme());
    const edited = resolve(
      theme({
        "radius.md": { type: "number", value: 12, source: "spec-token" },
      }),
    );
    expect(edited.radius.md).not.toBe(seed.radius.md);
    const reset = resolve(theme());
    expect(reset.radius).toEqual(seed.radius);
    expect(reset.cssVars).toEqual(seed.cssVars);
  });

  it("root user-defined 는 fallback — 테마 델타가 같은 키를 덮는다 · 무효/미지원은 경고", () => {
    const s = resolve(
      theme({
        "color.neutral": {
          type: "color",
          value: "#222222",
          source: "spec-token",
        },
      }),
      {
        "color.neutral": {
          type: "color",
          value: "#111111",
          source: "user-defined",
        },
        "color.border": {
          type: "color",
          value: "#abcdef",
          source: "user-defined",
        },
        "border.width.thin": {
          type: "number",
          value: 2,
          source: "user-defined",
        },
        "weird.key": { type: "string", value: "x", source: "user-defined" },
        "radius.md": { type: "string", value: "bad", source: "user-defined" },
      },
    );
    expect(s.colors.light.neutral).toBe("#222222");
    expect(s.colors.light.border).toBe("#abcdef");
    // ADR-227 Phase 3: border 축은 해석된다 — root user-defined 도 fallback 으로 반영
    expect(s.border.thin).toBe(2);
    expect(s.warnings.some((w) => w.includes("border.width.thin"))).toBe(false);
    expect(s.warnings.some((w) => w.includes("weird.key"))).toBe(true);
    expect(s.warnings.some((w) => w.includes("radius.md"))).toBe(true);
    expect(s.radius.md).toBe(8);
  });

  it("border.width.thin 3 · thick 4 (ADR-227 Phase 3) → border 맵 + --border-width-* · 음수/문자열은 경고 · seed 는 0/1/2", () => {
    const seed = resolve(theme({}));
    expect(seed.border).toEqual({ none: 0, thin: 1, thick: 2, hairline: 0.5 });
    expect(varOf(seed, "--border-width-thin")).toBe("1px");
    const s = resolve(
      theme({
        "border.width.thin": { type: "number", value: 3, source: "spec-token" },
        "border.width.thick": {
          type: "number",
          value: 4,
          source: "spec-token",
        },
        "border.width.none": {
          type: "number",
          value: -1,
          source: "spec-token",
        },
        "border.thin": { type: "number", value: 5, source: "spec-token" },
      }),
    );
    expect(s.border).toEqual({ none: 0, thin: 3, thick: 4, hairline: 0.5 });
    expect(varOf(s, "--border-width-thin")).toBe("3px");
    expect(varOf(s, "--border-width-thick")).toBe("4px");
    expect(varOf(s, "--border-width-none")).toBe("0px");
    expect(s.warnings.some((w) => w.includes("border.width.none"))).toBe(true);
    expect(s.warnings.some((w) => w.includes("border.thin"))).toBe(true);
  });

  it("hexToOklch ↔ oklchToHex 왕복 (±1/255)", () => {
    for (const hex of ["#3660f0", "#c53631", "#123456", "#ffffff", "#000000"]) {
      const o = hexToOklch(hex)!;
      const back = oklchToHex(o.l, o.c, o.h);
      const d = [0, 2, 4].map((i) =>
        Math.abs(
          parseInt(hex.slice(1 + i, 3 + i), 16) -
            parseInt(back.slice(1 + i, 3 + i), 16),
        ),
      );
      expect(Math.max(...d)).toBeLessThanOrEqual(1);
    }
    expect(hexToOklch("not-a-color")).toBeNull();
  });
});

// ADR-295 Phase 0 (R9) — radius 는 한 표 (`RADIUS_BASE_PX`) 에서 나온다. `resolveThemeSnapshot` 이 seed
//   (`@composition/rendering` `radius`) 뒤에 preset 파생 (`resolveRadiusTokens`) 을 펼치므로 seed 만 바꾸면
//   활성 테마는 옛 값 그대로다. Phase 1 은 표를 바꾸고 seed 를 그 표에서 파생해야 이 묶음이 통과한다.
describe("ADR-295 R9 — radius 최종 snapshot = RADIUS_BASE_PX 파생 (seed 아님)", () => {
  it.each(["none", "sm", "md", "lg", "xl"] as const)(
    "radiusScale %s → 최종 radius 맵 · --radius-* = resolveRadiusTokens(scale)",
    (radiusScale) => {
      const s = resolve(theme({}, { ...DEFAULT_THEME_PRESET, radiusScale }));
      const derived = resolveRadiusTokens(radiusScale);
      for (const key of Object.keys(RADIUS_BASE_PX)) {
        expect(s.radius[key], key).toBe(derived[key]);
        // none · full 은 cssVars 에 싣지 않는다 (`resolveThemeSnapshot` radius 루프)
        if (key !== "none" && key !== "full")
          expect(varOf(s, `--radius-${key}`), key).toBe(`${derived[key]}px`);
      }
    },
  );

  it("seed 의 radius 키는 표의 md 배율 값과 같다 — 한쪽만 바꾸면 FAIL", () => {
    const seed = radiusSeed as unknown as Record<string, number>;
    for (const [key, value] of Object.entries(seed))
      if (key in RADIUS_BASE_PX) expect(value, key).toBe(RADIUS_BASE_PX[key]);
  });
});
