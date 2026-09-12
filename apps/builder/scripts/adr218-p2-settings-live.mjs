#!/usr/bin/env node
// adr218-p2-settings-live.mjs — ADR-218 Phase 2 (게이트 G2) live: 실제 빌더에서
//   Settings "데이터 소스" — endpoint picker (set_source{endpointId}, cardinality 0..1) ·
//   실행 정책 컨트롤 (set_execution_policy auto/manual/interval) · 전부 applyDataChange(HC1) ·
//   Undo 로 연결·정책 복원 · 팝오버/모달 생성 화면 0 (HC2, Select 드롭다운은 표준 컨트롤) ·
//   native dialog 0 · page error 0.
// 사용: node apps/builder/scripts/adr218-p2-settings-live.mjs [--headless]
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { randomUUID } from "node:crypto";
import { waitReady } from "./perf-baseline.mjs";

const BASE_URL = "http://localhost:5173";
const STORAGE_STATE = resolve("apps/builder/scripts/.auth-session.json");
const OUT_DIR = process.env.ADR218_OUT ?? "/private/tmp/adr218-p2";
const headless = process.argv.includes("--headless");
const log = (...a) => console.log("[ADR-218 p2 live]", ...a);
const findings = [];
const record = (name, pass, detail) => {
  findings.push({ name, pass, detail });
  log(`${pass ? "PASS" : "FAIL"} — ${name} :: ${detail}`);
};

