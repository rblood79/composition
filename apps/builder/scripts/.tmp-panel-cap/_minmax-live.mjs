import { chromium } from "playwright";
import { resolve } from "node:path";
const READY = () => Boolean(window.__composition_STORE__ && window.__composition_STORE__.getState().currentPageId && document.querySelector(".app:not(.builder-booting)") && document.querySelector('[data-testid="skia-canvas-unified"]'));
const browser = await chromium.launch({ headless: false });
const page = await (await browser.newContext({ storageState: resolve("apps/builder/scripts/.auth-session.json"), viewport: { width: 1600, height: 1400 } })).newPage();
await page.goto("http://localhost:5173/dashboard", { waitUntil: "networkidle" });
const b = page.locator("button.dashboard-create-button").first(); await b.waitFor({ state: "visible" }); await b.click();
const i = page.locator("#new-project-name"); await i.waitFor({ state: "visible" }); await i.fill(`mm-${Date.now()}`); await i.press("Enter");
await page.waitForURL(/\/builder\/[^/?]+$/, { timeout: 60000 }); await page.waitForFunction(READY, undefined, { timeout: 90000 }); await page.waitForTimeout(1200);
const panel = async (name, want) => { const btn = page.getByRole("button", { name, exact: true }).first(); const pressed = await btn.getAttribute("aria-pressed"); if ((pressed === "true") !== want) { await btn.click(); await page.waitForTimeout(400); } };
const P = '[data-panel-id="properties"]';
for (const type of ["Popover", "Tooltip"]) {
  await panel("Properties", false); await panel("Components", true); await page.locator("button.list-item").filter({ has: page.locator(".list-item-name", { hasText: new RegExp(`^${type}$`, "i") }) }).first().click(); await page.waitForTimeout(800); await panel("Components", false); await panel("Properties", true); await page.waitForTimeout(400);
  await page.evaluate((P) => { document.querySelectorAll(`${P} .section-caret[aria-expanded="false"]`).forEach((c) => c.click()); }, P); await page.waitForTimeout(300);
  const rows = await page.evaluate((P) => Array.from(document.querySelectorAll(`${P} .fieldset-row`)).map((r) => { const legends = Array.from(r.querySelectorAll("legend, label")).map((l) => l.textContent.trim()); const inputs = Array.from(r.querySelectorAll("input")).map((i) => i.value); const sel = [...Array.from(r.querySelectorAll(".react-aria-Select button")).map((b) => b.textContent.trim()), ...Array.from(r.querySelectorAll(".react-aria-ToggleButton[data-selected]")).map((b) => "seg:" + (b.getAttribute("aria-label") || b.textContent.trim()))]; const reset = r.querySelector(".actions-reset") != null; return `${legends.join("/")} = ${[...inputs, ...sel].join(" | ")}${reset ? "  [reset]" : ""}`; }).filter((s) => /Min|Max|Step|Offset|Padding|Placement/.test(s)), P);
  console.log(type, "→", rows);
}
await browser.close();
