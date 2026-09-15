import { chromium } from "playwright";
import { resolve } from "node:path";
const OUT = "/private/tmp/claude-501/-Users-admin-work-composition/f6bcc488-f176-4644-8364-3625704b801c/scratchpad/audit";
const READY = () => Boolean(window.__composition_STORE__ && window.__composition_STORE__.getState().currentPageId && document.querySelector(".app:not(.builder-booting)") && document.querySelector('[data-testid="skia-canvas-unified"]'));
const browser = await chromium.launch({ headless: false });
const page = await (await browser.newContext({ storageState: resolve("apps/builder/scripts/.auth-session.json"), viewport: { width: 1600, height: 1200 }, deviceScaleFactor: 2 })).newPage();
const errors = []; page.on("pageerror", (e) => errors.push(e.message));
await page.goto("http://localhost:5173/dashboard", { waitUntil: "networkidle" });
const b = page.locator("button.dashboard-create-button").first(); await b.waitFor({ state: "visible", timeout: 15000 }); await b.click();
const i = page.locator("#new-project-name"); await i.waitFor({ state: "visible" }); await i.fill(`lg-${Date.now()}`); await i.press("Enter");
await page.waitForURL(/\/builder\/[^/?]+$/, { timeout: 60000 }); await page.waitForFunction(READY, undefined, { timeout: 90000 }); await page.waitForTimeout(1200);
const add = async (re) => { await page.getByRole("button", { name: "Components", exact: true }).first().click(); await page.waitForTimeout(500); const item = page.locator("button.list-item").filter({ has: page.locator(".list-item-name", { hasText: re }) }).first(); await item.scrollIntoViewIfNeeded(); await item.click(); await page.waitForTimeout(1500); await page.getByRole("button", { name: "Components", exact: true }).first().click().catch(() => {}); await page.waitForTimeout(300); };
await add(/^text$/i);
const txt = await page.evaluate(() => { const st = window.__composition_STORE__.getState(); const t = st.elements.filter((e) => e.page_id === st.currentPageId && /^text$/i.test(e.type)).pop(); st.setSelectedElement(t.id, t.props); return { id: t.id, type: t.type }; });
console.log("text:", txt);
await page.waitForTimeout(500);
await page.getByRole("button", { name: "Styles", exact: true }).first().click(); await page.waitForTimeout(500);
const P = '[data-panel-id="styles"]';
const dumpFields = (scope) => page.evaluate((scope) => Array.from(document.querySelectorAll(`${scope} fieldset.properties-aria`)).map((f) => { const r = f.getBoundingClientRect(); const input = f.querySelector("input"); const lg = f.querySelector("legend"); const trig = f.querySelector(".property-unit-input__suffix--trigger, .react-aria-Select .react-aria-Button"); const box = f.querySelector(".react-aria-Group, .react-aria-Select .react-aria-Button, .react-aria-ToggleButtonGroup"); const br = box?.getBoundingClientRect(); const lr = lg?.getBoundingClientRect(); return `${(lg?.textContent ?? f.getAttribute("aria-label") ?? "?").trim()} fs[${Math.round(r.width)}×${Math.round(r.height)}] legend=${lg ? `${Math.round(lr.width)}w clip:${lg.scrollWidth > lg.clientWidth}` : "-"} box=${br ? `${Math.round(br.width)}×${Math.round(br.height)} @y${Math.round(br.top - r.top)}` : "-"} mode=${f.dataset.labelMode} val="${input?.value ?? ""}" ph="${input?.placeholder ?? ""}" trig="${trig?.textContent.trim() ?? ""}" stp=${f.querySelectorAll(".property-unit-input__step").length} clip=${input ? input.scrollWidth > input.clientWidth : false} dis=${input?.disabled}`; }), scope);
// Layout tab: Position
await page.locator(".styles-panel-tab").nth(0).click(); await page.waitForTimeout(400);
const posCaret = page.locator(`${P} .section[data-section-id="position"] .section-caret[aria-expanded="false"]`); if (await posCaret.count()) { await posCaret.click(); await page.waitForTimeout(300); }
console.log("position (static):", await dumpFields(`${P} .section[data-section-id="position"]`));
await page.locator(`${P} .section[data-section-id="position"] button[aria-label="Absolute position"]`).click(); await page.waitForTimeout(500);
console.log("position (absolute):", await dumpFields(`${P} .section[data-section-id="position"]`));
const leftInput = page.locator(`${P} .section[data-section-id="position"] .left input`); await leftInput.click(); await leftInput.fill("24"); await leftInput.press("Enter"); await page.waitForTimeout(500);
const st = (keys) => page.evaluate(({ id, keys }) => { const s = window.__composition_STORE__.getState().elements.find((e) => e.id === id).props.style ?? {}; return Object.fromEntries(keys.map((k) => [k, s[k]])); }, { id: txt.id, keys });
console.log("after left 24:", await st(["position", "left", "top"]), (await dumpFields(`${P} .section[data-section-id="position"]`))[0]);
await page.locator(`${P} .section[data-section-id="position"] .top .property-unit-input__suffix--trigger`).click(); await page.waitForTimeout(400);
console.log("Top menu:", await page.evaluate(() => Array.from(document.querySelectorAll('.react-aria-Popover [role="option"]')).map((o) => o.textContent.trim())));
await page.locator('.react-aria-Popover [role="option"]').filter({ hasText: /^%$/ }).click(); await page.waitForTimeout(500);
console.log("after top %:", await st(["top"]), (await dumpFields(`${P} .section[data-section-id="position"]`))[1]);
await page.locator(`${P} .section[data-section-id="position"]`).screenshot({ path: `${OUT}/legend-position.png` });
// page X/Y: select page (deselect element)
await page.evaluate(() => { const s = window.__composition_STORE__.getState(); const pg = s.elements.find((e) => e.page_id === s.currentPageId && e.type === "body"); if (pg) s.setSelectedElement(pg.id, pg.props); else s.setSelectedElement(null); }); await page.waitForTimeout(500);
console.log("page position:", await dumpFields(`${P} .section[data-section-id="position"]`));
// Text tab: Typography
await page.evaluate((id) => { const s = window.__composition_STORE__.getState(); const el = s.elements.find((e) => e.id === id); s.setSelectedElement(el.id, el.props); }, txt.id); await page.waitForTimeout(500);
await page.locator(".styles-panel-tab").nth(2).click(); await page.waitForTimeout(400);
console.log("typography:", await dumpFields(`${P} .section[data-section-id="typography"]`));
const fs = page.locator(`${P} .section[data-section-id="typography"] .font-size input`); await fs.click(); await fs.fill("18"); await fs.press("Enter"); await page.waitForTimeout(500);
await page.locator(`${P} .section[data-section-id="typography"] .line-height .property-unit-input__suffix--trigger`).click(); await page.waitForTimeout(400);
await page.locator('.react-aria-Popover [role="option"]').filter({ hasText: /^px$/ }).click(); await page.waitForTimeout(400);
const lh = page.locator(`${P} .section[data-section-id="typography"] .line-height input`); await lh.click(); await lh.fill("28"); await lh.press("Enter"); await page.waitForTimeout(500);
await page.locator(`${P} .section[data-section-id="typography"] .font-weight .react-aria-Button`).click(); await page.waitForTimeout(400);
await page.locator('.react-aria-Popover [role="option"]').filter({ hasText: /Bold/ }).first().click(); await page.waitForTimeout(500);
console.log("after typography edits:", await st(["fontSize", "lineHeight", "fontWeight", "letterSpacing"]), (await dumpFields(`${P} .section[data-section-id="typography"]`)).slice(1, 5));
await page.locator(`${P} .section[data-section-id="typography"]`).screenshot({ path: `${OUT}/legend-typography.png` });
// Style tab: Effect → add shadow → open editor
await page.locator(".styles-panel-tab").nth(1).click(); await page.waitForTimeout(400);
const effCaret = page.locator(`${P} .section[data-section-id="effect"] .section-caret[aria-expanded="false"]`); if (await effCaret.count()) { await effCaret.click(); await page.waitForTimeout(300); }
await page.locator(`${P} .section[data-section-id="effect"] button[aria-label="Box shadow actions"]`).click(); await page.waitForTimeout(400);
console.log("menu:", await page.evaluate(() => Array.from(document.querySelectorAll('.property-row-menu-popover [role="menuitem"], .react-aria-Popover [role="menuitem"]')).map((o) => o.textContent.trim())));
await page.locator('.property-row-menu-popover [role="menuitem"]').first().click(); await page.waitForTimeout(600);
await page.locator(`${P} .section[data-section-id="effect"] button[aria-label="Edit shadow layer"]`).first().click(); await page.waitForTimeout(600);
console.log("shadow editor:", await dumpFields(`.box-shadow-editor`));
const blur = page.locator(`.box-shadow-editor .box-shadow-blur input`); await blur.click(); await blur.fill("12"); await blur.press("Enter"); await page.waitForTimeout(500);
await page.locator(`.box-shadow-editor .box-shadow-offsetY .property-unit-input__step`).first().click(); await page.waitForTimeout(400);
console.log("after shadow edits:", await st(["boxShadow"]), (await dumpFields(`.box-shadow-editor`)).slice(0, 3));
console.log("editor size:", await page.evaluate(() => { const e = document.querySelector(".box-shadow-editor"); const r = e.getBoundingClientRect(); const p = e.closest(".react-aria-Popover")?.getBoundingClientRect(); return { editor: `${Math.round(r.width)}×${Math.round(r.height)}`, popover: p && `${Math.round(p.width)}×${Math.round(p.height)}` }; }));
await page.locator(`.box-shadow-editor`).screenshot({ path: `${OUT}/legend-shadow.png` });
console.log("errors:", errors);
await browser.close();
