// DevTools 프론트엔드 자체에 붙어 Styles 패널 갱신 (update 호출) 과 그 원인 (수신 CDP 이벤트) 을 기록한다.
import { chromium } from "playwright";
import { resolve } from "node:path";
const PORT = 9444;
const READY = () => Boolean(window.__composition_STORE__ && window.__composition_STORE__.getState().currentPageId && document.querySelector(".app:not(.builder-booting)") && document.querySelector('[data-testid="skia-canvas-unified"]'));
import { spawn } from "node:child_process"; import { readFileSync, mkdtempSync } from "node:fs"; import { tmpdir } from "node:os"; import { join } from "node:path";
const udd = mkdtempSync(join(tmpdir(), "dvhook-"));
const chrome = spawn("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", [`--remote-debugging-port=${PORT}`, "--remote-allow-origins=*", `--user-data-dir=${udd}`, "--no-first-run", "--no-default-browser-check", "--window-size=1500,1100", "about:blank"], { stdio: "ignore" }); process.on("exit", () => { try { chrome.kill(); } catch {} }); process.on("uncaughtException", (e) => { console.error(e); try { chrome.kill(); } catch {} process.exit(1); });
let wsUrl; for (let k = 0; k < 60; k++) { try { const v = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json(); wsUrl = v.webSocketDebuggerUrl; break; } catch {} await new Promise((r) => setTimeout(r, 300)); }
console.log("ws", wsUrl);
const browser = await chromium.connectOverCDP(wsUrl);
const ctx = browser.contexts()[0]; const page = ctx.pages()[0] ?? (await ctx.newPage());
console.log("chrome", browser.version());
page.on("framenavigated", (f) => { if (f === page.mainFrame()) console.log("!! framenavigated", f.url().slice(0, 80)); });
page.on("console", (m) => { if (m.type() === "error" || /vite|reload|boot/i.test(m.text())) console.log("!! console", m.type(), m.text().slice(0, 140)); });
page.on("pageerror", (e) => console.log("!! pageerror", String(e).slice(0, 140)));
const auth = JSON.parse(readFileSync(resolve("apps/builder/scripts/.auth-session.json"), "utf8"));
await page.goto("http://localhost:5173/", { waitUntil: "domcontentloaded" });
await page.evaluate((entries) => { for (const e of entries) localStorage.setItem(e.name, e.value); }, auth.origins[0].localStorage);
await page.evaluate(() => { window.addEventListener("vite:beforeFullReload", () => console.log("vite full reload")); }); await page.goto("http://localhost:5173/dashboard", { waitUntil: "networkidle" });
const b = page.locator("button.dashboard-create-button").first(); await b.waitFor({ state: "visible", timeout: 15000 }); await b.click();
const i = page.locator("#new-project-name"); await i.waitFor({ state: "visible" }); await i.fill(`dv-${Date.now()}`); await i.press("Enter");
await page.waitForURL(/\/builder\/[^/?]+$/, { timeout: 60000 }); await page.waitForFunction(READY, undefined, { timeout: 90000 }); await page.waitForTimeout(1200);
const panel = async (name, want) => { const btn = page.getByRole("button", { name, exact: true }).first(); const pressed = await btn.getAttribute("aria-pressed"); if ((pressed === "true") !== want) { await btn.click(); await page.waitForTimeout(400); } };
const P = '[data-panel-id="properties"]';
const add = async (loc) => { await panel("Components", true); await loc.first().click({ timeout: 15000 }); await page.waitForTimeout(1500); await panel("Components", false); };
await add(page.locator("button.list-item").filter({ has: page.locator(".list-item-name", { hasText: /^Button$/i }) }));
await add(page.locator('[data-component-type="Chart"], button.list-item:has-text("차트"), button.list-item:has-text("Chart")'));
await page.evaluate(() => { const s = window.__composition_STORE__.getState(); s.setSelectedElement(s.elements.find(e => e.type === "Button").id); }); await page.waitForTimeout(600);
await panel("Properties", true); await page.evaluate((P) => { document.querySelectorAll(`${P} .section-caret[aria-expanded="false"]`).forEach((c) => c.click()); }, P); await page.waitForTimeout(600);

