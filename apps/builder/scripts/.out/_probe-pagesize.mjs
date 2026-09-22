import { resolve } from "node:path";
import { chromium } from "playwright";
import { waitReady } from "../perf-baseline.mjs";
const browser = await chromium.launch({ headless: false });
const context = await browser.newContext({ storageState: resolve("apps/builder/scripts/.auth-session.json"), viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
await page.goto("http://localhost:5173/dashboard", { waitUntil: "networkidle" });
await page.locator("button.dashboard-create-button").first().click();
const input = page.locator("#new-project-name");
await input.fill(`probe-${Date.now()}`); await input.press("Enter");
await page.waitForURL(/\/builder\/[^/?]+$/, { timeout: 90_000 });
await waitReady(page); await page.waitForTimeout(2000);
await page.evaluate(() => window.__composition_APPLY_VIEWPORT__({ scale: 0.25, x: 60, y: 80 }));
await page.waitForTimeout(1200);
await page.screenshot({ path: "/private/tmp/pagesize-desktop.png" });
// 페이지 body 선택 → 코너 핸들 드래그로 크기 변경
const bodyId = await page.evaluate(() => { const st = window.__composition_STORE__.getState(); return st.elements.find(e => e.type === "body" && e.page_id === st.currentPageId)?.id; });
await page.evaluate((id) => window.__composition_STORE__.getState().setSelectedElement(id), bodyId);
await page.waitForTimeout(800);
const posBefore = await page.evaluate(() => { const st = window.__composition_STORE__.getState(); return { dir: st.pageLayoutDirection, pos: st.pagePositions, cur: st.currentPageId }; });
console.log("positions before:", JSON.stringify(posBefore));
// body height 를 Styles 패널 입력으로 1600 → 
const rail = page.locator('button[aria-label="스타일"], button[aria-label="Styles"], button[aria-label="Style"]').first();
if (await rail.count()) { await rail.click(); await page.waitForTimeout(800); }
const hInput = page.locator('[data-panel-id="styles"] input').filter({ hasNot: page.locator("x") });
const inputs = page.locator('[data-panel-id] input');
let target = null;
for (let i = 0; i < await inputs.count(); i++) { const v = await inputs.nth(i).inputValue().catch(() => ""); if (v === "1080") { target = inputs.nth(i); break; } }
console.log("height input found", !!target);
if (target) { await target.click({ clickCount: 3 }); await target.fill("1600"); await target.press("Enter"); await page.waitForTimeout(1500); }
await page.evaluate(() => window.__composition_STORE__.getState().setSelectedElement(null));
await page.waitForTimeout(800);
await page.screenshot({ path: "/private/tmp/pagesize-body-1600.png" });
const after = await page.evaluate((id) => { const st = window.__composition_STORE__.getState(); const el = st.elements.find(e => e.id === id); const l = window.__composition_LAYOUT_DEBUG__.getSharedLayoutMap().get(id); return { style: el?.props?.style, l: l && [l.x,l.y,l.width,l.height] }; }, bodyId);
console.log("after", JSON.stringify(after));
const posAfter = await page.evaluate(() => { const st = window.__composition_STORE__.getState(); return { dir: st.pageLayoutDirection, gap: st.pageGap, pos: st.pagePositions, pages: st.pages.map(p=>p.id), hist: window.__composition_HISTORY_DEBUG__.getCurrentPageHistory().totalEntries }; });
console.log("positions after 1600:", JSON.stringify(posAfter));
await page.evaluate(() => window.__composition_STORE__.getState().undo()); await page.waitForTimeout(1500);
const posUndo = await page.evaluate(() => { const st = window.__composition_STORE__.getState(); const body = st.elements.find(e => e.type === "body" && e.page_id === st.currentPageId); return { pos: st.pagePositions, bodyH: body?.props?.style?.height }; });
console.log("positions after undo:", JSON.stringify(posUndo));
await page.evaluate(() => window.__composition_STORE__.getState().redo()); await page.waitForTimeout(1500);
const posRedo = await page.evaluate(() => { const st = window.__composition_STORE__.getState(); return { pos: st.pagePositions }; });
console.log("positions after redo:", JSON.stringify(posRedo));
await page.evaluate(() => window.__composition_APPLY_VIEWPORT__({ scale: 0.2, x: 60, y: 60 })); await page.waitForTimeout(1200);
await page.screenshot({ path: "/private/tmp/pagesize-reflow.png" });
// Components 페이지 (첫 페이지) body 를 1600 으로 → 아래 Home 이 +520 밀려야 한다
const compBody = await page.evaluate(() => { window.__composition_STORE__.getState().setCurrentPageId("page-components"); return "page-components-body"; });
await page.waitForTimeout(1500);
await page.evaluate((id) => { const st = window.__composition_STORE__.getState(); const el = st.elements.find(e => e.id === id); st.updateElementProps(id, { style: { ...(el?.props?.style ?? {}), height: "1600px" } }); }, compBody);
await page.waitForTimeout(1500);
const r1 = await page.evaluate(() => JSON.stringify(window.__composition_STORE__.getState().pagePositions));
console.log("reflow after components 1600:", r1);
await page.evaluate(() => window.__composition_STORE__.getState().undo()); await page.waitForTimeout(1500);
console.log("reflow after undo:", await page.evaluate(() => JSON.stringify(window.__composition_STORE__.getState().pagePositions)));
await page.evaluate(() => window.__composition_STORE__.getState().redo()); await page.waitForTimeout(1500);
console.log("reflow after redo:", await page.evaluate(() => JSON.stringify(window.__composition_STORE__.getState().pagePositions)));
await page.evaluate(() => window.__composition_APPLY_VIEWPORT__({ scale: 0.18, x: 60, y: 60 })); await page.waitForTimeout(1200);
await page.screenshot({ path: "/private/tmp/pagesize-reflow.png" });
// reload 보존
await page.reload({ waitUntil: "networkidle" }); await waitReady(page); await page.waitForTimeout(2000);
console.log("reflow after reload:", await page.evaluate(() => JSON.stringify(window.__composition_STORE__.getState().pagePositions)));
await browser.close();
