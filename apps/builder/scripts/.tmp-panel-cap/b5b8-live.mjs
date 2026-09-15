import { chromium } from "playwright";
import { resolve } from "node:path";
const OUT = "/private/tmp/claude-501/-Users-admin-work-composition/f6bcc488-f176-4644-8364-3625704b801c/scratchpad/audit";
const READY = () => Boolean(window.__composition_STORE__ && window.__composition_STORE__.getState().currentPageId && document.querySelector(".app:not(.builder-booting)") && document.querySelector('[data-testid="skia-canvas-unified"]'));
const browser = await chromium.launch({ headless: false });
const page = await (await browser.newContext({ storageState: resolve("apps/builder/scripts/.auth-session.json"), viewport: { width: 1600, height: 1200 }, deviceScaleFactor: 2 })).newPage();
const errors = []; page.on("pageerror", (e) => errors.push(e.message));
await page.goto("http://localhost:5173/dashboard", { waitUntil: "networkidle" });
const b = page.locator("button.dashboard-create-button").first(); await b.waitFor({ state: "visible", timeout: 15000 }); await b.click();
const i = page.locator("#new-project-name"); await i.waitFor({ state: "visible" }); await i.fill(`b58-${Date.now()}`); await i.press("Enter");
await page.waitForURL(/\/builder\/[^/?]+$/, { timeout: 60000 }); await page.waitForFunction(READY, undefined, { timeout: 90000 }); await page.waitForTimeout(1200);
const add = async (re) => { await page.getByRole("button", { name: "Components", exact: true }).first().click(); await page.waitForTimeout(500); const item = page.locator("button.list-item").filter({ has: page.locator(".list-item-name", { hasText: re }) }).first(); await item.scrollIntoViewIfNeeded(); await item.click(); await page.waitForTimeout(1500); await page.getByRole("button", { name: "Components", exact: true }).first().click().catch(() => {}); await page.waitForTimeout(300); };
await add(/^frame$/i);
const frameId = await page.evaluate(async () => { const st = window.__composition_STORE__.getState(); const el = st.elements.filter((e) => e.page_id === st.currentPageId && e.type === "frame").pop(); st.setSelectedElement(el.id, el.props); await new Promise((r) => setTimeout(r, 300)); window.__composition_STORE__.getState().updateSelectedStyles({ width: "200px", height: "120px", backgroundColor: "#2F6FED", borderWidth: "4px", borderStyle: "solid", borderColor: "#102A5C", borderRadius: "8px" }); return el.id; });
await page.waitForTimeout(500);
await page.getByRole("button", { name: "Styles", exact: true }).first().click(); await page.waitForTimeout(500);
await page.locator(".styles-panel-tab").nth(1).click(); await page.waitForTimeout(400);
const P = '[data-panel-id="styles"]';
const style = (keys) => page.evaluate(({ id, keys }) => { const s = window.__composition_STORE__.getState().elements.find((e) => e.id === id).props.style ?? {}; return Object.fromEntries(keys.map((k) => [k, s[k]])); }, { id: frameId, keys });
// B5 corners
console.log("corners:", await page.evaluate((P) => Array.from(document.querySelectorAll(`${P} .border-corner`)).map((f) => { const r = f.getBoundingClientRect(); return `${f.getAttribute("aria-label")} ${Math.round(r.width)}×${Math.round(r.height)} icon=${Boolean(f.querySelector(".control-label svg"))} legend=${Boolean(f.querySelector("legend"))} val=${f.querySelector("input").value} sfx=${f.querySelector(".property-unit-input__suffix")?.textContent} stepper=${f.querySelectorAll(".property-unit-input__step").length}`; }), P));
await page.locator(`${P} .section[data-section-id="border"]`).screenshot({ path: `${OUT}/b5-border.png` });
const tr = page.locator(`${P} .border-corner-tr input`); await tr.click(); await tr.fill("20"); await tr.press("Enter"); await page.waitForTimeout(500);
console.log("after TR 20:", await style(["borderTopRightRadius", "borderRadius", "borderTopLeftRadius"]));
await page.locator(`${P} .border-corner-bl .property-unit-input__step`).first().click(); await page.waitForTimeout(400);
console.log("after BL step+:", await style(["borderBottomLeftRadius"]));
// B8 picker
await page.locator(`${P} .section[data-section-id="border"] .color-swatch-button`).first().click(); await page.waitForTimeout(700);
const dumpPicker = () => page.evaluate(() => { const pop = document.querySelector(".react-aria-Popover"); const q = (s) => pop.querySelector(s); const r = (el) => el && `${Math.round(el.getBoundingClientRect().width)}×${Math.round(el.getBoundingClientRect().height)}`; const row = q(".color-picker-panel__inputs-row"); return { popover: r(pop), area: r(q(".react-aria-ColorArea")), tracks: Array.from(pop.querySelectorAll(".react-aria-ColorSlider .react-aria-SliderTrack")).map(r), row: r(row), rowChildren: Array.from(row.children).map((c) => `${c.className.split(" ")[0]} ${r(c)}`), seg: Array.from(pop.querySelectorAll(".color-input-mode-selector__btn")).map((b) => `${b.textContent} ${r(b)} ${b.getAttribute("aria-checked")}`), segOverflow: q(".color-input-mode-selector").scrollWidth > q(".color-input-mode-selector").clientWidth, hex: q(".color-input-text-field input")?.value, hexSfx: q(".color-input-text-field__suffix")?.textContent, detail: Array.from(pop.querySelectorAll(".color-input-fields:not(.color-input-fields--hex) .scrub-input, .color-input-fields--css .color-input-text-field")).map((s) => `${s.getAttribute("aria-label") ?? s.querySelector("input")?.getAttribute("aria-label")} ${r(s)}`), group: r(q(".color-input-fields__group")) }; });
console.log("picker hex:", JSON.stringify(await dumpPicker(), null, 1));
await page.locator(".react-aria-Popover").screenshot({ path: `${OUT}/b8-hex.png` });
// type hex
const hexIn = page.locator(".react-aria-Popover .color-input-text-field input"); await hexIn.click(); await hexIn.fill("E8443F"); await hexIn.press("Enter"); await page.waitForTimeout(500);
console.log("after hex type:", await style(["borderColor"]));
// RGBA mode
await page.locator('.react-aria-Popover .color-input-mode-selector__btn', { hasText: "RGBA" }).click(); await page.waitForTimeout(400);
console.log("picker rgba:", JSON.stringify(await dumpPicker(), null, 1));
await page.locator(".react-aria-Popover").screenshot({ path: `${OUT}/b8-rgba.png` });
// edit G via scrub input: double-click? use keyboard: click display → field
const gScrub = page.locator('.react-aria-Popover .color-input-fields__group .scrub-input').nth(1);
await gScrub.dblclick(); await page.waitForTimeout(200);
const gField = page.locator('.react-aria-Popover .color-input-fields__group .scrub-input__field');
if (await gField.count()) { await gField.fill("200"); await gField.press("Enter"); await page.waitForTimeout(500); }
console.log("after G 200:", await style(["borderColor"]), "hex field", await page.locator(".react-aria-Popover .color-input-text-field input").inputValue());
await page.locator('.react-aria-Popover .color-input-mode-selector__btn', { hasText: "CSS" }).click(); await page.waitForTimeout(400);
console.log("picker css:", JSON.stringify((await dumpPicker()).detail));
await page.locator(".react-aria-Popover").screenshot({ path: `${OUT}/b8-css.png` });
await page.locator('.react-aria-Popover .color-input-mode-selector__btn', { hasText: "HEX" }).click(); await page.waitForTimeout(300);
await page.keyboard.press("Escape"); await page.waitForTimeout(300);
console.log("errors", errors.slice(0, 3));
await browser.close();
