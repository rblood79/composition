/**
 * ADR-295 — 빌더가 싣는 생성 시트 (`builder-components.css` 의 `generated/*.css` import) 의 모든 치수
 * 선언을 빌더 root 변수값으로 풀어 `파일 › 조건 › 선택자 | 속성 → 값` 맵으로 만든다. Phase 0 기준 JSON
 * (`adr295-builder-generated-baseline.mjs`) 과 Decision 9 게이트 (c) (`builderCatalogVars.static.test.ts`)
 * 가 같은 계산을 쓴다. `rootFiles` = `:root` 변수를 모을 시트 (import 를 따라간다).
 */
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, "../../..");
const require = createRequire(join(repo, "apps/builder/package.json"));
const postcss = require("postcss");

const stylesDir = join(repo, "packages/shared/src/components/styles");
const NON_DIMENSION =
  /color|background|shadow|fill|stroke|transition|animation|font-family|content|cursor|filter|opacity|z-index|font-weight|display|position|flex$|order|grid-template|visibility|pointer-events|user-select|white-space|text-|overflow|align|justify|appearance|outline-style|border-style|box-sizing|direction|forced-color/;

/** theme.css 부터 @import 를 따라가며 `:root` (·`:host`) 의 custom property 를 모은다. */
function collectRootVars(file, vars = {}, seen = new Set()) {
  if (seen.has(file)) return vars;
  seen.add(file);
  const root = postcss.parse(readFileSync(file, "utf8"), { from: file });
  root.walkAtRules("import", (at) => {
    const m = /["']([^"']+\.css)["']/.exec(at.params);
    if (m && !m[1].startsWith("http"))
      collectRootVars(resolve(dirname(file), m[1]), vars, seen);
  });
  root.walkRules((rule) => {
    if (rule.parent?.type === "atrule" && rule.parent.name === "media") return;
    if (!/(^|,)\s*(:root|:host|:where\(:root)/.test(rule.selector)) return;
    rule.walkDecls((d) => {
      if (d.prop.startsWith("--")) vars[d.prop] = d.value.trim();
    });
  });
  return vars;
}

function substitute(rootVars, value, depth = 0) {
  if (depth > 12) return value;
  const out = value.replace(
    /var\(\s*(--[\w-]+)\s*(?:,\s*([^()]*(?:\([^()]*\))?[^()]*))?\)/g,
    (_, name, fb) =>
      rootVars[name] !== undefined
        ? rootVars[name]
        : fb !== undefined
          ? fb.trim()
          : `var(${name})`,
  );
  return out === value ? out : substitute(rootVars, out, depth + 1);
}
const remToPx = (v) =>
  v.replace(
    /(-?\d*\.?\d+)rem\b/g,
    (_, n) => `${Math.round(Number(n) * 16 * 1000) / 1000}px`,
  );

export const THEME_CSS = join(repo, "packages/shared/src/components/theme.css");
export const BUILDER_CATALOG_VARS_CSS = join(
  stylesDir,
  "builder-catalog-vars.css",
);
export const BUILDER_COMPONENTS_CSS = join(stylesDir, "builder-components.css");

export function resolveBuilderGeneratedSheets(rootFiles) {
  const rootVars = {};
  const seen = new Set();
  for (const file of rootFiles) collectRootVars(file, rootVars, seen);
  const imports = [
    ...readFileSync(join(stylesDir, "builder-components.css"), "utf8").matchAll(
      /@import\s+"\.\/(generated\/[\w-]+\.css)"/g,
    ),
  ].map((m) => m[1]);

  const entries = {};
  for (const rel of imports) {
    const file = join(stylesDir, rel);
    const root = postcss.parse(readFileSync(file, "utf8"), { from: file });
    root.walkDecls((d) => {
      if (NON_DIMENSION.test(d.prop)) return;
      if (!/\d|var\(/.test(d.value)) return;
      const rule = d.parent;
      if (rule.type !== "rule") return;
      const ctx = [];
      for (let p = rule.parent; p && p.type === "atrule"; p = p.parent)
        ctx.unshift(`@${p.name} ${p.params}`);
      const key = `${rel} › ${ctx.join(" › ") || "-"} › ${rule.selector.replace(/\s+/g, " ")} | ${d.prop}`;
      entries[key] = remToPx(substitute(rootVars, d.value));
    });
  }

  // 시트 안에서 선언되는 지역 변수 (`--nf-btn-size` 등) 는 그 선언 자체가 entry 라 미해결이 아니다.
  const localVars = new Set(
    Object.keys(entries)
      .map((k) => k.split(" | ")[1])
      .filter((p) => p.startsWith("--")),
  );
  const external = (v) =>
    [...v.matchAll(/var\((--[\w-]+)/g)]
      .map((m) => m[1])
      .filter((n) => !localVars.has(n));

  return {
    sheets: imports,
    rootVarCount: Object.keys(rootVars).length,
    unresolvedExternal: [
      ...new Set(Object.values(entries).flatMap(external)),
    ].sort(),
    entries,
  };
}

/**
 * 비교용 정규화 (ADR-295 Phase 3): `calc()` 산술 (px · 수) 을 값으로 풀고, 단위 없는 `line-height` 는 같은
 * 블록의 `font-size` (px) 를 곱해 px 로 — 생성 시트의 S2 padding 식 · 행간 토큰 비율이 295 전 px 리터럴과 같은
 * 계산값인지 본다. 풀 수 없는 값은 그대로 (문자열 비교).
 */
export function normalizeDimension(prop, value, fontPx) {
  let out = "";
  for (let i = 0; i < value.length; ) {
    if (!value.startsWith("calc(", i)) {
      out += value[i++];
      continue;
    }
    // 짝 괄호까지 (안쪽 calc 포함) 를 한 식으로 — 끝에서만 반올림한다
    let depth = 0;
    let j = i + 4;
    for (; j < value.length; j++) {
      if (value[j] === "(") depth++;
      else if (value[j] === ")" && --depth === 0) break;
    }
    const whole = value.slice(i, j + 1);
    const expr = whole.slice(5, -1).replace(/calc\(/g, "(");
    const px = /px/.test(expr);
    const js = expr.replace(/(-?\d*\.?\d+)px/g, "$1");
    let n = Number.NaN;
    if (/^[\d.\s+\-*/()]+$/.test(js))
      n = Function(`"use strict"; return (${js});`)();
    out += Number.isFinite(n)
      ? `${px ? Math.round(n * 1000) / 1000 : n}${px ? "px" : ""}`
      : whole;
    i = j + 1;
  }
  if (prop === "line-height" && /^\d*\.?\d+(e-?\d+)?$/.test(out) && fontPx !== undefined)
    out = `${Math.round(Number(out) * fontPx * 1000) / 1000}px`;
  return out;
}

/** 각 entry 의 `normalizeDimension` 값 (`line-height` 는 같은 블록의 `font-size`). */
export function normalizedEntries(entries) {
  const out = {};
  for (const [key, value] of Object.entries(entries)) {
    const [block, prop] = key.split(" | ");
    const font = entries[`${block} | font-size`];
    const fontPx =
      font !== undefined && /^\d*\.?\d+px$/.test(normalizeDimension("font-size", font))
        ? Number.parseFloat(normalizeDimension("font-size", font))
        : undefined;
    out[key] = normalizeDimension(prop, value, fontPx);
  }
  return out;
}
