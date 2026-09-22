#!/usr/bin/env node
// adr233-tab-radio-live.mjs — ADR-233 Phase 3 G2 live (실제 빌더, headed Playwright · Skia/store 만).
//   Compare Mode / Preview iframe 은 열지 않는다 (사용자 지시 2026-09-22 ×3) — Preview 축은 unit 고정.
//   L1) 신규 프로젝트 seed — Tab/Default·Tab/Selected (+ label Text) · component-tabs.slot ·
//       component-radio (+ Label) · Radio 상태 변형 5 · 새 component-radiogroup 의 Radio 자식 = ref
//   L2) 기준값 — Tabs instance Tab 행 3 (templateOriginId 반영) · RadioGroup instance Radio 2 (type Radio)
//   L3) Tab/Default root padding 24/10 → Tab 행 rect 폭 +24 · 높이 +12 · TabPanel 이 Tab 행 아래 (겹침 0)
//   L4) Tab/Default label fontWeight 700 → Tab 행 텍스트 fontWeight 700 · 행 폭 증가
//   L5) Tab/Selected fills → 선택된 Tab 행 픽셀만 Δ (다른 Tab 행 불변)
//   L6) component-radio opacity → instance Radio 두 개 픽셀 Δ (fills 는 관찰만 — Radio fills 의 기존 비대칭)
//   L6b) component-radio paddingLeft → instance Radio rect 폭 Δ (레이아웃 전파)
//   L7) Radio/Selected opacity → 선택된 Radio 만 픽셀 Δ (다른 Radio 불변)
//   L8) reload → origin 편집 보존 · Components body 순서 Δ0 (재hydration 멱등)
//   page error 0 · dialog 0
// 사용: node apps/builder/scripts/adr233-tab-radio-live.mjs  (dev 5173 · .auth-session.json)
import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { waitReady } from "./perf-baseline.mjs";

const require = createRequire(import.meta.url);
const { PNG } = require(
  resolve("node_modules/.pnpm/pngjs@7.0.0/node_modules/pngjs"),
);

const BASE_URL = "http://localhost:5173";
const STORAGE_STATE = resolve("apps/builder/scripts/.auth-session.json");
const OUT_DIR = process.env.ADR233_OUT ?? "/private/tmp/adr233-live";
const log = (...a) => console.log("[adr233 live]", ...a);
const findings = [];
const record = (name, pass, detail) => {
  findings.push({ name, pass, detail });
  log(`${pass ? "PASS" : "FAIL"} — ${name} :: ${detail}`);
};

const TAB_DEFAULT = "component-tab-item-default";
const TAB_SELECTED = "component-tab-item-selected";
const TABS_ORIGIN = "component-tabs";
const RADIO_ORIGIN = "component-radio";
const RADIO_SELECTED = "component-radio--selected";
const RADIOGROUP_ORIGIN = "component-radiogroup";
const TABS_INST = "adr233-tabs";
const RG_INST = "adr233-rg";
const TAB_ITEMS = [
  { id: "t1", title: "Overview" },
  { id: "t2", title: "Details" },
  { id: "t3", title: "History" },
];

const state = (page, fn, arg) => page.evaluate(fn, arg);
const elementById = (page, id) =>
  state(
    page,
    (id) => {
      const e = window.__composition_STORE__
        .getState()
        .elements.find((x) => x.id === id);
      return e
        ? {
            id: e.id,
            type: e.type,
            name: e.name ?? e.componentName ?? null,
            ref: e.ref ?? null,
            reusable: e.reusable ?? null,
            slot: e.slot ?? null,
            props: e.props ?? {},
            metadata: e.metadata ?? null,
            parent_id: e.parent_id ?? null,
          }
        : null;
    },
    id,
  );
const childrenOf = (page, id) =>
  state(
    page,
    (id) =>
      window.__composition_STORE__
        .getState()
        .elements.filter((e) => e.parent_id === id)
        .map((e) => ({
          id: e.id,
          type: e.type,
          ref: e.ref ?? null,
          props: e.props ?? {},
        })),
    id,
  );