// ---- raw CDP (browser endpoint) ----
const ws = new WebSocket(wsUrl); await new Promise((r) => (ws.onopen = r));
let seq = 0; const pending = new Map(); const listeners = [];
ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } else listeners.forEach((l) => l(m)); };
const send = (method, params = {}, sessionId) => new Promise((res, rej) => { const id = ++seq; pending.set(id, (m) => (m.error ? rej(new Error(method + ": " + JSON.stringify(m.error))) : res(m.result))); ws.send(JSON.stringify({ id, method, params, sessionId })); });
const targets = (await send("Target.getTargets")).targetInfos;
const pageT = targets.find((t) => t.type === "page" && /localhost:5173\/builder/.test(t.url));
console.log("page target", pageT.targetId);
const dtUrl = `devtools://devtools/bundled/devtools_app.html?ws=127.0.0.1:${PORT}/devtools/page/${pageT.targetId}`; console.log("devtools url", dtUrl);
const { targetId: dtId } = await send("Target.createTarget", { url: dtUrl, newWindow: true });
const { sessionId: dt } = await send("Target.attachToTarget", { targetId: dtId, flatten: true });
await send("Runtime.enable", {}, dt); await send("Page.enable", {}, dt);
const evalDT = async (expression) => { const r = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true }, dt); if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails).slice(0, 600)); return r.result.value; };
// DevTools 로드 대기
let ready = false; for (let k = 0; k < 60; k++) { try { const st = await evalDT(`(async () => { const sdk = await import('./core/sdk/sdk.js'); const tm = sdk.TargetManager.TargetManager.instance(); const t = tm.primaryPageTarget(); return JSON.stringify({ targets: tm.targets().length, primary: Boolean(t), dom: Boolean(t && t.model(sdk.DOMModel.DOMModel)) }); })()`); if (k % 10 === 0) console.log("devtools state", st); if (JSON.parse(st).dom) { ready = true; break; } } catch (e) { if (k % 10 === 0) console.log("devtools eval err", String(e).slice(0, 120)); } await new Promise((r) => setTimeout(r, 500)); }
if (!ready) { console.log("DevTools 가 페이지에 연결되지 않음"); await browser.close(); chrome.kill(); process.exit(1); }
console.log("devtools frontend attached:", await evalDT("location.href.slice(0, 60)"));
// 훅 설치: Styles 패널 update + ComputedStyleModel 원인 + 수신 이벤트 로그
await evalDT(`(async () => {
  const sdk = await import('./core/sdk/sdk.js'); const common = await import('./core/common/common.js');
  const elements = await import('./panels/elements/elements.js'); const cs = await import('./models/computed_style/computed_style.js');
  const pc = await import('./core/protocol_client/protocol_client.js');
  globalThis.__log = { updates: [], events: [], mut: [], mutNodes: [] };
  const desc = (n) => n ? (n.nodeName() + (n.getAttribute?.('id') ? '#' + n.getAttribute('id') : '') + (n.getAttribute?.('class') ? '.' + n.getAttribute('class').split(' ').slice(0,2).join('.') : '')) : '?';
  // 1) 수신 이벤트 (Protocol monitor 와 같은 것)
  pc.InspectorBackend.test.onMessageReceived = (msg) => { if (msg && msg.method && /^(DOM|CSS|Page\\.frameResized)/.test(msg.method)) __log.events.push(msg.method + ' ' + JSON.stringify(msg.params ?? {}).slice(0, 90)); };
  // 2) DOMMutated 로 판정에 들어가는 노드
  const DM = sdk.DOMModel.DOMModel.prototype; const orig = DM.scheduleMutationEvent; DM.scheduleMutationEvent = function (node) { __log.mut.push(desc(node)); __log.mutNodes.push(node); return orig.call(this, node); };
  // 3) ComputedStyleModel: 어떤 경로로 갱신을 부르는지
  const CM = cs.ComputedStyleModel.ComputedStyleModel.prototype;
  for (const name of ['onCSSModelChanged', 'onDOMModelChanged', 'onFrameResized', 'onComputedStyleChanged']) { const o = CM[name]; if (!o) continue; CM[name] = function (ev) { const sel = this.node ? this.node() : null; const via = name === 'onDOMModelChanged' ? ' mutated=' + desc(ev && ev.data) : name === 'onCSSModelChanged' ? ' cssEvent=' + (ev ? (ev.type ?? '?') : 'null(from DOM)') : ''; const before = __log.updates.length; const r = o.call(this, ev); __log.updates.push('[' + name + '] selected=' + desc(sel) + via + (r === undefined ? '' : '')); return r; }; }
  // 4) Styles 패널 실제 update 호출
  const SP = elements.StylesSidebarPane.StylesSidebarPane.prototype; const ou = SP.update; SP.update = function () { const n = this.node ? this.node() : null; __log.updates.push('STYLES.update selected=' + desc(n)); return ou.call(this); };
  return 'hooked';
})()`);
const selectInDevTools = async (selector) => evalDT(`(async () => { const sdk = await import('./core/sdk/sdk.js'); const common = await import('./core/common/common.js'); const dm = sdk.TargetManager.TargetManager.instance().primaryPageTarget().model(sdk.DOMModel.DOMModel); const doc = await dm.requestDocument(); const id = await dm.querySelector(doc.id, ${JSON.stringify(selector)}); const node = dm.nodeForId(id); await common.Revealer.reveal(node); await new Promise(r => setTimeout(r, 800)); return node.nodeName() + ' ' + (node.getAttribute('class') ?? ''); })()`);
const readLog = () => evalDT(`(async () => { const sdk = await import('./core/sdk/sdk.js'); const dm = sdk.TargetManager.TargetManager.instance().primaryPageTarget().model(sdk.DOMModel.DOMModel); const doc = await dm.requestDocument();
  const sels = {}; for (const [k, q] of Object.entries({ body: 'body', root: '#root', app: '#root > .app', pwh: '.panel-workspace-host' })) { const id = await dm.querySelector(doc.id, q); sels[k] = id ? dm.nodeForId(id) : null; }
  const related = (m, s) => Boolean(m && s) && (m === s || (m.parentNode && m.parentNode === s.parentNode) || m.isAncestor(s));
  const desc = (n) => n ? (n.nodeName() + (n.getAttribute?.('id') ? '#' + n.getAttribute('id') : '') + (n.getAttribute?.('class') ? '.' + n.getAttribute('class').split(' ').slice(0,2).join('.') : '')) : '?';
  const l = globalThis.__log; const verdict = {}; for (const [k, s] of Object.entries(sels)) verdict[k] = [...new Set(l.mutNodes.filter((m) => related(m, s)).map(desc))].slice(0, 5);
  const out = { updates: l.updates.slice(), events: l.events.slice(0, 25), eventsTotal: l.events.length, mut: [...new Set(l.mut)].slice(0, 12), mutTotal: l.mut.length, verdict, cssLevel: l.events.filter((e) => /^CSS\.(styleSheet|fonts|mediaQuery)/.test(e)).length };
  l.updates.length = 0; l.events.length = 0; l.mut.length = 0; l.mutNodes.length = 0; return out; })()`);
