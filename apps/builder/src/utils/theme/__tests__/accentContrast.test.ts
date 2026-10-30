/**
 * ADR-290 G1 — accent 를 역할별 목표 대비로 정한다.
 *
 * oracle 독립성 (Gates Q5): 대비 함수는 WCAG 참조쌍으로 먼저 검산하고, 아래 조건은 resolver 출력 hex 를
 * 그 함수로 다시 잰다 (resolver 가 탐색에 쓴 바탕이 아니라 snapshot 의 최종 맵에서 바탕을 읽는다).
 */
import { describe, expect, it } from "vitest";
import {
  contrastRatio,
  solveLightness,
} from "../../../../../../packages/shared/src/catalog/runtime/accentContrast";
import { DEFAULT_BASE_TYPOGRAPHY } from "../../../../../../packages/shared/src/catalog/runtime/fontDefaults";
import {
  ACCENT_CONTENT_GRAPHIC_BACKDROPS,
  ACCENT_CONTENT_TEXT_BACKDROPS,
  resolveAccentLadder,
  TINT_PRESETS,
  type TintPreset,
} from "../../../../../../packages/shared/src/catalog/runtime/tintToSkiaColors";
import { createThemeDefinition } from "../../../../../../packages/shared/src/theme/themesCollection";
import type { TokensSnapshot } from "@composition/shared";
import { oklchToHex } from "../oklchToHex";
import { resolveThemeSnapshot } from "../resolveThemeSnapshot";
import type { NeutralPreset } from "../neutralToSkiaColors";

const TINTS = Object.keys(TINT_PRESETS) as TintPreset[];
const TONES: NeutralPreset[] = ["neutral", "slate", "gray", "zinc", "stone"];
const MODES = ["light", "dark"] as const;

/** Gates Q1 — Phase 0 에서 고정한 hex 표본 20 (실재 브랜드색 10 + 극단 10). 바꾸지 않는다. */
const HEX_SAMPLES = [
  "#ffcc00",
  "#00a86b",
  "#e60012",
  "#1e3a8a",
  "#ff6600",
  "#0070f3",
  "#7b1fa2",
  "#1db954",
  "#ff0050",
  "#00b2a9",
  "#ff0000",
  "#00ff00",
  "#0000ff",
  "#ffff00",
  "#00ffff",
  "#ff00ff",
  "#808080",
  "#f5f5dc",
  "#0a0a23",
  "#39ff14",
];

function snapshot(
  tint: TintPreset,
  neutral: NeutralPreset = "neutral",
  tokens: TokensSnapshot = {},
) {
  const theme = createThemeDefinition("t", "T");
  theme.preset = { ...theme.preset, tint, neutral };
  theme.tokens = tokens;
  return resolveThemeSnapshot(theme, {
    baseTypographySeed: DEFAULT_BASE_TYPOGRAPHY,
  });
}

/** `color.<key>` 델타 — 사용자 정의 색 토큰. */
function colorTokens(values: Record<string, string>): TokensSnapshot {
  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => [
      key,
      { type: "color", value, source: "user-defined" },
    ]),
  );
}

/** 역할 조건 위반 목록 — 비면 통과. */
function violations(map: Record<string, string>): string[] {
  const out: string[] = [];
  const check = (what: string, a: string, b: string, min: number) => {
    const r = contrastRatio(a, b);
    if (r < min) out.push(`${what} ${a}/${b} ${r.toFixed(2)} < ${min}`);
  };
  check("accent·on-accent", map.accent!, map["on-accent"]!, 4.5);
  check("accent·base", map.accent!, map.base!, 3.0);
  for (const key of ACCENT_CONTENT_TEXT_BACKDROPS)
    check(`content·${key}`, map["accent-content"]!, map[key]!, 4.5);
  for (const key of ACCENT_CONTENT_GRAPHIC_BACKDROPS)
    check(`content·${key}`, map["accent-content"]!, map[key]!, 3.0);
  for (const key of ACCENT_CONTENT_TEXT_BACKDROPS)
    check(`content-hover·${key}`, map["accent-content-hover"]!, map[key]!, 4.5);
  return out;
}

describe("ADR-290 — 대비 함수 (WCAG 2 참조쌍)", () => {
  it("흰 · 검 21.0 · #777777 · 흰 4.48", () => {
    expect(contrastRatio("#ffffff", "#000000")).toBeCloseTo(21, 2);
    expect(contrastRatio("#777777", "#ffffff")).toBeCloseTo(4.48, 2);
  });

  it("시작 명도가 통과하면 그대로, 아니면 가장 가까운 통과 명도 · 구간이 비면 ok false", () => {
    const { c, h } = TINT_PRESETS.blue;
    expect(solveLightness({ c, h, startL: 0.55, constraints: [] }).l).toBe(
      0.55,
    );
    const dark = solveLightness({
      c,
      h,
      startL: 0.55,
      constraints: [{ against: "#171717", min: 4.5 }],
    });
    expect(dark.ok).toBe(true);
    expect(dark.l).toBeGreaterThan(0.55);
    expect(contrastRatio(dark.hex, "#171717")).toBeGreaterThanOrEqual(4.5);
    expect(
      contrastRatio(oklchToHex(dark.l - 0.01, c, h), "#171717"),
    ).toBeLessThan(4.5);
    const none = solveLightness({
      c,
      h,
      startL: 0.55,
      constraints: [
        { against: "#ffffff", min: 4.5 },
        { against: "#000000", min: 4.5 },
        { against: "#808080", min: 4.5 },
      ],
    });
    expect(none.ok).toBe(false);
  });
});

