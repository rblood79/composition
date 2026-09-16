import { chromium } from "playwright";
import { resolve } from "node:path";
const READY = () => Boolean(window.__composition_STORE__ && window.__composition_STORE__.getState().currentPageId && document.querySelector(".app:not(.builder-booting)") && document.querySelector('[data-testid="skia-canvas-unified"]'));
const browser = await chromium.launch({ headless: false });
const page = await (await browser.newContext({ storageState: resolve("apps/builder/scripts/.auth-session.json"), viewport: { width: 1600, height: 1400 } })).newPage();
const errors = []; page.on("pageerror", (e) => errors.push(String(e)));
await page.goto("http://localhost:5173/dashboard", { waitUntil: "networkidle" });
const b = page.locator("button.dashboard-create-button").first(); await b.waitFor({ state: "visible" }); await b.click();
const i = page.locator("#new-project-name"); await i.waitFor({ state: "visible" }); await i.fill(`wig-${Date.now()}`); await i.press("Enter");
await page.waitForURL(/\/builder\/[^/?]+$/, { timeout: 60000 }); await page.waitForFunction(READY, undefined, { timeout: 90000 }); await page.waitForTimeout(1200);
const panel = async (name, want) => { const btn = page.getByRole("button", { name, exact: true }).first(); const pressed = await btn.getAttribute("aria-pressed"); if ((pressed === "true") !== want) { await btn.click(); await page.waitForTimeout(400); } };
await panel("Components", true); await page.locator("button.list-item").filter({ has: page.locator(".list-item-name", { hasText: /^Button$/i }) }).first().click(); await page.waitForTimeout(800); await panel("Components", false);
// long name → navigator truncation
await page.evaluate(() => { const st = window.__composition_STORE__.getState(); const id = st.selectedElementIds?.[0]; st.updateElementProps?.(id, { customId: "a_very_long_element_name_that_should_truncate_in_the_navigator_row_0123456789" }); });
await page.waitForTimeout(600); await panel("Navigator", true); await page.waitForTimeout(500);
console.log("navigator label:", JSON.stringify(await page.evaluate(() => { const el = Array.from(document.querySelectorAll(".elementItemLabelText")).find((e) => e.textContent.includes("a_very_long")); if (!el) return "not found"; const r = el.getBoundingClientRect(); const row = el.closest(".elementItem").getBoundingClientRect(); return { textWidth: Math.round(r.width), scrollWidth: el.scrollWidth, rowWidth: Math.round(row.width), truncated: el.scrollWidth > el.clientWidth, minWidth: getComputedStyle(el).minWidth, rowOverflow: r.right > row.right + 1 }; })));
// Styles → Text tab: Truncate (…) label
await panel("Navigator", false); await panel("Styles", true); await page.waitForTimeout(400);
const S = '[data-panel-id="styles"]';
await page.locator(`${S} [role="tab"]`).nth(2).click(); await page.waitForTimeout(500);
console.log("text tab has …:", await page.evaluate((S) => document.querySelector(S).innerText.includes("Truncate (…)") || document.querySelector(S).innerText.includes("Custom…"), S));
// font picker: open, Tab to search input → focus-visible border
const fp = page.locator(`${S} .font-picker-trigger`).first(); if (await fp.count()) { await fp.click(); await page.waitForTimeout(500); console.log("font search focused border:", await page.evaluate(() => { const el = document.activeElement; return el?.className + " " + getComputedStyle(el).borderColor + " matches:" + el?.matches(":focus-visible"); })); console.log("font list overscroll:", await page.evaluate(() => getComputedStyle(document.querySelector(".font-picker-list")).overscrollBehaviorY)); }
console.log("errors:", errors);
await browser.close();
