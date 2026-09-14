import { chromium } from "playwright";
import { resolve } from "node:path";
const OUT = "/tmp/claude-501/cp2";
const READY = () => Boolean(window.__composition_STORE__ && window.__composition_STORE__.getState().currentPageId && document.querySelector(".app:not(.builder-booting)") && document.querySelector('[data-testid="skia-canvas-unified"]'));
const browser = await chromium.launch({ headless: false });
const page = await (await browser.newContext({ storageState: resolve("apps/builder/scripts/.auth-session.json"), viewport: { width: 1600, height: 1200 }, deviceScaleFactor: 2 })).newPage();
const errors = []; page.on("pageerror", e => errors.push(e.message));
await page.goto("http://localhost:5173/dashboard", { waitUntil: "networkidle" });
const b = page.locator("button.dashboard-create-button").first(); await b.waitFor({ state: "visible", timeout: 15000 }); await b.click();
const i = page.locator("#new-project-name"); await i.waitFor({ state: "visible" }); await i.fill(`mi-${Date.now()}`); await i.press("Enter");
await page.waitForURL(/\/builder\/[^/?]+$/, { timeout: 60000 }); await page.waitForFunction(READY, undefined, { timeout: 90000 }); await page.waitForTimeout(1200);
const id = await page.evaluate(async () => { const st = window.__composition_STORE__.getState(); const body = st.elements.find(e => e.type === "body" && e.page_id === st.currentPageId) ?? st.elements.find(e => e.type === "body"); const now = new Date().toISOString(); const id = crypto.randomUUID(); await st.addElement({ id, type: "Button", parent_id: body.id, page_id: body.page_id, order_num: 99, created_at: now, updated_at: now, props: { children: "Go" } }, { skipHistory: true }); await new Promise(r => setTimeout(r, 800)); const st2 = window.__composition_STORE__.getState(); st2.setSelectedElement(id, st2.elements.find(e => e.id === id)?.props); return id; });
await page.waitForTimeout(500);
const M = (sel, n = 14) => page.evaluate(({ sel, n }) => Array.from(document.querySelectorAll(sel)).filter(el => el.getBoundingClientRect().width > 0).slice(0, n).map(el => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return `${el.className.toString().replace(/react-aria-/g,'').slice(0, 40)} | ${Math.round(r.width)}×${Math.round(r.height)} fs${cs.fontSize}`; }), { sel, n });
const shot = async (n, loc) => loc.screenshot({ path: `${OUT}/${n}.png` }).catch(e => console.log("[miss]", n, e.message.slice(0, 60)));
// Interactions
await page.getByRole("button", { name: "Interactions", exact: true }).first().click(); await page.waitForTimeout(600);
const IP = '[data-panel-id="events"]';
console.log("interactions empty:", JSON.stringify(await M(`${IP} .builder-empty-state-icon svg, ${IP} .builder-empty-state-message, ${IP} .control-button`, 5)));
await page.locator(IP).getByRole("button", { name: /add rule/i }).click(); await page.waitForTimeout(600);
await page.locator(`${IP} .interaction-rule-toggle`).first().click(); await page.waitForTimeout(500);
console.log("interactions rule:", JSON.stringify(await M(`${IP} .interaction-rule, ${IP} .interaction-rule-summary, ${IP} .interaction-rule-toggle, ${IP} .interaction-rule-remove, ${IP} .interaction-rule-row, ${IP} .interaction-rule-row fieldset`, 10), null, 1));
await shot("misc-interactions", page.locator(IP));
// Settings via header menu? use store panel visibility
await page.keyboard.press("Meta+,"); await page.waitForTimeout(700);
const SP = '[data-panel-id="settings"]';
console.log("settings:", JSON.stringify(await M(`${SP} .section, ${SP} .settings-row, ${SP} .settings-row fieldset, ${SP} .react-aria-Switch, ${SP} .react-aria-Switch .indicator`, 14), null, 1));
console.log("switch text:", await page.locator(`${SP} .react-aria-Switch`).first().textContent(), "| aria:", await page.locator(`${SP} .react-aria-Switch`).first().getAttribute("aria-label"));
await shot("misc-settings", page.locator(SP));
// Font picker + manager
await page.getByRole("button", { name: "Styles", exact: true }).first().click(); await page.waitForTimeout(500);
await page.locator(".styles-panel-tab").nth(2).click(); await page.waitForTimeout(400);
await page.locator('[data-panel-id="styles"] .font-picker-trigger').first().click(); await page.waitForTimeout(600);
console.log("font picker:", JSON.stringify(await M(`.font-picker-popover, .font-picker-section-header, .font-picker-item, .font-picker-manage`, 8), null, 1));
await shot("misc-fontpicker", page.locator(".font-picker-popover"));
await page.locator(".font-picker-manage").click(); await page.waitForTimeout(700);
console.log("font manager:", JSON.stringify(await M(`.font-manager-modal, .font-manager-dialog-header, .font-count-badge, .font-manager-dialog-close, .font-upload-zone, .font-upload-label, .builder-empty-state-message`, 10), null, 1));
// upload a tiny (invalid) font? skip — measure rows if any
await shot("misc-fontmanager", page.locator(".font-manager-modal"));
console.log("errors", errors.slice(0, 3));
await browser.close();
