import { chromium } from "playwright";
import { resolve } from "node:path";
const READY = () => Boolean(window.__composition_STORE__ && window.__composition_STORE__.getState().currentPageId && document.querySelector(".app:not(.builder-booting)") && document.querySelector('[data-testid="skia-canvas-unified"]'));
const browser = await chromium.launch({ headless: false });
const page = await (await browser.newContext({ storageState: resolve("apps/builder/scripts/.auth-session.json"), viewport: { width: 1600, height: 1100 } })).newPage();
await page.goto("http://localhost:5173/dashboard", { waitUntil: "networkidle" });
const b = page.locator("button.dashboard-create-button").first(); await b.waitFor({ state: "visible", timeout: 15000 }); await b.click();
const i = page.locator("#new-project-name"); await i.waitFor({ state: "visible" }); await i.fill(`sh-${Date.now()}`); await i.press("Enter");
await page.waitForURL(/\/builder\/[^/?]+$/, { timeout: 60000 }); await page.waitForFunction(READY, undefined, { timeout: 90000 }); await page.waitForTimeout(1200);
const id = await page.evaluate(async () => { const st = window.__composition_STORE__.getState(); const body = st.elements.find(e => e.type === "body" && e.page_id === st.currentPageId) ?? st.elements.find(e => e.type === "body"); const now = new Date().toISOString(); const id = crypto.randomUUID(); await st.addElement({ id, type: "Card", parent_id: body.id, page_id: body.page_id, order_num: 99, created_at: now, updated_at: now, props: { style: { width: "200px", height: "80px" } } }, { skipHistory: true }); await new Promise(r => setTimeout(r, 800)); const st2 = window.__composition_STORE__.getState(); st2.setSelectedElement(id, st2.elements.find(e => e.id === id)?.props); return id; });
await page.waitForTimeout(600);
await page.keyboard.press("Meta+0"); await page.waitForTimeout(600);
await page.getByRole("button", { name: "Styles", exact: true }).first().click(); await page.waitForTimeout(500);
await page.locator(".styles-panel-tab").nth(1).click(); await page.waitForTimeout(400);
const readShadow = () => page.evaluate((id) => { const st = window.__composition_STORE__.getState(); const el = st.elements.find(e => e.id === id); return el?.props?.style?.boxShadow ?? null; }, id);
const layerOptions = async () => { const sel = page.locator('[data-panel-id="styles"] .box-shadow-layer .react-aria-Button'); return (await sel.count()) ? await sel.first().textContent() : null; };
const belowPixel = async (tag) => { const c = await page.locator('[data-testid="skia-canvas-unified"]').boundingBox(); const info = await page.evaluate((id) => { const d = window.__composition_RENDER_COMMAND_DEBUG__; return { cam: d?.readCamera(), bounds: d?.readNode(id)?.bounds }; }, id); const { zoom, panX, panY } = info.cam; const bb = info.bounds; const clip = { x: c.x + panX + bb.x * zoom + 10, y: c.y + panY + (bb.y + bb.height) * zoom + 1, width: Math.max(1, bb.width * zoom - 20), height: 12 }; const buf = await page.screenshot({ clip }); const mean = await page.evaluate(async (b64) => { const img = new Image(); img.src = "data:image/png;base64," + b64; await img.decode(); const cv = document.createElement("canvas"); cv.width = img.width; cv.height = img.height; const g = cv.getContext("2d"); g.drawImage(img, 0, 0); const d = g.getImageData(0, 0, cv.width, cv.height).data; let s = 0; for (let k = 0; k < d.length; k += 4) s += d[k] + d[k + 1] + d[k + 2]; return s / (d.length / 4) / 3; }, buf.toString("base64")); console.log(tag, "below-edge mean rgb", mean.toFixed(1)); };
// 1) preset sm → editor appears
await belowPixel("none");
const presetSel = page.locator('[data-panel-id="styles"] .box-shadow .react-aria-Button').first(); await presetSel.click(); await page.waitForTimeout(300);
await page.getByRole("option", { name: "sm", exact: true }).click(); await page.waitForTimeout(500);
console.log("preset sm →", await readShadow(), "| layer:", await layerOptions());
await belowPixel("sm");
// 2) menu → Add layer
const menu = page.locator('[data-panel-id="styles"] .box-shadow-layer-row button[aria-label="Shadow layer actions"]');
console.log("menu trigger count", await menu.count());
await menu.click(); await page.waitForTimeout(300);
await page.getByRole("menuitem", { name: "Add layer" }).click(); await page.waitForTimeout(500);
console.log("after add →", await readShadow(), "| layer:", await layerOptions());
// 3) edit the new (active) layer offset Y → 12px commit → confirm only layer 2 changed
const offY = page.locator('[data-panel-id="styles"] .box-shadow-offsetY input').first();
await offY.fill("12"); await offY.press("Enter"); await page.waitForTimeout(500);
console.log("after offsetY 12 →", await readShadow());
await belowPixel("2 layers");
// 4) Make inset on active layer
await menu.click(); await page.waitForTimeout(300);
await page.getByRole("menuitem", { name: "Make inset" }).click(); await page.waitForTimeout(500);
console.log("after inset →", await readShadow(), "| layer:", await layerOptions());
// 5) Remove active layer → 1 layer, remove disabled
await menu.click(); await page.waitForTimeout(300);
await page.getByRole("menuitem", { name: "Remove layer" }).click(); await page.waitForTimeout(500);
console.log("after remove →", await readShadow(), "| layer:", await layerOptions());
await menu.click(); await page.waitForTimeout(300);
console.log("remove disabled:", await page.getByRole("menuitem", { name: "Remove layer" }).getAttribute("aria-disabled")); await page.keyboard.press("Escape");
// 6) undo ×1 → back to 2 layers
await page.locator('[data-testid="skia-canvas-unified"]').click({ position: { x: 5, y: 5 } }).catch(() => {});
await page.evaluate((id) => { const st = window.__composition_STORE__.getState(); st.setSelectedElement(id, st.elements.find(e => e.id === id)?.props); }, id);
await page.keyboard.press("Meta+z"); await page.waitForTimeout(500);
console.log("after undo →", await readShadow());
await page.screenshot({ path: "apps/builder/scripts/.tmp-panel-cap/shadow-live.png", clip: { x: 1300, y: 48, width: 300, height: 760 } });
await browser.close();
