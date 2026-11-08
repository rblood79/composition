/**
 * ADR-302 G2 — 두 축. 테마 색은 alias 표 (`COLOR_ALIASES`) 의 축 · 단에서만 온다.
 *
 *   1. catalog 소스의 모든 `{color.*}` 참조가 alias 표에 있고 축이 적혀 있다.
 *   2. 옛 파생 경로의 심볼 (`semanticPaletteMap` 좌표 · `DEFAULT_SURFACE_KEYS` · `solveAccentRoles` · `mixHexWithBlack`)
 *      이 소스에 없다. DOM 의 둘째 파생도 없다 (Phase 3) — 색 토큰 변환표의 `color-mix` 폴백 · Preview CSS 의
 *      `--tint` oklch 상대색 사다리 · resolver 의 `--tint` / `--color-neutral-N` (Tailwind Tone 단계) 덮기.
 *   3. hover = pressed, 그리고 기본에서 한 단 (사다리의 다음 단). 예외는 데이터로만: design-data 상태 alias 가
 *      oracle 인 역할 (G1 이 그 단을 잰다 — `accent-hover` dark 700) · S2 Button 명시 단인 `*-fill-hover/-pressed`.
 *   4. tone 축 단 범위 (Hub grays) — 배경 층 25 ~ 100 · 면 · 테두리 · disabled 100 ~ 400 · 글자 · 진한 면 600 ~ 1000.
 *      tone 역할은 모두 한 갈래에 속해야 한다 (새 tone 역할은 분류부터).
 *   5. 고정 hex 금지 — 문자열 단은 `constant` 축 또는 완전 투명 (`#rrggbb00`) 만.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  COLOR_ALIASES,
  SPECTRUM_LADDERS,
  type ColorAliasEntry,
  type SpectrumLadderFamily,
} from "@composition/rendering";

const REPO = fileURLToPath(new URL("../../../../../", import.meta.url));
const MODES = ["light", "dark"] as const;

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === "__tests__" || name === "dist")
      continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) sourceFiles(path, out);
    else if (/\.(ts|tsx|css)$/.test(name) && !/\.test\.tsx?$/.test(name))
      out.push(path);
  }
  return out;
}

/** 주석 줄 — 옛 이름을 이력으로 적는 것은 참조가 아니다. */
function isComment(line: string): boolean {
  const t = line.trim();
  return t.startsWith("*") || t.startsWith("//") || t.startsWith("/*");
}

const SOURCE_ROOTS = [
  "packages/shared/src",
  "packages/rendering/src",
  "packages/rendering/scripts",
  "apps/builder/src",
  "apps/publish/src",
];

