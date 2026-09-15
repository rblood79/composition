// A1·A2·A4 수리 live — 슬라이더 트랙 픽셀 · Overrides 메뉴 항목 28 · 액션바 gap 4
import { chromium } from "playwright";
import { resolve } from "node:path";
import { inflateSync } from "node:zlib";
const READY = () => Boolean(window.__composition_STORE__ && window.__composition_STORE__.getState().currentPageId && document.querySelector(".app:not(.builder-booting)") && document.querySelector('[data-testid="skia-canvas-unified"]'));
const browser = await chromium.launch({ headless: false });
const page = await (await browser.newContext({ storageState: resolve("apps/builder/scripts/.auth-session.json"), viewport: { width: 1600, height: 1100 } })).newPage();
await page.goto("http://localhost:5173/dashboard", { waitUntil: "networkidle" });
const b = page.locator("button.dashboard-create-button").first(); await b.waitFor({ state: "visible", timeout: 15000 }); await b.click();
const i = page.locator("#new-project-name"); await i.waitFor({ state: "visible" }); await i.fill(`fix-${Date.now()}`); await i.press("Enter");
await page.waitForURL(/\/builder\/[^/?]+$/, { timeout: 60000 }); await page.waitForFunction(READY, undefined, { timeout: 90000 }); await page.waitForTimeout(1200);
await page.getByRole("button", { name: "Components", exact: true }).first().click(); await page.waitForTimeout(500);
const item = page.locator("button.list-item").filter({ has: page.locator(".list-item-name", { hasText: /^button$/i }) }).first(); await item.scrollIntoViewIfNeeded(); await item.click(); await page.waitForTimeout(1500);
await page.getByRole("button", { name: "Components", exact: true }).first().click().catch(() => {}); await page.waitForTimeout(300);
await page.evaluate(async () => { const st = window.__composition_STORE__.getState(); const els = st.elements.filter((e) => e.page_id === st.currentPageId && e.type === "Button"); const el = els[els.length - 1]; st.setSelectedElement(el.id, el.props); });
await page.waitForTimeout(500);
await page.getByRole("button", { name: "Styles", exact: true }).first().click(); await page.waitForTimeout(500);
await page.locator(".styles-panel-tab").nth(1).click(); await page.waitForTimeout(500);
const px = async (x, y) => { const buf = await page.screenshot({ clip: { x, y, width: 1, height: 1 } }); let off = 8, idat = Buffer.alloc(0); while (off < buf.length) { const len = buf.readUInt32BE(off); const t = buf.toString("ascii", off + 4, off + 8); if (t === "IDAT") idat = Buffer.concat([idat, buf.subarray(off + 8, off + 8 + len)]); off += 12 + len; } const raw = inflateSync(idat); return [raw[1], raw[2], raw[3]]; };
const track = page.locator('[data-panel-id="styles"] .border-width .slider-track').first(); const tb = await track.boundingBox();
const cs = await track.evaluate((el) => getComputedStyle(el).backgroundColor);
const onTrack = await px(Math.round(tb.x + tb.width * 0.7), Math.round(tb.y + 1)); const offTrack = await px(Math.round(tb.x + tb.width * 0.7), Math.round(tb.y + 8));
console.log("A1 track bg", cs, "pixel on", onTrack, "off", offTrack, "differs", onTrack.join() !== offTrack.join());
// A4
console.log("A4", await page.evaluate(() => { const t = document.querySelector(".contextual-action-bar-toolbar"); const items = Array.from(t.querySelectorAll(".contextual-action-bar-item")).map((b) => Math.round(b.getBoundingClientRect().left)); return { gap: getComputedStyle(t).gap, lefts: items, d01: items[1] - items[0] }; }));
// A2
await page.locator(".styles-panel-tab").nth(3).click(); await page.waitForTimeout(400);
await page.locator('header button[aria-label="Tablet"]').first().click(); await page.waitForTimeout(600);
await page.locator('[data-panel-id="styles"] .responsive-overrides .swatch-icon-button').first().click(); await page.waitForTimeout(500);
console.log("A2", await page.evaluate(() => { const m = document.querySelector(".react-aria-Menu.property-row-menu"); const items = Array.from(m.querySelectorAll(".react-aria-MenuItem")).map((e) => Math.round(e.getBoundingClientRect().height)); return { count: items.length, heights: [...new Set(items)], menuH: Math.round(m.getBoundingClientRect().height), scroll: m.scrollHeight > m.clientHeight }; }));
await page.keyboard.press("Escape");
await browser.close();