/** Skia — layout map 키 중 prefix 로 시작하는 것의 절대 scene bounds (마지막 프레임). */
const boundsByPrefix = (page, prefix) =>
  state(
    page,
    (prefix) => {
      const map = window.__composition_LAYOUT_DEBUG__.getSharedLayoutMap();
      const out = {};
      for (const key of map.keys()) {
        if (!String(key).startsWith(prefix)) continue;
        const b = window.__composition_RENDER_DEBUG__.getSceneBounds(key);
        const l = map.get(key);
        const text =
          window.__composition_RENDER_DEBUG__.resolveTextNodeDebug?.(key);
        out[String(key).slice(prefix.length)] = {
          x: b ? Math.round(b.x * 100) / 100 : null,
          y: b ? Math.round(b.y * 100) / 100 : null,
          w: Math.round(l.width * 100) / 100,
          h: Math.round(l.height * 100) / 100,
          fontWeight: text?.fontWeight ?? null,
        };
      }
      return out;
    },
    prefix,
  );
const layoutKeys = (page, prefix) =>
  state(
    page,
    (prefix) =>
      [...window.__composition_LAYOUT_DEBUG__.getSharedLayoutMap().keys()]
        .map(String)
        .filter((k) => k.startsWith(prefix)),
    prefix,
  );
const sceneNodeProps = (page, id) =>
  state(page, (id) => window.__composition_SCENE_DEBUG__.readNode(id), id);
async function waitFor(read, predicate, ms = 10_000) {
  const start = Date.now();
  let last = await read();
  while (!predicate(last) && Date.now() - start < ms) {
    await new Promise((r) => setTimeout(r, 400));
    last = await read();
  }
  return last;
}
async function confirmImpactDialog(page) {
  const actions = page.locator(".editing-impact-actions button");
  try {
    await actions.last().waitFor({ state: "visible", timeout: 2500 });
  } catch {
    return false;
  }
  await actions.last().click();
  await page.waitForTimeout(1200);
  return true;
}
async function editOrigin(page, id, updates) {
  await state(
    page,
    ({ id, updates }) => {
      const st = window.__composition_STORE__.getState();
      const el = st.elements.find((e) => e.id === id);
      const next = { ...updates };
      if (updates.style) {
        next.props = {
          ...(el?.props ?? {}),
          style: { ...(el?.props?.style ?? {}), ...updates.style },
        };
        delete next.style;
      }
      st.updateElement(id, next);
      st.setSelectedElement(null);
    },
    { id, updates },
  );
  await page.waitForTimeout(400);
  const dialog = await confirmImpactDialog(page);
  await page.waitForTimeout(900);
  return dialog;
}
/** scene 절대 좌표 (x, y) 가 캔버스 (at) 에 오게 pan (scale 1) · 선택 해제. */
async function focusScene(page, scene, at = { x: 160, y: 160 }) {
  await state(
    page,
    ({ scene, at }) => {
      window.__composition_APPLY_VIEWPORT__?.({
        scale: 1,
        x: at.x - scene.x,
        y: at.y - scene.y,
      });
      window.__composition_STORE__.getState().setSelectedElement(null);
    },
    { scene, at },
  );
  await page.mouse.move(2, 890);
  await page.waitForTimeout(900);
}
/** 캔버스 스크린샷에서 scene bounds 영역 (안쪽 2px 여백) 픽셀 서명 — 같은 문자열 = 같은 픽셀. */
async function pixelSignatures(page, boundsMap) {
  const box = await page.locator("canvas").first().boundingBox();
  const vp = await state(page, () => {
    const v = window.__composition_VIEWPORT__();
    return { pan: v.panOffset ?? { x: 0, y: 0 }, zoom: v.zoom ?? 1 };
  });
  const png = PNG.sync.read(
    await page.screenshot({ type: "png", animations: "disabled" }),
  );
  const out = {};
  for (const [key, b] of Object.entries(boundsMap)) {
    if (b.x == null) {
      out[key] = null;
      continue;
    }
    const x0 = Math.round(box.x + vp.pan.x + b.x * vp.zoom) + 2;
    const y0 = Math.round(box.y + vp.pan.y + b.y * vp.zoom) + 2;
    const x1 = Math.round(box.x + vp.pan.x + (b.x + b.w) * vp.zoom) - 2;
    const y1 = Math.round(box.y + vp.pan.y + (b.y + b.h) * vp.zoom) - 2;
    let hash = 0;
    let red = 0;
    let n = 0;
    for (let y = y0; y < y1; y += 1) {
      for (let x = x0; x < x1; x += 1) {
        const i = (y * png.width + x) * 4;
        const r = png.data[i];
        const g = png.data[i + 1];
        const bl = png.data[i + 2];
        hash = (hash * 31 + r * 7 + g * 3 + bl) >>> 0;
        if (r > 200 && g < 80 && bl < 80) red += 1;
        n += 1;
      }
    }
    out[key] = { hash, redRatio: n ? Math.round((red / n) * 1000) / 1000 : 0 };
  }
  return out;
}
const approx = (a, b, tol = 1) =>
  typeof a === "number" && typeof b === "number" && Math.abs(a - b) <= tol;
