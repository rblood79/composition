#!/usr/bin/env node
// adr212-p3-live.mjs — ADR-212 Phase 3 (필드 패널, 게이트 G2) live: 실제 빌더에서
//   격자 헤더 클릭 → 필드 패널 → rename (update_field { key }, 152 적용기가 행 이전) ·
//   타입 변경 미리보기 (강제 실패 → 비움) · required patch · 새 필드 (+) · 삭제 (사용처 0 즉시) ·
//   Schema 탭이 없어짐 (Table/Settings 2탭) · 편집기 패널 axe critical 0 (탭 aria-controls 해소) ·
//   native dialog 0 · page error 0. G4 재확인: rename 뒤 rows 가 새 key 로, 값 보존.
// 사용: node apps/builder/scripts/adr212-p3-live.mjs [--headless]
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { waitReady } from "./perf-baseline.mjs";

const require = createRequire(import.meta.url);
const BASE_URL = "http://localhost:5173";
const STORAGE_STATE = resolve("apps/builder/scripts/.auth-session.json");
const OUT_DIR = process.env.ADR212_OUT ?? "/private/tmp/adr212-p3";
const headless = process.argv.includes("--headless");
const log = (...a) => console.log("[ADR-212 p3 live]", ...a);
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

async function idb(page, store, op, arg) {
  return page.evaluate(
    async ({ store, op, arg }) => {
      const db = await new Promise((res, rej) => {
        const r = indexedDB.open("composition");
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
      });
      const out = await new Promise((res, rej) => {
        const tx = db.transaction(store, "readwrite");
        const req =
          op === "put"
            ? tx.objectStore(store).put(arg)
            : tx.objectStore(store).get(arg);
        tx.oncomplete = () => res(req.result);
        tx.onerror = () => rej(tx.error);
      });
      db.close();
      return out;
    },
    { store, op, arg },
  );
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
  await input.fill(`adr212-p3-${Date.now()}`);
  await input.press("Enter");
  await page.waitForURL(/\/builder\/[^/?]+$/, { timeout: 90_000 });
  await waitReady(page);
  const projectId = page.url().split("/builder/")[1];
  log("project", projectId);
  const now = new Date().toISOString();
  const usersId = crypto.randomUUID();
  await idb(page, "collections", "put", {
    id: usersId,
    name: "Users",
    project_id: projectId,
    schema: [
      { id: "f-id", key: "id", type: "string" },
      { id: "f-name", key: "name", type: "string" },
      { id: "f-age", key: "age", type: "string" },
    ],
    mockData: [
      { id: "u1", name: "Ann", age: "30" },
      { id: "u2", name: "Bob", age: "x" },
      { id: "u3", name: "Cy", age: "" },
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
  await editor.locator(".panel-header").first().waitFor({ timeout: 15_000 });
  await page.waitForFunction(
    () =>
      !document.querySelector(
        '[data-panel-id="datatableEditor"] .panel-lazy-fallback',
      ),
    null,
    { timeout: 15_000 },
  );
  await page.evaluate(() => {
    const frame = document.querySelector('[data-panel-id="datatableEditor"]');
    if (frame instanceof HTMLElement) frame.style.width = "900px";
  });
  await page.waitForTimeout(300);

  // clickColumn — RAC Button 은 pointerdown+pointerup+click 순서를 요구한다. 열 헤더는 격자
  // 선택/리사이저와 겹쳐 Playwright actionability 가 걸리므로 라벨 요소에 직접 press 를 쏜다.
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

  // 1) Schema 탭 없음 — Table/Settings 2탭
  const tabNames = await editor.evaluate((el) =>
    [...el.querySelectorAll(".panel-tab .panel-tab-label")].map((n) =>
      (n.textContent ?? "").trim(),
    ),
  );
  record(
    "Schema 탭 제거 — Table/Settings 2탭",
    tabNames.length === 2 && !tabNames.some((n) => /schema|스키마/i.test(n)),
    JSON.stringify(tabNames),
  );

  const fieldPanel = page.locator('[data-panel-id="datatableField"]');

  // 2) 헤더 클릭 → 필드 패널이 그 필드로
  await clickColumn("name");
  await fieldPanel.waitFor({ timeout: 10_000 });
  await page.waitForFunction(
    () =>
      !document.querySelector(
        '[data-panel-id="datatableField"] .panel-lazy-fallback',
      ),
    null,
    { timeout: 10_000 },
  );
  const keyVal = await fieldPanel
    .locator(".datatable-field-key input")
    .inputValue();
  record("헤더 클릭 → 필드 패널 (key = name)", keyVal === "name", keyVal);

  // 3) rename name → fullName (Enter) → IndexedDB schema/rows 가 새 key, 값 보존 (G4)
  const keyInput = fieldPanel.locator(".datatable-field-key input");
  await keyInput.fill("fullName");
  await keyInput.press("Enter");
  await page.waitForTimeout(700);
  let saved = await idb(page, "collections", "get", usersId);
  record(
    "rename → schema key fullName · rows 가 fullName 로 (값 Ann/Bob/Cy 보존, f-name id 유지)",
    saved.schema[1].key === "fullName" &&
      saved.schema[1].id === "f-name" &&
      saved.mockData[0].fullName === "Ann" &&
      saved.mockData[1].fullName === "Bob" &&
      saved.mockData[0].name === undefined,
    JSON.stringify({ schema1: saved.schema[1], row0: saved.mockData[0] }),
  );

  // 4) 타입 변경 미리보기 — age 를 number 로 (Bob "x" 실패, Cy "" 성공 null) → 비움
  await clickColumn("age");
  await fieldPanel
    .locator(".datatable-field-type-item", { hasText: "Number" })
    .click();
  const typeDialog = page.locator('[role="alertdialog"]');
  await typeDialog.waitFor({ timeout: 5000 });
  const dialogText = (await typeDialog.textContent()) ?? "";
  const clearBtn = typeDialog.locator("button", {
    hasText: /Clear|비움/,
  });
  await clearBtn.click();
  await page.waitForTimeout(700);
  saved = await idb(page, "collections", "get", usersId);
  record(
    "타입 변경 age→number: 미리보기 '1 of 3' · 비움 → 실패 셀 null · 30 은 숫자 30",
    /1 of 3|3행 중 1/.test(dialogText) &&
      saved.schema[2].type === "number" &&
      saved.mockData[0].age === 30 &&
      saved.mockData[1].age === null,
    JSON.stringify({
      dialogText: dialogText.slice(0, 60),
      type: saved.schema[2].type,
      ages: saved.mockData.map((r) => r.age),
    }),
  );

  // 5) required 토글
  await clickColumn("fullName");
  await fieldPanel.locator(".datatable-field-check input").click();
  await page.waitForTimeout(500);
  saved = await idb(page, "collections", "get", usersId);
  record(
    "required 토글 → schema.required true",
    saved.schema[1].required === true,
    String(saved.schema[1].required),
  );

  // 6) 새 필드 (+ 열) → 헤더 인라인 입력 → email + Enter → add_field (팝오버·패널 없음)
  //    + 는 패널 리사이즈 separator 와 겹쳐 actionability 가 걸리므로 요소에 직접 press 를 쏜다.
  await editor.locator(".datagrid-add-field").evaluate((el) => {
    const opts = { bubbles: true, cancelable: true, pointerId: 1, button: 0 };
    el.dispatchEvent(new PointerEvent("pointerdown", opts));
    el.dispatchEvent(new PointerEvent("pointerup", opts));
    el.dispatchEvent(new MouseEvent("click", opts));
  });
  const addInput = editor.locator(".datagrid-add-field-input");
  await addInput.waitFor({ timeout: 5000 });
  await addInput.fill("email");
  await addInput.press("Enter");
  await page.waitForTimeout(700);
  saved = await idb(page, "collections", "get", usersId);
  record(
    "헤더 인라인 새 필드 email 추가 (add_field, string)",
    saved.schema.some((f) => f.key === "email" && f.type === "string"),
    JSON.stringify(saved.schema.map((f) => f.key)),
  );
  // 6b) 성공 후 입력이 남아 연속 추가 (phone) 가능
  const stillOpen = (await editor.locator(".datagrid-add-field-input").count()) > 0;
  await editor.locator(".datagrid-add-field-input").fill("phone");
  await editor.locator(".datagrid-add-field-input").press("Enter");
  await page.waitForTimeout(700);
  saved = await idb(page, "collections", "get", usersId);
  record(
    "연속 추가 — 입력 유지 + phone 추가",
    stillOpen && saved.schema.some((f) => f.key === "phone"),
    `stillOpen=${stillOpen} keys=${JSON.stringify(saved.schema.map((f) => f.key))}`,
  );
  // 6c) Esc → 인라인 입력 닫힘
  await editor.locator(".datagrid-add-field-input").press("Escape");
  await page.waitForTimeout(300);
  record(
    "Esc → 인라인 입력 닫힘",
    (await editor.locator(".datagrid-add-field-input").count()) === 0,
    "closed",
  );

  // 7) 삭제 (사용처 0) → 즉시 remove_field
  await clickColumn("email");
  await page.waitForTimeout(500);
  const delBtn = fieldPanel.locator("button", {
    hasText: /Delete field|필드 삭제/,
  });
  await delBtn.first().click({ force: true });
  await page.waitForTimeout(700);
  saved = await idb(page, "collections", "get", usersId);
  record(
    "삭제 (사용처 0) → 즉시 remove_field (ConfirmDialog 없이)",
    !saved.schema.some((f) => f.key === "email"),
    JSON.stringify(saved.schema.map((f) => f.key)),
  );

  // 8) ⌘Z 로 되돌아가는지 (data 스택) — 삭제 undo
  await editor.locator('[role="grid"]').first().click();
  await page.keyboard.press("Meta+z");
  await page.waitForTimeout(500);
  saved = await idb(page, "collections", "get", usersId);
  record(
    "⌘Z → 삭제한 email 복귀 (152 data 스택)",
    saved.schema.some((f) => f.key === "email"),
    JSON.stringify(saved.schema.map((f) => f.key)),
  );

  // 9) axe critical 0 — 편집기 패널 전체 (탭 aria-controls 해소 확인)
  await page.addScriptTag({ path: require.resolve("axe-core/axe.min.js") });
  const axe = await page.evaluate(async () => {
    const results = await window.axe.run(
      document.querySelector('[data-panel-id="datatableEditor"]'),
      { resultTypes: ["violations"] },
    );
    return results.violations.map((v) => ({
      id: v.id,
      impact: v.impact,
      nodes: v.nodes.length,
    }));
  });
  const critical = axe.filter((v) => v.impact === "critical");
  if (critical.length) {
    const detail = await page.evaluate(async () => {
      const r = await window.axe.run(
        document.querySelector('[data-panel-id="datatableEditor"]'),
        { resultTypes: ["violations"] },
      );
      return r.violations
        .filter((v) => v.impact === "critical")
        .map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.html) }));
    });
    log("axe detail", JSON.stringify(detail).slice(0, 1200));
  }
  record(
    "편집기 패널 axe critical 0 (탭 aria-controls dangling 해소)",
    critical.length === 0,
    JSON.stringify(axe),
  );

  // 10) 필드 패널 axe critical 0
  const axeField = await page.evaluate(async () => {
    const node = document.querySelector('[data-panel-id="datatableField"]');
    if (!node) return null;
    const results = await window.axe.run(node, { resultTypes: ["violations"] });
    return results.violations
      .filter((v) => v.impact === "critical")
      .map((v) => v.id);
  });
  record(
    "필드 패널 axe critical 0",
    axeField !== null && axeField.length === 0,
    JSON.stringify(axeField),
  );

  record("native dialog 0", dialogs === 0, String(dialogs));
  record("page error 0", errors.length === 0, errors.join(" | ").slice(0, 300));

  await page.screenshot({ path: resolve(OUT_DIR, "field-panel.png") });
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
