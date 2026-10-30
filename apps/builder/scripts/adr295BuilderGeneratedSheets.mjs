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

/**
 * `var(--x[, fallback])` 를 root 값 (없으면 fallback) 으로 — fallback 은 괄호 짝까지 읽는다 (ADR-295 Phase 3c:
 * `var(pin, calc(var(--text-sm) * var(--text-sm--line-height)))` 처럼 행간 비율 변수가 다시 `calc()` 를 든다).
 */
function substitute(rootVars, value, depth = 0) {
  if (depth > 12) return value;
  let out = "";
  for (let i = 0; i < value.length;) {
    const m = /^var\(\s*(--[\w-]+)\s*/.exec(value.slice(i));
    if (!m) {
      out += value[i++];
      continue;
    }
    let j = i + m[0].length;
    let fb;
    if (value[j] === ",") {
      let level = 0;
      let k = j + 1;
      for (; k < value.length; k++) {
        if (value[k] === "(") level++;
        else if (value[k] === ")") {
          if (level === 0) break;
          level--;
        }
      }
      fb = value.slice(j + 1, k).trim();
      j = k;
    }
    if (value[j] !== ")") {
      out += value[i++];
      continue;
    }
    const name = m[1];
    out +=
      rootVars[name] !== undefined
        ? rootVars[name]
        : fb !== undefined
          ? fb
          : `var(${name})`;
    i = j + 1;
  }
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
export const BUILDER_CATALOG_PINS_CSS = join(
  stylesDir,
  "builder-catalog-pins.css",
);

const contextOf = (rule) => {
  const ctx = [];
  for (let p = rule.parent; p && p.type === "atrule"; p = p.parent)
    ctx.unshift(`@${p.name} ${p.params}`);
  return ctx.join(" › ") || "-";
};

/**
 * `pinFiles` (ADR-295 Phase 3c-2) = 생성 시트에서 사라진 선언을 빌더만 유지하는 시트. 각 선언은 같은 조건 ·
 * 선택자의 블록을 가진 생성 시트 하나의 entry 로 덮어쓴다 (빌더가 생성 시트 뒤에 싣는다). 그 블록이 없거나
 * 둘 이상이면 던진다 — 고정할 자리가 사라진 선언이다. `pins` = 덮어쓴 key → 생성 시트만의 값 (없으면 undefined).
 */
export function resolveBuilderGeneratedSheets(rootFiles, pinFiles = []) {
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
      const key = `${rel} › ${contextOf(rule)} › ${rule.selector.replace(/\s+/g, " ")} | ${d.prop}`;
      entries[key] = remToPx(substitute(rootVars, d.value));
    });
  }

  const blocks = new Map();
  for (const key of Object.keys(entries)) {
    const [block] = key.split(" | ");
    const [rel, ...rest] = block.split(" › ");
    const at = rest.join(" › ");
    blocks.set(at, new Set([...(blocks.get(at) ?? []), rel]));
  }
  const pins = {};
  for (const file of pinFiles) {
    const root = postcss.parse(readFileSync(file, "utf8"), { from: file });
    root.walkDecls((d) => {
      const rule = d.parent;
      if (rule.type !== "rule") return;
      // (the pin's `/publish` exclusion is not part of the generated selector; a long pin selector may be
      //   wrapped by the formatter — `:is(\n  a,\n  b\n)` — so the spaces inside brackets go first)
      const selector = rule.selector
        .replace(/\s+/g, " ")
        .replace(/\(\s+/g, "(")
        .replace(/\s+\)/g, ")")
        .replace(/:not\(:where\(\.publish-app \*\)\)/g, "");
      const at = `${contextOf(rule)} › ${selector}`;
      const owners = [...(blocks.get(at) ?? [])];
      if (owners.length !== 1)
        throw new Error(
          `ADR-295 builder pin without one generated block (${owners.length}): ${at} | ${d.prop}`,
        );
      const key = `${owners[0]} › ${at} | ${d.prop}`;
      pins[key] = entries[key];
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
    pins,
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
  for (let i = 0; i < value.length;) {
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
  if (
    prop === "line-height" &&
    /^\d*\.?\d+(e-?\d+)?$/.test(out) &&
    fontPx !== undefined
  )
    out = `${Math.round(Number(out) * fontPx * 1000) / 1000}px`;
  return out;
}

/**
 * ADR-295 Phase 3c-3b — 크기별 실효 값: 한 시트 안에서 선언 · 소비되는 지역 변수 (`--sf-input-pad` …) 를 읽는
 * 선언은 크기 블록 (`.react-aria-X[data-size="S"]`, 없으면 기본 블록) 의 값으로 풀어 크기마다 한 entry
 * (`<block> @S | prop`) 로, `padding` · `margin` 단축형과 `*-inline-start · end` 는 네 변으로 펼친다. 지역 변수
 * 선언 자체는 뺀다 — 그 효과는 읽는 선언이 비교한다. 이름을 바꾼 선언 · 변수도 빌더가 받는 값으로 비교된다.
 */
export function effectiveEntries(entries) {
  const SIZE = /^(\.react-aria-[\w-]+)\[data-size="(\w+)"\]$/;
  const parse = (key) => {
    const [block, prop] = key.split(" | ");
    const parts = block.split(" › ");
    return { block, prop, rel: parts[0], selector: parts[parts.length - 1] };
  };
  const sizeVars = {};
  const baseVars = {};
  const read = new Set();
  for (const [key, value] of Object.entries(entries)) {
    const { prop, rel, selector } = parse(key);
    for (const m of value.matchAll(/var\((--[\w-]+)/g))
      read.add(`${rel} ${m[1]}`);
    if (!prop.startsWith("--")) continue;
    const size = SIZE.exec(selector);
    if (size) ((sizeVars[rel] ??= {})[size[2]] ??= {})[prop] = value;
    else if (/^\.react-aria-[\w-]+$/.test(selector))
      (baseVars[rel] ??= {})[prop] = value;
  }
  const local = (rel, name) =>
    Object.values(sizeVars[rel] ?? {}).some((vars) => name in vars) ||
    name in (baseVars[rel] ?? {});
  const substitute = (rel, size, value, depth = 0) =>
    depth > 4
      ? value
      : value.replace(/var\((--[\w-]+)(?:,\s*([^()]*))?\)/g, (whole, name) => {
          const next = sizeVars[rel]?.[size]?.[name] ?? baseVars[rel]?.[name];
          return next === undefined
            ? whole
            : substitute(rel, size, next, depth + 1);
        });
  const SIDES = ["top", "right", "bottom", "left"];
  const expand = (prop, value) => {
    const box = /^(padding|margin)$/.exec(prop);
    if (box) {
      // (top-level whitespace only — a side may be a `calc(…)` with nested parentheses)
      const parts = [];
      let depth = 0;
      let current = "";
      for (const char of value.trim()) {
        if (char === "(") depth++;
        else if (char === ")") depth--;
        if (/\s/.test(char) && depth === 0) {
          if (current) parts.push(current);
          current = "";
        } else current += char;
      }
      if (current) parts.push(current);
      const [t, r = t, b = t, l = r] = parts;
      return SIDES.map((side, i) => [`${prop}-${side}`, [t, r, b, l][i]]);
    }
    const inline = /^(padding|margin)-inline-(start|end)$/.exec(prop);
    if (inline)
      return [
        [`${inline[1]}-${inline[2] === "start" ? "left" : "right"}`, value],
      ];
    return [[prop, value]];
  };
  const out = {};
  for (const [key, value] of Object.entries(entries)) {
    const { block, prop, rel, selector } = parse(key);
    const size = SIZE.exec(selector);
    if (prop.startsWith("--") && local(rel, prop) && read.has(`${rel} ${prop}`))
      continue;
    const names = [...value.matchAll(/var\((--[\w-]+)/g)].map((m) => m[1]);
    const sizes = names.some((name) => local(rel, name))
      ? size
        ? [size[2]]
        : Object.keys(sizeVars[rel] ?? {})
      : [undefined];
    for (const at of sizes.length ? sizes : [undefined]) {
      const resolved = at ? substitute(rel, at, value) : value;
      const where = at && !size ? `${block} @${at}` : block;
      for (const [side, sideValue] of expand(prop, resolved))
        out[`${where} | ${side}`] = sideValue;
    }
  }
  return out;
}

/** 각 entry 의 `normalizeDimension` 값 (`line-height` 는 같은 블록의 `font-size`). */
export function normalizedEntries(entries) {
  const out = {};
  for (const [key, value] of Object.entries(entries)) {
    const [block, prop] = key.split(" | ");
    const font =
      entries[`${block} | font-size`] ??
      entries[`${block.replace(/ @\w+$/, "")} | font-size`];
    const fontPx =
      font !== undefined &&
      /^\d*\.?\d+px$/.test(normalizeDimension("font-size", font))
        ? Number.parseFloat(normalizeDimension("font-size", font))
        : undefined;
    out[key] = normalizeDimension(prop, value, fontPx);
  }
  return out;
}
