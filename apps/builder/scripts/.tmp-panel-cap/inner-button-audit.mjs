import { chromium } from "playwright";
import { resolve } from "node:path";
const OUT = "/private/tmp/claude-501/-Users-admin-work-composition/f6bcc488-f176-4644-8364-3625704b801c/scratchpad/audit";
const READY = () => Boolean(window.__composition_STORE__ && window.__composition_STORE__.getState().currentPageId && document.querySelector(".app:not(.builder-booting)") && document.querySelector('[data-testid="skia-canvas-unified"]'));
const browser = await chromium.launch({ headless: false });
const page = await (await browser.newContext({ storageState: resolve("apps/builder/scripts/.auth-session.json"), viewport: { width: 1600, height: 1400 }, deviceScaleFactor: 2 })).newPage();
await page.goto("http://localhost:5173/dashboard", { waitUntil: "networkidle" });
const b = page.locator("button.dashboard-create-button").first(); await b.waitFor({ state: "visible", timeout: 15000 }); await b.click();
const i = page.locator("#new-project-name"); await i.waitFor({ state: "visible" }); await i.fill(`ib-${Date.now()}`); await i.press("Enter");
await page.waitForURL(/\/builder\/[^/?]+$/, { timeout: 60000 }); await page.waitForFunction(READY, undefined, { timeout: 90000 }); await page.waitForTimeout(1200);
const panel = async (name) => { await page.getByRole("button", { name, exact: true }).first().click(); await page.waitForTimeout(400); };
const addSel = async (re) => { await panel("Components"); const item = page.locator("button.list-item").filter({ has: page.locator(".list-item-name", { hasText: re }) }).first(); await item.scrollIntoViewIfNeeded(); await item.click(); await page.waitForTimeout(900); await panel("Components").catch(() => {}); };
const expandAll = async (P) => { for (const c of await page.locator(`${P} .section-caret[aria-expanded="false"]`).all()) { await c.click().catch(() => {}); await page.waitForTimeout(150); } };
// 규칙: fieldset 안 컨트롤 상자 (Group/Select Button/ToggleButtonGroup/control) 높이 28, 그 안 버튼·칩·스와치 높이 20 (정사각 버튼은 20×20)
const audit = (P) => page.evaluate((P) => {
  const out = [];
  const r = (el) => el.getBoundingClientRect();
  for (const sec of document.querySelectorAll(`${P} .section`)) {
    const title = sec.querySelector(".section-title")?.textContent.trim();
    const content = sec.querySelector(".section-content"); if (!content) continue;
    for (const f of content.querySelectorAll("fieldset.properties-aria")) {
      const name = (f.querySelector("legend")?.textContent ?? f.getAttribute("aria-label") ?? f.className).trim().slice(0, 24);
      const boxes = f.querySelectorAll(":scope > .react-aria-Group, :scope > .react-aria-control, :scope > .react-aria-ToggleButtonGroup, :scope > .react-aria-Select > .react-aria-Button, :scope > .react-aria-Select, :scope > .react-aria-ComboBox, :scope > div > .react-aria-Group, :scope > .react-aria-Group > .react-aria-Group");
      const box = boxes[0];
      const bh = box ? Math.round(r(box).height) : null;
      if (bh !== null && bh !== 28 && bh !== 46 && bh !== 0) out.push(`${title} · ${name} · 상자 ${Math.round(r(box).width)}×${bh} (${box.className.toString().split(" ").slice(0, 2).join(".")})`);
      // 안쪽 버튼·칩·스와치
      for (const btn of f.querySelectorAll("button, [role=button], .react-aria-ToggleButton, .color-swatch, .swatch, [class*=swatch]")) {
        if (btn.closest(".react-aria-Popover")) continue;
        const rr = r(btn); if (rr.height === 0) continue;
        const h = Math.round(rr.height), w = Math.round(rr.width);
        const isChip = btn.matches(".react-aria-ToggleButton, [role=radio]");
        const cls = btn.className.toString().split(" ").slice(0, 2).join(".");
        // Select/ComboBox 자체 버튼 (28 상자) 은 제외
        if (btn.matches(".react-aria-Select > .react-aria-Button, .icon-picker-input-trigger, .font-picker-trigger, .fill-layer-row__trigger, .effect-layer-row__trigger, .box-model__link")) { if (h !== 28) out.push(`${title} · ${name} · 트리거 ${w}×${h} (${cls})`); continue; }
        if (h !== 20 || (!isChip && w !== 20 && !btn.matches(".property-unit-input__suffix--trigger, .color-value, .color-preview, .color-picker-trigger, [class*=color]"))) out.push(`${title} · ${name} · 버튼 ${w}×${h} (${cls})`);
      }
    }
  }
  return out;
}, P);
const results = {};
// Styles — Frame
await addSel(/^frame$/i);
await page.evaluate(() => { const s = window.__composition_STORE__.getState(); const el = s.elements.filter((e) => e.page_id === s.currentPageId && e.type === "frame").pop(); s.setSelectedElement(el.id, el.props); setTimeout(() => s.updateSelectedStyles({ borderStyle: "solid", borderWidth: "2px" }), 300); }); await page.waitForTimeout(800);
await panel("Styles");
const PS = '[data-panel-id="styles"]';
for (const [idx, tab] of ["Layout", "Style", "Text", "Screen"].entries()) { await page.locator(".styles-panel-tab").nth(idx).click(); await page.waitForTimeout(400); await expandAll(PS); results[`styles/${tab}/frame`] = await audit(PS); }
// Text element for Typography
await addSel(/^text$/i);
await page.locator(".styles-panel-tab").nth(2).click(); await page.waitForTimeout(400); await expandAll(PS); results["styles/Text/text"] = await audit(PS);
// Fill popover + shadow editor
await page.locator(".styles-panel-tab").nth(1).click(); await page.waitForTimeout(400); await expandAll(PS);
await page.locator(`${PS} .section[data-section-id="fill"] .fill-layer-row__trigger`).first().click().catch(() => {}); await page.waitForTimeout(500);
results["styles/fill-popover"] = await page.evaluate(() => { const out = []; const pop = document.querySelector(".fill-detail-popover, .react-aria-Popover"); if (!pop) return ["no popover"]; const r = (el) => el.getBoundingClientRect(); for (const btn of pop.querySelectorAll("button, .react-aria-ToggleButton")) { const rr = r(btn); const h = Math.round(rr.height), w = Math.round(rr.width); if (h !== 20 && h !== 28) out.push(`popover 버튼 ${w}×${h} (${btn.className.toString().split(" ").slice(0, 2).join(".")}) 「${(btn.getAttribute("aria-label") ?? btn.textContent).trim().slice(0, 16)}」`); } for (const g of pop.querySelectorAll(".react-aria-Group, .react-aria-ToggleButtonGroup")) { const h = Math.round(r(g).height); if (h && h !== 28 && h !== 100 && h !== 12) out.push(`popover 상자 ${Math.round(r(g).width)}×${h} (${g.className.toString().split(" ").slice(0, 2).join(".")})`); } return out; });
await page.keyboard.press("Escape"); await page.waitForTimeout(300);
// Properties — button, text field, slider, date picker
const PP = '[data-panel-id="properties"]';
for (const name of ["button", "text field", "slider", "date picker", "checkbox group", "Bar Chart"]) {
  await addSel(new RegExp(`^${name}$`, "i"));
  if (!(await page.locator(`${PP} .panel-contents`).isVisible().catch(() => false))) await panel("Properties");
  await page.waitForTimeout(400); await expandAll(PP);
  results[`props/${name}`] = await audit(PP);
}
for (const [k, v] of Object.entries(results)) console.log(`== ${k}\n${v.length ? v.join("\n") : "ok"}`);
await browser.close();
