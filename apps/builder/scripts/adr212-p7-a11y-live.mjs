#!/usr/bin/env node
// adr212-p7-a11y-live.mjs — ADR-212 Phase 7 (a11y 검수 + closure) 통합 live:
//   리서치 §4-5 전 표면을 한 번에 axe critical 0 로 확인하고, 키보드만 시나리오 5 를 exercise 한다.
//   표면: Data 목록 패널 · 격자 편집기 · 필드 패널 · API 편집기 · 상태 live region.
//   Phase 2·3 하니스가 격자·필드 패널 axe 를 이미 봤지만, Phase 7 은 전 표면 한 판을 요구한다
//   (완료 기준 = 실제 builder 에서 1회 exercise). native dialog 0 · page error 0 도 재확인.
// 사용: node apps/builder/scripts/adr212-p7-a11y-live.mjs [--headless]
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { waitReady } from "./perf-baseline.mjs";

const require = createRequire(import.meta.url);
const BASE_URL = "http://localhost:5173";
const STORAGE_STATE = resolve("apps/builder/scripts/.auth-session.json");
const OUT_DIR = process.env.ADR212_OUT ?? "/private/tmp/adr212-p7";
const headless = process.argv.includes("--headless");
const log = (...a) => console.log("[ADR-212 p7 a11y]", ...a);
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
  const button = page
    .locator(".panel-toggle-rail button")
    .nth(RAIL_ORDER.indexOf(panelId));
  if (((await button.getAttribute("aria-pressed")) === "true") !== open) {
    await button.click();
    await page.waitForTimeout(900);
  }
}

async function idbPut(page, store, arg) {
  return page.evaluate(
    async ({ store, arg }) => {
      const db = await new Promise((res, rej) => {
        const r = indexedDB.open("composition");
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
      });
      await new Promise((res, rej) => {
        const tx = db.transaction(store, "readwrite");
        tx.objectStore(store).put(arg);
        tx.oncomplete = () => res();
        tx.onerror = () => rej(tx.error);
      });
      db.close();
    },
    { store, arg },
  );
}

/** axe critical 위반을 셀렉터 노드에 대해 센다. 노드 없으면 null. */
async function axeCritical(page, selector) {
  return page.evaluate(async (sel) => {
    const node = document.querySelector(sel);
    if (!node) return null;
    const results = await window.axe.run(node, { resultTypes: ["violations"] });
    return results.violations
      .filter((v) => v.impact === "critical")
      .map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.html.slice(0, 120)) }));
  }, selector);
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
let dialogs = 0;
page.on("dialog", (d) => {
  dialogs += 1;
  d.dismiss().catch(() => {});
});