describe("ADR-302 G2 — 두 축", () => {
  it("1. catalog 소스의 {color.*} 참조는 전부 alias 표에 축과 함께 있다", () => {
    const missing = new Set<string>();
    for (const file of sourceFiles(join(REPO, "packages/shared/src/catalog")))
      for (const line of readFileSync(file, "utf8").split("\n")) {
        if (isComment(line)) continue;
        for (const m of line.matchAll(/\{color\.([a-z0-9-]+)\}/g))
          if (!COLOR_ALIASES[m[1]!]?.axis)
            missing.add(`${m[1]} (${relative(REPO, file)})`);
      }
    expect([...missing]).toEqual([]);
  });

  it("2. 옛 파생 경로 심볼이 소스에 없다", () => {
    const symbols =
      /\b(semanticPaletteMap|SEMANTIC_PALETTE_MAP|DEFAULT_SURFACE_KEYS|solveAccentRoles|mixHexWithBlack)\b/;
    const hits: string[] = [];
    for (const root of SOURCE_ROOTS)
      for (const file of sourceFiles(join(REPO, root))) {
        const lines = readFileSync(file, "utf8").split("\n");
        lines.forEach((line, i) => {
          if (symbols.test(line) && !isComment(line))
            hits.push(`${relative(REPO, file)}:${i + 1}`);
        });
      }
    expect(hits).toEqual([]);
  });

  it("2b. DOM 둘째 파생 0 — 변환표 color-mix 폴백 · CSS oklch(from var(--tint)) · --tint / --color-neutral-N 변수", () => {
    const read = (path: string) =>
      readFileSync(join(REPO, path), "utf8")
        .split("\n")
        .filter((line) => !isComment(line))
        .join("\n");
    const hits: string[] = [];
    if (/color-mix\(/.test(read("packages/rendering/src/renderers/utils/tokenResolver.ts")))
      hits.push("tokenResolver.ts color-mix");
    const previewCss = readFileSync(
      join(REPO, "packages/shared/src/components/styles/theme/preview-system.css"),
      "utf8",
    ).replace(/\/\*[\s\S]*?\*\//g, "");
    if (/oklch\(\s*from\s+var\(--tint\)/.test(previewCss)) hits.push("preview-system.css --tint 상대색");
    if (/--tint\s*:/.test(previewCss)) hits.push("preview-system.css --tint 선언");
    if (/--(tint|tone)-\d+\s*:/.test(previewCss)) hits.push("preview-system.css 사다리 변수 선언 (resolver 값을 덮는다)");
    const resolver = read("packages/shared/src/catalog/runtime/resolveThemeSnapshot.ts");
    if (/(both|put)\(\s*["`]--tint["`]/.test(resolver)) hits.push("resolver --tint");
    if (/--color-neutral-/.test(resolver)) hits.push("resolver --color-neutral-N");
    expect(hits).toEqual([]);
  });

  it("3. hover = pressed · 기본에서 한 단 (예외 = design-data 상태 alias oracle · S2 Button `*-fill` 명시 단)", () => {
    /** 이름이 `<x>-hover` 가 아닌 짝 — 밝은 바탕 `neutral-subtle` 의 상태 (ADR-293 결정 4). */
    const BASE_OF: Readonly<Record<string, string>> = {
      "neutral-hover": "neutral-subtle",
      "neutral-pressed": "neutral-subtle",
    };
    const ladderSteps = (entry: ColorAliasEntry, mode: "light" | "dark") => {
      const family = (
        entry.axis === "tone"
          ? "gray"
          : entry.axis === "accent"
            ? "blue"
            : entry.family
      ) as SpectrumLadderFamily;
      return Object.keys(SPECTRUM_LADDERS[family][mode])
        .map(Number)
        .sort((a, b) => a - b);
    };
    const out: string[] = [];
    for (const [key, entry] of Object.entries(COLOR_ALIASES)) {
      const m = /^(.*)-(hover|pressed)$/.exec(key);
      if (!m) continue;
      const base = COLOR_ALIASES[BASE_OF[key] ?? m[1]!];
      if (!base) {
        out.push(`${key}: 기본 역할 없음`);
        continue;
      }
      const twin =
        COLOR_ALIASES[`${m[1]}-${m[2] === "hover" ? "pressed" : "hover"}`];
      for (const mode of MODES) {
        if (twin && twin[mode] !== entry[mode])
          out.push(`${key} ${mode}: hover ≠ pressed`);
        if (entry.oracle || /-fill-(hover|pressed)$/.test(key)) continue;
        const steps = ladderSteps(base, mode);
        const next = steps[steps.indexOf(base[mode] as number) + 1];
        if (entry[mode] !== next)
          out.push(
            `${key} ${mode}: ${base[mode]} → ${entry[mode]} (다음 단 ${next})`,
          );
      }
    }
    expect(out).toEqual([]);
  });

  it("4. tone 축 단 범위 — 층 25 ~ 100 · 면 · 테두리 100 ~ 400 · 글자 · 진한 면 600 ~ 1000 (tone 역할 전부 분류)", () => {
    const CLASSES: Record<
      string,
      { range: [number, number]; roles: string[] }
    > = {
      layer: {
        range: [25, 100],
        roles: [
          "base",
          "layer-1",
          "layer-2",
          "elevated",
          "pasteboard",
          "popover-background",
          "picker-checkbox-base",
          "on-neutral",
        ],
      },
      surface: {
        range: [100, 400],
        roles: [
          "neutral-subtle",
          "neutral-hover",
          "neutral-pressed",
          "neutral-surface",
          "neutral-surface-hover",
          "neutral-outline",
          "neutral-outline-hover",
          "border",
          "border-hover",
          "border-disabled",
          "disabled",
          "disabled-content",
          "picker-background",
          "picker-background-hover",
          "picker-content-disabled",
          "popover-outline",
          "collection-item-focus",
          "gray-subtle",
        ],
      },
      content: {
        range: [600, 1000],
        roles: [
          "neutral",
          "neutral-content",
          "neutral-content-hover",
          "neutral-subdued",
          "field-placeholder",
          "neutral-fill",
          "neutral-fill-hover",
          "neutral-fill-pressed",
          "picker-content",
          "picker-content-hover",
          "gray-1000",
        ],
      },
      // named hue `gray` 의 면 — design-data `gray-background-color-default` (700 · 500) 와 그 다음 단 (3 이 잰다)
      hueFace: {
        range: [500, 900],
        roles: ["gray", "gray-hover", "gray-pressed"],
      },
    };
    const classOf = new Map<string, [number, number]>();
    for (const c of Object.values(CLASSES))
      for (const role of c.roles) classOf.set(role, c.range);
    const out: string[] = [];
    for (const [key, entry] of Object.entries(COLOR_ALIASES)) {
      if (entry.axis !== "tone") continue;
      const range = classOf.get(key);
      if (!range) {
        out.push(`${key}: 분류 없음`);
        continue;
      }
      for (const mode of MODES) {
        const step = entry[mode];
        if (typeof step !== "number") continue;
        if (step < range[0] || step > range[1])
          out.push(`${key} ${mode} ${step} ∉ ${range[0]} ~ ${range[1]}`);
      }
    }
    expect(out).toEqual([]);
  });

  it("5. 고정 hex 금지 — 문자열 단은 constant 축 또는 완전 투명만", () => {
    const out: string[] = [];
    for (const [key, entry] of Object.entries(COLOR_ALIASES))
      for (const mode of MODES) {
        const step = entry[mode];
        if (typeof step !== "string" || entry.axis === "constant") continue;
        if (!/^#[0-9a-f]{6}00$/i.test(step)) out.push(`${key} ${mode} ${step}`);
      }
    expect(out).toEqual([]);
  });
});
