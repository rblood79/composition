#!/usr/bin/env node
// adr229-two-leg-parity-live.mjs — ADR-229 Phase 3 G2 live (실제 빌더, headed Playwright).
//   Phase 1·2 하니스가 각각 한 leg 씩 본 것을 **같은 세션에서 두 leg 동시 Δ** 로 묶는다.
//   P3-a) Tag item origin slot style — icon `fontSize` 20 · label `fontWeight` 700 · root padding 24/8
//         → TagGroup instance Skia rect (`__composition_LAYOUT_DEBUG__`) + Skia 픽셀 (Compare Mode 전에,
//         빈 캡처 가드) + Preview computed 가 같은 방향으로 같이 움직인다.
//   P3-b) `component-button` 편집 (전파 밖 축 style.width 200) → Form instance 안 Button (ButtonGroup ref 안
//         Button ref · 3단) + Toolbar instance 안 Button 두 leg 폭 200 · 자기 patch (Save · Action 1) 유지.
//   P3-c) 중첩 instance 편집 (Form instance 의 Save → 'Go', synthetic id 선택 + Properties) → 저장 →
//         reload → 두 leg 보존 (Tag padding · Button 폭 · 'Go') · Components body Δ0.
//   page error 0 · dialog 0. ADR-228 parity 56 pair 회귀는 `adr228-instance-parity-live.mjs` 로 따로.
// 사용: node apps/builder/scripts/adr229-two-leg-parity-live.mjs [--headed]  (dev 5173 · .auth-session.json)
import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { chromium } from "playwright";
import pixelmatch from "pixelmatch";
import { waitReady } from "./perf-baseline.mjs";

const require = createRequire(import.meta.url);
const { PNG } = require(
  resolve("node_modules/.pnpm/pngjs@7.0.0/node_modules/pngjs"),
);

const BASE_URL = "http://localhost:5173";
const STORAGE_STATE = resolve("apps/builder/scripts/.auth-session.json");
const OUT_DIR = process.env.ADR229_OUT ?? "/private/tmp/adr229-p3-live";
const headed = process.argv.includes("--headed");
const log = (...a) => console.log("[adr229 p3]", ...a);
const findings = [];
const record = (name, pass, detail) => {
  findings.push({ name, pass, detail });
  log(`${pass ? "PASS" : "FAIL"} — ${name} :: ${detail}`);
};

const DEFAULT_ORIGIN = "component-tag-item-default";
const TAGGROUP_ORIGIN = "component-taggroup";
const TAG_INSTANCE = "adr229-p3-tg";
const TAGLIST_SYNTH = `${TAG_INSTANCE}/${TAGGROUP_ORIGIN}__2`;
const FORM_INSTANCE = "adr229-p3-form";
const TOOLBAR_INSTANCE = "adr229-p3-toolbar";
const NESTED_SAVE_PATH = "ButtonGroup/component-buttongroup__2";
const NESTED_SAVE = `${FORM_INSTANCE}/${NESTED_SAVE_PATH}`;
const NESTED_TOOLBAR_B1 = `${TOOLBAR_INSTANCE}/Button/Action 1`;
const ITEMS = [
  { id: "a", label: "Alpha", icon: "star" },
  { id: "b", label: "Beta", icon: "inbox" },
  { id: "c", label: "Gamma" },
];

const RAIL_ORDER = [
  "navigator",
  "components",
  "datatable",
  "datatableEditor",
  "theme",
  "ai",
  "properties",
  "styles",
  "interactions",
  "history",
];
async function setPanel(page, panelId, open) {
  const button = page
    .locator(".panel-toggle-rail button")
    .nth(RAIL_ORDER.indexOf(panelId));
  if (((await button.getAttribute("aria-pressed")) === "true") !== open) {
    await button.click();
    await page.waitForTimeout(900);
  }
}
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
            ref: e.ref ?? null,
            props: e.props ?? {},
            descendants: e.descendants ?? null,
            parent_id: e.parent_id ?? null,
          }
        : null;
    },
    id,
  );