try {
  await page.goto(`${BASE_URL}/dashboard`, { waitUntil: "networkidle" });
  const create = page.locator("button.dashboard-create-button").first();
  await create.waitFor({ state: "visible", timeout: 20_000 });
  await create.click();
  const input = page.locator("#new-project-name");
  await input.waitFor({ state: "visible", timeout: 10_000 });
  await input.fill(`adr212-p7-${Date.now()}`);
  await input.press("Enter");
  await page.waitForURL(/\/builder\/[^/?]+$/, { timeout: 90_000 });
  await waitReady(page);
  const projectId = page.url().split("/builder/")[1];
  log("project", projectId);

  const now = new Date().toISOString();
  const usersId = crypto.randomUUID();
  const endpointId = crypto.randomUUID();
  await idbPut(page, "collections", {
    id: usersId,
    name: "Users",
    project_id: projectId,
    schema: [
      { id: "f-id", key: "id", type: "string" },
      { id: "f-name", key: "name", type: "string" },
      { id: "f-age", key: "age", type: "number" },
    ],
    mockData: [
      { id: "u1", name: "Ann", age: 30 },
      { id: "u2", name: "Bob", age: 22 },
    ],
    useMockData: true,
    created_at: now,
    updated_at: now,
  });
  await idbPut(page, "api_endpoints", {
    id: endpointId,
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
    created_at: now,
    updated_at: now,
  });
  await page.reload({ waitUntil: "networkidle" });
  await waitReady(page);

  // axe 주입 (한 번)
  await page.addScriptTag({ path: require.resolve("axe-core/axe.min.js") });

  // ── 표면 1: Data 목록 패널 ──
  await setPanel(page, "datatable", true);
  const panel = page.locator(".datatable-panel");
  await panel.waitFor({ timeout: 15_000 });
  await page.waitForTimeout(500);
  {
    const c = await axeCritical(page, ".datatable-panel");
    record("Data 목록 패널 axe critical 0", c?.length === 0, JSON.stringify(c));
  }

  // 키보드 시나리오 S1: 목록 항목을 키보드로 열기 (Tab 도달 + Enter)
  const usersRow = panel
    .locator('[role="grid"] [role="row"]')
    .filter({ hasText: "Users" });
  await usersRow.waitFor({ timeout: 15_000 });
  await usersRow.focus();
  const rowFocused = await usersRow.evaluate(
    (el) => el === document.activeElement || el.contains(document.activeElement),
  );
  await page.keyboard.press("Enter");
  const editor = page.locator('[data-panel-id="datatableEditor"]');
  await editor.locator(".panel-header").first().waitFor({ timeout: 15_000 });
  await page.waitForFunction(
    () =>
      !document.querySelector(
        '[data-panel-id="datatableEditor"] .panel-lazy-fallback',
      ),
    null,
    { timeout: 15_000 },
  );
  record(
    "S1 목록 항목 키보드 열기 (focus + Enter → 편집기)",
    rowFocused && (await editor.isVisible()),
    `rowFocused=${rowFocused}`,
  );

  await page.evaluate(() => {
    const frame = document.querySelector('[data-panel-id="datatableEditor"]');
    if (frame instanceof HTMLElement) frame.style.width = "900px";
  });
  await page.waitForTimeout(400);

  // ── 표면 2: 격자 편집기 ──
  {
    const c = await axeCritical(page, '[data-panel-id="datatableEditor"]');
    record("격자 편집기 axe critical 0", c?.length === 0, JSON.stringify(c));
  }

  // S2: 격자 단일 tab stop (role=grid 컨테이너 tabindex + Arrow 이동)
  const grid = editor.locator('[role="grid"]').first();
  await grid.waitFor({ timeout: 10_000 });
  const gridTabStops = await editor.evaluate((el) => {
    // 격자 안에서 Tab 순회 대상(tabindex>=0 또는 자연 포커스 가능)이 RAC grid 규약대로
    // 소수(격자 자체 1 + 툴바)인지 — 셀 수만큼 폭증하지 않는지
    const grid = el.querySelector('[role="grid"]');
    if (!grid) return { gridTabIndex: null, cellInputs: 0 };
    // 선택 컬럼의 RAC Checkbox(slot="selection", 자체 접근 이름 있음)는 제외 —
    // "셀 수만큼 텍스트 input" 안티패턴만 센다 (비편집 시 0 기대).
    const cellInputs = grid.querySelectorAll(
      '[role="gridcell"] input:not([type="checkbox"]), [role="rowheader"] input:not([type="checkbox"])',
    ).length;
    return {
      gridTabIndex: grid.getAttribute("tabindex"),
      cellInputs,
    };
  });
  record(
    "S2 격자 단일 tab stop (비편집 시 상시 셀 input 0)",
    gridTabStops.cellInputs === 0,
    JSON.stringify(gridTabStops),
  );

  // S2b: Arrow 로 셀 이동 → Enter/타이핑 편집 진입
  await grid.locator('[role="row"]').nth(1).locator('[role="gridcell"]').first().click();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(300);
  const editing = await editor.evaluate(
    () => !!document.querySelector('[role="grid"] [role="gridcell"] input, [role="grid"] .datagrid-cell-editing'),
  );
  await page.keyboard.press("Escape");
  record("S2b Arrow 이동 + Enter 편집 진입", editing, `editing=${editing}`);

  // ── 표면 3: 필드 패널 (헤더 → 필드 패널) ──
  const clickColumn = async (key) => {
    const label = editor
      .locator(".datagrid-column-label", { hasText: key })
      .first();
    await label.waitFor({ state: "attached", timeout: 10_000 });
    await label.scrollIntoViewIfNeeded().catch(() => {});
    await label.evaluate((el) => {
      const opts = { bubbles: true, cancelable: true, pointerId: 1, button: 0 };
      el.dispatchEvent(new PointerEvent("pointerdown", opts));
      el.dispatchEvent(new PointerEvent("pointerup", opts));
      el.dispatchEvent(new MouseEvent("click", opts));
    });
    await page.waitForTimeout(500);
  };
  await clickColumn("name");
  const fieldPanel = page.locator('[data-panel-id="datatableField"]');
  await fieldPanel.waitFor({ timeout: 10_000 });
  {
    const c = await axeCritical(page, '[data-panel-id="datatableField"]');
    record("S3 필드 패널 열림 + axe critical 0", c?.length === 0, JSON.stringify(c));
  }

  // ── 표면 4: API 편집기 ──
  await panel.locator(".panel-tab").nth(1).click(); // APIs 탭
  await page.waitForTimeout(500);
  // 목록 항목의 편집 아이콘 버튼(aria-label "Edit getUsers")으로 API 편집기 열기
  const apiEditBtn = panel
    .locator('.list-item-actions button[aria-label*="getUsers"]')
    .nth(1); // 0=Test, 1=Edit, 2=Delete
  await apiEditBtn.waitFor({ timeout: 10_000 });
  await apiEditBtn.click();
  await editor.locator(".datatable-api-editor").waitFor({ timeout: 15_000 });
  await page.waitForTimeout(600);
  {
    const c = await axeCritical(page, '[data-panel-id="datatableEditor"]');
    record("API 편집기 axe critical 0", c?.length === 0, JSON.stringify(c));
  }
  // Method/URL aria-label i18n 반영 (하드코딩 제거 확인)
  const apiNames = await editor.evaluate(() => {
    // Method 는 RAC Select(CompactSelect) — aria-label 이 래퍼가 아니라 내부 접근 컨트롤
    // (hidden <select> / trigger)에 실린다. 래퍼 하위 어디든 aria-label 이 있으면 라벨됨.
    const mWrap = document.querySelector(".datatable-api-method");
    const method =
      mWrap?.getAttribute("aria-label") ??
      mWrap?.querySelector("[aria-label]")?.getAttribute("aria-label") ??
      "";
    const u = document.querySelector(".datatable-api-url");
    return { method, url: u?.getAttribute("aria-label") ?? "" };
  });
  record(
    "API 요청바 Method/URL 접근 가능한 이름 존재",
    apiNames.method.length > 0 && apiNames.url.length > 0,
    JSON.stringify(apiNames),
  );

  // Auth 탭 exercise — secret 입력들이 렌더되는 표면 (빈 endpoint 로는 안 그려짐).
  // fieldset+legend 만으로 라벨하던 결함(개별 input aria-label 없음)을 live 로 확인.
  const authTab = editor
    .locator(".panel-tab", { hasText: /Auth|인증/ })
    .first();
  await authTab.click();
  await page.waitForTimeout(400);
  // 인증 타입 Select 열고 API Key 선택 → keyName/secretName/value 3 input 모두 렌더
  await editor
    .locator(".datatable-api-section .react-aria-Select button, .datatable-api-section button")
    .first()
    .click();
  await page.waitForTimeout(300);
  await page
    .locator('.react-aria-ListBoxItem, [role="option"]', { hasText: /API Key/i })
    .first()
    .click();
  await page.waitForTimeout(400);
  const authInputs = await editor.evaluate(() => {
    const inputs = [
      ...document.querySelectorAll(".datatable-api-section input"),
    ].filter((i) => i.type !== "checkbox" && i.type !== "radio");
    return {
      total: inputs.length,
      unlabeled: inputs.filter((i) => !i.getAttribute("aria-label")).length,
    };
  });
  {
    const c = await axeCritical(page, '[data-panel-id="datatableEditor"]');
    record(
      "Auth 탭 secret input 전부 접근 이름 + axe critical 0",
      authInputs.total > 0 && authInputs.unlabeled === 0 && c?.length === 0,
      `${JSON.stringify(authInputs)} axe=${JSON.stringify(c)}`,
    );
  }

  // ── 표면 5: 상태 live region (role=status) ──
  const statusRegion = await page.evaluate(() => {
    const el = document.querySelector(".datatable-status");
    return el
      ? {
          role: el.getAttribute("role"),
          live: el.getAttribute("aria-live"),
          hasLabel: !!el.getAttribute("aria-label"),
        }
      : null;
  });
  record(
    "상태 live region role=status + aria-live=polite",
    statusRegion?.role === "status" && statusRegion?.live === "polite",
    JSON.stringify(statusRegion),
  );

  record("native dialog 0 (prompt/confirm/alert 없음)", dialogs === 0, String(dialogs));
  record("page error 0", errors.length === 0, errors.join(" | "));

  const passed = findings.filter((f) => f.pass).length;
  log(`${passed}/${findings.length} PASS`);
  await page.screenshot({ path: `${OUT_DIR}/p7.png` });
  if (passed !== findings.length) process.exitCode = 1;
} catch (e) {
  log("FAIL — harness ::", e.message);
  await page.screenshot({ path: `${OUT_DIR}/p7-error.png` }).catch(() => {});
  process.exitCode = 1;
} finally {
  await browser.close();
}
