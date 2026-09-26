#!/usr/bin/env node
// adr162-p1-detach-card-live.mjs — ADR-162 Phase 1 RED/GREEN (Skia layout · store · 스크린샷, Compare Mode · Preview 없음).
//   정적 GridList 카드 (GridListItem instance 자식, ADR-234) 의 항목 origin 에 비-slot 자식 (Image) 을 넣으면
//   Canvas 카드가 label · description 을 계속 그리는지 본다. 가설: 비-slot 자식이 scene 자식이 되어
//   `_hasChildren` → escape shell 인데 slot 자식은 접혀 있어 label · description 을 아무도 안 그린다.
// 사용: node apps/builder/scripts/adr162-p1-detach-card-live.mjs [--base http://localhost:5173] [--shot-dir <dir>]
//   detach 한 카드 (ref 아님 · reusable 아님) 에 비-slot 자식 (Image) 을 넣으면 Canvas 카드가 label 을 잃는지 본다.
import { resolve, join } from "node:path";
import { chromium } from "playwright";
import {
  createInstrumentedContext,
  loadStorageState,
  createIsolatedProject,
  openPanels,
} from "./perf-baseline.mjs";

const args = process.argv.slice(2);
const BASE = args.includes("--base")
  ? args[args.indexOf("--base") + 1]
  : process.env.BUILDER_URL ?? "http://localhost:5173";
const SHOT_DIR = args.includes("--shot-dir")
  ? args[args.indexOf("--shot-dir") + 1]
  : null;
const ORIGIN = "component-gridlist-item-default";

const browser = await chromium.launch({ headless: false });
const { page } = await createInstrumentedContext(browser, {
  storageState: loadStorageState(
    resolve("apps/builder/scripts/.auth-session.json"),
  ),
  cpuThrottle: 1,
  deviceScaleFactor: 1,
});
const errors = [];
page.on("pageerror", (e) => errors.push(String(e.stack ?? e).slice(0, 800)));
await createIsolatedProject(page, BASE);
await page.waitForTimeout(1500);

// 1) Home 에 GridList origin instance + Slot "+" 로 카드 1 개.
const inst = "g0-gridlist";
await page.evaluate(async (inst) => {
  const st = window.__composition_STORE__.getState();
  const origin = st.elements.find(
    (e) =>
      e.type === "GridList" &&
      e.page_id === "page-components" &&
      Array.isArray(e.slot),
  );
  const body = st.elements.find(
    (e) => e.type === "body" && e.page_id === st.currentPageId,
  );
  const now = new Date().toISOString();
  await st.addComplexElement(
    {
      id: inst,
      customId: inst,
      type: "ref",
      ref: origin.id,
      componentName: "GridList",
      parent_id: body.id,
      page_id: st.currentPageId,
      order_num: 0,
      created_at: now,
      updated_at: now,
      props: { style: { width: "400px" } },
    },
    [],
  );
  st.setSelectedElement(inst, {}, {}, {});
}, inst);
await page.waitForTimeout(1200);
await openPanels(page, ["Properties"]);
await page.waitForTimeout(1200);
const insertLabels = await page
  .locator('button[aria-label^="Insert "]')
  .evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")));
const target = insertLabels.find((l) => /\/Default$/.test(l));
if (target) {
  await page.locator(`button[aria-label="${target}"]`).first().click();
  await page.waitForTimeout(2000);
}
await page.evaluate(() =>
  window.__composition_STORE__.getState().setSelectedElement(null),
);
await page.waitForTimeout(800);

const snapshot = () =>
  page.evaluate(
    ({ inst }) => {
      const st = window.__composition_STORE__.getState();
      const card = st.elements.find((x) => x.parent_id === inst);
      const map = window.__composition_LAYOUT_DEBUG__.getSharedLayoutMap();
      const rects = {};
      for (const [id, r] of map) {
        if (id.includes(inst) || (card && id.includes(card.id)))
          rects[id] = [
            Math.round(r.x),
            Math.round(r.y),
            Math.round(r.width),
            Math.round(r.height),
          ];
      }
      return { card: card?.id ?? null, cardRef: card?.ref ?? null, rects };
    },
    { inst },
  );

await page.mouse.click(700, 600);
await page.keyboard.press("Meta+0");
await page.waitForTimeout(1200);
const cardId = await page.evaluate((inst) => {
  const st = window.__composition_STORE__.getState();
  const card = st.elements.find((x) => x.parent_id === inst);
  st.detachInstance(card.id);
  return card.id;
}, inst);
await page.waitForTimeout(2000);
const detached = await page.evaluate((cardId) => {
  const st = window.__composition_STORE__.getState();
  const card = st.elements.find((x) => x.id === cardId);
  return {
    type: card?.type,
    ref: card?.ref ?? null,
    kids: st.elements
      .filter((x) => x.parent_id === cardId)
      .map((x) => ({ id: x.id, type: x.type, slot: x.props?.slot ?? null, role: x.metadata?.slotRole ?? null })),
  };
}, cardId);
console.log("[P1] detached", JSON.stringify(detached));
// 접힌 slot 자식이 그려지는지 보이게 description Text 에 글자를 넣는다.
await page.evaluate((detached) => {
  const st = window.__composition_STORE__.getState();
  const desc = detached.kids.find((k) => k.slot === "description");
  if (desc) st.updateElementProps(desc.id, { children: "desc live" });
}, detached);
await page.waitForTimeout(1500);
if (SHOT_DIR) await page.screenshot({ path: join(SHOT_DIR, "p1-detached.png") });
await page.evaluate(async (cardId) => {
  const st = window.__composition_STORE__.getState();
  const card = st.elements.find((x) => x.id === cardId);
  const now = new Date().toISOString();
  await st.addComplexElement(
    {
      id: "p1-image",
      customId: "p1-image",
      type: "Image",
      parent_id: cardId,
      page_id: card.page_id,
      order_num: 9,
      created_at: now,
      updated_at: now,
      props: { alt: "p1", style: { width: "48px", height: "48px", backgroundColor: "#e11d48" } },
    },
    [],
  );
}, cardId);
await page.waitForTimeout(2000);
const rects = await page.evaluate((cardId) => {
  const map = window.__composition_LAYOUT_DEBUG__.getSharedLayoutMap();
  const out = {};
  for (const [id, r] of map) if (id.startsWith(cardId) || id === "p1-image") out[id] = [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)];
  return out;
}, cardId);
console.log("[P1] after image", JSON.stringify(rects));
if (SHOT_DIR) await page.screenshot({ path: join(SHOT_DIR, "p1-detached-image.png") });
console.log("[P1] page errors", errors.length, errors.slice(0, 3));
await browser.close();
