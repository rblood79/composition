import { chromium } from "playwright";
import { resolve } from "node:path";
import { mkdirSync } from "node:fs";
const OUT = "/private/tmp/claude-501/-Users-admin-work-composition/f6bcc488-f176-4644-8364-3625704b801c/scratchpad/props-after"; mkdirSync(OUT, { recursive: true });
const READY = () => Boolean(window.__composition_STORE__ && window.__composition_STORE__.getState().currentPageId && document.querySelector(".app:not(.builder-booting)") && document.querySelector('[data-testid="skia-canvas-unified"]'));
const browser = await chromium.launch({ headless: false });
const page = await (await browser.newContext({ storageState: resolve("apps/builder/scripts/.auth-session.json"), viewport: { width: 1600, height: 3000 }, deviceScaleFactor: 1 })).newPage();
const errors = []; page.on("pageerror", (e) => errors.push(e.message));
await page.goto("http://localhost:5173/dashboard", { waitUntil: "networkidle" });
const b = page.locator("button.dashboard-create-button").first(); await b.waitFor({ state: "visible", timeout: 15000 }); await b.click();
const i = page.locator("#new-project-name"); await i.waitFor({ state: "visible" }); await i.fill(`mi-${Date.now()}`); await i.press("Enter");
await page.waitForURL(/\/builder\/[^/?]+$/, { timeout: 60000 }); await page.waitForFunction(READY, undefined, { timeout: 90000 }); await page.waitForTimeout(1200);
const panel = async (name) => { await page.getByRole("button", { name, exact: true }).first().click(); await page.waitForTimeout(400); };
const P = '[data-panel-id="properties"]';
const shot = async (name) => { await page.evaluate((P) => { const pc = document.querySelector(`${P} .panel-contents`); const h = pc.scrollHeight + 8; let el = pc; while (el && !el.classList.contains("panel-dock-surface")) { el.style.setProperty("height", el === pc ? h + "px" : "auto", "important"); el.style.setProperty("max-height", "none", "important"); el.style.setProperty("overflow", "visible", "important"); el = el.parentElement; } }, P); await page.waitForTimeout(200); await page.locator(`${P} .panel-contents`).screenshot({ path: `${OUT}/${name}.png` }); await page.evaluate((P) => { let el = document.querySelector(`${P} .panel-contents`); while (el && !el.classList.contains("panel-dock-surface")) { el.style.cssText = ""; el = el.parentElement; } }, P); };
const add = async (re) => { await panel("Components"); const item = page.locator('[data-panel-id="components"] button.list-item, [data-panel-id="components"] [data-component-type]').filter({ hasText: re }).first(); await item.scrollIntoViewIfNeeded(); await item.click(); await page.waitForTimeout(900); await panel("Components").catch(() => {}); };
// body
await page.evaluate(() => { const st = window.__composition_STORE__.getState(); const body = st.elements.find((e) => e.page_id === st.currentPageId && e.type === "body"); st.setSelectedElement(body.id, body.props); }); await page.waitForTimeout(500);
await panel("Properties"); await page.waitForTimeout(300);
await page.evaluate((P) => { document.querySelectorAll(`${P} .section-caret[aria-expanded="false"]`).forEach((c) => c.click()); }, P); await page.waitForTimeout(300);
await shot("misc-body");
await panel("Properties");
for (const [name, re] of [["frame", /^frame$/i], ["chart", /chart/i], ["button", /^button$/i]]) {
  await add(re);
  await panel("Properties"); await page.waitForTimeout(300);
  await page.evaluate((P) => { document.querySelectorAll(`${P} .section-caret[aria-expanded="false"]`).forEach((c) => c.click()); }, P); await page.waitForTimeout(300);
  await shot(`misc-${name}`);
  await panel("Properties");
}
console.log("errors", errors.slice(0, 5));
await browser.close();
