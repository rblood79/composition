#!/usr/bin/env node
// adr228-reusable-origins-live.mjs — ADR-228 팔레트 전 항목 reusable origin live (실제 빌더, headed Playwright).
//   G1) 새 프로젝트 → Components 페이지에 origin R 57 전부 (+ item template origin 4) · 팔레트 추가가
//       type:"ref" + ref=component-<type> + 명시 initialProps 만 (Chart 진입점 chartType) · plain 무변화
//   G2) instance 선택 → Properties 패널이 origin type 의 accepts 필드를 보인다 · 패널 편집이 instance
//       override 로 기록 · origin 편집 → Preview DOM 의 instance 가 따라온다 (override 필드는 유지)
//       · 복제 (⌘D) · Undo/Redo · Skia layout rect 가 plain 노드와 같다 (같은 props)
//   G3) Components 페이지 origin root 삭제 거부 · 사용자 페이지 origin 편집 후 reload 보존
//   page error 0 · native dialog 0
// 사용: node apps/builder/scripts/adr228-reusable-origins-live.mjs [--headed] [--types=A,B]
//       (dev 서버 5173 · .auth-session.json)
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { waitReady } from "./perf-baseline.mjs";

const BASE_URL = "http://localhost:5173";
const STORAGE_STATE = resolve("apps/builder/scripts/.auth-session.json");
const OUT_DIR = process.env.ADR228_OUT ?? "/private/tmp/adr228-live";
const headed = process.argv.includes("--headed");
const typesArg = process.argv.find((a) => a.startsWith("--types="));
const TYPES = typesArg
  ? typesArg.slice(8).split(",")
  : ["Button", "TextField", "Select", "Badge", "Table"];
const log = (...a) => console.log("[adr228 live]", ...a);
const findings = [];
const record = (name, pass, detail) => {
  findings.push({ name, pass, detail });
  log(`${pass ? "PASS" : "FAIL"} — ${name} :: ${detail}`);
};

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
            componentName: e.componentName ?? null,
            props: e.props ?? {},
            parent_id: e.parent_id ?? null,
            page_id: e.page_id ?? null,
          }
        : null;
    },
    id,
  );

async function addFromPalette(page, label, type) {
  await setPanel(page, "components", true);
  await state(page, () =>
    window.__composition_STORE__.getState().setSelectedElement(null),
  );
  const before = await state(
    page,
    (t) =>
      window.__composition_STORE__
        .getState()
        .elements.filter((e) => e.type === t || e.componentName === t)
        .map((e) => e.id),
    type,
  );
  const search = page
    .locator(
      '[data-panel-id="components"] input[type="search"], [data-panel-id="components"] input',
    )
    .first();
  await search.waitFor({ state: "visible", timeout: 20_000 });
  await search.fill(label);
  await page.waitForTimeout(400);
  const items = page.locator(`[data-panel-id="components"] .list-item`);
  const n = await items.count();
  let item = null;
  for (let i = 0; i < n; i++) {
    const text =
      (await items.nth(i).locator(".list-item-name").textContent()) ?? "";
    if (
      text.replace(/\s+/g, "").toLowerCase() ===
      label.replace(/\s+/g, "").toLowerCase()
    ) {
      item = items.nth(i);
      break;
    }
  }
  if (!item) throw new Error(`팔레트에 ${label} 없음 (${n} items)`);
  await item.click();
  const id = await page
    .waitForFunction(
      ({ t, before }) =>
        window.__composition_STORE__
          .getState()
          .elements.find(
            (e) =>
              (e.type === t || e.componentName === t) && !before.includes(e.id),
          )?.id ?? null,
      { t: type, before },
      { timeout: 15_000 },
    )
    .then((h) => h.jsonValue())
    .catch(() => null);
  await page.waitForTimeout(600);
  if (!id) throw new Error(`${label} 미생성`);
  await setPanel(page, "components", false);
  return id;
}

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
}

