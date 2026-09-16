import { chromium } from "playwright";
import { resolve } from "node:path";
const OUT = process.env.OUT;
const READY = () => Boolean(window.__composition_STORE__ && window.__composition_STORE__.getState().currentPageId && document.querySelector(".app:not(.builder-booting)") && document.querySelector('[data-testid="skia-canvas-unified"]'));
const browser = await chromium.launch({ headless: false });
const page = await (await browser.newContext({ storageState: resolve("apps/builder/scripts/.auth-session.json"), viewport: { width: 1600, height: 1400 }, deviceScaleFactor: 2 })).newPage();
const errors = []; page.on("pageerror", (e) => errors.push(e.message));
await page.goto("http://localhost:5173/dashboard", { waitUntil: "networkidle" });
const b = page.locator("button.dashboard-create-button").first(); await b.waitFor({ state: "visible", timeout: 15000 }); await b.click();
const i = page.locator("#new-project-name"); await i.waitFor({ state: "visible" }); await i.fill(`vg-${Date.now()}`); await i.press("Enter");
await page.waitForURL(/\/builder\/[^/?]+$/, { timeout: 60000 }); await page.waitForFunction(READY, undefined, { timeout: 90000 }); await page.waitForTimeout(1200);
const panel = async (name, want) => { const btn = page.getByRole("button", { name, exact: true }).first(); const pressed = await btn.getAttribute("aria-pressed"); if ((pressed === "true") !== want) { await btn.click(); await page.waitForTimeout(400); } };
const P = '[data-panel-id="properties"]';
const pick = async (type) => { await panel("Components", true); await page.locator("button.list-item").filter({ has: page.locator(".list-item-name", { hasText: new RegExp(`^${type}$`, "i") }) }).first().click(); await page.waitForTimeout(800); await panel("Components", false); await panel("Properties", true); await page.waitForTimeout(400); await page.evaluate((P) => { document.querySelectorAll(`${P} .section-caret[aria-expanded="false"]`).forEach((c) => c.click()); }, P); await page.waitForTimeout(300); };
for (const type of ["Badge", "Status ?Light"]) {
  await pick(type);
  const grp = page.locator(`${P} .properties-aria`).filter({ has: page.locator("legend", { hasText: /^Variant$/ }) }).first();
  const trig = grp.locator(".react-aria-Select .react-aria-Button");
  console.log(type, "trigger", JSON.stringify(await trig.boundingBox()), (await trig.textContent()).trim());
  await trig.click(); await page.waitForTimeout(500);
  const info = await page.evaluate(() => { const lb = document.querySelector('.property-select-popover--grid .react-aria-ListBox'); if (!lb) return null; const pop = lb.closest(".react-aria-Popover").getBoundingClientRect(); const secs = Array.from(lb.querySelectorAll(".property-select-grid__section")).map((s) => ({ n: s.querySelectorAll('[role="option"]').length, cols: getComputedStyle(s).gridTemplateColumns.split(" ").length })); const it = lb.querySelector('[role="option"]').getBoundingClientRect(); const sel = lb.querySelector('[role="option"][aria-selected="true"]'); return { pop: `${Math.round(pop.width)}×${Math.round(pop.height)} left=${Math.round(pop.left)}`, secs, item: `${Math.round(it.width)}×${Math.round(it.height)}`, selected: sel?.getAttribute("aria-label"), check: Boolean(sel?.querySelector(".property-select-grid__check")), layout: lb.getAttribute("data-layout") }; });
  console.log(type, "popover", JSON.stringify(info));
  console.log(type, "check geo", JSON.stringify(await page.evaluate(() => { const sel = document.querySelector('.property-select-grid [role="option"][aria-selected="true"]'); const sw = sel.querySelector(".property-select-grid__swatch"); const ck = sel.querySelector(".property-select-grid__check"); const r = (e) => { const b = e.getBoundingClientRect(); return `${Math.round(b.left)},${Math.round(b.top)} ${Math.round(b.width)}×${Math.round(b.height)}`; }; const cs = getComputedStyle(ck); const ss = getComputedStyle(sw); return { sel: r(sel), sw: r(sw), ck: r(ck), ckPos: cs.position, ckMargin: cs.margin, ckTransform: cs.transform, swDisplay: ss.display, swPos: ss.position }; })));
  await page.screenshot({ path: `${OUT}/${type.replace(/\W/g, "")}-open.png`, clip: { x: 1300, y: 60, width: 300, height: 520 } });
  // keyboard: ArrowRight then ArrowDown → Enter
  await page.keyboard.press("ArrowRight"); await page.keyboard.press("ArrowDown"); await page.waitForTimeout(200);
  console.log(type, "focused", await page.evaluate(() => document.activeElement?.getAttribute("aria-label") ?? document.querySelector('.property-select-grid [data-focused]')?.getAttribute("aria-label")));
  await page.keyboard.press("Enter"); await page.waitForTimeout(600);
  console.log(type, "after enter variant", await page.evaluate(() => { const s = window.__composition_STORE__.getState(); return s.elementsMap.get(s.selectedElementId).props.variant; }), "trigger", (await trig.textContent()).trim());
  // mouse click a hue
  await trig.click(); await page.waitForTimeout(400);
  await page.locator('.property-select-grid [role="option"][aria-label="Purple"]').click(); await page.waitForTimeout(600);
  console.log(type, "after click variant", await page.evaluate(() => { const s = window.__composition_STORE__.getState(); return s.elementsMap.get(s.selectedElementId).props.variant; }), "open?", await page.locator(".property-select-popover--grid").count());
  await grp.screenshot({ path: `${OUT}/${type.replace(/\W/g, "")}-closed.png` });
}
console.log("errors", errors.slice(0, 5));
await browser.close();
