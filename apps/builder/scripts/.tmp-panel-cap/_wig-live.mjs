import { chromium } from "playwright";
import { resolve } from "node:path";
const READY = () => Boolean(window.__composition_STORE__ && window.__composition_STORE__.getState().currentPageId && document.querySelector(".app:not(.builder-booting)") && document.querySelector('[data-testid="skia-canvas-unified"]'));
const browser = await chromium.launch({ headless: false });
const page = await (await browser.newContext({ storageState: resolve("apps/builder/scripts/.auth-session.json"), viewport: { width: 1600, height: 1400 } })).newPage();
const errors = []; page.on("pageerror", (e) => errors.push(String(e))); page.on("console", (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 200)); });
await page.goto("http://localhost:5173/dashboard", { waitUntil: "networkidle" });
const b = page.locator("button.dashboard-create-button").first(); await b.waitFor({ state: "visible" }); await b.click();
const i = page.locator("#new-project-name"); await i.waitFor({ state: "visible" }); await i.fill(`wig-${Date.now()}`); await i.press("Enter");
await page.waitForURL(/\/builder\/[^/?]+$/, { timeout: 60000 }); await page.waitForFunction(READY, undefined, { timeout: 90000 }); await page.waitForTimeout(1200);
const panel = async (name, want) => { const btn = page.getByRole("button", { name, exact: true }).first(); const pressed = await btn.getAttribute("aria-pressed"); if ((pressed === "true") !== want) { await btn.click(); await page.waitForTimeout(400); } };
await panel("Components", true); await page.locator("button.list-item").filter({ has: page.locator(".list-item-name", { hasText: /^Button$/i }) }).first().click(); await page.waitForTimeout(800); await panel("Components", false); await panel("Properties", true); await page.waitForTimeout(400);
const P = '[data-panel-id="properties"]';
await page.evaluate((P) => { document.querySelectorAll(`${P} .section-caret[aria-expanded="false"]`).forEach((c) => c.click()); }, P); await page.waitForTimeout(300);

// ---- Icon picker
const trig = page.locator(`${P} .icon-picker-input-trigger`).first(); await trig.scrollIntoViewIfNeeded(); await trig.click(); await page.waitForTimeout(600);
const gridInfo = async () => page.evaluate(() => { const g = document.querySelector(".icon-picker-grid"); if (!g) return "no grid"; const items = g.querySelectorAll('[role="option"]'); const r = g.getBoundingClientRect(); const first = items[0]?.getBoundingClientRect(); const second = items[1]?.getBoundingClientRect(); const row2 = Array.from(items).find((el) => el.getBoundingClientRect().top > (first?.top ?? 0) + 5)?.getBoundingClientRect(); return { rendered: items.length, count: document.querySelector(".icon-picker-count")?.textContent, box: `${Math.round(r.width)}x${Math.round(r.height)}`, cell: first ? `${Math.round(first.width)}x${Math.round(first.height)}` : null, colGap: first && second ? Math.round(second.left - first.right) : null, rowGap: first && row2 ? Math.round(row2.top - first.bottom) : null, cols: first ? Array.from(items).filter((el) => Math.abs(el.getBoundingClientRect().top - first.top) < 1).length : 0, focused: document.activeElement?.className, activeDesc: document.activeElement?.getAttribute("aria-activedescendant"), focusedItem: g.querySelector("[data-focused]")?.getAttribute("aria-label") ?? g.querySelector("[data-focused]")?.textContent }; });
console.log("open:", JSON.stringify(await gridInfo()));
await page.keyboard.press("ArrowDown"); await page.waitForTimeout(150);
await page.keyboard.press("ArrowRight"); await page.waitForTimeout(150);
console.log("after ↓→:", JSON.stringify(await page.evaluate(() => { const g = document.querySelector(".icon-picker-grid"); const f = g?.querySelector("[data-focused]"); return { activeDesc: document.activeElement?.getAttribute("aria-activedescendant"), focusedId: f?.id, focusedIndex: f ? Array.from(g.querySelectorAll('[role="option"]')).indexOf(f) : -1, outline: f ? getComputedStyle(f).outlineWidth : null }; })));
await page.keyboard.type("arrow"); await page.waitForTimeout(500);
console.log("typed 'arrow':", JSON.stringify(await gridInfo()));
// scroll deep with End
await page.keyboard.press("End"); await page.waitForTimeout(300);
console.log("End:", JSON.stringify(await page.evaluate(() => { const g = document.querySelector(".icon-picker-grid"); const f = g?.querySelector("[data-focused]"); return { scrollTop: g?.scrollTop, focusedId: f?.id, rendered: g?.querySelectorAll('[role="option"]').length }; })));
await page.keyboard.press("Enter"); await page.waitForTimeout(600);
console.log("Enter → closed:", await page.evaluate(() => !document.querySelector(".icon-picker-grid")), "value:", await page.evaluate((P) => document.querySelector(`${P} .icon-picker-value`)?.textContent, P));
// reopen, mouse click selects + shows selected
await trig.click(); await page.waitForTimeout(600);
console.log("reopen selected:", JSON.stringify(await page.evaluate(() => { const g = document.querySelector(".icon-picker-grid"); const s = g?.querySelector("[data-selected]"); return { selectedId: s?.id, bg: s ? getComputedStyle(s).backgroundColor : null, scrollTop: g?.scrollTop }; })));
await page.locator('.icon-picker-grid [role="option"]').nth(3).click(); await page.waitForTimeout(600);
console.log("click → closed:", await page.evaluate(() => !document.querySelector(".icon-picker-grid")), "value:", await page.evaluate((P) => document.querySelector(`${P} .icon-picker-value`)?.textContent, P));

// ---- Gradient bar (Styles panel → Fill → gradient)
await panel("Properties", false); await panel("Styles", true); await page.waitForTimeout(400);
const S = '[data-panel-id="styles"]';
await page.evaluate((S) => { document.querySelectorAll(`${S} .section-caret[aria-expanded="false"]`).forEach((c) => c.click()); }, S); await page.waitForTimeout(300);
console.log("fill rows:", await page.evaluate((S) => Array.from(document.querySelectorAll(`${S} .fill-layer-row, ${S} [class*="fill-layer"]`)).slice(0,5).map((e) => e.className), S));
console.log("errors:", errors);
await browser.close();
