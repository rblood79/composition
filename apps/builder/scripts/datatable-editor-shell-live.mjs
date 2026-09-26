#!/usr/bin/env node
// datatable-editor-shell-live.mjs — 테이블 편집기 shell 개편 (2026-09-13) live:
//   탭 0 · 헤더 gear 토글 (aria-pressed) 로 격자 ↔ 설정 · 제목 더블클릭 인라인 rename ·
//   새 필드 `+` 슬롯 = 열이 다 보이면 마지막 열 오른쪽, 넘치면 뷰포트 오른쪽 가장자리 (항상 보임)
//   · `+` → 인라인 입력 → Enter 로 add_field · 격자 aria-colcount 는 실제 열만 · dialog 0 · error 0.
// 사용: node apps/builder/scripts/datatable-editor-shell-live.mjs [--headless]
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { randomUUID } from "node:crypto";
import { waitReady } from "./perf-baseline.mjs";

const BASE_URL = process.env.BUILDER_URL ?? "http://localhost:5173";
const STORAGE_STATE = resolve("apps/builder/scripts/.auth-session.json");
const OUT_DIR = process.env.SHELL_OUT ?? "/private/tmp/datatable-editor-shell";
const headless = process.argv.includes("--headless");
const log = (...a) => console.log("[editor shell live]", ...a);
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
  const b = page
    .locator(".panel-toggle-rail button")
    .nth(RAIL_ORDER.indexOf(panelId));
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
async function idbGet(page, store, id) {
  return page.evaluate(
    async ({ store, id }) => {
      const db = await new Promise((res, rej) => {
        const r = indexedDB.open("composition");
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
      });
      const row = await new Promise((res, rej) => {
        const g = db.transaction(store, "readonly").objectStore(store).get(id);
        g.onsuccess = () => res(g.result);
        g.onerror = () => rej(g.error);
      });
      db.close();
      return row;
    },
    { store, id },
  );
}
const slotGeom = (page) =>
  page.evaluate(() => {
    const editor = document.querySelector('[data-panel-id="datatableEditor"]');
    const slot = editor.querySelector(".datagrid-add-field-slot");
    const scroller = editor.querySelector('.datagrid-scroll [role="grid"]');
    const headers = Array.from(
      editor.querySelectorAll('[role="columnheader"]'),
    );
    const last = headers.at(-1)?.getBoundingClientRect();
    const s = slot.getBoundingClientRect();
    const v = scroller.getBoundingClientRect();
    return {
      slotLeft: s.left,
      slotRight: s.right,
      slotTop: s.top,
      slotVisible: s.width > 0 && s.right <= v.right + 1 && s.left >= v.left,
      lastRight: last?.right ?? null,
      viewportRight: v.right,
      viewportLeft: v.left,
      viewportTop: v.top,
      scrollWidth: scroller.scrollWidth,
      clientWidth: scroller.clientWidth,
      scrollLeft: scroller.scrollLeft,
      colcount: editor
        .querySelector('[role="grid"]')
        .getAttribute("aria-colcount"),
      headers: headers.length,
    };
  });

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

