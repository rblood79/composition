// 07 Navigator live 하니스 (panel-ui 07) — 들여쓰기 안내선 · 검색 필드
import { chromium } from "playwright";
import { resolve } from "node:path";
const OUT = process.env.OUT ?? "/private/tmp/claude-501/-Users-admin-work-composition/f6bcc488-f176-4644-8364-3625704b801c/scratchpad/cap";
const READY = () => Boolean(window.__composition_STORE__ && window.__composition_STORE__.getState().currentPageId && document.querySelector(".app:not(.builder-booting)") && document.querySelector('[data-testid="skia-canvas-unified"]'));
const browser = await chromium.launch({ headless: false });
const page = await (await browser.newContext({ storageState: resolve("apps/builder/scripts/.auth-session.json"), viewport: { width: 1600, height: 1100 }, deviceScaleFactor: 2 })).newPage();
await page.goto("http://localhost:5173/dashboard", { waitUntil: "networkidle" });
const b = page.locator("button.dashboard-create-button").first(); await b.waitFor({ state: "visible", timeout: 15000 }); await b.click();
const i = page.locator("#new-project-name"); await i.waitFor({ state: "visible" }); await i.fill(`nv-${Date.now()}`); await i.press("Enter");
await page.waitForURL(/\/builder\/[^/?]+$/, { timeout: 60000 }); await page.waitForFunction(READY, undefined, { timeout: 90000 }); await page.waitForTimeout(1200);
// body > Hero(frame) > [Button, Text, Actions(frame) > [Button, Link]] , Features(frame), Footer(frame)
const ids = await page.evaluate(async () => {
  const st = window.__composition_STORE__.getState();
  const body = st.elements.find(e => e.type === "body" && e.page_id === st.currentPageId) ?? st.elements.find(e => e.type === "body");
  const now = new Date().toISOString();
  const mk = async (type, parent, order, props = {}) => { const id = crypto.randomUUID(); await st.addElement({ id, type, parent_id: parent, page_id: body.page_id, order_num: order, created_at: now, updated_at: now, props: { style: {}, ...props } }, { skipHistory: true }); return id; };
  const hero = await mk("frame", body.id, 1);
  const btn = await mk("Button", hero, 1, { children: "Primary action" });
  await mk("Text", hero, 2, { children: "Subtitle" });
  const actions = await mk("frame", hero, 3);
  await mk("Button", actions, 1, { children: "Get started" });
  await mk("Link", actions, 2, { children: "Learn more" });
  await mk("frame", body.id, 2);
  await mk("frame", body.id, 3);
  await new Promise(r => setTimeout(r, 900));
  const st2 = window.__composition_STORE__.getState(); st2.setSelectedElement(btn, st2.elements.find(e => e.id === btn)?.props);
  return { hero, btn, actions };
});
await page.waitForTimeout(800);
await page.getByRole("button", { name: "Navigator", exact: true }).first().click().catch(() => {}); await page.waitForTimeout(600);
const P = '[data-panel-id="navigator"]';
const M = (sel) => page.evaluate((sel) => Array.from(document.querySelectorAll(sel)).filter(el => el.getBoundingClientRect().width > 0).slice(0, 30).map(el => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return `${(el.getAttribute("aria-label") || el.className.toString()).slice(0, 36)} | ${Math.round(r.width)}×${Math.round(r.height)} @${Math.round(r.left)},${Math.round(r.top)} pl=${cs.paddingLeft} lvl=${el.style.getPropertyValue('--tree-item-level') || cs.getPropertyValue('--tree-item-level')}`; }), sel);
console.log("panel", JSON.stringify(await M(`${P} .panel-contents, ${P} .layer-tree, ${P} input, ${P} .react-aria-SearchField, ${P} .react-aria-Group`)));
console.log("items", JSON.stringify(await M(`${P} .react-aria-TreeItem`)));
console.log("elementItem", JSON.stringify(await M(`${P} .elementItem`)));
// 안쪽 frame 펼치기 (3번째 frame 행 = Actions)
const expanders = page.locator(`${P} .layer-expand-button`);
for (let k = 0; k < await expanders.count(); k++) { const e = expanders.nth(k); if ((await e.getAttribute("aria-label") ?? "").startsWith("Expand")) { await e.click(); await page.waitForTimeout(150); } }
await page.waitForTimeout(300);
console.log("guides", JSON.stringify(await page.evaluate((P) => Array.from(document.querySelectorAll(`${P} .react-aria-TreeItem`)).map(it => `${it.getAttribute("aria-label")}: ${Array.from(it.querySelectorAll('.layer-indent-guide')).map(g => g.dataset.active ? 'on' : 'off').join(',')}`), P)));
console.log("icons", JSON.stringify(await M(`${P} .elementItemIcon`)));
await page.locator(`${P} .panel-contents`).first().screenshot({ path: `${OUT}/nav.png` });
await page.locator(`${P} button[aria-label="Search pages"]`).click(); await page.waitForTimeout(400);
console.log("search", JSON.stringify(await M(`${P} .page-search-field, ${P} .page-search-field *`)));
await page.locator(`${P} .panel-contents`).first().screenshot({ path: `${OUT}/nav-search.png` });
await browser.close();
