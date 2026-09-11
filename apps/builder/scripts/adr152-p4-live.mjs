#!/usr/bin/env node
// adr152-p4-live.mjs — ADR-152 Phase 4 패밀리 sweep: Breadcrumbs · ComboBox · GridList · Menu · Tabs · TagGroup · Tree
//   를 같은 collection 에 v2 바인딩 + fieldMap { value: <uid id>, icon: <glyph id> } → Skia 투영 행 key
//   (gridlist · tag · breadcrumb — 캔버스에 행을 그리는 가족) 와 Preview iframe DOM key (7종) 가 uid 컬럼인지.
//   Menu · ComboBox 는 popover 라 iframe 안에서 트리거를 눌러 연다. Tabs · Tree 는 Phase 4 에서 shared 정규화로 옮긴 가족.
// 사용: node apps/builder/scripts/adr152-p4-live.mjs [--headed]
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { waitReady } from "./perf-baseline.mjs";

const BASE_URL = "http://localhost:5173";
const STORAGE_STATE = resolve("apps/builder/scripts/.auth-session.json");
const OUT_DIR = process.env.ADR152_OUT ?? "/private/tmp/adr152-p4";
const headed = process.argv.includes("--headed");
const log = (...a) => console.log("[ADR-152 p4 live]", ...a);
const findings = [];
const record = (name, pass, detail) => { findings.push({ name, pass, detail }); log(`${pass ? "PASS" : "FAIL"} — ${name} :: ${detail}`); };
const RAIL_ORDER = ["navigator", "components", "datatable", "datatableEditor", "theme", "ai", "properties", "styles", "interactions", "history"];
async function setPanel(page, panelId, open) {
  const button = page.locator(".panel-toggle-rail button").nth(RAIL_ORDER.indexOf(panelId));
  if (((await button.getAttribute("aria-pressed")) === "true") !== open) { await button.click(); await page.waitForTimeout(900); }
}
const idb = {
  async getAll(page) { return page.evaluate(async () => { const db = await new Promise((res, rej) => { const r = indexedDB.open("composition"); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); const rows = await new Promise((res, rej) => { const r = db.transaction("collections", "readonly").objectStore("collections").getAll(); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); db.close(); return rows; }); },
  async put(page, row) { return page.evaluate(async (row) => { const db = await new Promise((res, rej) => { const r = indexedDB.open("composition"); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); await new Promise((res, rej) => { const tx = db.transaction("collections", "readwrite"); tx.objectStore("collections").put(row); tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); }); db.close(); }, row); },
};
async function pollUntil(read, ok, maxMs = 12_000, stepMs = 400) { const started = Date.now(); let last; do { last = await read(); if (ok(last)) return last; await new Promise((r) => setTimeout(r, stepMs)); } while (Date.now() - started < maxMs); return last; }
const skiaKeys = (page, family, ownerId) => page.evaluate(({ family, ownerId }) => { const map = window.__composition_LAYOUT_DEBUG__?.getSharedLayoutMap?.(); if (!map) return null; const prefix = `projection:${family}-row:${ownerId}:`; return [...map.keys()].filter((k) => k.startsWith(prefix)).map((k) => k.slice(prefix.length)).filter((k) => k !== "__header__").sort(); }, { family, ownerId });
const EXPECT = ["U-1", "U-2", "U-3"];
const same = (a) => JSON.stringify(a) === JSON.stringify(EXPECT);

async function previewFrame(page) {
  const toggle = page.locator('button[aria-label="Compare Mode (Preview + Skia)"], button[aria-label="비교 모드 (Preview + Skia)"]').first();
  if ((await toggle.count()) && (await toggle.getAttribute("aria-pressed")) !== "true") { await toggle.click(); await page.waitForTimeout(4000); }
  for (let i = 0; i < 30; i += 1) {
    for (const f of page.frames()) { if (f === page.mainFrame()) continue; const ok = await f.evaluate(() => document.querySelectorAll("[data-element-id]").length > 0).catch(() => false); if (ok) return f; }
    await page.waitForTimeout(500);
  }
  return null;
}
/** iframe 안 요소별 DOM key — 필요하면 트리거를 눌러 popover 를 연다. */
async function readDomKeys(frame, ids) {
  const keysOf = (root, sel) => [...root.querySelectorAll(sel)].map((n) => n.getAttribute("data-key")).filter(Boolean).sort();
  const out = {};
  out.gridList = await frame.evaluate(({ id }) => { const r = document.querySelector(`[data-element-id="${id}"]`)?.closest(".react-aria-GridList") ?? document.querySelector(".react-aria-GridList"); return r ? [...r.querySelectorAll(".react-aria-GridListItem")].map((n) => n.getAttribute("data-key")).sort() : null; }, { id: ids.gridList });
  out.tagGroup = await frame.evaluate(() => { const r = document.querySelector(".react-aria-TagGroup"); return r ? [...r.querySelectorAll(".react-aria-Tag")].map((n) => n.getAttribute("data-key")).sort() : null; });
  // RAC Breadcrumb <li> 는 data-key 를 내지 않는다 — 라벨 (name 휴리스틱) 로 행 대조
  out.breadcrumbs = await frame.evaluate(() => { const r = document.querySelector(".react-aria-Breadcrumbs"); return r ? [...r.querySelectorAll(".react-aria-Breadcrumb")].map((n) => n.textContent.trim()).sort() : null; });
  out.tabs = await frame.evaluate(() => { const r = document.querySelector(".react-aria-Tabs"); return r ? [...r.querySelectorAll(".react-aria-Tab")].map((n) => n.getAttribute("data-key")).sort() : null; });
  out.tree = await frame.evaluate(() => { const r = document.querySelector(".react-aria-Tree"); return r ? [...r.querySelectorAll(".react-aria-TreeItem")].map((n) => n.getAttribute("data-key")).sort() : null; });
  // Menu — 트리거 클릭 → [role=menuitem]
  try {
    const trigger = frame.locator(".react-aria-MenuTrigger button, button[aria-haspopup='menu'], button[aria-haspopup='true']").first();
    if (await trigger.count()) { await trigger.click(); await frame.waitForTimeout(600); out.menu = await frame.evaluate(() => [...document.querySelectorAll(".react-aria-Menu .react-aria-MenuItem, [role=menuitem]")].map((n) => n.getAttribute("data-key")).filter(Boolean).sort()); await frame.page().keyboard.press("Escape"); await frame.waitForTimeout(300); }
  } catch (e) { out.menuError = String(e).slice(0, 120); }
  // ComboBox — 버튼 클릭 → [role=option]
  try {
    const btn = frame.locator(".react-aria-ComboBox button").first();
    if (await btn.count()) { await btn.click(); await frame.waitForTimeout(600); out.comboBox = await frame.evaluate(() => [...document.querySelectorAll(".react-aria-ComboBox .react-aria-ListBoxItem, .react-aria-Popover [role=option]")].map((n) => n.getAttribute("data-key")).filter(Boolean).sort()); await frame.page().keyboard.press("Escape"); await frame.waitForTimeout(300); }
  } catch (e) { out.comboError = String(e).slice(0, 120); }
  return out;
}

mkdirSync(OUT_DIR, { recursive: true });
const browser = await chromium.launch({ headless: !headed });
const context = await browser.newContext({ storageState: STORAGE_STATE, viewport: { width: 1600, height: 1000 } });
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));

