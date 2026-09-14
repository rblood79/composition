import { inflateSync } from "node:zlib";
// Fill opacity scrub live — 행 scrub · 팝오버 scrub 드래그 중 표시/Skia/store 동행
import { chromium } from "playwright";
import { resolve } from "node:path";
const READY = () => Boolean(window.__composition_STORE__ && window.__composition_STORE__.getState().currentPageId && document.querySelector(".app:not(.builder-booting)") && document.querySelector('[data-testid="skia-canvas-unified"]'));
const browser = await chromium.launch({ headless: false });
const page = await (await browser.newContext({ storageState: resolve("apps/builder/scripts/.auth-session.json"), viewport: { width: 1600, height: 1100 } })).newPage();
const errors = []; page.on("pageerror", (e) => errors.push(e.message)); const logs = []; page.on("console", (m) => { if (m.text().includes("TMP-fillop")) logs.push(m.text() + " :: " + JSON.stringify(m.args().length)); });
await page.goto("http://localhost:5173/dashboard", { waitUntil: "networkidle" });
const b = page.locator("button.dashboard-create-button").first(); await b.waitFor({ state: "visible", timeout: 15000 }); await b.click();
const i = page.locator("#new-project-name"); await i.waitFor({ state: "visible" }); await i.fill(`fillop-${Date.now()}`); await i.press("Enter");
await page.waitForURL(/\/builder\/[^/?]+$/, { timeout: 60000 }); await page.waitForFunction(READY, undefined, { timeout: 90000 }); await page.waitForTimeout(1200);
await page.getByRole("button", { name: "Components", exact: true }).first().click(); await page.waitForTimeout(600);
await page.locator('[data-component-type="frame"], [data-component-type="Frame"], button:has-text("frame")').first().click(); await page.waitForTimeout(1500);
await page.getByRole("button", { name: "Components", exact: true }).first().click().catch(() => {}); await page.waitForTimeout(300);
const elId = await page.evaluate(async () => {
  const st = window.__composition_STORE__.getState();
  const frames = st.elements.filter((e) => e.page_id === st.currentPageId && e.type === "frame");
  const el = frames[frames.length - 1]; st.setSelectedElement(el.id, el.props);
  await new Promise((r) => setTimeout(r, 300));
  window.__composition_STORE__.getState().updateSelectedStyles({ width: "200px", height: "120px", backgroundColor: "#2F6FED" });
  return el.id;
});
await page.waitForTimeout(600);
await page.getByRole("button", { name: "Styles", exact: true }).first().click(); await page.waitForTimeout(500);
await page.locator(".styles-panel-tab").nth(1).click(); await page.waitForTimeout(400);
await page.evaluate(() => { Element.prototype.requestPointerLock = undefined; });
const S = '[data-panel-id="styles"] .section[data-section-id="fill"]';
const state = () => page.evaluate((id) => {
  const el = window.__composition_STORE__.getState().elements.find((e) => e.id === id);
  const n = window.__composition_SKIA_DEBUG__?.getSkiaNode(id); const box = n?.box ?? {};
  const fills = el?.props?.fills ?? el?.props?.style?.fills ?? null;
  return { fillsOpacity: Array.isArray(fills) ? fills.map((f) => f.opacity) : fills, bg: el?.props?.style?.backgroundColor ?? null, skiaFill: box.fillColor ? Array.from(box.fillColor).map((v) => Math.round(v * 100) / 100) : (box.fills ? JSON.stringify(box.fills).slice(0, 120) : Object.keys(box).filter((k) => /fill|color|paint/i.test(k)).join(",")) };
}, elId);
// 요소를 캔버스 (600,400) 에 두고 중심 픽셀을 1×1 스크린샷으로 읽는다 (getSkiaNode 는 presentation 을 안 비춘다)
const px = async () => {
  const buf = await page.screenshot({ clip: { x: pixelAt.x, y: pixelAt.y, width: 1, height: 1 } });
  let off = 8; let idat = Buffer.alloc(0);
  while (off < buf.length) { const len = buf.readUInt32BE(off); const type = buf.toString("ascii", off + 4, off + 8); if (type === "IDAT") idat = Buffer.concat([idat, buf.subarray(off + 8, off + 8 + len)]); off += 12 + len; }
  const raw = inflateSync(idat); return [raw[1], raw[2], raw[3]];
};
const r = await page.evaluate((id) => { const st = window.__composition_STORE__.getState(); const b = window.__composition_LAYOUT_DEBUG__?.getSharedLayoutMap?.()?.get(id); const pp = st.pagePositions?.[st.currentPageId]; return { b: b ? { x: b.x, y: b.y, w: b.width, h: b.height } : null, pp }; }, elId);
await page.evaluate(({ x, y }) => window.__composition_APPLY_VIEWPORT__?.({ scale: 1, x: -x + 600, y: -y + 400 }), { x: (r.pp?.x ?? 0) + r.b.x, y: (r.pp?.y ?? 0) + r.b.y });
await page.waitForTimeout(600);
const cb = await page.locator('[data-testid="skia-canvas-unified"]').boundingBox();
const pixelAt = { x: Math.round(cb.x + 600 + r.b.w / 2), y: Math.round(cb.y + 400 + r.b.h / 2) };
console.log("initial", JSON.stringify(await state()), "pixel", JSON.stringify(await px()), "at", JSON.stringify(pixelAt));
const rowScrub = page.locator(`${S} .fill-layer-row .scrub-input`).first();
await rowScrub.scrollIntoViewIfNeeded(); await page.waitForTimeout(200);
const drag = async (scrub, dir, label) => {
  const sb = await scrub.boundingBox(); const start = { x: sb.x + 8, y: sb.y + sb.height / 2 };
  await page.mouse.move(start.x, start.y); await page.mouse.down();
  const samples = [];
  for (let k = 1; k <= 6; k++) {
    await page.mouse.move(start.x + dir * k * 8, start.y, { steps: 3 }); await page.waitForTimeout(60);
    samples.push({ k, display: await scrub.locator(".scrub-input__display").textContent().catch(() => "gone"), pixel: await px(), diag: await page.evaluate(() => { const d = window.__composition_EDITOR_PRESENTATION_DEBUG__?.diagnostics?.(); return d ? JSON.stringify(d).slice(0, 220) : null; }), ...(await state()) });
  }
  await page.mouse.up(); await page.waitForTimeout(500);
  console.log(label, JSON.stringify(samples.map((s) => [s.k, s.display, s.pixel, s.skiaFill[3]])));
console.log(label, "diag last", samples.at(-1).diag);
  console.log(label, "after", JSON.stringify(await state()), "pixel", JSON.stringify(await px()), "editing?", await page.locator(`${S} .scrub-input__field--editing`).count());
};
await drag(rowScrub, -1, "row scrub");
// 팝오버 scrub
await page.locator(`${S} .fill-layer-row__trigger`).first().click(); await page.waitForTimeout(600);
const popScrub = page.locator(".fill-detail-popover__opacity .scrub-input").first();
console.log("popover scrub visible", await popScrub.count());
await drag(popScrub, +1, "popover scrub");
await page.keyboard.press("Escape"); await page.waitForTimeout(300);
console.log("errors", errors.slice(0, 3)); console.log("tmp logs", logs.length, JSON.stringify(logs.slice(0, 3)));
await browser.close();
