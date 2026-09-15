import { chromium } from "playwright";
import { resolve } from "node:path";
const READY = () => Boolean(window.__composition_STORE__ && window.__composition_STORE__.getState().currentPageId && document.querySelector(".app:not(.builder-booting)") && document.querySelector('[data-testid="skia-canvas-unified"]'));
const browser = await chromium.launch({ headless: false });
const page = await (await browser.newContext({ storageState: resolve("apps/builder/scripts/.auth-session.json"), viewport: { width: 1600, height: 3200 } })).newPage();
const errors = []; page.on("pageerror", (e) => errors.push(e.message));
await page.goto("http://localhost:5173/dashboard", { waitUntil: "networkidle" });
const b = page.locator("button.dashboard-create-button").first(); await b.waitFor({ state: "visible", timeout: 15000 }); await b.click();
const i = page.locator("#new-project-name"); await i.waitFor({ state: "visible" }); await i.fill(`wp-${Date.now()}`); await i.press("Enter");
await page.waitForURL(/\/builder\/[^/?]+$/, { timeout: 60000 }); await page.waitForFunction(READY, undefined, { timeout: 90000 }); await page.waitForTimeout(1200);
const panel = async (name, want = true) => { const b = page.getByRole("button", { name, exact: true }).first(); const pressed = (await b.getAttribute("aria-pressed")) === "true"; if (pressed !== want) { await b.click(); await page.waitForTimeout(400); } };
const P = '[data-panel-id="properties"]';
const props = () => page.evaluate(() => { const st = window.__composition_STORE__.getState(); const el = st.elements.find((e) => e.id === st.selectedElementId); return el ? el.props : null; });
const add = async (name) => { await panel("Components"); const item = page.locator("button.list-item").filter({ has: page.locator(".list-item-name", { hasText: new RegExp(`^${name}$`, "i") }) }).first(); await item.scrollIntoViewIfNeeded(); await item.click(); await page.waitForTimeout(900); await panel("Components", false).catch(() => {}); await panel("Properties", true); await page.waitForTimeout(400); await page.evaluate((P) => { document.querySelectorAll(`${P} .section-caret[aria-expanded="false"]`).forEach((c) => c.click()); }, P); await page.waitForTimeout(300); await page.evaluate((P) => { const pc = document.querySelector(`${P} .panel-contents`); const h = pc.scrollHeight + 8; let el = pc; while (el && !el.classList.contains("panel-dock-surface")) { el.style.setProperty("height", el === pc ? h + "px" : "auto", "important"); el.style.setProperty("max-height", "none", "important"); el.style.setProperty("overflow", "visible", "important"); el = el.parentElement; } }, P); await page.waitForTimeout(200); };
const out = [];
process.on("exit", () => { console.log(out.map((r) => r.join(" ")).join("\n")); });
try {
await add("Text Field");
const before = await props();
// 칩: Required
await page.locator(`${P} .property-chips .react-aria-ToggleButton`, { hasText: "Required" }).first().click(); await page.waitForTimeout(400);
let p = await props(); out.push(["chip Required → isRequired", p.isRequired]);
await page.locator(`${P} .property-chips .react-aria-ToggleButton`, { hasText: "Required" }).first().click(); await page.waitForTimeout(400);
p = await props(); out.push(["chip Required 다시 → isRequired", p.isRequired]);
// On/Off enum 칩: Spell Check
await page.locator(`${P} .property-chips .react-aria-ToggleButton`, { hasText: "Spell Check" }).first().click(); await page.waitForTimeout(400);
p = await props(); out.push(["chip Spell Check → spellCheck", p.spellCheck, "(before", before.spellCheck, ")"]);
// seg: Size L
await page.locator(`${P} .property-seg .react-aria-ToggleButton`, { hasText: /^L$/ }).first().click(); await page.waitForTimeout(400);
p = await props(); out.push(["seg Size L → size", p.size]);
// 아이콘 seg: Label Position side
await page.locator(`${P} .property-seg-glyphs .react-aria-ToggleButton[aria-label="Side"]`).first().click(); await page.waitForTimeout(500);
p = await props(); out.push(["icon seg Side → labelPosition", p.labelPosition]);
const hasAlign = await page.locator(`${P} legend`, { hasText: "Label Align" }).count();
out.push(["Label Align 노출 (side 게이트)", hasAlign]);
// 셀렉트+색점: Button variant
await add("Button");
out.push(["after add Button — selected type", await page.evaluate(() => { const st = window.__composition_STORE__.getState(); const el = st.elements.find((e) => e.id === st.selectedElementId); return el ? el.type : null; }), "legends", await page.evaluate((P) => Array.from(document.querySelectorAll(`${P} legend`)).map((l) => l.textContent).join("|"), P)]);
const vb = page.locator(`${P} fieldset:has(legend:text-is("Variant")) .react-aria-Button`).first(); const vbox = await vb.boundingBox(); out.push(["Variant trigger box", JSON.stringify(vbox), await page.evaluate((P) => { const fs = Array.from(document.querySelectorAll(`${P} fieldset`)).find((f) => f.querySelector("legend")?.textContent === "Variant"); if (!fs) return "no fieldset"; const b = fs.querySelector(".react-aria-Button"); const r = fs.getBoundingClientRect(); const cs = b ? getComputedStyle(b) : null; return JSON.stringify({ fs: [r.x, r.y, r.width, r.height], btn: b ? [cs.display, cs.visibility, b.getBoundingClientRect().width, b.getBoundingClientRect().height] : null, html: fs.outerHTML.slice(0, 400) }); }, P)]); await vb.click({ force: true }); await page.waitForTimeout(300);
const swatchCount = await page.locator(".react-aria-Popover .property-select__swatch").count();
await page.getByRole("option", { name: "Negative" }).click(); await page.waitForTimeout(400);
p = await props(); out.push(["select Negative → variant", p.variant, "swatches in popover", swatchCount]);
// 스와치 seg: Static Color White
await page.locator(`${P} .property-seg .react-aria-ToggleButton[aria-label="White"]`).first().click(); await page.waitForTimeout(400);
p = await props(); out.push(["swatch seg White → staticColor", p.staticColor]);
// 슬라이더: Icon strokeWidth 값 입력
await add("Icon");
const inp = page.locator(`${P} fieldset:has(legend:text-is("Stroke Width")) input.slider-output--input`).first();
await inp.click(); await inp.fill("3"); await inp.press("Enter"); await page.waitForTimeout(500);
p = await props(); out.push(["slider Stroke Width 3 → strokeWidth", p.strokeWidth]);
// 9-위치: Popover
await add("Popover").catch(async () => { out.push(["Popover 팔레트 없음 — 건너뜀"]); });
const cell = page.locator(`${P} .property-placement .react-aria-ToggleButton[aria-label="Top End"]`);
if (await cell.count()) { await cell.click(); await page.waitForTimeout(400); p = await props(); out.push(["placement Top End → placement", p.placement]); }
} catch (e) { out.push(["FAILED", String(e).slice(0, 300)]); }
out.push(["errors", JSON.stringify(errors.slice(0, 5))]);
await browser.close();
