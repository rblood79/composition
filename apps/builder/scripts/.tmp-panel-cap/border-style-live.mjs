// frame fill 색 picker 드래그 (hue 슬라이더) live — 드래그 중 캔버스 픽셀이 따라오는가 · Text 탭 Decoration/Case 토글 해제
import { inflateSync } from "node:zlib";
import { chromium } from "playwright";
import { resolve } from "node:path";
const READY = () => Boolean(window.__composition_STORE__ && window.__composition_STORE__.getState().currentPageId && document.querySelector(".app:not(.builder-booting)") && document.querySelector('[data-testid="skia-canvas-unified"]'));
const browser = await chromium.launch({ headless: false });
const page = await (await browser.newContext({ storageState: resolve("apps/builder/scripts/.auth-session.json"), viewport: { width: 1600, height: 1100 } })).newPage();
const errors = []; page.on("pageerror", (e) => errors.push(e.message));
await page.goto("http://localhost:5173/dashboard", { waitUntil: "networkidle" });
const b = page.locator("button.dashboard-create-button").first(); await b.waitFor({ state: "visible", timeout: 15000 }); await b.click();
const i = page.locator("#new-project-name"); await i.waitFor({ state: "visible" }); await i.fill(`color-${Date.now()}`); await i.press("Enter");
await page.waitForURL(/\/builder\/[^/?]+$/, { timeout: 60000 }); await page.waitForFunction(READY, undefined, { timeout: 90000 }); await page.waitForTimeout(1200);
const addFrame = async () => {
  await page.getByRole("button", { name: "Components", exact: true }).first().click(); await page.waitForTimeout(600);
  await page.locator('[data-component-type="frame"], [data-component-type="Frame"], button:has-text("frame")').first().click(); await page.waitForTimeout(1500);
  await page.getByRole("button", { name: "Components", exact: true }).first().click().catch(() => {}); await page.waitForTimeout(300);
  return page.evaluate(async () => {
    const st = window.__composition_STORE__.getState();
    const frames = st.elements.filter((e) => e.page_id === st.currentPageId && e.type === "frame");
    const el = frames[frames.length - 1]; st.setSelectedElement(el.id, el.props);
    await new Promise((r) => setTimeout(r, 300));
    window.__composition_STORE__.getState().updateSelectedStyles({ width: "200px", height: "120px", backgroundColor: "#2F6FED" });
    return el.id;
  });
};
const elId = await addFrame();
await page.waitForTimeout(600);
await page.getByRole("button", { name: "Styles", exact: true }).first().click(); await page.waitForTimeout(500);
await page.locator(".styles-panel-tab").nth(1).click(); await page.waitForTimeout(400);
const r = await page.evaluate((id) => { const st = window.__composition_STORE__.getState(); const b = window.__composition_LAYOUT_DEBUG__?.getSharedLayoutMap?.()?.get(id); const pp = st.pagePositions?.[st.currentPageId]; return { b: { x: b.x, y: b.y, w: b.width, h: b.height }, pp }; }, elId);
await page.evaluate(({ x, y }) => window.__composition_APPLY_VIEWPORT__?.({ scale: 1, x: -x + 600, y: -y + 400 }), { x: (r.pp?.x ?? 0) + r.b.x, y: (r.pp?.y ?? 0) + r.b.y });
await page.waitForTimeout(600);
const cb = await page.locator('[data-testid="skia-canvas-unified"]').boundingBox();
const pixelAt = { x: Math.round(cb.x + 600 + r.b.w / 2), y: Math.round(cb.y + 400 + r.b.h / 2) };
const px = async () => { const buf = await page.screenshot({ clip: { x: pixelAt.x, y: pixelAt.y, width: 1, height: 1 } }); let off = 8; let idat = Buffer.alloc(0); while (off < buf.length) { const len = buf.readUInt32BE(off); const type = buf.toString("ascii", off + 4, off + 8); if (type === "IDAT") idat = Buffer.concat([idat, buf.subarray(off + 8, off + 8 + len)]); off += 12 + len; } const raw = inflateSync(idat); return [raw[1], raw[2], raw[3]]; };
const store = () => page.evaluate((id) => { const el = window.__composition_STORE__.getState().elements.find((e) => e.id === id); return el?.props?.style?.backgroundColor ?? null; }, elId);
const canonicalFill = () => page.evaluate(() => { const c = window.__composition_CANONICAL_STORE__?.getState?.(); return c ? "has-canonical-debug" : null; });
console.log("initial pixel", JSON.stringify(await px()), "bg", await store());

// Border style 세그먼트 — × 없음 · 재클릭 해제 = none. 테두리 픽셀 (상변 중앙, 2px 안쪽) 로 확인
await page.evaluate(() => window.__composition_STORE__.getState().updateSelectedStyles({ borderWidth: "4px", borderStyle: "solid", borderColor: "#102A5C" }));
await page.waitForTimeout(600);
const S = '[data-panel-id="styles"] .section[data-section-id="border"]';
const edge = { x: Math.round(cb.x + 600 + r.b.w / 2), y: Math.round(cb.y + 400 + 2) };
const epx = async () => { const buf = await page.screenshot({ clip: { x: edge.x, y: edge.y, width: 1, height: 1 } }); let off = 8; let idat = Buffer.alloc(0); while (off < buf.length) { const len = buf.readUInt32BE(off); const type = buf.toString("ascii", off + 4, off + 8); if (type === "IDAT") idat = Buffer.concat([idat, buf.subarray(off + 8, off + 8 + len)]); off += 12 + len; } const raw = inflateSync(idat); return [raw[1], raw[2], raw[3]]; };
const bs = () => page.evaluate((id) => { const s = window.__composition_STORE__.getState().elements.find((e) => e.id === id)?.props?.style ?? {}; return { borderStyle: s.borderStyle ?? null, borderWidth: s.borderWidth ?? null, borderColor: s.borderColor ?? null }; }, elId);
const seg = () => page.evaluate((S) => Array.from(document.querySelectorAll(`${S} .border-style .react-aria-ToggleButton`)).map((b) => `${b.getAttribute("aria-label")}:${b.hasAttribute("data-selected")}|${Math.round(b.getBoundingClientRect().width)}×${Math.round(b.getBoundingClientRect().height)}`), S);
console.log("solid", JSON.stringify(await bs()), await seg(), "edge px", JSON.stringify(await epx()));
await page.locator(`${S} .border-style .react-aria-ToggleButton[aria-label="Dashed"]`).click(); await page.waitForTimeout(600);
console.log("dashed", JSON.stringify(await bs()), await seg());
await page.locator(`${S} .border-style .react-aria-ToggleButton[aria-label="Dashed"]`).click(); await page.waitForTimeout(600);
console.log("dashed again → none", JSON.stringify(await bs()), await seg(), "edge px", JSON.stringify(await epx()));
await page.locator(`${S} .border-style .react-aria-ToggleButton[aria-label="Solid"]`).click(); await page.waitForTimeout(600);
console.log("solid back", JSON.stringify(await bs()), await seg(), "edge px", JSON.stringify(await epx()));
console.log("errors", errors.slice(0, 3));
await browser.close();
