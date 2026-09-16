import { chromium } from "playwright";
import { resolve } from "node:path";
const READY = () => Boolean(window.__composition_STORE__ && window.__composition_STORE__.getState().currentPageId && document.querySelector(".app:not(.builder-booting)") && document.querySelector('[data-testid="skia-canvas-unified"]'));
const browser = await chromium.launch({ headless: false });
const page = await (await browser.newContext({ storageState: resolve("apps/builder/scripts/.auth-session.json"), viewport: { width: 1600, height: 1400 } })).newPage();
const cdp = await page.context().newCDPSession(page); const RATE = Number(process.env.CPU ?? 1); if (RATE > 1) await cdp.send("Emulation.setCPUThrottlingRate", { rate: RATE }); console.log("cpu throttle", RATE);
const errors = []; page.on("pageerror", (e) => errors.push(e.message));
await page.goto("http://localhost:5173/dashboard", { waitUntil: "networkidle" });
const b = page.locator("button.dashboard-create-button").first(); await b.waitFor({ state: "visible", timeout: 15000 }); await b.click();
const i = page.locator("#new-project-name"); await i.waitFor({ state: "visible" }); await i.fill(`sa-${Date.now()}`); await i.press("Enter");
await page.waitForURL(/\/builder\/[^/?]+$/, { timeout: 60000 }); await page.waitForFunction(READY, undefined, { timeout: 90000 }); await page.waitForTimeout(1200);
const panel = async (name, want) => { const btn = page.getByRole("button", { name, exact: true }).first(); const pressed = await btn.getAttribute("aria-pressed"); if ((pressed === "true") !== want) { await btn.click(); await page.waitForTimeout(400); } };
await panel("Components", true); await page.locator("button.list-item").filter({ has: page.locator(".list-item-name", { hasText: /^Button$/i }) }).first().click(); await page.waitForTimeout(800); await panel("Components", false); await panel("Properties", true); await page.waitForTimeout(400);
const P = '[data-panel-id="properties"]';
await page.evaluate((P) => { document.querySelectorAll(`${P} .section-caret[aria-expanded="false"]`).forEach((c) => c.click()); }, P); await page.waitForTimeout(300);
// instrument: tag group node, record indicator translate samples after click
const probe = async (groupSel, targetIndex, label) => {
  await page.evaluate((sel) => { const g = document.querySelector(sel); window.__segGroup = g; g.dataset.probe = "1"; window.__samples = []; }, groupSel);
  const btn = page.locator(groupSel).locator(".react-aria-ToggleButton").nth(targetIndex);
  await page.evaluate(() => { window.__lt = []; try { new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lt.push(Math.round(e.duration)); }).observe({ type: "longtask", buffered: false }); } catch {} });
  await page.evaluate((sel) => { const g = document.querySelector(sel); const rec = () => { const ind = g.querySelector('.react-aria-ToggleButton[data-selected] .react-aria-SelectionIndicator'); const r = ind?.getBoundingClientRect(); window.__samples.push({ t: performance.now(), x: r ? Math.round(r.left) : null, tr: ind ? getComputedStyle(ind).translate : null, same: document.querySelector(sel) === window.__segGroup, probe: document.querySelector(sel)?.dataset.probe }); if (window.__samples.length < 40) requestAnimationFrame(rec); }; window.__startRec = () => requestAnimationFrame(rec); }, groupSel);
  await page.evaluate(() => window.__startRec());
  await btn.click(); await page.waitForTimeout(500);
  const s = await page.evaluate(() => window.__samples); const lt = await page.evaluate(() => window.__lt);
  const xs = [...new Set(s.map((v) => v.x))];
  const gaps = s.slice(1).map((v, i) => Math.round(v.t - s[i].t)); const maxGap = Math.max(...gaps);
  console.log(label, "| moving frames:", xs.length, "| max frame gap:", maxGap, "ms | longtasks:", lt.join(","), "| same:", s.every((v) => v.same));
  if (process.env.DUMP && label.includes(process.env.DUMP)) console.log("   samples", s.slice(0, 14).map((v) => `${Math.round(v.t % 10000)}:${v.x}:${v.tr}`).join(" "));
};
const list = await page.evaluate((P) => Array.from(document.querySelectorAll(`${P} .react-aria-ToggleButtonGroup[data-indicator="true"]`)).map((g, i) => `${i}:${g.parentElement.className}|${g.getAttribute("aria-label")}:${g.querySelectorAll(".react-aria-ToggleButton").length}`), P); console.log("props groups", list);
for (let gi = 0; gi < list.length; gi++) {
  const sel = `${P} .react-aria-ToggleButtonGroup[data-indicator="true"]:nth-of-type(1)`;
  await page.evaluate(({ P, gi }) => { document.querySelectorAll(`${P} .react-aria-ToggleButtonGroup[data-indicator="true"]`).forEach((g, i) => { if (i === gi) g.id = "probe-g"; else g.removeAttribute("id"); }); }, { P, gi });
  const n = await page.locator("#probe-g .react-aria-ToggleButton").count();
  const cur = await page.evaluate(() => Array.from(document.querySelectorAll("#probe-g .react-aria-ToggleButton")).findIndex((b) => b.hasAttribute("data-selected")));
  const target = (cur + 1) % n;
  await probe("#probe-g", target, `PROPERTIES ${list[gi]} → ${target}`);
}
for (const type of ["Text ?Field", "Popover"]) {
  await panel("Properties", false); await panel("Components", true); await page.locator("button.list-item").filter({ has: page.locator(".list-item-name", { hasText: new RegExp(`^${type}$`, "i") }) }).first().click(); await page.waitForTimeout(800); await panel("Components", false); await panel("Properties", true); await page.waitForTimeout(400);
  await page.evaluate((P) => { document.querySelectorAll(`${P} .section-caret[aria-expanded="false"]`).forEach((c) => c.click()); }, P); await page.waitForTimeout(300);
  const list2 = await page.evaluate((P) => Array.from(document.querySelectorAll(`${P} .react-aria-ToggleButtonGroup[data-indicator="true"]`)).map((g, i) => `${i}:${g.parentElement.className.split(" ").pop()}|${g.getAttribute("aria-label")}:${g.querySelectorAll(".react-aria-ToggleButton").length}`), P);
  for (let gi = 0; gi < list2.length; gi++) {
    await page.evaluate(({ P, gi }) => { document.querySelectorAll(`${P} .react-aria-ToggleButtonGroup[data-indicator="true"]`).forEach((g, i) => { if (i === gi) g.id = "probe-g"; else g.removeAttribute("id"); }); }, { P, gi });
    const n = await page.locator("#probe-g .react-aria-ToggleButton").count();
    const cur = await page.evaluate(() => Array.from(document.querySelectorAll("#probe-g .react-aria-ToggleButton")).findIndex((b) => b.hasAttribute("data-selected")));
    let target = (cur + 1) % n; if (await page.locator("#probe-g .react-aria-ToggleButton").nth(target).isDisabled()) target = (target + 1) % n;
    await probe("#probe-g", target, `PROPERTIES ${type} ${list2[gi]} → ${target}`);
  }
}
// styles panel: text align seg
await panel("Properties", false); await panel("Styles", true); await page.waitForTimeout(500);
const S = '[data-panel-id="styles"]';
await page.evaluate((S) => { document.querySelectorAll(`${S} .section-caret[aria-expanded="false"]`).forEach((c) => c.click()); }, S); await page.waitForTimeout(300);
const groups = await page.evaluate((S) => Array.from(document.querySelectorAll(`${S} .react-aria-ToggleButtonGroup[data-indicator="true"]`)).map((g) => `${g.getAttribute("aria-label")}:${g.querySelectorAll(".react-aria-ToggleButton").length}`).slice(0, 12), S); console.log("styles groups", groups);
const firstSel = `${S} .react-aria-ToggleButtonGroup[data-indicator="true"]`;
await probe(firstSel, 1, "STYLES first seg");
await probe(firstSel, 0, "STYLES first seg back");
console.log("errors", errors.slice(0, 3));
await browser.close();
