import { chromium } from "playwright";
import { resolve } from "node:path";
const OUT = "/private/tmp/claude-501/-Users-admin-work-composition/f6bcc488-f176-4644-8364-3625704b801c/scratchpad/audit";
const READY = () => Boolean(window.__composition_STORE__ && window.__composition_STORE__.getState().currentPageId && document.querySelector(".app:not(.builder-booting)") && document.querySelector('[data-testid="skia-canvas-unified"]'));
const browser = await chromium.launch({ headless: false });
const page = await (await browser.newContext({ storageState: resolve("apps/builder/scripts/.auth-session.json"), viewport: { width: 1600, height: 1400 }, deviceScaleFactor: 2 })).newPage();
await page.goto("http://localhost:5173/dashboard", { waitUntil: "networkidle" });
const b = page.locator("button.dashboard-create-button").first(); await b.waitFor({ state: "visible", timeout: 15000 }); await b.click();
const i = page.locator("#new-project-name"); await i.waitFor({ state: "visible" }); await i.fill(`ps-${Date.now()}`); await i.press("Enter");
await page.waitForURL(/\/builder\/[^/?]+$/, { timeout: 60000 }); await page.waitForFunction(READY, undefined, { timeout: 90000 }); await page.waitForTimeout(1200);
const panel = async (name) => { await page.getByRole("button", { name, exact: true }).first().click(); await page.waitForTimeout(400); };
const P = '[data-panel-id="properties"]';
for (const name of process.argv.slice(2)) {
  await panel("Components");
  await page.locator("button.list-item").filter({ has: page.locator(".list-item-name", { hasText: new RegExp(`^${name}$`, "i") }) }).first().click(); await page.waitForTimeout(900);
  await panel("Components").catch(() => {});
  if (!(await page.locator(`${P} .panel-contents`).isVisible().catch(() => false))) { await panel("Properties"); } await page.waitForTimeout(400);
  await page.evaluate((P) => { document.querySelectorAll(`${P} .section-caret[aria-expanded="false"]`).forEach((c) => c.click()); }, P); await page.waitForTimeout(300);
  console.log(name, await page.evaluate((P) => Array.from(document.querySelectorAll(`${P} .section-content fieldset.properties-aria`)).map((f) => { const r = f.getBoundingClientRect(); const lg = f.querySelector("legend"); const ctl = f.querySelector(":scope > .react-aria-Group, :scope > .react-aria-control, :scope > .react-aria-ToggleButtonGroup, .react-aria-Group"); const cr = ctl?.getBoundingClientRect(); const chips = Array.from(f.querySelectorAll(".react-aria-ToggleButton")).map((c) => Math.round(c.getBoundingClientRect().width * 10) / 10); return `${(lg?.textContent ?? f.getAttribute("aria-label") ?? "?").trim()} ${Math.round(r.width)}×${Math.round(r.height)} legend:${lg ? "Y" : "N"} box:${cr ? `${Math.round(cr.width)}×${Math.round(cr.height)}` : "-"}${chips.length ? ` chips:${chips.join("/")}` : ""} steppers:${f.querySelectorAll(".react-aria-NumberField-button, .property-unit-input__step").length}`; }), P));
  await page.locator(`${P}`).screenshot({ path: `${OUT}/props-${name.replace(/\W/g, "_")}.png` });
  const app = page.locator(`${P} .section[data-section-id="appearance"], ${P} .section`).filter({ hasText: /Appearance/ }).first(); await app.scrollIntoViewIfNeeded().catch(() => {}); await page.waitForTimeout(200);
  await page.locator(`${P}`).screenshot({ path: `${OUT}/props-${name.replace(/\W/g, "_")}-2.png` });
}
await browser.close();
