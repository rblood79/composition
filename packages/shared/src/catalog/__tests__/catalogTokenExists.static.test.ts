import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

import {
  resolveToken,
  SEMANTIC_PALETTE_MAP,
  tokenToCSSVar,
  type TokenRef,
} from "@composition/rendering";
import { isFocusRingTokenRef } from "@composition/rendering/renderers/utils/tokenResolver";

import { createThemeDefinition } from "../../theme/themesCollection";
import { DEFAULT_BASE_TYPOGRAPHY } from "../runtime/fontDefaults";
import { resolveThemeSnapshot } from "../runtime/resolveThemeSnapshot";
import { installThemeMaps } from "../runtime/themeMaps";
import { COMPONENT_RULES_TABLE } from "../generated/componentRulesTable";
import {
  REUSABLE_ORIGIN_DEFINITIONS,
  REUSABLE_ORIGIN_TEMPLATES,
} from "../document/generated/reusableOriginLibrary";

/**
 * catalog 토큰 존재 검사 (2026-10-28, `.agent/runs/2026-10-28-adobe-repository-analysis` 권장 2):
 * catalog 가 `{category.name}` 로 참조하는 모든 토큰이 두 consumer 의 정본에 실제로 있어야 한다 —
 * Skia 는 code 기본 맵 + 테마 snapshot (`resolveToken` · `installThemeMaps`), DOM 은 `tokenToCSSVar`
 * 의 색 표 (없는 이름은 `var(--이름)` 으로 떨어져 미정의 CSS 변수가 된다). 없는 토큰은 조용히 다른
 * 값으로 그려진다 — 메모리 `feedback-fallback-equals-default-masks-dropped-channel` 과 같은 종류.
 *
 * 대상 ① `COMPONENT_RULES_TABLE` · origin library (객체 순회 — 문자열 안에 섞인 참조도 포함)
 *       ② `packages/shared/src/catalog` · `packages/rendering/src` 의 소스 리터럴 (주석 · 테스트 제외)
 * 한 segment 참조 (`{label}` · `{icon}`) 는 template 바인딩이라 토큰이 아니다.
 */
const TOKEN_REF = /\{([a-z][a-z-]*)\.([A-Za-z0-9._-]+)\}/g;
const TOKEN_CATEGORIES = new Set([
  "color",
  "typography",
  "radius",
  "spacing",
  "shadow",
  "border",
  "focus",
]);

/**
 * Skia 맵에 없는 것이 설계인 토큰 — named hue 의 hover · pressed 는 DOM 만 color-mix 로 파생한다
 * (`tokenResolver.ts` ADR-193 후속: 「Skia 는 hover 를 소비하지 않으므로 표에 넣지 않는다」). Badge
 * 의 variants 가 참조하지만 Badge 는 Canvas 에서 hover · pressed 를 그리지 않는다. 목록은 정확히
 * 일치해야 한다 — 새 hue 를 Skia 맵 없이 참조하면 여기 더하는 대신 맵에 넣는다.
 */
const SKIA_HOVER_PRESSED_DOM_ONLY: ReadonlySet<string> = new Set(
  [
    "chartreuse",
    "celery",
    "seafoam",
    "brown",
    "cinnamon",
    "silver",
    "purple",
  ].flatMap((hue) => [`{color.${hue}-hover}`, `{color.${hue}-pressed}`]),
);

function collectFromValue(
  node: unknown,
  path: string,
  out: Map<string, Set<string>>,
): void {
  if (typeof node === "string") {
    for (const match of node.matchAll(TOKEN_REF)) {
      const at = out.get(match[0]) ?? new Set<string>();
      at.add(path);
      out.set(match[0], at);
    }
    return;
  }
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    node.forEach((item, index) =>
      collectFromValue(item, `${path}[${index}]`, out),
    );
    return;
  }
  for (const [key, value] of Object.entries(node as Record<string, unknown>))
    collectFromValue(value, `${path}.${key}`, out);
}

const SOURCE_ROOTS = [
  resolve(__dirname, ".."),
  resolve(__dirname, "../../../../rendering/src"),
];
const REPO = resolve(__dirname, "../../../../..");
/** DOM 이 읽는 테마 CSS — `preview-system.css` · `builder-system.css` · 생성 palette. */
const THEME_CSS_DIR = resolve(__dirname, "../../components/styles/theme");