const layoutRect = (page, id) =>
  state(
    page,
    (id) => {
      const l = window.__composition_LAYOUT_DEBUG__
        ?.getSharedLayoutMap?.()
        .get(id);
      return l
        ? {
            w: Math.round(l.width * 100) / 100,
            h: Math.round(l.height * 100) / 100,
          }
        : null;
    },
    id,
  );
const skiaText = (page, id) =>
  state(
    page,
    (id) => {
      const t = window.__composition_RENDER_DEBUG__?.resolveTextNodeDebug?.(id);
      return t
        ? {
            content: t.content ?? null,
            fontSize: t.fontSize ?? null,
            fontWeight: t.fontWeight ?? null,
          }
        : null;
    },
    id,
  );
/** Skia leg — synthetic TagList 의 chip layout rect + 글자 (itemKey 별). */
const chipRects = (page) =>
  state(
    page,
    (tagListId) => {
      const map = window.__composition_LAYOUT_DEBUG__.getSharedLayoutMap();
      const out = {};
      const prefix = `projection:tag-row:${tagListId}:`;
      for (const [key, l] of map.entries()) {
        if (!String(key).startsWith(prefix)) continue;
        const itemKey = String(key).slice(prefix.length);
        const text =
          window.__composition_RENDER_DEBUG__?.resolveTextNodeDebug?.(key);
        out[itemKey] = {
          w: Math.round(l.width * 100) / 100,
          h: Math.round(l.height * 100) / 100,
          fontSize: text?.fontSize ?? null,
          fontWeight: text?.fontWeight ?? null,
        };
      }
      return out;
    },
    TAGLIST_SYNTH,
  );
/** Preview leg — instance wrapper 안 chip (label 별) computed. */
const previewChips = (page) =>
  state(
    page,
    (instanceId) => {
      for (const f of document.querySelectorAll("iframe")) {
        const doc = f.contentDocument;
        const wrapper = doc?.querySelector(`[data-element-id="${instanceId}"]`);
        const tags = wrapper?.querySelectorAll(
          ".tag-list-wrapper .react-aria-Tag, .react-aria-TagList .react-aria-Tag",
        );
        if (!tags?.length) continue;
        const out = {};
        for (const t of tags) {
          const r = t.getBoundingClientRect();
          if (r.width === 0) continue;
          const cs = doc.defaultView.getComputedStyle(t);
          const icon = t.querySelector(".tag-leading-icon");
          const iconCs = icon ? doc.defaultView.getComputedStyle(icon) : null;
          out[t.textContent.trim()] = {
            w: Math.round(r.width * 100) / 100,
            h: Math.round(r.height * 100) / 100,
            paddingLeft: cs.paddingLeft,
            fontSize: cs.fontSize,
            fontWeight: cs.fontWeight,
            icon: icon
              ? {
                  w: Math.round(icon.getBoundingClientRect().width * 100) / 100,
                  fontSize: iconCs.fontSize,
                }
              : null,
          };
        }
        return out;
      }
      return null;
    },
    TAG_INSTANCE,
  );
/** Preview leg — instance wrapper 안 BUTTON 들 (text 별 폭). */
const previewButtons = (page, instanceId) =>
  state(
    page,
    (instanceId) => {
      for (const f of document.querySelectorAll("iframe")) {
        const doc = f.contentDocument;
        const wrapper = doc?.querySelector(`[data-element-id="${instanceId}"]`);
        if (!wrapper) continue;
        const out = {};
        for (const b of wrapper.querySelectorAll("button")) {
          const r = b.getBoundingClientRect();
          if (r.width === 0) continue;
          out[(b.textContent ?? "").trim()] = {
            w: Math.round(r.width * 100) / 100,
            h: Math.round(r.height * 100) / 100,
          };
        }
        return out;
      }
      return null;
    },
    instanceId,
  );
async function waitFor(read, predicate, ms = 12_000) {
  const start = Date.now();
  let last = await read();
  while (!predicate(last) && Date.now() - start < ms) {
    await page.waitForTimeout(500);
    last = await read();
  }
  return last;
}
const approx = (a, b, tol = 1) =>
  typeof a === "number" && typeof b === "number" && Math.abs(a - b) <= tol;