try {
  await page.goto(`${BASE_URL}/dashboard`, { waitUntil: "networkidle" });
  await page.locator("button.dashboard-create-button").first().click();
  const nameInput = page.locator("#new-project-name");
  await nameInput.fill(`editor-shell-${Date.now()}`);
  await nameInput.press("Enter");
  await page.waitForURL(/\/builder\/[^/?]+$/, { timeout: 90_000 });
  await waitReady(page);
  const projectId = page.url().split("/builder/")[1];
  const usersId = randomUUID();
  const now = new Date().toISOString();
  await idbPut(page, "collections", {
    id: usersId,
    name: "Users",
    project_id: projectId,
    schema: [
      { id: "f-id", key: "id", type: "number" },
      { id: "f-name", key: "name", type: "string" },
    ],
    mockData: [
      { id: 1, name: "a" },
      { id: 2, name: "b" },
    ],
    useMockData: true,
    created_at: now,
    updated_at: now,
  });
  await page.reload({ waitUntil: "networkidle" });
  await waitReady(page);

  await setPanel(page, "datatable", true);
  const panel = page.locator(".datatable-panel");
  const usersRow = panel
    .locator('[role="grid"] [role="row"]')
    .filter({ hasText: "Users" });
  await usersRow.waitFor({ timeout: 15_000 });
  await usersRow.focus();
  await page.keyboard.press("Enter");
  const editor = page.locator('[data-panel-id="datatableEditor"]');
  await page.waitForFunction(
    () =>
      !document.querySelector(
        '[data-panel-id="datatableEditor"] .panel-lazy-fallback',
      ),
    null,
    { timeout: 15_000 },
  );
  await editor.locator(".datagrid").waitFor({ timeout: 15_000 });
  await page.waitForTimeout(600);

  // 1. 탭 없음 + gear 토글
  const tabs = await editor.locator('[role="tablist"], .panel-tab').count();
  const gear = editor.locator(".datatable-editor-settings-toggle");
  const gearCount = await gear.count();
  record(
    "탭 0 · 헤더 gear 존재",
    tabs === 0 && gearCount === 1,
    `tabs=${tabs} gear=${gearCount}`,
  );
  const actionsOrder = await editor
    .locator(".panel-actions button")
    .evaluateAll((bs) => bs.map((b) => b.getAttribute("aria-label")));
  record(
    "gear 는 close 왼쪽",
    actionsOrder.at(-2)?.toLowerCase().includes("setting") ||
      actionsOrder.at(-2)?.includes("설정"),
    actionsOrder.join(" | "),
  );
  await gear.click();
  await page.waitForTimeout(400);
  const pressed = await gear.getAttribute("aria-pressed");
  const settingsVisible = await editor
    .locator(".settings-datasource, .datatable-settings")
    .count();
  const gridHidden = await editor.locator(".datagrid").count();
  record(
    "gear → aria-pressed=true · 설정 본문 · 격자 숨김 · 제목 유지",
    pressed === "true" &&
      settingsVisible > 0 &&
      gridHidden === 0 &&
      (await editor.locator(".panel-title-text").innerText()) === "Users",
    `pressed=${pressed} settings=${settingsVisible} grid=${gridHidden}`,
  );
  await gear.click();
  await page.waitForTimeout(400);
  record(
    "gear 재클릭 → 격자 복귀",
    (await editor.locator(".datagrid").count()) === 1 &&
      (await gear.getAttribute("aria-pressed")) === "false",
    "ok",
  );

  // 2. 제목 더블클릭 rename
  await editor.locator(".panel-title-renamable").dblclick();
  const titleInput = editor.locator(".panel-title-input");
  await titleInput.waitFor({ timeout: 3000 });
  await titleInput.fill("Members");
  await titleInput.press("Enter");
  await page.waitForTimeout(600);
  const renamed = await idbGet(page, "collections", usersId);
  record(
    "제목 더블클릭 → 인라인 입력 → Enter = 이름 영속",
    renamed?.name === "Members" &&
      (await editor.locator(".panel-title-text").innerText()) === "Members",
    `db=${renamed?.name}`,
  );

  // 3. 새 필드 슬롯 — 2열: 마지막 열 오른쪽에 붙음
  let g = await slotGeom(page);
  record(
    "aria-colcount = 실제 열 (선택 + 2), `+` 는 격자 열 아님",
    Number(g.colcount) === 3 && g.headers === 3,
    `colcount=${g.colcount} headers=${g.headers}`,
  );
  record(
    "2열: `+` 슬롯이 마지막 열 오른쪽에 붙고 보인다",
    g.slotVisible && Math.abs(g.slotLeft - g.lastRight) <= 3,
    JSON.stringify({
      slotLeft: g.slotLeft,
      lastRight: g.lastRight,
      vRight: g.viewportRight,
    }),
  );

  // `+` → 인라인 입력 → Enter → add_field. 6개 추가해 뷰포트를 넘긴다.
  for (let i = 0; i < 6; i++) {
    if (i === 0) await editor.locator(".datagrid-add-field").click();
    const input = editor.locator(".datagrid-add-field-input");
    await input.waitFor({ timeout: 3000 });
    await input.fill(`col${i}`);
    await input.press("Enter");
    await page.waitForTimeout(350);
  }
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);
  const after = await idbGet(page, "collections", usersId);
  record(
    "`+` 인라인 입력 Enter × 6 = add_field (연속 추가)",
    after?.schema?.length === 8,
    `schema=${after?.schema?.map((f) => f.key).join(",")}`,
  );

  g = await slotGeom(page);
  const overflow = g.scrollWidth > g.clientWidth + 1;
  record(
    "8열(넘침): `+` 슬롯이 뷰포트 오른쪽 가장자리에 고정돼 보인다",
    overflow &&
      g.slotVisible &&
      Math.abs(g.slotRight - g.viewportRight) <= 3 &&
      g.slotLeft > g.viewportLeft,
    JSON.stringify({
      overflow,
      slotRight: g.slotRight,
      vRight: g.viewportRight,
      scrollWidth: g.scrollWidth,
      clientWidth: g.clientWidth,
    }),
  );
  // 끝까지 스크롤 → 마지막 열 오른쪽에 붙음
  await page.evaluate(() => {
    const s = document.querySelector(
      '[data-panel-id="datatableEditor"] .datagrid-scroll [role="grid"]',
    );
    s.scrollLeft = s.scrollWidth;
  });
  await page.waitForTimeout(300);
  g = await slotGeom(page);
  record(
    "끝까지 스크롤: `+` 가 마지막 열 오른쪽에 붙는다",
    g.slotVisible &&
      g.lastRight != null &&
      Math.abs(g.slotLeft - g.lastRight) <= 3,
    JSON.stringify({
      slotLeft: g.slotLeft,
      lastRight: g.lastRight,
      scrollLeft: g.scrollLeft,
    }),
  );
  // 슬롯 세로 = 헤더 행 (뷰포트 top 근처)
  record(
    "`+` 슬롯 세로 위치 = 헤더 행",
    Math.abs(g.slotTop - g.viewportTop) <= 3,
    `slotTop=${g.slotTop} vTop=${g.viewportTop}`,
  );

  await page.screenshot({ path: resolve(OUT_DIR, "editor-shell.png") });
  record("native dialog 0", dialogs === 0, String(dialogs));
  record("page error 0", errors.length === 0, errors.join(" | ").slice(0, 300));
} catch (error) {
  record("harness", false, String(error?.stack ?? error).slice(0, 600));
  await page
    .screenshot({ path: resolve(OUT_DIR, "failure.png") })
    .catch(() => {});
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