function* sourceCssFiles(dir: string): Generator<string> {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (name === "__tests__") continue;
    if (statSync(full).isDirectory()) yield* sourceCssFiles(full);
    else if (name.endsWith(".css")) yield full;
  }
}

function* sourceFiles(dir: string): Generator<string> {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (name === "__tests__" || name === "node_modules") continue;
    if (statSync(full).isDirectory()) yield* sourceFiles(full);
    else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) yield full;
  }
}

/** 주석을 뺀 소스 — 주석 속 예시 (`resolveToken("{shadow.x}")`) 는 참조가 아니다. */
function withoutComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

function collectFromSources(out: Map<string, Set<string>>): void {
  for (const root of SOURCE_ROOTS)
    for (const file of sourceFiles(root)) {
      const text = withoutComments(readFileSync(file, "utf8"));
      for (const match of text.matchAll(
        /"(\{[a-z][a-z-]*\.[A-Za-z0-9._-]+\})"/g,
      )) {
        const ref = match[1]!;
        const at = out.get(ref) ?? new Set<string>();
        at.add(relative(REPO, file));
        out.set(ref, at);
      }
    }
}

function collectRefs(): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>();
  collectFromValue(COMPONENT_RULES_TABLE, "COMPONENT_RULES_TABLE", out);
  collectFromValue(
    REUSABLE_ORIGIN_DEFINITIONS,
    "REUSABLE_ORIGIN_DEFINITIONS",
    out,
  );
  collectFromValue(REUSABLE_ORIGIN_TEMPLATES, "REUSABLE_ORIGIN_TEMPLATES", out);
  collectFromSources(out);
  return out;
}

const REFS = collectRefs();
const categoryOf = (ref: string) => ref.slice(1).split(".")[0]!;

function where(ref: string): string {
  return [...(REFS.get(ref) ?? [])].slice(0, 3).join(" · ");
}

/** `resolveToken` 이 값을 돌려줬는가 — 없는 키는 `undefined` (color · typography …) 또는 참조 그대로 (border). */
function resolvesInSkiaMaps(ref: string, mode: "light" | "dark"): boolean {
  const warn = console.warn;
  let warned = false;
  console.warn = () => {
    warned = true;
  };
  try {
    const value = resolveToken(ref as TokenRef, mode);
    return !warned && value !== undefined && value !== ref;
  } finally {
    console.warn = warn;
  }
}

const skiaExpected = (ref: string) =>
  categoryOf(ref) !== "focus" && !SKIA_HOVER_PRESSED_DOM_ONLY.has(ref);