const RAIL_ORDER = [
  "navigator",
  "components",
  "datatable",
  "datatableEditor",
  "theme",
  "ai",
  "properties",
  "styles",
  "interactions",
  "history",
];
async function setPanel(page, panelId, open) {
  const b = page.locator(".panel-toggle-rail button").nth(RAIL_ORDER.indexOf(panelId));
  if (((await b.getAttribute("aria-pressed")) === "true") !== open) {
    await b.click();
    await page.waitForTimeout(900);
  }
}
async function idbPut(page, store, row) {
  return page.evaluate(
    async ({ store, row }) => {
      const db = await new Promise((res, rej) => {
        const r = indexedDB.open("composition");
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
      });
      await new Promise((res, rej) => {
        const tx = db.transaction(store, "readwrite");
        tx.objectStore(store).put(row);
        tx.oncomplete = () => res();
        tx.onerror = () => rej(tx.error);
      });
      db.close();
    },
    { store, row },
  );
}
async function idbGetAll(page, store) {
  return page.evaluate(async (store) => {
    const db = await new Promise((res, rej) => {
      const r = indexedDB.open("composition");
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    const rows = await new Promise((res, rej) => {
      const tx = db.transaction(store, "readonly");
      const req = tx.objectStore(store).getAll();
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
    });
    db.close();
    return rows;
  }, store);
}

mkdirSync(OUT_DIR, { recursive: true });
const browser = await chromium.launch({ headless });
const context = await browser.newContext({
  storageState: STORAGE_STATE,
  viewport: { width: 1600, height: 1000 },
  deviceScaleFactor: 2,
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => {
  if (m.type() === "error") errors.push("console:" + m.text());
});
let dialogs = 0;
page.on("dialog", (d) => {
  dialogs += 1;
  d.dismiss().catch(() => {});
});

async function openSettings(page) {
  await setPanel(page, "datatable", true);
  const panel = page.locator(".datatable-panel");
  const usersRow = panel
    .locator('[role="grid"] [role="row"]')
    .filter({ hasText: "Users" });
  await usersRow.waitFor({ timeout: 15_000 });
  await usersRow.focus();
  await page.keyboard.press("Enter");
  const editor = page.locator('[data-panel-id="datatableEditor"]');
  await editor.locator(".datatable-tab, .panel-tab").first().waitFor({
    timeout: 15_000,
  });
  await page.waitForFunction(
    () =>
      !document.querySelector(
        '[data-panel-id="datatableEditor"] .panel-lazy-fallback',
      ),
    null,
    { timeout: 15_000 },
  );
  // Settings 탭 클릭
  const settingsTab = editor
    .locator('.panel-tab, .datatable-tab, [role="tab"]')
    .filter({ hasText: /Settings|설정/ });
  await settingsTab.first().click();
  await page.waitForTimeout(500);
  return editor;
}

async function pickOption(page, selectRoot, optionText) {
  await selectRoot.locator("button, .react-aria-Select").first().click();
  await page.waitForTimeout(300);
  await page
    .locator('[role="option"]', { hasText: optionText })
    .first()
    .click();
  await page.waitForTimeout(600);
}

try {
  await page.goto(`${BASE_URL}/dashboard`, { waitUntil: "networkidle" });
  const create = page.locator("button.dashboard-create-button").first();
  await create.waitFor({ state: "visible", timeout: 20_000 });
  await create.click();
  const nameInput = page.locator("#new-project-name");
  await nameInput.waitFor({ state: "visible", timeout: 10_000 });
  await nameInput.fill(`adr218-p2-${Date.now()}`);
  await nameInput.press("Enter");
  await page.waitForURL(/\/builder\/[^/?]+$/, { timeout: 90_000 });
  await waitReady(page);
  const projectId = page.url().split("/builder/")[1];
  const usersId = randomUUID();
  const epId = randomUUID();
  const now = new Date().toISOString();

  // 시드: collection Users + endpoint getUsers(미연결)
  await idbPut(page, "collections", {
    id: usersId,
    name: "Users",
    project_id: projectId,
    schema: [{ id: "f-id", key: "id", type: "number" }],
    mockData: [],
    useMockData: true,
    created_at: now,
    updated_at: now,
  });
  await idbPut(page, "api_endpoints", {
    id: epId,
    name: "getUsers",
    project_id: projectId,
    method: "GET",
    baseUrl: "https://api.example.com",
    path: "/users",
    headers: [],
    queryParams: [],
    bodyType: "none",
    responseMapping: { dataPath: "data" },
    executionMode: "client",
    timeout: 30000,
    retryCount: 0,
    created_at: now,
    updated_at: now,
  });
  await page.reload({ waitUntil: "networkidle" });
  await waitReady(page);

  const editor = await openSettings(page);

  // G2a — Settings 에 데이터 소스 UI (endpoint picker + 정책 컨트롤) 렌더
  const dataSource = editor.locator(".settings-datasource");
  await dataSource.waitFor({ timeout: 10_000 });
  const selects = dataSource.locator(".react-aria-Select, button");
  record(
    "Settings 데이터 소스 UI 렌더 (endpoint picker + 정책 컨트롤)",
    (await dataSource.count()) === 1 && (await selects.count()) >= 2,
    `selects=${await selects.count()}`,
  );

  // G2b — endpoint picker 로 연결 → set_source → endpoint.targetCollectionId (applyDataChange)
  const endpointSelect = dataSource
    .locator(".react-aria-Select")
    .first();
  await pickOption(page, endpointSelect, "getUsers");
  let eps = await idbGetAll(page, "api_endpoints");
  record(
    "endpoint picker 연결 → targetCollectionId = collection (set_source)",
    eps.find((e) => e.id === epId)?.targetCollectionId === usersId,
    JSON.stringify({ target: eps.find((e) => e.id === epId)?.targetCollectionId }),
  );

  // G2c — 정책 interval 선택 → set_execution_policy 영속 (collections store)
  const policySelect = dataSource.locator(".react-aria-Select").nth(1);
  await pickOption(page, policySelect, /주기 실행|Interval/);
  await page.waitForTimeout(400);
  let cols = await idbGetAll(page, "collections");
  const pol = cols.find((c) => c.id === usersId)?.executionPolicy;
  record(
    "정책 interval 선택 → executionPolicy 영속 (set_execution_policy)",
    !!pol && pol.mode === "interval" && typeof pol.intervalSec === "number",
    JSON.stringify(pol),
  );

  // G2d — Undo → 정책 원상 (executionPolicy 제거 = manual)
  await editor.click();
  await page.keyboard.press("Meta+z");
  await page.waitForTimeout(700);
  cols = await idbGetAll(page, "collections");
  const polAfterUndo = cols.find((c) => c.id === usersId)?.executionPolicy;
  eps = await idbGetAll(page, "api_endpoints");
  log(
    "after undo#1",
    JSON.stringify({
      policy: cols.find((c) => c.id === usersId)?.executionPolicy ?? null,
      target: eps.find((e) => e.id === epId)?.targetCollectionId ?? null,
    }),
  );
  record(
    "Undo → 정책 원상 (executionPolicy 제거)",
    !polAfterUndo,
    JSON.stringify({ policy: polAfterUndo ?? null }),
  );

  // G2e — Undo (최대 3회) → endpoint 연결 해제 (targetCollectionId 원상 undefined)
  let undos = 1;
  for (let i = 0; i < 3; i++) {
    eps = await idbGetAll(page, "api_endpoints");
    if (!eps.find((e) => e.id === epId)?.targetCollectionId) break;
    await page.keyboard.press("Meta+z");
    undos += 1;
    await page.waitForTimeout(700);
  }
  eps = await idbGetAll(page, "api_endpoints");
  record(
    "Undo → endpoint 연결 해제 (targetCollectionId 원상)",
    !eps.find((e) => e.id === epId)?.targetCollectionId,
    JSON.stringify({
      target: eps.find((e) => e.id === epId)?.targetCollectionId ?? null,
      undos,
    }),
  );

  record("native dialog 0 (HC2)", dialogs === 0, String(dialogs));
  record("page error 0", errors.length === 0, errors.join(" | ").slice(0, 300));
  await page.screenshot({ path: resolve(OUT_DIR, "settings.png") });
} catch (error) {
  record("harness", false, String(error?.stack ?? error).slice(0, 600));
  await page.screenshot({ path: resolve(OUT_DIR, "failure.png") }).catch(() => {});
} finally {
  writeFileSync(
    resolve(OUT_DIR, "findings.json"),
    JSON.stringify({ at: new Date().toISOString(), findings, errors }, null, 2),
  );
  await browser.close();
}
const failed = findings.filter((f) => !f.pass).length;
log(`${findings.length - failed}/${findings.length} PASS`);
process.exit(failed === 0 ? 0 : 1);