const componentsBodySnapshot = (page) =>
  state(page, () => {
    const st = window.__composition_STORE__.getState();
    const body = st.elements.find((e) => e.id === "page-components-body");
    const byParent = new Map();
    for (const e of st.elements) {
      const arr = byParent.get(e.parent_id) ?? [];
      arr.push(e);
      byParent.set(e.parent_id, arr);
    }
    const walk = (id) =>
      (byParent.get(id) ?? []).map((e) => ({
        id: e.id,
        type: e.type,
        ref: e.ref ?? null,
        slot: e.slot ?? null,
        props: e.props ?? {},
        descendants: e.descendants ?? null,
        children: walk(e.id),
      }));
    const tree = walk(body?.id);
    const count = (nodes) =>
      nodes.reduce((n, c) => n + 1 + count(c.children), 0);
    return { n: count(tree), bytes: JSON.stringify(tree).length, tree };
  });
async function ensureCompareMode(page) {
  const compare = page
    .locator(".header_right .builder-control-group button")
    .first();
  if (
    (await compare.getAttribute("aria-pressed")) !== "true" &&
    (await compare.getAttribute("aria-checked")) !== "true"
  ) {
    await compare.click();
    await page.waitForTimeout(2500);
  }
  await page
    .waitForFunction(
      () =>
        [...document.querySelectorAll("iframe")].some((f) =>
          f.contentDocument?.querySelector(".react-aria-Tag"),
        ),
      null,
      { timeout: 15_000 },
    )
    .catch(() => {});
}
/** origin 편집 영향 대화상자 (`EditingSemanticsImpactDialogHost`) — 뜨면 Continue. */
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
async function focusOn(page, id, at = { x: 200, y: 200 }) {
  await state(
    page,
    ({ id, at }) => {
      const st = window.__composition_STORE__.getState();
      const el = st.elements.find((e) => e.id === id);
      const positions = st.pagePositions;
      const pos = (positions instanceof Map
        ? positions.get(el.page_id)
        : positions?.[el.page_id]) ?? { x: 0, y: 0 };
      const l = window.__composition_LAYOUT_DEBUG__
        ?.getSharedLayoutMap?.()
        .get(id);
      window.__composition_APPLY_VIEWPORT__?.({
        scale: 1,
        x: at.x - (pos.x + (l?.x ?? 0)),
        y: at.y - (pos.y + (l?.y ?? 0)),
      });
      st.setSelectedElement(null);
    },
    { id, at },
  );
  await page.waitForTimeout(800);
}
/** Skia 픽셀 — 캔버스 상단 100px (헤더·툴바 DOM) 제외, 선택 해제 + 마우스 밖. */
async function skiaCapture(page) {
  await state(page, () =>
    window.__composition_STORE__.getState().setSelectedElement(null),
  );
  await page.mouse.move(2, 890);
  await page.waitForTimeout(300);
  const box = await page.locator("canvas").first().boundingBox();
  return page.screenshot({
    type: "png",
    animations: "disabled",
    clip: {
      x: Math.round(box.x),
      y: Math.round(box.y) + 100,
      width: Math.round(box.width),
      height: Math.round(box.height) - 100,
    },
  });
}
function nonBackgroundPixels(png) {
  const p = PNG.sync.read(png);
  const bg = [p.data[0], p.data[1], p.data[2]];
  let n = 0;
  for (let i = 0; i < p.data.length; i += 4) {
    if (
      Math.abs(p.data[i] - bg[0]) +
        Math.abs(p.data[i + 1] - bg[1]) +
        Math.abs(p.data[i + 2] - bg[2]) >
      24
    )
      n++;
  }
  return n;
}
function pixelDiff(a, b) {
  const pa = PNG.sync.read(a);
  const pb = PNG.sync.read(b);
  if (pa.width !== pb.width || pa.height !== pb.height)
    return { diff: -1, total: 0 };
  const diff = pixelmatch(pa.data, pb.data, null, pa.width, pa.height, {
    threshold: 0,
  });
  return { diff, total: pa.width * pa.height };
}
/** origin 편집 (store) → 영향 대화상자 Continue. */
async function editOriginStyle(page, id, stylePatch) {
  await state(
    page,
    ({ id, stylePatch }) => {
      const st = window.__composition_STORE__.getState();
      const el = st.elements.find((e) => e.id === id);
      st.updateElementProps(id, {
        style: { ...(el?.props?.style ?? {}), ...stylePatch },
      });
    },
    { id, stylePatch },
  );
  await page.waitForTimeout(400);
  const dialog = await confirmImpactDialog(page);
  await page.waitForTimeout(800);
  return dialog;
}

