import { chromium } from "playwright";
import { resolve } from "node:path";
const OUT = "/tmp/claude-501/cp2";
const READY = () => Boolean(window.__composition_STORE__ && window.__composition_STORE__.getState().currentPageId && document.querySelector(".app:not(.builder-booting)") && document.querySelector('[data-testid="skia-canvas-unified"]'));
const browser = await chromium.launch({ headless: false });
const page = await (await browser.newContext({ storageState: resolve("apps/builder/scripts/.auth-session.json"), viewport: { width: 1600, height: 1200 }, deviceScaleFactor: 2 })).newPage();
const errors = []; page.on("pageerror", e => errors.push(e.message));
await page.goto("http://localhost:5173/dashboard", { waitUntil: "networkidle" });
const b = page.locator("button.dashboard-create-button").first(); await b.waitFor({ state: "visible", timeout: 15000 }); await b.click();
const i = page.locator("#new-project-name"); await i.waitFor({ state: "visible" }); await i.fill(`lt-${Date.now()}`); await i.press("Enter");
await page.waitForURL(/\/builder\/[^/?]+$/, { timeout: 60000 }); await page.waitForFunction(READY, undefined, { timeout: 90000 }); await page.waitForTimeout(1200);
const id = await page.evaluate(async () => { const st = window.__composition_STORE__.getState(); const body = st.elements.find(e => e.type === "body" && e.page_id === st.currentPageId) ?? st.elements.find(e => e.type === "body"); const now = new Date().toISOString(); const id = crypto.randomUUID(); await st.addElement({ id, type: "Card", parent_id: body.id, page_id: body.page_id, order_num: 99, created_at: now, updated_at: now, props: { style: { width: "200px", height: "80px" } } }, { skipHistory: true }); await new Promise(r => setTimeout(r, 800)); const st2 = window.__composition_STORE__.getState(); st2.setSelectedElement(id, st2.elements.find(e => e.id === id)?.props); return id; });
await page.waitForTimeout(500);
const M = (sel, n = 20) => page.evaluate(({ sel, n }) => Array.from(document.querySelectorAll(sel)).filter(el => el.getBoundingClientRect().width > 0).slice(0, n).map(el => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return `${el.className.toString().replace(/react-aria-/g,'').slice(0, 44)} | ${Math.round(r.width)}×${Math.round(r.height)} fs${cs.fontSize}`; }), { sel, n });
const P = '[data-panel-id="styles"]';
await page.getByRole("button", { name: "Styles", exact: true }).first().click(); await page.waitForTimeout(500);
await page.locator(".styles-panel-tab").nth(0).click(); await page.waitForTimeout(400);
console.log("sections:", JSON.stringify(await M(`${P} .section-header, ${P} .section-caret, ${P} .section-title`, 12), null, 1));
console.log("size:", JSON.stringify(await M(`${P} [data-section-id="transform"] .transform-row, ${P} [data-section-id="transform"] .property-unit-input, ${P} [data-section-id="transform"] .property-unit-input__suffix, ${P} [data-section-id="transform"] .transform-constraints, ${P} [data-section-id="transform"] .overflow`, 20), null, 1));
console.log("minw input value:", await page.locator(`${P} [data-section-id="transform"] .min-width input`).first().inputValue(), "| localStorage:", await page.evaluate(() => localStorage.getItem("styles-panel-collapse")));
console.log("position collapsed:", await page.locator(`${P} [data-section-id="position"] .section-content`).count(), "| caret aria:", await page.locator(`${P} [data-section-id="position"] .section-caret`).getAttribute("aria-expanded"));
const style = () => page.evaluate((id) => window.__composition_STORE__.getState().elements.find(e => e.id === id)?.props?.style, id);
// edit W via suffix field
const w = page.locator(`${P} [data-section-id="transform"] .width input`).first(); await w.fill("240"); await w.press("Enter"); await page.waitForTimeout(400);
console.log("after W 240:", JSON.stringify((await style())?.width));
// overflow select
await page.locator(`${P} [data-section-id="transform"] .overflow .react-aria-Button`).first().click(); await page.waitForTimeout(300);
await page.getByRole("option", { name: /hidden/i }).click(); await page.waitForTimeout(400);
console.log("after overflow:", JSON.stringify((await style())?.overflow));
// position: expand section then absolute toggle → auto expand check: first collapse position, then set absolute via store
await page.evaluate((id) => { const st = window.__composition_STORE__.getState(); st.updateSelectedStyle("position", "absolute"); }, id); await page.waitForTimeout(500);
console.log("position auto-expanded:", await page.locator(`${P} [data-section-id="position"] .section-content`).count(), JSON.stringify(await M(`${P} [data-section-id="position"] .transform-row, ${P} [data-section-id="position"] .property-unit-input`, 6)));
// Layout section: make flex row + space-between, click grid bottom-center → alignItems only
await page.evaluate(() => { const st = window.__composition_STORE__.getState(); st.updateSelectedStyles({ display: "flex", flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }); }); await page.waitForTimeout(500);
const grid = page.locator(`${P} .flex-alignment .react-aria-ToggleButtonGroup`).first();
console.log("grid distributed:", await grid.getAttribute("data-distributed"), "| dot:", JSON.stringify(await M(`${P} .flex-alignment .alignment-dot`, 1)), "| dead icon btn:", await page.locator(`${P} [data-section-id="layout"] .fieldset-actions button`).count());
await page.locator(`${P} .flex-alignment button[aria-label="Bottom center"]`).click(); await page.waitForTimeout(400);
const st2 = await style(); console.log("after grid click (distributed):", st2.justifyContent, st2.alignItems);
await page.locator(`${P} [data-section-id="layout"]`).screenshot({ path: `${OUT}/layout-section.png` });
// Spacing box model
const SP = `${P} [data-section-id="spacing"]`;
console.log("box model:", JSON.stringify(await M(`${SP} .box-model, ${SP} .box-model__padding, ${SP} .box-model__center, ${SP} .box-model__link, ${SP} .box-model__input`, 8), null, 1));
const pt = page.locator(`${SP} .box-model__input--padding.box-model__input--top`); await pt.fill("12"); await pt.press("Enter"); await page.waitForTimeout(400);
let st3 = await style(); console.log("padding top only:", st3.paddingTop, st3.paddingBottom, st3.paddingLeft);
await page.locator(`${SP} .box-model__link`).click(); await page.waitForTimeout(200);
const pl = page.locator(`${SP} .box-model__input--padding.box-model__input--left`); await pl.fill("20"); await pl.press("Enter"); await page.waitForTimeout(400);
st3 = await style(); console.log("linked padding:", st3.paddingTop, st3.paddingRight, st3.paddingBottom, st3.paddingLeft);
const mt = page.locator(`${SP} .box-model__input--margin.box-model__input--top`); await mt.fill("-4"); await mt.press("Enter"); await page.waitForTimeout(400);
st3 = await style(); console.log("linked margin:", st3.marginTop, st3.marginLeft);
await page.locator(SP).screenshot({ path: `${OUT}/spacing-section.png` });
await page.locator(`${SP} .section-actions button[aria-label*="Expand"]`).first().click(); await page.waitForTimeout(400);
console.log("expanded:", JSON.stringify(await M(`${SP} .four-way-grid, ${SP} .four-way-grid .react-aria-Input`, 3)));
await page.locator(SP).screenshot({ path: `${OUT}/spacing-expanded.png` });
await page.locator(P).screenshot({ path: `${OUT}/layout-tab.png` });
console.log("errors", errors.slice(0, 3));
await browser.close();
