#!/usr/bin/env node
// adr162-crosscheck-live.mjs — ADR-162 /cross-check Canvas leg (Skia layout map · 스크린샷, Compare Mode · Preview 없음).
//   같은 데이터 GridList (static collection dataBinding 3 행 · 폭 400) 를 (1) 접기 = 항목 origin slot-only,
//   (2) 펼침 = origin 에 Image (역할 없는 자식) 추가 두 상태로 잰다. DOM leg = tests/parity/adr162DataRowCardDom.browser.test.ts.
// 사용: node apps/builder/scripts/adr162-crosscheck-live.mjs [--base http://localhost:5173] [--shot-dir <dir>]
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
  : "http://localhost:5173";
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

const inst = "cc-gridlist";
await page.evaluate(async (inst) => {
  const st = window.__composition_STORE__.getState();
  const body = st.elements.find((e) => e.type === "body" && e.page_id === st.currentPageId);
  const now = new Date().toISOString();
  await st.addComplexElement(
    {
      id: inst,
      customId: inst,
      type: "GridList",
      parent_id: body.id,
      page_id: st.currentPageId,
      order_num: 0,
      created_at: now,
      updated_at: now,
      props: {
        style: { width: "400px" },
        dataBinding: {
          type: "collection",
          source: "static",
          config: {
            data: [
              { id: "r1", label: "Row One", description: "first row" },
              { id: "r2", label: "Row Two", description: "second row" },
              { id: "r3", label: "Row Three", description: "third row" },
            ],
          },
        },
      },
    },
    [],
  );
}, inst);
const measure = (label) =>
  page.evaluate(
    ({ inst, label }) => {
      const map = window.__composition_LAYOUT_DEBUG__.getSharedLayoutMap();
      const out = {};
      for (const [id, r] of map)
        if (id.includes(inst))
          out[id.replace(`projection:gridlist-row:${inst}:`, "")] = [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)];
      return { label, rects: out };
    },
    { inst, label },
  );
const settle = async () => {
  await page.waitForTimeout(2500);
  await page.mouse.click(700, 600);
  await page.keyboard.press("Meta+0");
  await page.waitForTimeout(1500);
};

// 1) 접기 — slot-only origin 그대로.
await settle();
console.log("[CC] folded", JSON.stringify(await measure("folded")));
if (SHOT_DIR) await page.screenshot({ path: join(SHOT_DIR, "cc-folded.png") });

// 2) 펼침 — origin 에 Image.
await page.evaluate(async (ORIGIN) => {
  const st = window.__composition_STORE__.getState();
  const origin = st.elements.find((e) => e.id === ORIGIN);
  const now = new Date().toISOString();
  await st.addComplexElement(
    {
      id: "cc-image",
      customId: "cc-image",
      type: "Image",
      parent_id: ORIGIN,
      page_id: origin.page_id,
      order_num: 9,
      created_at: now,
      updated_at: now,
      props: { alt: "{label}", style: { width: "48px", height: "48px", backgroundColor: "#e11d48" } },
    },
    [],
  );
}, ORIGIN);
await settle();
console.log("[CC] expanded", JSON.stringify(await measure("expanded")));
if (SHOT_DIR) await page.screenshot({ path: join(SHOT_DIR, "cc-expanded.png") });
console.log("[CC] page errors", errors.length, errors.slice(0, 3));
await browser.close();
