// panel-ui 21 미반영 5 live — History 메뉴 · 바인딩 팝오버 · AgentCommandConfirmDialog · Ruler · CompareMode
import { chromium } from "playwright";
import { resolve } from "node:path";
const OUT = process.env.OUT ?? "/private/tmp/claude-501/-Users-admin-work-composition/f6bcc488-f176-4644-8364-3625704b801c/scratchpad/cap";
const READY = () => Boolean(window.__composition_STORE__ && window.__composition_STORE__.getState().currentPageId && document.querySelector(".app:not(.builder-booting)") && document.querySelector('[data-testid="skia-canvas-unified"]'));
const browser = await chromium.launch({ headless: false });
const page = await (await browser.newContext({ storageState: resolve("apps/builder/scripts/.auth-session.json"), viewport: { width: 1600, height: 1100 }, deviceScaleFactor: 2 })).newPage();
const errors = []; page.on("pageerror", (e) => errors.push(e.message));
await page.goto("http://localhost:5173/dashboard", { waitUntil: "networkidle" });
const b = page.locator("button.dashboard-create-button").first(); await b.waitFor({ state: "visible", timeout: 15000 }); await b.click();
const i = page.locator("#new-project-name"); await i.waitFor({ state: "visible" }); await i.fill(`inv21-${Date.now()}`); await i.press("Enter");
await page.waitForURL(/\/builder\/[^/?]+$/, { timeout: 60000 }); await page.waitForFunction(READY, undefined, { timeout: 90000 }); await page.waitForTimeout(1200);
const M = (sel, n = 12) => page.evaluate(({ sel, n }) => Array.from(document.querySelectorAll(sel)).filter((el) => el.getBoundingClientRect().width > 0).slice(0, n).map((el) => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return `${(el.className.toString() || el.tagName).replace(/react-aria-/g, "").slice(0, 44)} | ${Math.round(r.width)}×${Math.round(r.height)} fs${cs.fontSize} ff${cs.fontFamily.split(",")[0]} pad${cs.padding}`; }), { sel, n });
const log = (k, v) => console.log(k, JSON.stringify(v, null, 1));

// ── 1. History 스냅샷 메뉴 ──
await page.evaluate(async () => { const st = window.__composition_STORE__.getState(); const body = st.elements.find((e) => e.type === "body" && e.page_id === st.currentPageId) ?? st.elements.find((e) => e.type === "body"); const now = new Date().toISOString(); await st.addElement({ id: crypto.randomUUID(), type: "Button", parent_id: body.id, page_id: body.page_id, order_num: 1, created_at: now, updated_at: now, props: { style: {}, children: "Hi" } }); });
await page.waitForTimeout(600);
await page.getByRole("button", { name: "History", exact: true }).first().click(); await page.waitForTimeout(500);
await page.getByRole("button", { name: "History actions" }).first().click(); await page.waitForTimeout(400);
log("history menu", await M(".history-menu-popover, .history-menu, .history-menu-item, .history-menu-item svg"));
await page.locator(".history-menu-item").first().screenshot({ path: `${OUT}/inv21-history-menu.png` }).catch(() => {});
await page.keyboard.press("Escape"); await page.waitForTimeout(200);