const trial = async (label, action) => { await page.waitForFunction(READY, undefined, { timeout: 60000 }); await page.waitForTimeout(700); await readLog(); await action(); await page.waitForTimeout(1200); const l = await readLog(); console.log(`\n=== ${label}\n  수신 이벤트 ${l.eventsTotal} (CSS 수준 = 모든 노드 갱신: ${l.cssLevel})`); l.events.forEach((e) => console.log("     ", e)); console.log(`  DOMMutated 노드 ${l.mutTotal}: ${l.mut.join(" | ")}`); console.log(`  선택 노드별 Styles 갱신 원인:`, JSON.stringify(l.verdict)); };
const segClick = (t) => page.locator(`${P} .react-aria-ToggleButton`).filter({ hasText: new RegExp(`^${t}$`) }).first().click();
// 가설 검증: 패널 안 input / ToggleButton 을 한 번 DevTools 에서 선택 (inline sheet 등록) → body 로 복귀 → 변경
console.log("\n##### [가설] 패널 input 을 한 번 선택 후 body 로 복귀");
console.log("   선택:", await selectInDevTools('[data-panel-id="properties"] input.react-aria-Input'));
console.log("   선택:", await selectInDevTools('[data-panel-id="properties"] .react-aria-ToggleButton'));
console.log("   복귀:", await selectInDevTools("body"));
await trial("Properties size seg 클릭 (body 선택, input 등록됨)", () => segClick("XS"));
await trial("Properties size seg 클릭 (2)", () => segClick("L"));
await trial("캔버스 선택 (store)", () => page.evaluate(() => { const s = window.__composition_STORE__.getState(); s.setSelectedElement(s.elements.find(e => e.type === "Chart").id); }));
console.log("   pwh 선택:", await selectInDevTools(".panel-workspace-host"));
await trial("Properties(Chart) seg 클릭 (pwh 선택)", () => page.locator(`${P} .react-aria-ToggleButton`).nth(1).click());
await browser.close(); chrome.kill(); process.exit(0);
for (const sel of ["body", "#root", "#root > .app", ".panel-workspace-host"]) {
  console.log(`\n##### DevTools 에서 선택: ${await selectInDevTools(sel)}`);
  await trial("Properties size seg 클릭", () => segClick("XS"));
  await trial("Properties size seg 클릭 (2)", () => segClick("L"));
  await trial("캔버스 선택 (store)", () => page.evaluate(() => { const s = window.__composition_STORE__.getState(); s.setSelectedElement(s.elements.find(e => e.type === "Chart").id); }));
  await trial("캔버스 선택 되돌림 (store)", () => page.evaluate(() => { const s = window.__composition_STORE__.getState(); s.setSelectedElement(s.elements.find(e => e.type === "Button").id); }));
}
await browser.close(); chrome.kill();
