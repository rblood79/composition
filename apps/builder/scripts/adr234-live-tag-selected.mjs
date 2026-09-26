#!/usr/bin/env node
// adr234-live-tag-selected.mjs — 선택 Tag chip = catalog `Tag.variants.selected` (accent 배경) 을 Skia 가 그린다.
//   (사용자 지적 2026-09-24: Components 페이지 Tag/Selected · Tag/Default 가 Canvas 에서 같았다.)
//   ① Home 의 TagGroup instance (선택 key 1) — 선택 chip 은 accent 배경 픽셀 · 비선택 chip 은 아님.
//   ② Components 페이지 Tag/Selected (origin, `_isSelected`) · Tag/Default (`--unselected`) — 같은 판정.
//   Skia 픽셀 (Playwright 스크린샷) · store 만 — Compare Mode · Preview 미개방.
// 사용: node apps/builder/scripts/adr234-live-tag-selected.mjs [--base http://localhost:5173]
import { resolve } from "node:path";
import { writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { chromium } from "playwright";
import {
  createInstrumentedContext,
  loadStorageState,
  createIsolatedProject,
} from "./perf-baseline.mjs";

const require = createRequire(import.meta.url);
const { PNG } = require(resolve("node_modules/.pnpm/pngjs@7.0.0/node_modules/pngjs"));

const args = process.argv.slice(2);
const BASE = args.includes("--base") ? args[args.indexOf("--base") + 1] : process.env.BUILDER_URL ?? "http://localhost:5173";
const OUT = args.includes("--out") ? args[args.indexOf("--out") + 1] : null;
const findings = [];
const record = (name, pass, detail) => {
  findings.push({ name, pass, detail });
  console.log(`[adr234 tag selected] ${pass ? "PASS" : "FAIL"} — ${name} :: ${JSON.stringify(detail)}`);
};

const browser = await chromium.launch({ headless: false });
const { page } = await createInstrumentedContext(browser, {
  storageState: loadStorageState(resolve("apps/builder/scripts/.auth-session.json")),
  cpuThrottle: 1,
  deviceScaleFactor: 1,
});
const errors = [];
page.on("pageerror", (e) => errors.push(String(e.stack ?? e).slice(0, 1200)));
await createIsolatedProject(page, BASE);
await page.waitForTimeout(1500);

const sceneBounds = (id) =>
  page.evaluate((id) => {
    const b = window.__composition_RENDER_DEBUG__.getSceneBounds(id);
    const l = window.__composition_LAYOUT_DEBUG__.getSharedLayoutMap().get(id);
    return b && l ? { x: b.x, y: b.y, w: l.width, h: l.height } : null;
  }, id);
const waitBounds = async (id, ms = 10_000) => {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const b = await sceneBounds(id);
    if (b) return b;
    await page.waitForTimeout(300);
  }
  return null;
};
/** scene (x, y) 가 캔버스 (160, 200) 에 오게 pan (scale 1) · 선택 해제. */
const focusScene = async (scene) => {
  await page.evaluate((scene) => {
    window.__composition_APPLY_VIEWPORT__?.({ scale: 1, x: 160 - scene.x, y: 200 - scene.y });
    window.__composition_STORE__.getState().setSelectedElement(null);
  }, scene);
  await page.mouse.move(2, 890);
  await page.waitForTimeout(1200);
};
/** bounds 안쪽 (3px 여백) 픽셀 중 채도 높은 (accent 배경) 비율. */
const saturatedRatio = async (boundsMap) => {
  const box = await page.locator("canvas").first().boundingBox();
  const vp = await page.evaluate(() => {
    const v = window.__composition_VIEWPORT__();
    return { pan: v.panOffset ?? { x: 0, y: 0 }, zoom: v.zoom ?? 1 };
  });
  const shot = await page.screenshot({ type: "png", animations: "disabled" });
  if (OUT) writeFileSync(OUT.replace(/\.png$/, `-${Object.keys(boundsMap).join("")}-${Date.now()}.png`), shot);
  const png = PNG.sync.read(shot);
  const out = {};
  for (const [key, b] of Object.entries(boundsMap)) {
    if (!b) {
      out[key] = null;
      continue;
    }
    const x0 = Math.round(box.x + vp.pan.x + b.x * vp.zoom) + 3;
    const y0 = Math.round(box.y + vp.pan.y + b.y * vp.zoom) + 3;
    const x1 = Math.round(box.x + vp.pan.x + (b.x + b.w) * vp.zoom) - 3;
    const y1 = Math.round(box.y + vp.pan.y + (b.y + b.h) * vp.zoom) - 3;
    let sat = 0;
    let n = 0;
    for (let y = y0; y < y1; y += 1) {
      for (let x = x0; x < x1; x += 1) {
        const i = (y * png.width + x) * 4;
        const r = png.data[i];
        const g = png.data[i + 1];
        const bl = png.data[i + 2];
        if (Math.max(r, g, bl) - Math.min(r, g, bl) > 60) sat += 1;
        n += 1;
      }
    }
    out[key] = n ? Math.round((sat / n) * 1000) / 1000 : 0;
  }
  return out;
};

