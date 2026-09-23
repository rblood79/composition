#!/usr/bin/env node
// adr234-live-exercise.mjs — ADR-234 Phase 4 live (Skia layout · store · IndexedDB, Compare Mode · Preview 없음).
//   L1) 항목 origin 편집 (Tab/Default paddingLeft 12 → 24, 영향 대화상자 적용) → Components 의 origin · 휴지 변형 ·
//       문서 Tabs instance 의 Tab 폭이 모두 +12 (한 편집이 체인 끝까지)
//   L2) 휴지 변형 편집 (`--unselected` paddingRight 30) → 선택 안 된 Tab 만 바뀌고 선택 Tab 은 그대로
//   L3) 문서 Tabs instance 의 TabList (synthetic) 선택 → Slot "+" → Tab 3 + TabPanel 짝 (descendants mode C)
//   L4) reload → store 스냅샷 · Tab 수 그대로
// 사용: node apps/builder/scripts/adr234-live-exercise.mjs [--base http://localhost:5173]
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";
import {
  waitReady,
  createInstrumentedContext,
  loadStorageState,
  createIsolatedProject,
  openPanels,
} from "./perf-baseline.mjs";

const args = process.argv.slice(2);
const BASE = args.includes("--base") ? args[args.indexOf("--base") + 1] : "http://localhost:5173";
const OUT_DIR = "/private/tmp/adr234-live";
mkdirSync(OUT_DIR, { recursive: true });
const findings = [];
const record = (name, pass, detail) => {
  findings.push({ name, pass, detail });
  console.log(`[adr234 live] ${pass ? "PASS" : "FAIL"} — ${name} :: ${JSON.stringify(detail)}`);
};

const browser = await chromium.launch({ headless: false });
const { page } = await createInstrumentedContext(browser, {
  storageState: loadStorageState(resolve("apps/builder/scripts/.auth-session.json")),
  cpuThrottle: 1,
  deviceScaleFactor: 1,
});
const errors = [];
page.on("pageerror", (e) => errors.push(String(e.stack ?? e).slice(0, 1200)));
const { projectUrl } = await createIsolatedProject(page, BASE);
await page.waitForTimeout(1500);

const INST = "live-tabs";
// 문서 Tabs instance (palette 모양 — ref · props {}).
await page.evaluate(async (INST) => {
  const st = window.__composition_STORE__.getState();
  const body = st.elements.find((e) => e.type === "body" && e.page_id === st.currentPageId);
  const now = new Date().toISOString();
  await st.addComplexElement(
    {
      id: INST,
      customId: INST,
      type: "ref",
      ref: "component-tabs",
      componentName: "Tabs",
      parent_id: body.id,
      page_id: st.currentPageId,
      order_num: 0,
      created_at: now,
      updated_at: now,
      props: { style: { width: "400px" } },
    },
    [],
  );
  st.setSelectedElement(null);
}, INST);
await page.waitForTimeout(2000);

/** 보이는 페이지의 layout 폭 — Tab 들. */
const tabWidths = (prefix) =>
  page.evaluate((prefix) => {
    const map = window.__composition_LAYOUT_DEBUG__.getSharedLayoutMap();
    const out = {};
    for (const [id, r] of map) {
      if (id.startsWith(prefix) && /__tab-\d+$/.test(id)) out[id] = Math.round(r.width);
    }
    return out;
  }, prefix);
const showPage = async (pageId) => {
  await page.evaluate((pageId) => {
    const st = window.__composition_STORE__.getState();
    const id = pageId ?? st.pages.find((p) => p.id !== "page-components")?.id;
    st.setCurrentPageId(id);
    const f = window.__composition_SCENE_DEBUG__.readPageFrames().find((x) => x.id === id);
    if (f) window.__composition_APPLY_VIEWPORT__({ scale: 0.6, x: -f.x * 0.6 + 40, y: -f.y * 0.6 + 60 });
  }, pageId);
  await page.waitForTimeout(2000);
};
const variantWidth = () =>
  page.evaluate(() => {
    const map = window.__composition_LAYOUT_DEBUG__.getSharedLayoutMap();
    const w = (id) => Math.round(map.get(id)?.width ?? -1);
    return {
      origin: w("component-tab-item-default"),
      unselected: w("component-tab-item-default--unselected"),
    };
  });
const editOrigin = async (id, patch) => {
  await page.evaluate(
    ({ id, patch }) => {
      const st = window.__composition_STORE__.getState();
      const el = st.elements.find((e) => e.id === id);
      st.updateElement(id, {
        props: { ...el.props, style: { ...(el.props?.style ?? {}), ...patch } },
      });
    },
    { id, patch },
  );
  // 영향 대화상자 (instance 가 있는 origin) — 적용.
  for (let i = 0; i < 20; i += 1) {
    const btns = page.locator(".editing-impact-actions button");
    if ((await btns.count()) > 0) {
      await btns.last().click();
      break;
    }
    await page.waitForTimeout(100);
  }
  await page.waitForTimeout(2000);
};

