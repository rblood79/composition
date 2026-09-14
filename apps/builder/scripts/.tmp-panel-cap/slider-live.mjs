// Effect opacity 슬라이더 드래그 live — presentation 경로에서 thumb 가 포인터를 따르는가
import { chromium } from "playwright";
import { resolve } from "node:path";
const READY = () => Boolean(window.__composition_STORE__ && window.__composition_STORE__.getState().currentPageId && document.querySelector(".app:not(.builder-booting)") && document.querySelector('[data-testid="skia-canvas-unified"]'));
const browser = await chromium.launch({ headless: false });
const page = await (await browser.newContext({ storageState: resolve("apps/builder/scripts/.auth-session.json"), viewport: { width: 1600, height: 1100 } })).newPage();
const errors = []; page.on("pageerror", (e) => errors.push(e.message));
await page.goto("http://localhost:5173/dashboard", { waitUntil: "networkidle" });
const b = page.locator("button.dashboard-create-button").first(); await b.waitFor({ state: "visible", timeout: 15000 }); await b.click();
const i = page.locator("#new-project-name"); await i.waitFor({ state: "visible" }); await i.fill(`slider-${Date.now()}`); await i.press("Enter");
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
const P = '[data-panel-id="styles"]';
const storeOpacity = () => page.evaluate((id) => window.__composition_STORE__.getState().elements.find((e) => e.id === id)?.props?.style?.opacity ?? null, elId);
const drag = async (sectionId, label) => {
  const S = `${P} .section[data-section-id="${sectionId}"]`;
  const slider = page.locator(`${S} input[type="range"]`).first();
  const thumb = page.locator(`${S} .slider-thumb`).first();
  const track = page.locator(`${S} .slider-track`).first();
  const tb = await track.boundingBox(); const hb = await thumb.boundingBox();
  const start = { x: hb.x + hb.width / 2, y: hb.y + hb.height / 2 };
  await page.mouse.move(start.x, start.y); await page.mouse.down();
  const samples = [];
  for (let k = 1; k <= 12; k++) {
    const x = start.x - (start.x - (tb.x + 4)) * (k / 12);
    await page.mouse.move(x, start.y, { steps: 2 }); await page.waitForTimeout(40);
    samples.push({ k, input: await slider.inputValue(), text: await page.locator(`${S} .slider-output--input`).first().inputValue().catch(() => null), thumbX: Math.round((await thumb.boundingBox()).x - tb.x), store: await storeOpacity() });
  }
  await page.mouse.up(); await page.waitForTimeout(400);
  return { samples, after: { input: await slider.inputValue(), store: await storeOpacity() } };
};
const eff = await drag("effect", "Opacity");
console.log("opacity drag samples", JSON.stringify(eff.samples));
console.log("opacity after", JSON.stringify(eff.after));
const mono = eff.samples.every((s, i, a) => i === 0 || Number(s.input) <= Number(a[i - 1].input));
const moved = new Set(eff.samples.map((s) => s.input)).size;
console.log("thumb follows pointer:", mono && moved >= 8 ? "PASS" : "FAIL", "distinct", moved, "monotonic", mono);
console.log("errors", errors.slice(0, 3));
await browser.close();