describe("catalog 토큰 존재 — 참조하는 모든 토큰이 theme/tokens 에 있다", () => {
  it("수집기가 catalog 의 토큰 참조를 실제로 모았다 (color · typography · radius · border 범주 포함)", () => {
    const categories = new Set([...REFS.keys()].map(categoryOf));
    expect(REFS.size).toBeGreaterThan(100);
    for (const category of ["color", "typography", "radius", "border"])
      expect(categories.has(category), category).toBe(true);
  });

  it("참조 범주는 `resolveToken` 이 아는 것뿐이다 (알 수 없는 범주 0)", () => {
    const unknown = [...REFS.keys()]
      .filter((ref) => !TOKEN_CATEGORIES.has(categoryOf(ref)))
      .map((ref) => `${ref} ← ${where(ref)}`);
    expect(unknown).toEqual([]);
  });

  it("focus ring 참조는 `tokenResolver` 의 표에 있는 둘뿐이다", () => {
    const focus = [...REFS.keys()].filter((ref) => categoryOf(ref) === "focus");
    expect(focus.length).toBeGreaterThan(0);
    expect(focus.filter((ref) => !isFocusRingTokenRef(ref))).toEqual([]);
  });

  it("Skia: code 기본 맵에서 light · dark 둘 다 값이 있다", () => {
    installThemeMaps(null);
    const missing: string[] = [];
    for (const ref of REFS.keys()) {
      if (!skiaExpected(ref)) continue;
      for (const mode of ["light", "dark"] as const)
        if (!resolvesInSkiaMaps(ref, mode))
          missing.push(`${ref} (${mode}) ← ${where(ref)}`);
    }
    expect(missing).toEqual([]);
  });

  it("Skia: 기본 preset 테마 snapshot 에도 같은 키가 있고, 설치한 뒤에도 해석된다", () => {
    const snapshot = resolveThemeSnapshot(
      createThemeDefinition("theme-token-check", "Token check"),
      { baseTypographySeed: DEFAULT_BASE_TYPOGRAPHY },
    );
    const maps: Record<
      string,
      (mode: "light" | "dark") => Record<string, unknown>
    > = {
      color: (mode) => snapshot.colors[mode],
      typography: () => snapshot.typography,
      radius: () => snapshot.radius,
      border: () => snapshot.border,
      shadow: (mode) => snapshot.shadows[mode],
    };
    const missing: string[] = [];
    for (const ref of REFS.keys()) {
      if (!skiaExpected(ref)) continue;
      const [category, ...rest] = ref.slice(1, -1).split(".");
      const map = maps[category!];
      // (spacing 은 code 맵뿐 — 테마가 덮지 않는다.)
      if (!map) continue;
      const key =
        category === "border"
          ? rest.join(".").replace(/^width\./, "")
          : rest.join(".");
      for (const mode of ["light", "dark"] as const)
        if (!(key in map(mode)))
          missing.push(`${ref} (${mode}) ← ${where(ref)}`);
    }
    expect(missing).toEqual([]);

    installThemeMaps(snapshot);
    try {
      const afterInstall: string[] = [];
      for (const ref of REFS.keys())
        if (skiaExpected(ref) && !resolvesInSkiaMaps(ref, "light"))
          afterInstall.push(`${ref} ← ${where(ref)}`);
      expect(afterInstall).toEqual([]);
    } finally {
      installThemeMaps(null);
    }
  });

  it("DOM: 색 참조가 emit 하는 CSS 변수 (폴백 없는 것) 는 theme CSS 또는 테마 snapshot 에 선언돼 있다", () => {
    const declared = new Set<string>();
    for (const file of sourceCssFiles(THEME_CSS_DIR))
      for (const match of readFileSync(file, "utf8").matchAll(
        /(--[A-Za-z0-9_-]+)\s*:/g,
      ))
        declared.add(match[1]!);
    const snapshot = resolveThemeSnapshot(
      createThemeDefinition("theme-token-check", "Token check"),
      { baseTypographySeed: DEFAULT_BASE_TYPOGRAPHY },
    );
    for (const cssVar of snapshot.cssVars) declared.add(cssVar.name);
    expect(declared.size).toBeGreaterThan(50);

    const undeclared: string[] = [];
    for (const ref of REFS.keys()) {
      if (categoryOf(ref) !== "color") continue;
      const css = tokenToCSSVar(ref as TokenRef);
      // (`var(--x, 폴백)` 의 `--x` 는 테마 override 자리 — 없어도 폴백이 그린다. 폴백 없는 var 만 본다.)
      for (const match of css.matchAll(/var\((--[A-Za-z0-9_-]+)\s*([,)])/g))
        if (match[2] === ")" && !declared.has(match[1]!))
          undeclared.push(`${ref} → ${css} ← ${where(ref)}`);
    }
    expect(undeclared).toEqual([]);
  });

  it("Skia 가 빼는 hover · pressed 목록은 실제 참조 · 실제 Skia 누락과 정확히 같다 (ratchet)", () => {
    installThemeMaps(null);
    const actual = [...REFS.keys()]
      .filter(
        (ref) =>
          categoryOf(ref) === "color" &&
          /-(hover|pressed)\}$/.test(ref) &&
          !resolvesInSkiaMaps(ref, "light"),
      )
      .sort();
    expect(actual).toEqual([...SKIA_HOVER_PRESSED_DOM_ONLY].sort());
    // (그 hue 들은 DOM 이 color-mix 로 파생하는 named hue 다.)
    for (const ref of actual)
      expect(
        ref.replace(/^\{color\./, "").replace(/-(hover|pressed)\}$/, "") in
          SEMANTIC_PALETTE_MAP,
        ref,
      ).toBe(true);
  });
});