describe("ADR-290 G1 — 프리셋 10 × Tone 5 × 모드 2", () => {
  it.each(TINTS)("%s — 모든 Tone · 모드에서 역할 조건 통과", (tint) => {
    const failures: string[] = [];
    for (const tone of TONES) {
      const s = snapshot(tint, tone);
      for (const mode of MODES)
        for (const v of violations(s.colors[mode]))
          failures.push(`${tone}/${mode}: ${v}`);
      expect(s.warnings).toEqual([]);
    }
    expect(failures).toEqual([]);
  });

  it("light 프리셋 accent (배경) hex 는 변경 전 공식 (L 55%) 그대로", () => {
    for (const tint of TINTS) {
      const { c, h } = TINT_PRESETS[tint];
      expect(snapshot(tint).colors.light.accent).toBe(oklchToHex(0.55, c, h));
    }
  });

  it("on-accent 는 두 모드 모두 흰색 (결정 1)", () => {
    const s = snapshot("blue");
    expect(s.colors.light["on-accent"]).toBe("#ffffff");
    expect(s.colors.dark["on-accent"]).toBe("#ffffff");
  });

  it("accent-content-hover 는 content 와 다르고 바탕에서 더 멀다 (light 어둡게 · dark 밝게)", () => {
    for (const tint of TINTS) {
      const s = snapshot(tint);
      for (const mode of MODES) {
        const m = s.colors[mode];
        expect(m["accent-content-hover"]).not.toBe(m["accent-content"]);
        expect(
          contrastRatio(m["accent-content-hover"]!, m["layer-1"]!),
        ).toBeGreaterThan(contrastRatio(m["accent-content"]!, m["layer-1"]!));
      }
    }
  });
});

describe("ADR-290 G1 — 명시 델타가 탐색의 바탕", () => {
  it("명시 color.base 를 바탕으로 accent 탐색 · 풀 수 없는 모드는 warning", () => {
    const tokens = colorTokens({ "color.base": "#e5e5e5" });
    const s = snapshot("blue", "neutral", tokens);
    expect(s.colors.light.base).toBe("#e5e5e5");
    expect(violations(s.colors.light)).toEqual([]);
    // 기본 바탕 (흰색) 에서 정한 값은 #e5e5e5 위 글자 4.5 미달 — 탐색이 명시 바탕을 봤다
    expect(
      contrastRatio(snapshot("blue").colors.light["accent-content"]!, "#e5e5e5"),
    ).toBeLessThan(4.5);
    // dark 는 밝은 base 와 어두운 layer 를 동시에 4.5 로 넘는 명도가 없다 → 글자 대비 우선 + warning
    expect(s.warnings.some((w) => w.startsWith("dark accent-content"))).toBe(
      true,
    );
  });

  it("명시 color.accent-subtle 을 그대로 쓰고 그 위 글자 대비를 맞춘다", () => {
    const s = snapshot("green", "neutral", colorTokens({ "color.accent-subtle": "#c8f0d8" }));
    expect(s.colors.light["accent-subtle"]).toBe("#c8f0d8");
    expect(
      contrastRatio(s.colors.light["accent-content"]!, "#c8f0d8"),
    ).toBeGreaterThanOrEqual(4.5);
  });

  it("명시 color.accent-content 는 그 값 · hover 는 거기서 탐색 (dark 는 밝히는 방향)", () => {
    const s = snapshot("blue", "neutral", colorTokens({ "color.accent-content": "#7aa2ff" }));
    expect(s.colors.dark["accent-content"]).toBe("#7aa2ff");
    expect(
      contrastRatio(
        s.colors.dark["accent-content-hover"]!,
        s.colors.dark.base!,
      ),
    ).toBeGreaterThan(contrastRatio("#7aa2ff", s.colors.dark.base!));
  });
});

describe("ADR-290 G1 — 사용자 hex 표본 20 (결정 2: hex 자신의 명도에서)", () => {
  it.each(HEX_SAMPLES)("%s — 통과 또는 warning", (hex) => {
    const s = snapshot("blue", "neutral", colorTokens({ "color.accent": hex }));
    for (const mode of MODES) {
      const v = violations(s.colors[mode]);
      if (v.length > 0) expect(s.warnings.join("\n")).toMatch(mode);
    }
  });

  it("통과하는 브랜드색은 그대로 (#1E3A8A light accent)", () => {
    const s = snapshot("blue", "neutral", colorTokens({ "color.accent": "#1E3A8A" }));
    expect(s.colors.light.accent).toBe("#1e3a8a");
  });

  it("#00A86B — 미달 (4.42) 이면 흰 글자 4.5 로 움직인다", () => {
    const s = snapshot("blue", "neutral", colorTokens({ "color.accent": "#00A86B" }));
    expect(
      contrastRatio(s.colors.light.accent!, "#ffffff"),
    ).toBeGreaterThanOrEqual(4.5);
  });
});

describe("ADR-290 Phase 3 — 색 피커 Theme 사다리", () => {
  it("사다리에 탐색된 accent · accent-content 칸이 있다 (같은 바탕)", () => {
    for (const mode of MODES) {
      const s = snapshot("green");
      const ladder = resolveAccentLadder("green", mode, s.colors[mode]);
      expect(ladder).toContain(s.colors[mode].accent);
      expect(ladder).toContain(s.colors[mode]["accent-content"]);
    }
  });
});
