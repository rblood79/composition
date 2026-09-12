import { chromium } from "playwright";
import { resolve } from "node:path";
const BASE_URL = "http://localhost:5173";
const OUT = process.env.OUT;
const READY = () => Boolean(window.__composition_STORE__ && window.__composition_STORE__.getState().currentPageId && document.querySelector(".app:not(.builder-booting)") && document.querySelector('[data-testid="skia-canvas-unified"]'));
const browser = await chromium.launch({ headless: false });
const ctx = await browser.newContext({ storageState: resolve("apps/builder/scripts/.auth-session.json"), viewport: { width: 1600, height: 2400 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
page.on("pageerror", (e) => console.error("[page error]", e.message));
await page.goto(`${BASE_URL}/dashboard`, { waitUntil: "networkidle" });
const btn = page.locator("button.dashboard-create-button").first();
await btn.waitFor({ state: "visible", timeout: 15_000 });
await btn.click();
const input = page.locator("#new-project-name");
await input.waitFor({ state: "visible", timeout: 10_000 });
await input.fill(`panel-ui-cap-${Date.now()}`);
await input.press("Enter");
await page.waitForURL(/\/builder\/[^/?]+$/, { timeout: 60_000 });
await page.waitForFunction(READY, undefined, { timeout: 90_000 });
await page.waitForTimeout(1500);

// select a Button element (or first non-body)
const sel = await page.evaluate(async () => {
  const st = window.__composition_STORE__.getState();
  const pageId = st.currentPageId;
  const all = st.elements;
  const body = all.find(e => e.type === "body" && e.page_id === pageId) ?? all.find(e => e.type === "body");
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  await st.addElement({ id, type: "Button", parent_id: body.id, page_id: body.page_id, order_num: 99, created_at: now, updated_at: now,
    props: { children: "Primary action", variant: "primary", style: { paddingLeft: "16px", paddingRight: "16px", borderRadius: "8px", backgroundColor: "#2563eb", color: "#ffffff", fontSize: "14px" } } }, { skipHistory: true });
  await new Promise(r => setTimeout(r, 800));
  const st2 = window.__composition_STORE__.getState();
  const el = st2.elements.find(e => e.id === id);
  st2.setSelectedElement(id, el?.props);
  return { total: all.length, pageId, bodyPage: body.page_id, id };
});
console.log("[select]", JSON.stringify(sel));
await page.waitForTimeout(600);

const openPanel = async (label) => {
  const b = page.getByRole("button", { name: label, exact: true }).first();
  await b.click();
  await page.waitForTimeout(500);
};
const shot = async (panelId, name) => {
  const p = page.locator(`[data-panel-id="${panelId}"]`).first();
  await p.evaluate((el) => {
    let n = el; for (let i = 0; i < 6 && n; i++) { n.style.height = "auto"; n.style.maxHeight = "none"; n.style.minHeight = "0"; n.style.overflow = "visible"; n = n.parentElement; }
    el.querySelectorAll(".panel-contents, .react-aria-TabPanel, [class*='contents']").forEach(c => { c.style.overflow = "visible"; c.style.height = "auto"; c.style.maxHeight = "none"; c.style.flex = "none"; });
  });
  await page.waitForTimeout(200);
  await p.screenshot({ path: `${OUT}/${name}.png` });
  console.log("[shot]", name);
};

for (const theme of ["light", "dark"]) {
  await page.evaluate((t) => document.documentElement.setAttribute("data-builder-theme", t), theme);
  await page.waitForTimeout(400);
  if (theme === "light") { await openPanel("Styles"); }
  const tabs = page.locator(".styles-panel-tab");
  const n = await tabs.count();
  console.log("[tabs]", n);
  for (let i = 0; i < n; i++) {
    await tabs.nth(i).click();
    await page.waitForTimeout(400);
    await shot("styles", `${theme}-styles-tab${i}`);
  }
  await tabs.nth(0).click();
  if (theme === "light") {
    await openPanel("Properties");
    await shot("properties", `${theme}-properties`);
    await openPanel("Properties");
    await openPanel("Navigator");
    await shot("navigator", `${theme}-navigator`);
    await openPanel("Navigator");
    await openPanel("Components");
    await shot("components", `${theme}-components`);
    await openPanel("Components");
    await openPanel("Theme");
    await shot("theme", `${theme}-theme`);
    await openPanel("Theme");
    await openPanel("Interactions");
    await shot("events", `${theme}-interactions`);
    await openPanel("Interactions");
  }
  await page.screenshot({ path: `${OUT}/${theme}-full.png` });
}
await browser.close();
