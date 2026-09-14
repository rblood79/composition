import { chromium } from "playwright";
import { resolve } from "node:path";
const READY = () => Boolean(window.__composition_STORE__ && window.__composition_STORE__.getState().currentPageId && document.querySelector(".app:not(.builder-booting)") && document.querySelector('[data-testid="skia-canvas-unified"]'));
const browser = await chromium.launch({ headless: false });
const page = await (await browser.newContext({ storageState: resolve("apps/builder/scripts/.auth-session.json"), viewport: { width: 1600, height: 1100 }, deviceScaleFactor: 2 })).newPage();
const errors = []; page.on("pageerror", e => errors.push(e.message));
await page.goto("http://localhost:5173/dashboard", { waitUntil: "networkidle" });
const b = page.locator("button.dashboard-create-button").first(); await b.waitFor({ state: "visible", timeout: 15000 }); await b.click();
const i = page.locator("#new-project-name"); await i.waitFor({ state: "visible" }); await i.fill(`fp-${Date.now()}`); await i.press("Enter");
await page.waitForURL(/\/builder\/[^/?]+$/, { timeout: 60000 }); await page.waitForFunction(READY, undefined, { timeout: 90000 }); await page.waitForTimeout(1200);
const M = (sel, n = 12) => page.evaluate(({ sel, n }) => Array.from(document.querySelectorAll(sel)).filter(el => el.getBoundingClientRect().width > 0).slice(0, n).map(el => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return `${el.className.toString().slice(0, 40)} | ${Math.round(r.width)}×${Math.round(r.height)} fs${cs.fontSize}`; }), { sel, n });
// Navigator → Frames tab → Add Frame
const navBtn = page.getByRole("button", { name: "Navigator", exact: true }).first(); if (await navBtn.count()) { await navBtn.click(); await page.waitForTimeout(500); }
await page.getByRole("tab", { name: "Frames" }).first().click(); await page.waitForTimeout(400);
await page.getByRole("button", { name: "Add Frame" }).first().click(); await page.waitForTimeout(1200);
const propsBtn = page.getByRole("button", { name: "Properties", exact: true }).first(); if (await propsBtn.count()) { await propsBtn.click(); await page.waitForTimeout(600); }
console.log("panels:", await page.evaluate(() => Array.from(document.querySelectorAll('[data-panel-id]')).map(e => e.getAttribute('data-panel-id') + ':' + (e.querySelector('.panel-title')?.textContent ?? '')).join(' | ')));
console.log("editMode/selected:", await page.evaluate(() => { const st = window.__composition_STORE__.getState(); return st.selectedElementId + " " + st.elements.find(e => e.id === st.selectedElementId)?.type; }));
console.log("header title:", await page.locator('[data-panel-id="properties"] .panel-title').first().textContent({ timeout: 5000 }).catch(() => "n/a"));
console.log(JSON.stringify(await M('[data-panel-id="properties"] .list-subgroup-header, [data-panel-id="properties"] .list-subgroup-count, [data-panel-id="properties"] .list-item.preset-card, [data-panel-id="properties"] .preset-preview-svg, [data-panel-id="properties"] .preset-card__name-row', 8), null, 1));
await page.locator('[data-panel-id="properties"]').screenshot({ path: "/tmp/claude-501/cp2/fp-before.png" });
// Apply "Left Sidebar" (no existing slots → applies directly)
await page.getByRole("button", { name: /Left Sidebar/ }).first().click(); await page.waitForTimeout(1200);
console.log("after apply — badge:", await M('[data-panel-id="properties"] .list-item-badge.applied', 2), "slots:", JSON.stringify(await M('[data-panel-id="properties"] .frame-slot-row, [data-panel-id="properties"] .frame-slot-row__count, [data-panel-id="properties"] .frame-slots-count', 8)));
await page.locator('[data-panel-id="properties"]').screenshot({ path: "/tmp/claude-501/cp2/fp-applied.png" });
// Apply "Holy Grail" → existing slots dialog
await page.getByRole("button", { name: /Holy Grail/ }).first().click(); await page.waitForTimeout(800);
console.log("dialog rules:", await page.evaluate(() => { const d = document.querySelector('.existing-slot-dialog [role=alertdialog]'); const out = []; for (const sh of document.styleSheets) { let rules; try { rules = sh.cssRules; } catch { continue; } const walk = (rs) => { for (const r of rs) { if (r.cssRules && !r.selectorText) { walk(r.cssRules); continue; } if (r.selectorText && r.style && r.style.position === 'fixed') { try { if (d.matches(r.selectorText)) out.push(r.selectorText + ' @ ' + (sh.href ?? 'inline').slice(-60)); } catch {} } } }; walk(rules); } return out.join(' || '); }));
console.log("dialog debug:", await page.evaluate(() => { const m = document.querySelector('.existing-slot-dialog'); const d = m?.querySelector('[role=alertdialog]'); const cs = (el) => { const c = getComputedStyle(el); return { display: c.display, position: c.position, width: c.width, height: c.height, overflow: c.overflow, transform: c.transform, cls: el.className, parent: el.parentElement?.className }; }; return JSON.stringify({ modal: m && cs(m), dialog: d && cs(d), overlay: m && cs(m.parentElement) }); }));
console.log("dialog:", JSON.stringify(await M('.existing-slot-dialog, .existing-slot-dialog .confirm-dialog-header, .existing-slot-dialog__row, .existing-slot-dialog .confirm-dialog-actions, .existing-slot-dialog .control-button', 12), null, 1));
await page.locator('.existing-slot-dialog').screenshot({ path: "/tmp/claude-501/cp2/fp-dialog.png" });
await page.getByRole("button", { name: /Merge/ }).click(); await page.waitForTimeout(1200);
console.log("after merge slots:", JSON.stringify(await M('[data-panel-id="properties"] .frame-slot-row__name', 8)));
// click a slot row → selects slot
await page.locator('[data-panel-id="properties"] .frame-slot-row').first().click(); await page.waitForTimeout(500);
console.log("selected after slot click:", await page.evaluate(() => { const st = window.__composition_STORE__.getState(); return st.elements.find(e => e.id === st.selectedElementId)?.type; }));
console.log("errors", errors.slice(0, 3));
await browser.close();
