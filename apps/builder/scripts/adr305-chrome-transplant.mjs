/**
 * ADR-305 Phase 2 · 3 — 빌더 chrome 시트 이식기.
 *
 *   node apps/builder/scripts/adr305-chrome-transplant.mjs <builder-base snapshot dir> [--write]
 *
 * 빌더 문서에서 빠질 시트 (`builder-components.css` 그래프 중 빌더 전용 4장 · 변수 고정 시트 제외) 의 스타일
 * 규칙 가운데, 분리 직전 빌더 화면 (Phase 0 기준값의 선택자 계수 — 상태 조건을 걷어낸 상위집합) 에 하나라도
 * 맞은 것을 `apps/builder/src/builder/styles/widgets/` 로 옮긴다.
 *
 * - 범위: 선택자마다 첫 compound 에 `:where([data-document="builder"], [data-document="builder"] *)` —
 *   특이도 0 이라 옮긴 규칙끼리 · 빌더 시트와의 우선순위가 그대로다. `:root:not(:has(.publish-app))` (빌더 고정
 *   시트의 Publish 예외, 특이도 (0,2,0)) 는 같은 특이도의 `:root[data-document="builder"]` 로,
 *   `:not(:where(.publish-app *))` (특이도 0) 는 지운다 — Publish 가 다른 문서가 된 뒤 항상 참이던 조건이다.
 * - layer: 원래 layer 그대로 (`components` · `utilities` · layer 밖). 순서: 원래 시트 · 규칙 순서.
 * - 값: `var(--catalog-token-*)` 는 빌더 root 고정값 (`builder-catalog-vars.css`) 으로 푼다. 다른 변수는
 *   그대로 — 빌더 테마 (`builder-system.css` · 공유 원시 변수) 가 계속 정의한다.
 * - 조건부 규칙: 사용자 선호 `@media` (`forced-colors` · `prefers-reduced-motion`) 와 `@supports` 는 같은 조건으로
 *   옮긴다 (빌더 위젯의 접근성 경로 유지). 그 밖의 `@media` (폭 · pointer — 기기에 따라 빌더 크기가 바뀌는 것) 는
 *   옮기지 않고 목록으로 낸다 (G1 — ADR-295 Decision 9 (b) 의 「빌더 위젯은 기기와 무관」).
 * - 쓰는 `@keyframes` 는 같이 옮긴다.
 */
import { createRequire } from "node:module";
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join, relative } from "node:path";
import {
  collectRules,
  ENTRIES,
  expandCssGraph,
  repo,
  splitSelectorList,
} from "./adr305Sheets.mjs";

const require = createRequire(join(repo, "apps/builder/package.json"));
const postcss = require("postcss");

const [baseDir, ...flags] = process.argv.slice(2);
const write = flags.includes("--write");
export const KEEP_IN_BUILDER =
  /(ColorArea|ColorSlider|ColorWheel|builder-listbox-section)\.css$/;
const VARS_SHEET = /builder-catalog-vars\.css$/;
const outDir = join(repo, "apps/builder/src/builder/styles/widgets");
const SCOPE = ':where([data-document="builder"], [data-document="builder"] *)';
/** 옮길 수 있는 조건 — 사용자 선호 미디어 · @supports 만 (각 조건마다). */
export const ALLOWED_CONDITION = (media) =>
  media
    .split(" › ")
    .every(
      (c) =>
        /^@supports /.test(c) ||
        /^@media \((forced-colors: active|prefers-reduced-motion: reduce)\)$/.test(
          c,
        ),
    );

// 1. 기준값의 선택자 계수 — 어느 변형 · 화면에서든 맞은 규칙 id
const matched = new Map();
for (const v of readdirSync(baseDir)) {
  if (v.endsWith(".json") || v.endsWith(".log")) continue;
  for (const f of readdirSync(join(baseDir, v))) {
    const snap = JSON.parse(readFileSync(join(baseDir, v, f), "utf8"));
    for (const [id, c] of Object.entries(snap.counts ?? {}))
      if (c.n) matched.set(id, Math.max(matched.get(id) ?? 0, c.n));
  }
}

