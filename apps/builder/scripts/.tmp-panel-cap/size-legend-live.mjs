import { chromium } from "playwright";
import { resolve } from "node:path";
const OUT = "/private/tmp/claude-501/-Users-admin-work-composition/f6bcc488-f176-4644-8364-3625704b801c/scratchpad/audit";
const READY = () => Boolean(window.__composition_STORE__ && window.__composition_STORE__.getState().currentPageId && document.querySelector(".app:not(.builder-booting)") && document.querySelector('[data-testid="skia-canvas-unified"]'));
const browser = await chromium.launch({ headless: false });
const page = await (await browser.newContext({ storageState: resolve("apps/builder/scripts/.auth-session.json"), viewport: { width: 1600, height: 1200 }, deviceScaleFactor: 2 })).newPage();
const errors = []; page.on("pageerror", (e) => errors.push(e.message));
await page.goto("http://localhost:5173/dashboard", { waitUntil: "networkidle" });
const b = page.locator("button.dashboard-create-button").first(); await b.waitFor({ state: "visible", timeout: 15000 }); await b.click();
const i = page.locator("#new-project-name"); await i.waitFor({ state: "visible" }); await i.fill(`sz-${Date.now()}`); await i.press("Enter");
await page.waitForURL(/\/builder\/[^/?]+$/, { timeout: 60000 }); await page.waitForFunction(READY, undefined, { timeout: 90000 }); await page.waitForTimeout(1200);
const add = async (re) => { await page.getByRole("button", { name: "Components", exact: true }).first().click(); await page.waitForTimeout(500); const item = page.locator("button.list-item").filter({ has: page.locator(".list-item-name", { hasText: re }) }).first(); await item.scrollIntoViewIfNeeded(); await item.click(); await page.waitForTimeout(1500); await page.getByRole("button", { name: "Components", exact: true }).first().click().catch(() => {}); await page.waitForTimeout(300); };
await add(/^frame$/i);
const frameId = await page.evaluate(async () => { const st = window.__composition_STORE__.getState(); const els = st.elements.filter((e) => e.page_id === st.currentPageId && e.type === "frame"); const el = els[els.length - 1]; st.setSelectedElement(el.id, el.props); await new Promise((r) => setTimeout(r, 300)); window.__composition_STORE__.getState().updateSelectedStyles({ display: "flex", flexDirection: "row", width: "400px", height: "160px", gap: "12px" }); return el.id; });
await page.waitForTimeout(400);
await add(/^button$/i);
const btn = await page.evaluate(() => { const st = window.__composition_STORE__.getState(); const b = st.elements.filter((e) => e.page_id === st.currentPageId && e.type === "Button").pop(); return { id: b.id, parent: b.parent_id }; });
await page.evaluate(async (id) => { const st = window.__composition_STORE__.getState(); const el = st.elements.find((e) => e.id === id); st.setSelectedElement(el.id, el.props); }, btn.id); await page.waitForTimeout(500);
await page.getByRole("button", { name: "Styles", exact: true }).first().click(); await page.waitForTimeout(500);
await page.locator(".styles-panel-tab").nth(0).click(); await page.waitForTimeout(400);
const P = '[data-panel-id="styles"]';
const dump = () => page.evaluate((P) => { const sec = document.querySelector(`${P} .section[data-section-id="transform"] .section-content`); const fields = Array.from(sec.querySelectorAll("fieldset.properties-aria")).map((f) => { const r = f.getBoundingClientRect(); const input = f.querySelector("input"); const lg = f.querySelector("legend"); const trig = f.querySelector(".property-unit-input__suffix--trigger, .react-aria-Select .react-aria-Button"); const box = f.querySelector(".react-aria-Group, .react-aria-Select .react-aria-Button"); const br = box?.getBoundingClientRect(); const lr = lg?.getBoundingClientRect(); return `${lg?.textContent ?? f.getAttribute("aria-label")} fs[${Math.round(r.width)}×${Math.round(r.height)}] legendTop=${lr ? Math.round(lr.top - r.top) : "-"} box=${br ? `${Math.round(br.width)}×${Math.round(br.height)} @y${Math.round(br.top - r.top)}` : "-"} mode=${f.dataset.labelMode} val="${input?.value ?? ""}" ph="${input?.placeholder ?? ""}" trig="${trig?.textContent.trim()}" stepper=${f.querySelectorAll(".property-unit-input__step").length} clip=${input ? input.scrollWidth > input.clientWidth : false}`; }); const rows = Array.from(sec.querySelectorAll(".transform-row, .transform-constraints")).map((r) => `${r.className} h${Math.round(r.getBoundingClientRect().height)}`); return { rows, fields, actions: Array.from(sec.querySelectorAll(".fieldset-actions")).map((a) => { const r = a.getBoundingClientRect(); return `${a.className.split(" ").pop()} ${Math.round(r.width)}×${Math.round(r.height)} y${Math.round(r.top)}`; }) }; }, P);
const gap = () => page.evaluate((P) => { const f = document.querySelector(`${P} .displayGap`); if (!f) return null; const r = f.getBoundingClientRect(); const lg = f.querySelector("legend"); const box = f.querySelector(".react-aria-Group"); const br = box.getBoundingClientRect(); return `Gap fs[${Math.round(r.width)}×${Math.round(r.height)}] legendTop=${Math.round(lg.getBoundingClientRect().top - r.top)} box=${Math.round(br.width)}×${Math.round(br.height)} @y${Math.round(br.top - r.top)} mode=${f.dataset.labelMode} trig="${f.querySelector(".property-unit-input__suffix--trigger")?.textContent.trim()}"`; }, P);
const cons = () => page.evaluate((P) => { const c = document.querySelector(`${P} .section[data-section-id="transform"] .transform-constraints`); const t = document.querySelector(`${P} .section[data-section-id="transform"] .actions-size button`); return { state: c?.dataset.constraints, minmax: document.querySelectorAll(`${P} .min-width, .min-height, .max-width, .max-height`).length, ratio: Boolean(document.querySelector(`${P} .aspect-ratio-select`)), constraintsH: Math.round(c?.getBoundingClientRect().height ?? 0), toggle: `${t?.getAttribute("aria-label")} sel=${t?.dataset.selected ?? "no"} ${Math.round(t?.getBoundingClientRect().width)}×${Math.round(t?.getBoundingClientRect().height)}` }; }, P);
console.log("constraints init:", await cons());
console.log("ratio lock align:", await page.evaluate((P) => { const sel = document.querySelector(`${P} .aspect-ratio-select .react-aria-Group, ${P} .aspect-ratio-select .react-aria-Select`).getBoundingClientRect(); const lock = document.querySelector(`${P} .actions-ratio button`).getBoundingClientRect(); return { selectTop: Math.round(sel.top), selectH: Math.round(sel.height), lockTop: Math.round(lock.top), lockH: Math.round(lock.height), dy: Math.round(lock.top - sel.top) }; }, P));
await page.locator(`${P} .section[data-section-id="transform"]`).screenshot({ path: `${OUT}/size-constraints-closed.png` });
await page.locator(`${P} .section[data-section-id="transform"] .actions-size button`).click(); await page.waitForTimeout(400);
console.log("constraints open:", await cons());
console.log("button:", JSON.stringify(await dump(), null, 1));
await page.locator(`${P} .section[data-section-id="transform"]`).screenshot({ path: `${OUT}/size-legend-button.png` });
// W → fill
await page.locator(`${P} .section[data-section-id="transform"] .width .property-unit-input__suffix--trigger`).click(); await page.waitForTimeout(400);
console.log("W menu:", await page.evaluate(() => Array.from(document.querySelectorAll('.react-aria-Popover [role="option"]')).map((o) => o.textContent.trim())));
await page.locator('.react-aria-Popover [role="option"]').filter({ hasText: /^fill$/ }).click(); await page.waitForTimeout(600);
const st = (keys) => page.evaluate(({ id, keys }) => { const s = window.__composition_STORE__.getState().elements.find((e) => e.id === id).props.style ?? {}; return Object.fromEntries(keys.map((k) => [k, s[k]])); }, { id: btn.id, keys });
console.log("after fill:", await st(["width", "flexGrow", "flexBasis"]), (await dump()).fields.slice(0, 2));
await page.locator(`${P} .section[data-section-id="transform"]`).screenshot({ path: `${OUT}/size-legend-fill.png` });
// blur elsewhere → no re-commit
await page.locator(`${P} .section[data-section-id="transform"] .height input`).click(); await page.waitForTimeout(300); await page.keyboard.press("Escape"); await page.waitForTimeout(400);
console.log("after blur:", await st(["width", "flexGrow", "flexBasis"]));
// type 150 → fixed
const wInput = page.locator(`${P} .section[data-section-id="transform"] .width input`);
await wInput.click(); await wInput.fill("150"); await wInput.press("Enter"); await page.waitForTimeout(600);
console.log("after 150:", await st(["width", "flexGrow", "flexBasis"]), (await dump()).fields[0]);
// stepper on W
await wInput.click(); await page.keyboard.press("ArrowUp"); await page.keyboard.press("Tab"); await page.waitForTimeout(500);
console.log("after ArrowUp+blur:", await st(["width"]), "steppers in panel:", await page.evaluate((P) => document.querySelectorAll(`${P} .property-unit-input__step`).length, P));
// H → fit-content
await page.locator(`${P} .section[data-section-id="transform"] .height .property-unit-input__suffix--trigger`).click(); await page.waitForTimeout(400);
await page.locator('.react-aria-Popover [role="option"]').filter({ hasText: /^fit-content$/ }).click(); await page.waitForTimeout(600);
console.log("after hug H:", await st(["height"]), (await dump()).fields[1]);
// Min W type 40, Max W unit % on empty → preserved empty
const minW = page.locator(`${P} .section[data-section-id="transform"] .min-width input`);
await minW.click(); await minW.fill("40"); await minW.press("Enter"); await page.waitForTimeout(500);
console.log("after minW 40:", await st(["minWidth"]), (await dump()).fields[2]);
await page.locator(`${P} .section[data-section-id="transform"] .max-width .property-unit-input__suffix--trigger`).click(); await page.waitForTimeout(400);
await page.locator('.react-aria-Popover [role="option"]').filter({ hasText: /^%$/ }).click(); await page.waitForTimeout(500);
console.log("after maxW %:", await st(["maxWidth"]), (await dump()).fields[4]);
// 값 있는 상태에서 토글 off → minWidth 40 이 있으니 유지
await page.locator(`${P} .section[data-section-id="transform"] .actions-size button`).click(); await page.waitForTimeout(400);
console.log("toggle off with minW 40 (stays):", await cons());
// minW 비우기 → 접힘
await page.locator(`${P} .section[data-section-id="transform"] .min-width .property-unit-input__suffix--trigger`).click(); await page.waitForTimeout(400);
await page.locator('.react-aria-Popover [role="option"]').filter({ hasText: /^reset$/ }).click(); await page.waitForTimeout(500);
console.log("after clearing minW:", await st(["minWidth"]), await cons());
// Ratio + Overflow
await page.locator(`${P} .section[data-section-id="transform"] .aspect-ratio-select .react-aria-Button`).click(); await page.waitForTimeout(400);
await page.locator('.react-aria-Popover [role="option"]').filter({ hasText: /16.*9/ }).first().click(); await page.waitForTimeout(500);
await page.locator(`${P} .section[data-section-id="transform"] .overflow .react-aria-Button`).click(); await page.waitForTimeout(400);
await page.locator('.react-aria-Popover [role="option"]').filter({ hasText: /^Hidden$/ }).click(); await page.waitForTimeout(500);
console.log("after ratio+overflow:", await st(["aspectRatio", "overflow"]));
console.log("final:", JSON.stringify(await dump(), null, 1));
// frame: gap for comparison
await page.evaluate(async (id) => { const s = window.__composition_STORE__.getState(); const el = s.elements.find((e) => e.id === id); s.setSelectedElement(el.id, el.props); }, frameId); await page.waitForTimeout(600);
console.log("frame gap:", await gap());
await page.locator(`${P} .displayGap .react-aria-Button`).first().click(); await page.waitForTimeout(400);
console.log("gap menu:", await page.evaluate(() => Array.from(document.querySelectorAll('.react-aria-Popover [role="option"]')).map((o) => `${o.textContent.trim()}${o.getAttribute("aria-selected") === "true" ? "*" : ""}`)));
await page.locator('.react-aria-Popover [role="option"]').filter({ hasText: /^L · / }).click(); await page.waitForTimeout(500);
console.log("gap after L:", await page.evaluate((id) => { const s = window.__composition_STORE__.getState().elements.find((e) => e.id === id).props.style; return { gap: s.gap, rowGap: s.rowGap, columnGap: s.columnGap }; }, frameId), await page.evaluate((P) => document.querySelector(`${P} .displayGap input`).value, P));
await page.locator(`${P} .section[data-section-id="layout"]`).screenshot({ path: `${OUT}/gap-presets.png` });
console.log("frame size:", (await dump()).fields.slice(0, 2));
await page.locator(`${P} .panel-contents`).screenshot({ path: `${OUT}/size-legend-frame-tab.png` });
console.log("errors:", errors);
await browser.close();
