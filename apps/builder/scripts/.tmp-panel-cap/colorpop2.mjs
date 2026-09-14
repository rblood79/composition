import { chromium } from "playwright";
import { resolve } from "node:path";
const OUT = process.env.OUT;
const READY = () => Boolean(window.__composition_STORE__ && window.__composition_STORE__.getState().currentPageId && document.querySelector(".app:not(.builder-booting)") && document.querySelector('[data-testid="skia-canvas-unified"]'));
const browser = await chromium.launch({ headless: false });
const page = await (await browser.newContext({ storageState: resolve("apps/builder/scripts/.auth-session.json"), viewport: { width: 1600, height: 1100 }, deviceScaleFactor: 2 })).newPage();
const errors = []; page.on("pageerror", e => errors.push(e.message));
await page.goto("http://localhost:5173/dashboard", { waitUntil: "networkidle" });
const b = page.locator("button.dashboard-create-button").first(); await b.waitFor({ state: "visible", timeout: 15000 }); await b.click();
const i = page.locator("#new-project-name"); await i.waitFor({ state: "visible" }); await i.fill(`cp-${Date.now()}`); await i.press("Enter");
await page.waitForURL(/\/builder\/[^/?]+$/, { timeout: 60000 }); await page.waitForFunction(READY, undefined, { timeout: 90000 }); await page.waitForTimeout(1200);
await page.evaluate(async () => { const st = window.__composition_STORE__.getState(); const body = st.elements.find(e => e.type === "body" && e.page_id === st.currentPageId) ?? st.elements.find(e => e.type === "body"); const now = new Date().toISOString(); const id = crypto.randomUUID(); await st.addElement({ id, type: "Button", parent_id: body.id, page_id: body.page_id, order_num: 99, created_at: now, updated_at: now, props: { children: "Primary action" } }, { skipHistory: true }); await new Promise(r => setTimeout(r, 800)); const st2 = window.__composition_STORE__.getState(); st2.setSelectedElement(id, st2.elements.find(e => e.id === id)?.props); });
await page.waitForTimeout(600);
const M = (sel, n = 3) => page.evaluate(({ sel, n }) => Array.from(document.querySelectorAll(sel)).filter(el => el.getBoundingClientRect().width > 0).slice(0, n).map(el => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return `${el.className.toString().replace(/react-aria-/g,'').slice(0, 44)} | ${Math.round(r.width)}×${Math.round(r.height)} fs${cs.fontSize} pad${cs.padding} gap${cs.gap} r${cs.borderRadius}`; }), { sel, n });
const out = {}; const rec = async (k, sel, n) => { out[k] = await M(sel, n); };
const shot = async (n, loc) => { try { await loc.screenshot({ path: `${OUT}/${n}.png` }); } catch (e) { console.log("[miss]", n, e.message.slice(0,80)); } };
await page.getByRole("button", { name: "Styles", exact: true }).first().click(); await page.waitForTimeout(500);
await page.locator(".styles-panel-tab").nth(1).click(); await page.waitForTimeout(400);
// 1) 기본형 — Border color (PropertyColor)
const sw = page.locator('[data-panel-id="styles"] .color-swatch-button[aria-label="Color"]').first();
await sw.click(); await page.waitForTimeout(600);
await rec("base", ".property-color-popover, .property-color-popover .color-picker-panel, .property-color-popover .ColorArea, .property-color-popover .react-aria-ColorArea, .property-color-popover .react-aria-ColorSlider, .property-color-popover .react-aria-SliderTrack, .property-color-popover .react-aria-ColorThumb, .property-color-popover .color-picker-panel__inputs-row, .property-color-popover .color-input-mode-selector, .property-color-panel .color-input-mode-selector__btn, .property-color-popover .color-input-mode-selector__btn, .property-color-popover .color-input-text-field__input, .property-color-popover .color-input-text-field__label, .property-color-popover .eyedropper-button, .property-color-popover button", 14);
await shot("pop-base-hex", page.locator(".property-color-popover").first());
const rgba = page.locator(".property-color-popover .color-input-mode-selector__btn").nth(1); await rgba.click(); await page.waitForTimeout(300);
await rec("base_rgba", ".property-color-popover .color-input-fields, .property-color-popover .color-input-number-field, .property-color-popover .color-input-number-field__scrub, .property-color-popover .color-input-number-field .scrub-input, .property-color-popover .scrub-input__suffix, .property-color-popover .color-input-number-field input", 8);
await shot("pop-base-rgba", page.locator(".property-color-popover").first());
await page.locator(".property-color-popover .color-input-mode-selector__btn").nth(2).click(); await page.waitForTimeout(300);
await shot("pop-base-css", page.locator(".property-color-popover").first());
await page.locator(".property-color-popover .color-input-mode-selector__btn").nth(0).click(); await page.waitForTimeout(200);
await page.keyboard.press("Escape"); await page.waitForTimeout(400);
// 2) 확장형 — Fill
await page.locator('[data-panel-id="styles"] .color-swatch-button[aria-label="Edit background fill"]').first().click(); await page.waitForTimeout(600);
const P = ".fill-detail-popover-container";
await rec("fill_color", `${P}, ${P} .fill-detail-popover, ${P} .fill-type-selector, ${P} .fill-type-selector legend, ${P} .fill-type-selector .react-aria-ToggleButtonGroup, ${P} .fill-type-selector .react-aria-ToggleButton, ${P} .color-picker-panel, ${P} .fill-detail-popover__footer, ${P} .fill-detail-popover__opacity, ${P} .fill-detail-popover__opacity .scrub-input, ${P} .fill-detail-popover__opacity legend, ${P} .fill-detail-popover__divider, ${P} .blend-mode, ${P} .blend-mode legend, ${P} .blend-mode .react-aria-Button, ${P} .blend-mode button`, 16);
await shot("pop-fill-color", page.locator(P).first());
// Gradient
await page.locator(`${P} .fill-type-selector .react-aria-ToggleButton`).nth(1).click(); await page.waitForTimeout(700);
await rec("fill_gradient", `${P}, ${P} .gradient-editor, ${P} .gradient-sub-type-selector, ${P} .gradient-sub-type-selector .react-aria-ToggleButton, ${P} .gradient-bar, ${P} .gradient-bar__handle, ${P} .gradient-editor .color-picker-panel, ${P} .gradient-editor__divider, ${P} .gradient-controls, ${P} .gradient-controls fieldset, ${P} .gradient-controls input, ${P} .gradient-stop-list, ${P} .gradient-stop-list__row, ${P} .gradient-stop-list__swatch, ${P} .gradient-stop-list__position, ${P} .gradient-stop-list__delete, ${P} .gradient-stop-list__add-btn`, 20);
await shot("pop-fill-gradient-linear", page.locator(P).first());
// Radial via Select
const seg = (name) => page.locator(`${P} .gradient-sub-type-selector .react-aria-ToggleButton`, { hasText: name }).first();
await seg("Radial").click(); await page.waitForTimeout(600);
await rec("fill_gradient_radial", `${P}, ${P} .gradient-controls, ${P} .gradient-controls fieldset`, 8);
await shot("pop-fill-gradient-radial", page.locator(P).first());
await seg("Mesh").click(); await page.waitForTimeout(700);
await rec("fill_mesh", `${P}, ${P} .mesh-gradient-editor, ${P} .mesh-gradient-editor__grid-controls, ${P} .mesh-gradient-editor__scrub, ${P} .mesh-gradient-editor__point-grid, ${P} .mesh-gradient-editor__point, ${P} .mesh-gradient-editor .color-picker-panel`, 10);
await shot("pop-fill-mesh", page.locator(P).first());
// Image
await page.locator(`${P} .fill-type-selector .react-aria-ToggleButton`).nth(2).click(); await page.waitForTimeout(700);
await rec("fill_image", `${P}, ${P} .image-fill-editor, ${P} .image-fill-editor__preview, ${P} .image-fill-editor__url-row, ${P} .image-fill-editor__label, ${P} .image-fill-editor__url-input, ${P} .image-fill-editor__mode-row, ${P} .image-fill-editor__mode-group, ${P} .image-fill-editor__mode-btn`, 12);
await shot("pop-fill-image", page.locator(P).first());
await page.keyboard.press("Escape"); await page.waitForTimeout(400);
// 3) Text color (Text tab) · Shadow color
await page.locator(".styles-panel-tab").nth(2).click(); await page.waitForTimeout(400);
const tsw = page.locator('[data-panel-id="styles"] .color-swatch-button').first();
if (await tsw.count()) { await tsw.click(); await page.waitForTimeout(500); await rec("text_color", ".property-color-popover", 1); await shot("pop-text-color", page.locator(".property-color-popover").first()); await page.keyboard.press("Escape"); await page.waitForTimeout(300); }
out.swatch_counts = { style: await page.locator('[data-panel-id="styles"] .color-swatch-button').count() };
out.errors = errors.slice(0, 5);
console.log(JSON.stringify(out, null, 1));
await browser.close();
