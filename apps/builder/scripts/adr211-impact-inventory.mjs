#!/usr/bin/env node
// adr211-impact-inventory.mjs — ADR-211 P0 (G0) 영향 집합 (A)/(B)/(C) 건수.
//
// 로컬 프로젝트는 브라우저 IndexedDB (`composition` — documents / document_heads / document_parts /
// collections) 에만 있다. 빌더 origin 의 페이지에서 그 store 를 읽어 Chart 노드마다 행 수 · 범주 수 ·
// 시리즈 수 · 폭을 세고, breakdown §7 의 세 축으로 분류한다:
//   (A) raw 행 > 200 (Canvas 합계가 바뀐다)   (B) 범주 > fitEff (창/축약/others)   (C) 마크 > M (fitEff 축소)
// fit 은 후보 minSlot 8 / minPointGap 2 / minArc 6 / minAxisGap 12 / minRing 4, M 2,000, 폭은 style.width
// (없으면 640 가정 — 표시). 읽기 전용. 사용: node apps/builder/scripts/adr211-impact-inventory.mjs
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";

const BASE_URL = "http://localhost:5173";
const STORAGE_STATE = resolve("apps/builder/scripts/.auth-session.json");
const OUT_DIR = "/private/tmp/adr211-p0";

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ storageState: JSON.parse(readFileSync(STORAGE_STATE, "utf8")) });
const page = await context.newPage();
try {
  await page.goto(`${BASE_URL}/dashboard`, { waitUntil: "networkidle" });
  const result = await page.evaluate(async () => {
    const open = () => new Promise((res, rej) => { const r = indexedDB.open("composition"); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    const all = (db, store) => new Promise((res, rej) => { const r = db.transaction(store, "readonly").objectStore(store).getAll(); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    const db = await open();
    const stores = [...db.objectStoreNames];
    const [legacy, heads, parts, collections, projects] = await Promise.all([
      all(db, "documents"), all(db, "document_heads"), all(db, "document_parts"),
      stores.includes("collections") ? all(db, "collections") : [], all(db, "projects"),
    ]);
    const grouped = new Map();
    for (const row of parts) { const m = grouped.get(row.project_id) ?? new Map(); m.set(row.key, row.value); grouped.set(row.project_id, m); }
    const join = (m) => { const read = (key) => { const v = m.get(key); if (v === undefined) throw new Error(`missing ${key}`); const r = JSON.parse(v); if (r.children) r.children = r.children.map((id) => read(`node:${id}`)); return r; }; return read("document"); };
    const ids = new Set(heads.map((h) => h.project_id));
    const docs = [
      ...legacy.filter((r) => !ids.has(r.project_id)).map((r) => ({ project_id: r.project_id, document: r.document })),
      ...heads.map((h) => { try { return { project_id: h.project_id, document: join(grouped.get(h.project_id) ?? new Map()) }; } catch (e) { return { project_id: h.project_id, error: String(e) }; } }),
    ];
    const projectName = new Map(projects.map((p) => [p.id, p.name]));
    const tablesByProject = new Map();
    for (const c of collections) { const list = tablesByProject.get(c.project_id) ?? []; list.push(c); tablesByProject.set(c.project_id, list); }
    const rowsOf = (binding, tables) => {
      if (!binding || typeof binding !== "object") return null;
      if (binding.source === "dataTable" && typeof binding.name === "string") {
        const t = tables.find((x) => x.name === binding.name || x.id === binding.name);
        if (!t) return { rows: [], missing: true };
        return { rows: t.useMockData === true ? t.mockData ?? [] : t.runtimeData ?? t.mockData ?? [] };
      }
      if (binding.type === "collection") {
        const cfg = binding.config && typeof binding.config === "object" ? binding.config : {};
        if (binding.source === "static") return { rows: Array.isArray(cfg.data) && cfg.data.length ? cfg.data : Array.isArray(cfg.items) ? cfg.items : [] };
        if (Array.isArray(cfg.runtimeData) && cfg.runtimeData.length) return { rows: cfg.runtimeData };
      }
      return { rows: [] };
    };
    const UNITS = { minSlot: 8, minPointGap: 2, minArc: 6, minAxisGap: 12, minRing: 4 };
    const M = 2000;
    const charts = [];
    const visit = (node, project_id, pageName) => {
      if (!node || typeof node !== "object") return;
      if (node.type === "Chart") {
        const props = node.props ?? {};
        const ext = node["x-composition"] ?? node.extensions ?? {};
        const binding = props.dataBinding ?? ext.dataBinding ?? null;
        const tables = tablesByProject.get(project_id) ?? [];
        const bound = rowsOf(binding, tables);
        const rows = bound && bound.rows.length ? bound.rows : Array.isArray(props.data) ? props.data : [];
        const kind = props.chartType ?? "bar";
        const dim = props.dimension ?? "category";
        const colorField = props.color ?? "series";
        const categories = new Set(), series = new Set();
        for (const r of rows) { if (!r || typeof r !== "object") continue; categories.add(String(r[dim] ?? "")); if (props.dataMode !== "columns") series.add(String(colorField && colorField !== "series" ? r[colorField] ?? "" : r[colorField] ?? "")); }
        const S = props.dataMode === "columns" ? (props.valueFields?.length ?? 1) : Math.max(1, series.size);
        const styleW = props.style?.width ?? node.style?.width;
        const width = typeof styleW === "number" ? styleW : typeof styleW === "string" && /^\d+(px)?$/.test(styleW) ? parseFloat(styleW) : null;
        const styleH = props.style?.height ?? node.style?.height;
        const height = typeof styleH === "number" ? styleH : typeof styleH === "string" && /^\d+(px)?$/.test(styleH) ? parseFloat(styleH) : null;
        const W = width ?? 640, H = height ?? 300;
        const plotW = Math.max(0, W - 24 - 40), plotH = Math.max(0, H - 24 - 24);
        const r = Math.min(plotW, plotH) / 2 - (kind === "radar" ? 24 : 5.5);
        const stacked = props.stackType && props.stackType !== "dodged" && S > 1;
        const n = categories.size;
        let fit;
        if (kind === "bar") fit = Math.floor((props.orientation === "horizontal" ? plotH : plotW) / (stacked ? UNITS.minSlot : UNITS.minSlot * S));
        else if (kind === "line" || kind === "area") fit = Math.floor(plotW / UNITS.minPointGap);
        else if (kind === "pie") fit = Math.floor((2 * Math.PI * r) / UNITS.minArc);
        else if (kind === "radar") fit = Math.floor((2 * Math.PI * r) / UNITS.minAxisGap);
        else fit = Math.floor(r / UNITS.minRing);
        const k = 1 + (props.showValueLabels ? 1 : 0) + ((kind === "line" || kind === "area") && props.showDots ? 1 : 0);
        const fitEff = Math.min(fit, Math.floor(M / (S * k)));
        charts.push({ project: projectName.get(project_id) ?? project_id, page: pageName, id: node.id, kind, binding: binding ? binding.source ?? binding.type ?? "?" : "props.data", rows: rows.length, categories: n, S, k, width: width ?? "(640 가정)", fit, fitEff, marks: S * n * k, A: rows.length > 200, B: n > fitEff, C: S * n * k > M });
      }
      for (const c of node.children ?? []) visit(c, project_id, pageName ?? (node.type === "page" || node.type === "Page" ? node.props?.name ?? node.name ?? node.id : undefined));
    };
    for (const d of docs) if (d.document) for (const c of d.document.children ?? []) visit(c, d.project_id, c.props?.name ?? c.name ?? c.id);
    return { stores, projects: projects.length, documents: docs.length, docErrors: docs.filter((d) => d.error).map((d) => d.error), collections: collections.length, charts };
  });
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(`${OUT_DIR}/impact-inventory.json`, JSON.stringify(result, null, 2));
  const c = result.charts;
  console.log(`projects ${result.projects} · documents ${result.documents} · collections ${result.collections} · charts ${c.length} · docErrors ${result.docErrors.length}`);
  console.log(`(A) rows>200: ${c.filter((x) => x.A).length} · (B) categories>fitEff: ${c.filter((x) => x.B).length} · (C) marks>M: ${c.filter((x) => x.C).length} · 영향 0: ${c.filter((x) => !x.A && !x.B && !x.C).length}`);
  console.log("| project | kind | binding | rows | categories | S | width | fit | fitEff | marks | A | B | C |");
  console.log("| --- | --- | --- | ---: | ---: | --: | --: | --: | --: | --: | :-: | :-: | :-: |");
  for (const x of c) console.log(`| ${x.project} | ${x.kind} | ${x.binding} | ${x.rows} | ${x.categories} | ${x.S} | ${x.width} | ${x.fit} | ${x.fitEff} | ${x.marks} | ${x.A ? "●" : ""} | ${x.B ? "●" : ""} | ${x.C ? "●" : ""} |`);
} finally {
  await browser.close();
}
