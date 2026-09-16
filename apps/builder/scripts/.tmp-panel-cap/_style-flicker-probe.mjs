import { chromium } from "playwright";
import { resolve } from "node:path";
const READY = () => Boolean(window.__composition_STORE__ && window.__composition_STORE__.getState().currentPageId && document.querySelector(".app:not(.builder-booting)") && document.querySelector('[data-testid="skia-canvas-unified"]'));
const browser = await chromium.launch({ headless: false });
const page = await (await browser.newContext({ storageState: resolve("apps/builder/scripts/.auth-session.json"), viewport: { width: 1600, height: 1200 } })).newPage();
const errors = []; page.on("pageerror", (e) => errors.push(e.message));
await page.goto("http://localhost:5173/dashboard", { waitUntil: "networkidle" });
const b = page.locator("button.dashboard-create-button").first(); await b.waitFor({ state: "visible", timeout: 15000 }); await b.click();
const i = page.locator("#new-project-name"); await i.waitFor({ state: "visible" }); await i.fill(`sf-${Date.now()}`); await i.press("Enter");
await page.waitForURL(/\/builder\/[^/?]+$/, { timeout: 60000 }); await page.waitForFunction(READY, undefined, { timeout: 90000 }); await page.waitForTimeout(1200);
const panel = async (name, want) => { const btn = page.getByRole("button", { name, exact: true }).first(); const pressed = await btn.getAttribute("aria-pressed"); if ((pressed === "true") !== want) { await btn.click(); await page.waitForTimeout(400); } };
const P = '[data-panel-id="properties"]';
await panel("Components", true); await page.locator("button.list-item").filter({ has: page.locator(".list-item-name", { hasText: /^Button$/i }) }).first().click(); await page.waitForTimeout(800); await panel("Components", false); await panel("Properties", true); await page.waitForTimeout(400);
await page.evaluate((P) => { document.querySelectorAll(`${P} .section-caret[aria-expanded="false"]`).forEach((c) => c.click()); }, P); await page.waitForTimeout(600);
// open compare mode (Preview iframe)
await page.getByRole("button", { name: /Compare Mode|비교 모드/ }).first().click(); await page.waitForTimeout(2500);
const fr = page.frames().find(f => f !== page.mainFrame() && /preview/.test(f.url()));
console.log("iframe url", fr?.url());
if (fr) { await fr.evaluate(() => { const log = (window.__MUT = []); const desc = (n) => { if (n.nodeType === 3) n = n.parentNode; const e = n; return `${e.tagName?.toLowerCase()}${e.id ? "#" + e.id : ""}${typeof e.className === "string" && e.className ? "." + e.className.split(" ").slice(0,2).join(".") : ""}${Object.keys(e.dataset||{}).slice(0,3).map(k=>`[data-${k}]`).join("")}`; };
  const obs = new MutationObserver((ms) => { for (const m of ms) { const t = m.target; log.push({ type: m.type, attr: m.attributeName, target: desc(t), old: m.oldValue?.slice(0,160), now: m.type === "attributes" ? t.getAttribute(m.attributeName)?.slice(0,160) : m.type === "characterData" ? t.data.slice(0,160) : "+" + [...m.addedNodes].map(desc).join(",") + " / -" + [...m.removedNodes].map(desc).join(","), t: Math.round(performance.now()) }); } });
  obs.observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeOldValue: true, characterData: true, characterDataOldValue: true }); });
  console.log("iframe style els", await fr.evaluate(() => [...document.querySelectorAll("style")].map(s => s.id || s.getAttribute("data-adr154-responsive") != null && "adr154" || s.getAttribute("data-vite-dev-id")?.split("/").slice(-1)[0] || "?"))); }