// ── 2. 데이터 바인딩 팝오버 — 테이블 하나 만든 뒤 ListBox 의 Data 절 ──
await page.getByRole("button", { name: "Data", exact: true }).first().click(); await page.waitForTimeout(500);
await page.getByRole("button", { name: /add table/i }).first().click(); await page.waitForTimeout(800);
const E = page.locator('[data-panel-id="datatableEditor"]').last();
await E.locator(".creator-method").nth(0).click().catch(() => {}); await page.waitForTimeout(300);
await E.locator("input").first().fill("Users").catch(() => {});
await E.getByRole("button", { name: /^create$/i }).last().click(); await page.waitForTimeout(1200);
const lbId = await page.evaluate(async () => { const st = window.__composition_STORE__.getState(); const body = st.elements.find((e) => e.type === "body" && e.page_id === st.currentPageId) ?? st.elements.find((e) => e.type === "body"); const now = new Date().toISOString(); const id = crypto.randomUUID(); await st.addElement({ id, type: "ListBox", parent_id: body.id, page_id: body.page_id, order_num: 2, created_at: now, updated_at: now, props: { style: {} } }); await new Promise((r) => setTimeout(r, 500)); const s2 = window.__composition_STORE__.getState(); s2.setSelectedElement(id, s2.elements.find((e) => e.id === id)?.props); return id; });
await page.waitForTimeout(700);
await page.getByRole("button", { name: "Properties", exact: true }).first().click().catch(() => {}); await page.waitForTimeout(500);
log("binding rows", await M('[data-panel-id="properties"] .property-data-binding, [data-panel-id="properties"] .binding-name-select, [data-panel-id="properties"] .binding-empty'));
const trig = page.locator('[data-panel-id="properties"] .binding-name-select .react-aria-Button').first();
if (await trig.count()) {
  await trig.click(); await page.waitForTimeout(400);
  log("binding popover", await M(".property-select-popover .ListBox, .property-select-popover .react-aria-ListBoxItem, .binding-option, .binding-option-label, .binding-option-desc"));
  await page.locator(".property-select-popover").last().screenshot({ path: `${OUT}/inv21-binding-popover.png` }).catch(() => {});
  await page.locator(".property-select-popover .react-aria-ListBoxItem").last().click(); await page.waitForTimeout(600);
  log("after bind", await M('[data-panel-id="properties"] .binding-name-select .react-aria-Button, [data-panel-id="properties"] .binding-fieldmap-select, [data-panel-id="properties"] .binding-actions, [data-panel-id="properties"] .property-field-template-input'));
  const ft = page.locator('[data-panel-id="properties"] .field-picker-trigger').first();
  if (await ft.count()) { await ft.click(); await page.waitForTimeout(400); log("field picker menu", await M(".field-picker-menu, .field-picker-menu .react-aria-MenuItem")); await page.locator(".field-picker-menu").screenshot({ path: `${OUT}/inv21-field-picker.png` }).catch(() => {}); await page.keyboard.press("Escape"); }
  const fm = page.locator('[data-panel-id="properties"] .binding-fieldmap-select .react-aria-Button').first();
  if (await fm.count()) { await fm.click(); await page.waitForTimeout(400); log("fieldmap popover", await M(".property-select-popover .react-aria-ListBoxItem, .property-select-popover .binding-option")); await page.locator(".property-select-popover").last().screenshot({ path: `${OUT}/inv21-fieldmap-popover.png` }).catch(() => {}); await page.keyboard.press("Escape"); }
}

// ── 3. AgentCommandConfirmDialog — 모듈 인스턴스가 같으면 실제 요청, 아니면 보고 ──
const agent = await page.evaluate(async () => {
  try {
    const m = await import("/src/services/agent/agentCommandConfirmation.ts");
    if (!m.hasAgentCommandConfirmationHost()) return "no-host (separate instance)";
    m.requestAgentCommandConfirmation({ id: "data.propose", host: "anthropic", summary: "Create Posts + 4 rows", mutation: "create", undo: "history", args: { ops: [{ op: "create_collection", name: "Posts", schema: [{ key: "title", type: "string" }], rows: [{ title: "hello" }] }, { op: "insert_rows", collectionId: "users", rows: [{ name: "a", age: 1 }, { name: "b", age: 2 }] }, { op: "bind_element", elementId: "e1", collectionId: "users" }] } });
    return "requested";
  } catch (e) { return `err ${String(e).slice(0, 80)}`; }
});
console.log("agent dialog:", agent);
await page.waitForTimeout(600);
log("agent modal", await M(".agent-confirm-modal, .agent-confirm-dialog, .agent-confirm-header, .agent-confirm-title, .agent-confirm-body, .agent-confirm-meta, .agent-confirm-actions, .agent-confirm-actions .control-button, .data-diff, .data-diff-heading, .data-diff-item, .data-diff-op, .data-diff-badge", 16));
await page.locator(".agent-confirm-modal").first().screenshot({ path: `${OUT}/inv21-agent-dialog.png` }).catch(() => {});
await page.locator(".agent-confirm-actions .control-button").first().click().catch(() => {}); await page.waitForTimeout(300);

// ── 4. Ruler ──
await page.evaluate(() => window.__composition_STORE__.getState().setShowRulers(true)); await page.waitForTimeout(500);
log("ruler", await M(".ruler-strip--h, .ruler-strip--v, .ruler-label--x, .ruler-label--y", 6));
await page.locator(".ruler-strip--h").screenshot({ path: `${OUT}/inv21-ruler.png` }).catch(() => {});

// ── 5. CompareMode ──
await page.getByRole("button", { name: "Compare Mode (Preview + Skia)" }).first().click(); await page.waitForTimeout(1200);
log("compare", await M(".workspace-compare-label, .workspace-compare-resizer .panel-resize-handle"));
await page.locator(".workspace-compare-panel--left .workspace-compare-label").screenshot({ path: `${OUT}/inv21-compare-label.png` }).catch(() => {});
console.log("errors", errors.slice(0, 3));
await browser.close();
