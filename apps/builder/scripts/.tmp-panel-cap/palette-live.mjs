import { chromium } from "playwright";
import { resolve } from "node:path";
import { inflateSync } from "node:zlib";
const OUT = "/private/tmp/claude-501/-Users-admin-work-composition/f6bcc488-f176-4644-8364-3625704b801c/scratchpad/audit";
const READY = () => Boolean(window.__composition_STORE__ && window.__composition_STORE__.getState().currentPageId && document.querySelector(".app:not(.builder-booting)") && document.querySelector('[data-testid="skia-canvas-unified"]'));
const browser = await chromium.launch({ headless: false });
const page = await (await browser.newContext({ storageState: resolve("apps/builder/scripts/.auth-session.json"), viewport: { width: 1600, height: 1200 }, deviceScaleFactor: 2 })).newPage();
const errors = []; page.on("pageerror", (e) => errors.push(e.message));
await page.goto("http://localhost:5173/dashboard", { waitUntil: "networkidle" });
const b = page.locator("button.dashboard-create-button").first(); await b.waitFor({ state: "visible", timeout: 15000 }); await b.click();
const i = page.locator("#new-project-name"); await i.waitFor({ state: "visible" }); await i.fill(`pal-${Date.now()}`); await i.press("Enter");
await page.waitForURL(/\/builder\/[^/?]+$/, { timeout: 60000 }); await page.waitForFunction(READY, undefined, { timeout: 90000 }); await page.waitForTimeout(1200);
const add = async (re) => { await page.getByRole("button", { name: "Components", exact: true }).first().click(); await page.waitForTimeout(500); const item = page.locator("button.list-item").filter({ has: page.locator(".list-item-name", { hasText: re }) }).first(); await item.scrollIntoViewIfNeeded(); await item.click(); await page.waitForTimeout(1500); await page.getByRole("button", { name: "Components", exact: true }).first().click().catch(() => {}); await page.waitForTimeout(300); };
await add(/^button$/i); await add(/^frame$/i);
const frameId = await page.evaluate(async () => { const st = window.__composition_STORE__.getState(); const els = st.elements.filter((e) => e.page_id === st.currentPageId && e.type === "frame"); const el = els[els.length - 1]; st.setSelectedElement(el.id, el.props); await new Promise((r) => setTimeout(r, 300)); window.__composition_STORE__.getState().updateSelectedStyles({ width: "200px", height: "120px", backgroundColor: "#2F6FED", borderWidth: "4px", borderStyle: "solid", borderColor: "#102A5C" }); return el.id; });
await page.evaluate(async () => { const st = window.__composition_STORE__.getState(); const btn = st.elements.find((e) => e.page_id === st.currentPageId && e.type === "Button"); st.setSelectedElement(btn.id, btn.props); await new Promise((r) => setTimeout(r, 300)); window.__composition_STORE__.getState().updateSelectedStyles({ backgroundColor: "#E8443F", color: "#FFFFFF" }); });
await page.evaluate(async (id) => { const st = window.__composition_STORE__.getState(); const el = st.elements.find((e) => e.id === id); st.setSelectedElement(el.id, el.props); }, frameId); await page.waitForTimeout(500);
await page.getByRole("button", { name: "Styles", exact: true }).first().click(); await page.waitForTimeout(500);
await page.locator(".styles-panel-tab").nth(1).click(); await page.waitForTimeout(400);
const P = '[data-panel-id="styles"]';
const dump = () => page.evaluate(() => { const pop = document.querySelector(".react-aria-Popover"); const pr = pop.getBoundingClientRect(); const q = (s) => Array.from(pop.querySelectorAll(s)); return { popover: `${Math.round(pr.width)}×${Math.round(pr.height)}`, headers: q(".color-picker-palette__header").map((h) => `${h.textContent.trim()} ${Math.round(h.getBoundingClientRect().height)}`), labels: q(".color-picker-palette__label").map((l) => `${l.textContent.trim()} ${Math.round(l.getBoundingClientRect().height)}`), grids: q(".color-picker-palette__grid").map((g) => { const sw = g.querySelectorAll(".color-picker-palette__swatch"); const r0 = sw[0].getBoundingClientRect(); const r1 = sw[1]?.getBoundingClientRect(); return `${g.getAttribute("aria-label")}: ${sw.length} × ${Math.round(r0.width)}×${Math.round(r0.height)} pitch ${r1 ? Math.round(r1.left - r0.left) : "-"} width ${Math.round(g.getBoundingClientRect().width)}`; }), docColors: q('[data-palette="document"] .color-picker-palette__swatch').map((s) => s.getAttribute("aria-label")), selected: q(".color-picker-palette__swatch[data-selected]").map((s) => s.getAttribute("aria-label")) }; });
// 기본형 — Border color
await page.locator(`${P} .section[data-section-id="border"] .color-swatch-button`).first().click(); await page.waitForTimeout(700);
console.log("base:", JSON.stringify(await dump(), null, 1));
await page.locator(".react-aria-Popover").screenshot({ path: `${OUT}/palette-base.png` });
// 스와치 클릭 → borderColor 저장 + 캔버스 픽셀
const geo = await page.evaluate((id) => { const st = window.__composition_STORE__.getState(); const lm = window.__composition_LAYOUT_DEBUG__?.getSharedLayoutMap?.()?.get(id); const pp = st.pagePositions?.[st.currentPageId]; return { lm: { x: lm.x, y: lm.y, w: lm.width, h: lm.height }, pp }; }, frameId);
await page.evaluate(({ x, y }) => window.__composition_APPLY_VIEWPORT__?.({ scale: 1, x: -x + 500, y: -y + 400 }), { x: geo.pp.x + geo.lm.x, y: geo.pp.y + geo.lm.y }); await page.waitForTimeout(500);
const cb = await page.locator('[data-testid="skia-canvas-unified"]').boundingBox();
const px = async (x, y) => { const buf = await page.screenshot({ clip: { x, y, width: 1, height: 1 } }); let off = 8, idat = Buffer.alloc(0); while (off < buf.length) { const len = buf.readUInt32BE(off); const t = buf.toString("ascii", off + 4, off + 8); if (t === "IDAT") idat = Buffer.concat([idat, buf.subarray(off + 8, off + 8 + len)]); off += 12 + len; } const raw = inflateSync(idat); return [raw[1], raw[2], raw[3]]; };
const edge = { x: Math.round(cb.x + 500 + geo.lm.w / 2), y: Math.round(cb.y + 400 + 2) };
console.log("edge before", await px(edge.x, edge.y));
await page.locator('.react-aria-Popover [data-palette="document"] .color-picker-palette__swatch[aria-label$="E8443F"]').first().click(); await page.waitForTimeout(700);
console.log("borderColor after doc swatch:", await page.evaluate((id) => window.__composition_STORE__.getState().elements.find((e) => e.id === id)?.props?.style?.borderColor, frameId), "edge", await px(edge.x, edge.y));
await page.locator('.react-aria-Popover [aria-label^="Accent"] .color-picker-palette__swatch').nth(3).click(); await page.waitForTimeout(700);
console.log("borderColor after accent swatch:", await page.evaluate((id) => window.__composition_STORE__.getState().elements.find((e) => e.id === id)?.props?.style?.borderColor, frameId), "edge", await px(edge.x, edge.y), "selected", (await dump()).selected);
// 접기
await page.locator('.react-aria-Popover [data-palette="theme"] .color-picker-palette__header').click(); await page.waitForTimeout(300);
console.log("theme collapsed:", (await dump()).grids.length, "grids");
await page.keyboard.press("Escape"); await page.waitForTimeout(300);
// 확장형 — Fill
await page.locator(`${P} .section[data-section-id="fill"] .fill-layer-row__trigger`).first().click(); await page.waitForTimeout(700);
console.log("fill:", JSON.stringify(await dump(), null, 1));
await page.locator(".react-aria-Popover").screenshot({ path: `${OUT}/palette-fill.png` });
await page.keyboard.press("Escape");
console.log("errors", errors.slice(0, 3));
await browser.close();
