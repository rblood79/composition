import { beforeAll, describe, expect, it } from "vitest";

import {
  SPECTRUM_DEFAULT_LADDERS,
  tokenToCSSVar,
  type TokenRef,
} from "@composition/rendering";

import type { TokensSnapshot } from "../../types/catalog-style.types";
import { createThemeDefinition } from "../../theme/themesCollection";
import { DEFAULT_BASE_TYPOGRAPHY } from "../runtime/fontDefaults";
import {
  colorTokenCssVarName,
  resolveThemeSnapshot,
  type ResolvedThemeSnapshot,
} from "../runtime/resolveThemeSnapshot";
import { TINT_PRESETS } from "../runtime/tintToSkiaColors";
import { NEUTRAL_PRESETS } from "../runtime/neutralToSkiaColors";
import { loadThemeLadders } from "../runtime/themeLadders";
import { buildThemeColors, TONE_PRESET_HUES } from "../runtime/ladderGenerate";

// ADR-302 — 비기본 tint · Tone 의 사다리는 lazy chunk
beforeAll(async () => {
  await loadThemeLadders();
});

/**
 * ADR-293 G1 (RED ②) — 토큰 생성은 resolver 한 곳이다. Skia 맵 (`colors.light` / `colors.dark`) 의
 * 모든 색 키가 같은 값으로 DOM 변수 (`cssVars`) 에 실리고, 그 변수 이름은 생성기 (`tokenToCSSVar`) 가
 * 쓰는 이름과 같으며, 토큰과 변수는 1:1 이다 (한 토큰의 델타가 다른 토큰을 덮지 않는다).
 */
const snapshotOf = (
  tint = "blue",
  neutral = "neutral",
  tokens: TokensSnapshot = {},
): ResolvedThemeSnapshot =>
  resolveThemeSnapshot(
    createThemeDefinition(
      "cover",
      "Cover",
      {
        tint,
        neutral,
        radiusScale: "md",
        darkMode: "light",
      } as never,
      tokens,
    ),
    { baseTypographySeed: DEFAULT_BASE_TYPOGRAPHY },
  );

/** `{color.X}` 를 생성기가 읽는 변수 이름 — `var(--x)` · `var(--x, 폴백)` 의 `--x`. CSS 키워드면 null. */
const generatorVarName = (key: string): string | null =>
  /^var\((--[a-z0-9-]+)\s*[,)]/i.exec(
    tokenToCSSVar(`{color.${key}}` as TokenRef),
  )?.[1] ?? null;

const valueOf = (
  snapshot: ResolvedThemeSnapshot,
  name: string,
  isDark: boolean,
) =>
  snapshot.cssVars.find((v) => v.name === name && v.isDark === isDark)?.value;

/**
 * 테마 색 토큰 — Skia 맵의 키 중 CSS 키워드 (`transparent`) 와 팔레트 상수 (`white` · `black` — 팔레트
 * CSS 의 `--color-white` · `--color-black` 소유, Decision 1) 가 아닌 것.
 */
const colorKeys = (snapshot: ResolvedThemeSnapshot) =>
  Object.keys(snapshot.colors.light).filter(
    (key) =>
      generatorVarName(key) !== null && key !== "white" && key !== "black",
  );

