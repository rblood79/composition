/**
 * ADR-305 Phase 0 (G0) — 시트 · 규칙 분류표.
 *
 *   node apps/builder/scripts/adr305-classify.mjs <builder-base dir> <preview-base dir> <out.json>
 *
 * 두 문서의 선택자 계수 (상태 조건을 걷어낸 상위집합 — 어떤 상태에서든 맞을 수 있는가) 로 규칙을 나눈다:
 * builder (빌더 화면만) · user (Preview · Publish 만) · both · none. 시트마다 합계와 「생성 시트 중 빌더에
 * 맞는 가족」, 열린 overlay 화면의 portal (`[data-context]` 조상 없음) 요소 수를 낸다.
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { collectRules, ENTRIES, expandCssGraph } from "./adr305Sheets.mjs";

const [builderDir, previewDir, out] = process.argv.slice(2);
const load = (dir) => {
  const hits = new Map();
  const portals = {};
  for (const v of readdirSync(dir)) {
    if (/\.(json|log|png)$/.test(v)) continue;
    for (const f of readdirSync(join(dir, v))) {
      const snap = JSON.parse(readFileSync(join(dir, v, f), "utf8"));
      for (const [id, c] of Object.entries(snap.counts ?? {})) {
        if (!c.n) continue;
        const h = hits.get(id) ?? { n: 0, portal: 0, catalog: 0, screens: 0 };
        h.n = Math.max(h.n, c.n);
        h.portal = Math.max(h.portal, c.portal);
        h.catalog = Math.max(h.catalog, c.catalog);
        h.screens++;
        hits.set(id, h);
      }
      if (snap.portals)
        portals[`${v}/${f}`] = snap.portals.filter(
          (p) => !p.hasContext && p.tag !== "script",
        ).length;
    }
  }
  return { hits, portals };
};
const B = load(builderDir);
const P = load(previewDir);

const builderSheets = expandCssGraph(ENTRIES.builderComponents).filter(
  (s) => !s.external,
);
const themeSheets = expandCssGraph(ENTRIES.theme).filter((s) => !s.external);
const previewSheets = new Set(
  expandCssGraph(ENTRIES.previewIndex)
    .filter((s) => !s.external)
    .map((s) => s.file),
);
const sheets = {};
const rulesOut = [];
for (const s of [...builderSheets, ...themeSheets]) {
  if (sheets[s.file]) continue;
  const rules = collectRules([s]);
  const row = {
    shared: previewSheets.has(s.file),
    rules: rules.length,
    builder: 0,
    user: 0,
    both: 0,
    none: 0,
    catalogBranch: 0,
    media: 0,
  };
  for (const r of rules) {
    // 같은 파일을 Preview 그래프도 같은 줄로 읽으므로 id 가 같다
    const b = B.hits.get(r.id);
    const p = P.hits.get(r.id);
    const kind = b && p ? "both" : b ? "builder" : p ? "user" : "none";
    row[kind]++;
    if (/data-catalog-id/.test(r.selector)) row.catalogBranch++;
    if (r.media) row.media++;
    rulesOut.push({
      id: r.id,
      kind,
      selector: r.selector,
      layer: r.layer,
      media: r.media,
      builderN: b?.n ?? 0,
      userN: p?.n ?? 0,
      builderPortal: b?.portal ?? 0,
    });
  }
  sheets[s.file] = row;
}
const generatedFamilies = Object.entries(sheets)
  .filter(([f, r]) => f.includes("/generated/") && r.builder + r.both > 0)
  .map(([f, r]) => `${f.split("/").pop()} (${r.builder + r.both})`);
writeFileSync(
  out,
  JSON.stringify(
    {
      sheets,
      generatedFamilies,
      builderPortals: B.portals,
      previewPortals: P.portals,
      rules: rulesOut,
    },
    null,
    1,
  ),
);
const sum = (k, pred) =>
  Object.entries(sheets)
    .filter(([f, r]) => pred(f, r))
    .reduce((n, [, r]) => n + r[k], 0);
console.log(
  `generated sheets matching builder: ${generatedFamilies.length}\n  ${generatedFamilies.join("\n  ")}`,
);
const shared = ([f, r]) =>
  r.shared && !f.includes("/generated/") && !/theme\//.test(f);
console.log(
  `shared manual sheets: ${Object.entries(sheets).filter(shared).length} · rules builder ${sum("builder", (f, r) => shared([f, r]))} · user ${sum("user", (f, r) => shared([f, r]))} · both ${sum("both", (f, r) => shared([f, r]))} · none ${sum("none", (f, r) => shared([f, r]))}`,
);
for (const [f, r] of Object.entries(sheets).filter(shared))
  console.log(
    `  ${f.split("/").pop().padEnd(28)} rules ${String(r.rules).padStart(4)} · builder ${r.builder} · user ${r.user} · both ${r.both} · none ${r.none}${r.catalogBranch ? ` · catalog-id ${r.catalogBranch}` : ""}`,
  );
console.log(
  "portal screens (builder):",
  Object.entries(B.portals)
    .filter(([, n]) => n)
    .map(([k, n]) => `${k}:${n}`)
    .join(" "),
);