// ① Home — TagGroup instance, 첫 Tag 만 선택.
const firstKeys = await page.evaluate(() => {
  const st = window.__composition_STORE__.getState();
  return st.elements
    .filter((e) => e.parent_id === "component-taggroup__2")
    .map((e) => ({ id: e.id, key: e.props?.id }));
});
await page.evaluate(async (key) => {
  const st = window.__composition_STORE__.getState();
  const body = st.elements.find((e) => e.type === "body" && e.page_id === st.currentPageId);
  const now = new Date().toISOString();
  await st.addComplexElement(
    {
      id: "tg-sel",
      customId: "tg-sel",
      type: "ref",
      ref: "component-taggroup",
      componentName: "TagGroup",
      parent_id: body.id,
      page_id: st.currentPageId,
      order_num: 0,
      created_at: now,
      updated_at: now,
      props: { selectedKeys: [key] },
    },
    [],
  );
}, String(firstKeys[0].key));
await page.waitForTimeout(1500);
const chip = (i) => `tg-sel/component-taggroup__2/${firstKeys[i].id}`;
const homeSel = await waitBounds(chip(0));
const homeIdle = await sceneBounds(chip(1));
if (homeSel) await focusScene(homeSel);
const home = await saturatedRatio({ selected: await sceneBounds(chip(0)), idle: await sceneBounds(chip(1)) });
record("Home TagGroup instance — 선택 chip accent 배경 · 비선택 chip 아님", home.selected > 0.5 && home.idle < 0.05, {
  home,
  homeSel,
  homeIdle,
});

// ② Components 페이지 origin — Tag/Selected · Tag/Default.
const pagePos = await page.evaluate(() => {
  const st = window.__composition_STORE__.getState();
  const positions = st.pagePositions;
  return (positions instanceof Map ? positions.get("page-components") : positions?.["page-components"]) ?? null;
});
if (pagePos) await focusScene(pagePos);
const selB = await waitBounds("component-tag-item-default");
const idleB = await waitBounds("component-tag-item-default--unselected");
if (selB) await focusScene(selB);
const comp = await saturatedRatio({
  selected: await sceneBounds("component-tag-item-default"),
  idle: await sceneBounds("component-tag-item-default--unselected"),
});
record("Components 페이지 Tag/Selected accent 배경 · Tag/Default 아님", comp.selected > 0.5 && comp.idle < 0.05, {
  comp,
  selB,
  idleB,
  pagePos,
});
record("page error 0", errors.length === 0, errors.slice(0, 5));
await browser.close();
console.log(`[adr234 tag selected] ${findings.filter((f) => f.pass).length}/${findings.length}`);
