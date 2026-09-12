import { chromium } from "playwright";
import { resolve } from "node:path";
const BASE_URL = "http://localhost:5173";
const READY = () => Boolean(window.__composition_STORE__ && window.__composition_STORE__.getState().currentPageId && document.querySelector(".app:not(.builder-booting)") && document.querySelector('[data-testid="skia-canvas-unified"]'));
const browser = await chromium.launch({ headless: false });
const ctx = await browser.newContext({ storageState: resolve("apps/builder/scripts/.auth-session.json"), viewport: { width: 1600, height: 1000 } });
const page = await ctx.newPage();
await page.goto(`${BASE_URL}/dashboard`, { waitUntil: "networkidle" });
const btn = page.locator("button.dashboard-create-button").first(); await btn.waitFor({ state: "visible" }); await btn.click();
const input = page.locator("#new-project-name"); await input.waitFor({ state: "visible" }); await input.fill(`panel-measure-${Date.now()}`); await input.press("Enter");
await page.waitForURL(/\/builder\/[^/?]+$/, { timeout: 60_000 }); await page.waitForFunction(READY, undefined, { timeout: 90_000 }); await page.waitForTimeout(1500);
await page.evaluate(async () => { const st = window.__composition_STORE__.getState(); const body = st.elements.find(e => e.type === "body"); const id = crypto.randomUUID(); const now = new Date().toISOString();
  await st.addElement({ id, type: "Button", parent_id: body.id, page_id: body.page_id, order_num: 99, created_at: now, updated_at: now, props: { children: "x", style: {} } }, { skipHistory: true });
  await new Promise(r => setTimeout(r, 600)); window.__composition_STORE__.getState().setSelectedElement(id, window.__composition_STORE__.getState().elements.find(e => e.id === id)?.props); });
await page.waitForTimeout(500);
await page.getByRole("button", { name: "Styles", exact: true }).first().click(); await page.waitForTimeout(600);
const out = await page.evaluate(() => {
  const p = document.querySelector('[data-panel-id="styles"]');
  const r = (el) => { const b = el.getBoundingClientRect(); return [Math.round(b.width*10)/10, Math.round(b.height*10)/10]; };
  const pick = (sel, n = 3) => [...p.querySelectorAll(sel)].slice(0, n).map(e => ({ sel, cls: e.className?.baseVal ?? String(e.className).slice(0, 60), wh: r(e) }));
  return {
    panel: r(p), content: r(p.querySelector(".section-content")),
    rows: [
      ...pick(".direction-controls .react-aria-ToggleButtonGroup", 1), ...pick(".direction-controls .react-aria-ToggleButton", 1),
      ...pick(".direction-alignment-grid .react-aria-ToggleButtonGroup", 1), ...pick(".direction-alignment-grid .react-aria-ToggleButton", 1),
      ...pick(".justify-control .react-aria-ToggleButtonGroup", 2), ...pick(".fieldset-actions button", 2),
      ...pick(".displayGap", 1), ...pick(".react-aria-Group", 3), ...pick(".react-aria-Input", 2), ...pick(".react-aria-Select", 2), ...pick(".react-aria-Select .react-aria-Button", 2),
      ...pick(".layout-direction", 1), ...pick(".layout-container", 1), ...pick(".fieldset-legend", 1), ...pick(".panel-tab", 2), ...pick(".panel-header", 1), ...pick(".section-header", 1), ...pick(".panel-header .action-icon-button", 1),
    ],
    gridCols: [".layout-direction", ".layout-container", ".section-content", ".properties-aria"].map(s => { const e = p.querySelector(s); return e ? [s, getComputedStyle(e).display, getComputedStyle(e).gridTemplateColumns, getComputedStyle(e).gap] : [s, null]; }),
    vars: ["--control-size", "--control-size-lg", "--inspector-label-width", "--text-2xl", "--spacing", "--spacing-sm"].map(v => [v, getComputedStyle(p).getPropertyValue(v)]),
  };
});
console.log(JSON.stringify(out, null, 1));
await browser.close();
