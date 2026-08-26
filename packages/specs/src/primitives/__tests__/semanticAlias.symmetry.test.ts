/**
 * ADR-191 후속 → ADR-193 — semantic alias 층의 Skia ↔ CSS 대칭 게이트 (light + dark).
 *
 * 팔레트(`--color-{family}-{step}`)는 ADR-191 로 단일 원천이 됐고, 그 위의 semantic·named hue 층은 ADR-193 으로
 * `semanticPaletteMap.ts` 표 하나에서 두 소비자가 파생된다:
 *   - Skia: `colors.ts` `lightColors/darkColors` (`resolveSemanticColors`)
 *   - CSS : catalog `{color.X}` → `colorTokenToCss.ts` / `tokenResolver.ts` 가 semantic var (`--positive` / `--hue-indigo` …) 를 고르고
 *           → `theme/generated/semantic-palette.css` 가 `:root` / `[data-theme="dark"]` 에서 팔레트 var 로 정의
 *           → `shared-tokens.css` status family alias (`--color-error-N: var(--color-red-N)`) 는 `--negative-pressed` 등 잔여 경로
 * 이 테스트는 CSS 쪽 체인을 텍스트로 따라가 테마별 최종 팔레트 hex 를 구하고, Skia 쪽 hex 와 같은지 본다 (G2 기계 판정).
 * 매핑 파일 하나만 고치거나 생성 CSS 를 재생성하지 않으면 여기서 RED.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { TAILWIND_PALETTE } from "../generated/tailwindPalette";
import { darkColors, lightColors } from "../colors";
import {
  SEMANTIC_PALETTE_MAP,
  type SemanticPaletteToken,
} from "../semanticPaletteMap";

const ROOT = resolve(__dirname, "../../../../..");
const read = (rel: string) => readFileSync(resolve(ROOT, rel), "utf-8");

const sharedTokens = read(
  "packages/shared/src/components/styles/theme/shared-tokens.css",
);
const previewSystem = read(
  "packages/shared/src/components/styles/theme/preview-system.css",
);
const semanticCss = read(
  "packages/shared/src/components/styles/theme/generated/semantic-palette.css",
);
const catalogMap = read(
  "packages/shared/src/catalog/resolvers/colorTokenToCss.ts",
);
const specMap = read("packages/specs/src/renderers/utils/tokenResolver.ts");

type Family = keyof typeof TAILWIND_PALETTE;
type Step = keyof (typeof TAILWIND_PALETTE)["red"];
type Theme = "light" | "dark";

/** `--color-error-500: var(--color-red-500);` → { error: red } (status family → palette family) */
function statusFamilyAliases(css: string): Record<string, Family> {
  const out: Record<string, Family> = {};
  for (const m of css.matchAll(
    /--color-(success|warning|error|info)-(\d+):\s*var\(--color-([a-z]+)-(\d+)\)/g,
  )) {
    const [, status, step, family, aliasStep] = m;
    expect(aliasStep, `${status}-${step} alias step`).toBe(step);
    if (out[status]) expect(out[status], `${status} family`).toBe(family);
    out[status] = family as Family;
  }
  return out;
}

/** `X: "var(--positive)"` → var 이름 */
function tokenVar(source: string, token: string): string {
  const m = new RegExp(
    `^\\s*"?${token}"?:\\s*"var\\((--[a-z0-9-]+)\\)"`,
    "m",
  ).exec(source);
  if (!m) throw new Error(`${token} mapping not found`);
  return m[1];
}

/** 생성 semantic CSS 의 `:root` / `[data-theme="dark"]` 블록 → { --var: --color-family-step } */
function semanticDefinitions(theme: Theme): Record<string, string> {
  const [light, dark] = semanticCss.split('[data-theme="dark"]');
  expect(dark, "semantic-palette.css dark 블록").toBeDefined();
  const out: Record<string, string> = {};
  for (const m of (theme === "light" ? light : dark).matchAll(
    /^\s+(--[a-z-]+):\s*var\((?:--[a-z-]+,\s*var\()?(--color-[a-z]+-\d+)\)\)?;$/gm,
  )) {
    out[m[1]] = m[2];
  }
  return out;
}

