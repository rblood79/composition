/**
 * ADR-295 Phase 0 — 빌더가 읽는 생성 시트의 치수 기준 JSON (Decision 9 게이트 (c) 의 295 전 기준).
 *
 * `builder-components.css` 가 import 하는 `generated/*.css` 의 모든 치수 선언을 빌더 root 변수값
 * (`theme.css` 가 싣는 시트의 `:root` 선언) 으로 풀어 `파일 › 조건 › 선택자 | 속성 → 값` 으로 적는다.
 * Phase 2 가 `builder-catalog-vars.css` 를 넣은 뒤 같은 계산이 이 JSON 과 같아야 한다.
 *
 *   node apps/builder/scripts/adr295-builder-generated-baseline.mjs <out.json>
 */
import { createRequire } from "node:module";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, "../../..");
const require = createRequire(join(repo, "apps/builder/package.json"));
const postcss = require("postcss");

const stylesDir = join(repo, "packages/shared/src/components/styles");
const NON_DIMENSION = /color|background|shadow|fill|stroke|transition|animation|font-family|content|cursor|filter|opacity|z-index|font-weight|display|position|flex$|order|grid-template|visibility|pointer-events|user-select|white-space|text-|overflow|align|justify|appearance|outline-style|border-style|box-sizing|direction|forced-color/;

/** theme.css 부터 @import 를 따라가며 `:root` (·`:host`) 의 custom property 를 모은다. */
function collectRootVars(file, vars = {}, seen = new Set()) {
  if (seen.has(file)) return vars;
  seen.add(file);
  const root = postcss.parse(readFileSync(file, "utf8"), { from: file });
  root.walkAtRules("import", (at) => {
    const m = /["']([^"']+\.css)["']/.exec(at.params);
    if (m && !m[1].startsWith("http")) collectRootVars(resolve(dirname(file), m[1]), vars, seen);
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

const rootVars = collectRootVars(join(repo, "packages/shared/src/components/theme.css"));

function substitute(value, depth = 0) {
  if (depth > 12) return value;
  const out = value.replace(/var\(\s*(--[\w-]+)\s*(?:,\s*([^()]*(?:\([^()]*\))?[^()]*))?\)/g, (_, name, fb) =>
    rootVars[name] !== undefined ? rootVars[name] : fb !== undefined ? fb.trim() : `var(${name})`,
  );
  return out === value ? out : substitute(out, depth + 1);
}
const remToPx = (v) =>
  v.replace(/(-?\d*\.?\d+)rem\b/g, (_, n) => `${Math.round(Number(n) * 16 * 1000) / 1000}px`);

const imports = [...readFileSync(join(stylesDir, "builder-components.css"), "utf8").matchAll(/@import\s+"\.\/(generated\/[\w-]+\.css)"/g)].map((m) => m[1]);

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
    for (let p = rule.parent; p && p.type === "atrule"; p = p.parent) ctx.unshift(`@${p.name} ${p.params}`);
    const key = `${rel} › ${ctx.join(" › ") || "-"} › ${rule.selector.replace(/\s+/g, " ")} | ${d.prop}`;
    entries[key] = remToPx(substitute(d.value));
  });
}

// 시트 안에서 선언되는 지역 변수 (`--nf-btn-size` 등) 는 그 선언 자체가 entry 라 미해결이 아니다.
const localVars = new Set(Object.keys(entries).map((k) => k.split(" | ")[1]).filter((p) => p.startsWith("--")));
const external = (v) => [...v.matchAll(/var\((--[\w-]+)/g)].map((m) => m[1]).filter((n) => !localVars.has(n));

const out = {
  note: "ADR-295 Phase 0 — 빌더 root 변수값으로 푼 생성 시트 치수 (295 전 기준). key = 파일 › 조건 › 선택자 | 속성",
  sheets: imports,
  rootVarCount: Object.keys(rootVars).length,
  // 빌더 root 에도 시트 안에도 선언이 없는 변수 (색 변수 `--fg` 등은 런타임 테마가 싣는다 — 치수 아님)
  unresolvedExternal: [...new Set(Object.values(entries).flatMap(external))].sort(),
  entries,
};
const path = resolve(process.argv[2] ?? "builder-consumed-generated-baseline.json");
writeFileSync(path, JSON.stringify(out, null, 2));
console.log(`sheets ${imports.length} · entries ${Object.keys(entries).length} → ${path}`);
console.log("unresolved external vars:", out.unresolvedExternal.join(" "));
