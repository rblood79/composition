import { chromium } from "playwright";
import { resolve } from "node:path";
const READY = () => Boolean(window.__composition_STORE__ && window.__composition_STORE__.getState().currentPageId && document.querySelector(".app:not(.builder-booting)") && document.querySelector('[data-testid="skia-canvas-unified"]'));
const browser = await chromium.launch({ headless: false });
const page = await (await browser.newContext({ storageState: resolve("apps/builder/scripts/.auth-session.json"), viewport: { width: 1600, height: 1100 } })).newPage();
await page.goto("http://localhost:5173/dashboard", { waitUntil: "networkidle" });
const b = page.locator("button.dashboard-create-button").first(); await b.waitFor({ state: "visible", timeout: 15000 }); await b.click();
const i = page.locator("#new-project-name"); await i.waitFor({ state: "visible" }); await i.fill(`cp-${Date.now()}`); await i.press("Enter");
await page.waitForURL(/\/builder\/[^/?]+$/, { timeout: 60000 }); await page.waitForFunction(READY, undefined, { timeout: 90000 }); await page.waitForTimeout(1200);
await page.evaluate(async () => { const st = window.__composition_STORE__.getState(); const body = st.elements.find(e => e.type === "body" && e.page_id === st.currentPageId) ?? st.elements.find(e => e.type === "body"); const now = new Date().toISOString(); const id = crypto.randomUUID(); await st.addElement({ id, type: "Button", parent_id: body.id, page_id: body.page_id, order_num: 99, created_at: now, updated_at: now, props: { children: "Primary action" } }, { skipHistory: true }); await new Promise(r => setTimeout(r, 800)); const st2 = window.__composition_STORE__.getState(); st2.setSelectedElement(id, st2.elements.find(e => e.id === id)?.props); });
await page.waitForTimeout(600);
await page.getByRole("button", { name: "Styles", exact: true }).first().click(); await page.waitForTimeout(500);
for (let t = 0; t < 4; t++) {
  await page.locator(".styles-panel-tab").nth(t).click(); await page.waitForTimeout(400);
  const info = await page.evaluate(() => ({
    swatch: Array.from(document.querySelectorAll('[data-panel-id="styles"] .color-swatch-button')).map(e => e.getAttribute("aria-label")),
    fill: document.querySelectorAll('[data-panel-id="styles"] .fill-layer-row__swatch-btn').length,
    sections: Array.from(document.querySelectorAll('[data-panel-id="styles"] .property-section-title, [data-panel-id="styles"] .section > header, [data-panel-id="styles"] h3')).map(e => e.textContent.trim()).slice(0, 12),
  }));
  console.log("tab", t, JSON.stringify(info));
}
await page.locator(".styles-panel-tab").nth(1).click(); await page.waitForTimeout(400);
const sw = page.locator('[data-panel-id="styles"] .color-swatch-button').first();
console.log("swatch count", await sw.count());
if (await sw.count()) { await sw.click(); await page.waitForTimeout(800);
  console.log(await page.evaluate(() => Array.from(document.querySelectorAll(".react-aria-Popover, [data-rac] [role=dialog], .property-color-popover")).map(e => e.className + " " + e.getBoundingClientRect().width + "x" + e.getBoundingClientRect().height)));
}
await browser.close();
