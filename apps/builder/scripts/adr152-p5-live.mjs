#!/usr/bin/env node
// adr152-p5-live.mjs — ADR-152 Phase 5 (legacy 경로 흡수) live: React Query · legacy DataTable store 제거 뒤에도
//   Data 패널 목록 · 새로고침 (store fetch) · ListBox v2 바인딩 Skia/Preview 행 · legacy `{type:"collection", config:{collectionId}}`
//   바인딩이 v2 로 올라가 같은 행을 내는지.
// 사용: node apps/builder/scripts/adr152-p5-live.mjs [--headed]
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { waitReady } from "./perf-baseline.mjs";

const BASE_URL = "http://localhost:5173";
const STORAGE_STATE = resolve("apps/builder/scripts/.auth-session.json");
const OUT_DIR = process.env.ADR152_OUT ?? "/private/tmp/adr152-p5";
const headed = process.argv.includes("--headed");
const log = (...a) => console.log("[ADR-152 p5 live]", ...a);
const findings = [];
const record = (name, pass, detail) => { findings.push({ name, pass, detail }); log(`${pass ? "PASS" : "FAIL"} — ${name} :: ${detail}`); };
const RAIL_ORDER = ["navigator", "components", "datatable", "datatableEditor", "theme", "ai", "properties", "styles", "interactions", "history"];
async function setPanel(page, panelId, open) { const b = page.locator(".panel-toggle-rail button").nth(RAIL_ORDER.indexOf(panelId)); if (((await b.getAttribute("aria-pressed")) === "true") !== open) { await b.click(); await page.waitForTimeout(900); } }
const idbPut = (page, row) => page.evaluate(async (row) => { const db = await new Promise((res, rej) => { const r = indexedDB.open("composition"); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); await new Promise((res, rej) => { const tx = db.transaction("collections", "readwrite"); tx.objectStore("collections").put(row); tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); }); db.close(); }, row);
async function pollUntil(read, ok, maxMs = 12_000, stepMs = 400) { const s = Date.now(); let last; do { last = await read(); if (ok(last)) return last; await new Promise((r) => setTimeout(r, stepMs)); } while (Date.now() - s < maxMs); return last; }
const skiaKeys = (page, ownerId) => page.evaluate((ownerId) => { const map = window.__composition_LAYOUT_DEBUG__?.getSharedLayoutMap?.(); if (!map) return null; const prefix = `projection:listbox-row:${ownerId}:`; return [...map.keys()].filter((k) => k.startsWith(prefix)).map((k) => k.slice(prefix.length)).sort(); }, ownerId);
async function previewListKeys(page) {
  const toggle = page.locator('button[aria-label="Compare Mode (Preview + Skia)"], button[aria-label="비교 모드 (Preview + Skia)"]').first();
  if ((await toggle.count()) && (await toggle.getAttribute("aria-pressed")) !== "true") { await toggle.click(); await page.waitForTimeout(4000); }
  return pollUntil(async () => { for (const f of page.frames()) { if (f === page.mainFrame()) continue; const r = await f.evaluate(() => [...document.querySelectorAll(".react-aria-ListBox .react-aria-ListBoxItem")].map((n) => n.getAttribute("data-key")).sort()).catch(() => null); if (r && r.length) return r; } return null; }, (r) => r && r.length === 3, 25_000);
}

