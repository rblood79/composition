#!/usr/bin/env node
// adr162-p5-card-fields-live.mjs — ADR-162 Phase 5 (Properties 「카드 필드」 절 · Skia 행 글자, Compare Mode · Preview 없음).
//   P2 와 같은 데이터 GridList (origin 에 Image) 를 선택 → 「카드 필드」 에서 설명 Text 를 `{tag}` 로 바꾼다 →
//   origin 문서 노드가 바뀌고 Canvas 데이터 행 설명이 행마다 tag 값을 그리는지 본다.
// 사용: node apps/builder/scripts/adr162-p5-card-fields-live.mjs [--base http://localhost:5173] [--shot-dir <dir>]
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

// 1) 항목 origin 에 Image (역할 없는 자식) · 2) Home 에 items 데이터 GridList instance.
await page.evaluate(async (ORIGIN) => {
  const st = window.__composition_STORE__.getState();
  const origin = st.elements.find((e) => e.id === ORIGIN);
  const now = new Date().toISOString();
  await st.addComplexElement(
    {
      id: "p5-image",
      customId: "p5-image",
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
const inst = "p5-gridlist";
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
              { id: "r1", label: "Row One", description: "first row", tag: "TAG-1" },
              { id: "r2", label: "Row Two", description: "second row", tag: "TAG-2" },
              { id: "r3", label: "Row Three", description: "third row", tag: "TAG-3" },
            ],
          },
        },
      },
    },
    [],
  );
}, inst);
await page.waitForTimeout(2500);
await page.keyboard.press("Meta+0");
await page.waitForTimeout(800);

// 3) GridList 선택 → 「카드 필드」 절.
await openPanels(page, ["Properties"]);
await page.evaluate((inst) => window.__composition_STORE__.getState().setSelectedElement(inst), inst);
await page.waitForTimeout(1200);
const section = page.locator(".section", { has: page.locator(".section-title", { hasText: /카드 필드|Card fields/ }) });
// 패널은 lazy — 절이 설 때까지 기다린다.
await section.first().waitFor({ timeout: 10000 });
const legends = await section.locator("legend").allInnerTexts();
console.log("[P5] panels", JSON.stringify(await page.evaluate(() => ({
  wrappers: [...document.querySelectorAll(".panel-wrapper")].map((w) => [w.getAttribute("data-panel"), w.getBoundingClientRect().width]),
  titles: [...document.querySelectorAll(".section-title")].map((t) => t.textContent),
  selected: window.__composition_STORE__.getState().selectedElementId,
}))));
console.log("[P5] section legends", JSON.stringify(legends));
if (SHOT_DIR) await page.screenshot({ path: join(SHOT_DIR, "p5-section.png") });

// 4) 설명 Text (값 {description}) 입력을 {tag} 로 → Enter.
const inputs = section.locator("input");
const n = await inputs.count();
let target = null;
for (let i = 0; i < n; i++) if ((await inputs.nth(i).inputValue()) === "{description}") target = inputs.nth(i);
if (!target) throw new Error("{description} 입력 없음");
await target.fill("{tag}");
await target.press("Enter");
await page.waitForTimeout(600);
const dialog = page.locator('[role="dialog"], [role="alertdialog"]');
if (await dialog.count()) {
  console.log("[P5] origin 영향 확인 대화상자", JSON.stringify((await dialog.first().innerText()).slice(0, 300)));
  await dialog.first().locator("button").last().click();
}
await page.waitForTimeout(2000);

const result = await page.evaluate((inst) => {
  const st = window.__composition_STORE__.getState();
  const origin = st.elements.filter((e) => e.parent_id === "component-gridlist-item-default").map((e) => [e.id, e.type, e.props?.children ?? e.props?.alt]);
  const map = window.__composition_LAYOUT_DEBUG__.getSharedLayoutMap();
  const rects = {};
  for (const [id, r] of map) if (id.includes(inst)) rects[id] = [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)];
  return { origin, rects };
}, inst);
console.log("[P5] origin children", JSON.stringify(result.origin));
console.log("[P5] rects", JSON.stringify(result.rects));
if (SHOT_DIR) await page.screenshot({ path: join(SHOT_DIR, "p5-after.png") });
console.log("[P5] page errors", errors.length, errors.slice(0, 3));
await browser.close();