// 2. 고정값
const graph = expandCssGraph(ENTRIES.builderComponents).filter(
  (s) => !s.external,
);
const varsRules = collectRules(graph.filter((s) => VARS_SHEET.test(s.file)));
const pinned = {};
for (const r of varsRules)
  for (const d of r.decls)
    if (d.prop.startsWith("--catalog-token-")) pinned[d.prop] = d.value;

function substitute(value, depth = 0) {
  if (depth > 12 || !value.includes("--catalog-token-")) return value;
  let out = "";
  for (let i = 0; i < value.length;) {
    const m = /^var\(\s*(--catalog-token-[\w-]+)\s*/.exec(value.slice(i));
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
    const name = m[1];
    if (pinned[name] !== undefined) out += pinned[name];
    else if (fb !== undefined) out += fb;
    else return null; // 정의 없음 · fallback 없음 = 빌더에서 무효였던 선언
    i = j + 1;
  }
  return substitute(out, depth + 1);
}

/** 첫 compound 끝 (pseudo-element 앞) 에 범위를 붙인다. */
function scopePart(part) {
  let p = part
    .replace(/:not\(\s*:where\(\s*\.publish-app \*\s*\)\s*\)/g, "")
    .replace(
      /^:root:not\(\s*:has\(\s*\.publish-app\s*\)\s*\)/,
      ':root[data-document="builder"]',
    );
  if (p.startsWith(':root[data-document="builder"]')) return p;
  let depth = 0;
  let end = p.length;
  for (let i = 0; i < p.length; i++) {
    const ch = p[i];
    if (ch === "(" || ch === "[") depth++;
    else if (ch === ")" || ch === "]") depth--;
    else if (
      depth === 0 &&
      (ch === " " || ch === ">" || ch === "+" || ch === "~")
    ) {
      end = i;
      break;
    }
  }
  let head = p.slice(0, end);
  const tail = p.slice(end);
  const pe = head.search(
    /::?(before|after|placeholder|selection|marker|backdrop|-webkit-[\w-]+|-moz-[\w-]+)\b/,
  );
  const insertAt = pe >= 0 ? pe : head.length;
  head = `${head.slice(0, insertAt)}${SCOPE}${head.slice(insertAt)}`;
  return head + tail;
}

// 3. 옮길 규칙
const removed = graph.filter(
  (s) =>
    !KEEP_IN_BUILDER.test(s.file) &&
    !VARS_SHEET.test(s.file) &&
    !/builder-components\.css$|foundation\.css$/.test(s.file),
);
const rules = collectRules(removed);
const report = {
  moved: 0,
  unmatched: 0,
  media: [],
  invalidDecls: [],
  keyframes: [],
  sheets: {},
};
const bySheet = new Map();
for (const r of rules) {
  if (!matched.has(r.id)) {
    report.unmatched++;
    continue;
  }
  if (r.media && !ALLOWED_CONDITION(r.media)) {
    report.media.push(`${r.id} ${r.media} ${r.selector}`);
    continue;
  }
  const decls = [];
  for (const d of r.decls) {
    const value = substitute(d.value);
    if (value === null) {
      report.invalidDecls.push(`${r.id} ${d.prop}: ${d.value}`);
      decls.push(`${d.prop}: unset${d.important ? " !important" : ""}`);
      continue;
    }
    decls.push(`${d.prop}: ${value}${d.important ? " !important" : ""}`);
  }
  const selector = splitSelectorList(r.selector).map(scopePart).join(",\n");
  (bySheet.get(r.file) ?? bySheet.set(r.file, []).get(r.file)).push({
    r,
    selector,
    decls,
  });
  report.moved++;
}

// 4. keyframes
const keyframes = new Map();
for (const s of removed) {
  const root = postcss.parse(readFileSync(join(repo, s.file), "utf8"));
  root.walkAtRules(/keyframes$/, (at) =>
    keyframes.set(at.params.trim(), { file: s.file, text: at.toString() }),
  );
}
const usedKeyframes = new Set();
for (const list of bySheet.values())
  for (const { decls } of list)
    for (const d of decls)
      if (/^animation(-name)?\s*:/.test(d))
        for (const name of keyframes.keys())
          if (
            new RegExp(`(^|[\\s,:])${name}([\\s,;]|$)`).test(
              d.split(":").slice(1).join(":"),
            )
          )
            usedKeyframes.add(name);
report.keyframes = [...usedKeyframes];

// 5. 출력 — 시트마다 파일 하나, 원래 시트 순서. 빌더 전용 수동 시트 4장은 그 자리에서 원본을 import 한다.
const files = [];
for (const s of graph) {
  if (KEEP_IN_BUILDER.test(s.file)) {
    files.push(relative(outDir, join(repo, s.file)));
    continue;
  }
  const list = bySheet.get(s.file);
  if (!list) continue;
  const name = basename(s.file).replace(/\.css$/, "");
  const fileName = `${s.file.includes("/generated/") ? "generated-" : ""}${name}.css`;
  const groups = [];
  for (const item of list) {
    const layer = item.r.layer ?? "";
    const media = item.r.media ?? "";
    if (
      !groups.length ||
      groups.at(-1).layer !== layer ||
      groups.at(-1).media !== media
    )
      groups.push({ layer, media, items: [] });
    groups.at(-1).items.push(item);
  }
  const body = groups
    .map(({ layer, media, items }) => {
      let block = items
        .map(
          ({ selector, decls }) =>
            `${selector} {\n${decls.map((d) => `  ${d};`).join("\n")}\n}`,
        )
        .join("\n\n");
      for (const cond of media ? media.split(" › ").reverse() : [])
        block = `${cond} {\n${block.replace(/^/gm, "  ").replace(/^ +$/gm, "")}\n}`;
      if (!layer) return block;
      return `@layer ${layer} {\n${block.replace(/^/gm, "  ").replace(/^ +$/gm, "")}\n}`;
    })
    .join("\n\n");
  const frames = [...usedKeyframes]
    .filter((n) => keyframes.get(n).file === s.file)
    .map((n) => keyframes.get(n).text)
    .join("\n\n");
  files.push(fileName);
  report.sheets[fileName] = { from: s.file, rules: list.length };
  const header = `/* ADR-305 — 빌더 chrome 시트. 출처: ${s.file} (분리 직전 빌더 화면에 맞던 규칙 ${list.length} / 원본 그대로의 layer · 순서).
 * 이 파일은 빌더 문서만 싣는다. 사용자 컴포넌트 시트와 서로 따라가지 않는다 (Decision 5) — 빌더 위젯 모양은 여기서 고친다.
 * 범위 = 첫 compound 의 :where([data-document="builder"], …) (특이도 0). 값 = 분리 직전 빌더 값 (catalog 토큰은 그 고정값으로 풀었다). */\n\n`;
  if (write) {
    mkdirSync(outDir, { recursive: true });
    writeFileSync(
      join(outDir, fileName),
      `${header}${body}${frames ? `\n\n${frames}` : ""}\n`,
    );
  }
}
if (write)
  writeFileSync(
    join(outDir, "index.css"),
    `/* ADR-305 — 빌더 chrome 위젯 시트 (원래 builder-components.css 의 시트 순서). main.tsx 가 그 자리에서 싣는다. */\n${files
      .map((f) => `@import "${f.startsWith(".") ? f : `./${f}`}";`)
      .join("\n")}\n`,
  );
console.log(
  JSON.stringify(
    {
      moved: report.moved,
      unmatched: report.unmatched,
      media: report.media.length,
      invalidDecls: report.invalidDecls.length,
      keyframes: report.keyframes,
      files: files.length,
    },
    null,
    1,
  ),
);
writeFileSync(
  join(baseDir, "..", "transplant-report.json"),
  JSON.stringify(report, null, 1),
);