mkdirSync(OUT_DIR, { recursive: true });
const browser = await chromium.launch({ headless: !headed });
const context = await browser.newContext({ storageState: STORAGE_STATE, viewport: { width: 1600, height: 1000 } });
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
try {
  await page.goto(`${BASE_URL}/dashboard`, { waitUntil: "networkidle" });
  await page.locator("button.dashboard-create-button").first().click();
  const input = page.locator("#new-project-name"); await input.waitFor({ state: "visible", timeout: 10_000 });
  await input.fill(`adr152-p5-${Date.now()}`); await input.press("Enter");
  await page.waitForURL(/\/builder\/[^/?]+$/, { timeout: 90_000 }); await waitReady(page);
  const projectId = page.url().split("/builder/")[1];
  const collectionId = crypto.randomUUID();
  await idbPut(page, { id: collectionId, name: "Users", project_id: projectId, schema: [{ key: "id", type: "string" }, { key: "name", type: "string" }], mockData: [1, 2, 3].map((i) => ({ id: `u${i}`, name: `User ${i}` })), useMockData: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
  await page.reload({ waitUntil: "networkidle" }); await waitReady(page);

  // Data 패널 목록 + 새로고침 (store fetch 만)
  await setPanel(page, "datatable", true);
  const listNames = () => page.evaluate(() => [...document.querySelectorAll(".datatable-panel .list-item-name")].map((n) => n.textContent.trim()));
  const names0 = await pollUntil(listNames, (l) => l.includes("Users"));
  record("Data 패널 목록: Users (store fetch)", names0.includes("Users"), JSON.stringify(names0));
  // 다른 창 (IndexedDB 직접) 에서 추가된 collection 이 새로고침으로 보인다
  await idbPut(page, { id: crypto.randomUUID(), name: "Roles", project_id: projectId, schema: [{ key: "role", type: "string" }], mockData: [{ role: "admin" }], useMockData: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
  await page.locator(".datatable-panel button.iconButton").first().click();
  const names1 = await pollUntil(listNames, (l) => l.includes("Roles"), 8_000);
  record("새로고침 → IndexedDB 에 추가된 Roles 가 목록에 (React Query 없이 store fetch)", names1.includes("Roles") && names1.includes("Users"), JSON.stringify(names1));
  const overlay = await page.locator(".datatable-loading-overlay").count();
  record("새로고침 뒤 로딩 오버레이 해제", overlay === 0, `overlay ${overlay}`);
  await setPanel(page, "datatable", false);

  // ListBox — legacy 형식 바인딩 → v2 정규화 → 같은 행
  await setPanel(page, "components", true);
  await page.evaluate(() => { const st = window.__composition_STORE__.getState(); st.setSelectedElement(st.elements.find((e) => e.type === "body")?.id ?? null); });
  const btn = page.locator('button.list-item[title="Add list box element"]').first();
  await btn.waitFor({ state: "attached", timeout: 20_000 }); await btn.scrollIntoViewIfNeeded(); await btn.click();
  await page.waitForTimeout(1500);
  const listBoxId = await page.evaluate(() => window.__composition_STORE__.getState().selectedElementId);
  await setPanel(page, "components", false);
  await page.evaluate(() => window.__composition_STORE__.getState().setSelectedElement(null));
  await page.evaluate(({ id, collectionId }) => window.__composition_STORE__.getState().updateElementProps(id, { dataBinding: { type: "collection", source: "static", config: { collectionId, name: "Users" } } }), { id: listBoxId, collectionId });
  const skiaLegacy = await pollUntil(() => skiaKeys(page, listBoxId), (k) => k && k.length === 3);
  const domLegacy = await previewListKeys(page);
  record("legacy {type:collection, config.collectionId} 바인딩 → v2 정규화 → Skia 행 3 = Preview 행 3", JSON.stringify(skiaLegacy) === JSON.stringify(["u1", "u2", "u3"]) && JSON.stringify(domLegacy) === JSON.stringify(skiaLegacy), `skia ${JSON.stringify(skiaLegacy)} dom ${JSON.stringify(domLegacy)}`);
  await page.evaluate(({ id, collectionId }) => window.__composition_STORE__.getState().updateElementProps(id, { dataBinding: { source: "dataTable", collectionId, name: "Users" } }), { id: listBoxId, collectionId });
  const skiaV2 = await pollUntil(() => skiaKeys(page, listBoxId), (k) => k && k.length === 3);
  record("v2 바인딩 → Skia 행 3 (회귀 0)", JSON.stringify(skiaV2) === JSON.stringify(["u1", "u2", "u3"]), JSON.stringify(skiaV2));
  await page.screenshot({ path: `${OUT_DIR}/final.png` });
  record("page error 0", errors.length === 0, errors.join(" | ") || "none");
} catch (e) {
  record("harness", false, String(e?.stack ?? e));
  await page.screenshot({ path: `${OUT_DIR}/error.png` }).catch(() => {});
} finally {
  writeFileSync(`${OUT_DIR}/findings.json`, JSON.stringify(findings, null, 2));
  const pass = findings.filter((f) => f.pass).length;
  log(`결과 ${pass}/${findings.length} PASS`);
  await browser.close();
  process.exit(pass === findings.length ? 0 : 1);
}