// 기준
await showPage(null);
const docBefore = await tabWidths(`${INST}/`);
await showPage("page-components");
const compBefore = await variantWidth();

// L1 — origin 편집
await editOrigin("component-tab-item-default", { paddingLeft: 24 });
const compAfterL1 = await variantWidth();
await showPage(null);
const docAfterL1 = await tabWidths(`${INST}/`);
const docDelta = Object.keys(docBefore).map((k) => (docAfterL1[k] ?? 0) - docBefore[k]);
record("L1 origin 편집 → origin · 휴지 변형 · 문서 instance Tab 모두 +12", compAfterL1.origin - compBefore.origin === 12 && compAfterL1.unselected - compBefore.unselected === 12 && docDelta.length > 0 && docDelta.every((d) => d === 12), { compBefore, compAfterL1, docBefore, docAfterL1 });

// L2 — 휴지 변형 편집 (선택 안 된 Tab 만)
await showPage("page-components");
await editOrigin("component-tab-item-default--unselected", { paddingRight: 30 });
const compAfterL2 = await variantWidth();
await showPage(null);
const docAfterL2 = await tabWidths(`${INST}/`);
const sel = await page.evaluate((INST) => {
  const st = window.__composition_STORE__.getState();
  return st.elements.find((e) => e.id === "component-tabs")?.props?.defaultSelectedKey ?? null;
}, INST);
const keys = Object.keys(docAfterL2).sort();
const d2 = keys.map((k) => docAfterL2[k] - docAfterL1[k]);
record("L2 휴지 변형 편집 → 선택 안 된 Tab 만 +18 (paddingRight 12 → 30), 선택 Tab · origin 그대로", compAfterL2.origin === compAfterL1.origin && compAfterL2.unselected - compAfterL1.unselected === 18 && d2.filter((d) => d === 18).length === keys.length - 1 && d2.filter((d) => d === 0).length === 1, { sel, docAfterL1, docAfterL2, compAfterL2 });

// L3 — instance TabList "+"
const listId = `${INST}/component-tabs__1`;
await page.evaluate((listId) => {
  const s = window.__composition_STORE__.getState();
  s.setSelectedElement(listId, {}, {}, {});
}, listId);
await page.waitForTimeout(800);
await openPanels(page, ["Properties"]);
await page.waitForTimeout(1200);
const insertButtons = await page
  .locator('button[aria-label^="Insert "]')
  .evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")));
const target = insertButtons.find((l) => !/unselected/i.test(l)) ?? insertButtons[0];
if (target) {
  await page.locator(`button[aria-label="${target}"]`).first().click();
  await page.waitForTimeout(2000);
}
await page.evaluate(() => window.__composition_STORE__.getState().setSelectedElement(null));
await page.waitForTimeout(800);
const inst = await page.evaluate((INST) => {
  const st = window.__composition_STORE__.getState();
  const e = st.elements.find((x) => x.id === INST);
  return e?.descendants ?? null;
}, INST);
const docAfterL3 = await tabWidths(`${INST}/`);
const listPatch = inst?.["component-tabs__1"]?.children ?? [];
const panelPatch = inst?.["component-tabs__2"]?.children ?? [];
const newKey = listPatch[listPatch.length - 1]?.props?.id;
record("L3 instance TabList Slot + → Tab 3 + TabPanel 짝 (descendants mode C) · Canvas Tab 3", listPatch.length === 3 && panelPatch.length === 3 && panelPatch[2]?.props?.itemId === newKey && Object.keys(docAfterL3).length === 3, { insertButtons, target, listIds: listPatch.map((c) => c.id), panelItemIds: panelPatch.map((c) => c.props?.itemId), docAfterL3 });

// L4 — reload
const snap = () =>
  page.evaluate((INST) => {
    const st = window.__composition_STORE__.getState();
    const pick = (id) => {
      const e = st.elements.find((x) => x.id === id);
      return e ? JSON.stringify({ props: e.props, d: e.descendants ?? null }) : null;
    };
    return [pick(INST), pick("component-tab-item-default"), pick("component-tab-item-default--unselected")].join("|");
  }, INST);
const s1 = await snap();
await page.waitForTimeout(3000);
await page.goto(projectUrl, { waitUntil: "networkidle" });
await waitReady(page);
await page.waitForTimeout(2000);
await showPage(null);
const s2 = await snap();
const docAfterReload = await tabWidths(`${INST}/`);
record("L4 reload → instance · origin · 변형 그대로 · Canvas Tab 3 같은 폭", s1 === s2 && JSON.stringify(docAfterReload) === JSON.stringify(docAfterL3), { docAfterReload });
await page.screenshot({ path: resolve(OUT_DIR, "after-reload.png") });

record("page error 0", errors.length === 0, errors.slice(0, 5));
writeFileSync(resolve(OUT_DIR, "live.json"), JSON.stringify(findings, null, 2));
await browser.close();
console.log(`[adr234 live] ${findings.filter((f) => f.pass).length}/${findings.length}`);
