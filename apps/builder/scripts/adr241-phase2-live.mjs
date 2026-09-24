#!/usr/bin/env node
// adr241-phase2-live.mjs — ADR-241 Phase 2 live (실제 빌더 headed · Skia layout · store, Compare Mode · Preview 미개방).
//   ① 팔레트 Table (ref instance) → Properties Data 「New table」 → Contacts preset 「Create & connect」 → instance 자기 열
//      (`descendants["component-table__1"].children` = schema key) · Canvas 합성 Column rect · 데이터 셀 = 열 key
//   ② undo 1회 → 열 · 바인딩 같이 사라짐 (history 항목 1)
//   ③ redo → 열 복원
//   ④ Properties Slot Fill 「Fill slot」 (Column origin) → 열 1 추가 · key 유일 · undo 1회 → 제거
//   ⑤ page error 0 · native dialog 0
// 사용: node apps/builder/scripts/adr241-phase2-live.mjs [--base http://localhost:5182] [--auth <storageState.json>]
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
    `[adr241 p2 live] ${pass ? "PASS" : "FAIL"} — ${name} :: ${JSON.stringify(detail).slice(0, 4000)}`,
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

/** instance 자기 열 key (mode C) · Canvas: 합성 Column rect 수 · 첫 데이터 행 셀 column id. */
async function readTable(id) {
  return page.evaluate((id) => {
    const st = window.__composition_STORE__.getState();
    const el = st.elements.find((e) => e.id === id);
    const descendants =
      el?.descendants ?? el?.["x-composition"]?.descendants ?? null;
    const cols = descendants?.["component-table__1"]?.children ?? null;
    const map = window.__composition_LAYOUT_DEBUG__.getSharedLayoutMap();
    const columnRects = [];
    const cells = [];
    for (const [key, r] of map) {
      if (key.startsWith(`${id}/component-table__1/`))
        columnRects.push([key.split("/").pop(), Math.round(r.x), Math.round(r.width)]);
      const m = key.match(new RegExp(`^projection:table-cell:${id}:([^:]+):(.+)$`));
      if (m && m[1] === String(1) && !m[2].includes("::")) cells.push([m[2], Math.round(r.x), Math.round(r.width)]);
    }
    columnRects.sort((a, b) => a[1] - b[1]);
    cells.sort((a, b) => a[1] - b[1]);
    return {
      keys: cols ? cols.map((c) => c.props?.key) : null,
      refs: cols ? cols.map((c) => c.ref) : null,
      bound: Boolean(st.readCanonicalDataBindingSnapshot(id)?.props),
      columnRects,
      cells,
    };
  }, id);
}

try {
  await createIsolatedProject(page, BASE);
  await page.waitForTimeout(1500);
  const tableId = await addFromPalette(page, "Table");
  const placed = await page.evaluate(
    (id) => {
      const el = window.__composition_STORE__.getState().elements.find((e) => e.id === id);
      return { type: el?.type, ref: el?.ref };
    },
    tableId,
  );
  record("팔레트 Table = ref instance (component-table)", placed.type === "ref" && placed.ref === "component-table", placed);

  // ① quick connect
  await page.evaluate(
    (id) => window.__composition_STORE__.getState().setSelectedElement(id),
    tableId,
  );
  await page.waitForTimeout(600);
  await setPanel(page, "properties", true);
  const newTable = page
    .locator('[data-panel-id="properties"] button[aria-label="New table"]')
    .first();
  await newTable.waitFor({ state: "visible", timeout: 10_000 });
  await newTable.click();
  const creator = page.locator(".datatable-creator");
  await creator.waitFor({ timeout: 10_000 });
  await creator.locator('input[type="text"]').first().fill("People");
  await creator.locator(".preset-card", { hasText: "Contacts" }).first().click();
  await creator.locator(".creator-footer button").last().click();
  await page.waitForTimeout(3000);
  const connected = await readTable(tableId);
  record(
    "① quick connect → instance 자기 열 (Column origin ref · schema key) · Canvas 합성 Column · 데이터 셀 = 열 key · 폭 = Column 폭",
    connected.bound &&
      Array.isArray(connected.keys) &&
      connected.keys.length > 0 &&
      connected.refs.every((r) => r === "component-table-column") &&
      connected.columnRects.length === connected.keys.length &&
      JSON.stringify(connected.cells.map((c) => c[0])) === JSON.stringify(connected.keys) &&
      connected.cells.every((c, i) => c[2] === connected.columnRects[i]?.[2]),
    { ...connected, columnRectCount: connected.columnRects.length, cellCount: connected.cells.length },
  );

  // ② undo 1회
  await page.evaluate(() => window.__composition_STORE__.getState().undo());
  await page.waitForTimeout(2000);
  const undone = await readTable(tableId);
  record("② undo 1회 → 열 · 바인딩 같이 제거 (history 항목 1)", undone.keys === null && !undone.bound && undone.columnRects.length === 0, undone);

  // ③ redo
  await page.evaluate(() => window.__composition_STORE__.getState().redo());
  await page.waitForTimeout(2000);
  const redone = await readTable(tableId);
  record("③ redo → 열 · 바인딩 복원", JSON.stringify(redone.keys) === JSON.stringify(connected.keys) && redone.bound, redone);

  // ④ Slot Fill "+"
  await page.evaluate(
    (id) => window.__composition_STORE__.getState().setSelectedElement(id),
    tableId,
  );
  await page.waitForTimeout(800);
  const fill = page.locator('[data-panel-id="properties"] button[aria-label="Fill slot"]').first();
  await fill.waitFor({ state: "visible", timeout: 10_000 });
  await fill.click();
  await page.waitForTimeout(2000);
  const filled = await readTable(tableId);
  const newKey = filled.keys?.at(-1);
  record(
    "④ Slot Fill 「Fill slot」 → Column instance 1 추가 · key 유일 · Canvas 합성 Column",
    filled.keys?.length === (redone.keys?.length ?? 0) + 1 &&
      new Set(filled.keys).size === filled.keys.length &&
      filled.columnRects.length === filled.keys.length,
    { newKey, keys: filled.keys, columnRects: filled.columnRects.length },
  );
  await page.evaluate(() => window.__composition_STORE__.getState().undo());
  await page.waitForTimeout(2000);
  const fillUndone = await readTable(tableId);
  record("④ undo 1회 → 추가 열만 제거", JSON.stringify(fillUndone.keys) === JSON.stringify(redone.keys), fillUndone.keys);

  record("⑤ page error 0 · native dialog 0", errors.length === 0 && dialogs === 0, { errors: errors.slice(0, 3), dialogs });
} catch (error) {
  record("harness", false, String(error?.stack ?? error));
}
await browser.close();
console.log(
  `[adr241 p2 live] ${findings.filter((f) => f.pass).length}/${findings.length}`,
);
