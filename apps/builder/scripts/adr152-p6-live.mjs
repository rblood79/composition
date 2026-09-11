#!/usr/bin/env node
// adr152-p6-live.mjs — ADR-152 Phase 6 (G3) live: publish 탭 (헤더 Preview → sessionStorage snapshot → /publish/)
//   에서 dataTable 바인딩 ListBox · Table 이 snapshot 데이터를 렌더하고, snapshot payload 가 runtimeData 없이
//   schema[].id 를 싣는지. fieldMap value 역할 · `{#id}` 템플릿이 publish 에서도 풀리는지 (템플릿은 정보 — 1b 격차).
// 사용: node apps/builder/scripts/adr152-p6-live.mjs [--headed]
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { waitReady } from "./perf-baseline.mjs";

const BASE_URL = "http://localhost:5173";
const STORAGE_STATE = resolve("apps/builder/scripts/.auth-session.json");
const OUT_DIR = process.env.ADR152_OUT ?? "/private/tmp/adr152-p6";
const headed = process.argv.includes("--headed");
const log = (...a) => console.log("[ADR-152 p6 live]", ...a);
const findings = [];
const record = (name, pass, detail) => { findings.push({ name, pass, detail }); log(`${pass ? "PASS" : "FAIL"} — ${name} :: ${detail}`); };
const RAIL_ORDER = ["navigator", "components", "datatable", "datatableEditor", "theme", "ai", "properties", "styles", "interactions", "history"];
async function setPanel(page, panelId, open) { const b = page.locator(".panel-toggle-rail button").nth(RAIL_ORDER.indexOf(panelId)); if (((await b.getAttribute("aria-pressed")) === "true") !== open) { await b.click(); await page.waitForTimeout(900); } }
const idb = {
  getAll: (page) => page.evaluate(async () => { const db = await new Promise((res, rej) => { const r = indexedDB.open("composition"); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); const rows = await new Promise((res, rej) => { const r = db.transaction("collections", "readonly").objectStore("collections").getAll(); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); db.close(); return rows; }),
  put: (page, row) => page.evaluate(async (row) => { const db = await new Promise((res, rej) => { const r = indexedDB.open("composition"); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); await new Promise((res, rej) => { const tx = db.transaction("collections", "readwrite"); tx.objectStore("collections").put(row); tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); }); db.close(); }, row),
};
async function pollUntil(read, ok, maxMs = 12_000, stepMs = 400) { const s = Date.now(); let last; do { last = await read(); if (ok(last)) return last; await new Promise((r) => setTimeout(r, stepMs)); } while (Date.now() - s < maxMs); return last; }

async function openPublish(page, context) {
  const popupPromise = context.waitForEvent("page", { timeout: 30_000 });
  await page.locator('button[aria-label="Preview"], button[aria-label="미리보기"]').first().click();
  const popup = await popupPromise;
  await popup.waitForLoadState("networkidle");
  const result = await pollUntil(() => popup.evaluate(() => ({
    listKeys: [...document.querySelectorAll(".react-aria-ListBoxItem")].map((n) => n.getAttribute("data-key")).sort(),
    listTexts: [...document.querySelectorAll(".react-aria-ListBoxItem")].map((n) => n.textContent.trim()),
    tableRows: Number(document.querySelector(".react-aria-Table")?.getAttribute("aria-rowcount") ?? 0),
    tableCells: [...document.querySelectorAll(".react-aria-Table [role=gridcell], .react-aria-Table [role=rowheader]")].map((n) => n.textContent.trim()),
    payload: (() => { try { const p = JSON.parse(sessionStorage.getItem("composition-preview-data") ?? "null"); return p ? { collections: p.collections?.map((c) => ({ keys: Object.keys(c).sort(), schemaIds: (c.schema ?? []).map((f) => typeof f.id === "string" && f.id.length > 0) })) } : null; } catch { return null; } })(),
  })), (r) => r.listKeys.length > 0 && r.tableRows > 0, 25_000);
  await popup.screenshot({ path: `${OUT_DIR}/publish.png` }).catch(() => {});
  await popup.close();
  return result;
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
  await input.fill(`adr152-p6-${Date.now()}`); await input.press("Enter");
  await page.waitForURL(/\/builder\/[^/?]+$/, { timeout: 90_000 }); await waitReady(page);
  const projectId = page.url().split("/builder/")[1];
  const collectionId = crypto.randomUUID();
  const rows = [1, 2, 3].map((i) => ({ id: `auto-${i}`, uid: `U-${i}`, name: `User ${i}`, email: `u${i}@x.test` }));
  await idb.put(page, { id: collectionId, name: "Users", project_id: projectId, schema: [{ key: "id", type: "string" }, { key: "uid", type: "string" }, { key: "name", type: "string" }, { key: "email", type: "email" }], mockData: rows, useMockData: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
  await page.reload({ waitUntil: "networkidle" }); await waitReady(page);
  const users = (await idb.getAll(page)).find((c) => c.id === collectionId);
  const fid = Object.fromEntries(users.schema.map((f) => [f.key, f.id]));

  await setPanel(page, "components", true);
  const addByTitle = async (title) => {
    await page.evaluate(() => { const st = window.__composition_STORE__.getState(); st.setSelectedElement(st.elements.find((e) => e.type === "body")?.id ?? null); });
    await page.waitForTimeout(300);
    const b = page.locator(`button.list-item[title="${title}"]`).first(); await b.waitFor({ state: "attached", timeout: 20_000 }); await b.scrollIntoViewIfNeeded();
    const count = () => page.evaluate(() => window.__composition_STORE__.getState().elements.length);
    const before = await count(); await b.click(); await pollUntil(count, (n) => n > before, 15_000, 300); await page.waitForTimeout(800);
    return page.evaluate(() => window.__composition_STORE__.getState().selectedElementId);
  };
  const listBoxId = await addByTitle("Add list box element");
  const tableId = await addByTitle("Add table element");
  await setPanel(page, "components", false);
  await page.evaluate(() => window.__composition_STORE__.getState().setSelectedElement(null));
  await page.evaluate(({ ids, collectionId, fieldMap }) => { const st = window.__composition_STORE__.getState(); for (const id of ids) st.updateElementProps(id, { dataBinding: { source: "dataTable", collectionId, name: "Users", fieldMap } }); }, { ids: [listBoxId, tableId], collectionId, fieldMap: { value: fid.uid } });
  // master slot 템플릿 — 저장형 {#id}
  await page.evaluate((tpl) => window.__composition_STORE__.getState().updateElementProps("component-listbox-item-default__label", { children: tpl }), `{#${fid.name}} <{#${fid.email}}>`);
  await page.waitForTimeout(2000);

  const pub = await openPublish(page, context);
  log("publish", JSON.stringify(pub).slice(0, 600));
  const c0 = pub.payload?.collections?.[0];
  record("G3 snapshot payload: collections 에 runtimeData · project_id · created_at 없음 · schema id 4/4", !!c0 && !c0.keys.includes("runtimeData") && !c0.keys.includes("project_id") && !c0.keys.includes("created_at") && c0.schemaIds.length === 4 && c0.schemaIds.every(Boolean), JSON.stringify(c0));
  record("G3 publish ListBox: 행 3 · key = uid 컬럼 (fieldMap value 역할이 publish 에서도)", JSON.stringify(pub.listKeys) === JSON.stringify(["U-1", "U-2", "U-3"]), JSON.stringify(pub.listKeys));
  record("G3 publish Table: aria-rowcount 3 · 셀에 snapshot 값", pub.tableRows === 3 && pub.tableCells.includes("User 1"), `rows ${pub.tableRows} cells ${JSON.stringify(pub.tableCells.slice(0, 6))}`);
  const tplOk = JSON.stringify(pub.listTexts) === JSON.stringify(rows.map((r) => `${r.name} <${r.email}>`));
  record(`(정보) publish ref ListBox master slot 템플릿 {#id} 보간: ${tplOk ? "보간함" : "미보간 (1b 격차 유지)"}`, true, JSON.stringify(pub.listTexts));
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