/** Preview iframe 의 instance DOM 스냅샷 (data-element-id 접두 일치). */
async function readPreview(page, elementId, timeoutMs = 12_000) {
  await page
    .waitForFunction(
      (id) =>
        [...document.querySelectorAll("iframe")].some((f) =>
          f.contentDocument?.querySelector(`[data-element-id="${id}"]`),
        ),
      elementId,
      { timeout: timeoutMs },
    )
    .catch(() => {});
  return state(
    page,
    (id) => {
      for (const frame of document.querySelectorAll("iframe")) {
        const doc = frame.contentDocument;
        // ref instance 는 `display: contents` 래퍼 + 실제 요소가 같은 data-element-id — 크기 있는 쪽.
        const matches = [
          ...(doc?.querySelectorAll(`[data-element-id="${id}"]`) ?? []),
        ];
        const el =
          matches.find((m) => m.getBoundingClientRect().width > 0) ??
          matches[0];
        if (!el) continue;
        const rect = el.getBoundingClientRect();
        return {
          found: true,
          tag: el.tagName,
          className: el.className,
          variant: el.getAttribute("data-variant"),
          size: el.getAttribute("data-size"),
          text: (el.textContent ?? "").slice(0, 80),
          w: Math.round(rect.width),
          h: Math.round(rect.height),
        };
      }
      return { found: false };
    },
    elementId,
  );
}
async function waitPreview(page, elementId, predicate, timeoutMs = 12_000) {
  const start = Date.now();
  let last = await readPreview(page, elementId);
  while (!predicate(last) && Date.now() - start < timeoutMs) {
    await page.waitForTimeout(500);
    last = await readPreview(page, elementId);
  }
  return last;
}

const layoutRect = (page, id) =>
  state(
    page,
    (id) => {
      const l = window.__composition_LAYOUT_DEBUG__
        ?.getSharedLayoutMap?.()
        .get(id);
      return l ? { w: Math.round(l.width), h: Math.round(l.height) } : null;
    },
    id,
  );

/**
 * origin 편집 — instance 가 있으면 EditingSemantics 영향 대화상자 (`.editing-impact-modal`) 가
 * 뜬다 (기존 origin 편집 계약). 「Continue」 를 눌러 승인한다.
 */
async function updateOrigin(page, originId, patch) {
  await state(
    page,
    ({ originId, patch }) => {
      window.__composition_STORE__
        .getState()
        .updateElementProps(originId, patch);
    },
    { originId, patch },
  );
  const actions = page.locator(".editing-impact-actions button");
  const start = Date.now();
  while (Date.now() - start < 3000) {
    if ((await actions.count()) > 0) {
      await actions.last().click();
      await page.waitForTimeout(600);
      return "confirmed";
    }
    await page.waitForTimeout(150);
  }
  return "no-dialog";
}

