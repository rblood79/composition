/**
 * ADR-295 Phase 0 — `app-pages` 생성기 fixture (22 페이지) 의 규모 (R4 · 사용자 결정 6 재료).
 *
 * 합성물이라 **규모 전용** (measurement-validity Q1): rule 높이를 쓰는 type 의 노드 중 명시
 * `sizing.height` 가 없는 노드 **수 상한** 만 센다. 비율 · 평균 Δpx 는 인용하지 않는다.
 *
 *   BUILDER_URL=http://localhost:5175 node apps/builder/scripts/adr295-fixture-scale.mjs <out.json>
 */
import { createRequire } from "node:module";
import { writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createInstrumentedContext,
  createIsolatedProject,
  loadStorageState,
  seedDocument,
} from "./perf-baseline.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(join(here, "../package.json"));
const { chromium } = require("playwright");
const baseUrl = process.env.BUILDER_URL ?? "http://localhost:5175";
const out = resolve(process.argv[2] ?? "fixture-scale.json");

const browser = await chromium.launch();
const storageState = loadStorageState(join(here, ".auth-session.json"), baseUrl);
const { page, context } = await createInstrumentedContext(browser, { storageState, frameCapture: false });
await createIsolatedProject(page, baseUrl);
await seedDocument(page, 0, "app-pages");
await page.waitForTimeout(1500);

const result = await page.evaluate(() => {
  const g = window.__COMPOSITION_CATALOG__.workspace.runtime.graph;
  const project = g.getEntry(g.projectId);
  const seen = new Set();
  const nodes = [];
  const visit = (id) => {
    if (!id || seen.has(id)) return;
    seen.add(id);
    const e = g.getEntry(id);
    if (!e) return;
    if (e.kind === "node") nodes.push(e);
    for (const c of e.children ?? []) visit(c);
  };
  for (const p of project.pageIds ?? []) visit(p);
  const sample = nodes.slice(0, 2).map((e) => ({ keys: Object.keys(e), def: g.getEntry(e.definitionId) && Object.keys(g.getEntry(e.definitionId)), defId: e.definitionId }));
  const byType = {};
  for (const e of nodes) {
    const def = g.getEntry(e.definitionId);
    const type = def?.componentType ?? def?.type ?? def?.name ?? String(e.definitionId);
    const explicit = e.sizing?.height !== undefined && e.sizing?.height !== "auto";
    const row = (byType[type] ??= { total: 0, noExplicitHeight: 0 });
    row.total++;
    if (!explicit) row.noExplicitHeight++;
  }
  return { pages: (project.pageIds ?? []).length, nodes: nodes.length, sample, byType };
});
await context.close();
await browser.close();
writeFileSync(out, JSON.stringify(result, null, 2));
console.log(`pages ${result.pages} · nodes ${result.nodes} → ${out}`);
console.log("sample keys", JSON.stringify(result.sample));
console.table(result.byType);
