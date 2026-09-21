#!/usr/bin/env node
// adr230-state-origins-live.mjs — ADR-230 Phase 1 G2 live (실제 빌더, headed Playwright).
//   기본 요소의 상태 변형 origin (`<origin>--selected|disabled`) 을 두 leg 가 유효 상태로 읽는지 본다.
//   L1) Components body — 기본 요소 5 마다 변형 origin 이 default 바로 오른쪽에 시드 (8 root).
//   L2) Skia 픽셀 — `ToggleButton/Selected` fills 빨강 → `isSelected` instance 빨강 · 미선택 instance 불변 ·
//       `Button/Disabled` opacity 0.5 → `isDisabled` instance 픽셀 = 0.5·blue + 0.5·white (한 번만 — 0.38 과
//       곱하지 않는다, h1) · 편집 전은 catalog 0.38 합성.
//   L3) Preview computed (Compare Mode) — instance A background rgb(255,0,0) · B 아님 · C opacity 0.5 ·
//       Form instance 안 Save (229 ref, descendants isDisabled) opacity 0.5 — 상속.
//   (변형 origin 자신의 Components 페이지 시각은 unit — `buildSpecNodeData.test.ts` "변형 origin 자신" · Components 페이지는
//    프레임 안 스크롤이라 카메라 pan 으로 못 올리고 Preview 는 system 페이지를 안 그린다.)
//   L5) instance 명시 opacity 0.8 이 상태 origin 0.5 보다 우선 (두 leg).
//   L6) Preview 직접 클릭 — 미선택 B 를 누르면 canonical 변경 없이 RAC 상태로 빨강 (m3 DOM 축) · 다시 누르면 복귀.
//   L7) reload → 두 leg 보존 · Components body Δ0.
//   page error 0 · dialog 0.
// 사용: node apps/builder/scripts/adr230-state-origins-live.mjs [--headed]  (dev 5173 · .auth-session.json)
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
const OUT_DIR = process.env.ADR230_OUT ?? "/private/tmp/adr230-p1-live";
const headed = process.argv.includes("--headed");
const log = (...a) => console.log("[adr230 p1]", ...a);
const findings = [];
const record = (name, pass, detail) => {
  findings.push({ name, pass, detail });
  log(`${pass ? "PASS" : "FAIL"} — ${name} :: ${detail}`);
};

const TOGGLE_ORIGIN = "component-togglebutton";
const TOGGLE_SELECTED = `${TOGGLE_ORIGIN}--selected`;
const BUTTON_ORIGIN = "component-button";
const BUTTON_DISABLED = `${BUTTON_ORIGIN}--disabled`;
const A = "adr230-toggle-selected";
const B = "adr230-toggle-plain";
const C = "adr230-button-disabled";
const D = "adr230-button-enabled";
const FORM = "adr230-form";
const NESTED_SAVE_PATH = "ButtonGroup/component-buttongroup__2";
const NESTED_SAVE = `${FORM}/${NESTED_SAVE_PATH}`;
const EXPECTED_VARIANT_ROOTS = [
  "component-button--disabled",
  "component-togglebutton--selected",
  "component-togglebutton--disabled",
  "component-link--disabled",
  "component-checkbox--selected",
  "component-checkbox--disabled",
  "component-switch--selected",
  "component-switch--disabled",
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
            ref: e.ref ?? null,
            props: e.props ?? {},
            fills: e.fills ?? null,
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
        ?.get(id);
      return l
        ? { x: l.x, y: l.y, w: Math.round(l.width), h: Math.round(l.height) }
        : null;
    },
    id,
  );
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
        props: e.props ?? {},
        // fill id 는 hydration 마다 새로 나는 값 (ListBox selected origin — 230 밖) · metadata 는 편집 mirror
        //   (`sourceParentId` …) 가 붙는다 — 둘 다 직렬화 불변 판정에서 뺀다 (229 G4 스냅샷과 같은 축).
        fills: Array.isArray(e.fills)
          ? e.fills.map(({ id: _id, ...rest }) => rest)
          : null,
        children: walk(e.id),
      }));
    const tree = walk(body?.id);
    const count = (nodes) =>
      nodes.reduce((n, c) => n + 1 + count(c.children), 0);
    return {
      n: count(tree),
      bytes: JSON.stringify(tree).length,
      rootIds: tree.map((t) => t.id),
      tree,
    };
  });
