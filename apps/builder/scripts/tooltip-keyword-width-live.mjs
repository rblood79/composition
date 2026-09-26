// tooltip-keyword-width-live.mjs — 엔진 intrinsic 키워드 폭 (fit-content) 컨테이너의 padding 이중 가산 수리 live (2026-09-18).
//   사용: node apps/builder/scripts/tooltip-keyword-width-live.mjs  (dev 5173 · .auth-session.json · headed)
// Tooltip (implicitStyles 가 `width: fit-content` 주입 · catalog padding 6/10) 을 **row flex frame 안** (flex item —
//   수리 전 Skia 폭 = DOM + 20) 과 body 직계 (block — 대조군) 에 두고 Skia layout rect vs Preview DOM rect 를 잰다.
import { chromium } from "playwright";
import { resolve } from "node:path";
import { waitReady } from "./perf-baseline.mjs";
const BASE_URL = process.env.BUILDER_URL ?? "http://localhost:5173";
const STORAGE_STATE = resolve("apps/builder/scripts/.auth-session.json");
const log = (...a) => console.log("[tooltip live]", ...a);
const RAIL = ["navigator","components","datatable","datatableEditor","theme","ai","properties","styles","interactions","history"];
async function setPanel(page, id, open) {
  const b = page.locator(".panel-toggle-rail button").nth(RAIL.indexOf(id));
  if (((await b.getAttribute("aria-pressed")) === "true") !== open) { await b.click(); await page.waitForTimeout(900); }
}
async function addFromPalette(page, type, parentId) {
  await setPanel(page, "components", true);
  await page.evaluate((pid) => window.__composition_STORE__.getState().setSelectedElement(pid), parentId);
  const before = await page.evaluate(() => window.__composition_STORE__.getState().elements.map(e => e.id));
  const search = page.locator('[data-panel-id="components"] input').first();
  await search.waitFor({ state: "visible", timeout: 20000 });
  await search.fill(type); await page.waitForTimeout(400);
  const items = page.locator('[data-panel-id="components"] .list-item');
  if ((await items.count()) === 0) throw new Error("no palette " + type);
  await items.first().click();
  await page.waitForFunction((before) => window.__composition_STORE__.getState().elements.some(e => !before.includes(e.id)), before, { timeout: 15000 });
  await page.waitForTimeout(1500);
  await setPanel(page, "components", false);
  return page.evaluate((before) => {
    const st = window.__composition_STORE__.getState();
    const fresh = st.elements.filter(e => !before.includes(e.id));
    const ids = new Set(fresh.map(e => e.id));
    const root = fresh.find(e => !ids.has(e.parent_id));
    return { rootId: root.id, parent: root.parent_id, kids: fresh.filter(e => e.parent_id === root.id).map(e => e.id) };
  }, before);
}
const browser = await chromium.launch({ headless: false });
const context = await browser.newContext({ storageState: STORAGE_STATE, viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
const errors = []; page.on("pageerror", e => errors.push(String(e)));
try {
  await page.goto(`${BASE_URL}/dashboard`, { waitUntil: "networkidle" });
  const create = page.locator("button.dashboard-create-button").first();
  await create.waitFor({ state: "visible", timeout: 20000 }); await create.click();
  const input = page.locator("#new-project-name"); await input.waitFor({ state: "visible", timeout: 10000 });
  await input.fill(`tooltiplive-${Date.now()}`); await input.press("Enter");
  await page.waitForURL(/\/builder\/[^/?]+$/, { timeout: 90000 }); await waitReady(page);
  // row flex frame (사용자가 Frame 을 놓고 Layout 을 row 로 둔 형태)
  const frameId = await page.evaluate(async () => {
    const st = window.__composition_STORE__.getState();
    const body = st.elements.find(e => e.page_id === st.currentPageId && e.type === "body");
    const now = new Date().toISOString();
    const frame = { id: "tt-row-frame", type: "frame", parent_id: body.id, page_id: st.currentPageId, created_at: now, updated_at: now,
      props: { style: { display: "flex", flexDirection: "row", alignItems: "flex-start", width: "400px", padding: "8px", gap: "8px" } } };
    await st.addComplexElement(frame, []);
    await new Promise(r => setTimeout(r, 500));
    return frame.id;
  });
  const inFrame = await addFromPalette(page, "Tooltip", frameId);
  const onBody = await addFromPalette(page, "Tooltip", null);
  log("in-frame", JSON.stringify(inFrame), "on-body", JSON.stringify(onBody));
  if (inFrame.parent !== frameId) throw new Error("Tooltip 이 frame 자식으로 안 들어감: parent=" + inFrame.parent);
  const targets = [{ name: "frame>Tooltip", ids: [inFrame.rootId, ...inFrame.kids] }, { name: "body>Tooltip", ids: [onBody.rootId, ...onBody.kids] }];
  const skia = await page.evaluate((targets) => {
    const lm = window.__composition_LAYOUT_DEBUG__.getSharedLayoutMap();
    const r = (i) => { const l = lm?.get(i); return l ? [l.x, l.y, l.width, l.height].map(v => Math.round(v * 100) / 100) : null; };
    return targets.map(t => t.ids.map(r));
  }, targets);
  log("skia (부모 기준)", JSON.stringify(skia));
  // Preview 는 RAC Tooltip 을 TooltipTrigger 밖에서 그리지 않아 (standalone Tooltip DOM 0) DOM leg 가 없다 —
  //   DOM 진실은 `catalogComponentBox` Tooltip 케이스 (실 Chrome, 60 = 40 + padding 20). 여기서는 실제 빌더
  //   파이프라인의 Skia 값이 그 계약 (root = 자식 + padding 20 · flex item 과 block 자식이 같다) 을 지키는지 잰다.
  //   수리 전 실측: frame>Tooltip 89×44 (Δ+20) · body>Tooltip 69 인데 Description 29 (내부 content 가 20 모자람).
  const [[fRoot, fKid], [bRoot, bKid]] = skia;
  const bad = [];
  if (!fRoot || !fKid || !bRoot || !bKid) bad.push("layout map 누락");
  else {
    if (Math.abs(fRoot[2] - bRoot[2]) > 0.5) bad.push(`frame>Tooltip w ${fRoot[2]} ≠ body>Tooltip w ${bRoot[2]}`);
    if (Math.abs(fRoot[2] - (fKid[2] + 20)) > 0.5) bad.push(`frame>Tooltip w ${fRoot[2]} ≠ Description ${fKid[2]} + 20`);
    if (Math.abs(bRoot[2] - (bKid[2] + 20)) > 0.5) bad.push(`body>Tooltip w ${bRoot[2]} ≠ Description ${bKid[2]} + 20`);
    if (Math.abs(fKid[2] - bKid[2]) > 0.5) bad.push(`Description w frame ${fKid[2]} ≠ body ${bKid[2]}`);
    if (fKid[0] !== 10 || bKid[0] !== 10) bad.push(`Description x ≠ 10 (padding-left)`);
  }
  log(bad.length === 0 ? "PASS — Tooltip(fit-content) 폭 = Description + padding 20, flex item = block 자식, Description x 10" : "FAIL " + JSON.stringify(bad));
  log("pageerrors", errors.length);
} finally { await browser.close(); }
