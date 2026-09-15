import { chromium } from "playwright";
import { resolve } from "node:path";
const READY = () => Boolean(window.__composition_STORE__ && window.__composition_STORE__.getState().currentPageId && document.querySelector(".app:not(.builder-booting)") && document.querySelector('[data-testid="skia-canvas-unified"]'));
const browser = await chromium.launch({ headless: false });
const page = await (await browser.newContext({ storageState: resolve("apps/builder/scripts/.auth-session.json"), viewport: { width: 1600, height: 3000 }, deviceScaleFactor: 1 })).newPage();
const errors = []; page.on("pageerror", (e) => errors.push(e.message));
await page.goto("http://localhost:5173/dashboard", { waitUntil: "networkidle" });
const b = page.locator("button.dashboard-create-button").first(); await b.waitFor({ state: "visible", timeout: 15000 }); await b.click();
const i = page.locator("#new-project-name"); await i.waitFor({ state: "visible" }); await i.fill(`gt-${Date.now()}`); await i.press("Enter");
await page.waitForURL(/\/builder\/[^/?]+$/, { timeout: 60000 }); await page.waitForFunction(READY, undefined, { timeout: 90000 }); await page.waitForTimeout(1200);
const panel = async (name) => { await page.getByRole("button", { name, exact: true }).first().click(); await page.waitForTimeout(400); };
const P = '[data-panel-id="properties"]';
const legends = () => page.evaluate((P) => Array.from(document.querySelectorAll(`${P} fieldset.properties-aria > legend`)).map((l) => l.textContent.trim()), P);
const set = async (props) => { await page.evaluate((props) => window.__composition_STORE__.getState().updateSelectedProperties(props), props); await page.waitForTimeout(400); };
const cases = [
  ["text field", { labelPosition: "side" }, "Label Align"],
  ["date field", { granularity: "hour" }, "Hour Cycle"],
  ["progress bar", { showValueLabel: false }, "Value Label"],
];
for (const [name, props, legend] of cases) {
  await panel("Components"); await page.locator('[data-panel-id="components"] button.list-item').filter({ hasText: new RegExp(`^${name}$`, "i") }).first().click(); await page.waitForTimeout(900); await panel("Components");
  await panel("Properties"); await page.waitForTimeout(300);
  const before = (await legends()).includes(legend);
  const propsBefore = await page.evaluate(() => { const st = window.__composition_STORE__.getState(); return st.elementsMap.get(st.selectedElementId)?.props; });
  await set(props);
  const after = (await legends()).includes(legend);
  console.log(`${name}: 「${legend}」 before=${before} → after=${after} (props before: ${JSON.stringify(Object.fromEntries(Object.entries(propsBefore).filter(([k]) => k in props || k === "showValueLabel" || k === "granularity" || k === "labelPosition")))})`);
  await panel("Properties");
  await page.evaluate(() => { const st = window.__composition_STORE__.getState(); st.removeElement?.(st.selectedElementId); }); await page.waitForTimeout(300);
}
console.log("errors", errors.slice(0, 5));
await browser.close();
