import { chromium } from "playwright";
import { resolve } from "node:path";
import { mkdirSync } from "node:fs";
const OUT = process.env.OUT ?? "/private/tmp/claude-501/-Users-admin-work-composition/f6bcc488-f176-4644-8364-3625704b801c/scratchpad/props-before"; mkdirSync(OUT, { recursive: true });
const TYPES = (process.env.TYPES ?? "Button,TextField,Select,Card,Popover,Slider,Link,Disclosure,Pagination").split(",");
const READY = () => Boolean(window.__composition_STORE__ && window.__composition_STORE__.getState().currentPageId && document.querySelector(".app:not(.builder-booting)") && document.querySelector('[data-testid="skia-canvas-unified"]'));
const browser = await chromium.launch({ headless: false });
const page = await (await browser.newContext({ storageState: resolve("apps/builder/scripts/.auth-session.json"), viewport: { width: 1600, height: Number(process.env.VH ?? 1600) }, deviceScaleFactor: 1 })).newPage();
const errors = []; page.on("pageerror", (e) => errors.push(e.message));
await page.goto("http://localhost:5173/dashboard", { waitUntil: "networkidle" });
const b = page.locator("button.dashboard-create-button").first(); await b.waitFor({ state: "visible", timeout: 15000 }); await b.click();
const i = page.locator("#new-project-name"); await i.waitFor({ state: "visible" }); await i.fill(`ps-${Date.now()}`); await i.press("Enter");
await page.waitForURL(/\/builder\/[^/?]+$/, { timeout: 60000 }); await page.waitForFunction(READY, undefined, { timeout: 90000 }); await page.waitForTimeout(1200);
const panel = async (name) => { await page.getByRole("button", { name, exact: true }).first().click(); await page.waitForTimeout(400); };
const P = '[data-panel-id="properties"]';
for (const name of TYPES) {
  try {
    await panel("Components");
    const item = page.locator("button.list-item").filter({ has: page.locator(".list-item-name", { hasText: new RegExp(`^${name.replace(/([a-z])([A-Z])/g, "$1 ?$2")}$`, "i") }) }).first();
    await item.scrollIntoViewIfNeeded(); await item.click(); await page.waitForTimeout(900);
    await panel("Components").catch(() => {});
    await panel("Properties"); await page.waitForTimeout(400);
    await page.evaluate((P) => { document.querySelectorAll(`${P} .section-caret[aria-expanded="false"]`).forEach((c) => c.click()); }, P); await page.waitForTimeout(300);
    const info = await page.evaluate((P) => {
      const root = document.querySelector(`${P} .panel-contents`);
      const out = [];
      for (const s of root.querySelectorAll(".section")) {
        const title = s.querySelector(".section-title")?.textContent.trim();
        const rows = Array.from(s.querySelectorAll(".section-content > .fieldset-row, .section-content > fieldset, .section-content > div")).map((r) => {
          const fs = Array.from(r.matches("fieldset") ? [r] : r.querySelectorAll(":scope > fieldset"));
          return fs.map((f) => { const lg = f.querySelector("legend")?.textContent.trim() ?? f.getAttribute("aria-label"); const kind = f.querySelector(".react-aria-Select") ? "select" : f.querySelector(".react-aria-ToggleButtonGroup") ? "seg" : f.querySelector(".react-aria-Switch") ? "switch" : f.querySelector(".react-aria-NumberField, .react-aria-Input[inputmode]") ? "number" : f.querySelector("input") ? "input" : "?"; const rr = f.getBoundingClientRect(); return `${lg}:${kind}(${Math.round(rr.width)}×${Math.round(rr.height)})`; }).join(" | ") || r.className;
        });
        out.push(`  [${title}] ` + rows.join(" / "));
      }
      return out.join("\n");
    }, P);
    console.log(`## ${name}\n${info}`);
    const geo = await page.evaluate((P) => { const pc = document.querySelector(`${P} .panel-contents`); let el = pc; const out = []; while (el && out.length < 8) { const r = el.getBoundingClientRect(); out.push(`${el.className.toString().split(" ")[0]} h${Math.round(r.height)} sh${el.scrollHeight} ov=${getComputedStyle(el).overflowY}`); el = el.parentElement; } return out.join(" < "); }, P); console.log(geo);
    await page.evaluate((P) => { const pc = document.querySelector(`${P} .panel-contents`); const h = pc.scrollHeight + 8; let el = pc; while (el && !el.classList.contains("panel-dock-surface")) { el.style.setProperty("height", el === pc ? h + "px" : "auto", "important"); el.style.setProperty("max-height", "none", "important"); el.style.setProperty("overflow", "visible", "important"); el = el.parentElement; } }, P); await page.waitForTimeout(200);
    await page.locator(`${P} .panel-contents`).screenshot({ path: `${OUT}/${name}.png` });
    await panel("Properties").catch(() => {});
    await page.evaluate(() => { const st = window.__composition_STORE__.getState(); if (st.selectedElementId) st.removeElement?.(st.selectedElementId); }); await page.waitForTimeout(300);
  } catch (e) { console.log(`${name} ERROR ${String(e).slice(0, 160)}`); await page.keyboard.press("Escape").catch(() => {}); }
}
console.log("errors", errors.slice(0, 5));
await browser.close();
