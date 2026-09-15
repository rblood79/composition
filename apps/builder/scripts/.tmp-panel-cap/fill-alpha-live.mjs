import { chromium } from "playwright";
import { resolve } from "node:path";
const OUT = "/private/tmp/claude-501/-Users-admin-work-composition/f6bcc488-f176-4644-8364-3625704b801c/scratchpad/audit";
const READY = () => Boolean(window.__composition_STORE__ && window.__composition_STORE__.getState().currentPageId && document.querySelector(".app:not(.builder-booting)") && document.querySelector('[data-testid="skia-canvas-unified"]'));
const browser = await chromium.launch({ headless: false });
const page = await (await browser.newContext({ storageState: resolve("apps/builder/scripts/.auth-session.json"), viewport: { width: 1600, height: 1400 }, deviceScaleFactor: 2 })).newPage();
const errors = []; page.on("pageerror", (e) => errors.push(e.message)); page.on("console", (m) => { if (m.text().startsWith("[dbg")) console.log("  ", m.text()); });
await page.goto("http://localhost:5173/dashboard", { waitUntil: "networkidle" });
const b = page.locator("button.dashboard-create-button").first(); await b.waitFor({ state: "visible", timeout: 15000 }); await b.click();
const i = page.locator("#new-project-name"); await i.waitFor({ state: "visible" }); await i.fill(`fa-${Date.now()}`); await i.press("Enter");
await page.waitForURL(/\/builder\/[^/?]+$/, { timeout: 60000 }); await page.waitForFunction(READY, undefined, { timeout: 90000 }); await page.waitForTimeout(1200);
const panel = async (name) => { await page.getByRole("button", { name, exact: true }).first().click(); await page.waitForTimeout(400); };
await panel("Components"); await page.locator("button.list-item").filter({ has: page.locator(".list-item-name", { hasText: /^frame$/i }) }).first().click(); await page.waitForTimeout(900); await panel("Components").catch(() => {});
const frameId = await page.evaluate(() => { const s = window.__composition_STORE__.getState(); const el = s.elements.filter((e) => e.page_id === s.currentPageId && e.type === "frame").pop(); s.setSelectedElement(el.id, el.props); return el.id; }); await page.waitForTimeout(500);
const fills = () => page.evaluate((id) => { const s = window.__composition_STORE__.getState(); const el = s.elements.find((e) => e.id === id); return (el.fills ?? []).map((f) => ({ color: f.color, opacity: f.opacity })); }, frameId);
await panel("Styles"); const PS = '[data-panel-id="styles"]';
await page.locator(".styles-panel-tab").nth(1).click(); await page.waitForTimeout(400);
await page.locator(`${PS} .section[data-section-id="fill"] .section-actions button[aria-label="Add fill"]`).click(); await page.waitForTimeout(600);
console.log("after add:", await fills());
await page.locator(`${PS} .section[data-section-id="fill"] .fill-layer-row__trigger`).first().click(); await page.waitForTimeout(600);
const hexField = page.locator(".fill-detail-popover .color-input-fields__hex input, .fill-detail-popover input").first();
console.log("picker hex:", await page.evaluate(() => Array.from(document.querySelectorAll(".fill-detail-popover input")).map((i) => `${i.getAttribute("aria-label") ?? i.className}=${i.value}`)));
// 알파 슬라이더 키보드 ← ×5 (alpha 채널)
const alphaThumb = page.locator('.fill-detail-popover .react-aria-ColorSlider[data-channel="alpha"] .react-aria-ColorThumb, .fill-detail-popover .react-aria-ColorSlider').last();
console.log("alpha sliders:", await page.evaluate(() => Array.from(document.querySelectorAll(".fill-detail-popover .react-aria-ColorSlider")).map((s) => `${s.getAttribute("data-channel") ?? s.className} ${s.querySelector("input")?.getAttribute("aria-label")}=${s.querySelector("input")?.value}`)));
const alphaInput = page.locator('.fill-detail-popover .react-aria-ColorSlider input[aria-label*="lpha" i], .fill-detail-popover .react-aria-ColorSlider input').last();
await alphaInput.focus(); for (let k = 0; k < 10; k++) await page.keyboard.press("ArrowLeft"); await page.waitForTimeout(600);
console.log("after alpha ←×10:", await fills(), "row scrub:", await page.evaluate((PS) => document.querySelector(`${PS} .fill-layer-row__opacity-scrub`)?.textContent, PS), "picker inputs:", await page.evaluate(() => Array.from(document.querySelectorAll(".fill-detail-popover input")).map((i) => i.value).join("|")));
await page.locator(".fill-detail-popover").screenshot({ path: `${OUT}/fill-alpha.png` });
// 색 영역 변경 → opacity 유지
const area = page.locator(".fill-detail-popover .react-aria-ColorArea input").first(); await area.focus(); await page.keyboard.press("ArrowLeft"); await page.keyboard.press("ArrowLeft"); await page.waitForTimeout(600);
console.log("after area ←×2:", await fills());
// hex8 직접 입력: 2563EB80 → 색 2563EB · opacity 0.5
const hex = page.locator(".fill-detail-popover input[aria-label=\"HEX\"]").first(); await hex.click(); await page.keyboard.press("Meta+a"); await page.keyboard.type("2563EB80"); await page.keyboard.press("Enter"); await page.waitForTimeout(600);
console.log("after hex 2563EB80:", await fills());
await page.keyboard.press("Escape"); await page.waitForTimeout(300);
// 종전 문서: 색 알파 80 + opacity 0.5 → 팝오버 열면 접힘 (0.25 · FF)
await page.evaluate(() => { const s = window.__composition_STORE__.getState(); const el = s.elements.find((e) => e.id === s.selectedElementId); s.updateSelectedFills(el.fills.map((f) => ({ ...f, color: "#FF000080", opacity: 0.5 }))); }); await page.waitForTimeout(500);
console.log("legacy set:", await fills());
await page.locator(`${PS} .section[data-section-id="fill"] .fill-layer-row__trigger`).first().click(); await page.waitForTimeout(800);
console.log("after open (fold):", await fills());
await page.keyboard.press("Escape");
console.log("errors:", errors);
await browser.close();
