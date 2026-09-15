import { chromium } from "playwright";
import { resolve } from "node:path";
const OUT = "/private/tmp/claude-501/-Users-admin-work-composition/f6bcc488-f176-4644-8364-3625704b801c/scratchpad/audit";
const READY = () => Boolean(window.__composition_STORE__ && window.__composition_STORE__.getState().currentPageId && document.querySelector(".app:not(.builder-booting)") && document.querySelector('[data-testid="skia-canvas-unified"]'));
const browser = await chromium.launch({ headless: false });
const page = await (await browser.newContext({ storageState: resolve("apps/builder/scripts/.auth-session.json"), viewport: { width: 1600, height: 1200 }, deviceScaleFactor: 2 })).newPage();
const errors = []; page.on("pageerror", (e) => errors.push(e.message));
await page.goto("http://localhost:5173/dashboard", { waitUntil: "networkidle" });
const b = page.locator("button.dashboard-create-button").first(); await b.waitFor({ state: "visible", timeout: 15000 }); await b.click();
const i = page.locator("#new-project-name"); await i.waitFor({ state: "visible" }); await i.fill(`b9-${Date.now()}`); await i.press("Enter");
await page.waitForURL(/\/builder\/[^/?]+$/, { timeout: 60000 }); await page.waitForFunction(READY, undefined, { timeout: 90000 }); await page.waitForTimeout(1200);
const panel = async (name) => { await page.getByRole("button", { name, exact: true }).first().click(); await page.waitForTimeout(500); };
const add = async (re) => { await panel("Components"); const item = page.locator("button.list-item").filter({ has: page.locator(".list-item-name", { hasText: re }) }).first(); await item.scrollIntoViewIfNeeded(); await item.click(); await page.waitForTimeout(1500); await panel("Components"); };
// B10 Components card icon
await panel("Components");
console.log("components icon:", await page.evaluate(() => { const ic = document.querySelector('[data-panel-id="components"] .list-item-icon'); const r = ic.getBoundingClientRect(); return `${Math.round(r.width)}×${Math.round(r.height)}`; }));
await page.locator('[data-panel-id="components"] .section').first().screenshot({ path: `${OUT}/b10-components.png` });
await panel("Components");
await add(/^frame$/i);
const frameId = await page.evaluate(async () => { const st = window.__composition_STORE__.getState(); const el = st.elements.filter((e) => e.page_id === st.currentPageId && e.type === "frame").pop(); st.setSelectedElement(el.id, el.props); await new Promise((r) => setTimeout(r, 300)); window.__composition_STORE__.getState().updateSelectedStyles({ display: "flex", width: "160px", gap: "8px", borderRadius: "8px", paddingTop: "12px", paddingRight: "12px", paddingBottom: "12px", paddingLeft: "12px", opacity: "0.5" }); return el.id; });
await page.waitForTimeout(500);
// B9 Modified
await panel("Styles");
await page.locator(".styles-panel-tab").nth(4).click().catch(async () => { await page.locator(".styles-panel-tab").last().click(); }); await page.waitForTimeout(500);
console.log("modified rows:", await page.evaluate(() => Array.from(document.querySelectorAll('[data-panel-id="styles"] .modified-row')).map((r) => `${r.querySelector(".modified-row__key").textContent} = ${r.querySelector(".modified-row__text").textContent}`)), "count", await page.locator('[data-panel-id="styles"] .modified-count').textContent());
await page.locator('[data-panel-id="styles"] .panel-contents').screenshot({ path: `${OUT}/b9-modified.png` });
// B13 Fill Blend
await page.locator(".styles-panel-tab").nth(1).click(); await page.waitForTimeout(400);
await page.locator('[data-panel-id="styles"] .section[data-section-id="fill"] .fill-layer-row__trigger').first().click().catch(() => {}); await page.waitForTimeout(600);
console.log("blend:", await page.evaluate(() => { const f = document.querySelector('.react-aria-Popover .blend-mode'); return f ? { legend: f.querySelector("legend")?.textContent, icon: Boolean(f.querySelector(".control-label")), rect: `${Math.round(f.getBoundingClientRect().width)}×${Math.round(f.getBoundingClientRect().height)}` } : "no popover"; }));
await page.locator(".react-aria-Popover .fill-detail-popover__footer").screenshot({ path: `${OUT}/b13-blend.png` }).catch(() => {});
await page.keyboard.press("Escape"); await page.waitForTimeout(300);
// B13 Properties Icon field — Button
await add(/^button$/i);
await page.evaluate(async () => { const st = window.__composition_STORE__.getState(); const el = st.elements.filter((e) => e.page_id === st.currentPageId && e.type === "Button").pop(); st.setSelectedElement(el.id, el.props); }); await page.waitForTimeout(500);
await panel("Properties");
console.log("icon field:", await page.evaluate(() => { const f = Array.from(document.querySelectorAll('[data-panel-id="properties"] fieldset.properties-aria')).find((x) => x.getAttribute("aria-label") === "Icon" || x.querySelector("legend")?.textContent === "Icon"); if (!f) return "none"; const r = f.getBoundingClientRect(); return { mode: f.dataset.labelMode, legend: Boolean(f.querySelector("legend")), value: f.querySelector(".icon-picker-value")?.textContent, sfx: f.querySelector(".property-field__suffix")?.textContent, chevron: Boolean(f.querySelector(".select-chevron")), rect: `${Math.round(r.width)}×${Math.round(r.height)}` }; }));
await page.locator('[data-panel-id="properties"] .panel-contents').screenshot({ path: `${OUT}/b13-icon.png` });
// B11 Settings
await page.locator(".header-menu-button").first().click(); await page.waitForTimeout(400);
await page.locator('[role=menuitem]').filter({ hasText: /settings/i }).first().click(); await page.waitForTimeout(700);
console.log("settings sections:", await page.evaluate(() => Array.from(document.querySelectorAll('[data-panel-id="settings"] .section-title')).map((t) => t.textContent.trim())));
console.log("page gap:", await page.evaluate(() => { const f = Array.from(document.querySelectorAll('[data-panel-id="settings"] fieldset.properties-aria')).find((x) => x.querySelector("legend")?.textContent === "Page Gap"); const r = f.getBoundingClientRect(); return { icon: Boolean(f.querySelector(".control-label")), val: f.querySelector("input").value, sfx: f.querySelector(".property-unit-input__suffix")?.textContent, stepper: f.querySelectorAll(".property-unit-input__step").length, rect: `${Math.round(r.width)}×${Math.round(r.height)}`, mode: f.dataset.labelMode }; }));
await page.locator('[data-panel-id="settings"] .property-unit-input .property-unit-input__step').first().click(); await page.waitForTimeout(400);
console.log("pageGap store after step+:", await page.evaluate(() => window.__composition_STORE__.getState().pageGap));
await page.locator('[data-panel-id="settings"] .panel-contents').screenshot({ path: `${OUT}/b11-settings.png` });
// B10 Theme grid
await panel("Theme");
console.log("tint grid:", await page.evaluate(() => { const g = document.querySelector('[data-panel-id="theme"] .tint-grid'); const sw = g.querySelectorAll(".tint-swatch"); const r0 = sw[0].getBoundingClientRect(), r1 = sw[1].getBoundingClientRect(), r6 = sw[6]?.getBoundingClientRect(); return { count: sw.length, swatch: `${Math.round(r0.width)}×${Math.round(r0.height)}`, pitchX: Math.round(r1.left - r0.left), pitchY: r6 ? Math.round(r6.top - r0.top) : null, cols: getComputedStyle(g).gridTemplateColumns.split(" ").length, width: Math.round(g.getBoundingClientRect().width) }; }));
await page.locator('[data-panel-id="theme"] .panel-contents').screenshot({ path: `${OUT}/b10-theme.png` });
// B12 Data creator
await panel("Data");
const addBtn = page.locator('[data-panel-id="datatable"] button[aria-label*="Add" i], [data-panel-id="datatable"] button[aria-label*="New" i], [data-panel-id="datatable"] button[aria-label*="Create" i]').first(); if (await addBtn.count()) await addBtn.click(); else await page.locator('[data-panel-id="datatable"] button').filter({ hasText: /new table|add table|table/i }).first().click(); await page.waitForTimeout(700);
console.log("start from:", await page.evaluate(() => { const f = document.querySelector(".creator-start-from"); if (!f) return "none"; const cells = Array.from(f.querySelectorAll(".creator-method")).map((c) => { const s = c.querySelector("span"); return `${s.textContent} ${Math.round(c.getBoundingClientRect().width)}×${Math.round(c.getBoundingClientRect().height)} clip=${s.scrollWidth > s.clientWidth}`; }); return { legend: f.querySelector("legend")?.textContent, cells }; }));
await page.locator(".datatable-creator").screenshot({ path: `${OUT}/b12-creator.png` }).catch(() => {});
console.log("errors", errors.slice(0, 3));
await browser.close();
