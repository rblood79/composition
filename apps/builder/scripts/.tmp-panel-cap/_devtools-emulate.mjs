import { chromium } from "playwright";
import { resolve } from "node:path";
const READY = () => Boolean(window.__composition_STORE__ && window.__composition_STORE__.getState().currentPageId && document.querySelector(".app:not(.builder-booting)") && document.querySelector('[data-testid="skia-canvas-unified"]'));
const browser = await chromium.launch({ headless: false });
const ctx = await browser.newContext({ storageState: resolve("apps/builder/scripts/.auth-session.json"), viewport: { width: 1600, height: 1200 } });
const page = await ctx.newPage();
await page.goto("http://localhost:5173/dashboard", { waitUntil: "networkidle" });
const b = page.locator("button.dashboard-create-button").first(); await b.waitFor({ state: "visible", timeout: 15000 }); await b.click();
const i = page.locator("#new-project-name"); await i.waitFor({ state: "visible" }); await i.fill(`dt-${Date.now()}`); await i.press("Enter");
await page.waitForURL(/\/builder\/[^/?]+$/, { timeout: 60000 }); await page.waitForFunction(READY, undefined, { timeout: 90000 }); await page.waitForTimeout(1200);
const panel = async (name, want) => { const btn = page.getByRole("button", { name, exact: true }).first(); const pressed = await btn.getAttribute("aria-pressed"); if ((pressed === "true") !== want) { await btn.click(); await page.waitForTimeout(400); } };
const P = '[data-panel-id="properties"]';
await panel("Components", true); await page.locator("button.list-item").filter({ has: page.locator(".list-item-name", { hasText: /^Button$/i }) }).first().click(); await page.waitForTimeout(800); await panel("Components", false); await panel("Properties", true); await page.waitForTimeout(400);
await page.evaluate((P) => { document.querySelectorAll(`${P} .section-caret[aria-expanded="false"]`).forEach((c) => c.click()); }, P); await page.waitForTimeout(600);

const cdp = await ctx.newCDPSession(page);
await cdp.send("DOM.enable"); await cdp.send("CSS.enable");
const nodes = new Map(); // nodeId -> {desc, parentId}
const d = (n) => { const a = {}; for (let k = 0; k < (n.attributes ?? []).length; k += 2) a[n.attributes[k]] = n.attributes[k + 1]; return `${n.nodeName.toLowerCase()}${a.id ? "#" + a.id : ""}${a.class ? "." + a.class.split(" ").slice(0, 2).join(".") : ""}`; };
const register = (n, parentId) => { nodes.set(n.nodeId, { desc: d(n), parentId }); (n.children ?? []).forEach((c) => register(c, n.nodeId)); (n.pseudoElements ?? []).forEach((c) => register(c, n.nodeId)); };
cdp.on("DOM.setChildNodes", ({ parentId, nodes: ns }) => ns.forEach((n) => register(n, parentId)));
const events = [];
const rec = (type, nodeId, extra = "") => events.push({ type, nodeId, desc: nodes.get(nodeId)?.desc ?? `?${nodeId}`, parentId: nodes.get(nodeId)?.parentId, extra });
cdp.on("DOM.attributeModified", (e) => rec("attributeModified", e.nodeId, `${e.name}=${e.value.slice(0, 40)}`));
cdp.on("DOM.attributeRemoved", (e) => rec("attributeRemoved", e.nodeId, e.name));
cdp.on("DOM.characterDataModified", (e) => rec("characterDataModified", e.nodeId));
cdp.on("DOM.childNodeCountUpdated", (e) => rec("childNodeCountUpdated", e.nodeId, String(e.childNodeCount)));
cdp.on("DOM.childNodeInserted", (e) => { register(e.node, e.parentNodeId); rec("childNodeInserted", e.node.nodeId); });
cdp.on("DOM.childNodeRemoved", (e) => rec("childNodeRemoved", e.nodeId, `parent=${nodes.get(e.parentNodeId)?.desc}`));
cdp.on("DOM.inlineStyleInvalidated", (e) => e.nodeIds.forEach((id) => rec("inlineStyleInvalidated", id)));
cdp.on("DOM.pseudoElementAdded", (e) => { register(e.pseudoElement, e.parentId); rec("pseudoElementAdded", e.pseudoElement.nodeId, `parent=${nodes.get(e.parentId)?.desc}`); });
cdp.on("DOM.pseudoElementRemoved", (e) => rec("pseudoElementRemoved", e.pseudoElementId, `parent=${nodes.get(e.parentId)?.desc}`));
let sheet = 0; cdp.on("CSS.styleSheetChanged", () => sheet++); cdp.on("CSS.styleSheetAdded", () => sheet++); cdp.on("CSS.fontsUpdated", () => sheet++); cdp.on("CSS.mediaQueryResultChanged", () => sheet++);
let resized = 0; cdp.on("Page.frameResized", () => resized++); await cdp.send("Page.enable");

