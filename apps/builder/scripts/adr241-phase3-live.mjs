#!/usr/bin/env node
// adr241-phase3-live.mjs — ADR-241 Phase 3 live (실제 빌더 headed · Skia layout · store, Compare Mode · Preview 미개방).
//   ① 팔레트 TableView (ref instance) → Canvas 헤더 열 3 · 행 1 × 셀 3 (origin 이관 뒤 Row ref 자기 셀 실체화)
//   ② Properties Slot Fill — Target slot TableHeader 「Fill slot」 → 열 4 · 행마다 셀 4 (TableBody mode C 동반) · 셀 x = 열 x
//   ③ undo 1회 → 열 3 · 셀 3
//   ④ Target slot TableBody 「Fill slot」 → 행 2 · 새 행 셀 3
//   ⑤ page error 0 · native dialog 0
// 사용: node apps/builder/scripts/adr241-phase3-live.mjs [--base http://localhost:5182] [--auth <storageState.json>]
import { resolve } from "node:path";
import { chromium } from "playwright";
import {
  createInstrumentedContext,
  createIsolatedProject,
  loadStorageState,
} from "./perf-baseline.mjs";

const args = process.argv.slice(2);
const arg = (name, fallback) =>
  args.includes(name) ? args[args.indexOf(name) + 1] : fallback;