try {
  await page.goto(`${BASE_URL}/dashboard`, { waitUntil: "networkidle" });
  const create = page.locator("button.dashboard-create-button").first();
  await create.waitFor({ state: "visible", timeout: 20_000 });
  await create.click();
  const input = page.locator("#new-project-name");
  await input.waitFor({ state: "visible", timeout: 10_000 });
  await input.fill(`adr152-p4-${Date.now()}`);
  await input.press("Enter");
  await page.waitForURL(/\/builder\/[^/?]+$/, { timeout: 90_000 });
  await waitReady(page);
  const projectId = page.url().split("/builder/")[1];
  const collectionId = crypto.randomUUID();
  const glyphs = ["star", "moon", "sun"];
  const rows = [1, 2, 3].map((i) => ({ id: `auto-${i}`, uid: `U-${i}`, name: `User ${i}`, title: `Title ${i}`, glyph: glyphs[i - 1] }));
  await idb.put(page, { id: collectionId, name: "Users", project_id: projectId, schema: [{ key: "id", type: "string" }, { key: "uid", type: "string" }, { key: "name", type: "string" }, { key: "title", type: "string" }, { key: "glyph", type: "string" }], mockData: rows, useMockData: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
  await page.reload({ waitUntil: "networkidle" });
  await waitReady(page);
  const users = (await idb.getAll(page)).find((c) => c.id === collectionId);
  const fid = Object.fromEntries(users.schema.map((f) => [f.key, f.id]));
  record("시드 write-back 5 필드 id", Object.values(fid).every(Boolean), JSON.stringify(Object.keys(fid)));

  await setPanel(page, "components", true);
  const addByTitle = async (re) => {
    await page.evaluate(() => { const st = window.__composition_STORE__.getState(); st.setSelectedElement(st.elements.find((e) => e.type === "body")?.id ?? null); });
    await page.waitForTimeout(300);
    const handle = await page.evaluateHandle((src) => [...document.querySelectorAll("button.list-item")].find((b) => new RegExp(src, "i").test(b.getAttribute("title") ?? "")), re.source);
    const el = handle.asElement();
    if (!el) throw new Error(`팔레트 버튼 없음 ${re}`);
    await el.scrollIntoViewIfNeeded();
    const countEls = () => page.evaluate(() => window.__composition_STORE__.getState().elements.length);
    const before = await countEls();
    await el.click();
    await pollUntil(countEls, (n) => n > before, 15_000, 300);
    await page.waitForTimeout(800);
    const added = await page.evaluate(() => { const st = window.__composition_STORE__.getState(); const e = st.elements.find((x) => x.id === st.selectedElementId); return e ? { id: e.id, type: e.type } : null; });
    log("palette add", re.source, JSON.stringify(added));
    return added?.id ?? null;
  };
  const ids = {
    breadcrumbs: await addByTitle(/^Add breadcrumbs? element$/),
    comboBox: await addByTitle(/^Add combo ?box element$/),
    gridList: await addByTitle(/^Add grid list element$/),
    menu: await addByTitle(/^Add menu element$/),
    tabs: await addByTitle(/^Add tabs element$/),
    tagGroup: await addByTitle(/^Add tag group element$/),
    tree: await addByTitle(/^Add tree element$/),
  };
  await setPanel(page, "components", false);
  await page.evaluate(() => window.__composition_STORE__.getState().setSelectedElement(null));
  const missing = Object.entries(ids).filter(([, v]) => !v).map(([k]) => k);
  if (missing.length) throw new Error(`요소 미생성 ${missing.join(",")}`);

  await page.evaluate(({ ids, collectionId, fieldMap }) => {
    const st = window.__composition_STORE__.getState();
    const binding = { source: "dataTable", collectionId, name: "Users", fieldMap };
    for (const id of Object.values(ids)) st.updateElementProps(id, { dataBinding: binding });
  }, { ids, collectionId, fieldMap: { value: fid.uid, icon: fid.glyph } });
  await page.waitForTimeout(2000);

  // Skia — 캔버스에 행을 투영하는 가족 (gridlist · tag · breadcrumb). Tabs 는 items SSOT (dataBinding 미투영 — 기존),
  //   Menu · ComboBox 는 popover, Tree 는 data-bound 투영 없음 (기존 가족 격차 — ADR-152 범위 밖, 기록).
  const skia = {
    gridList: await pollUntil(() => skiaKeys(page, "gridlist", ids.gridList), (k) => k && k.length === 3),
    // TagGroup 투영 owner 는 자식 TagList scene node — owner 무관하게 tag-row 키를 읽는다
    tagGroup: await pollUntil(() => page.evaluate(() => { const map = window.__composition_LAYOUT_DEBUG__?.getSharedLayoutMap?.(); if (!map) return null; return [...map.keys()].filter((k) => k.startsWith("projection:tag-row:")).map((k) => k.split(":").pop()).filter((k) => !k.startsWith("__")).sort(); }), (k) => k && k.length === 3),
    breadcrumbs: await pollUntil(() => skiaKeys(page, "breadcrumb", ids.breadcrumbs), (k) => k && k.length === 3),
  };
  for (const [name, keys] of Object.entries(skia)) record(`Skia ${name}: 투영 행 key = uid 컬럼`, same(keys), JSON.stringify(keys));
  await page.screenshot({ path: `${OUT_DIR}/01-skia.png` });

  const frame = await previewFrame(page);
  if (!frame) throw new Error("Preview iframe 없음");
  const dom = await pollUntil(() => readDomKeys(frame, ids), (r) => same(r.gridList) && same(r.tagGroup), 25_000);
  log("dom", JSON.stringify(dom));
  for (const name of ["gridList", "tagGroup", "tabs", "menu", "comboBox", "tree"]) record(`DOM ${name}: 항목 key = uid 컬럼`, same(dom[name]), JSON.stringify(dom[name] ?? dom[`${name}Error`] ?? null));
  record("DOM breadcrumbs: 항목 3 · 라벨 = name 휴리스틱 (li 는 key 미노출 — Skia key 로 판정)", JSON.stringify(dom.breadcrumbs) === JSON.stringify(["User 1", "User 2", "User 3"]), JSON.stringify(dom.breadcrumbs));
  await page.screenshot({ path: `${OUT_DIR}/02-preview.png` });
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