// DevTools 처럼: 문서 depth 2 → body, #root, .app 를 순서대로 펼침 (pwh 는 접힘)
const { root } = await cdp.send("DOM.getDocument", { depth: 2 }); register(root, 0);
const q = async (sel) => (await cdp.send("DOM.querySelector", { nodeId: root.nodeId, selector: sel })).nodeId;
const ids = { html: await q("html"), body: await q("body"), root: await q("#root"), app: await q("#root > .app"), pwh: await q(".panel-workspace-host") };
for (const id of [ids.body, ids.root, ids.app]) { await cdp.send("DOM.requestChildNodes", { nodeId: id, depth: 1 }); }
await cdp.send("CSS.getMatchedStylesForNode", { nodeId: ids.body });
const isAncestor = (a, b) => { let c = nodes.get(b)?.parentId; while (c) { if (c === a) return true; c = nodes.get(c)?.parentId; } return false; };
const related = (m, sel) => m === sel || (nodes.get(m)?.parentId != null && nodes.get(m)?.parentId === nodes.get(sel)?.parentId) || isAncestor(m, sel);
const run = async (label, clickText) => {
  await page.waitForTimeout(600); events.length = 0; sheet = 0; resized = 0;
  await page.locator(`${P} .react-aria-ToggleButton`).filter({ hasText: new RegExp(`^${clickText}$`) }).first().click(); await page.waitForTimeout(900);
  const c = {}; for (const e of events) { const k = `${e.type} ${e.desc} ${e.extra}`.trim(); c[k] = (c[k] ?? 0) + 1; }
  console.log(`\n=== ${label} (click ${clickText}): DOM events ${events.length}, css/font/media events ${sheet}, frameResized ${resized}`);
  for (const [k, v] of Object.entries(c).sort((a, b) => b[1] - a[1]).slice(0, 14)) console.log(`   ×${v} ${k}`);
  const verdict = {}; for (const [name, sel] of Object.entries(ids)) verdict[name] = events.filter((e) => related(e.nodeId, sel)).map((e) => `${e.type}:${e.desc}`).filter((v, i, a) => a.indexOf(v) === i).slice(0, 5);
  console.log("   Styles 갱신 판정 (선택 노드 → 갱신을 부르는 변경):", JSON.stringify(verdict));
};
let fontsUpd = 0; cdp.on("CSS.fontsUpdated", () => fontsUpd++);
await run("Chart 없음", "XS");
// Chart 추가
await panel("Components", true); await page.locator('[data-component-type="Chart"], button.list-item:has-text("차트"), button.list-item:has-text("Chart")').first().click({ timeout: 15000 }); await page.waitForTimeout(2500); await panel("Components", false); await panel("Properties", true); await page.waitForTimeout(600);
console.log("\nChart 추가됨:", await page.evaluate(() => window.__composition_STORE__.getState().elements.filter(e => e.type === "Chart").length), "fontsUpdated(추가 중)", fontsUpd); fontsUpd = 0;
const runSel = async (label, type) => { await page.waitForTimeout(600); events.length = 0; sheet = 0; resized = 0; fontsUpd = 0;
  await page.evaluate((t) => { const s = window.__composition_STORE__.getState(); s.setSelectedElement(s.elements.find(e => e.type === t).id); }, type); await page.waitForTimeout(1200);
  const c = {}; for (const e of events) { const k = `${e.type} ${e.desc} ${e.extra}`.trim(); c[k] = (c[k] ?? 0) + 1; }
  console.log(`\n=== ${label}: DOM events ${events.length}, css/font/media ${sheet} (fontsUpdated ${fontsUpd}), frameResized ${resized}`);
  for (const [k, v] of Object.entries(c).sort((a, b) => b[1] - a[1]).slice(0, 8)) console.log(`   ×${v} ${k}`);
  const verdict = {}; for (const [name, sel] of Object.entries(ids)) verdict[name] = events.filter((e) => related(e.nodeId, sel)).map((e) => `${e.type}:${e.desc}`).filter((v, i, a) => a.indexOf(v) === i).slice(0, 5);
  console.log("   판정:", JSON.stringify(verdict)); };
await runSel("Chart 선택 (pwh 접힘)", "Chart");
await runSel("Button 선택 (pwh 접힘)", "Button");
await run("Chart 있음 · Button seg (pwh 접힘)", "S");
await cdp.send("DOM.requestChildNodes", { nodeId: ids.pwh, depth: -1 }); await page.waitForTimeout(800);
await run("Chart 있음 · Button seg (pwh 펼침)", "M");
await runSel("Chart 선택 (pwh 펼침)", "Chart");
await page.waitForTimeout(500); events.length = 0; fontsUpd = 0; sheet = 0; await page.waitForTimeout(3000); console.log(`\n=== 유휴 3초: DOM events ${events.length}, css/font/media ${sheet}, fontsUpdated ${fontsUpd}`);
await browser.close();
