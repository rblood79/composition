import { chromium } from "playwright";
import { resolve } from "node:path";
const READY = () => Boolean(window.__composition_STORE__ && window.__composition_STORE__.getState().currentPageId && document.querySelector(".app:not(.builder-booting)") && document.querySelector('[data-testid="skia-canvas-unified"]'));
const browser = await chromium.launch({ headless: false });
const page = await (await browser.newContext({ storageState: resolve("apps/builder/scripts/.auth-session.json"), viewport: { width: 1600, height: 1200 } })).newPage();
await page.goto("http://localhost:5173/dashboard", { waitUntil: "networkidle" });
const b = page.locator("button.dashboard-create-button").first(); await b.waitFor({ state: "visible", timeout: 15000 }); await b.click();
const i = page.locator("#new-project-name"); await i.waitFor({ state: "visible" }); await i.fill(`lh-${Date.now()}`); await i.press("Enter");
await page.waitForURL(/\/builder\/[^/?]+$/, { timeout: 60000 }); await page.waitForFunction(READY, undefined, { timeout: 90000 }); await page.waitForTimeout(1200);
await page.getByRole("button", { name: "Components", exact: true }).first().click(); await page.waitForTimeout(500);
const item = page.locator("button.list-item").filter({ has: page.locator(".list-item-name", { hasText: /^text$/i }) }).first(); await item.click(); await page.waitForTimeout(1500);
await page.getByRole("button", { name: "Components", exact: true }).first().click().catch(() => {});
const txt = await page.evaluate(() => { const st = window.__composition_STORE__.getState(); const t = st.elements.filter((e) => e.page_id === st.currentPageId && /^text$/i.test(e.type)).pop(); st.setSelectedElement(t.id, t.props); return t.id; });
await page.waitForTimeout(500);
await page.getByRole("button", { name: "Styles", exact: true }).first().click(); await page.waitForTimeout(500);
await page.locator(".styles-panel-tab").nth(2).click(); await page.waitForTimeout(400);
const P = '[data-panel-id="styles"] .section[data-section-id="typography"]';
const st = () => page.evaluate((id) => { const s = window.__composition_STORE__.getState().elements.find((e) => e.id === id).props.style ?? {}; return { lineHeight: s.lineHeight, letterSpacing: s.letterSpacing, fontSize: s.fontSize }; }, txt);
const fld = (cls) => page.evaluate(({ P, cls }) => { const f = document.querySelector(`${P} .${cls}`); const i = f.querySelector("input"); return { val: i.value, ph: i.placeholder, trig: f.querySelector(".property-unit-input__suffix--trigger")?.textContent, focused: document.activeElement === i }; }, { P, cls });
console.log("init", await st(), await fld("line-height"));
// A: type directly (no unit menu)
const lh = page.locator(`${P} .line-height input`); await lh.click(); await page.keyboard.press("Meta+a"); await page.keyboard.type("28"); await page.keyboard.press("Enter"); await page.waitForTimeout(500);
console.log("A type 28 Enter:", await st(), await fld("line-height"));
// B: letter spacing (keyword normal) type 2 Enter
const ls = page.locator(`${P} .letter-spacing input`); await ls.click(); await page.keyboard.type("2"); await page.keyboard.press("Enter"); await page.waitForTimeout(500);
console.log("B ls type 2 Enter:", await st(), await fld("letter-spacing"));
// C: unit menu px on line-height then type 32
await page.locator(`${P} .line-height .property-unit-input__suffix--trigger`).click(); await page.waitForTimeout(400);
await page.locator('.react-aria-Popover [role="option"]').filter({ hasText: /^px$/ }).click(); await page.waitForTimeout(500);
console.log("C after px:", await st(), await fld("line-height"));
await lh.click(); await page.keyboard.press("Meta+a"); await page.keyboard.type("32"); await page.keyboard.press("Enter"); await page.waitForTimeout(500);
console.log("C type 32:", await st(), await fld("line-height"));
await browser.close();