const componentsBodyOrder = (page) =>
  state(page, () => {
    const st = window.__composition_STORE__.getState();
    const body = st.elements.find((e) => e.id === "page-components-body");
    return st.elements
      .filter((e) => e.parent_id === body?.id)
      .map((e) => e.id);
  });
const RED_FILL = [
  { id: "adr233-red", type: "color", color: "#FF0000", opacity: 1, enabled: true },
];

mkdirSync(OUT_DIR, { recursive: true });
const browser = await chromium.launch({ headless: false });
const context = await browser.newContext({
  storageState: STORAGE_STATE,
  viewport: { width: 1440, height: 900 },
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
let dialogs = 0;
page.on("dialog", (d) => {
  dialogs += 1;
  d.dismiss().catch(() => {});
});

try {
  await page.goto(`${BASE_URL}/dashboard`, { waitUntil: "networkidle" });
  const create = page.locator("button.dashboard-create-button").first();
  await create.waitFor({ state: "visible", timeout: 20_000 });
  await create.click();
  const input = page.locator("#new-project-name");
  await input.waitFor({ state: "visible", timeout: 10_000 });
  await input.fill(`adr233-${Date.now()}`);
  await input.press("Enter");
  await page.waitForURL(/\/builder\/[^/?]+$/, { timeout: 90_000 });
  await waitReady(page);
  log("project", page.url().split("/builder/")[1]);

  // ── L1: seed ──
  const tabDefault = await elementById(page, TAB_DEFAULT);
  const tabSelected = await elementById(page, TAB_SELECTED);
  const tabDefaultChildren = await childrenOf(page, TAB_DEFAULT);
  const tabsOrigin = await elementById(page, TABS_ORIGIN);
  const radio = await elementById(page, RADIO_ORIGIN);
  const radioChildren = await childrenOf(page, RADIO_ORIGIN);
  const variants = await state(
    page,
    () =>
      window.__composition_STORE__
        .getState()
        .elements.filter(
          (e) =>
            String(e.id).startsWith("component-radio--") &&
            !String(e.id).includes("__"),
        )
        .map((e) => e.id)
        .sort(),
  );
  const groupChildren = await childrenOf(page, RADIOGROUP_ORIGIN);
  const groupRadios = groupChildren.filter((c) => c.type !== "Label");
  record(
    "L1: Tab/Default·Tab/Selected (+ label Text) · component-tabs.slot · component-radio (+ Label) · Radio 변형 5 · 새 RadioGroup origin 의 Radio 자식 = ref",
    tabDefault?.type === "Tab" &&
      tabDefault?.reusable === true &&
      tabSelected?.metadata?.variant === "selected" &&
      tabDefaultChildren.map((c) => c.type).join() === "Text" &&
      JSON.stringify(tabsOrigin?.slot) ===
        JSON.stringify([TAB_DEFAULT, TAB_SELECTED]) &&
      radio?.type === "Radio" &&
      radioChildren.map((c) => c.type).join() === "Label" &&
      variants.length === 5 &&
      groupRadios.length >= 2 &&
      groupRadios.every((c) => c.type === "ref" && c.ref === RADIO_ORIGIN),
    JSON.stringify({
      tabDefault: tabDefault && { type: tabDefault.type, parent: tabDefault.parent_id },
      tabChildren: tabDefaultChildren.map((c) => c.type),
      slot: tabsOrigin?.slot,
      radio: radio && { type: radio.type, children: radioChildren.map((c) => c.type) },
      variants,
      groupChildren: groupChildren.map((c) => `${c.type}:${c.ref ?? ""}:${c.props?.value ?? ""}`),
    }),
  );
  const bodyOrder0 = await componentsBodyOrder(page);

  // ── instances (사용자 페이지) — Tab item id 는 origin TabPanel itemId 와 짝지어 실제 패널까지 그린다 ──
  const originItemIds = (tabsOrigin?.props?.items ?? []).map((it) => it.id);
  const ITEM_ID = { t1: originItemIds[0], t2: originItemIds[1], t3: "t3" };
  TAB_ITEMS[0].id = ITEM_ID.t1;
  TAB_ITEMS[1].id = ITEM_ID.t2;
  const radioValues = groupRadios.map((c) => String(c.props?.value ?? ""));
  const selectedValue = radioValues[1] ?? radioValues[0];
  await state(
    page,
    ({ TABS_INST, RG_INST, TAB_ITEMS, selectedValue, ITEM_ID_T2 }) => {
      const st = window.__composition_STORE__.getState();
      const body = st.elements.find(
        (e) => e.type === "body" && e.page_id === st.currentPageId,
      );
      const now = new Date().toISOString();
      st.addElement({
        id: TABS_INST,
        customId: TABS_INST,
        type: "ref",
        ref: "component-tabs",
        componentName: "Tabs",
        parent_id: body.id,
        page_id: st.currentPageId,
        props: { items: TAB_ITEMS, defaultSelectedKey: ITEM_ID_T2 },
        created_at: now,
        updated_at: now,
      });
      st.addElement({
        id: RG_INST,
        customId: RG_INST,
        type: "ref",
        ref: "component-radiogroup",
        componentName: "RadioGroup",
        parent_id: body.id,
        page_id: st.currentPageId,
        props: { value: selectedValue },
        created_at: now,
        updated_at: now,
      });
      st.setSelectedElement(null);
    },
    { TABS_INST, RG_INST, TAB_ITEMS, selectedValue, ITEM_ID_T2: ITEM_ID.t2 },
  );
  await page.waitForTimeout(1500);

  const tabRowKeys = await layoutKeys(page, `projection:tab-row:${TABS_INST}/`);
  const tabListSynth = tabRowKeys[0]
    ?.slice("projection:tab-row:".length)
    .split(":")[0];
  const tabRowPrefix = `projection:tab-row:${tabListSynth}:`;
  const readTabs = async () => {
    const raw = await boundsByPrefix(page, tabRowPrefix);
    return { t1: raw[ITEM_ID.t1], t2: raw[ITEM_ID.t2], t3: raw[ITEM_ID.t3] };
  };
  const tabs0 = await waitFor(readTabs, (t) => t.t1?.x != null && t.t3?.x != null);
  const t1Node = await sceneNodeProps(page, `${tabRowPrefix}${ITEM_ID.t1}`);
  const t2Node = await sceneNodeProps(page, `${tabRowPrefix}${ITEM_ID.t2}`);
  // RadioGroup instance 의 Radio (synthetic) — scene 에서 type Radio 인 자손.
  const rgKeys = await layoutKeys(page, `${RG_INST}/`);
  const radioKeys = [];
  for (const key of rgKeys) {
    const node = await state(
      page,
      (k) => {
        const map = window.__composition_LAYOUT_DEBUG__.getSharedLayoutMap();
        return map.get(k) ? k : null;
      },
      key,
    );
    if (node && !key.slice(RG_INST.length + 1).includes("/")) radioKeys.push(key);
  }
  const rgRadioIds = await state(
    page,
    ({ keys }) =>
      keys.filter(
        (k) =>
          window.__composition_SCENE_DEBUG__.readNode(k) &&
          (window.__composition_SCENE_DEBUG__.readNode(k).props?.value !== undefined),
      ),
    { keys: radioKeys },
  );
  record(
    "L2: 기준 — Tabs instance Tab 행 3 (templateOriginId 반영 · style height auto 없음 = template 비어 있음 아님 확인) · RadioGroup instance Radio 2",
    Object.keys(tabs0).length === 3 && rgRadioIds.length >= 2,
    JSON.stringify({ tabListSynth, tabs0, t1Style: t1Node?.props?.style, t2Selected: t2Node?.props?._isSelected, rgKeys, rgRadioIds }),
  );

  // Tabs 를 화면 안에
  await focusScene(page, { x: tabs0.t1.x, y: tabs0.t1.y });
  const tabPanelKey = await state(
    page,
    ({ prefix, itemId }) =>
      [...window.__composition_LAYOUT_DEBUG__.getSharedLayoutMap().keys()]
        .map(String)
        .filter((k) => k.startsWith(prefix))
        .find(
          (k) =>
            window.__composition_SCENE_DEBUG__.readNode(k)?.props?.itemId === itemId,
        ) ?? null,
    { prefix: `${TABS_INST}/`, itemId: ITEM_ID.t2 },
  );
  const readPanel = () =>
    state(page, (k) => window.__composition_RENDER_DEBUG__.getSceneBounds(k), tabPanelKey);
  const panel0 = await readPanel();
  const readStruct = () =>
    state(
      page,
      (inst) => {
        const map = window.__composition_LAYOUT_DEBUG__.getSharedLayoutMap();
        const out = {};
        for (const key of map.keys()) {
          const k = String(key);
          if (!(k === inst || k.startsWith(`${inst}/`) || k.startsWith(`projection:tab-rows:${inst}/`))) continue;
          const b = window.__composition_RENDER_DEBUG__.getSceneBounds(k);
          out[k.replace(inst, "~")] = b
            ? [Math.round(b.x), Math.round(b.y * 10) / 10, Math.round(b.width), Math.round(b.height * 10) / 10]
            : null;
        }
        return out;
      },
      TABS_INST,
    );
  const struct0 = await readStruct();

  // ── L3: Tab/Default padding 24/10 ──
  const d3 = await editOrigin(page, TAB_DEFAULT, {
    style: { paddingLeft: 24, paddingRight: 24, paddingTop: 10, paddingBottom: 10 },
  });
  const tabs3 = await waitFor(readTabs, (t) => approx(t.t1?.w, tabs0.t1.w + 24, 1.5));
  const panel3 = await readPanel();
  const struct3 = await readStruct();
  const engineIn = await state(
    page,
    (ids) =>
      Object.fromEntries(
        ids.map((id) => [id, window.__composition_LAYOUT_DEBUG__.getEngineInput(id)]),
      ),
    [`${TABS_INST}/component-tabs__1`, `projection:tab-rows:${TABS_INST}/component-tabs__1`, `${tabRowPrefix}t1`],
  );
  log("engine input", JSON.stringify(engineIn));
  const rowBottom3 = Math.max(...Object.values(tabs3).map((b) => b.y + b.h));
  record(
    "L3: Tab/Default padding 24/10 → Tab 행 폭 +24 · 높이 40 (= max(rule 29, 20 + 10×2)) · 행 y 불변 · TabList 40 · 선택 TabPanel 이 +11 내려가 행 아래 (겹침 0)",
    approx(tabs3.t1.w, tabs0.t1.w + 24, 1.5) &&
      approx(tabs3.t1.h, 40, 0.5) &&
      approx(tabs3.t1.y, tabs0.t1.y, 0.5) &&
      approx(tabs3.t3.w, tabs0.t3.w + 24, 1.5) &&
      approx(struct3["~/component-tabs__1"]?.[3], 40, 0.5) &&
      panel0 != null &&
      panel3 != null &&
      approx(panel3.y, panel0.y + 11, 0.5) &&
      panel3.y >= rowBottom3 - 0.5,
    JSON.stringify({ dialog: d3, before: tabs0.t1, after: tabs3.t1, tabPanelKey, panel0, panel3, rowBottom3, struct0, struct3 }),
  );
  writeFileSync(resolve(OUT_DIR, "l3-padding.png"), await page.screenshot());

  // ── L4: label fontWeight 700 ──
  await editOrigin(page, `${TAB_DEFAULT}__label`, { style: { fontWeight: 700 } });
  const tabs4 = await waitFor(readTabs, (t) => t.t1?.fontWeight === 700 || t.t1?.fontWeight === "700");
  record(
    "L4: Tab/Default label fontWeight 700 → Tab 행 텍스트 fontWeight 700 · 행 폭 증가",
    String(tabs4.t1?.fontWeight) === "700" && tabs4.t1.w > tabs3.t1.w,
    JSON.stringify({ before: tabs3.t1, after: tabs4.t1 }),
  );

  // ── L5: Tab/Selected fills 빨강 → 선택 Tab (t2) 만 픽셀 Δ ──
  await focusScene(page, { x: tabs4.t1.x, y: tabs4.t1.y });
  const tabsAt5 = await readTabs();
  const px5a = await pixelSignatures(page, tabsAt5);
  await editOrigin(page, TAB_SELECTED, { fills: RED_FILL });
  await page.waitForTimeout(600);
  const px5b = await waitFor(
    () => pixelSignatures(page, tabsAt5),
    (p) => (p.t2?.redRatio ?? 0) > 0.3,
  );
  record(
    "L5: Tab/Selected fills 빨강 → 선택 Tab (t2) 픽셀 빨강 · t1/t3 픽셀 불변",
    (px5b.t2?.redRatio ?? 0) > 0.3 &&
      px5b.t1?.hash === px5a.t1?.hash &&
      px5b.t3?.hash === px5a.t3?.hash,
    JSON.stringify({ before: px5a, after: px5b }),
  );
  writeFileSync(resolve(OUT_DIR, "l5-tab-selected.png"), await page.screenshot());

  // ── L6: component-radio fills → instance Radio 두 개 픽셀 Δ ──
  const readRadios = () =>
    state(
      page,
      (ids) =>
        Object.fromEntries(
          ids.map((id) => {
            const b = window.__composition_RENDER_DEBUG__.getSceneBounds(id);
            return [id, b ? { x: b.x, y: b.y, w: b.width, h: b.height } : { x: null }];
          }),
        ),
      rgRadioIds,
    );
  const radios0 = await readRadios();
  const firstRadio = Object.values(radios0)[0];
  await focusScene(page, { x: firstRadio.x, y: firstRadio.y });
  const radiosAt = await readRadios();
  const px6a = await pixelSignatures(page, radiosAt);
  // 관찰 (게이트 아님): Radio `fills` 는 Skia 에서 선택 점 색 (skiaPrimitives radio — 미선택 Radio 에는
  //   안 보인다) · DOM 은 Radio 행 배경 — 233 이전부터 있던 plain Radio 비대칭 (breakdown §6 Phase 3).
  await editOrigin(page, RADIO_ORIGIN, { fills: RED_FILL });
  const pxFills = await waitFor(
    () => pixelSignatures(page, radiosAt),
    (p) => Object.values(p).some((s, i) => s?.hash !== Object.values(px6a)[i]?.hash),
  );
  log("관찰 — component-radio fills 빨강:", JSON.stringify({ before: px6a, after: pxFills }));
  await editOrigin(page, RADIO_ORIGIN, { fills: [] });
  await page.waitForTimeout(600);
  const px6base = await pixelSignatures(page, radiosAt);
  await editOrigin(page, RADIO_ORIGIN, { style: { opacity: 0.5 } });
  const px6b = await waitFor(
    () => pixelSignatures(page, radiosAt),
    (p) => Object.keys(p).every((k) => p[k]?.hash !== px6base[k]?.hash),
  );
  record(
    "L6: component-radio opacity 0.5 → RadioGroup instance 의 Radio 전부 픽셀 Δ (origin 편집이 중첩 instance 에 닿는다)",
    Object.keys(px6b).every((k) => px6b[k]?.hash !== px6base[k]?.hash),
    JSON.stringify({ before: px6base, after: px6b }),
  );

  // ── L6b: component-radio paddingLeft 8 → instance Radio rect 폭 +8 (레이아웃 전파) ──
  const rectOf = () =>
    state(
      page,
      (ids) =>
        Object.fromEntries(
          ids.map((id) => [
            id,
            window.__composition_LAYOUT_DEBUG__.getSharedLayoutMap().get(id)?.width ?? null,
          ]),
        ),
      rgRadioIds,
    );
  const w6a = await rectOf();
  const d6b = await editOrigin(page, RADIO_ORIGIN, { style: { paddingLeft: 8 } });
  const w6b = await waitFor(rectOf, (w) =>
    rgRadioIds.every((id) => approx(w[id], (w6a[id] ?? 0) + 8, 0.5)),
  );
  record(
    "L6b: component-radio paddingLeft 8 → RadioGroup instance 의 Radio rect 폭 전부 +8 (영향 대화상자 확인 뒤 커밋)",
    rgRadioIds.every((id) => approx(w6b[id], (w6a[id] ?? 0) + 8, 0.5)),
    JSON.stringify({ dialog: d6b, before: w6a, after: w6b }),
  );
  const radiosAt7 = await readRadios();

  // ── L7: Radio/Selected opacity → 선택된 Radio 만 Δ ──
  const selectedRadioId = await state(
    page,
    ({ ids, selectedValue }) =>
      ids.find(
        (id) =>
          String(window.__composition_SCENE_DEBUG__.readNode(id)?.props?.value) ===
          selectedValue,
      ) ?? null,
    { ids: rgRadioIds, selectedValue },
  );
  const px7a = await pixelSignatures(page, radiosAt7);
  await editOrigin(page, RADIO_SELECTED, { style: { opacity: 0.2 } });
  const px7b = await waitFor(
    () => pixelSignatures(page, radiosAt7),
    (p) => p[selectedRadioId]?.hash !== px7a[selectedRadioId]?.hash,
  );
  const others = rgRadioIds.filter((id) => id !== selectedRadioId);
  record(
    "L7: Radio/Selected opacity 0.2 → 선택된 Radio 만 픽셀 Δ · 나머지 Radio 불변",
    selectedRadioId != null &&
      px7b[selectedRadioId]?.hash !== px7a[selectedRadioId]?.hash &&
      others.every((id) => px7b[id]?.hash === px7a[id]?.hash),
    JSON.stringify({ selectedRadioId, before: px7a, after: px7b }),
  );
  writeFileSync(resolve(OUT_DIR, "l7-radio-selected.png"), await page.screenshot());

  // ── L8: reload → 편집 보존 · Components body 순서 Δ0 ──
  await page.waitForTimeout(3000);
  await page.reload({ waitUntil: "networkidle" });
  await waitReady(page);
  await page.waitForTimeout(1500);
  const tabDefaultAfter = await elementById(page, TAB_DEFAULT);
  const radioAfter = await elementById(page, RADIO_ORIGIN);
  const bodyOrder1 = await componentsBodyOrder(page);
  const tabs8 = await waitFor(readTabs, (t) => t.t1?.x != null);
  record(
    "L8: reload → Tab/Default padding · component-radio opacity 보존 · Tab 행 폭 유지 · Components body 순서 Δ0",
    tabDefaultAfter?.props?.style?.paddingLeft === 24 &&
      radioAfter?.props?.style?.opacity === 0.5 &&
      radioAfter?.props?.style?.paddingLeft === 8 &&
      approx(tabs8.t1?.w, tabs4.t1.w, 1) &&
      JSON.stringify(bodyOrder0) === JSON.stringify(bodyOrder1),
    JSON.stringify({
      style: tabDefaultAfter?.props?.style,
      radioStyle: radioAfter?.props?.style,
      t1: tabs8.t1,
      bodyLen: [bodyOrder0.length, bodyOrder1.length],
    }),
  );

  record(
    "page error 0 · dialog 0",
    errors.length === 0 && dialogs === 0,
    `${errors.length} / ${dialogs} ${errors.slice(0, 2).join(" | ")}`,
  );
} catch (e) {
  record("harness", false, String(e?.stack ?? e));
  await page.screenshot({ path: resolve(OUT_DIR, "error.png") }).catch(() => {});
} finally {
  writeFileSync(
    resolve(OUT_DIR, "findings.json"),
    JSON.stringify({ findings, errors, dialogs, at: new Date().toISOString() }, null, 2),
  );
  const pass = findings.filter((f) => f.pass).length;
  log(`${pass}/${findings.length} PASS · errors ${errors.length}`);
  await browser.close();
  process.exit(pass === findings.length ? 0 : 1);
}
