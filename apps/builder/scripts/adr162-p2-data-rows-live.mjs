#!/usr/bin/env node
// adr162-p2-data-rows-live.mjs — ADR-162 Phase 2 (Skia layout · store · 스크린샷, Compare Mode · Preview 없음).
//   정적 GridList 카드 (GridListItem instance 자식, ADR-234) 의 항목 origin 에 비-slot 자식 (Image) 을 넣으면
//   Canvas 카드가 label · description 을 계속 그리는지 본다. 가설: 비-slot 자식이 scene 자식이 되어
//   `_hasChildren` → escape shell 인데 slot 자식은 접혀 있어 label · description 을 아무도 안 그린다.
// 사용: node apps/builder/scripts/adr162-p2-data-rows-live.mjs [--base http://localhost:5173] [--shot-dir <dir>]
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

// 1) 항목 origin 에 Image (역할 없는 자식) · 2) Home 에 items 데이터 GridList instance.
await page.evaluate(async (ORIGIN) => {
  const st = window.__composition_STORE__.getState();
  const origin = st.elements.find((e) => e.id === ORIGIN);
  const now = new Date().toISOString();
  await st.addComplexElement(
    {
      id: "p2-image",
      customId: "p2-image",
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
const inst = "p2-gridlist";
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
await page.waitForTimeout(2500);
await page.mouse.click(700, 600);
await page.keyboard.press("Meta+0");
await page.waitForTimeout(1500);
const rects = await page.evaluate((inst) => {
  const map = window.__composition_LAYOUT_DEBUG__.getSharedLayoutMap();
  const out = {};
  for (const [id, r] of map) if (id.includes(inst)) out[id] = [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)];
  return out;
}, inst);
console.log("[P2] rects", JSON.stringify(rects));
if (SHOT_DIR) await page.screenshot({ path: join(SHOT_DIR, "p2-data-rows.png") });
console.log("[P2] page errors", errors.length, errors.slice(0, 3));
await browser.close();
