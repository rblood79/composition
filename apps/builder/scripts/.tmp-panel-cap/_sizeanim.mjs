import { chromium } from "playwright";
import { resolve } from "node:path";
const OUT = process.env.OUT; const TYPE = process.env.TYPE ?? "Text ?Field";
const READY = () => Boolean(window.__composition_STORE__ && window.__composition_STORE__.getState().currentPageId && document.querySelector(".app:not(.builder-booting)") && document.querySelector('[data-testid="skia-canvas-unified"]'));
const browser = await chromium.launch({ headless: false });
const page = await (await browser.newContext({ storageState: resolve("apps/builder/scripts/.auth-session.json"), viewport: { width: 1600, height: 1400 }, deviceScaleFactor: 2 })).newPage();
await page.goto("http://localhost:5173/dashboard", { waitUntil: "networkidle" });
const b = page.locator("button.dashboard-create-button").first(); await b.waitFor({ state: "visible", timeout: 15000 }); await b.click();
const i = page.locator("#new-project-name"); await i.waitFor({ state: "visible" }); await i.fill(`sz-${Date.now()}`); await i.press("Enter");
await page.waitForURL(/\/builder\/[^/?]+$/, { timeout: 60000 }); await page.waitForFunction(READY, undefined, { timeout: 90000 }); await page.waitForTimeout(1200);
const panel = async (name, want) => { const btn = page.getByRole("button", { name, exact: true }).first(); const pressed = await btn.getAttribute("aria-pressed"); if ((pressed === "true") !== want) { await btn.click(); await page.waitForTimeout(400); } };
await panel("Components", true); await page.locator("button.list-item").filter({ has: page.locator(".list-item-name", { hasText: new RegExp(`^${TYPE}$`, "i") }) }).first().click(); await page.waitForTimeout(800); await panel("Components", false); await panel("Properties", true); await page.waitForTimeout(400);
const P = '[data-panel-id="properties"]';
await page.evaluate((P) => { document.querySelectorAll(`${P} .section-caret[aria-expanded="false"]`).forEach((c) => c.click()); }, P); await page.waitForTimeout(300);
const grp = page.locator(`${P} .react-aria-ToggleButtonGroup[aria-label="Size"]`).first();
const box = await grp.boundingBox(); console.log("size group", JSON.stringify(box), "buttons", await grp.locator(".react-aria-ToggleButton").allTextContents());
// per-frame log of indicator rect + which button selected + button rects
await page.evaluate((P) => { const g = document.querySelector(`${P} .react-aria-ToggleButtonGroup[aria-label="Size"]`); window.__f = []; const rec = () => { const sel = g.querySelector('.react-aria-ToggleButton[data-selected]'); const ind = g.querySelector('.react-aria-SelectionIndicator'); const r = ind?.getBoundingClientRect(); const cs = ind ? getComputedStyle(ind) : null; window.__f.push({ t: Math.round(performance.now()), sel: sel?.textContent, ind: r ? `${Math.round(r.left)}+${Math.round(r.width)}` : null, tr: ind?.style.translate, op: cs?.opacity, w: ind?.style.width, inSel: ind ? ind.parentElement === sel : null, entering: ind?.hasAttribute("data-entering"), exiting: ind?.hasAttribute("data-exiting") }); if (window.__f.length < 45) requestAnimationFrame(rec); }; requestAnimationFrame(rec); }, P);
await grp.locator(".react-aria-ToggleButton").nth(4).click();
for (let k = 0; k < 8; k++) { await page.screenshot({ path: `${OUT}/f${k}.png`, clip: { x: box.x - 4, y: box.y - 24, width: box.width + 8, height: box.height + 30 } }); }
await page.waitForTimeout(400);
const f = await page.evaluate(() => window.__f); const t0 = f[0].t;
console.log(f.map((v) => `${v.t - t0}ms sel=${v.sel} ind=${v.ind} tr=${v.tr} w=${v.w} op=${v.op} inSel=${v.inSel} ent=${v.entering} ex=${v.exiting}`).slice(0, 30).join("\n"));
await browser.close();
