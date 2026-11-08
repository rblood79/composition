/**
 * ADR-290 G1 — accent 역할 둘의 대비 조건. 탐색 (`solveLightness`) 은 ADR-302 사다리 생성으로 대체됐고, 조건은
 * 그 생성 결과 (resolver snapshot 의 최종 맵) 에 다시 잰다.
 *
 * oracle 독립성 (Gates Q5): 대비 함수는 WCAG 참조쌍으로 먼저 검산한다.
 */
import { beforeAll, describe, expect, it } from "vitest";
import { contrastRatio } from "../../../../../../packages/shared/src/catalog/runtime/accentContrast";
import { loadThemeLadders } from "../../../../../../packages/shared/src/catalog/runtime/themeLadders";
import { DEFAULT_BASE_TYPOGRAPHY } from "../../../../../../packages/shared/src/catalog/runtime/fontDefaults";
import {
  ACCENT_CONTENT_GRAPHIC_BACKDROPS,
  ACCENT_CONTENT_TEXT_BACKDROPS,
  TINT_PRESETS,
  type TintPreset,
} from "../../../../../../packages/shared/src/catalog/runtime/tintToSkiaColors";
import { createThemeDefinition } from "../../../../../../packages/shared/src/theme/themesCollection";
import type { TokensSnapshot } from "@composition/shared";
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

/** 역할 조건 위반 목록 — 비면 통과 (ADR-290 의 역할 둘 조건을 ADR-302 생성 결과에 다시 잰다). */
function violations(map: Record<string, string>): string[] {
  const out: string[] = [];
  const check = (what: string, a: string, b: string, min: number) => {
    const r = contrastRatio(a, b);
    if (r < min) out.push(`${what} ${a}/${b} ${r.toFixed(2)} < ${min}`);
  };
  check("accent-fill·on-accent", map["accent-fill"]!, map["on-accent"]!, 4.5);
  check("accent·base", map.accent!, map.base!, 3.0);
  for (const key of ACCENT_CONTENT_TEXT_BACKDROPS)
    if (key !== "accent-subtle")
      check(`content·${key}`, map["accent-content"]!, map[key]!, 4.5);
  for (const key of ACCENT_CONTENT_GRAPHIC_BACKDROPS)
    check(`content·${key}`, map["accent-content"]!, map[key]!, 3.0);
  return out;
}

beforeAll(async () => {
  await loadThemeLadders();
});

describe("ADR-290 — 대비 함수 (WCAG 2 참조쌍)", () => {
  it("흰 · 검 21.0 · #777777 · 흰 4.48", () => {
    expect(contrastRatio("#ffffff", "#000000")).toBeCloseTo(21, 2);
    expect(contrastRatio("#777777", "#ffffff")).toBeCloseTo(4.48, 2);
  });
});

describe("ADR-290 역할 둘 · ADR-302 생성 사다리 — 프리셋 10 × Tone 5 × 모드 2", () => {
  it("accent-fill 위 흰 글자 4.5 · accent 면 3 · accent-content 글자 4.5 — 위반 0 · 대비 경고 0", () => {
    const out: string[] = [];
    for (const tint of TINTS)
      for (const tone of TONES) {
        const s = snapshot(tint, tone);
        out.push(...s.warnings.map((w) => `${tint}/${tone}: ${w}`));
        for (const mode of MODES)
          out.push(
            ...violations(s.colors[mode]).map(
              (v) => `${tint}/${tone}/${mode}: ${v}`,
            ),
          );
      }
    expect(out).toEqual([]);
  });

  it("on-accent 는 두 모드 모두 흰색 (ADR-290 결정 1 · ADR-302 사용자 결정 4)", () => {
    for (const tint of TINTS)
      for (const mode of MODES)
        expect(snapshot(tint).colors[mode]["on-accent"]).toBe("#ffffff");
  });
});

describe("ADR-302 — 사용자 hex 표본 20 (ADR-290 Gates Q1 표본 그대로)", () => {
  it("hex 의 (c, h) 로 만든 사다리에서 역할 조건 위반 0 · 대비 경고 0", () => {
    const out: string[] = [];
    for (const hex of HEX_SAMPLES) {
      const s = snapshot("blue", "neutral", colorTokens({ "color.accent": hex }));
      out.push(...s.warnings.map((w) => `${hex}: ${w}`));
      for (const mode of MODES)
        out.push(...violations(s.colors[mode]).map((v) => `${hex}/${mode}: ${v}`));
    }
    expect(out).toEqual([]);
  });
});