/** Preview leg — `[data-element-id]` 의 computed (background/opacity) + data 속성. */
const previewComputed = (page, id) =>
  state(
    page,
    (id) => {
      for (const f of document.querySelectorAll("iframe")) {
        const doc = f.contentDocument;
        const nodes = doc?.querySelectorAll(`[data-element-id="${id}"]`);
        if (!nodes?.length) continue;
        // wrapper (display:contents) 가 아니라 RAC 요소 — button/label 우선
        const el =
          [...nodes].find((n) => n.matches("button, label, a")) ??
          nodes[nodes.length - 1];
        const r = el.getBoundingClientRect();
        if (r.width === 0) continue;
        const cs = doc.defaultView.getComputedStyle(el);
        return {
          tag: el.tagName.toLowerCase(),
          bg: cs.backgroundColor,
          opacity: cs.opacity,
          selected: el.hasAttribute("data-selected"),
          disabled: el.hasAttribute("data-disabled"),
          // 표식은 RAC 요소 (generic 경로) 또는 display:contents wrapper (rendererMap 위임) 에 있다
          stateOrigin:
            el.getAttribute("data-state-origin") ??
            el.parentElement?.getAttribute("data-state-origin") ??
            null,
          inlineBg: el.style.backgroundColor,
        };
      }
      return null;
    },
    id,
  );
const previewNestedButton = (page, instanceId, text) =>
  state(
    page,
    ({ instanceId, text }) => {
      for (const f of document.querySelectorAll("iframe")) {
        const doc = f.contentDocument;
        const wrapper = doc?.querySelector(`[data-element-id="${instanceId}"]`);
        if (!wrapper) continue;
        for (const b of wrapper.querySelectorAll("button")) {
          if ((b.textContent ?? "").trim() !== text) continue;
          const cs = doc.defaultView.getComputedStyle(b);
          return {
            opacity: cs.opacity,
            disabled: b.hasAttribute("data-disabled"),
            stateOrigin:
              b.getAttribute("data-state-origin") ??
              b.parentElement?.getAttribute("data-state-origin") ??
              null,
          };
        }
      }
      return null;
    },
    { instanceId, text },
  );
const previewClick = (page, id) =>
  state(
    page,
    (id) => {
      for (const f of document.querySelectorAll("iframe")) {
        const doc = f.contentDocument;
        const el = doc?.querySelector(`button[data-element-id="${id}"]`);
        if (!el) continue;
        el.click();
        return true;
      }
      return false;
    },
    id,
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
const closeRgb = (a, b, tol = 8) =>
  a && b && a.every((v, i) => Math.abs(v - b[i]) <= tol);
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
          f.contentDocument?.querySelector("[data-element-id]"),
        ),
      null,
      { timeout: 15_000 },
    )
    .catch(() => {});
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
/** 요소 top-left 를 캔버스 (at) 에 두고 선택 해제 (scale 1). */
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
        ?.get(id);
      window.__composition_APPLY_VIEWPORT__?.({
        scale: 1,
        x: at.x - (pos.x + (l?.x ?? 0)),
        y: at.y - (pos.y + (l?.y ?? 0)),
      });
      st.setSelectedElement(null);
    },
    { id, at },
  );
  await page.waitForTimeout(900);
}
/** 요소의 화면 위치 — 실제 viewport (panOffset · zoom) 로 계산 (pan 이 clamp 되어도 맞다). */
const screenRect = (page, id) =>
  state(
    page,
    (id) => {
      const st = window.__composition_STORE__.getState();
      const el = st.elements.find((e) => e.id === id);
      const positions = st.pagePositions;
      const pos = (positions instanceof Map
        ? positions.get(el?.page_id)
        : positions?.[el?.page_id]) ?? { x: 0, y: 0 };
      const l = window.__composition_LAYOUT_DEBUG__
        ?.getSharedLayoutMap?.()
        ?.get(id);
      const vp = window.__composition_VIEWPORT__?.();
      const pan = vp?.panOffset ?? { x: 0, y: 0 };
      const zoom = vp?.zoom ?? 1;
      if (!l) return null;
      return {
        x: pan.x + (pos.x + l.x) * zoom,
        y: pan.y + (pos.y + l.y) * zoom,
        w: l.width * zoom,
        h: l.height * zoom,
        zoom,
      };
    },
    id,
  );
