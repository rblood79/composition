import { chromium } from "playwright";
import { resolve } from "node:path";
import { inflateSync } from "node:zlib";
const READY = () => Boolean(window.__composition_STORE__ && window.__composition_STORE__.getState().currentPageId && document.querySelector(".app:not(.builder-booting)") && document.querySelector('[data-testid="skia-canvas-unified"]'));
const browser = await chromium.launch({ headless: false });
const page = await (await browser.newContext({ storageState: resolve("apps/builder/scripts/.auth-session.json"), viewport: { width: 1600, height: 1200 }, deviceScaleFactor: 1 })).newPage();
const errors = []; page.on("pageerror", (e) => errors.push(e.message));
await page.goto("http://localhost:5173/dashboard", { waitUntil: "networkidle" });
const b = page.locator("button.dashboard-create-button").first(); await b.waitFor({ state: "visible", timeout: 15000 }); await b.click();
const i = page.locator("#new-project-name"); await i.waitFor({ state: "visible" }); await i.fill(`mf-${Date.now()}`); await i.press("Enter");
await page.waitForURL(/\/builder\/[^/?]+$/, { timeout: 60000 }); await page.waitForFunction(READY, undefined, { timeout: 90000 }); await page.waitForTimeout(1200);
const panel = async (name) => { await page.getByRole("button", { name, exact: true }).first().click(); await page.waitForTimeout(400); };
await panel("Components"); await page.locator("button.list-item").filter({ has: page.locator(".list-item-name", { hasText: /^frame$/i }) }).first().click(); await page.waitForTimeout(900); await panel("Components").catch(() => {});
const frameId = await page.evaluate(() => { const s = window.__composition_STORE__.getState(); const el = s.elements.filter((e) => e.page_id === s.currentPageId && e.type === "frame").pop(); s.setSelectedElement(el.id, el.props); return el.id; }); await page.waitForTimeout(400);
await page.evaluate(() => window.__composition_STORE__.getState().updateSelectedStyles({ width: "200px", height: "120px" })); await page.waitForTimeout(400);
// 실제 UI 경로: Fill 「+」 두 번 → 첫 레이어 빨강, 둘째 파랑 50%
await panel("Styles"); const PS = '[data-panel-id="styles"]';
await page.locator(".styles-panel-tab").nth(1).click(); await page.waitForTimeout(300);
await page.locator(`${PS} .section[data-section-id="fill"] .section-actions button[aria-label="Add fill"]`).click(); await page.waitForTimeout(400);
await page.locator(`${PS} .section[data-section-id="fill"] .section-actions button[aria-label="Add fill"]`).click(); await page.waitForTimeout(400);
await page.evaluate(() => { const s = window.__composition_STORE__.getState(); const el = s.elements.find((e) => e.id === s.selectedElementId); const [a, b2] = el.fills; s.updateSelectedFills([{ id: a.id, type: "color", enabled: true, blendMode: "normal", color: "#FF0000FF", opacity: 1 }, { id: b2.id, type: "color", enabled: true, blendMode: "normal", color: "#0000FFFF", opacity: 0.5 }]); }); await page.waitForTimeout(600);
console.log("fills:", await page.evaluate((id) => window.__composition_STORE__.getState().elements.find((e) => e.id === id).fills.map((f) => `${f.color}@${f.opacity}${f.enabled ? "" : " off"}`), frameId));
console.log("rows:", await page.evaluate((PS) => Array.from(document.querySelectorAll(`${PS} .fill-layer-row`)).map((r) => r.textContent.trim().replace(/\s+/g, " ")), PS));
// Skia 픽셀
const geo = await page.evaluate((id) => { const st = window.__composition_STORE__.getState(); const lm = window.__composition_LAYOUT_DEBUG__?.getSharedLayoutMap?.()?.get(id); const pp = st.pagePositions?.[st.currentPageId]; return { lm: { x: lm.x, y: lm.y, w: lm.width, h: lm.height }, pp }; }, frameId);
await page.evaluate(({ x, y }) => window.__composition_APPLY_VIEWPORT__?.({ scale: 1, x: -x + 500, y: -y + 400 }), { x: geo.pp.x + geo.lm.x, y: geo.pp.y + geo.lm.y }); await page.waitForTimeout(600);
await page.evaluate(() => window.__composition_STORE__.getState().setSelectedElement(null)); await page.waitForTimeout(400);
const cb = await page.locator('[data-testid="skia-canvas-unified"]').boundingBox();
const px = async (x, y) => { const buf = await page.screenshot({ clip: { x, y, width: 1, height: 1 } }); let off = 8, idat = Buffer.alloc(0); while (off < buf.length) { const len = buf.readUInt32BE(off); const t = buf.toString("ascii", off + 4, off + 8); if (t === "IDAT") idat = Buffer.concat([idat, buf.subarray(off + 8, off + 8 + len)]); off += 12 + len; } const raw = inflateSync(idat); return [raw[1], raw[2], raw[3]]; };
const center = { x: Math.round(cb.x + 500 + geo.lm.w / 2), y: Math.round(cb.y + 400 + geo.lm.h / 2) };
console.log("skia center (expect ~128,0,128):", await px(center.x, center.y));
// 아래 층 끄기 → 파랑 50% 만 (흰 배경 위 → ~128,128,255)
await page.evaluate(() => { const s = window.__composition_STORE__.getState(); const el = s.elements.find((e) => e.page_id === s.currentPageId && e.type === "frame"); s.setSelectedElement(el.id, el.props); }); await page.waitForTimeout(300);
await page.evaluate(() => { const s = window.__composition_STORE__.getState(); const el = s.elements.find((e) => e.id === s.selectedElementId); s.updateSelectedFills([{ ...el.fills[0], enabled: false }, el.fills[1]]); }); await page.waitForTimeout(500);
await page.evaluate(() => window.__composition_STORE__.getState().setSelectedElement(null)); await page.waitForTimeout(400);
console.log("skia center bottom off (expect ~128,128,255 on white):", await px(center.x, center.y));
await page.evaluate(() => { const s = window.__composition_STORE__.getState(); const el = s.elements.find((e) => e.page_id === s.currentPageId && e.type === "frame"); s.setSelectedElement(el.id, el.props); s.updateSelectedFills([{ ...el.fills[0], enabled: true }, el.fills[1]]); }); await page.waitForTimeout(500);
// 위 층 opacity 를 행 scrub 으로 25 → 재빌드 (commit 경로)
const scrub = page.locator(`${PS} .section[data-section-id="fill"] .fill-layer-row .fill-layer-row__opacity-scrub`).last();
await scrub.click(); await page.waitForTimeout(200); await page.keyboard.press("Meta+a"); await page.keyboard.type("25"); await page.keyboard.press("Enter"); await page.waitForTimeout(600);
await page.evaluate(() => window.__composition_STORE__.getState().setSelectedElement(null)); await page.waitForTimeout(400);
console.log("skia after top 25% (expect ~191,0,64):", await px(center.x, center.y), await page.evaluate((id) => window.__composition_STORE__.getState().elements.find((e) => e.id === id).fills.map((f) => f.opacity), frameId));
// catalog 경로: Button 에 두 fill
await panel("Components"); await page.locator("button.list-item").filter({ has: page.locator(".list-item-name", { hasText: /^button$/i }) }).first().click(); await page.waitForTimeout(900); await panel("Components").catch(() => {});
const btnId = await page.evaluate(() => { const s = window.__composition_STORE__.getState(); const el = s.elements.filter((e) => e.page_id === s.currentPageId && e.type === "Button").pop(); s.setSelectedElement(el.id, el.props); s.updateSelectedFills([{ id: "f-a", type: "color", enabled: true, blendMode: "normal", color: "#00FF00FF", opacity: 1 }, { id: "f-b", type: "color", enabled: true, blendMode: "normal", color: "#0000FFFF", opacity: 0.5 }]); return el.id; }); await page.waitForTimeout(600);
const bg = await page.evaluate((id) => { const st = window.__composition_STORE__.getState(); const lm = window.__composition_LAYOUT_DEBUG__?.getSharedLayoutMap?.()?.get(id); const pp = st.pagePositions?.[st.currentPageId]; return { lm: { x: lm.x, y: lm.y, w: lm.width, h: lm.height }, pp }; }, btnId);
await page.evaluate(({ x, y }) => window.__composition_APPLY_VIEWPORT__?.({ scale: 1, x: -x + 500, y: -y + 400 }), { x: bg.pp.x + bg.lm.x, y: bg.pp.y + bg.lm.y }); await page.waitForTimeout(500);
await page.evaluate(() => window.__composition_STORE__.getState().setSelectedElement(null)); await page.waitForTimeout(400);
console.log("button skia near left edge (expect ~0,128,128):", await px(Math.round(cb.x + 500 + 6), Math.round(cb.y + 400 + bg.lm.h / 2)));
// Preview DOM (Compare Mode iframe)
const previewTab = page.locator('[aria-label="Compare Mode (Preview + Skia)"]').first();
if (await previewTab.count()) { await previewTab.click(); await page.waitForTimeout(6000);
  console.log("preview:", await page.evaluate((id) => { const out = []; for (const frame of document.querySelectorAll("iframe")) { const doc = frame.contentDocument; if (!doc) { out.push("no doc"); continue; } const hits = Array.from(doc.querySelectorAll("[style]")).filter((n) => (n.getAttribute("style") || "").includes("gradient")).map((n) => ({ tag: n.tagName, id: n.id, cls: n.className, bg: frame.contentWindow.getComputedStyle(n).backgroundImage.slice(0, 200) })); out.push({ src: frame.src?.slice(0, 60), hits }); } return out; }, frameId), await page.evaluate((id) => { for (const frame of document.querySelectorAll("iframe")) { const doc = frame.contentDocument; if (!doc) continue; const el = doc.querySelector(`[data-element-id="${id}"], #${CSS.escape(id)}`) ?? Array.from(doc.querySelectorAll("*")).find((n) => n.getAttribute("style")?.includes("linear-gradient(rgba(0, 0, 255, 0.5)")); if (!el) continue; const cs = frame.contentWindow.getComputedStyle(el); return { tag: el.tagName, backgroundImage: cs.backgroundImage, backgroundColor: cs.backgroundColor, inline: el.getAttribute("style")?.slice(0, 200) }; } return "not found"; }, frameId));
}
console.log("errors:", errors);
await browser.close();
