#!/usr/bin/env node
// adr238-live-exercise.mjs — ADR-238 live (Skia layout · scene · store, Compare Mode · Preview 미개방).
//   Phase 1: ListBox instance 상속 항목 선택 → Properties "Item roles" 절 → Description 끄기 (항목 높이 감소 · scene 자식
//   에서 빠짐) → 켜기 (원래 높이) → 끄기 → reload 뒤 그대로 · GridListItem origin 에 icon 역할 추가 (origin 자식 · page
//   error 0).
// 사용: node apps/builder/scripts/adr238-live-exercise.mjs [--base http://localhost:5173]
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
const BASE = args.includes("--base")
  ? args[args.indexOf("--base") + 1]
  : process.env.BUILDER_URL ?? "http://localhost:5173";
const findings = [];
const record = (name, pass, detail) => {
  findings.push({ name, pass, detail });
  console.log(
    `[adr238 live] ${pass ? "PASS" : "FAIL"} — ${name} :: ${JSON.stringify(detail).slice(0, 1500)}`,
  );
};

const browser = await chromium.launch({ headless: false });
const { page } = await createInstrumentedContext(browser, {
  storageState: loadStorageState(
    resolve("apps/builder/scripts/.auth-session.json"),
  ),
  cpuThrottle: 1,
  deviceScaleFactor: 1,
});
const errors = [];
page.on("pageerror", (e) => errors.push(String(e.stack ?? e).slice(0, 1200)));
const { projectUrl } = await createIsolatedProject(page, BASE);
await page.waitForTimeout(1500);

const storeRead = (fn, arg) => page.evaluate(fn, arg);
const sceneChildren = (id) =>
  storeRead(
    (id) =>
      (window.__composition_SCENE_DEBUG__?.readChildren?.(id) ?? []).map(
        (n) => n.id,
      ),
    id,
  );
const rect = (id) =>
  storeRead((id) => {
    const r = window.__composition_LAYOUT_DEBUG__.getSharedLayoutMap().get(id);
    return r ? { x: r.x, y: r.y, width: r.width, height: r.height } : null;
  }, id);
const node = (id) =>
  storeRead((id) => {
    const st = window.__composition_STORE__.getState();
    const e = st.elementsMap.get(id);
    return e
      ? {
          id: e.id,
          type: e.type,
          descendants: e.descendants ?? null,
          kids: st.elements
            .filter((x) => x.parent_id === id)
            .map((x) => [x.type, x.props?.slot ?? null]),
        }
      : null;
  }, id);

async function placeInstance(inst, originId) {
  await storeRead(
    async ({ inst, originId }) => {
      const st = window.__composition_STORE__.getState();
      const body = st.elements.find(
        (e) => e.type === "body" && e.page_id === st.currentPageId,
      );
      const now = new Date().toISOString();
      await st.addComplexElement(
        {
          id: inst,
          customId: inst,
          type: "ref",
          ref: originId,
          parent_id: body.id,
          page_id: st.currentPageId,
          order_num: 0,
          created_at: now,
          updated_at: now,
          props: {},
        },
        [],
      );
    },
    { inst, originId },
  );
  await page.waitForTimeout(800);
}
async function select(id) {
  await storeRead(
    (id) =>
      window.__composition_STORE__
        .getState()
        .setSelectedElement(id, {}, {}, {}),
    id,
  );
  await page.waitForTimeout(1000);
}

await openPanels(page, ["Properties"]);

// ── Phase 1 ───────────────────────────────────────────────────────────────
await placeInstance("live-lb", "component-listbox");
const ITEM = "live-lb/component-listbox__item-1";
const DESC = `${ITEM}/Description`;
const state = async () => ({
  item: await rect(ITEM),
  desc: await rect(DESC),
  item2: await rect("live-lb/component-listbox__item-2"),
  descendants: (await node("live-lb"))?.descendants,
});
const before = await state();
await select(ITEM);
const section = page.locator('.section:has-text("Item roles")');
const sectionVisible = await section.count();
const descSwitch = section.getByRole("switch", { name: "Description" });
const switchCount = await descSwitch.count();
const labelSwitch = await section
  .getByRole("switch", { name: "Label" })
  .count();
record(
  'Properties "Item roles" 절 — 상속 항목 선택 시 보인다 (Description 스위치 · Label 은 스위치 없음)',
  sectionVisible === 1 && switchCount === 1 && labelSwitch === 0,
  { sectionVisible, switchCount, labelSwitch },
);
if (switchCount === 1) {
  await descSwitch.locator("xpath=ancestor::label[1]").locator(".indicator").click();
  await page.waitForTimeout(1500);
}
const off = await state();
record(
  "Description 끄기 → descendants[항목/Description].enabled=false · 항목 높이 감소 · description rect 없음 · 둘째 항목 그대로",
  off.descendants?.["component-listbox__item-1/Description"]?.enabled ===
    false &&
    off.item &&
    before.item &&
    off.item.height < before.item.height &&
    off.desc === null &&
    off.item2?.height === before.item2?.height,
  { before, off },
);
await select(ITEM);
if ((await descSwitch.count()) === 1) {
  await descSwitch.locator("xpath=ancestor::label[1]").locator(".indicator").click();
  await page.waitForTimeout(1500);
}
const on = await state();
record(
  "Description 다시 켜기 → 원래 높이",
  on.item?.height === before.item?.height && on.desc !== null,
  { on },
);
await select(ITEM);
if ((await descSwitch.count()) === 1) {
  await descSwitch.locator("xpath=ancestor::label[1]").locator(".indicator").click();
  await page.waitForTimeout(1500);
}

// GridListItem origin — icon 역할 추가
await select("component-gridlist-item-default");
const addIcon = page.locator('button[aria-label="Add role Icon"]');
const addCount = await addIcon.count();
if (addCount === 1) {
  await addIcon.click();
  await page.waitForTimeout(1500);
}
const gridOrigin = await node("component-gridlist-item-default");
record(
  "GridListItem origin 에 Icon 역할 추가 → origin 자식 Icon (slot=icon) · label 에 slot 없음",
  addCount === 1 &&
    gridOrigin?.kids.some(([t, s]) => t === "Icon" && s === "icon") &&
    gridOrigin?.kids.some(([t, s]) => t === "Text" && s === null),
  gridOrigin,
);

// reload
await page.evaluate(() =>
  window.__composition_STORE__.getState().setSelectedElement(null),
);
await page.waitForTimeout(3000);
await page.goto(projectUrl, { waitUntil: "networkidle" });
await waitReady(page);
await page.waitForTimeout(3000);
const reloaded = await state();
const gridAfter = await node("component-gridlist-item-default");
record(
  "reload → Description 끔 · 높이 · GridListItem Icon 역할 그대로",
  reloaded.descendants?.["component-listbox__item-1/Description"]?.enabled ===
    false &&
    reloaded.item?.height === off.item?.height &&
    gridAfter?.kids.some(([t]) => t === "Icon"),
  { reloaded, gridAfter },
);
record("page error 0", errors.length === 0, errors.slice(0, 5));
await browser.close();
console.log(
  `[adr238 live] ${findings.filter((f) => f.pass).length}/${findings.length}`,
);
