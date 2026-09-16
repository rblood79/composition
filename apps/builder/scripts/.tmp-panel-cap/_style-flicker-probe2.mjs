import { chromium } from "playwright";
import { resolve } from "node:path";
const READY = () => Boolean(window.__composition_STORE__ && window.__composition_STORE__.getState().currentPageId && document.querySelector(".app:not(.builder-booting)") && document.querySelector('[data-testid="skia-canvas-unified"]'));
const browser = await chromium.launch({ headless: false });
const page = await (await browser.newContext({ storageState: resolve("apps/builder/scripts/.auth-session.json"), viewport: { width: 1600, height: 1200 } })).newPage();
await page.goto("http://localhost:5173/dashboard", { waitUntil: "networkidle" });
const b = page.locator("button.dashboard-create-button").first(); await b.waitFor({ state: "visible", timeout: 15000 }); await b.click();
const i = page.locator("#new-project-name"); await i.waitFor({ state: "visible" }); await i.fill(`sf-${Date.now()}`); await i.press("Enter");
await page.waitForURL(/\/builder\/[^/?]+$/, { timeout: 60000 }); await page.waitForFunction(READY, undefined, { timeout: 90000 }); await page.waitForTimeout(1200);
const panel = async (name, want) => { const btn = page.getByRole("button", { name, exact: true }).first(); const pressed = await btn.getAttribute("aria-pressed"); if ((pressed === "true") !== want) { await btn.click(); await page.waitForTimeout(400); } };
const P = '[data-panel-id="properties"]';
const OBS = () => { const log = (window.__MUT = []); const desc = (n) => { if (n.nodeType === 3) n = n.parentNode; const e = n; return `${e.tagName?.toLowerCase()}${e.id ? "#" + e.id : ""}${typeof e.className === "string" && e.className ? "." + e.className.split(" ").slice(0,2).join(".") : ""}`; };
  const obs = new MutationObserver((ms) => { for (const m of ms) { const t = m.target; const tag = (t.nodeType === 3 ? t.parentNode : t).tagName; const styleish = tag === "STYLE" || tag === "LINK" || [...m.addedNodes, ...m.removedNodes].some(n => n.tagName === "STYLE" || n.tagName === "LINK"); log.push({ styleish, type: m.type, attr: m.attributeName, target: desc(t), old: m.oldValue?.slice(0,80), now: m.type === "attributes" ? t.getAttribute(m.attributeName)?.slice(0,80) : m.type === "characterData" ? "(text)" : "+" + [...m.addedNodes].map(desc).join(",") + " / -" + [...m.removedNodes].map(desc).join(",") }); } });
  obs.observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeOldValue: true, characterData: true }); };
for (const type of ["Button", "TextField"]) {
  await panel("Components", true); await page.locator("button.list-item").filter({ has: page.locator(".list-item-name", { hasText: new RegExp(`^${type}$`, "i") }) }).first().click(); await page.waitForTimeout(800); await panel("Components", false); await panel("Properties", true); await page.waitForTimeout(400);
  await page.evaluate((P) => { document.querySelectorAll(`${P} .section-caret[aria-expanded="false"]`).forEach((c) => c.click()); }, P); await page.waitForTimeout(500);
  let fr = page.frames().find(f => f !== page.mainFrame() && /preview/.test(f.url()));
  if (!fr) { await page.getByRole("button", { name: /Compare Mode|비교 모드/ }).first().click(); await page.waitForTimeout(2500); fr = page.frames().find(f => f !== page.mainFrame() && /preview/.test(f.url())); }
  await page.evaluate(OBS); await fr.evaluate(OBS);
  const controls = page.locator(`${P} .react-aria-ToggleButton, ${P} [role="switch"], ${P} [role="checkbox"], ${P} .react-aria-Checkbox, ${P} .react-aria-Switch`);
  const n = Math.min(await controls.count(), 14);
  console.log(`=== ${type}: controls ${n}`);
  for (let k = 0; k < n; k++) {
    const c = controls.nth(k); if (!(await c.isVisible().catch(() => false))) continue;
    const label = (await c.getAttribute("aria-label")) || (await c.textContent())?.trim().slice(0, 20);
    await page.evaluate(() => (window.__MUT.length = 0)); await fr.evaluate(() => (window.__MUT.length = 0));
    await c.click({ timeout: 3000 }).catch(() => {}); await page.waitForTimeout(600);
    const mb = await page.evaluate(() => window.__MUT); const mf = await fr.evaluate(() => window.__MUT);
    const sum = (ms) => { const o = {}; for (const m of ms) { const key = `${m.type}:${m.attr ?? ""}:${m.target}`; o[key] = (o[key] ?? 0) + 1; } return Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, v]) => `${k}×${v}`).join(" | "); };
    console.log(`[${k}] ${label}\n   builder styleish=${mb.filter(m => m.styleish).length}/${mb.length}: ${sum(mb.filter(m => !/SelectionIndicator|ToggleButton|canvas-container/.test(m.target)))}\n   iframe  styleish=${mf.filter(m => m.styleish).length}/${mf.length}: ${sum(mf)}`);
    if (mb.some(m => m.styleish) || mf.some(m => m.styleish)) console.log("   STYLEISH:", JSON.stringify([...mb, ...mf].filter(m => m.styleish).slice(0, 6)));
  }
  // text change on a text input
  const inp = page.locator(`${P} input[type="text"], ${P} .react-aria-Input`).first();
  if (await inp.count()) { await page.evaluate(() => (window.__MUT.length = 0)); await fr.evaluate(() => (window.__MUT.length = 0)); await inp.click(); await inp.press("End"); await inp.type("x"); await inp.press("Enter"); await page.waitForTimeout(700); const mf = await fr.evaluate(() => window.__MUT); const mb = await page.evaluate(() => window.__MUT); console.log(`[text] ${await inp.getAttribute("aria-label")} builder styleish=${mb.filter(m=>m.styleish).length}/${mb.length} iframe styleish=${mf.filter(m => m.styleish).length}/${mf.length}: ${mf.slice(0,5).map(m => `${m.type}:${m.attr ?? ""}:${m.target}`).join(" | ")}`); }
}
await browser.close();
