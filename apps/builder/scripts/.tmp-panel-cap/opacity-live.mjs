import { chromium } from "playwright";
import { resolve } from "node:path";
const READY = () => Boolean(window.__composition_STORE__ && window.__composition_STORE__.getState().currentPageId && document.querySelector(".app:not(.builder-booting)") && document.querySelector('[data-testid="skia-canvas-unified"]'));
const browser = await chromium.launch({ headless: false });
const page = await (await browser.newContext({ storageState: resolve("apps/builder/scripts/.auth-session.json"), viewport: { width: 1600, height: 1100 } })).newPage();
await page.goto("http://localhost:5173/dashboard", { waitUntil: "networkidle" });
const b = page.locator("button.dashboard-create-button").first(); await b.waitFor({ state: "visible", timeout: 15000 }); await b.click();
const i = page.locator("#new-project-name"); await i.waitFor({ state: "visible" }); await i.fill(`op-${Date.now()}`); await i.press("Enter");
await page.waitForURL(/\/builder\/[^/?]+$/, { timeout: 60000 }); await page.waitForFunction(READY, undefined, { timeout: 90000 }); await page.waitForTimeout(1200);
const id = await page.evaluate(async () => { const st = window.__composition_STORE__.getState(); const body = st.elements.find(e => e.type === "body" && e.page_id === st.currentPageId) ?? st.elements.find(e => e.type === "body"); const now = new Date().toISOString(); const id = crypto.randomUUID(); await st.addElement({ id, type: "Button", parent_id: body.id, page_id: body.page_id, order_num: 99, created_at: now, updated_at: now, props: { children: "Primary action" } }, { skipHistory: true }); await new Promise(r => setTimeout(r, 800)); const st2 = window.__composition_STORE__.getState(); st2.setSelectedElement(id, st2.elements.find(e => e.id === id)?.props); return id; });
await page.waitForTimeout(600);
// 새 프로젝트 템플릿이 길어 버튼이 화면 밖 — 선택에 맞춰 줌 (Shift+2, canvas-focused)
await page.keyboard.press("Meta+0"); await page.waitForTimeout(800); console.log("cam after fit", JSON.stringify(await page.evaluate(() => window.__composition_RENDER_COMMAND_DEBUG__?.readCamera())));
await page.getByRole("button", { name: "Styles", exact: true }).first().click(); await page.waitForTimeout(500);
await page.locator(".styles-panel-tab").nth(1).click(); await page.waitForTimeout(400);
const readStyle = () => page.evaluate((id) => { const st = window.__composition_STORE__.getState(); const el = st.elements.find(e => e.id === id); return { opacity: el?.props?.style?.opacity, keys: Object.keys(el?.props?.style ?? {}), history: st.history?.length ?? st.historyIndex }; }, id);
const slider = page.locator('[data-panel-id="styles"] .style-opacity .react-aria-Slider');
console.log("slider count", await slider.count(), "output", await page.locator('[data-panel-id="styles"] .style-opacity .slider-output').textContent());
const rect = await page.locator('[data-panel-id="styles"] .style-opacity .slider-container').boundingBox();
console.log("row height", rect?.height);
const thumb = page.locator('[data-panel-id="styles"] .style-opacity .slider-thumb');
const thumbInput = page.locator('[data-panel-id="styles"] .style-opacity .slider-thumb input');
const readRect = async () => { const c = await page.locator('[data-testid="skia-canvas-unified"]').boundingBox(); const info = await page.evaluate((id) => { const d = window.__composition_RENDER_COMMAND_DEBUG__; const cam = d?.readCamera(); const n = d?.readNode(id); return { cam, bounds: n?.bounds }; }, id); if (!info.cam || !info.bounds) return null; const { zoom, panX, panY } = info.cam; const b = info.bounds; return { c, x: c.x + panX + b.x * zoom, y: c.y + panY + b.y * zoom, width: b.width * zoom, height: b.height * zoom }; };
const bringIntoView = async () => { let r = await readRect(); if (!r) return; const targetY = r.c.y + 300; const dy = r.y - targetY; if (Math.abs(dy) > 40) { await page.mouse.move(r.c.x + 400, r.c.y + 400); await page.mouse.wheel(0, dy); await page.waitForTimeout(500); } r = await readRect(); console.log("button rect after pan", JSON.stringify({ x: r.x, y: r.y, w: r.width, h: r.height })); };
console.log("rect", JSON.stringify(await readRect()));
const skiaPixel = async (tag) => { const c = await page.locator('[data-testid="skia-canvas-unified"]').boundingBox(); const info = await page.evaluate((id) => { const d = window.__composition_RENDER_COMMAND_DEBUG__; const cam = d?.readCamera(); const n = d?.readNode(id); return { cam, bounds: n?.bounds }; }, id); if (!info.cam || !info.bounds) { console.log(tag, "no camera/bounds", JSON.stringify(info)); return; } const { zoom, panX, panY } = info.cam; const b = info.bounds; const rect = { x: c.x + panX + b.x * zoom, y: c.y + panY + b.y * zoom, width: b.width * zoom, height: b.height * zoom }; const clip = { x: rect.x + 3, y: rect.y + 3, width: Math.max(1, rect.width - 6), height: Math.max(1, rect.height - 6) }; const buf = await page.screenshot({ clip }); const mean = await page.evaluate(async (b64) => { const img = new Image(); img.src = "data:image/png;base64," + b64; await img.decode(); const cv = document.createElement("canvas"); cv.width = img.width; cv.height = img.height; const g = cv.getContext("2d"); g.drawImage(img, 0, 0); const d = g.getImageData(0, 0, cv.width, cv.height).data; let s = 0; for (let i = 0; i < d.length; i += 4) s += d[i] + d[i + 1] + d[i + 2]; return s / (d.length / 4) / 3; }, buf.toString("base64")); console.log(tag, "button rect", JSON.stringify(rect), "mean rgb", mean.toFixed(1)); };
await skiaPixel("opacity 100%");
await thumbInput.focus();
for (let k = 0; k < 5; k++) { await page.keyboard.press("PageDown"); await page.waitForTimeout(60); }
await page.waitForTimeout(400);
console.log("after PageDown x5", JSON.stringify(await readStyle()), "output", await page.locator('[data-panel-id="styles"] .style-opacity .slider-output').textContent());
// drag thumb to the far left with pointer (preview → commit)
const tb = await thumb.boundingBox(); const tr = await page.locator('[data-panel-id="styles"] .style-opacity .slider-track').boundingBox();
await page.mouse.move(tb.x + tb.width / 2, tb.y + tb.height / 2); await page.mouse.down();
for (let s = 1; s <= 8; s++) { await page.mouse.move(tb.x + tb.width / 2 - ((tb.x - tr.x) * s) / 8, tb.y + tb.height / 2); await page.waitForTimeout(40); const mid = await readStyle(); if (s === 4) { console.log("mid-drag preview", JSON.stringify(mid)); await skiaPixel("mid-drag"); } }
await page.mouse.up(); await page.waitForTimeout(400);
console.log("after drag to 0", JSON.stringify(await readStyle()));
// back to 100 via keyboard → key removed
await skiaPixel("opacity ~10%");
await thumbInput.focus(); await page.keyboard.press("End"); await page.waitForTimeout(400);
console.log("after End (100%)", JSON.stringify(await readStyle()));
// undo → previous commit (0)
await page.keyboard.press("Meta+z"); await page.waitForTimeout(400);
console.log("after undo", JSON.stringify(await readStyle()));
// Skia reads it: layout/effects — check the OpacityEffect is in node effects via debug hook if any
await page.screenshot({ path: "apps/builder/scripts/.tmp-panel-cap/opacity-live.png", clip: { x: 1600 - 300, y: 48, width: 300, height: 700 } });
await browser.close();
