#!/usr/bin/env node
// adr234-live-list-instance.mjs — ADR-234 Phase 4 live (Skia layout · store, Compare Mode · Preview 없음).
//   목록 틀 = owner 인 가족 (ListBox · GridList · Menu) 의 문서 instance 를 선택 → Properties Slot 절
//   "Insert <항목>/Default" → instance 자기 자식 항목 (store) · Canvas 행 (Menu 는 popover 내용이라 행 없음) ·
//   reload 뒤 그대로.
// 사용: node apps/builder/scripts/adr234-live-list-instance.mjs [--base http://localhost:5173]
import { resolve } from "node:path";
import { chromium } from "playwright";
import {
  waitReady,
  createInstrumentedContext,
  loadStorageState,
  createIsolatedProject,
  openPanels,
} from "./perf-baseline.mjs";

const args = process.argv.slice(2);
const BASE = args.includes("--base") ? args[args.indexOf("--base") + 1] : "http://localhost:5173";
const findings = [];
const record = (name, pass, detail) => {
  findings.push({ name, pass, detail });
  console.log(`[adr234 list live] ${pass ? "PASS" : "FAIL"} — ${name} :: ${JSON.stringify(detail)}`);
};

const browser = await chromium.launch({ headless: false });
const { page } = await createInstrumentedContext(browser, {
  storageState: loadStorageState(resolve("apps/builder/scripts/.auth-session.json")),
  cpuThrottle: 1,
  deviceScaleFactor: 1,
});
const errors = [];
page.on("pageerror", (e) => errors.push(String(e.stack ?? e).slice(0, 1200)));
const { projectUrl } = await createIsolatedProject(page, BASE);
await page.waitForTimeout(1500);

const FAMILIES = [
  { type: "ListBox", drawsRows: true },
  { type: "GridList", drawsRows: true },
  { type: "Menu", drawsRows: false },
];

const ownChildren = (inst) =>
  page.evaluate((inst) => {
    const st = window.__composition_STORE__.getState();
    return st.elements.filter((x) => x.parent_id === inst).map((x) => ({ id: x.id, ref: x.ref }));
  }, inst);
const inLayout = (id) =>
  page.evaluate((id) => window.__composition_LAYOUT_DEBUG__.getSharedLayoutMap().has(id), id);

const added = [];
for (const { type, drawsRows } of FAMILIES) {
  const inst = `live-${type.toLowerCase()}`;
  await page.evaluate(
    async ({ inst, type }) => {
      const st = window.__composition_STORE__.getState();
      const origin = st.elements.find(
        (e) => e.type === type && e.page_id === "page-components" && Array.isArray(e.slot),
      );
      const body = st.elements.find((e) => e.type === "body" && e.page_id === st.currentPageId);
      const now = new Date().toISOString();
      await st.addComplexElement(
        {
          id: inst,
          customId: inst,
          type: "ref",
          ref: origin.id,
          componentName: type,
          parent_id: body.id,
          page_id: st.currentPageId,
          order_num: 0,
          created_at: now,
          updated_at: now,
          props: { style: { width: "300px" } },
        },
        [],
      );
      st.setSelectedElement(inst, {}, {}, {});
    },
    { inst, type },
  );
  await page.waitForTimeout(1200);
  await openPanels(page, ["Properties"]);
  await page.waitForTimeout(1200);
  const buttons = await page
    .locator('button[aria-label^="Insert "]')
    .evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")));
  const target = buttons.find((l) => /\/Default$/.test(l));
  const editUi = await page.locator('button[aria-label^="Remove "], button[aria-label="Disable slot"]').count();
  if (target) {
    await page.locator(`button[aria-label="${target}"]`).first().click();
    await page.waitForTimeout(2000);
  }
  await page.evaluate(() => window.__composition_STORE__.getState().setSelectedElement(null));
  await page.waitForTimeout(800);
  const kids = await ownChildren(inst);
  const row = kids[0]?.id;
  const drawn = row ? await inLayout(row) : false;
  record(
    `${type} instance Slot "+" → instance 자기 자식 항목 1${drawsRows ? " · Canvas 행" : " (popover — Canvas 행 없음)"} · 추천 편집 UI 없음`,
    Boolean(target) && editUi === 0 && kids.length === 1 && drawn === drawsRows,
    { buttons, target, editUi, kids, drawn },
  );
  added.push({ inst, row, drawsRows });
}

await page.waitForTimeout(3000);
await page.goto(projectUrl, { waitUntil: "networkidle" });
await waitReady(page);
await page.waitForTimeout(3000);
const afterReload = [];
for (const { inst, row, drawsRows } of added) {
  const kids = await ownChildren(inst);
  afterReload.push({ inst, kids, drawn: row ? await inLayout(row) : false, drawsRows });
}
record(
  "reload → 자식 항목 · Canvas 행 그대로",
  afterReload.every((r) => r.kids.length === 1 && r.drawn === r.drawsRows),
  afterReload,
);
record("page error 0", errors.length === 0, errors.slice(0, 5));
await browser.close();
console.log(`[adr234 list live] ${findings.filter((f) => f.pass).length}/${findings.length}`);
