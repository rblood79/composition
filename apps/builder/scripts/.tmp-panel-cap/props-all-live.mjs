import { chromium } from "playwright";
import { resolve } from "node:path";
import { writeFileSync, mkdirSync } from "node:fs";
const OUT = "/private/tmp/claude-501/-Users-admin-work-composition/f6bcc488-f176-4644-8364-3625704b801c/scratchpad/audit/props-all"; mkdirSync(OUT, { recursive: true });
const READY = () => Boolean(window.__composition_STORE__ && window.__composition_STORE__.getState().currentPageId && document.querySelector(".app:not(.builder-booting)") && document.querySelector('[data-testid="skia-canvas-unified"]'));
const browser = await chromium.launch({ headless: false });
const page = await (await browser.newContext({ storageState: resolve("apps/builder/scripts/.auth-session.json"), viewport: { width: 1600, height: 1400 }, deviceScaleFactor: 1 })).newPage();
const errors = []; page.on("pageerror", (e) => errors.push(e.message));
await page.goto("http://localhost:5173/dashboard", { waitUntil: "networkidle" });
const b = page.locator("button.dashboard-create-button").first(); await b.waitFor({ state: "visible", timeout: 15000 }); await b.click();
const i = page.locator("#new-project-name"); await i.waitFor({ state: "visible" }); await i.fill(`pa-${Date.now()}`); await i.press("Enter");
await page.waitForURL(/\/builder\/[^/?]+$/, { timeout: 60000 }); await page.waitForFunction(READY, undefined, { timeout: 90000 }); await page.waitForTimeout(1200);
const panel = async (name) => { await page.getByRole("button", { name, exact: true }).first().click(); await page.waitForTimeout(400); };
await panel("Components");
const names = await page.evaluate(() => Array.from(document.querySelectorAll('[data-panel-id="components"] button.list-item .list-item-name')).map((n) => n.textContent.trim()));
await panel("Components");
console.log("palette:", names.length, names.join(", "));
const P = '[data-panel-id="properties"]';
const report = [];
const audit = () => page.evaluate((P) => {
  const out = [];
  const root = document.querySelector(`${P} .panel-contents`);
  if (!root) return ["NO PANEL"];
  const sections = Array.from(root.querySelectorAll(".section"));
  const clipped = (el) => el.scrollWidth > el.clientWidth + 1;
  for (const s of sections) {
    const title = s.querySelector(".section-title")?.textContent.trim();
    const content = s.querySelector(".section-content"); if (!content) continue;
    // 1) 클립 텍스트
    for (const el of content.querySelectorAll("legend, .react-aria-SelectValue, .property-field__suffix, .property-unit-input__suffix, .icon-picker-value, .react-aria-ToggleButton, [role=radio], .react-aria-Switch, .modified-row__text, .control-button, label, span")) {
      if (el.children.length && !el.matches(".react-aria-ToggleButton, [role=radio]")) continue;
      const t = el.textContent.trim(); if (!t) continue;
      if (clipped(el)) out.push(`${title} · clip「${t.slice(0, 20)}」 ${el.className.toString().split(" ")[0]} sw${el.scrollWidth}/cw${el.clientWidth}`);
    }
    // 2) 칸 폭 — seg 칩 < 24 · 필드 < 60
    for (const el of content.querySelectorAll(".react-aria-ToggleButton, [role=radio]")) { const r = el.getBoundingClientRect(); if (r.width < 24) out.push(`${title} · chip「${el.textContent.trim() || el.getAttribute("aria-label")}」 ${Math.round(r.width)}×${Math.round(r.height)}`); }
    for (const f of content.querySelectorAll("fieldset.properties-aria")) { const r = f.getBoundingClientRect(); const name = f.getAttribute("aria-label") ?? f.querySelector("legend")?.textContent; if (r.width < 60) out.push(`${title} · fieldset「${name}」 폭 ${Math.round(r.width)}`); const ctl = f.querySelector(":scope > .react-aria-Group, :scope > .react-aria-control"); if (ctl) { const h = Math.round(ctl.getBoundingClientRect().height); if (![28, 32].includes(h) && h < 60) out.push(`${title} · ctl「${name}」 h${h}`); } }
    // 3) 행 넘침
    for (const row of content.querySelectorAll(".fieldset-row")) { if (row.scrollWidth > row.clientWidth + 1) out.push(`${title} · row overflow sw${row.scrollWidth}/cw${row.clientWidth}`); }
    // 4) 겹침 — 같은 행의 형제 fieldset rect 교차
    for (const row of content.querySelectorAll(".fieldset-row")) { const fs = Array.from(row.querySelectorAll(":scope > fieldset")); for (let a = 0; a < fs.length; a++) for (let b2 = a + 1; b2 < fs.length; b2++) { const ra = fs[a].getBoundingClientRect(), rb = fs[b2].getBoundingClientRect(); if (ra.right > rb.left + 1 && rb.right > ra.left + 1 && ra.bottom > rb.top + 1 && rb.bottom > ra.top + 1) out.push(`${title} · overlap ${fs[a].getAttribute("aria-label") ?? fs[a].querySelector("legend")?.textContent} ↔ ${fs[b2].getAttribute("aria-label") ?? fs[b2].querySelector("legend")?.textContent}`); } }
  }
  return out;
}, P);
for (const name of names) {
  try {
    await panel("Components");
    const item = page.locator("button.list-item").filter({ has: page.locator(".list-item-name", { hasText: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`) }) }).first();
    await item.scrollIntoViewIfNeeded(); await item.click(); await page.waitForTimeout(900);
    await panel("Components").catch(() => {});
    const sel = await page.evaluate(() => { const st = window.__composition_STORE__.getState(); const el = st.selectedElementId ? st.elementsMap.get(st.selectedElementId) : null; return el ? `${el.type}#${el.id.slice(0, 6)}` : null; });
    await panel("Properties");
    await page.waitForTimeout(400);
    // 접힌 절 펼치기
    await page.evaluate((P) => { document.querySelectorAll(`${P} .section-caret[aria-expanded="false"]`).forEach((c) => c.click()); }, P); await page.waitForTimeout(300);
    const issues = await audit();
    const sections = await page.evaluate((P) => Array.from(document.querySelectorAll(`${P} .section-title`)).map((t) => t.textContent.trim()).join(" · "), P);
    report.push({ name, sel, sections, issues });
    console.log(`${name} (${sel}) [${sections}] → ${issues.length ? issues.join(" | ") : "ok"}`);
    if (issues.length) await page.locator(`${P}`).screenshot({ path: `${OUT}/${name.replace(/[^a-z0-9]/gi, "_")}.png` }).catch(() => {});
    await panel("Properties").catch(() => {});
    // 제거
    await page.evaluate(() => { const st = window.__composition_STORE__.getState(); if (st.selectedElementId) st.removeElement?.(st.selectedElementId); }); await page.waitForTimeout(300);
  } catch (e) { console.log(`${name} ERROR ${String(e).slice(0, 120)}`); report.push({ name, error: String(e) }); await page.keyboard.press("Escape").catch(() => {}); }
}
writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 1));
console.log("errors", errors.slice(0, 5));
await browser.close();