// install observer
await page.evaluate(() => {
  const log = (window.__MUT = []);
  const desc = (n) => { if (!n) return "?"; if (n.nodeType === 3) n = n.parentNode; const e = n; return `${e.tagName?.toLowerCase()}${e.id ? "#" + e.id : ""}${e.className && typeof e.className === "string" ? "." + e.className.split(" ").slice(0,2).join(".") : ""}${Object.keys(e.dataset||{}).slice(0,2).map(k=>`[data-${k}]`).join("")}`; };
  const obs = new MutationObserver((ms) => { for (const m of ms) { const t = m.target; const tag = (t.nodeType === 3 ? t.parentNode : t).tagName?.toLowerCase();
    const isStyleish = tag === "style" || tag === "link" || m.attributeName === "style" || m.attributeName === "class" || [...m.addedNodes, ...m.removedNodes].some(n => n.tagName === "STYLE" || n.tagName === "LINK");
    if (!isStyleish) continue;
    log.push({ type: m.type, attr: m.attributeName, target: desc(t), old: m.oldValue?.slice(0,120), now: m.type === "attributes" ? t.getAttribute(m.attributeName)?.slice(0,120) : m.type === "characterData" ? t.data.slice(0,120) : [...m.addedNodes].map(desc).join(",") + " / -" + [...m.removedNodes].map(desc).join(","), t: performance.now() }); } });
  obs.observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeOldValue: true, characterData: true, characterDataOldValue: true, attributeFilter: ["style", "class"] });
  document.querySelectorAll("iframe").forEach(f => { try { obs.observe(f.contentDocument.documentElement, { subtree: true, childList: true, attributes: true, attributeOldValue: true, characterData: true, characterDataOldValue: true }); } catch {} });
  window.__MUT_T0 = performance.now();
});
console.log("iframes", await page.evaluate(() => document.querySelectorAll("iframe").length), "style els", await page.evaluate(() => [...document.querySelectorAll("style")].map(s => s.id || s.getAttribute("data-vite-dev-id")?.split("/").slice(-2).join("/") || s.outerHTML.slice(0,60)).length));
// change: click a seg (size) then a checkbox/toggle
const segs = page.locator(`${P} .property-seg .react-aria-ToggleButton`);
console.log("seg count", await segs.count());
await page.evaluate(() => (window.__MUT.length = 0));
await segs.nth(1).click(); await page.waitForTimeout(700);
const m1 = await page.evaluate(() => window.__MUT); const f1 = fr ? await fr.evaluate(() => window.__MUT) : [];
console.log("--- IFRAME after seg click: mutations", f1.length); console.log(JSON.stringify(f1.map(m => ({...m, old: m.old?.slice(0,100), now: m.now?.slice(0,100)})), null, 1));
if (fr) await fr.evaluate(() => (window.__MUT.length = 0));
console.log("--- after seg click: mutations", m1.length);
const summarize = (ms) => { const c = {}; for (const m of ms) { const k = `${m.type}:${m.attr ?? ""}:${m.target}`; c[k] = (c[k] ?? 0) + 1; } return Object.entries(c).sort((a,b)=>b[1]-a[1]).slice(0,40); };
console.log(JSON.stringify(summarize(m1), null, 1));
console.log("samples", JSON.stringify(m1.filter(m => m.target.startsWith("style") || m.target.startsWith("link") || m.target.startsWith("html") || m.target.startsWith("body")).slice(0,10), null, 1));
// toggle a checkbox
await page.evaluate(() => (window.__MUT.length = 0));
const cb = page.locator(`${P} .react-aria-Switch, ${P} .react-aria-Checkbox`).first();
if (await cb.count()) { await cb.click(); await page.waitForTimeout(700); const m2 = await page.evaluate(() => window.__MUT); console.log("--- after toggle: mutations", m2.length); console.log(JSON.stringify(summarize(m2), null, 1)); const f2 = fr ? await fr.evaluate(() => window.__MUT) : []; console.log("--- IFRAME after toggle: mutations", f2.length); console.log(JSON.stringify(f2.map(m => ({...m, old: m.old?.slice(0,100), now: m.now?.slice(0,100)})), null, 1)); }
console.log("errors", errors.slice(0, 3));
await browser.close();
