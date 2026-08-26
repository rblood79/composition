/**
 * ADR-191 후속 — semantic alias 층의 Skia ↔ CSS 대칭 게이트 (2026-08-27).
 *
 * 팔레트(`--color-{family}-{step}`)는 ADR-191 로 단일 원천이 됐지만, 그 위의 semantic 층은 두 소비자가
 * 따로 정의한다:
 *   - Skia: `colors.ts` `lightColors/darkColors.{negative,informative,notice,positive}` (TAILWIND_PALETTE 참조)
 *   - CSS : catalog `{color.X}` → `colorTokenToCss.ts` / `tokenResolver.ts` 가 고르는 var
 *           → `shared-tokens.css` status family alias (`--color-error-N: var(--color-red-N)`)
 *           → `preview-system.css` `--negative` fallback 단계
 * 이 테스트는 CSS 쪽 체인을 텍스트로 따라가 최종 팔레트 (family, step) 을 구하고, Skia 쪽 hex 와 같은지 본다.
 * 어느 한쪽만 고치면 여기서 RED — 두 소비자가 같은 원천을 보는지의 회귀 고정.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { TAILWIND_PALETTE } from "../generated/tailwindPalette";
import { darkColors, lightColors } from "../colors";

const ROOT = resolve(__dirname, "../../../../..");
const read = (rel: string) => readFileSync(resolve(ROOT, rel), "utf-8");

const sharedTokens = read(
  "packages/shared/src/components/styles/theme/shared-tokens.css",
);
const previewSystem = read(
  "packages/shared/src/components/styles/theme/preview-system.css",
);
const catalogMap = read(
  "packages/shared/src/catalog/resolvers/colorTokenToCss.ts",
);
const specMap = read("packages/specs/src/renderers/utils/tokenResolver.ts");

type Family = keyof typeof TAILWIND_PALETTE;
type Step = keyof (typeof TAILWIND_PALETTE)["red"];

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

/** `X: "var(--color-info-600)"` 또는 `X: "var(--negative)"` → var 이름 */
function tokenVar(source: string, token: string): string {
  const m = new RegExp(
    `^\\s*"?${token}"?:\\s*"var\\((--[a-z0-9-]+)\\)"`,
    "m",
  ).exec(source);
  if (!m) throw new Error(`${token} mapping not found`);
  return m[1];
}

/** `--negative: var(--color-invalid, var(--color-error-500));` 의 fallback (status, step) — light/dark 순서 */
function negativeFallbacks(css: string): Array<[string, string]> {
  return [
    ...css.matchAll(
      /--negative:\s*var\(--color-invalid,\s*var\(--color-(success|warning|error|info)-(\d+)\)\)/g,
    ),
  ].map((m) => [m[1], m[2]]);
}

/** CSS var → 최종 팔레트 hex. `--color-{status}-{step}` / `--negative` 만 다룬다. */
function resolveCssVar(
  name: string,
  aliases: Record<string, Family>,
  mode: "light" | "dark",
): string {
  if (name === "--negative") {
    const fb = negativeFallbacks(previewSystem);
    expect(fb.length, "preview-system --negative light+dark").toBe(2);
    const [status, step] = fb[mode === "light" ? 0 : 1];
    return TAILWIND_PALETTE[aliases[status]][Number(step) as Step];
  }
  const m = /^--color-([a-z]+)-(\d+)$/.exec(name);
  if (!m) throw new Error(`unsupported var ${name}`);
  const [, fam, step] = m;
  const family = (aliases[fam] ?? fam) as Family;
  return TAILWIND_PALETTE[family][Number(step) as Step];
}

describe("semantic alias 층 — Skia colors.ts ↔ CSS 체인 대칭", () => {
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
    for (const status of Object.keys(aliases)) {
      for (const step of [
        50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950,
      ]) {
        expect(sharedTokens).toContain(
          `--color-${status}-${step}: var(--color-${aliases[status]}-${step});`,
        );
      }
    }
  });

  it("catalog 매핑과 잔존 spec 매핑이 같은 var 를 고른다", () => {
    for (const token of ["negative", "informative", "positive", "notice"]) {
      expect(tokenVar(catalogMap, token), token).toBe(tokenVar(specMap, token));
    }
  });

  it.each(["negative", "informative", "positive", "notice"] as const)(
    "light: {color.%s} — CSS 최종 팔레트 hex == lightColors",
    (token) => {
      const cssHex = resolveCssVar(
        tokenVar(catalogMap, token),
        aliases,
        "light",
      );
      expect(cssHex).toBe(lightColors[token]);
    },
  );

  it("dark: {color.negative} — preview-system dark --negative == darkColors.negative", () => {
    expect(resolveCssVar("--negative", aliases, "dark")).toBe(
      darkColors.negative,
    );
  });

  const NAMED = [
    "purple",
    "red",
    "orange",
    "yellow",
    "blue",
    "indigo",
    "cyan",
    "pink",
    "fuchsia",
    "magenta",
    "celery",
    "chartreuse",
    "turquoise",
    "seafoam",
    "cinnamon",
    "brown",
    "silver",
  ] as const;

  it.each(NAMED)(
    "named hue {color.%s} — catalog 매핑 var 의 팔레트 hex == lightColors (손 oklch 리터럴 0)",
    (token) => {
      const cssVar = tokenVar(catalogMap, token);
      expect(cssVar, `${token} 은 var(--color-*) 여야 함`).toMatch(/^--color-/);
      expect(resolveCssVar(cssVar, aliases, "light")).toBe(lightColors[token]);
    },
  );

  it.each(NAMED.filter((t) => t !== "gray"))(
    "named hue {color.%s-subtle} — 잔존 spec 매핑(tokenResolver) 의 팔레트 hex == lightColors",
    (token) => {
      const key = `${token}-subtle` as keyof typeof lightColors;
      const cssVar = tokenVar(specMap, `${token}-subtle`);
      expect(resolveCssVar(cssVar, aliases, "light")).toBe(lightColors[key]);
    },
  );

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

  it("실측 앵커 — negative 는 red-500 #fb2c36, notice 는 orange-600 #f54900 (amber 아님)", () => {
    expect(lightColors.negative).toBe(TAILWIND_PALETTE.red[500]);
    expect(lightColors.notice).toBe(TAILWIND_PALETTE.orange[600]);
    expect(TAILWIND_PALETTE.red[500]).toBe("#fb2c36");
    expect(TAILWIND_PALETTE.orange[600]).toBe("#f54900");
  });
});
