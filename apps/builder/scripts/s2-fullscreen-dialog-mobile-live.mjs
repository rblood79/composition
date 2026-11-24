#!/usr/bin/env node
// S2 FullscreenDialog 제목 줄 — desktop row · mobile column live 대조 (2026-11-24 사용자 「모바일에서는 column 이 되어야 짤리지 않는다」).
// Canvas: 같은 노드의 그리는 layout (desktop · Mobile breakpoint). Publish: 창 1400 · 390 에서 연 Dialog 의 computed 값 · 자식이 Dialog 밖으로 넘치는지.
//   node apps/builder/scripts/s2-fullscreen-dialog-mobile-live.mjs <out-dir>
import { readFileSync, mkdirSync } from "node:fs";
import { chromium } from "playwright";
const OUT = process.argv[2]; mkdirSync(OUT, { recursive: true });
const BASE = "http://localhost:5173";
const state = JSON.parse(readFileSync(`${process.cwd()}/apps/builder/scripts/.auth-session.json`, "utf8"));
state.origins = (state.origins ?? []).map((o) => ({ ...o, origin: BASE }));
const browser = await chromium.launch({ headless: false, channel: "chrome" });
const context = await browser.newContext({ storageState: state, viewport: { width: 1400, height: 900 } });
const errors = [];
const page = await context.newPage();
page.on("pageerror", (e) => errors.push(e.message));
try {
  await page.goto(`${BASE}/dashboard`);
  await page.getByRole("button", { name: /new project/i }).first().click();
  await page.waitForTimeout(300);
  await page.keyboard.type("FSD mobile column");
  await page.keyboard.press("Enter");
  await page.waitForURL(/\/builder\//, { timeout: 30000 });
  await page.waitForFunction(() => window.__COMPOSITION_CATALOG__?.workspace, null, { timeout: 30000 });
  await page.waitForTimeout(1500);
  const canvas = await page.evaluate(() => {
    const h = window.__COMPOSITION_CATALOG__; const ws = h.workspace;
    const ctx = () => ({ graph: ws.runtime.graph, records: ws.root.domInputs, selection: () => ws.session.getSnapshot().selection, itemOfRecord: (i) => ws.itemOfRecord(i), pageContent: () => ({ kind: "node", id: "project:node:home-body" }), newId: ws.newId });
    ws.execute(h.palette.catalogPaletteInsertPlan(ctx(), "FullscreenDialog").command);
    const read = () => {
      const root = ws.root; const recs = [...root.canvasInputs.values()];
      const dialog = recs.find((r) => root.typeOf(r) === "Dialog");
      const header = recs.find((r) => r.parentId === dialog.id && root.typeOf(r) === "frame");
      const s = root.getDrawnLayoutStyle(header.id) ?? {};
      return { id: header.id, flexDirection: s.flexDirection, alignItems: s.alignItems };
    };
    const desktop = read(); ws.setBreakpoint("mobile"); const mobile = read(); ws.setBreakpoint("desktop");
    const trigger = [...ws.root.canvasInputs.values()].find((r) => ws.root.typeOf(r) === "Button");
    return { desktop, mobile, trigger: trigger.id };
  });
  await page.waitForTimeout(1500);
  const popup = context.waitForEvent("page", { timeout: 30000 });
  await page.evaluate(() => [...document.querySelectorAll("button")].find((b) => ["Preview", "미리보기"].includes(b.getAttribute("aria-label")))?.click());
  const pub = await popup; await pub.bringToFront();
  await pub.waitForSelector("[data-catalog-id]", { timeout: 60000 }); await pub.waitForTimeout(1500);
  const dom = {};
  for (const [name, width] of [["desktop", 1400], ["mobile", 390]]) {
    await pub.setViewportSize({ width, height: 844 }); await pub.waitForTimeout(800);
    await pub.locator(`[data-catalog-id="${canvas.trigger}"]`).first().click(); await pub.waitForTimeout(800);
    dom[name] = await pub.evaluate((id) => {
      const el = document.querySelector(`[data-catalog-id="${id}"]`); if (!el) return null;
      const cs = getComputedStyle(el); const r = el.getBoundingClientRect(); const d = el.closest('[role="dialog"]').getBoundingClientRect();
      const overflow = [...el.children].some((c) => c.getBoundingClientRect().right > d.right + 0.5);
      return { flexDirection: cs.flexDirection, alignItems: cs.alignItems, width: Math.round(r.width), childOverflow: overflow };
    }, canvas.desktop.id);
    await pub.screenshot({ path: `${OUT}/${name}.png` });
    await pub.keyboard.press("Escape"); await pub.waitForTimeout(500);
  }
  console.log(JSON.stringify({ canvas, dom, errors }, null, 1));
} finally { await browser.close(); }
