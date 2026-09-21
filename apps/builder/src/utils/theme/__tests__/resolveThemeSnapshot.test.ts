// @vitest-environment jsdom
/**
 * ADR-227 Phase 2 — `resolveThemeSnapshot` (pure) + `installThemeSnapshot` (1회 설치) — G2 unit 축.
 *
 * 축별 비기본값 · reset (델타 제거 = seed) · 명시 hover/pressed 우선 · root user-defined fallback ·
 * cssVars 한 벌 · 설치 1회 = themeVersion +1 · notifyLayoutChange 1 · THEME_VARS replace 1.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ThemeDefinition } from "@composition/shared";
import {
  createThemeDefinition,
  DEFAULT_THEME_PRESET,
} from "@composition/shared";
import {
  lightColors,
  darkColors,
  radius,
  typography,
  lightShadows,
} from "@composition/specs";

vi.mock("../../../builder/workspace/canvas/skia/useSkiaNode", () => ({
  notifyLayoutChange: vi.fn(),
}));

import { notifyLayoutChange } from "../../../builder/workspace/canvas/skia/useSkiaNode";
import { DEFAULT_BASE_TYPOGRAPHY } from "../../../builder/fonts/customFonts";
import { useThemeConfigStore } from "../../../stores/themeConfigStore";
import { MessageService } from "../../messaging";
import { hexToOklch, oklchToHex } from "../oklchToHex";
import {
  colorTokenCssVarName,
  resolveThemeSnapshot,
} from "../resolveThemeSnapshot";
import {
  getCurrentThemeSnapshot,
  installThemeSnapshot,
  resetCurrentThemeSnapshotForTest,
} from "../installThemeSnapshot";
import {
  createAccentColorTokens,
  TINT_PRESETS,
  mixWithBlackSrgb,
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
    expect(s.radius.md).toBe(6);
    expect(s.radius.xs).toBe(2);
    expect(varOf(s, "--tint")).toBe("var(--blue)");
    expect(varOf(s, "--radius-md")).toBe("6px");
    expect(
      s.cssVars.filter(
        (v) => v.name.startsWith("--color-neutral-") && !v.isDark,
      ),
    ).toHaveLength(11);
    expect(s.base).toEqual(SEED);
    expect(s.warnings).toEqual([]);
  });

  it("radiusScale lg → 1.5 배 (xs/2xl 도 스케일 — 종전 Skia 는 안 했다, DOM 과 맞춤)", () => {
    const s = resolve(
      theme({}, { ...DEFAULT_THEME_PRESET, radiusScale: "lg" }),
    );
    expect(s.radius).toMatchObject({
      none: 0,
      xs: 3,
      sm: 6,
      md: 9,
      lg: 12,
      xl: 18,
      "2xl": 24,
      full: 9999,
    });
    expect(varOf(s, "--radius-2xl")).toBe("24px");
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

  it("color.<key> (neutral) 명시 → 양 모드 값 · DOM 의미 변수 (--fg) · 미명시 파생 neutral-hover 는 base 에서 mix", () => {
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
    expect(s.colors.light["neutral-hover"]).toBe(
      mixWithBlackSrgb("#112233", 85),
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

  it("root user-defined 는 fallback — 테마 델타가 같은 키를 덮는다 · 무효/미지원은 경고 (border 는 Phase 3)", () => {
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
    expect(s.warnings.some((w) => w.includes("border.width.thin"))).toBe(true);
    expect(s.warnings.some((w) => w.includes("weird.key"))).toBe(true);
    expect(s.warnings.some((w) => w.includes("radius.md"))).toBe(true);
    expect(s.radius.md).toBe(6);
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

describe("installThemeSnapshot — 1회 설치", () => {
  const postMessage = vi.fn();
  beforeEach(() => {
    vi.mocked(notifyLayoutChange).mockClear();
    postMessage.mockClear();
    resetCurrentThemeSnapshotForTest();
    vi.spyOn(MessageService, "getIframe").mockReturnValue({
      contentWindow: { postMessage },
    } as unknown as HTMLIFrameElement);
    useThemeConfigStore.setState({ themeVersion: 0 });
  });
  afterEach(() => vi.restoreAllMocks());

  it("맵 덮어쓰기 (colors · typography · radius · shadows) · themeVersion +1 (한 번) · notifyLayoutChange 1 · THEME_VARS replace + SET_DARK_MODE + BASE_TYPOGRAPHY 각 1", () => {
    const s = resolve(
      theme(
        {
          "color.neutral": {
            type: "color",
            value: "#112233",
            source: "spec-token",
          },
          "typography.text-sm": {
            type: "number",
            value: 15,
            source: "spec-token",
          },
          "radius.md": { type: "number", value: 11, source: "spec-token" },
          "shadow.md": {
            type: "string",
            value: "0 0 3px blue",
            source: "spec-token",
          },
        },
        { ...DEFAULT_THEME_PRESET, tint: "purple", darkMode: "dark" },
      ),
    );
    installThemeSnapshot(s);
    expect((lightColors as unknown as Record<string, string>).neutral).toBe(
      "#112233",
    );
    expect((darkColors as unknown as Record<string, string>).accent).toBe(
      s.colors.dark.accent,
    );
    expect((typography as unknown as Record<string, number>)["text-sm"]).toBe(
      15,
    );
    expect((radius as unknown as Record<string, number>).md).toBe(11);
    expect((lightShadows as unknown as Record<string, string>).md).toBe(
      "0 0 3px blue",
    );
    const st = useThemeConfigStore.getState();
    expect(st.themeVersion).toBe(1);
    expect([st.tint, st.darkMode]).toEqual(["purple", "dark"]);
    expect(notifyLayoutChange).toHaveBeenCalledTimes(1);
    const types = postMessage.mock.calls.map((c) => c[0].type);
    expect(types).toEqual([
      "THEME_VARS",
      "SET_DARK_MODE",
      "THEME_BASE_TYPOGRAPHY",
    ]);
    expect(postMessage.mock.calls[0]![0]).toMatchObject({ replace: true });
    expect(postMessage.mock.calls[1]![0]).toEqual({
      type: "SET_DARK_MODE",
      isDark: true,
    });
    expect(getCurrentThemeSnapshot()).toBe(s);
    // 되돌리기 — 다음 테스트/모듈 영향 0
    installThemeSnapshot(resolve(theme()));
    expect((radius as unknown as Record<string, number>).md).toBe(6);
  });
});
