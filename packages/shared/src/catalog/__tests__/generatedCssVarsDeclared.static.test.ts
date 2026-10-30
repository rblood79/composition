import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { createThemeDefinition } from "../../theme/themesCollection";
import { DEFAULT_BASE_TYPOGRAPHY } from "../runtime/fontDefaults";
import { resolveThemeSnapshot } from "../runtime/resolveThemeSnapshot";

/**
 * ADR-293 G2 (RED ①) — 생성 CSS 가 폴백 없이 읽는 `var(--X)` 는 Preview · Publish 문서 어딘가에
 * 선언돼 있어야 한다. 선언 출처: theme CSS (`preview-system.css` · `shared-tokens.css` · 생성 팔레트) ·
 * resolver `cssVars` · 컴포넌트 CSS 가 스스로 선언하는 지역 변수 · 런타임이 inline 으로 싣는 변수.
 *
 * `catalogTokenExists` 는 변환표 문자열을 검사해 폴백 있는 `var(--neutral-hover, color-mix(…))` 를
 * 통과시킨다. 생성기는 hover · pressed 를 `--button-color-hover: var(--neutral-hover);` 처럼 폴백
 * 없이 내므로 여기서는 **생성 CSS 자체**를 본다.
 */
const STYLES = resolve(__dirname, "../../components/styles");
const GENERATED = join(STYLES, "generated");
const THEME = join(STYLES, "theme");

/**
 * 런타임이 inline style 로 싣는 변수 — 선언이 CSS 에 없는 것이 정상.
 *
 * `--catalog-<상태>-*` 는 `CatalogStates.css` (`stateStyles.ts` 의 STATES) 가 읽고 요소 inline 이 싣는 상태 변수다.
 * ADR-295 Decision 9: `--catalog-` 를 통째로 허용하면 같은 접두의 토큰 변수 `--catalog-token-*` 가 선언 없이
 * 통과한다 — 토큰 변수는 resolver `cssVars` 나 CSS (`builder-catalog-vars.css` · `theme-seed.generated.css`) 에
 * 선언이 있어야 한다. 그래서 상태 접두만 연다 (긴 접두가 먼저 — `selected-hover` ⊂ `selected` 이라 순서 무관).
 */
const CATALOG_STATE_PREFIXES = [
  "hover",
  "focus-visible",
  "pressed",
  "selected",
  "selected-hover",
  "selected-pressed",
  "disabled",
].map((state) => `--catalog-${state}-`);

const RUNTIME_PREFIXES = [
  ...CATALOG_STATE_PREFIXES,
  "--trigger-",
  "--button-",
  "--indicator-",
  "--inset-",
  "--table-",
];

/**
 * 이 게이트 밖으로 둔 변수 (사유 필수). `--font-sans` — 생성 CSS 32 장이 폴백 없이 읽는데 Preview ·
 * Publish 문서에는 선언이 없다 (Builder 문서만 Tailwind `@theme` 가 준다). 타이포 축이라 ADR-293 (테마 색)
 * 범위 밖 — 무효 선언이 body 의 base 글꼴 상속으로 떨어져 지금 화면은 같다. 후속 항목 (breakdown §7).
 */
const KNOWN_UNDECLARED: ReadonlySet<string> = new Set(["--font-sans"]);

const cssFiles = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? entry.name === "__tests__"
        ? []
        : cssFiles(join(dir, entry.name))
      : entry.name.endsWith(".css")
        ? [join(dir, entry.name)]
        : [],
  );

function declaredNames(): Set<string> {
  const declared = new Set<string>();
  // builder chrome 전용 시트는 Preview · Publish 문서에 없다
  for (const file of cssFiles(STYLES)) {
    if (file.endsWith("builder-system.css")) continue;
    for (const match of readFileSync(file, "utf8").matchAll(
      /(--[A-Za-z0-9_-]+)\s*:/g,
    ))
      declared.add(match[1]!);
  }
  const snapshot = resolveThemeSnapshot(
    createThemeDefinition("generated-css-vars", "Generated CSS vars"),
    { baseTypographySeed: DEFAULT_BASE_TYPOGRAPHY },
  );
  for (const cssVar of snapshot.cssVars) declared.add(cssVar.name);
  return declared;
}

describe("ADR-293 G2 — 생성 CSS 의 폴백 없는 변수", () => {
  it("상태 변수 접두는 CatalogStates.css 가 읽는 집합과 같다 (ADR-295 — 토큰 변수는 이 허용 밖)", () => {
    const states = readFileSync(join(GENERATED, "CatalogStates.css"), "utf8");
    const read = new Set(
      [...states.matchAll(/var\((--catalog-[a-z-]+?)-(?:width|height|min|max|padding|margin|gap|row|column|font|line|letter|border|outline|background|color|opacity|box|text|aspect|--)/g)].map(
        (m) => `${m[1]}-`,
      ),
    );
    expect([...read].sort()).toEqual([...CATALOG_STATE_PREFIXES].sort());
    expect(
      RUNTIME_PREFIXES.some((prefix) => "--catalog-token-x".startsWith(prefix)),
    ).toBe(false);
  });

  it("theme CSS 경로가 존재한다", () => {
    expect(cssFiles(THEME).length).toBeGreaterThan(3);
  });

  it("폴백 없는 var(--X) 는 전부 선언돼 있다", () => {
    const declared = declaredNames();
    const undeclared = new Map<string, Set<string>>();
    for (const file of cssFiles(GENERATED)) {
      const text = readFileSync(file, "utf8");
      for (const match of text.matchAll(/var\((--[A-Za-z0-9_-]+)\s*\)/g)) {
        const name = match[1]!;
        if (declared.has(name) || KNOWN_UNDECLARED.has(name)) continue;
        if (RUNTIME_PREFIXES.some((prefix) => name.startsWith(prefix)))
          continue;
        const at = undeclared.get(name) ?? new Set<string>();
        at.add(file.slice(GENERATED.length + 1));
        undeclared.set(name, at);
      }
    }
    expect(
      [...undeclared].map(([name, at]) => `${name} ← ${[...at].join(", ")}`),
    ).toEqual([]);
  });

  it("preview-system.css 는 resolver 가 싣는 테마 색을 선언하지 않는다 (ADR-293 Decision 3)", () => {
    const css = readFileSync(join(THEME, "preview-system.css"), "utf8");
    // forced-colors 블록의 시스템 색은 남는다 — resolver 색은 그 media 밖에서만 실린다
    const outside = css.split("@media (forced-colors: active)")[0]!;
    const declared = new Set(
      [...outside.matchAll(/^\s+(--[A-Za-z0-9_-]+)\s*:/gm)].map((m) => m[1]!),
    );
    const snapshot = resolveThemeSnapshot(
      createThemeDefinition("preview-system", "Preview system"),
      { baseTypographySeed: DEFAULT_BASE_TYPOGRAPHY },
    );
    // chart accent 사다리는 snapshot 없이 CSS 만 싣는 chart 테스트용으로 남는다 (Decision 3 유지 목록 —
    // Preview 에서는 layer 없는 resolver 값이 이긴다)
    const owned = snapshot.cssVars
      .filter((v) => v.color && !v.name.startsWith("--chart-accent-"))
      .map((v) => v.name);
    expect([...new Set(owned)].filter((name) => declared.has(name))).toEqual(
      [],
    );
  });
});