const BASE = arg("--base", "http://localhost:5182");
const AUTH = arg(
  "--auth",
  resolve("apps/builder/scripts/.auth-session-5182.json"),
);
const findings = [];
const record = (name, pass, detail) => {
  findings.push({ name, pass, detail });
  console.log(
    `[adr241 p3 live] ${pass ? "PASS" : "FAIL"} — ${name} :: ${JSON.stringify(detail).slice(0, 2000)}`,
  );
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

async function addFromPalette(page, type) {
  await setPanel(page, "components", true);
  await page.evaluate(() =>
    window.__composition_STORE__.getState().setSelectedElement(null),
  );
  const before = await page.evaluate(
    (t) =>
      window.__composition_STORE__
        .getState()
        .elements.filter((e) => e.type === t || e.componentName === t)
        .map((e) => e.id),
    type,
  );
  const search = page
    .locator(
      '[data-panel-id="components"] input[type="search"], [data-panel-id="components"] input',
    )
    .first();
  await search.waitFor({ state: "visible", timeout: 20_000 });
  await search.fill(type);
  await page.waitForTimeout(400);
  const items = page.locator(`[data-panel-id="components"] .list-item`);
  const n = await items.count();
  let item = null;
  for (let i = 0; i < n; i++) {
    const label =
      (await items.nth(i).locator(".list-item-name").textContent()) ?? "";
    if (label.replace(/\s+/g, "").toLowerCase() === type.toLowerCase()) {
      item = items.nth(i);
      break;
    }
  }
  if (!item) throw new Error(`팔레트에 ${type} 없음 (${n} items)`);
  await item.click();
  const id = await page
    .waitForFunction(
      ({ t, before }) =>
        window.__composition_STORE__
          .getState()
          .elements.find(
            (e) =>
              (e.type === t || e.componentName === t) && !before.includes(e.id),
          )?.id ?? null,
      { t: type, before },
      { timeout: 15_000 },
    )
    .then((h) => h.jsonValue());
  await page.waitForTimeout(800);
  await setPanel(page, "components", false);
  return id;
}

/** Canvas layout: 헤더 열 x · 행별 셀 x (합성 id — `<inst>/component-tableview__1/…` · `…__2/…`). */
async function readTableView(page, id) {
  return page.evaluate((id) => {
    const map = window.__composition_LAYOUT_DEBUG__.getSharedLayoutMap();
    const header = `${id}/component-tableview__1/`;
    const body = `${id}/component-tableview__2/`;
    const columns = [];
    const rows = new Map();
    for (const [key, r] of map) {
      if (key.startsWith(header) && key.split("/").length === 3)
        columns.push([Math.round(r.x), Math.round(r.width)]);
      if (key.startsWith(body)) {
        const parts = key.slice(body.length).split("/");
        if (parts.length === 1) {
          if (!rows.has(parts[0])) rows.set(parts[0], { y: Math.round(r.y), cells: [] });
          else rows.get(parts[0]).y = Math.round(r.y);
        }
        if (parts.length === 2) {
          if (!rows.has(parts[0])) rows.set(parts[0], { y: 0, cells: [] });
          rows.get(parts[0]).cells.push([Math.round(r.x), Math.round(r.width)]);
        }
      }
    }
    columns.sort((a, b) => a[0] - b[0]);
    const rowList = [...rows.values()].sort((a, b) => a.y - b.y);
    for (const row of rowList) row.cells.sort((a, b) => a[0] - b[0]);
    return { columns, rows: rowList.map((r) => r.cells) };
  }, id);
}

async function fillSlot(page, target) {
  const section = page.locator('[data-panel-id="properties"]');
  const trigger = section
    .locator(".frame-slot-picker")
    .first()
    .locator("button")
    .first();
  await trigger.click();
  await page.waitForTimeout(400);
  await page.getByRole("option", { name: target, exact: true }).first().click();
  await page.waitForTimeout(400);
  await section.locator('button[aria-label="Fill slot"]').first().click();
  await page.waitForTimeout(2000);
}

const browser = await chromium.launch({ headless: false });
const { page } = await createInstrumentedContext(browser, {
  storageState: loadStorageState(AUTH),
  cpuThrottle: 1,
  deviceScaleFactor: 1,
});
const errors = [];
page.on("pageerror", (e) => errors.push(String(e.stack ?? e).slice(0, 1200)));
let dialogs = 0;
page.on("dialog", (d) => {
  dialogs += 1;
  d.dismiss().catch(() => {});
});

try {
  await createIsolatedProject(page, BASE);
  await page.waitForTimeout(1500);
  const id = await addFromPalette(page, "TableView");
  await page.waitForTimeout(1500);
  const placed = await readTableView(page, id);
  record(
    "① 팔레트 TableView instance: 열 3 · 행 1 × 셀 3 (셀 x = 열 x)",
    placed.columns.length === 3 &&
      placed.rows.length === 1 &&
      placed.rows[0].length === 3 &&
      placed.rows[0].every((c, i) => c[0] === placed.columns[i][0]),
    placed,
  );

  await page.evaluate(
    (id) => window.__composition_STORE__.getState().setSelectedElement(id),
    id,
  );
  await page.waitForTimeout(600);
  await setPanel(page, "properties", true);
  await fillSlot(page, "TableHeader");
  const withColumn = await readTableView(page, id);
  record(
    "② TableHeader 「Fill slot」 → 열 4 · 행마다 셀 4 · 셀 x = 열 x",
    withColumn.columns.length === 4 &&
      withColumn.rows.length === 1 &&
      withColumn.rows[0].length === 4 &&
      withColumn.rows[0].every((c, i) => c[0] === withColumn.columns[i][0]),
    withColumn,
  );

  await page.evaluate(() => window.__composition_STORE__.getState().undo());
  await page.waitForTimeout(2000);
  const undone = await readTableView(page, id);
  record(
    "③ undo 1회 → 열 3 · 셀 3",
    undone.columns.length === 3 && undone.rows[0]?.length === 3,
    undone,
  );

  await page.evaluate(
    (id) => window.__composition_STORE__.getState().setSelectedElement(id),
    id,
  );
  await page.waitForTimeout(600);
  await fillSlot(page, "TableBody");
  const withRow = await readTableView(page, id);
  record(
    "④ TableBody 「Fill slot」 → 행 2 · 새 행 셀 3 (x = 열 x)",
    withRow.rows.length === 2 &&
      withRow.rows.every(
        (row) =>
          row.length === 3 &&
          row.every((c, i) => c[0] === withRow.columns[i][0]),
      ),
    withRow,
  );
  record("⑤ page error 0 · native dialog 0", errors.length === 0 && dialogs === 0, {
    errors: errors.slice(0, 3),
    dialogs,
  });
} catch (error) {
  record("harness", false, String(error?.stack ?? error));
}
await browser.close();
console.log(
  `[adr241 p3 live] ${findings.filter((f) => f.pass).length}/${findings.length}`,
);
