import { chromium } from "playwright";
import { resolve } from "node:path";
const OUT = "/private/tmp/claude-501/-Users-admin-work-composition/f6bcc488-f176-4644-8364-3625704b801c/scratchpad/audit";
const READY = () => Boolean(window.__composition_STORE__ && window.__composition_STORE__.getState().currentPageId && document.querySelector(".app:not(.builder-booting)") && document.querySelector('[data-testid="skia-canvas-unified"]'));
const browser = await chromium.launch({ headless: false });
const page = await (await browser.newContext({ storageState: resolve("apps/builder/scripts/.auth-session.json"), viewport: { width: 1600, height: 1200 }, deviceScaleFactor: 2 })).newPage();
const errors = []; page.on("pageerror", (e) => errors.push(e.message));
await page.goto("http://localhost:5173/dashboard", { waitUntil: "networkidle" });
const b = page.locator("button.dashboard-create-button").first(); await b.waitFor({ state: "visible", timeout: 15000 }); await b.click();
const i = page.locator("#new-project-name"); await i.waitFor({ state: "visible" }); await i.fill(`b1-${Date.now()}`); await i.press("Enter");
await page.waitForURL(/\/builder\/[^/?]+$/, { timeout: 60000 }); await page.waitForFunction(READY, undefined, { timeout: 90000 }); await page.waitForTimeout(1200);
const add = async (re) => { await page.getByRole("button", { name: "Components", exact: true }).first().click(); await page.waitForTimeout(500); const item = page.locator("button.list-item").filter({ has: page.locator(".list-item-name", { hasText: re }) }).first(); await item.scrollIntoViewIfNeeded(); await item.click(); await page.waitForTimeout(1500); await page.getByRole("button", { name: "Components", exact: true }).first().click().catch(() => {}); await page.waitForTimeout(300); };
await add(/^frame$/i);
// frame → flex row, then add button inside it
const frameId = await page.evaluate(async () => { const st = window.__composition_STORE__.getState(); const els = st.elements.filter((e) => e.page_id === st.currentPageId && e.type === "frame"); const el = els[els.length - 1]; st.setSelectedElement(el.id, el.props); await new Promise((r) => setTimeout(r, 300)); window.__composition_STORE__.getState().updateSelectedStyles({ display: "flex", flexDirection: "row", width: "400px", height: "160px", gap: "12px" }); return el.id; });
await page.waitForTimeout(400);
await add(/^button$/i);
const btnId = await page.evaluate(async (frameId) => { const st = window.__composition_STORE__.getState(); const btn = st.elements.filter((e) => e.page_id === st.currentPageId && e.type === "Button").pop(); return { id: btn.id, parent: btn.parent_id, frameId }; }, frameId);
console.log("btn", btnId);
await page.evaluate(async (id) => { const st = window.__composition_STORE__.getState(); const el = st.elements.find((e) => e.id === id); st.setSelectedElement(el.id, el.props); }, frameId); await page.waitForTimeout(500);
await page.getByRole("button", { name: "Styles", exact: true }).first().click(); await page.waitForTimeout(500);
await page.locator(".styles-panel-tab").nth(0).click(); await page.waitForTimeout(400);
const P = '[data-panel-id="styles"]';
const dumpSections = () => page.evaluate((P) => Array.from(document.querySelectorAll(`${P} .section`)).map((s) => `${s.dataset.sectionId} ${s.querySelector(".section-title")?.textContent.trim()} h${Math.round(s.getBoundingClientRect().height)} ${s.querySelector(".section-content") ? "open" : "collapsed"}`), P);
console.log("sections:", await dumpSections());
const dumpSize = () => page.evaluate((P) => { const sec = document.querySelector(`${P} .section[data-section-id="transform"] .section-content`); const rows = Array.from(sec.querySelectorAll(".transform-row, .transform-constraints")); const fields = Array.from(sec.querySelectorAll("fieldset.properties-aria")).map((f) => { const r = f.getBoundingClientRect(); const input = f.querySelector("input"); const suffix = f.querySelector(".property-unit-input__suffix, .property-field__suffix, .react-aria-Select .react-aria-Button"); return `${f.getAttribute("aria-label") ?? f.querySelector("legend")?.textContent} [${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.width)}×${Math.round(r.height)}] val="${input?.value ?? ""}" ph="${input?.placeholder ?? ""}" sfx="${suffix?.textContent.trim()}" legend=${Boolean(f.querySelector("legend"))}`; }); const cr = sec.getBoundingClientRect(); return { content: `${Math.round(cr.width)}×${Math.round(cr.height)}`, rows: rows.map((r) => `${r.className} h${Math.round(r.getBoundingClientRect().height)}`), fields, buttons: Array.from(sec.querySelectorAll("button[aria-label]")).map((b) => `${b.getAttribute("aria-label")} ${Math.round(b.getBoundingClientRect().width)}×${Math.round(b.getBoundingClientRect().height)}`) }; }, P);
console.log("size:", JSON.stringify(await dumpSize(), null, 1));
// Gap field
console.log("gap:", await page.evaluate((P) => { const f = document.querySelector(`${P} .displayGap`); const r = f.getBoundingClientRect(); return { legend: f.querySelector("legend")?.textContent, label: f.dataset.labelMode, icon: Boolean(f.querySelector(".control-label")), val: f.querySelector("input").value, sfx: f.querySelector(".property-unit-input__suffix")?.textContent, stepper: f.querySelectorAll(".property-unit-input__step").length, chevron: Boolean(f.querySelector("svg.lucide-chevron-down:not(.property-unit-input__step svg)")), rect: `${Math.round(r.width)}×${Math.round(r.height)}` }; }, P));
await page.locator(`${P} .section[data-section-id="layout"]`).screenshot({ path: `${OUT}/b1-layout.png` });
await page.locator(`${P} .section[data-section-id="transform"]`).screenshot({ path: `${OUT}/b1-size.png` });
await page.locator(`${P} .panel-contents`).screenshot({ path: `${OUT}/b1-tab.png` });
// Gap unit trigger → menu, pick rem
await page.locator(`${P} .displayGap .property-unit-input__suffix--trigger`).click(); await page.waitForTimeout(400);
console.log("gap menu:", await page.evaluate(() => Array.from(document.querySelectorAll('.react-aria-Popover [role="option"]')).map((o) => o.textContent.trim())));
await page.locator('.react-aria-Popover [role="option"]').filter({ hasText: /^px$/ }).click(); await page.waitForTimeout(500);
console.log("gap after px:", await page.evaluate((id) => { const s = window.__composition_STORE__.getState().elements.find((e) => e.id === id).props.style; return { gap: s.gap, rowGap: s.rowGap, columnGap: s.columnGap }; }, frameId), "sfx", await page.evaluate((P) => document.querySelector(`${P} .displayGap .property-unit-input__suffix`)?.textContent, P));
// Gap stepper
await page.locator(`${P} .displayGap .property-unit-input__step`).first().click(); await page.waitForTimeout(400);
console.log("gap after step+:", await page.evaluate((id) => { const s = window.__composition_STORE__.getState().elements.find((e) => e.id === id).props.style; return { rowGap: s.rowGap, columnGap: s.columnGap }; }, frameId));
// Select the button → W unit menu → fill
await page.evaluate(async (id) => { const st = window.__composition_STORE__.getState(); const el = st.elements.find((e) => e.id === id); st.setSelectedElement(el.id, el.props); }, btnId.id); await page.waitForTimeout(600);
console.log("btn size:", JSON.stringify((await dumpSize()).fields.slice(0, 2)));
await page.locator(`${P} .section[data-section-id="transform"] .width .property-unit-input__suffix--trigger`).click(); await page.waitForTimeout(400);
console.log("W menu:", await page.evaluate(() => Array.from(document.querySelectorAll('.react-aria-Popover [role="option"]')).map((o) => o.textContent.trim())));
await page.locator('.react-aria-Popover [role="option"]').filter({ hasText: /^fill$/ }).click(); await page.waitForTimeout(600);
const btnStyle = (keys) => page.evaluate(({ id, keys }) => { const s = window.__composition_STORE__.getState().elements.find((e) => e.id === id).props.style ?? {}; return Object.fromEntries(keys.map((k) => [k, s[k]])); }, { id: btnId.id, keys });
console.log("btn after fill:", await btnStyle(["width", "flexGrow", "flexShrink", "flexBasis"]), "field:", JSON.stringify((await dumpSize()).fields[0]));
const lmW = () => page.evaluate((id) => { const lm = window.__composition_LAYOUT_DEBUG__?.getSharedLayoutMap?.()?.get(id); return lm && Math.round(lm.width); }, btnId.id);
console.log("btn layout width after fill:", await lmW());
// type a number → fixed
const wInput = page.locator(`${P} .section[data-section-id="transform"] .width input`);
await wInput.click(); await wInput.fill("150"); await wInput.press("Enter"); await page.waitForTimeout(600);
console.log("btn after 150:", await btnStyle(["width", "flexGrow", "flexShrink", "flexBasis"]), "layout w", await lmW());
// H unit menu → fit-content
await page.locator(`${P} .section[data-section-id="transform"] .height .property-unit-input__suffix--trigger`).click(); await page.waitForTimeout(400);
console.log("H menu:", await page.evaluate(() => Array.from(document.querySelectorAll('.react-aria-Popover [role="option"]')).map((o) => o.textContent.trim())));
await page.locator('.react-aria-Popover [role="option"]').filter({ hasText: /^fit-content$/ }).click(); await page.waitForTimeout(600);
console.log("btn after hug H:", await btnStyle(["height", "alignSelf"]), "field:", JSON.stringify((await dumpSize()).fields[1]));
// Ratio select + Overflow select
await page.locator(`${P} .section[data-section-id="transform"] .aspect-ratio-select .react-aria-Button`).click(); await page.waitForTimeout(400);
await page.locator('.react-aria-Popover [role="option"]').filter({ hasText: /16:9/ }).click(); await page.waitForTimeout(500);
console.log("btn after ratio:", await btnStyle(["aspectRatio", "width", "height"]), "lock:", await page.evaluate((P) => document.querySelector(`${P} .section[data-section-id="transform"] .actions-ratio button`)?.querySelector("svg")?.getAttribute("class"), P));
await page.locator(`${P} .section[data-section-id="transform"] .overflow .react-aria-Button`).click(); await page.waitForTimeout(400);
await page.locator('.react-aria-Popover [role="option"]').filter({ hasText: /^Hidden$/i }).click(); await page.waitForTimeout(500);
console.log("btn after overflow:", await btnStyle(["overflow"]));
await page.locator(`${P} .section[data-section-id="transform"]`).screenshot({ path: `${OUT}/b1-size-btn.png` });
console.log("errors", errors.slice(0, 3));
await browser.close();
