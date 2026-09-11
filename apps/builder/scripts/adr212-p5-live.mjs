#!/usr/bin/env node
// adr212-p5-live.mjs — ADR-212 Phase 5 (데이터 유입) live: 편집기 상단 상태 배지 (0행) ·
//   JSON 파일 import → ImportPreview (열 매핑·교체/추가) → 한 DataChange 반영 · ⌘Z 원상.
// 사용: node apps/builder/scripts/adr212-p5-live.mjs [--headless]
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { waitReady } from "./perf-baseline.mjs";

const BASE_URL = "http://localhost:5173";
const STORAGE_STATE = resolve("apps/builder/scripts/.auth-session.json");
const OUT_DIR = process.env.ADR212_OUT ?? "/private/tmp/adr212-p5";
const headless = process.argv.includes("--headless");
const log = (...a) => console.log("[ADR-212 p5 live]", ...a);
const findings = [];
const record = (name, pass, detail) => {
  findings.push({ name, pass, detail });
  log(`${pass ? "PASS" : "FAIL"} — ${name} :: ${detail}`);
};
const RAIL_ORDER = ["navigator","components","datatable","datatableEditor","theme","ai","properties","styles","interactions","history"];
async function setPanel(page, panelId, open) {
  const b = page.locator(".panel-toggle-rail button").nth(RAIL_ORDER.indexOf(panelId));
  if (((await b.getAttribute("aria-pressed")) === "true") !== open) { await b.click(); await page.waitForTimeout(900); }
}
async function idbPut(page, store, row) {
  return page.evaluate(async ({ store, row }) => {
    const db = await new Promise((res, rej) => { const r = indexedDB.open("composition"); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    await new Promise((res, rej) => { const tx = db.transaction(store, "readwrite"); tx.objectStore(store).put(row); tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); });
    db.close();
  }, { store, row });
}
async function idbGet(page, store, id) {
  return page.evaluate(async ({ store, id }) => {
    const db = await new Promise((res, rej) => { const r = indexedDB.open("composition"); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    const out = await new Promise((res, rej) => { const tx = db.transaction(store, "readonly"); const rq = tx.objectStore(store).get(id); rq.onsuccess = () => res(rq.result); rq.onerror = () => rej(rq.error); });
    db.close(); return out;
  }, { store, id });
}

mkdirSync(OUT_DIR, { recursive: true });
const browser = await chromium.launch({ headless });
const context = await browser.newContext({ storageState: STORAGE_STATE, viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 2 });
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
let dialogs = 0;
page.on("dialog", (d) => { dialogs += 1; d.dismiss().catch(() => {}); });

try {
  await page.goto(`${BASE_URL}/dashboard`, { waitUntil: "networkidle" });
  const create = page.locator("button.dashboard-create-button").first();
  await create.waitFor({ state: "visible", timeout: 20_000 });
  await create.click();
  const input = page.locator("#new-project-name");
  await input.waitFor({ state: "visible", timeout: 10_000 });
  await input.fill(`adr212-p5-${Date.now()}`);
  await input.press("Enter");
  await page.waitForURL(/\/builder\/[^/?]+$/, { timeout: 90_000 });
  await waitReady(page);
  const projectId = page.url().split("/builder/")[1];
  const usersId = crypto.randomUUID();
  const now = new Date().toISOString();
  await idbPut(page, "collections", {
    id: usersId, name: "Users", project_id: projectId,
    schema: [{ id: "f-id", key: "id", type: "number" }, { id: "f-name", key: "name", type: "string" }],
    mockData: [], useMockData: true, created_at: now, updated_at: now,
  });
  await page.reload({ waitUntil: "networkidle" });
  await waitReady(page);
  await setPanel(page, "datatable", true);
  const panel = page.locator(".datatable-panel");
  const usersRow = panel.locator('[role="grid"] [role="row"]').filter({ hasText: "Users" });
  await usersRow.waitFor({ timeout: 15_000 });
  await usersRow.focus();
  await page.keyboard.press("Enter");
  const editor = page.locator('[data-panel-id="datatableEditor"]');
  await editor.locator(".datagrid").waitFor({ timeout: 15_000 });
  await page.waitForFunction(() => !document.querySelector('[data-panel-id="datatableEditor"] .panel-lazy-fallback'), null, { timeout: 15_000 });

  // 1) 0행 → 편집기 상단 상태 배지 (empty)
  const badge = editor.locator(".datatable-editor-status");
  await badge.waitFor({ timeout: 8000 });
  record(
    "0행 → 편집기 상단 배지 (empty · '행 없음')",
    (await badge.getAttribute("data-tone")) === "empty" &&
      /(행 없음|No rows)/.test((await badge.textContent()) ?? ""),
    `${await badge.getAttribute("data-tone")} :: ${(await badge.textContent()) ?? ""}`,
  );

  // 2) JSON 파일 import → ImportPreview → 적용
  await editor.evaluate((el) => { const f = el.closest('[data-panel-id="datatableEditor"]'); if (f instanceof HTMLElement) f.style.width = "760px"; });
  const jsonPath = resolve(OUT_DIR, "import.json");
  writeFileSync(jsonPath, JSON.stringify([
    { id: 1, name: "Ann", city: "NYC" },
    { id: 2, name: "Bob", city: "LA" },
    { id: 3, name: "Cy", city: "SF" },
  ]));
  await editor.locator('input[type="file"]').setInputFiles(jsonPath);
  const preview = editor.locator(".datatable-import");
  await preview.waitFor({ timeout: 8000 });
  const colText = (await preview.locator(".datatable-import-cols").textContent()) ?? "";
  record(
    "ImportPreview — 열 3 (id/name 기존, city 새) · 3행",
    /id/.test(colText) && /name/.test(colText) && /city/.test(colText) &&
      /(3행|3 rows)/.test((await preview.locator(".datatable-import-count").textContent()) ?? ""),
    colText.replace(/\s+/g, " ").slice(0, 80),
  );
  // 적용 (기본 replace)
  await preview.locator('button:has-text("Import"), button:has-text("가져오기")').last().click();
  await page.waitForTimeout(900);
  let saved = await idbGet(page, "collections", usersId);
  record(
    "적용 → replace_rows + add_field(city): 3행 · schema 에 city",
    saved.mockData.length === 3 &&
      saved.mockData[0].city === "NYC" &&
      saved.schema.some((f) => f.key === "city"),
    JSON.stringify({ rows: saved.mockData.length, keys: saved.schema.map((f) => f.key), r0: saved.mockData[0] }),
  );

  // 3) ⌘Z → import 원상 (0행 · city 없음) — 한 DataChange (add_field+replace 는... 두 op 라 undo 2? 확인)
  await editor.locator(".datagrid").click();
  await page.keyboard.press("Meta+z");
  await page.waitForTimeout(600);
  saved = await idbGet(page, "collections", usersId);
  record(
    "⌘Z → import 원상 (0행)",
    saved.mockData.length === 0,
    JSON.stringify({ rows: saved.mockData.length, keys: saved.schema.map((f) => f.key) }),
  );

  record("native dialog 0", dialogs === 0, String(dialogs));
  record("page error 0", errors.length === 0, errors.join(" | ").slice(0, 300));
  await page.screenshot({ path: resolve(OUT_DIR, "import.png") });
} catch (error) {
  record("harness", false, String(error?.stack ?? error).slice(0, 600));
  await page.screenshot({ path: resolve(OUT_DIR, "failure.png") }).catch(() => {});
} finally {
  writeFileSync(resolve(OUT_DIR, "findings.json"), JSON.stringify({ at: new Date().toISOString(), findings, errors }, null, 2));
  await browser.close();
}
const failed = findings.filter((f) => !f.pass).length;
log(`${findings.length - failed}/${findings.length} PASS`);
process.exit(failed === 0 ? 0 : 1);
