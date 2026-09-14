// 07 Properties 패널 live 하니스 (panel-ui 07)
import { chromium } from "playwright";
import { resolve } from "node:path";
const OUT = process.env.OUT ?? "/private/tmp/claude-501/-Users-admin-work-composition/f6bcc488-f176-4644-8364-3625704b801c/scratchpad/cap";
const TYPE = process.env.TYPE ?? "Button";
const READY = () => Boolean(window.__composition_STORE__ && window.__composition_STORE__.getState().currentPageId && document.querySelector(".app:not(.builder-booting)") && document.querySelector('[data-testid="skia-canvas-unified"]'));
const browser = await chromium.launch({ headless: false });
const page = await (await browser.newContext({ storageState: resolve("apps/builder/scripts/.auth-session.json"), viewport: { width: 1600, height: 1400 }, deviceScaleFactor: 2 })).newPage();
await page.goto("http://localhost:5173/dashboard", { waitUntil: "networkidle" });
const b = page.locator("button.dashboard-create-button").first(); await b.waitFor({ state: "visible", timeout: 15000 }); await b.click();
const i = page.locator("#new-project-name"); await i.waitFor({ state: "visible" }); await i.fill(`pr-${Date.now()}`); await i.press("Enter");
await page.waitForURL(/\/builder\/[^/?]+$/, { timeout: 60000 }); await page.waitForFunction(READY, undefined, { timeout: 90000 }); await page.waitForTimeout(1200);
// 팔레트 클릭으로 추가 (canonical 에 실리도록)
await page.getByRole("button", { name: "Components", exact: true }).first().click().catch(() => {});
await page.waitForTimeout(400);
const elId = await page.evaluate(async (TYPE) => { const st = window.__composition_STORE__.getState(); const body = st.elements.find(e => e.type === "body" && e.page_id === st.currentPageId) ?? st.elements.find(e => e.type === "body"); const now = new Date().toISOString(); const id = crypto.randomUUID(); await st.addElement({ id, type: TYPE, parent_id: body.id, page_id: body.page_id, order_num: 99, created_at: now, updated_at: now, props: { children: "Primary action", style: {} } }, { skipHistory: true }); await new Promise(r => setTimeout(r, 800)); const st2 = window.__composition_STORE__.getState(); st2.setSelectedElement(id, st2.elements.find(e => e.id === id)?.props); return id; }, TYPE);
await page.waitForTimeout(600);
await page.getByRole("button", { name: "Properties", exact: true }).first().click(); await page.waitForTimeout(600);
const P = '[data-panel-id="properties"]';
const M = (sel) => page.evaluate((sel) => Array.from(document.querySelectorAll(sel)).filter(el => el.getBoundingClientRect().width > 0).slice(0, 40).map(el => { const r = el.getBoundingClientRect(); return `${(el.getAttribute("aria-label") || el.className.toString()).slice(0, 40)} | ${Math.round(r.width)}×${Math.round(r.height)} @${Math.round(r.top)}`; }), sel);
console.log("sections", JSON.stringify(await M(`${P} .section`)));
console.log("fieldsets", JSON.stringify(await M(`${P} fieldset.properties-aria`)));
console.log("rows", JSON.stringify(await M(`${P} .fieldset-row`)));
console.log("actions", JSON.stringify(await M(`${P} .component-semantics-row-label, ${P} .component-semantics-identity, ${P} .swatch-icon-button`)));
await page.evaluate((P) => { const c = document.querySelector(`${P} .panel-contents`); const w = c.closest('.panel-wrapper') ?? c.parentElement; [c, c.parentElement, w].forEach(el => { el.style.height = 'auto'; el.style.maxHeight = 'none'; el.style.overflow = 'visible'; }); }, P);
await page.waitForTimeout(200);
await page.locator(`${P} .panel-contents`).screenshot({ path: `${OUT}/props-${TYPE}.png` });
// class 입력
const cls = page.locator(`${P} fieldset[aria-label="Class Name"] input`); await cls.click(); await cls.fill("hero-title"); await cls.press("Enter"); await page.waitForTimeout(400);
console.log("className", await page.evaluate((id) => window.__composition_STORE__.getState().elements.find(e => e.id === id)?.props?.className, elId));
await browser.close();
