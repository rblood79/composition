import { chromium } from "playwright";
import { resolve } from "node:path";
const READY = () => Boolean(window.__composition_STORE__ && window.__composition_STORE__.getState().currentPageId && document.querySelector(".app:not(.builder-booting)") && document.querySelector('[data-testid="skia-canvas-unified"]'));
const browser = await chromium.launch({ headless: false });
const ctx = await browser.newContext({ storageState: resolve("apps/builder/scripts/.auth-session.json"), viewport: { width: 1600, height: 1200 } });
const page = await ctx.newPage();
await page.goto("http://localhost:5173/dashboard", { waitUntil: "networkidle" });
const b = page.locator("button.dashboard-create-button").first(); await b.waitFor({ state: "visible", timeout: 15000 }); await b.click();
const i = page.locator("#new-project-name"); await i.waitFor({ state: "visible" }); await i.fill(`cdp-${Date.now()}`); await i.press("Enter");
await page.waitForURL(/\/builder\/[^/?]+$/, { timeout: 60000 }); await page.waitForFunction(READY, undefined, { timeout: 90000 }); await page.waitForTimeout(1200);
const panel = async (name, want) => { const btn = page.getByRole("button", { name, exact: true }).first(); const pressed = await btn.getAttribute("aria-pressed"); if ((pressed === "true") !== want) { await btn.click(); await page.waitForTimeout(400); } };
const P = '[data-panel-id="properties"]';
await panel("Components", true); await page.locator("button.list-item").filter({ has: page.locator(".list-item-name", { hasText: /^Button$/i }) }).first().click(); await page.waitForTimeout(800); await panel("Components", false); await panel("Properties", true); await page.waitForTimeout(400);
await page.evaluate((P) => { document.querySelectorAll(`${P} .section-caret[aria-expanded="false"]`).forEach((c) => c.click()); }, P); await page.waitForTimeout(600);
// CDP — DevTools 와 같은 이벤트 구독
const cdp = await ctx.newCDPSession(page);
await cdp.send("DOM.enable"); await cdp.send("CSS.enable");
const sheets = new Map(); // styleSheetId -> header
cdp.on("CSS.styleSheetAdded", ({ header }) => sheets.set(header.styleSheetId, header));
let changed = []; let added = 0, removed = 0;
cdp.on("CSS.styleSheetChanged", ({ styleSheetId }) => changed.push(styleSheetId));
cdp.on("CSS.styleSheetAdded", () => added++); cdp.on("CSS.styleSheetRemoved", () => removed++);
const { root } = await cdp.send("DOM.getDocument", { depth: 0 });
const bodyNodeId = (await cdp.send("DOM.querySelector", { nodeId: root.nodeId, selector: "body" })).nodeId;
const htmlNodeId = (await cdp.send("DOM.querySelector", { nodeId: root.nodeId, selector: "html" })).nodeId;
let attrMods = []; let fonts = 0, mq = 0, docUpd = 0, childIns = 0;
cdp.on("CSS.fontsUpdated", () => fonts++); cdp.on("CSS.mediaQueryResultChanged", () => mq++); cdp.on("DOM.documentUpdated", () => docUpd++);
cdp.on("DOM.childNodeInserted", (e) => { if (e.parentNodeId === bodyNodeId) childIns++; });
// DevTools 가 body 를 선택했을 때 하는 것과 같은 호출 — inline sheet 등록
await cdp.send("CSS.getMatchedStylesForNode", { nodeId: bodyNodeId }); await cdp.send("CSS.getMatchedStylesForNode", { nodeId: htmlNodeId }); await cdp.send("CSS.getInlineStylesForNode", { nodeId: bodyNodeId });
cdp.on("DOM.attributeModified", (e) => { if (e.nodeId === bodyNodeId || e.nodeId === htmlNodeId) attrMods.push(e); });
await page.waitForTimeout(800); changed = []; added = 0; removed = 0; attrMods = [];
const describe = async (id) => { const h = sheets.get(id); if (!h) return `${id}(unknown)`; let owner = ""; if (h.ownerNode) { try { const d = await cdp.send("DOM.describeNode", { backendNodeId: h.ownerNode }); const n = d.node; const attrs = n.attributes ?? []; const a = {}; for (let k = 0; k < attrs.length; k += 2) a[attrs[k]] = attrs[k+1]; owner = `${n.localName}${a.id ? "#" + a.id : ""}${a.class ? "." + a.class.split(" ").slice(0,2).join(".") : ""}${a["data-vite-dev-id"] ? "[vite:" + a["data-vite-dev-id"].split("/").pop() + "]" : ""}${a["data-rac"] != null ? "[data-rac]" : ""}`; } catch { owner = "?"; } } return `${h.isInline ? "INLINE " : ""}${h.origin} ${owner} ${h.sourceURL ? h.sourceURL.split("/").pop() : ""}`; };
const segs = page.locator(`${P} .react-aria-ToggleButton`);
for (const k of [0, 1, 6, 8]) {
  changed = []; added = 0; removed = 0; attrMods = []; fonts = 0; mq = 0; docUpd = 0; childIns = 0;
  const label = await segs.nth(k).getAttribute("aria-label") ?? (await segs.nth(k).textContent())?.trim();
  await segs.nth(k).click(); await page.waitForTimeout(900);
  const counts = {}; for (const id of changed) counts[id] = (counts[id] ?? 0) + 1;
  console.log(`\n[${label}] CSS.styleSheetChanged=${changed.length} added=${added} removed=${removed} html/body attr=${attrMods.map(a => a.name).join(",") || 0} fontsUpdated=${fonts} mediaQuery=${mq} documentUpdated=${docUpd} bodyChildInserted=${childIns}`);
  for (const [id, c] of Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 12)) console.log(`   ×${c}  ${await describe(id)}`);
}
// 대조군: 아무것도 안 하고 1초
changed = []; await page.waitForTimeout(1000); console.log(`\n[idle 1s] CSS.styleSheetChanged=${changed.length}`);
await browser.close();
