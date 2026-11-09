/**
 * ADR-305 — CSS import 그래프를 실제 파일로 펼치고 시트의 규칙을 출처 · layer · 조건과 함께 낸다.
 *
 * - `expandCssGraph(entry)` = `@import` 를 따라간 시트 목록 (먼저 끝난 순 — 문서 cascade 순서).
 *   `node_modules` 패키지 경로 (`pretendard/…`) 는 apps/builder 기준 require 로 해석, `tailwindcss` 같은
 *   bare 패키지 import 는 `external` 로만 적는다 (Tailwind 는 빌더 진입만 싣는다).
 * - `collectRules(files)` = 스타일 규칙 하나마다 `{ id, file, layer, media, selector, decls }`.
 *   `layer` 는 감싼 `@layer` 이름 (중첩은 `.` 로) · `media` 는 감싼 `@media` · `@supports` 조건.
 * - `stripStateSelector(sel)` = 상태 조건 (`:hover` · `[data-hovered]` …) · pseudo-element 를 걷어낸 상위집합
 *   선택자 — 문서의 요소에 「어떤 상태에서든 맞을 수 있는가」 를 `querySelectorAll` 로 세는 용도.
 */
import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
export const repo = resolve(here, "../../..");
const require = createRequire(join(repo, "apps/builder/package.json"));
const postcss = require("postcss");

export const rel = (file) => relative(repo, file);

function resolveImport(fromFile, spec) {
  if (spec.startsWith(".") || spec.startsWith("/"))
    return resolve(dirname(fromFile), spec);
  try {
    return require.resolve(spec);
  } catch {
    return null;
  }
}

/** 진입 CSS 부터 `@import` 를 따라가 시트 목록을 낸다 (cascade 순서). */
export function expandCssGraph(entry, out = [], seen = new Set()) {
  const file = resolve(entry);
  if (seen.has(file)) return out;
  seen.add(file);
  const text = readFileSync(file, "utf8");
  const root = postcss.parse(text, { from: file });
  root.walkAtRules("import", (at) => {
    const m = /^(?:url\()?\s*["']([^"']+)["']\s*\)?\s*(.*)$/.exec(at.params);
    if (!m) return;
    const target = resolveImport(file, m[1]);
    if (!target || !existsSync(target) || !target.endsWith(".css")) {
      out.push({ file: m[1], external: true, importedBy: rel(file) });
      return;
    }
    expandCssGraph(target, out, seen);
  });
  out.push({ file: rel(file) });
  return out;
}

const contextOf = (node) => {
  const layers = [];
  const media = [];
  for (let p = node.parent; p && p.type !== "root"; p = p.parent) {
    if (p.type !== "atrule") continue;
    if (p.name === "layer") layers.unshift(p.params.trim());
    else if (p.name === "media" || p.name === "supports")
      media.unshift(`@${p.name} ${p.params.trim()}`);
  }
  return { layer: layers.join(".") || null, media: media.join(" › ") || null };
};

/**
 * CSS Nesting 을 펼친 선택자 (`.a { &:hover {} }` → `.a:hover`). 부모가 여럿이면 `:is(부모)` — 중첩 규칙의
 * `&` 와 같은 특이도 (부모 목록 중 최대). `&` 가 없는 자식은 부모의 자손.
 */
export function flatSelector(rule) {
  const own = splitSelectorList(rule.selector.replace(/\s+/g, " ").trim());
  let parent = rule.parent;
  while (parent && parent.type === "atrule") parent = parent.parent;
  if (!parent || parent.type !== "rule") return own.join(", ");
  const parents = splitSelectorList(flatSelector(parent));
  const p = parents.length === 1 ? parents[0] : `:is(${parents.join(", ")})`;
  return own
    .map((c) => (c.includes("&") ? c.replaceAll("&", p) : `${p} ${c}`))
    .join(", ");
}