mkdirSync(OUT_DIR, { recursive: true });
const browser = await chromium.launch({ headless: !headed });
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
  await input.fill(`adr229p3-${Date.now()}`);
  await input.press("Enter");
  await page.waitForURL(/\/builder\/[^/?]+$/, { timeout: 90_000 });
  await waitReady(page);
  log("project", page.url().split("/builder/")[1]);
  const bodyBefore = await componentsBodySnapshot(page);

  // ── seed: 사용자 페이지에 TagGroup · Form · Toolbar instance (팔레트 배치와 같은 ref) ──
  await state(
    page,
    ({ TAG_INSTANCE, FORM_INSTANCE, TOOLBAR_INSTANCE, ITEMS }) => {
      const st = window.__composition_STORE__.getState();
      const body = st.elements.find(
        (e) => e.type === "body" && e.page_id === st.currentPageId,
      );
      const now = new Date().toISOString();
      const add = (id, ref, componentName, props) =>
        st.addElement({
          id,
          customId: id,
          type: "ref",
          ref,
          componentName,
          parent_id: body.id,
          page_id: st.currentPageId,
          props,
          created_at: now,
          updated_at: now,
        });
      add(TAG_INSTANCE, "component-taggroup", "TagGroup", {
        items: ITEMS,
        selectionMode: "multiple",
        maxRows: 0,
      });
      add(FORM_INSTANCE, "component-form", "Form", {});
      add(TOOLBAR_INSTANCE, "component-toolbar", "Toolbar", {});
    },
    { TAG_INSTANCE, FORM_INSTANCE, TOOLBAR_INSTANCE, ITEMS },
  );
  await page.waitForTimeout(1500);
  await focusOn(page, TAG_INSTANCE);

  // ── P3-a-0: Skia 픽셀 기준 (Compare Mode 전 — 반폭 캔버스가 면적 Δ 를 지운다) ──
  const pngBase = await skiaCapture(page);
  const basePixels = nonBackgroundPixels(pngBase);
  writeFileSync(resolve(OUT_DIR, "a0-skia-base.png"), pngBase);
  const skiaBase = await waitFor(
    () => chipRects(page),
    (s) => s.a && s.b && s.c,
  );
  record(
    "P3-a-0: TagGroup instance Skia 기준 — chip 3 rect (높이 30) · 캔버스 캡처 비어 있지 않음",
    approx(skiaBase.a?.h, 30, 0.5) &&
      approx(skiaBase.c?.h, 30, 0.5) &&
      basePixels > 200,
    JSON.stringify({ skia: skiaBase, basePixels }),
  );

  // ── P3-a-1: icon slot fontSize 20 → Skia (픽셀 Δ + rect) 먼저 ──
  await editOriginStyle(page, `${DEFAULT_ORIGIN}__icon`, { fontSize: 20 });
  const skiaIcon = await waitFor(
    () => chipRects(page),
    (s) => s.a?.w > skiaBase.a?.w + 3,
  );
  const pngIcon = await skiaCapture(page);
  const iconPx = pixelDiff(pngBase, pngIcon);
  writeFileSync(resolve(OUT_DIR, "a1-skia-icon.png"), pngIcon);
  // ── label slot fontWeight 700 ──
  await editOriginStyle(page, `${DEFAULT_ORIGIN}__label`, { fontWeight: 700 });
  const skiaBold = await waitFor(
    () => chipRects(page),
    (s) => s.c?.w > skiaBase.c?.w + 1,
  );
  const pngBold = await skiaCapture(page);
  const boldPx = pixelDiff(pngIcon, pngBold);
  writeFileSync(resolve(OUT_DIR, "a1-skia-bold.png"), pngBold);
  // ── root padding 24/8 ──
  await editOriginStyle(page, DEFAULT_ORIGIN, {
    paddingLeft: 24,
    paddingRight: 24,
    paddingTop: 8,
    paddingBottom: 8,
  });
  const skiaPad = await waitFor(
    () => chipRects(page),
    (s) => approx(s.c?.h, 38, 0.5),
  );
  const pngPad = await skiaCapture(page);
  const padPx = pixelDiff(pngBold, pngPad);
  writeFileSync(resolve(OUT_DIR, "a1-skia-pad.png"), pngPad);
  record(
    "P3-a-1: Skia — icon fontSize 20 → icon chip (Alpha/Beta) 폭 +6 · Gamma 불변 · 픽셀 Δ>0 → label 700 → 전 chip 폭 증가 · 픽셀 Δ>0 → padding 24/8 → 높이 38 · 폭 +24 · 픽셀 Δ>0",
    approx(skiaIcon.a?.w, skiaBase.a?.w + 6, 0.6) &&
      approx(skiaIcon.b?.w, skiaBase.b?.w + 6, 0.6) &&
      approx(skiaIcon.c?.w, skiaBase.c?.w, 0.1) &&
      iconPx.diff > 0 &&
      skiaBold.c?.w > skiaIcon.c?.w &&
      skiaBold.a?.w > skiaIcon.a?.w &&
      skiaBold.c?.fontWeight === 700 &&
      boldPx.diff > 0 &&
      approx(skiaPad.c?.h, 38, 0.5) &&
      approx(skiaPad.c?.w, skiaBold.c?.w + 24, 0.6) &&
      padPx.diff > 0,
    JSON.stringify({
      base: skiaBase,
      icon: skiaIcon,
      bold: skiaBold,
      pad: skiaPad,
      px: { iconPx, boldPx, padPx },
    }),
  );

  // ── P3-a-2: Preview 가 같은 값을 본다 (Compare Mode) ──
  await ensureCompareMode(page);
  const previewA = await waitFor(
    () => previewChips(page),
    (p) =>
      p?.Gamma?.paddingLeft === "24px" &&
      p?.Gamma?.fontWeight === "700" &&
      p?.Alpha?.icon?.fontSize === "20px",
    15_000,
  );
  const skiaNow = await chipRects(page);
  record(
    "P3-a-2: Preview — icon 20px · label font-weight 700 · padding-left 24px · chip 높이 38 = Skia 38 · 폭 차 ≤ 3 (3 chip)",
    previewA?.Alpha?.icon?.fontSize === "20px" &&
      approx(previewA?.Alpha?.icon?.w, 20, 0.5) &&
      previewA?.Gamma?.fontWeight === "700" &&
      previewA?.Gamma?.paddingLeft === "24px" &&
      approx(previewA?.Gamma?.h, 38, 0.5) &&
      approx(previewA?.Alpha?.w, skiaNow.a?.w, 3) &&
      approx(previewA?.Beta?.w, skiaNow.b?.w, 3) &&
      approx(previewA?.Gamma?.w, skiaNow.c?.w, 3),
    JSON.stringify({ preview: previewA, skia: skiaNow }),
  );
  await page.screenshot({ path: resolve(OUT_DIR, "a2-compare.png") });

  // ── P3-b: component-button style.width 200 → Form/Toolbar instance 안 Button 두 leg ──
  await focusOn(page, FORM_INSTANCE);
  const saveBefore = await layoutRect(page, NESTED_SAVE);
  const toolbarBefore = await layoutRect(page, NESTED_TOOLBAR_B1);
  const previewFormBefore = await waitFor(
    () => previewButtons(page, FORM_INSTANCE),
    (p) => p?.Save,
  );
  const previewToolbarBefore = await waitFor(
    () => previewButtons(page, TOOLBAR_INSTANCE),
    (p) => p?.["Action 1"],
  );
  await editOriginStyle(page, "component-button", { width: 200 });
  const saveAfter = await waitFor(
    () => layoutRect(page, NESTED_SAVE),
    (r) => r?.w === 200,
  );
  const toolbarAfter = await layoutRect(page, NESTED_TOOLBAR_B1);
  const previewFormAfter = await waitFor(
    () => previewButtons(page, FORM_INSTANCE),
    (p) => p?.Save?.w === 200,
    15_000,
  );
  const previewToolbarAfter = await waitFor(
    () => previewButtons(page, TOOLBAR_INSTANCE),
    (p) => p?.["Action 1"]?.w === 200,
    15_000,
  );
  const saveText = await skiaText(page, NESTED_SAVE);
  const toolbarText = await skiaText(page, NESTED_TOOLBAR_B1);
  record(
    "P3-b: `component-button` style.width 200 → Form instance 안 Save (ButtonGroup ref 안 Button ref) · Toolbar instance 안 Action 1 — Skia 폭 200 · Preview 폭 200 · 자기 patch 글자 유지 (전엔 폭 < 200)",
    saveBefore?.w < 200 &&
      toolbarBefore?.w < 200 &&
      saveAfter?.w === 200 &&
      toolbarAfter?.w === 200 &&
      previewFormBefore?.Save?.w < 200 &&
      previewFormAfter?.Save?.w === 200 &&
      previewFormAfter?.Cancel?.w === 200 &&
      previewToolbarAfter?.["Action 1"]?.w === 200 &&
      saveText?.content === "Save" &&
      toolbarText?.content === "Action 1",
    JSON.stringify({
      skia: {
        saveBefore,
        saveAfter,
        toolbarBefore,
        toolbarAfter,
        saveText,
        toolbarText,
      },
      preview: {
        formBefore: previewFormBefore,
        formAfter: previewFormAfter,
        toolbarBefore: previewToolbarBefore,
        toolbarAfter: previewToolbarAfter,
      },
    }),
  );
  await page.screenshot({ path: resolve(OUT_DIR, "b-width.png") });

  // ── P3-c: 중첩 instance 편집 (synthetic Save → 'Go', Properties) → reload 보존 ──
  await state(
    page,
    (id) => window.__composition_STORE__.getState().setSelectedElement(id),
    NESTED_SAVE,
  );
  await page.waitForTimeout(600);
  await setPanel(page, "properties", true);
  await page.waitForTimeout(800);
  const panel = page.locator('[data-panel-id="properties"]');
  const inputs = panel.locator("input");
  let saveInput = null;
  for (let i = 0; i < (await inputs.count()); i += 1) {
    const c = inputs.nth(i);
    if (((await c.inputValue().catch(() => "")) ?? "") === "Save") {
      saveInput = c;
      break;
    }
  }
  if (saveInput) {
    await saveInput.click({ clickCount: 3 });
    await saveInput.fill("Go");
    await saveInput.press("Enter");
    await page.waitForTimeout(1200);
  }
  const formInstance = await elementById(page, FORM_INSTANCE);
  const goText = await waitFor(
    () => skiaText(page, NESTED_SAVE),
    (t) => t?.content === "Go",
  );
  const previewGo = await waitFor(
    () => previewButtons(page, FORM_INSTANCE),
    (p) => p?.Go,
    15_000,
  );
  record(
    "P3-c-1: synthetic Save 선택 → Properties Text 'Go' → 바깥 instance descendants 하나 · Skia 'Go' · Preview 'Go' (폭 200 유지)",
    saveInput !== null &&
      formInstance?.descendants?.[NESTED_SAVE_PATH]?.children === "Go" &&
      Object.keys(formInstance?.descendants ?? {}).length === 1 &&
      goText?.content === "Go" &&
      previewGo?.Go?.w === 200,
    JSON.stringify({
      hasInput: saveInput !== null,
      descendants: formInstance?.descendants,
      goText,
      previewGo,
    }),
  );
  await setPanel(page, "properties", false);

  const bodyBeforeReload = await componentsBodySnapshot(page);
  await page.waitForTimeout(3000);
  await page.reload({ waitUntil: "networkidle" });
  await waitReady(page);
  await ensureCompareMode(page);
  const bodyAfterReload = await componentsBodySnapshot(page);
  await focusOn(page, TAG_INSTANCE);
  const chipsReloaded = await waitFor(
    () => chipRects(page),
    (s) => approx(s.c?.h, 38, 0.5),
    15_000,
  );
  const previewReloaded = await waitFor(
    () => previewChips(page),
    (p) => p?.Gamma?.paddingLeft === "24px",
    15_000,
  );
  const saveReloaded = await waitFor(
    () => layoutRect(page, NESTED_SAVE),
    (r) => r?.w === 200,
    15_000,
  );
  const goReloaded = await skiaText(page, NESTED_SAVE);
  const previewFormReloaded = await waitFor(
    () => previewButtons(page, FORM_INSTANCE),
    (p) => p?.Go?.w === 200,
    15_000,
  );
  const previewToolbarReloaded = await waitFor(
    () => previewButtons(page, TOOLBAR_INSTANCE),
    (p) => p?.["Action 1"]?.w === 200,
    15_000,
  );
  record(
    "P3-c-2: reload → Tag chip 38 · padding 24px · weight 700 · icon 20px (두 leg) · Button 폭 200 (Form Save/Cancel · Toolbar, 두 leg) · 'Go' 보존 · Components body 로드 직후 ↔ reload Δnode 0 · Δbyte 0 · 직렬화 동일",
    approx(chipsReloaded.c?.h, 38, 0.5) &&
      chipsReloaded.c?.fontWeight === 700 &&
      previewReloaded?.Gamma?.paddingLeft === "24px" &&
      previewReloaded?.Gamma?.fontWeight === "700" &&
      previewReloaded?.Alpha?.icon?.fontSize === "20px" &&
      approx(previewReloaded?.Gamma?.w, chipsReloaded.c?.w, 3) &&
      saveReloaded?.w === 200 &&
      goReloaded?.content === "Go" &&
      previewFormReloaded?.Go?.w === 200 &&
      previewToolbarReloaded?.["Action 1"]?.w === 200 &&
      bodyBeforeReload.n === bodyAfterReload.n &&
      bodyBeforeReload.bytes === bodyAfterReload.bytes &&
      JSON.stringify(bodyBeforeReload.tree) ===
        JSON.stringify(bodyAfterReload.tree) &&
      bodyAfterReload.n === bodyBefore.n,
    JSON.stringify({
      chips: chipsReloaded,
      preview: previewReloaded,
      save: saveReloaded,
      go: goReloaded,
      form: previewFormReloaded,
      toolbar: previewToolbarReloaded,
      body: {
        before: bodyBefore.n,
        beforeReload: bodyBeforeReload.n,
        afterReload: bodyAfterReload.n,
        bytes: [bodyBeforeReload.bytes, bodyAfterReload.bytes],
      },
    }),
  );
  await page.screenshot({ path: resolve(OUT_DIR, "c2-reload.png") });

  record(
    "page error 0 · dialog 0",
    errors.length === 0 && dialogs === 0,
    `${errors.length} / ${dialogs} ${errors.slice(0, 2).join(" | ")}`,
  );
} catch (e) {
  record("harness", false, String(e?.stack ?? e));
  await page
    .screenshot({ path: resolve(OUT_DIR, "error.png") })
    .catch(() => {});
} finally {
  writeFileSync(
    resolve(OUT_DIR, "findings.json"),
    JSON.stringify(
      { findings, errors, dialogs, at: new Date().toISOString() },
      null,
      2,
    ),
  );
  const pass = findings.filter((f) => f.pass).length;
  log(`${pass}/${findings.length} PASS · errors ${errors.length}`);
  await browser.close();
  process.exit(pass === findings.length ? 0 : 1);
}