/** Skia 픽셀 — focusOn 뒤 요소 안쪽 점 (왼쪽 패딩 영역, 글자 밖) RGB. */
async function skiaPixel(page, id, name) {
  await focusOn(page, id);
  await page.mouse.move(2, 890);
  await page.waitForTimeout(400);
  const rect = await screenRect(page, id);
  const box = await page.locator("canvas").first().boundingBox();
  const png = await page.screenshot({ type: "png", animations: "disabled" });
  if (name) writeFileSync(resolve(OUT_DIR, `${name}.png`), png);
  const p = PNG.sync.read(png);
  const sx = Math.round(box.x + (rect?.x ?? 200) + 5);
  const sy = Math.round(box.y + (rect?.y ?? 200) + (rect?.h ?? 32) / 2);
  const i = (sy * p.width + sx) * 4;
  return {
    rgb: [p.data[i], p.data[i + 1], p.data[i + 2]],
    at: [sx, sy],
    rect,
  };
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
    },
    { id, updates },
  );
  await page.waitForTimeout(400);
  const dialog = await confirmImpactDialog(page);
  await page.waitForTimeout(900);
  return dialog;
}
const mix = (fg, alpha) =>
  fg.map((v) => Math.round(v * alpha + 255 * (1 - alpha)));

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
  await input.fill(`adr230p1-${Date.now()}`);
  await input.press("Enter");
  await page.waitForURL(/\/builder\/[^/?]+$/, { timeout: 90_000 });
  await waitReady(page);
  log("project", page.url().split("/builder/")[1]);

  // ── L1: Components body 변형 origin 시드 · default 바로 오른쪽 ──
  const body0 = await componentsBodySnapshot(page);
  const ids = body0.rootIds;
  const rightAfterDefault = EXPECTED_VARIANT_ROOTS.every((vid) => {
    const base = vid.split("--")[0];
    const i = ids.indexOf(base);
    const j = ids.indexOf(vid);
    return i >= 0 && j > i && j - i <= 2;
  });
  const selectedOrigin = await elementById(page, TOGGLE_SELECTED);
  record(
    "L1: Components body — 변형 origin 8 root 가 default 바로 오른쪽 (≤ 2 칸) · style 비움 · isSelected 미굽기",
    rightAfterDefault &&
      selectedOrigin?.type === "ToggleButton" &&
      selectedOrigin?.props?.isSelected !== true &&
      Object.keys(selectedOrigin?.props?.style ?? {}).length === 0,
    JSON.stringify({
      n: body0.n,
      variants: EXPECTED_VARIANT_ROOTS.map((v) => ids.indexOf(v)),
      origin: selectedOrigin?.props,
    }),
  );

  // ── seed: 사용자 페이지 instance 4 + Form instance (Save 를 descendants 로 disabled) ──
  await state(
    page,
    ({ A, B, C, D, FORM, NESTED_SAVE_PATH }) => {
      const st = window.__composition_STORE__.getState();
      const body = st.elements.find(
        (e) => e.type === "body" && e.page_id === st.currentPageId,
      );
      const now = new Date().toISOString();
      const add = (id, ref, componentName, props, extra = {}) =>
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
          ...extra,
        });
      add(A, "component-togglebutton", "ToggleButton", {
        isSelected: true,
        children: "Selected",
      });
      add(B, "component-togglebutton", "ToggleButton", { children: "Plain" });
      add(C, "component-button", "Button", {
        isDisabled: true,
        children: "Disabled",
      });
      add(D, "component-button", "Button", { children: "Enabled" });
      add(
        FORM,
        "component-form",
        "Form",
        {},
        { descendants: { [NESTED_SAVE_PATH]: { isDisabled: true } } },
      );
    },
    { A, B, C, D, FORM, NESTED_SAVE_PATH },
  );
  await page.waitForTimeout(1800);

  // ── L2-0: 편집 전 — 색 기준 (D 파랑 · C = 0.38 합성 · A/B 는 selected 토큰) ──
  const dPx = await waitFor(
    () => skiaPixel(page, D, "l2-0-enabled"),
    (p) => !closeRgb(p.rgb, [255, 255, 255], 4),
  );
  const cPx0 = await waitFor(
    () => skiaPixel(page, C, "l2-0-disabled"),
    (p) => closeRgb(p.rgb, mix(dPx.rgb, 0.38), 10),
  );
  const aPx0 = await skiaPixel(page, A, "l2-0-selected");
  const bPx0 = await skiaPixel(page, B, "l2-0-plain");
  record(
    "L2-0: 편집 전 — disabled Button 픽셀 = catalog 0.38 합성 (0.38·blue + 0.62·white) · A ≠ 빨강",
    closeRgb(cPx0.rgb, mix(dPx.rgb, 0.38), 10) &&
      !closeRgb(aPx0.rgb, [255, 0, 0], 40),
    JSON.stringify({
      d: dPx.rgb,
      c: cPx0.rgb,
      expect: mix(dPx.rgb, 0.38),
      a: aPx0.rgb,
      b: bPx0.rgb,
    }),
  );

  // ── L2-1: ToggleButton/Selected fills 빨강 · Button/Disabled opacity 0.5 ──
  await editOrigin(page, TOGGLE_SELECTED, {
    fills: [
      {
        id: "adr230-red",
        type: "color",
        color: "#FF0000",
        opacity: 1,
        enabled: true,
      },
    ],
  });
  await editOrigin(page, BUTTON_DISABLED, { style: { opacity: 0.5 } });
  const aPx1 = await waitFor(
    () => skiaPixel(page, A),
    (p) => closeRgb(p.rgb, [255, 0, 0], 12),
  );
  writeFileSync(resolve(OUT_DIR, "l2-1-selected.png"), await page.screenshot());
  const bPx1 = await skiaPixel(page, B, "l2-1-plain");
  const cPx1 = await waitFor(
    () => skiaPixel(page, C),
    (p) => closeRgb(p.rgb, mix(dPx.rgb, 0.5), 10),
  );
  record(
    "L2-1: Skia — isSelected instance 빨강 · 미선택 instance 불변 · isDisabled instance = 0.5·blue + 0.5·white (0.38 과 곱하면 0.19 — h1)",
    closeRgb(aPx1.rgb, [255, 0, 0], 12) &&
      closeRgb(bPx1.rgb, bPx0.rgb, 6) &&
      closeRgb(cPx1.rgb, mix(dPx.rgb, 0.5), 10) &&
      !closeRgb(cPx1.rgb, mix(dPx.rgb, 0.19), 10),
    JSON.stringify({
      a: aPx1.rgb,
      b: [bPx0.rgb, bPx1.rgb],
      c: cPx1.rgb,
      expect05: mix(dPx.rgb, 0.5),
      double019: mix(dPx.rgb, 0.19),
    }),
  );

  // ── L3: Preview computed ──
  await ensureCompareMode(page);
  const pA = await waitFor(
    () => previewComputed(page, A),
    (p) => p?.bg === "rgb(255, 0, 0)",
    15_000,
  );
  const pB = await previewComputed(page, B);
  const pC = await waitFor(
    () => previewComputed(page, C),
    (p) => p?.opacity === "0.5",
    15_000,
  );
  const pSave = await waitFor(
    () => previewNestedButton(page, FORM, "Save"),
    (p) => p?.opacity === "0.5",
    15_000,
  );
  record(
    "L3: Preview — A background rgb(255,0,0) (data-selected · data-state-origin) · B 아님 · C opacity 0.5 (data-disabled) · Form 안 Save (229 ref + descendants isDisabled) opacity 0.5",
    pA?.bg === "rgb(255, 0, 0)" &&
      pA?.selected === true &&
      pA?.stateOrigin === TOGGLE_ORIGIN &&
      pB?.bg !== "rgb(255, 0, 0)" &&
      pB?.selected === false &&
      pC?.opacity === "0.5" &&
      pC?.disabled === true &&
      pSave?.opacity === "0.5" &&
      pSave?.disabled === true,
    JSON.stringify({ A: pA, B: pB, C: pC, save: pSave }),
  );
  await page.screenshot({ path: resolve(OUT_DIR, "l3-compare.png") });

  // ── L5: instance 명시 opacity 0.8 > 상태 origin 0.5 ──
  await state(
    page,
    (C) => {
      const st = window.__composition_STORE__.getState();
      const el = st.elements.find((e) => e.id === C);
      st.updateElementProps(C, {
        style: { ...(el?.props?.style ?? {}), opacity: 0.8 },
      });
    },
    C,
  );
  const cPx2 = await waitFor(
    () => skiaPixel(page, C),
    (p) => closeRgb(p.rgb, mix(dPx.rgb, 0.8), 10),
  );
  const pC2 = await waitFor(
    () => previewComputed(page, C),
    (p) => p?.opacity === "0.8",
    15_000,
  );
  record(
    "L5: instance 명시 opacity 0.8 이 Button/Disabled 0.5 보다 우선 — Skia 0.8 합성 · Preview opacity 0.8",
    closeRgb(cPx2.rgb, mix(dPx.rgb, 0.8), 10) && pC2?.opacity === "0.8",
    JSON.stringify({ skia: cPx2.rgb, expect: mix(dPx.rgb, 0.8), preview: pC2 }),
  );

  // ── L6: Preview 직접 클릭 — canonical 변경 없이 RAC 상태 → 빨강 (m3 DOM 축) ──
  const bBefore = await elementById(page, B);
  await previewClick(page, B);
  const pBClicked = await waitFor(
    () => previewComputed(page, B),
    (p) => p?.bg === "rgb(255, 0, 0)",
    8_000,
  );
  const bAfter = await elementById(page, B);
  await previewClick(page, B);
  const pBReleased = await waitFor(
    () => previewComputed(page, B),
    (p) => p?.bg !== "rgb(255, 0, 0)",
    8_000,
  );
  record(
    "L6: Preview 에서 미선택 B 클릭 → data-selected + 빨강 (RAC 실제 상태) · 다시 클릭 → 복귀 · canonical isSelected 는 클릭으로 바뀌지 않는다",
    pBClicked?.bg === "rgb(255, 0, 0)" &&
      pBClicked?.selected === true &&
      pBReleased?.bg !== "rgb(255, 0, 0)" &&
      bBefore?.props?.isSelected === bAfter?.props?.isSelected,
    JSON.stringify({
      clicked: pBClicked,
      released: pBReleased,
      canonical: [bBefore?.props?.isSelected, bAfter?.props?.isSelected],
    }),
  );

  // ── L7: reload → 보존 ──
  const bodyBeforeReload = await componentsBodySnapshot(page);
  await page.waitForTimeout(3000);
  await page.reload({ waitUntil: "networkidle" });
  await waitReady(page);
  const bodyAfterReload = await componentsBodySnapshot(page);
  writeFileSync(
    resolve(OUT_DIR, "body-before-reload.json"),
    JSON.stringify(bodyBeforeReload.tree, null, 1),
  );
  writeFileSync(
    resolve(OUT_DIR, "body-after-reload.json"),
    JSON.stringify(bodyAfterReload.tree, null, 1),
  );
  const aPxR = await waitFor(
    () => skiaPixel(page, A),
    (p) => closeRgb(p.rgb, [255, 0, 0], 12),
    15_000,
  );
  await ensureCompareMode(page);
  const pAR = await waitFor(
    () => previewComputed(page, A),
    (p) => p?.bg === "rgb(255, 0, 0)",
    15_000,
  );
  const pCR = await waitFor(
    () => previewComputed(page, C),
    (p) => p?.opacity === "0.8",
    15_000,
  );
  record(
    "L7: reload — A 빨강 (Skia · Preview) · C opacity 0.8 · Components body Δnode 0 · Δbyte 0",
    closeRgb(aPxR.rgb, [255, 0, 0], 12) &&
      pAR?.bg === "rgb(255, 0, 0)" &&
      pCR?.opacity === "0.8" &&
      bodyBeforeReload.n === bodyAfterReload.n &&
      bodyBeforeReload.bytes === bodyAfterReload.bytes,
    JSON.stringify({
      a: aPxR.rgb,
      preview: pAR,
      c: pCR,
      body: [
        bodyBeforeReload.n,
        bodyAfterReload.n,
        bodyBeforeReload.bytes,
        bodyAfterReload.bytes,
      ],
    }),
  );

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