/** 시트 목록의 스타일 규칙 (`@keyframes` 안 프레임 제외). `selector` = 중첩을 펼친 선택자. */
export function collectRules(files) {
  const rules = [];
  for (const entry of files) {
    if (entry.external) continue;
    const file = join(repo, entry.file);
    const root = postcss.parse(readFileSync(file, "utf8"), { from: file });
    root.walkRules((rule) => {
      for (let p = rule.parent; p && p.type !== "root"; p = p.parent)
        if (p.type === "atrule" && /keyframes$/.test(p.name)) return;
      const decls = [];
      rule.each((d) => {
        if (d.type === "decl")
          decls.push({
            prop: d.prop,
            value: d.value,
            important: Boolean(d.important),
          });
      });
      const { layer, media } = contextOf(rule);
      rules.push({
        id: `${entry.file}:${rule.source.start.line}`,
        file: entry.file,
        line: rule.source.start.line,
        layer,
        media,
        selector: flatSelector(rule),
        nested: rule.parent?.type !== "root" && rule.parent?.type === "rule",
        decls,
      });
    });
  }
  return rules;
}

const STATE_ATTRS =
  "hovered|pressed|focus-visible|focused|focus-within|selected|disabled|invalid|open|indeterminate|readonly|required|placeholder|current|empty|entering|exiting|expanded|dragging|drop-target|resizing|selection-mode|allows-dragging|outside-month|outside-visible-range|unavailable|today|selection-start|selection-end|pending|loading";
const STATE_PSEUDO =
  /:(hover|active|focus-visible|focus-within|focus|checked|disabled|enabled|invalid|valid|placeholder-shown|read-only|read-write|required|optional|indeterminate|empty|visited|link|target|first-child|last-child|only-child|first-of-type|last-of-type|user-invalid|user-valid|autofill|-webkit-autofill|open|popover-open|modal|default|in-range|out-of-range|defined)(?![\w-(])/g;

/** 상태 조건 · pseudo-element 를 걷어낸 상위집합 선택자 목록 (쉼표마다 하나). */
export function stripStateSelector(selector) {
  const parts = splitSelectorList(selector);
  return parts.map((s) => {
    let out = s
      .replace(/::[\w-]+\([^()]*\)/g, "")
      .replace(/::[\w-]+/g, "")
      .replace(/:(before|after|placeholder|selection|marker|backdrop)\b/g, "")
      .replace(STATE_PSEUDO, "")
      .replace(
        new RegExp(
          `\\[data-(?:${STATE_ATTRS})(?:[~|^$*]?=(?:"[^"]*"|'[^']*'|[^\\]]*))?\\]`,
          "g",
        ),
        "",
      )
      .replace(/\[aria-[\w-]+(?:[~|^$*]?=(?:"[^"]*"|'[^']*'|[^\]]*))?\]/g, "");
    // 걷어내며 빈 :not() · :is() · :where() 가 남으면 그 괄호째 지운다
    for (let i = 0; i < 4; i++)
      out = out.replace(/:(not|is|where|has)\(\s*(,\s*)*\)/g, "");
    out = out
      .replace(/\s+/g, " ")
      .replace(/([>+~])\s*$/, "")
      .trim();
    if (!out || /^[>+~]/.test(out)) out = "*";
    return out;
  });
}

/** 괄호 · 따옴표 안 쉼표를 지키며 선택자 목록을 나눈다. */
export function splitSelectorList(selector) {
  const parts = [];
  let depth = 0;
  let quote = null;
  let cur = "";
  for (const ch of selector) {
    if (quote) {
      cur += ch;
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") quote = ch;
    else if (ch === "(" || ch === "[") depth++;
    else if (ch === ")" || ch === "]") depth--;
    if (ch === "," && depth === 0) {
      parts.push(cur.trim());
      cur = "";
      continue;
    }
    cur += ch;
  }
  if (cur.trim()) parts.push(cur.trim());
  return parts;
}

export const ENTRIES = {
  builderComponents: join(
    repo,
    "packages/shared/src/components/styles/builder-components.css",
  ),
  theme: join(repo, "packages/shared/src/components/theme.css"),
  previewSystem: join(
    repo,
    "packages/shared/src/components/styles/theme/preview-system.css",
  ),
  previewIndex: join(repo, "packages/shared/src/components/styles/index.css"),
  builderIndex: join(repo, "apps/builder/src/index.css"),
};