/** CSS var → 테마별 최종 팔레트 hex. semantic var 는 생성 CSS 를 경유, `--color-*` 는 alias 해석. */
function resolveCssVar(
  name: string,
  aliases: Record<string, Family>,
  theme: Theme,
): string {
  const paletteVar = name.startsWith("--color-")
    ? name
    : semanticDefinitions(theme)[name];
  if (!paletteVar)
    throw new Error(
      `${name} 은 semantic-palette.css 에 정의되지 않음 (${theme})`,
    );
  const m = /^--color-([a-z]+)-(\d+)$/.exec(paletteVar);
  if (!m) throw new Error(`unsupported var ${paletteVar}`);
  const [, fam, step] = m;
  const family = (aliases[fam] ?? fam) as Family;
  return TAILWIND_PALETTE[family][Number(step) as Step];
}

const TOKENS = Object.keys(SEMANTIC_PALETTE_MAP) as SemanticPaletteToken[];
const CATALOG_TOKENS = TOKENS.filter(
  (t) => !t.endsWith("-subtle") && t !== "green-named",
);

describe("semantic 층 — Skia colors.ts ↔ CSS 체인 대칭 (ADR-193)", () => {
  const aliases = statusFamilyAliases(sharedTokens);

  it("shared-tokens status family 4종이 전부 팔레트 alias 다 (손 hsl 0)", () => {
    expect(aliases).toEqual({
      success: "green",
      warning: "orange",
      error: "red",
      info: "blue",
    });
    expect(sharedTokens).not.toMatch(
      /--color-(success|warning|error|info)-\d+:\s*hsl\(/,
    );
  });

  it("preview-system 에 손 --negative 정의가 없다 (생성 파일로 이관) — --negative-pressed 와 forced-colors 만 잔류", () => {
    expect(previewSystem).not.toMatch(
      /^\s+--negative:\s*var\(--color-invalid/m,
    );
    expect(previewSystem).toMatch(
      /--negative-pressed:\s*var\(--color-invalid-pressed/,
    );
    expect(previewSystem).toContain("--negative: LinkText;");
  });

  it("catalog 매핑과 잔존 spec 매핑이 표의 cssVar 를 그대로 고른다 (R5)", () => {
    for (const token of TOKENS) {
      const expected = SEMANTIC_PALETTE_MAP[token].cssVar;
      expect(tokenVar(specMap, token), `spec ${token}`).toBe(expected);
      if (CATALOG_TOKENS.includes(token)) {
        expect(tokenVar(catalogMap, token), `catalog ${token}`).toBe(expected);
      }
    }
  });

  describe.each(["light", "dark"] as const)("%s", (theme) => {
    const skia = theme === "light" ? lightColors : darkColors;

    it.each(TOKENS)(
      `{color.%s} — semantic-palette.css ${theme} 최종 팔레트 hex == Skia ${theme}Colors`,
      (token) => {
        const cssVar = tokenVar(specMap, token);
        expect(resolveCssVar(cssVar, aliases, theme)).toBe(skia[token]);
      },
    );
  });

  it("dark 는 light 와 다른 단계를 고른다 — CSS 가 dark 에서 실제로 움직이는지 (Phase 0 결함의 역: FIXED 24 → 0)", () => {
    let moved = 0;
    for (const token of TOKENS) {
      const v = SEMANTIC_PALETTE_MAP[token].cssVar;
      if (
        resolveCssVar(v, aliases, "light") !== resolveCssVar(v, aliases, "dark")
      )
        moved++;
    }
    expect(moved).toBe(TOKENS.length);
  });

  it("shared-tokens primary/tertiary 도 팔레트 alias (blue/purple) — 손 hex 0", () => {
    expect(sharedTokens).not.toMatch(/--color-(primary|tertiary)-\d+:\s*#/);
    for (const step of [50, 100, 500, 700, 900]) {
      expect(sharedTokens).toContain(
        `--color-primary-${step}: var(--color-blue-${step});`,
      );
      expect(sharedTokens).toContain(
        `--color-tertiary-${step}: var(--color-purple-${step});`,
      );
    }
  });

  it("실측 앵커 — negative 는 red-500 #fb2c36 / red-400 dark, notice 는 orange-600 #f54900 (amber 아님)", () => {
    expect(lightColors.negative).toBe(TAILWIND_PALETTE.red[500]);
    expect(darkColors.negative).toBe(TAILWIND_PALETTE.red[400]);
    expect(lightColors.notice).toBe(TAILWIND_PALETTE.orange[600]);
    expect(TAILWIND_PALETTE.red[500]).toBe("#fb2c36");
    expect(TAILWIND_PALETTE.orange[600]).toBe("#f54900");
    expect(resolveCssVar("--negative", aliases, "dark")).toBe("#ff6467");
  });
});