/** IndexedDB document_parts 에 node 의 값이 반영될 때까지 (persist 는 백그라운드). */
async function waitPersisted(page, nodeId, predicate, timeoutMs = 15_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const value = await state(
      page,
      async (nodeId) => {
        const db = await new Promise((res, rej) => {
          const r = indexedDB.open("composition");
          r.onsuccess = () => res(r.result);
          r.onerror = () => rej(r.error);
        });
        const rows = await new Promise((res, rej) => {
          const r = db
            .transaction("document_parts", "readonly")
            .objectStore("document_parts")
            .getAll();
          r.onsuccess = () => res(r.result);
          r.onerror = () => rej(r.error);
        });
        db.close();
        const pid = location.pathname.split("/builder/")[1];
        const row = rows.find(
          (r) => r.project_id === pid && r.key === `node:${nodeId}`,
        );
        return row ? String(row.value) : null;
      },
      nodeId,
    );
    if (value && predicate(value)) return true;
    await page.waitForTimeout(500);
  }
  return false;
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
  await input.fill(`adr228-${Date.now()}`);
  await input.press("Enter");
  await page.waitForURL(/\/builder\/[^/?]+$/, { timeout: 90_000 });
  await waitReady(page);
  const projectId = page.url().split("/builder/")[1];
  log("project", projectId);

  // ── G1-a: origin R 전부 Components 페이지에 ──
  const origins = await state(page, () => {
    const st = window.__composition_STORE__.getState();
    const body = st.elements.find((e) => e.id === "page-components-body");
    const roots = st.elements.filter((e) => e.parent_id === body?.id);
    return {
      total: st.elements.length,
      roots: roots.map((e) => ({
        id: e.id,
        type: e.type,
        reusable: e.reusable,
      })),
    };
  });
  const rootIds = new Set(origins.roots.map((r) => r.id));
  const expected = [
    "component-toolbar",
    "component-form",
    "component-iconbutton",
    "component-inline-alert",
    "component-card",
    "component-listbox",
    "component-gridlist",
    ...[
      "Badge",
      "ProgressBar",
      "Avatar",
      "AvatarGroup",
      "StatusLight",
      "ProgressCircle",
      "Tabs",
      "Breadcrumbs",
      "Link",
      "Nav",
      "Pagination",
      "DisclosureGroup",
      "Disclosure",
      "CardView",
      "Button",
      "ToggleButton",
      "ToggleButtonGroup",
      "ButtonGroup",
      "Menu",
      "TextField",
      "TextArea",
      "NumberField",
      "SearchField",
      "ColorField",
      "Checkbox",
      "CheckboxGroup",
      "RadioGroup",
      "Select",
      "ComboBox",
      "Switch",
      "Slider",
      "Meter",
      "DropZone",
      "FileTrigger",
      "FileUpload",
      "Table",
      "Tree",
      "TagGroup",
      "TableView",
      "Chart",
      "Calendar",
      "DatePicker",
      "DateRangePicker",
      "DateField",
      "TimeField",
      "RangeCalendar",
      "Dialog",
      "Modal",
      "Popover",
      "Tooltip",
    ].map((t) => `component-${t.toLowerCase()}`),
  ];
  const missing = expected.filter((id) => !rootIds.has(id));
  record(
    "G1-a: Components body 에 origin R 57 전부",
    missing.length === 0,
    `roots ${origins.roots.length} (R 57 + item template 4 기대 61) · elements ${origins.total} · missing ${missing.join(",") || "0"}`,
  );

  await ensureCompareMode(page);

  // ── G1-b: 팔레트 추가 = ref instance (명시 initialProps 만) ──
  const created = {};
  for (const type of TYPES) {
    const label = type.replace(/([a-z])([A-Z])/g, "$1 $2");
    const id = await addFromPalette(page, label, type);
    const el = await elementById(page, id);
    created[type] = id;
    record(
      `G1-b: ${type} 팔레트 추가 → ref instance`,
      el?.type === "ref" &&
        el.ref === `component-${type.toLowerCase()}` &&
        el.componentName === type &&
        Object.keys(el.props).length === 0 &&
        el.page_id !== "page-components",
      JSON.stringify({
        type: el?.type,
        ref: el?.ref,
        props: el?.props,
        page: el?.page_id,
      }),
    );
  }
  // Chart 진입점 — 명시 chartType 만 instance 소유
  const chartId = await addFromPalette(page, "bar chart", "Chart");
  const chart = await elementById(page, chartId);
  const chartOrigin = await elementById(page, "component-chart");
  // 명시 patch = 진입점이 origin 과 다르게 명시한 키만 (chartType 은 항상) — origin 과 같은 값은 0.
  const chartPatchOnlyDiffers = Object.entries(chart?.props ?? {}).every(
    ([k, v]) =>
      k === "chartType" ||
      JSON.stringify(chartOrigin?.props?.[k]) !== JSON.stringify(v),
  );
  record(
    "G1-b: Chart 「bar chart」 진입점 → ref + 명시 patch 만 (chartType + origin 과 다른 키, ≤ 3)",
    chart?.type === "ref" &&
      chart.ref === "component-chart" &&
      chart.props.chartType === "bar" &&
      chartPatchOnlyDiffers &&
      Object.keys(chart.props).length <= 3,
    `${JSON.stringify(chart?.props)} · origin keys ${Object.keys(chartOrigin?.props ?? {}).length}`,
  );
  created.Chart = chartId;

  // ── G1-c: 두 leg 렌더 — Preview DOM 에 instance 가 origin type 으로 실체화 ──
  for (const type of ["Button", "TextField", "Select"]) {
    const id = created[type];
    if (!id) continue;
    const preview = await waitPreview(page, id, (p) => p.found);
    record(
      `G1-c: ${type} instance 가 Preview DOM 에 실체화`,
      preview.found && preview.w > 0 && preview.h > 0,
      JSON.stringify(preview),
    );
  }
  const btnRect = await layoutRect(page, created.Button);
  record(
    "G1-c: Button instance 의 Skia layout rect > 0",
    !!btnRect && btnRect.w > 0 && btnRect.h > 0,
    JSON.stringify(btnRect),
  );
  await page.screenshot({ path: resolve(OUT_DIR, "g1-instances.png") });

  // ── G2-a: Properties 패널 — origin type 의 accepts 필드 · 편집 = instance override ──
  await state(
    page,
    (id) => window.__composition_STORE__.getState().setSelectedElement(id),
    created.Button,
  );
  await page.waitForTimeout(600);
  await setPanel(page, "properties", true);
  await page.waitForTimeout(800);
  const panel = page.locator('[data-panel-id="properties"]');
  const panelText = (await panel.textContent()) ?? "";
  const hasVariant = /Variant/i.test(panelText) && /Size/i.test(panelText);
  record(
    "G2-a: Button instance 선택 → Properties 에 Variant · Size 필드 (primitive accepts)",
    hasVariant,
    panelText.replace(/\s+/g, " ").slice(0, 200),
  );
  await page.screenshot({ path: resolve(OUT_DIR, "g2-properties-button.png") });

  // 패널의 Text(children) 입력을 편집 → instance props.children 만 기록
  // Content › Text 입력 — 현재 라벨 값("Button") 을 가진 text input (aria-label 없음).
  const textInputs = panel.locator('input[type="text"]');
  const values = await textInputs.evaluateAll((els) => els.map((e) => e.value));
  const textInput = textInputs.nth(Math.max(0, values.indexOf("Button")));
  let overrideOk = false;
  let overrideDetail = "input 없음";
  if (values.includes("Button")) {
    await textInput.click({ clickCount: 3 });
    await textInput.fill("Buy now");
    await textInput.press("Enter");
    await page.waitForTimeout(700);
    const after = await elementById(page, created.Button);
    overrideOk =
      after?.props.children === "Buy now" &&
      Object.keys(after.props).length === 1;
    overrideDetail = JSON.stringify(after?.props);
    const preview = await waitPreview(
      page,
      created.Button,
      (p) => p.found && p.text.includes("Buy now"),
    );
    record(
      "G2-a: 패널 편집 → instance props 는 {children} 하나 (override) · Preview 반영",
      overrideOk && preview.text.includes("Buy now"),
      `${overrideDetail} / preview ${preview.text}`,
    );
  } else {
    record("G2-a: 패널 편집 → instance override", false, overrideDetail);
  }

  // ── G2-b: origin 편집 → instance 전파 (override 필드는 유지) ──
  const dialog1 = await updateOrigin(page, "component-button", {
    variant: "accent",
  });
  const propagated = await waitPreview(
    page,
    created.Button,
    (p) => p.variant === "accent",
  );
  record(
    "G2-b: origin variant=accent → instance Preview data-variant=accent · children override 유지",
    propagated.variant === "accent" && propagated.text.includes("Buy now"),
    `${JSON.stringify(propagated)} · dialog ${dialog1}`,
  );
  await updateOrigin(page, "component-button", { variant: "primary" });
  await waitPreview(page, created.Button, (p) => p.variant === "primary");

  // ── G2-c: 복제 · Undo/Redo ──
  await state(
    page,
    (id) => {
      window.__composition_STORE__.getState().setSelectedElement(id);
      document.querySelector(".canvas-container")?.focus();
    },
    created.Button,
  );
  await page.waitForTimeout(300);
  await page.keyboard.press("Meta+d");
  await page.waitForTimeout(800);
  const dup = await state(
    page,
    (id) => {
      const st = window.__composition_STORE__.getState();
      const refs = st.elements.filter(
        (e) => e.ref === "component-button" && e.id !== id,
      );
      return refs.map((e) => ({ id: e.id, props: e.props }));
    },
    created.Button,
  );
  record(
    "G2-c: ⌘D 복제 → 두 번째 ref instance (props 동일)",
    dup.length === 1 && dup[0].props.children === "Buy now",
    JSON.stringify(dup),
  );
  await state(page, () => window.__composition_STORE__.getState().undo());
  await page.waitForTimeout(500);
  const afterUndo = await state(
    page,
    () =>
      window.__composition_STORE__
        .getState()
        .elements.filter((e) => e.ref === "component-button").length,
  );
  await state(page, () => window.__composition_STORE__.getState().redo());
  await page.waitForTimeout(500);
  const afterRedo = await state(
    page,
    () =>
      window.__composition_STORE__
        .getState()
        .elements.filter((e) => e.ref === "component-button").length,
  );
  record(
    "G2-c: Undo → 1 · Redo → 2",
    afterUndo === 1 && afterRedo === 2,
    `${afterUndo} / ${afterRedo}`,
  );

  // ── G2-d: 같은 props 의 plain 노드와 layout rect 동일 (Skia leg) ──
  const plainId = await state(
    page,
    (refId) => {
      const st = window.__composition_STORE__.getState();
      const inst = st.elements.find((e) => e.id === refId);
      const origin = st.elements.find((e) => e.id === "component-button");
      const id = `plain-${Date.now()}`;
      st.addElement({
        id,
        customId: id,
        type: "Button",
        parent_id: inst.parent_id,
        page_id: inst.page_id,
        props: { ...origin.props, ...inst.props },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      return id;
    },
    created.Button,
  );
  await page.waitForTimeout(1200);
  const refRect = await layoutRect(page, created.Button);
  const plainRect = await layoutRect(page, plainId);
  record(
    "G2-d: ref instance 와 같은 props 의 plain Button — Skia layout w/h 동일",
    !!refRect &&
      !!plainRect &&
      refRect.w === plainRect.w &&
      refRect.h === plainRect.h,
    `ref ${JSON.stringify(refRect)} plain ${JSON.stringify(plainRect)}`,
  );
  const refPrev = await readPreview(page, created.Button);
  const plainPrev = await waitPreview(page, plainId, (p) => p.found);
  record(
    "G2-d: Preview DOM w/h · variant 동일 (DOM leg)",
    refPrev.found &&
      plainPrev.found &&
      refPrev.w === plainPrev.w &&
      refPrev.h === plainPrev.h &&
      refPrev.variant === plainPrev.variant,
    `ref ${JSON.stringify(refPrev)} plain ${JSON.stringify(plainPrev)}`,
  );

  // ── G2-e: Chart 진입점 — origin 공통 속성 변경 → instance 상속 · 명시 chartType 유지 · Undo/Redo ──
  const chartRect0 = await layoutRect(page, created.Chart);
  const chartDialog = await updateOrigin(page, "component-chart", {
    style: { width: 480 },
  });
  await page.waitForTimeout(1200);
  const chartRect1 = await layoutRect(page, created.Chart);
  const chartInst1 = await elementById(page, created.Chart);
  record(
    "G2-e: Chart origin style.width 320→480 → instance Skia width 480 · instance props 는 명시 patch 그대로",
    chartRect0?.w === 320 &&
      chartRect1?.w === 480 &&
      chartInst1?.props.chartType === "bar" &&
      !("style" in chartInst1.props),
    `rect ${JSON.stringify(chartRect0)}→${JSON.stringify(chartRect1)} · props ${JSON.stringify(chartInst1?.props)} · dialog ${chartDialog}`,
  );
  await state(page, () => window.__composition_STORE__.getState().undo());
  await page.waitForTimeout(1000);
  const chartRectUndo = await layoutRect(page, created.Chart);
  await state(page, () => window.__composition_STORE__.getState().redo());
  await page.waitForTimeout(1000);
  const chartRectRedo = await layoutRect(page, created.Chart);
  record(
    "G2-e: origin 변경 Undo → 320 · Redo → 480 (instance 가 따라온다)",
    chartRectUndo?.w === 320 && chartRectRedo?.w === 480,
    `${JSON.stringify(chartRectUndo)} / ${JSON.stringify(chartRectRedo)}`,
  );
  await state(page, () => window.__composition_STORE__.getState().undo());
  await page.waitForTimeout(600);

  // ── G3-a: origin root 삭제 거부 ──
  const beforeDel = await state(
    page,
    () => window.__composition_STORE__.getState().elements.length,
  );
  await state(page, () =>
    window.__composition_STORE__.getState().removeElement("component-badge"),
  );
  await page.waitForTimeout(500);
  const afterDel = await state(page, () => ({
    n: window.__composition_STORE__.getState().elements.length,
    still: !!window.__composition_STORE__
      .getState()
      .elements.find((e) => e.id === "component-badge"),
  }));
  record(
    "G3-a: systemOwned origin root removeElement → 거부 (요소 수 무변화)",
    afterDel.still && afterDel.n === beforeDel,
    `${beforeDel} → ${afterDel.n} · still=${afterDel.still}`,
  );

  // ── G3-b: reload 후 origin 편집 · instance · 위치 보존 · 재hydration Δ0 ──
  await updateOrigin(page, "component-badge", { children: "Edited origin" });
  const persisted = await waitPersisted(page, "component-badge", (v) =>
    v.includes("Edited origin"),
  );
  record(
    "G3-b: origin 편집이 IndexedDB document_parts 에 persist",
    persisted,
    `node:component-badge ${persisted}`,
  );
  const beforeReload = await state(page, () => {
    const st = window.__composition_STORE__.getState();
    const body = st.elements.find((e) => e.id === "page-components-body");
    return {
      n: st.elements.length,
      order: st.elements
        .filter((e) => e.parent_id === body.id)
        .map((e) => e.id),
      badge: st.elements.find((e) => e.id === "component-badge")?.props,
    };
  });
  await page.reload({ waitUntil: "networkidle" });
  await waitReady(page);
  const afterReload = await state(page, () => {
    const st = window.__composition_STORE__.getState();
    const body = st.elements.find((e) => e.id === "page-components-body");
    return {
      n: st.elements.length,
      order: st.elements
        .filter((e) => e.parent_id === body.id)
        .map((e) => e.id),
      badge: st.elements.find((e) => e.id === "component-badge")?.props,
      button: st.elements.find((e) => e.ref === "component-button")?.props,
    };
  });
  record(
    "G3-b: reload → origin 편집 보존 · body 순서 동일 · 요소 수 Δ0 · instance override 보존",
    afterReload.badge?.children === "Edited origin" &&
      afterReload.n === beforeReload.n &&
      JSON.stringify(afterReload.order) ===
        JSON.stringify(beforeReload.order) &&
      afterReload.button?.children === "Buy now",
    `n ${beforeReload.n}→${afterReload.n} · badge ${JSON.stringify(afterReload.badge)} · button ${JSON.stringify(afterReload.button)}`,
  );

  // ── codex round 3 h1: 선택을 유지한 채 같은 Button 을 다시 추가 → Button 안 Button 이 아니라 body ──
  {
    const first = created.Button;
    await setPanel(page, "components", true);
    const search = page.locator('[data-panel-id="components"] input').first();
    await search.fill("Button");
    await page.waitForTimeout(400);
    const before = await state(page, () =>
      window.__composition_STORE__.getState().elements.map((e) => e.id),
    );
    // 선택을 비우지 않는다 — 팔레트 클릭 직전에 첫 instance 를 선택한 채로 둔다.
    await state(
      page,
      (id) => {
        const st = window.__composition_STORE__.getState();
        const el = st.elements.find((e) => e.id === id);
        st.setSelectedElement(id, el?.props ?? {}, el?.props?.style ?? {}, {});
      },
      first,
    );
    await page.waitForTimeout(300);
    const items = page.locator('[data-panel-id="components"] .list-item');
    const n = await items.count();
    for (let i = 0; i < n; i++) {
      const text =
        (await items.nth(i).locator(".list-item-name").textContent()) ?? "";
      if (text.trim().toLowerCase() === "button") {
        await items.nth(i).click();
        break;
      }
    }
    await page.waitForTimeout(1200);
    const second = await state(
      page,
      (before) => {
        const st = window.__composition_STORE__.getState();
        const el = st.elements.find(
          (e) => !before.includes(e.id) && e.ref === "component-button",
        );
        const body = st.elements.find(
          (e) => e.page_id === st.currentPageId && e.type === "body",
        );
        return el ? { id: el.id, parent: el.parent_id, body: body?.id } : null;
      },
      before,
    );
    record(
      "h1: Button instance 선택 유지 + 팔레트 Button 클릭 → 둘째 instance 부모 = body (Button 안 Button 0)",
      !!second && second.parent !== first && second.parent === second.body,
      JSON.stringify({ first, second }),
    );
    await setPanel(page, "components", false);
  }

  // ── codex round 3 m4: Chart 진입점 7 전수 — 생성 → origin 변경 → Undo/Redo → 저장 → reload ──
  const chartTypes = [
    "area",
    "bar",
    "line",
    "pie",
    "radar",
    "radial",
    "scatter",
  ];
  const chartIds = {};
  for (const t of chartTypes) {
    const id = await addFromPalette(page, `${t} chart`, "Chart");
    const el = await elementById(page, id);
    chartIds[t] = id;
    record(
      `m4: Chart 「${t} chart」 → ref + chartType=${t} 명시 patch`,
      el?.type === "ref" &&
        el.ref === "component-chart" &&
        el.props.chartType === t,
      JSON.stringify(el?.props),
    );
  }
  const chartRects = async () => {
    const out = {};
    for (const t of chartTypes)
      out[t] = (await layoutRect(page, chartIds[t]))?.w ?? null;
    return out;
  };
  const w0 = await chartRects();
  await updateOrigin(page, "component-chart", { style: { width: 440 } });
  await page.waitForTimeout(1200);
  const w1 = await chartRects();
  const typesAfter = await state(
    page,
    (ids) => {
      const st = window.__composition_STORE__.getState();
      return Object.fromEntries(
        Object.entries(ids).map(([t, id]) => [
          t,
          st.elements.find((e) => e.id === id)?.props?.chartType,
        ]),
      );
    },
    chartIds,
  );
  record(
    "m4: Chart origin width 320→440 → 7 instance 전부 440 · chartType 7 종 그대로",
    chartTypes.every(
      (t) => w0[t] === 320 && w1[t] === 440 && typesAfter[t] === t,
    ),
    `${JSON.stringify(w0)} → ${JSON.stringify(w1)} · ${JSON.stringify(typesAfter)}`,
  );
  await state(page, () => window.__composition_STORE__.getState().undo());
  await page.waitForTimeout(1000);
  const wUndo = await chartRects();
  await state(page, () => window.__composition_STORE__.getState().redo());
  await page.waitForTimeout(1000);
  const wRedo = await chartRects();
  record(
    "m4: Chart origin 변경 Undo → 7 × 320 · Redo → 7 × 440",
    chartTypes.every((t) => wUndo[t] === 320 && wRedo[t] === 440),
    `${JSON.stringify(wUndo)} / ${JSON.stringify(wRedo)}`,
  );
  const chartPersisted = await waitPersisted(page, chartIds.radar, (v) =>
    v.includes('"radar"'),
  );
  record(
    "m4: 마지막 Chart instance (radar) 가 IndexedDB 에 persist",
    chartPersisted,
    `node:${chartIds.radar} ${chartPersisted}`,
  );

  // ── codex round 3 h2: Components body 의 origin 순서를 바꾸고 reload → 순서 보존 ──
  const moved = await state(page, () => {
    const st = window.__composition_STORE__.getState();
    const body = st.elements.find((e) => e.id === "page-components-body");
    const roots = st.elements
      .filter((e) => e.parent_id === body.id)
      .map((e) => e.id);
    // 첫 root 는 ListBoxItem template origin — 이동 시 nesting guard (ListBoxItem ⊄ body) 가 거부한다.
    //   catalog origin (Badge) 을 맨 뒤로 보낸다.
    const first = "component-badge";
    const ok = st.moveElementToSiblingEdge(first, "front");
    const after = window.__composition_STORE__
      .getState()
      .elements.filter((e) => e.parent_id === body.id)
      .map((e) => e.id);
    return {
      ok,
      first,
      before: [roots.indexOf(first), roots.length],
      after: [after.indexOf(first), after.length],
      last: after[after.length - 1],
    };
  });
  record(
    "h2: Badge origin 을 Components body 맨 뒤로 (moveElementToSiblingEdge front) → 순서 변경",
    moved.ok && moved.last === moved.first,
    JSON.stringify(moved),
  );
  // document_parts 의 node 행은 자식을 id 열 또는 중첩 노드로 담는다 — 어느 쪽이든 마지막 자식 id 로 본다.
  const orderPersisted = await waitPersisted(
    page,
    "page-components-body",
    (v) => {
      try {
        const node = JSON.parse(v);
        const kids = Array.isArray(node.children)
          ? node.children
          : Array.isArray(node.childIds)
            ? node.childIds
            : [];
        const last = kids[kids.length - 1];
        return (typeof last === "string" ? last : last?.id) === moved.first;
      } catch {
        return false;
      }
    },
  );
  const orderBefore = await state(page, () => {
    const st = window.__composition_STORE__.getState();
    const body = st.elements.find((e) => e.id === "page-components-body");
    return st.elements.filter((e) => e.parent_id === body.id).map((e) => e.id);
  });
  await page.reload({ waitUntil: "networkidle" });
  await waitReady(page);
  const orderAfter = await state(
    page,
    (ids) => {
      const st = window.__composition_STORE__.getState();
      const body = st.elements.find((e) => e.id === "page-components-body");
      return {
        order: st.elements
          .filter((e) => e.parent_id === body.id)
          .map((e) => e.id),
        charts: Object.fromEntries(
          Object.entries(ids).map(([t, id]) => [
            t,
            st.elements.find((e) => e.id === id)?.props?.chartType,
          ]),
        ),
      };
    },
    chartIds,
  );
  record(
    "h2: reload → Components body 순서 = 바꾼 순서 (Badge origin 이 맨 뒤 그대로)",
    JSON.stringify(orderAfter.order) === JSON.stringify(orderBefore) &&
      orderAfter.order[orderAfter.order.length - 1] === moved.first,
    `persisted=${orderPersisted} · ${orderBefore.slice(0, 2)}…${orderBefore.slice(-1)} → ${orderAfter.order.slice(0, 2)}…${orderAfter.order.slice(-1)}`,
  );
  record(
    "m4: reload → Chart 7 instance 의 chartType 보존",
    chartTypes.every((t) => orderAfter.charts[t] === t),
    JSON.stringify(orderAfter.charts),
  );

  record(
    "page error 0 · dialog 0",
    errors.length === 0 && dialogs === 0,
    `${errors.length} / ${dialogs}`,
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
