import { chromium } from "playwright";
import { resolve } from "node:path";
const READY = () => Boolean(window.__composition_STORE__ && window.__composition_STORE__.getState().currentPageId && document.querySelector(".app:not(.builder-booting)") && document.querySelector('[data-testid="skia-canvas-unified"]'));
const browser = await chromium.launch({ headless: false });
const page = await (await browser.newContext({ storageState: resolve("apps/builder/scripts/.auth-session.json"), viewport: { width: 1600, height: 1400 } })).newPage();
const errors = []; page.on("pageerror", (e) => errors.push(String(e))); page.on("console", (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 200)); });
await page.goto("http://localhost:5173/dashboard", { waitUntil: "networkidle" });
const b = page.locator("button.dashboard-create-button").first(); await b.waitFor({ state: "visible" }); await b.click();
const i = page.locator("#new-project-name"); await i.waitFor({ state: "visible" }); await i.fill(`wig-${Date.now()}`); await i.press("Enter");
await page.waitForURL(/\/builder\/[^/?]+$/, { timeout: 60000 }); await page.waitForFunction(READY, undefined, { timeout: 90000 }); await page.waitForTimeout(1200);
const panel = async (name, want) => { const btn = page.getByRole("button", { name, exact: true }).first(); const pressed = await btn.getAttribute("aria-pressed"); if ((pressed === "true") !== want) { await btn.click(); await page.waitForTimeout(400); } };
await panel("Components", true); await page.locator("button.list-item").filter({ has: page.locator(".list-item-name", { hasText: /^Button$/i }) }).first().click(); await page.waitForTimeout(800); await panel("Components", false); await panel("Styles", true); await page.waitForTimeout(400);
const S = '[data-panel-id="styles"]';
await page.evaluate((S) => { document.querySelectorAll(`${S} .section-caret[aria-expanded="false"]`).forEach((c) => c.click()); }, S); await page.waitForTimeout(300);
console.log("url:", page.url(), "errors:", errors, "body:", (await page.evaluate(() => document.body.innerText.slice(0, 300))).replace(/\n/g, " | "));
console.log("rail:", await page.evaluate(() => Array.from(document.querySelectorAll('button[aria-pressed]')).map((b) => `${b.getAttribute("aria-label") ?? b.textContent?.trim()}=${b.getAttribute("aria-pressed")}`)));
console.log("frames:", await page.evaluate(() => Array.from(document.querySelectorAll('.workspace-panel-frame, [data-panel-id]')).map((e) => `${e.className} ${e.getAttribute("data-panel")} ${e.getAttribute("data-panel-id")}`)));
console.log("styles sections:", JSON.stringify(await page.evaluate((S) => Array.from(document.querySelectorAll(`${S} .section`)).map((e) => `${e.getAttribute("data-section-id")} actions=${e.querySelectorAll(".section-actions button, .section-header button").length} rows=${e.querySelectorAll(".fill-layer-row").length}`), S)));
console.log("panel ids:", await page.evaluate(() => Array.from(document.querySelectorAll("[data-panel-id],[data-panel]")).map((e) => e.getAttribute("data-panel-id") ?? e.getAttribute("data-panel"))));
console.log("tabs:", JSON.stringify(await page.evaluate((S) => Array.from(document.querySelectorAll(`${S} [role="tab"]`)).map((t) => t.textContent?.trim()), S)));
await page.locator(`${S} [role="tab"]`).nth(1).click(); await page.waitForTimeout(500);
await page.evaluate((S) => { document.querySelectorAll(`${S} .section-caret[aria-expanded="false"]`).forEach((c) => c.click()); }, S); await page.waitForTimeout(300);
console.log("style tab sections:", JSON.stringify(await page.evaluate((S) => Array.from(document.querySelectorAll(`${S} .section`)).map((e) => `${e.getAttribute("data-section-id")} actions=${e.querySelectorAll(".section-actions button").length} rows=${e.querySelectorAll(".fill-layer-row").length}`), S)));
const fill = page.locator(`${S} .section[data-section-id="fill"]`);
if ((await fill.locator(".fill-layer-row").count()) === 0) { await fill.locator(".section-actions button").first().click(); await page.waitForTimeout(400); }
await fill.locator(".fill-layer-row__trigger").first().click(); await page.waitForTimeout(500);
console.log("popover:", JSON.stringify(await page.evaluate(() => ({ popover: Boolean(document.querySelector(".fill-detail-popover")), toggles: Array.from(document.querySelectorAll(".fill-type-selector button")).map((b) => `${b.getAttribute("aria-label")} pressed=${b.getAttribute("aria-pressed")}`) }))));
await page.locator('.fill-type-selector button[aria-label="Gradient"]').first().focus(); await page.keyboard.press("Space"); await page.waitForTimeout(800);
console.log("after Space:", JSON.stringify(await page.evaluate(() => ({ popover: Boolean(document.querySelector(".fill-detail-popover")), bar: Boolean(document.querySelector(".gradient-bar")) }))));
if (!(await page.evaluate(() => Boolean(document.querySelector(".gradient-bar"))))) { await fill.locator(".fill-layer-row__trigger").first().click(); await page.waitForTimeout(600); console.log("reopen:", JSON.stringify(await page.evaluate(() => ({ popover: Boolean(document.querySelector(".fill-detail-popover")), bar: Boolean(document.querySelector(".gradient-bar")), sel: Array.from(document.querySelectorAll(".fill-type-selector button")).map((b) => `${b.getAttribute("aria-label")} sel=${b.getAttribute("data-selected")}`) })))); }
const info = () => page.evaluate(() => { const hs = Array.from(document.querySelectorAll(".gradient-bar__handle")); return { handles: hs.map((h) => ({ role: h.getAttribute("role"), tab: h.getAttribute("tabindex"), label: h.getAttribute("aria-label"), now: h.getAttribute("aria-valuenow"), active: h.hasAttribute("data-active") })), focused: document.activeElement?.getAttribute("aria-label"), outline: document.activeElement?.classList.contains("gradient-bar__handle") ? getComputedStyle(document.activeElement).outlineWidth : null, swatches: Array.from(document.querySelectorAll(".gradient-stop-list__swatch")).map((s) => `${s.tagName} ${s.getAttribute("aria-label")} pressed=${s.getAttribute("aria-pressed")}`), stops: window.__composition_STORE__.getState() ? undefined : undefined }; });
console.log("after gradient click:", JSON.stringify(await page.evaluate(() => ({ toggles: Array.from(document.querySelectorAll(".fill-type-selector button")).map((b) => `${b.getAttribute("aria-label")} sel=${b.getAttribute("data-selected")}`), popoverText: document.querySelector(".fill-detail-popover")?.innerText.slice(0, 200).replace(/\n/g, " | "), gradientEditor: Boolean(document.querySelector(".gradient-editor")), bar: Boolean(document.querySelector(".gradient-bar")) }))));
console.log("open:", JSON.stringify(await info()));
await page.locator(".gradient-bar__handle").nth(1).focus(); await page.waitForTimeout(200);
console.log("focus 2nd:", JSON.stringify(await info()));
await page.keyboard.press("ArrowLeft"); await page.waitForTimeout(200);
await page.keyboard.press("Shift+ArrowLeft"); await page.waitForTimeout(300);
console.log("← Shift+←:", JSON.stringify(await info()));
await page.keyboard.press("Home"); await page.waitForTimeout(300);
console.log("Home:", JSON.stringify(await info()));
// stop list swatch keyboard select
await page.locator(".gradient-stop-list__swatch").nth(0).focus(); await page.keyboard.press("Space"); await page.waitForTimeout(300);
console.log("swatch1 Space:", JSON.stringify(await info()));
// add stop via list, then Delete on handle
await page.locator(".gradient-stop-list__add-btn").click(); await page.waitForTimeout(300);
await page.locator(".gradient-bar__handle").nth(2).focus(); await page.keyboard.press("Delete"); await page.waitForTimeout(300);
console.log("add + Delete:", JSON.stringify(await info()));
// persisted value in store
console.log("store bg:", await page.evaluate(() => { const st = window.__composition_STORE__.getState(); const id = st.selectedElementIds?.[0] ?? st.selectedElementId; const el = st.elements?.find?.((e) => e.id === id) ?? st.elementsMap?.get?.(id); return JSON.stringify(el?.props?.style?.background ?? el?.props?.style?.backgroundImage ?? el?.props?.fills ?? null).slice(0, 200); }));
console.log("errors:", errors);
await browser.close();
