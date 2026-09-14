// 03 Text 탭 live 하니스 — Typography 6행 실측 (panel-ui 03)
import { chromium } from "playwright";
import { resolve } from "node:path";
const OUT = process.env.OUT ?? "/private/tmp/claude-501/-Users-admin-work-composition/f6bcc488-f176-4644-8364-3625704b801c/scratchpad/cap";
const READY = () => Boolean(window.__composition_STORE__ && window.__composition_STORE__.getState().currentPageId && document.querySelector(".app:not(.builder-booting)") && document.querySelector('[data-testid="skia-canvas-unified"]'));
const browser = await chromium.launch({ headless: false });
const page = await (await browser.newContext({ storageState: resolve("apps/builder/scripts/.auth-session.json"), viewport: { width: 1600, height: 1100 }, deviceScaleFactor: 2 })).newPage();
await page.goto("http://localhost:5173/dashboard", { waitUntil: "networkidle" });
const b = page.locator("button.dashboard-create-button").first(); await b.waitFor({ state: "visible", timeout: 15000 }); await b.click();
const i = page.locator("#new-project-name"); await i.waitFor({ state: "visible" }); await i.fill(`tx-${Date.now()}`); await i.press("Enter");
await page.waitForURL(/\/builder\/[^/?]+$/, { timeout: 60000 }); await page.waitForFunction(READY, undefined, { timeout: 90000 }); await page.waitForTimeout(1200);
const elId = await page.evaluate(async () => { const st = window.__composition_STORE__.getState(); const body = st.elements.find(e => e.type === "body" && e.page_id === st.currentPageId) ?? st.elements.find(e => e.type === "body"); const now = new Date().toISOString(); const id = crypto.randomUUID(); await st.addElement({ id, type: "Text", parent_id: body.id, page_id: body.page_id, order_num: 99, created_at: now, updated_at: now, props: { children: "Hello", style: {} } }, { skipHistory: true }); await new Promise(r => setTimeout(r, 800)); const st2 = window.__composition_STORE__.getState(); st2.setSelectedElement(id, st2.elements.find(e => e.id === id)?.props); return id; });
await page.waitForTimeout(600);
await page.getByRole("button", { name: "Styles", exact: true }).first().click(); await page.waitForTimeout(500);
await page.locator(".styles-panel-tab").nth(2).click(); await page.waitForTimeout(400);
const P = '[data-panel-id="styles"] .section[data-section-id="typography"]';
const M = (sel) => page.evaluate((sel) => Array.from(document.querySelectorAll(sel)).filter(el => el.getBoundingClientRect().width > 0).slice(0, 16).map(el => { const r = el.getBoundingClientRect(); return `${(el.getAttribute("aria-label") || el.className.toString()).slice(0, 40)} | ${Math.round(r.width)}×${Math.round(r.height)} @${Math.round(r.top)}`; }), sel);
const style = () => page.evaluate((id) => window.__composition_STORE__.getState().elements.find(e => e.id === id)?.props?.style, elId);
console.log("fields", JSON.stringify(await M(`${P} fieldset`), null, 0));
console.log("groups", JSON.stringify(await M(`${P} .react-aria-Group`), null, 0));
console.log("seg btns", JSON.stringify(await M(`${P} .text-decoration .react-aria-ToggleButton, ${P} .text-transform .react-aria-ToggleButton`), null, 0));
console.log("weight text", await page.locator(`${P} .font-weight .react-aria-SelectValue`).textContent(), "| family", await page.locator(`${P} .font-picker-value`).textContent());
// Size 필드 18 Enter
const size = page.locator(`${P} .font-size input`).first(); await size.click(); await size.fill("18"); await size.press("Enter"); await page.waitForTimeout(400);
console.log("size", JSON.stringify(await style()));
// Decoration underline → none (×)
await page.locator(`${P} button[aria-label="Underline"]`).click(); await page.waitForTimeout(300);
console.log("underline", (await style()).textDecoration);
await page.locator(`${P} button[aria-label="No decoration"]`).click(); await page.waitForTimeout(300);
console.log("none", (await style()).textDecoration);
await page.locator(`${P} button[aria-label="Uppercase"]`).click(); await page.waitForTimeout(300);
console.log("upper", (await style()).textTransform);
await page.locator(`${P}`).screenshot({ path: `${OUT}/texttab.png` });
await browser.close();