describe("ADR-293 G1 — resolver cssVars 가 Skia 색 맵 전체를 싣는다", () => {
  it("light · dark 키 집합이 같다", () => {
    const snapshot = snapshotOf();
    expect(Object.keys(snapshot.colors.dark).sort()).toEqual(
      Object.keys(snapshot.colors.light).sort(),
    );
  });

  it("모든 색 키의 resolver 변수 이름 = 생성기 변수 이름", () => {
    const mismatched = colorKeys(snapshotOf())
      .filter((key) => colorTokenCssVarName(key) !== generatorVarName(key))
      .map(
        (key) =>
          `${key}: resolver ${colorTokenCssVarName(key)} ≠ 생성기 ${generatorVarName(key)}`,
      );
    expect(mismatched).toEqual([]);
  });

  it("이름 충돌 0 — 서로 다른 토큰이 같은 변수를 쓰지 않고, white · black 밖은 팔레트 변수를 쓰지 않는다", () => {
    const owners = new Map<string, string[]>();
    for (const key of colorKeys(snapshotOf())) {
      const name = generatorVarName(key)!;
      owners.set(name, [...(owners.get(name) ?? []), key]);
    }
    const shared = [...owners]
      .filter(([, keys]) => keys.length > 1)
      .map(([name, keys]) => `${name} ← ${keys.join(" · ")}`);
    const palette = [...owners]
      .filter(([name]) => name.startsWith("--color-"))
      .flatMap(([name, keys]) =>
        keys
          .filter((key) => key !== "white" && key !== "black")
          .map((key) => `${key} → ${name}`),
      );
    expect({ shared, palette }).toEqual({ shared: [], palette: [] });
  });

  for (const tint of Object.keys(TINT_PRESETS))
    for (const neutral of NEUTRAL_PRESETS)
      it(`${tint} × ${neutral}: 모든 색 키가 같은 값으로 cssVars 에 있다`, () => {
        const snapshot = snapshotOf(tint, neutral);
        const missing: string[] = [];
        for (const [mode, isDark] of [
          ["light", false],
          ["dark", true],
        ] as const)
          for (const key of colorKeys(snapshot)) {
            const want = snapshot.colors[mode][key];
            const got = valueOf(snapshot, colorTokenCssVarName(key)!, isDark);
            if (got !== want)
              missing.push(`${mode} ${key}: Skia ${want} · DOM ${got}`);
          }
        expect(missing).toEqual([]);
      });

  // 리뷰 round 1 H2 · round 2 — 명시 델타 하나가 자기 변수만 바꾸고 파생 · 다른 토큰은 Skia 와 같다
  const DELTAS: Record<string, string> = {
    negative: "#ff0000",
    "purple-subtle": "#123456",
    raised: "#eeeeee",
    "on-negative": "#123456",
    elevated: "#fafafa",
    disabled: "#cccccc",
    // 파생 바탕 (결정 4) — neutral 델타는 neutral-fill-* 를, neutral-subtle 델타는 neutral-hover/-pressed 를
    neutral: "#112233",
    "neutral-subtle": "#eeeeee",
  };
  for (const [key, value] of Object.entries(DELTAS))
    it(`명시 델타 color.${key}=${value} — DOM 이 Skia 최종 맵과 같다`, () => {
      const snapshot = snapshotOf("blue", "neutral", {
        [`color.${key}`]: { value },
      } as TokensSnapshot);
      expect(snapshot.colors.light[key]).toBe(value);
      const diverged: string[] = [];
      for (const [mode, isDark] of [
        ["light", false],
        ["dark", true],
      ] as const)
        for (const k of colorKeys(snapshot)) {
          const want = snapshot.colors[mode][k];
          const got = valueOf(snapshot, colorTokenCssVarName(k)!, isDark);
          if (got !== want)
            diverged.push(`${mode} ${k}: Skia ${want} · DOM ${got}`);
        }
      // 팔레트 상수 · 두 축 사다리 (`--tint-N` · `--tone-N`) 는 색 토큰 델타로 바뀌지 않는다
      if (snapshot.cssVars.some((v) => v.name.startsWith("--color-white") || v.name.startsWith("--color-black")))
        diverged.push("팔레트 상수 --color-white/black 을 테마 색으로 실음");
      const base = snapshotOf();
      for (const name of ["--tint-900", "--tone-100", "--tone-800"])
        if (valueOf(snapshot, name, false) !== valueOf(base, name, false))
          diverged.push(`${name} 가 델타로 바뀜`);
      expect(diverged).toEqual([]);
    });

  // ADR-302 Phase 3 (G4) — 두 축 사다리 변수 = snapshot 이 쓴 사다리 · 팔레트 변수 (`--color-*`, ADR-191) 는 테마가 덮지 않는다
  it("--tint-N · --tone-N = 역할 색과 같은 사다리 (기본 · 생성) · --tint · --color-neutral-N 없음", () => {
    const ladderVars = (s: ResolvedThemeSnapshot, prefix: string, isDark: boolean) =>
      Object.fromEntries(
        s.cssVars
          .filter((v) => v.isDark === isDark && v.name.startsWith(`${prefix}-`))
          .map((v) => [Number(v.name.slice(prefix.length + 1)), v.value]),
      );
    const base = snapshotOf();
    for (const [mode, isDark] of [["light", false], ["dark", true]] as const) {
      expect(ladderVars(base, "--tint", isDark)).toEqual(SPECTRUM_DEFAULT_LADDERS.accent[mode]);
      expect(ladderVars(base, "--tone", isDark)).toEqual(SPECTRUM_DEFAULT_LADDERS.tone[mode]);
      // 생성 축: 역할 색을 만든 사다리 그대로 (역할은 수리로 단 밖에 설 수 있지만 사다리 변수는 사다리다)
      const red = snapshotOf("red", "slate");
      const generated = buildThemeColors({
        accent: TINT_PRESETS.red,
        tone: TONE_PRESET_HUES.slate,
      });
      expect(ladderVars(red, "--tint", isDark)).toEqual(generated.ladders.accent[mode]);
      expect(ladderVars(red, "--tone", isDark)).toEqual(generated.ladders.tone[mode]);
      expect(red.colors[mode]).toEqual(generated[mode] && { ...red.colors[mode], ...generated[mode] });
    }
    for (const s of [base, snapshotOf("green", "stone")])
      expect(
        s.cssVars.filter((v) => v.name === "--tint" || v.name.startsWith("--color-neutral-")),
      ).toEqual([]);
  });
});
