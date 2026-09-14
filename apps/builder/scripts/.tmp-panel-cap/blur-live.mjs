// Effect blur scrub live — 드래그 중 캔버스 preview (store filter) 가 따라오는가
import { chromium } from "playwright";
import { resolve } from "node:path";
const READY = () => Boolean(window.__composition_STORE__ && window.__composition_STORE__.getState().currentPageId && document.querySelector(".app:not(.builder-booting)") && document.querySelector('[data-testid="skia-canvas-unified"]'));
const browser = await chromium.launch({ headless: false });
const page = await (await browser.newContext({ storageState: resolve("apps/builder/scripts/.auth-session.json"), viewport: { width: 1600, height: 1100 } })).newPage();
const errors = []; page.on("pageerror", (e) => errors.push(e.message));
await page.goto("http://localhost:5173/dashboard", { waitUntil: "networkidle" });
const b = page.locator("button.dashboard-create-button").first(); await b.waitFor({ state: "visible", timeout: 15000 }); await b.click();
const i = page.locator("#new-project-name"); await i.waitFor({ state: "visible" }); await i.fill(`blur-${Date.now()}`); await i.press("Enter");
await page.waitForURL(/\/builder\/[^/?]+$/, { timeout: 60000 }); await page.waitForFunction(READY, undefined, { timeout: 90000 }); await page.waitForTimeout(1200);
await page.getByRole("button", { name: "Components", exact: true }).first().click(); await page.waitForTimeout(600);
await page.locator('[data-component-type="frame"], [data-component-type="Frame"], button:has-text("frame")').first().click(); await page.waitForTimeout(1500);
await page.getByRole("button", { name: "Components", exact: true }).first().click().catch(() => {}); await page.waitForTimeout(300);
const elId = await page.evaluate(async () => {
  const st = window.__composition_STORE__.getState();
  const frames = st.elements.filter((e) => e.page_id === st.currentPageId && e.type === "frame");
  const el = frames[frames.length - 1]; st.setSelectedElement(el.id, el.props);
  await new Promise((r) => setTimeout(r, 300));
  window.__composition_STORE__.getState().updateSelectedStyles({ width: "200px", height: "120px", backgroundColor: "#2F6FED", filter: "blur(4px)" });
  return el.id;
});
await page.waitForTimeout(600);
await page.getByRole("button", { name: "Styles", exact: true }).first().click(); await page.waitForTimeout(500);
await page.locator(".styles-panel-tab").nth(1).click(); await page.waitForTimeout(400);
const S = '[data-panel-id="styles"] .section[data-section-id="effect"]';
const storeFilter = () => page.evaluate((id) => window.__composition_STORE__.getState().elements.find((e) => e.id === id)?.props?.style?.filter ?? null, elId);
const skiaBlur = () => page.evaluate((id) => { const n = window.__composition_SKIA_DEBUG__?.getSkiaNode(id); return JSON.stringify(n?.effects ?? n?.box?.filter ?? null)?.slice(0, 80); }, elId);
const scrub = page.locator(`${S} .scrub-input`).first();
console.log("scrub count", await page.locator(`${S} .scrub-input`).count(), "box", JSON.stringify(await scrub.boundingBox()), "class", await scrub.getAttribute("class"));
await scrub.scrollIntoViewIfNeeded(); await page.waitForTimeout(300);
// 합성 마우스 + pointer lock 은 movementX 가 실제와 다르다 (메모리 synthetic-pointer-drag traps) — dx 경로로 검증
await page.evaluate(() => { Element.prototype.requestPointerLock = undefined; });
const sb = await scrub.boundingBox();
const start = { x: sb.x + 10, y: sb.y + sb.height / 2 };
const sel = () => page.evaluate(() => window.__composition_STORE__.getState().selectedElementId);
await page.evaluate(() => {
  const st = window.__composition_STORE__;
  const orig = st.getState().setSelectedElement;
  window.__selLog = [];
  st.setState({ setSelectedElement: (id, ...rest) => { window.__selLog.push({ id, stack: (new Error().stack || "").split("\n").slice(1, 9).join(" | ") }); return orig(id, ...rest); } });
  document.addEventListener("pointerdown", (e) => { window.__pdLog = (window.__pdLog || []); window.__pdLog.push({ target: e.target?.className?.toString?.().slice(0, 60), path: e.composedPath().slice(0, 12).map((n) => (n.className && typeof n.className === "string" ? "." + n.className.split(" ")[0] : n.nodeName || String(n))).join(">") }); }, true);
});
console.log("sel before", await sel(), "elId", elId);
console.log("elementFromPoint before move", await page.evaluate(({x,y}) => { const el = document.elementFromPoint(x,y); return el ? el.tagName + "." + String(el.className).slice(0,40) : null; }, start), "panel rect", JSON.stringify(await page.locator('[data-panel-id="styles"]').boundingBox()), "vp", await page.evaluate(() => [window.innerWidth, window.innerHeight]));
await page.mouse.move(start.x, start.y); await page.waitForTimeout(100); console.log("sel after hover", await sel());
console.log("elementFromPoint after hover", await page.evaluate(({x,y}) => { const el = document.elementFromPoint(x,y); return el ? el.tagName + "." + String(el.className).slice(0,40) : null; }, start), "scrub box now", JSON.stringify(await scrub.boundingBox()));
await page.screenshot({ path: "/private/tmp/claude-501/-Users-admin-work-composition/f6bcc488-f176-4644-8364-3625704b801c/scratchpad/blur-before-down.png" });
await page.mouse.down(); await page.waitForTimeout(100); console.log("sel after down", await sel(), "rows", await page.locator(`${S} .effect-layer-row`).count());
console.log("selLog", JSON.stringify(await page.evaluate(() => window.__selLog)).slice(0, 1500));
console.log("pdLog", JSON.stringify(await page.evaluate(() => window.__pdLog)).slice(0, 800));
await page.mouse.move(start.x + 2, start.y); await page.waitForTimeout(100); console.log("sel after 2px", await sel(), "rows", await page.locator(`${S} .effect-layer-row`).count());
await page.mouse.move(start.x + 6, start.y); await page.waitForTimeout(100); console.log("sel after 6px", await sel(), "rows", await page.locator(`${S} .effect-layer-row`).count(), "lock", await page.evaluate(() => document.pointerLockElement?.className ?? null));
const samples = [];
for (let k = 1; k <= 10; k++) {
  await page.mouse.move(start.x + k * 10, start.y, { steps: 4 }); await page.waitForTimeout(80);
  samples.push({ k, dom: await page.evaluate((S) => ({ section: Boolean(document.querySelector(S)), scrub: document.querySelector(`${S} .scrub-input`)?.textContent ?? null, rows: document.querySelectorAll(`${S} .effect-layer-row`).length, selected: window.__composition_STORE__.getState().selectedElementId }), S), lock: await page.evaluate(() => document.pointerLockElement?.className ?? null), store: await storeFilter(), skia: await skiaBlur() });
}
await page.mouse.up(); await page.waitForTimeout(400);
console.log("blur scrub samples", JSON.stringify(samples));
console.log("after", JSON.stringify({ store: await storeFilter(), skia: await skiaBlur(), history: await page.evaluate(() => window.__composition_STORE__.getState().history?.length ?? null) }));
console.log("errors", errors.slice(0, 3));
await browser.close();
