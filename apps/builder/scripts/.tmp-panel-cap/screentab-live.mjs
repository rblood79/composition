// 04 Screen / Modified 탭 live 하니스 (panel-ui 04)
import { chromium } from "playwright";
import { resolve } from "node:path";
const OUT = process.env.OUT ?? "/private/tmp/claude-501/-Users-admin-work-composition/f6bcc488-f176-4644-8364-3625704b801c/scratchpad/cap";
const READY = () => Boolean(window.__composition_STORE__ && window.__composition_STORE__.getState().currentPageId && document.querySelector(".app:not(.builder-booting)") && document.querySelector('[data-testid="skia-canvas-unified"]'));
const browser = await chromium.launch({ headless: false });
const page = await (await browser.newContext({ storageState: resolve("apps/builder/scripts/.auth-session.json"), viewport: { width: 1600, height: 1100 }, deviceScaleFactor: 2 })).newPage();
await page.goto("http://localhost:5173/dashboard", { waitUntil: "networkidle" });
const b = page.locator("button.dashboard-create-button").first(); await b.waitFor({ state: "visible", timeout: 15000 }); await b.click();
const i = page.locator("#new-project-name"); await i.waitFor({ state: "visible" }); await i.fill(`sc-${Date.now()}`); await i.press("Enter");
await page.waitForURL(/\/builder\/[^/?]+$/, { timeout: 60000 }); await page.waitForFunction(READY, undefined, { timeout: 90000 }); await page.waitForTimeout(1200);
const elId = await page.evaluate(async () => { const st = window.__composition_STORE__.getState(); const body = st.elements.find(e => e.type === "body" && e.page_id === st.currentPageId) ?? st.elements.find(e => e.type === "body"); const now = new Date().toISOString(); const id = crypto.randomUUID(); await st.addElement({ id, type: "Button", parent_id: body.id, page_id: body.page_id, order_num: 99, created_at: now, updated_at: now, props: { children: "Hello", style: { width: "200px", borderRadius: "8px", backgroundColor: "#2563eb", color: "#ffffff", gap: "8px" } } }, { skipHistory: true }); await new Promise(r => setTimeout(r, 800)); const st2 = window.__composition_STORE__.getState(); st2.setSelectedElement(id, st2.elements.find(e => e.id === id)?.props); return id; });
await page.waitForTimeout(600);
await page.getByRole("button", { name: "Styles", exact: true }).first().click(); await page.waitForTimeout(500);
const M = (sel) => page.evaluate((sel) => Array.from(document.querySelectorAll(sel)).filter(el => el.getBoundingClientRect().width > 0).slice(0, 20).map(el => { const r = el.getBoundingClientRect(); return `${(el.getAttribute("aria-label") || el.className.toString()).slice(0, 44)} | ${Math.round(r.width)}×${Math.round(r.height)} @${Math.round(r.top)}`; }), sel);
const el = () => page.evaluate((id) => { const e = window.__composition_STORE__.getState().elements.find(e => e.id === id); return { style: e?.props?.style, responsive: e?.responsive }; }, elId);
const P = '[data-panel-id="styles"]';
// --- Screen 탭 (desktop)
await page.locator(".styles-panel-tab").nth(3).click(); await page.waitForTimeout(400);
console.log("desktop sections", JSON.stringify(await M(`${P} .section`)));
console.log("seg", JSON.stringify(await M(`${P} .responsive-visibility-seg .react-aria-ToggleButton, ${P} .responsive-visibility-seg .react-aria-ToggleButtonGroup`)));
await page.locator(`${P} .panel-contents`).screenshot({ path: `${OUT}/screen-desktop.png` });
// --- tablet
await page.evaluate(() => window.__composition_STORE__.getState().setActiveBreakpoint("tablet")); await page.waitForTimeout(500);
console.log("tablet sections", JSON.stringify(await M(`${P} .section`)));
// tablet hide
await page.locator(`${P} button[aria-label="Tablet"]`).click(); await page.waitForTimeout(400);
console.log("after hide tablet", JSON.stringify((await el()).responsive));
// add override width via + menu
await page.locator(`${P} button[aria-label="Add Tablet override"]`).click(); await page.waitForTimeout(300);
await page.getByRole("menuitem", { name: "Width", exact: true }).click(); await page.waitForTimeout(400);
await page.locator(`${P} button[aria-label="Add Tablet override"]`).click(); await page.waitForTimeout(300);
await page.getByRole("menuitem", { name: "Direction" }).click(); await page.waitForTimeout(400);
console.log("after add", JSON.stringify((await el()).responsive));
console.log("rows", JSON.stringify(await M(`${P} .responsive-override-row, ${P} .responsive-override-row__body, ${P} .responsive-overrides-count`)));
console.log("row text", await page.locator(`${P} .responsive-override-row__body`).allTextContents());
await page.locator(`${P} .panel-contents`).screenshot({ path: `${OUT}/screen-tablet.png` });
// remove width override
await page.locator(`${P} button[aria-label="Remove Width override"]`).click(); await page.waitForTimeout(400);
console.log("after remove", JSON.stringify((await el()).responsive));
await page.evaluate(() => window.__composition_STORE__.getState().setActiveBreakpoint("desktop")); await page.waitForTimeout(300);
// --- Modified 탭
await page.locator(".styles-panel-tab").nth(4).click(); await page.waitForTimeout(500);
console.log("modified rows", JSON.stringify(await M(`${P} .modified-row, ${P} .modified-count`)));
console.log("modified text", await page.locator(`${P} .modified-row`).allTextContents());
await page.locator(`${P} .panel-contents`).screenshot({ path: `${OUT}/modified.png` });
// reset via header
await page.locator(`${P} .section button[aria-label="Reset section"]`).first().click(); await page.waitForTimeout(500);
console.log("after reset style", JSON.stringify((await el()).style));
console.log("empty", await page.locator(`${P} .empty-state, ${P} .modified-row`).count());
await page.locator(`${P} .panel-contents`).screenshot({ path: `${OUT}/modified-empty.png` });
await browser.close();
