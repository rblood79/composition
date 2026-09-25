#!/usr/bin/env node
// adr222-spacing-live.mjs — ADR-222 캔버스 padding·gap 직접 편집 live (실제 빌더, headed Playwright).
//   Chrome MCP hidden 탭은 RAF 가 멈춰 부트 95% 에서 정지하므로 (메모리 reference-chrome-mcp-hidden-tab-…)
//   headed Playwright 로 실제 빌더를 부팅한다.
//   1) 새 프로젝트 → Box (flex column · padding 16 · gap 12 · width 320) + Button 2 자식
//   2) Box 선택 → __composition_SPACING_DEBUG__ 로 owner/띠 4+1 (padding 4 · gap 1) · 값 = 엔진 소비값
//   3) hover 띠 → hoveredBandId · 커서 ns-resize
//   4) paddingTop 핸들 드래그 +24 → 드래그 중 canonical 무변경 · 확정값 40 · pointerup 후 canonical
//      paddingTop "40px" · history +1 · 자식/형제 rect 가 layout 에서 +24 이동 (hug 반증)
//   5) Cmd+Z → 16 복원 (history 1)
//   6) gap 핸들 드래그 +10 → rowGap 22 · Preview(Compare) DOM 의 두 Button 간격 22
//   7) Escape 취소 → canonical 무변경 · history 무변경
//  15~18) mobile breakpoint — 토글 OFF base 쓰기 · 토글 ON tier override 쓰기 · desktop 복귀 (2026-09-17 scope 확장)
//   8) 클릭 (임계값 미만) → 변경 0
//   9) page error 0
// 사용: node apps/builder/scripts/adr222-spacing-live.mjs [--headed]  (dev 서버 5173 · .auth-session.json)
//   ADR222_NO_COMPARE=1 → Compare Mode 를 열지 않는다 (6) 의 Preview 간격 항목만 FAIL 로 남는다)
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { waitReady } from "./perf-baseline.mjs";

const BASE_URL = "http://localhost:5173";
const STORAGE_STATE = resolve("apps/builder/scripts/.auth-session.json");
const OUT_DIR = process.env.ADR222_OUT ?? "/private/tmp/adr222-spacing-live";
const headed = process.argv.includes("--headed");
const log = (...a) => console.log("[adr222 live]", ...a);
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

async function addFromPalette(page, type, parentId = null) {
  await setPanel(page, "components", true);
  await page.evaluate(
    (id) => window.__composition_STORE__.getState().setSelectedElement(id),
    parentId,
  );
  await page.waitForTimeout(300);
  const before = await page.evaluate(
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
  await search.fill(type);
  await page.waitForTimeout(400);
  const items = page.locator(`[data-panel-id="components"] .list-item`);
  const n = await items.count();
  let item = null;
  for (let i = 0; i < n; i++) {
    const label =
      (await items.nth(i).locator(".list-item-name").textContent()) ?? "";
    if (label.replace(/\s+/g, "").toLowerCase() === type.toLowerCase()) {
      item = items.nth(i);
      break;
    }
  }
  if (!item) throw new Error(`팔레트에 ${type} 없음 (${n} items)`);
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
  await page.waitForTimeout(800);
  if (!id) throw new Error(`${type} 미생성`);
  await setPanel(page, "components", false);
  return id;
}

const readStyle = (page, id) =>
  page.evaluate((elementId) => {
    const st = window.__composition_STORE__.getState();
    const el = st.elements.find((e) => e.id === elementId);
    return el?.props?.style ?? null;
  }, id);
const readLayout = (page, id) =>
  page.evaluate((elementId) => {
    const l = window.__composition_LAYOUT_DEBUG__
      .getSharedLayoutMap()
      ?.get(elementId);
    return l ? { x: l.x, y: l.y, width: l.width, height: l.height } : null;
  }, id);
const historyCount = (page) =>
  page.evaluate(
    () =>
      window.__composition_HISTORY_DEBUG__?.getCurrentPageHistory()
        .currentIndex ?? null,
  );
const spacingDebug = (page) =>
  page.evaluate(() => {
    const d = window.__composition_SPACING_DEBUG__;
    const snap = d.getSnapshot();
    const set = d.resolveBands();
    return {
      ownerId: snap.owner?.target.nodeId ?? null,
      padding: snap.owner?.padding ?? null,
      gap: snap.owner?.gap
        ? { ...snap.owner.gap, flowChildIds: snap.owner.gap.flowChildIds }
        : null,
      hoveredBandId: snap.hoveredBandId,
      active: snap.active,
      bands:
        set?.bands.map((b) => ({
          id: b.id,
          value: b.value,
          rect: b.rect,
          axis: b.axis,
          sign: b.sign,
        })) ?? null,
      clipRect: set?.clipRect ?? null,
      session: d.getActiveSession(),
    };
  });
/** owner 를 화면 중앙 근처로 — 새 프로젝트 템플릿은 카메라가 다른 곳을 본다 */
async function focusOwner(page) {
  await page.evaluate(() => {
    const set = window.__composition_SPACING_DEBUG__.resolveBands();
    const top = set?.bands.find((b) => b.id === "padding:top");
    if (!top) return;
    const scale = window.__composition_VIEWPORT__().zoom;
    // Compare Mode 는 캔버스를 반폭으로, Styles 패널은 우측에 떠 있다 — 캔버스 폭의 25% 지점
    const rect = document.querySelector("canvas").getBoundingClientRect();
    // 띠 중심을 캔버스 폭 25% 지점에 — zoom 2 에서 폭 320 상자가 우측 Styles 패널 아래로 들어가지 않게
    window.__composition_APPLY_VIEWPORT__({
      scale,
      x: rect.width * 0.25 - (top.rect.x + top.rect.width / 2) * scale,
      y: 300 - top.rect.y * scale,
    });
  });
  await page.waitForTimeout(700);
}
/** 띠 핸들 중심의 화면 좌표 */
const handleScreenPoint = (page, bandId) =>
  page.evaluate((id) => {
    const set = window.__composition_SPACING_DEBUG__.resolveBands();
    const band = set?.bands.find((b) => b.id === id);
    if (!band) return null;
    const vp = window.__composition_VIEWPORT__();
    const rect = document.querySelector("canvas").getBoundingClientRect();
    // 드래그 중 보정 (handleShift) 까지 — 그려지는 핸들과 같은 중심
    const shift = band.handleShift ?? 0;
    const cx =
      band.rect.x + band.rect.width / 2 + (band.axis === "x" ? shift : 0);
    const cy =
      band.rect.y + band.rect.height / 2 + (band.axis === "y" ? shift : 0);
    return {
      x: cx * vp.zoom + vp.panOffset.x + rect.left,
      y: cy * vp.zoom + vp.panOffset.y + rect.top,
      zoom: vp.zoom,
    };
  }, bandId);

async function drag(page, from, dxScreen, dyScreen, steps = 12) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(
      from.x + (dxScreen * i) / steps,
      from.y + (dyScreen * i) / steps,
    );
    await page.waitForTimeout(30);
  }
}

async function ensureCompareMode(page) {
  if (process.env.ADR222_NO_COMPARE) return;
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
async function previewRects(page, ids) {
  if (process.env.ADR222_NO_COMPARE) return null;
  await page
    .waitForFunction(
      (ids) =>
        [...document.querySelectorAll("iframe")].some((f) =>
          ids.every((id) =>
            f.contentDocument?.querySelector(`[data-element-id^="${id}"]`),
          ),
        ),
      ids,
      { timeout: 15_000 },
    )
    .catch(() => {});
  return page.evaluate((ids) => {
    for (const frame of document.querySelectorAll("iframe")) {
      const doc = frame.contentDocument;
      if (!doc) continue;
      const out = {};
      let ok = true;
      for (const id of ids) {
        const el = doc.querySelector(`[data-element-id^="${id}"]`);
        if (!el) {
          ok = false;
          break;
        }
        const r = el.getBoundingClientRect();
        out[id] = { x: r.x, y: r.y, width: r.width, height: r.height };
      }
      if (ok) return out;
    }
    return null;
  }, ids);
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

try {
  await page.goto(`${BASE_URL}/dashboard`, { waitUntil: "networkidle" });
  const create = page.locator("button.dashboard-create-button").first();
  await create.waitFor({ state: "visible", timeout: 20_000 });
  await create.click();
  const input = page.locator("#new-project-name");
  await input.waitFor({ state: "visible", timeout: 10_000 });
  await input.fill(`adr222-${Date.now()}`);
  await input.press("Enter");
  await page.waitForURL(/\/builder\/[^/?]+$/, { timeout: 90_000 });
  await waitReady(page);
  log("project", page.url().split("/builder/")[1]);

  // 1) fixture
  const boxId = await addFromPalette(page, "frame");
  await page.evaluate((id) => {
    const st = window.__composition_STORE__.getState();
    st.updateElementProps(id, {
      style: {
        display: "flex",
        flexDirection: "column",
        padding: "16px",
        gap: "12px",
        width: "320px",
      },
    });
  }, boxId);
  await page.waitForTimeout(600);
  const btnA = await addFromPalette(page, "Button", boxId);
  const btnB = await addFromPalette(page, "Button", boxId);
  const followId = await addFromPalette(page, "Button", null);
  const parents = await page.evaluate(
    (ids) =>
      ids.map(
        (id) =>
          window.__composition_STORE__
            .getState()
            .elements.find((e) => e.id === id)?.parent_id,
      ),
    [btnA, btnB, followId],
  );
  record(
    "fixture: Button 2 가 Box 자식 + following 형제",
    parents[0] === boxId && parents[1] === boxId && parents[2] !== boxId,
    JSON.stringify(parents),
  );

  // 2) owner + 띠
  await page.evaluate(
    (id) => window.__composition_STORE__.getState().setSelectedElement(id),
    boxId,
  );
  await page.waitForTimeout(900);
  let dbg = await spacingDebug(page);
  for (let i = 0; i < 10 && (dbg.bands?.length ?? 0) !== 5; i++) {
    log(
      "bands 대기",
      JSON.stringify({
        padding: dbg.padding,
        gap: dbg.gap && {
          supported: dbg.gap.supported,
          reason: dbg.gap.reason,
        },
      }),
    );
    await page.waitForTimeout(500);
    dbg = await spacingDebug(page);
  }
  record(
    "선택 즉시 owner + padding 4변 + gap 1 띠 (값 = 엔진 소비값 16/12)",
    dbg.ownerId === boxId &&
      dbg.bands?.length === 5 &&
      dbg.bands
        .filter((b) => b.id.startsWith("padding"))
        .every((b) => b.value === 16) &&
      dbg.bands.find((b) => b.id === "gap:0")?.value === 12,
    JSON.stringify({
      owner: dbg.ownerId,
      bands: dbg.bands?.map((b) => `${b.id}=${b.value}`),
    }),
  );
  await focusOwner(page);
  await page.screenshot({ path: resolve(OUT_DIR, "1-selected.png") });

  // 3) hover
  const topPt = await handleScreenPoint(page, "padding:top");
  // headed 창 위에 실제 OS 마우스가 있으면 그 pointermove (소수 좌표) 가 hover 를 지운다 — 2회 시도
  for (let i = 0; i < 2; i++) {
    await page.mouse.move(topPt.x - 40 - i, topPt.y + i);
    await page.waitForTimeout(250);
    dbg = await spacingDebug(page);
    if (dbg.hoveredBandId === "padding:top") break;
  }
  const readCursor = () =>
    page.evaluate(
      () => document.querySelector(".canvas-container")?.style.cursor ?? "",
    );
  const cursor = await readCursor();
  // 드래그 대상은 핸들뿐 (2026-09-26) — 띠 영역 hover 는 사선만, resize 커서는 핸들 위에서만
  record(
    "띠 영역 hover → hoveredBandId padding:top (사선) · 커서 resize 아님",
    dbg.hoveredBandId === "padding:top" && cursor !== "ns-resize",
    `${dbg.hoveredBandId} / ${cursor}`,
  );
  await page.screenshot({ path: resolve(OUT_DIR, "2-hover.png") });
  await page.mouse.move(topPt.x, topPt.y);
  await page.waitForTimeout(250);
  const handleCursor = await readCursor();
  record(
    "핸들 hover → 커서 ns-resize",
    handleCursor === "ns-resize",
    handleCursor,
  );
  // 띠 영역 press + 이동 → spacing 세션 없음 · padding 무변경 (요소 선택·이동으로 흘린다)
  const styleBandPress = await readStyle(page, boxId);
  await page.mouse.move(topPt.x - 40, topPt.y);
  await page.mouse.down();
  await page.mouse.move(topPt.x - 40, topPt.y - 3, { steps: 2 });
  const bandPressDbg = await spacingDebug(page);
  await page.keyboard.press("Escape");
  await page.mouse.up();
  await page.waitForTimeout(400);
  record(
    "띠 영역 press → spacing 세션 없음 · padding 무변경",
    bandPressDbg.session === null &&
      bandPressDbg.active === null &&
      JSON.stringify(await readStyle(page, boxId)) ===
        JSON.stringify(styleBandPress),
    JSON.stringify({ session: bandPressDbg.session, active: bandPressDbg.active }),
  );
  await page.evaluate(
    (id) => window.__composition_STORE__.getState().setSelectedElement(id),
    boxId,
  );
  await page.waitForTimeout(600);

  // 4) paddingTop 드래그 +24 (scene) — 화면 px = 24 * zoom (Styles 패널 열어 동기 강조 확인)
  await setPanel(page, "styles", true);
  await page.waitForTimeout(600);
  await focusOwner(page);
  const styleBefore = await readStyle(page, boxId);
  const layoutBefore = {
    box: await readLayout(page, boxId),
    a: await readLayout(page, btnA),
    follow: await readLayout(page, followId),
  };
  const histBefore = await historyCount(page);
  // 움직이는 띠 가장자리가 포인터를 따라간다 (2026-09-26) — top 은 안쪽 (아래) 으로 끌면 커진다
  await drag(page, topPt, 0, 24 * topPt.zoom);
  await page.waitForTimeout(300);
  dbg = await spacingDebug(page);
  const styleMid = await readStyle(page, boxId);
  // 핸들이 포인터와 1:1 (2026-09-26 — 종전 띠 중앙이라 절반 속도로 따라왔다)
  const topMid = await handleScreenPoint(page, "padding:top");
  const followDy = topMid.y - (topPt.y + 24 * topPt.zoom);
  record(
    "드래그 중 핸들 = 포인터 위치 (편차 < 1px)",
    Math.abs(followDy) < 1 && Math.abs(topMid.x - topPt.x) < 1,
    `dy ${followDy.toFixed(2)}`,
  );
  record(
    "드래그 중: active drag · 확정값 paddingTop 40 · canonical 무변경",
    dbg.active?.mode === "drag" &&
      dbg.session?.confirmedValues?.paddingTop === 40 &&
      styleMid.paddingTop === styleBefore.paddingTop &&
      styleMid.padding === styleBefore.padding,
    JSON.stringify({
      active: dbg.active,
      confirmed: dbg.session?.confirmedValues,
      styleMid,
    }),
  );
  const panelMid = await page.evaluate(() => {
    const input = document.querySelector(
      ".box-model__input--padding.box-model__input--top",
    );
    return input
      ? {
          value: input.value,
          active: input.hasAttribute("data-active"),
          readOnly: input.readOnly,
        }
      : null;
  });
  record(
    "드래그 중 Styles 패널 Padding Top = 40 · data-active · readOnly (패널 동기 강조)",
    panelMid?.value === "40" &&
      panelMid.active === true &&
      panelMid.readOnly === true,
    JSON.stringify(panelMid),
  );
  await page.screenshot({ path: resolve(OUT_DIR, "3-dragging.png") });
  await page.mouse.up();
  await page.waitForTimeout(1200);
  const styleAfter = await readStyle(page, boxId);
  const histAfter = await historyCount(page);
  const layoutAfter = {
    box: await readLayout(page, boxId),
    a: await readLayout(page, btnA),
    follow: await readLayout(page, followId),
  };
  record(
    "pointerup: canonical paddingTop 40px · 다른 변 16px 보존 · history +1",
    styleAfter.paddingTop === "40px" &&
      styleAfter.paddingLeft === "16px" &&
      styleAfter.paddingBottom === "16px" &&
      (histBefore === null || histAfter === histBefore + 1),
    JSON.stringify({ styleAfter, histBefore, histAfter }),
  );
  record(
    "layout: 자식 A y +24 · Box 높이 +24 (hug) · following y +24 (외부 형제 이동)",
    Math.round(layoutAfter.a.y - layoutBefore.a.y) === 24 &&
      Math.round(layoutAfter.box.height - layoutBefore.box.height) === 24 &&
      Math.round(layoutAfter.follow.y - layoutBefore.follow.y) === 24,
    JSON.stringify({ before: layoutBefore, after: layoutAfter }),
  );
  dbg = await spacingDebug(page);
  record(
    "드래그 종료 후 세션 종료 · 핸들 값 40 으로 갱신",
    dbg.session === null &&
      dbg.bands?.find((b) => b.id === "padding:top")?.value === 40,
    JSON.stringify({
      session: dbg.session,
      top: dbg.bands?.find((b) => b.id === "padding:top")?.value,
    }),
  );

  // 5) Undo
  await page.keyboard.press("Meta+z");
  await page.waitForTimeout(900);
  const styleUndo = await readStyle(page, boxId);
  dbg = await spacingDebug(page);
  record(
    "Cmd+Z 1회 → paddingTop 16 복원 · 핸들 값 16",
    (styleUndo.paddingTop === "16px" || styleUndo.padding === "16px") &&
      dbg.bands?.find((b) => b.id === "padding:top")?.value === 16,
    JSON.stringify({
      styleUndo,
      top: dbg.bands?.find((b) => b.id === "padding:top")?.value,
    }),
  );

  // 6) gap 드래그 +10 → Preview 대조
  await ensureCompareMode(page);
  await page.evaluate(
    (id) => window.__composition_STORE__.getState().setSelectedElement(id),
    boxId,
  );
  await page.waitForTimeout(900);
  await focusOwner(page);
  const gapPt = await handleScreenPoint(page, "gap:0");
  await drag(page, gapPt, 0, 10 * gapPt.zoom);
  await page.mouse.up();
  await page.waitForTimeout(1500);
  const styleGap = await readStyle(page, boxId);
  const rects = await previewRects(page, [btnA, btnB]);
  const previewGap = rects
    ? rects[btnB].y - (rects[btnA].y + rects[btnA].height)
    : null;
  record(
    "gap 핸들 드래그 +10 → rowGap 22px (columnGap 보존) · Preview DOM 두 Button 간격 22",
    styleGap.rowGap === "22px" &&
      (styleGap.columnGap === "12px" || styleGap.gap === undefined) &&
      previewGap !== null &&
      Math.abs(previewGap - 22) <= 1,
    JSON.stringify({ styleGap, previewGap }),
  );
  await page.screenshot({ path: resolve(OUT_DIR, "4-gap.png") });
  const gapField = await page.evaluate(() => {
    const input = document.querySelector(".displayGap input");
    return input ? input.value : null;
  });
  record(
    "Styles Gap 필드가 column flex 주축 rowGap 22 를 표시 (종전 rowGap 우선과 같은 값, columnGap 12 아님)",
    gapField !== null && gapField.replace(/\s*px$/, "") === "22",
    `gap field = ${gapField}`,
  );

  // 7) Escape 취소
  await page.evaluate(
    (id) => window.__composition_STORE__.getState().setSelectedElement(id),
    boxId,
  );
  await page.waitForTimeout(600);
  await focusOwner(page);
  const histEsc = await historyCount(page);
  const leftPt = await handleScreenPoint(page, "padding:left");
  await drag(page, leftPt, 30 * leftPt.zoom, 0);
  await page.waitForTimeout(200);
  dbg = await spacingDebug(page);
  const midLeft = dbg.session?.confirmedValues?.paddingLeft;
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  await page.mouse.up();
  await page.waitForTimeout(600);
  const styleEsc = await readStyle(page, boxId);
  dbg = await spacingDebug(page);
  log(
    "escape debug",
    JSON.stringify({
      midLeft,
      active: dbg.active,
      session: dbg.session,
      hist: [histEsc, await historyCount(page)],
      left: dbg.bands?.find((b) => b.id === "padding:left")?.value,
    }),
  );
  dbg = await spacingDebug(page);
  record(
    "Escape: 드래그 중 확정값 46 → 취소 후 canonical paddingLeft 16 · history 무변경 · 핸들 16",
    midLeft === 46 &&
      (styleEsc.paddingLeft === "16px" || styleEsc.padding === "16px") &&
      (histEsc === null || (await historyCount(page)) === histEsc) &&
      dbg.bands?.find((b) => b.id === "padding:left")?.value === 16 &&
      dbg.active === null,
    JSON.stringify({
      midLeft,
      styleEsc,
      left: dbg.bands?.find((b) => b.id === "padding:left")?.value,
    }),
  );

  // 8) 클릭 (무이동) → 인라인 입력 열림 → 24 Enter → commit 1
  await focusOwner(page);
  const histClick = await historyCount(page);
  const bottomPt = await handleScreenPoint(page, "padding:bottom");
  await page.mouse.click(bottomPt.x, bottomPt.y);
  await page.waitForTimeout(500);
  const inlineOpen = await page.evaluate(() => {
    const el = document.querySelector(".spacing-inline-input input");
    return el
      ? {
          value: el.value,
          focused: document.activeElement === el,
          active: window.__composition_SPACING_DEBUG__.getSnapshot().active,
        }
      : null;
  });
  record(
    "핸들 클릭 (임계값 미만) → 인라인 입력 열림 (값 16 · 포커스 · active mode input)",
    inlineOpen?.value === "16" &&
      inlineOpen.focused === true &&
      inlineOpen.active?.mode === "input",
    JSON.stringify(inlineOpen),
  );
  await page.screenshot({ path: resolve(OUT_DIR, "5-inline-input.png") });
  await page.keyboard.press("Meta+a");
  await page.keyboard.type("24");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(1200);
  const styleInline = await readStyle(page, boxId);
  const histInline = await historyCount(page);
  const inlineClosed = await page.evaluate(
    () => document.querySelector(".spacing-inline-input") === null,
  );
  record(
    "Enter → canonical paddingBottom 24px · history +1 · 입력 닫힘",
    styleInline.paddingBottom === "24px" &&
      (histClick === null || histInline === histClick + 1) &&
      inlineClosed,
    JSON.stringify({
      paddingBottom: styleInline.paddingBottom,
      histClick,
      histInline,
      inlineClosed,
    }),
  );

  // 9) 클릭 → Escape → 무변경
  await focusOwner(page);
  const rightPt = await handleScreenPoint(page, "padding:right");
  await page.mouse.click(rightPt.x, rightPt.y);
  await page.waitForTimeout(400);
  await page.keyboard.type("99");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(600);
  const styleEscInline = await readStyle(page, boxId);
  record(
    "인라인 입력 Escape → canonical paddingRight 16 유지 · history 무변경 · 입력 닫힘",
    styleEscInline.paddingRight === "16px" &&
      (histInline === null || (await historyCount(page)) === histInline) &&
      (await page.evaluate(
        () => document.querySelector(".spacing-inline-input") === null,
      )),
    JSON.stringify({ paddingRight: styleEscInline.paddingRight }),
  );

  // 10) zoom 25% / 200% — 화면 px 델타 / zoom = scene 델타 (G1 zoom 축)
  for (const [scale, sceneDelta] of [
    [0.25, 20],
    [2, 10],
  ]) {
    await page.evaluate((scale) => {
      const set = window.__composition_SPACING_DEBUG__.resolveBands();
      const top = set?.bands.find((b) => b.id === "padding:top");
      const rect = document.querySelector("canvas").getBoundingClientRect();
      window.__composition_APPLY_VIEWPORT__({
        scale,
        x: rect.width * 0.25 - (top.rect.x + top.rect.width / 2) * scale,
        y: 300 - top.rect.y * scale,
      });
    }, scale);
    await page.waitForTimeout(700);
    const pt = await handleScreenPoint(page, "padding:top");
    const before = (await readStyle(page, boxId)).paddingTop ?? "16px";
    await drag(page, pt, 0, sceneDelta * pt.zoom, 8);
    await page.mouse.up();
    await page.waitForTimeout(1000);
    const after = (await readStyle(page, boxId)).paddingTop;
    record(
      `zoom ${scale * 100}%: 화면 ${sceneDelta * scale}px 드래그 → paddingTop +${sceneDelta} (${before} → ${parseFloat(before) + sceneDelta}px)`,
      after === `${parseFloat(before) + sceneDelta}px`,
      `after = ${after}`,
    );
    await page.keyboard.press("Meta+z");
    await page.waitForTimeout(700);
  }
  await page.evaluate(() => {
    const vp = window.__composition_VIEWPORT__();
    window.__composition_APPLY_VIEWPORT__({
      scale: 1,
      x: vp.panOffset.x,
      y: vp.panOffset.y,
    });
  });
  await page.waitForTimeout(500);
  await focusOwner(page);

  // 11) 코너 resize 핸들이 spacing 보다 우선 (§3.4)
  const corner = await page.evaluate(() => {
    const set = window.__composition_SPACING_DEBUG__.resolveBands();
    const top = set.bands.find((b) => b.id === "padding:top");
    const vp = window.__composition_VIEWPORT__();
    const rect = document.querySelector("canvas").getBoundingClientRect();
    // border 0 이므로 padding-box 좌상단 = border-box 좌상단 = 선택 박스 코너
    return {
      x: top.rect.x * vp.zoom + vp.panOffset.x + rect.left,
      y: top.rect.y * vp.zoom + vp.panOffset.y + rect.top,
    };
  });
  await page.mouse.move(corner.x, corner.y);
  await page.mouse.down();
  await page.mouse.move(corner.x + 6, corner.y + 6);
  await page.waitForTimeout(200);
  const cornerState = await spacingDebug(page);
  await page.mouse.up();
  await page.waitForTimeout(400);
  record(
    "코너 핸들 pointerdown → spacing 세션 열리지 않음 (resize 우선)",
    cornerState.active === null && cornerState.session === null,
    JSON.stringify({
      active: cornerState.active,
      session: cornerState.session,
    }),
  );

  // 12) Space + 띠 드래그 = pan (spacing 시작 안 함 · canonical 무변경)
  await focusOwner(page);
  const spacePt = await handleScreenPoint(page, "padding:top");
  const panBefore = await page.evaluate(
    () => window.__composition_VIEWPORT__().panOffset,
  );
  await page.mouse.move(spacePt.x, spacePt.y);
  await page.keyboard.down("Space");
  await page.mouse.down();
  await page.mouse.move(spacePt.x + 40, spacePt.y + 40, { steps: 6 });
  await page.waitForTimeout(200);
  const spaceState = await spacingDebug(page);
  await page.mouse.up();
  await page.keyboard.up("Space");
  await page.waitForTimeout(400);
  const panAfter = await page.evaluate(
    () => window.__composition_VIEWPORT__().panOffset,
  );
  record(
    "Space + 띠 드래그 → pan (세션 0 · panOffset 변경 · canonical 무변경)",
    spaceState.session === null &&
      (panAfter.x !== panBefore.x || panAfter.y !== panBefore.y) &&
      (await readStyle(page, boxId)).paddingTop === "16px",
    JSON.stringify({ session: spaceState.session, panBefore, panAfter }),
  );

  // 13) 조상 overflow hidden clip — 가시 영역 밖 띠는 hover·pointerdown 대상 아님 (HC)
  const sectionId = await addFromPalette(page, "Section", null);
  await page.evaluate((id) => {
    window.__composition_STORE__.getState().updateElementProps(id, {
      style: {
        overflow: "hidden",
        height: "60px",
        width: "400px",
        display: "block",
      },
    });
  }, sectionId);
  await page.waitForTimeout(500);
  const clippedId = await addFromPalette(page, "frame", sectionId);
  await page.evaluate((id) => {
    window.__composition_STORE__.getState().updateElementProps(id, {
      style: {
        display: "flex",
        flexDirection: "column",
        padding: "16px",
        gap: "12px",
        width: "320px",
      },
    });
  }, clippedId);
  await addFromPalette(page, "Button", clippedId);
  await addFromPalette(page, "Button", clippedId);
  await page.evaluate(
    (id) => window.__composition_STORE__.getState().setSelectedElement(id),
    clippedId,
  );
  await page.waitForTimeout(900);
  await focusOwner(page);
  dbg = await spacingDebug(page);
  const clippedParent = await page.evaluate(
    (id) =>
      window.__composition_STORE__.getState().elements.find((e) => e.id === id)
        ?.parent_id,
    clippedId,
  );
  const bottomClipped = dbg.bands?.find((b) => b.id === "padding:bottom");
  const clipOk =
    clippedParent === sectionId &&
    dbg.clipRect !== null &&
    bottomClipped &&
    bottomClipped.rect.y >= dbg.clipRect.y + dbg.clipRect.height;
  const bottomPtClipped = await handleScreenPoint(page, "padding:bottom");
  await page.mouse.move(bottomPtClipped.x, bottomPtClipped.y);
  await page.waitForTimeout(250);
  const hoverClipped = (await spacingDebug(page)).hoveredBandId;
  await page.mouse.down();
  await page.mouse.move(bottomPtClipped.x, bottomPtClipped.y - 10, {
    steps: 4,
  });
  await page.waitForTimeout(200);
  const clippedSession = (await spacingDebug(page)).session;
  await page.mouse.up();
  await page.waitForTimeout(400);
  record(
    "overflow:hidden 조상 밖 bottom 띠: hover 없음 · pointerdown 세션 없음 (clipRect 60px)",
    Boolean(clipOk) && hoverClipped === null && clippedSession === null,
    JSON.stringify({
      clippedParent: clippedParent === sectionId,
      clipRect: dbg.clipRect,
      bottom: bottomClipped?.rect,
      hoverClipped,
      clippedSession,
    }),
  );
  await page.screenshot({ path: resolve(OUT_DIR, "6-clipped.png") });

  // 14) 접근 이름 — 인라인 입력 aria-label (한글 locale 은 semantic label 표를 따른다)
  await focusOwner(page);
  const topClipped = await handleScreenPoint(page, "padding:top");
  await page.mouse.click(topClipped.x, topClipped.y);
  await page.waitForTimeout(400);
  const ariaName = await page.evaluate(
    () =>
      document
        .querySelector(".spacing-inline-input input")
        ?.getAttribute("aria-label") ?? null,
  );
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  record(
    "인라인 입력 접근 이름 (예: Top padding)",
    typeof ariaName === "string" && /padding/i.test(ariaName),
    `aria-label = ${ariaName}`,
  );

  // 15~17) 비-desktop breakpoint (2026-09-17 scope 확장) — 쓰기 목적지는 Inspector 와 같은
  //   shouldWriteBreakpointOverride: 토글 OFF → base(전역) · 토글 ON → responsive.styles[key].mobile
  //   · 상위 tier override 가 base 를 덮으면 그 축은 닫힌다 (cascade-shadowed).
  const readResponsive = (page, id) =>
    page.evaluate((elementId) => {
      const el = window.__composition_STORE__
        .getState()
        .elements.find((e) => e.id === elementId);
      return el?.responsive ?? null;
    }, id);
  await page.evaluate(
    (id) => window.__composition_STORE__.getState().setSelectedElement(id),
    boxId,
  );
  // 헤더 토글 (BuilderCore.handleBreakpointChange) 과 같은 경로 — setActiveBreakpoint + invalidateLayout
  const switchBreakpoint = (page, bp) =>
    page.evaluate((next) => {
      const st = window.__composition_STORE__.getState();
      st.setActiveBreakpoint(next);
      st.invalidateLayout();
    }, bp);
  await switchBreakpoint(page, "mobile");
  await page.waitForTimeout(900);
  await focusOwner(page);
  dbg = await spacingDebug(page);
  const bpNow = await page.evaluate(
    () => window.__composition_STORE__.getState().activeBreakpoint,
  );
  record(
    "mobile breakpoint: 토글 OFF 인 요소에도 padding 4 + gap 1 띠 (base 쓰기 목적지)",
    bpNow === "mobile" && dbg.ownerId === boxId && dbg.bands?.length === 5,
    JSON.stringify({
      bpNow,
      owner: dbg.ownerId,
      padding: dbg.padding?.supported ?? dbg.padding,
      gap: dbg.gap?.supported ?? dbg.gap,
      bands: dbg.bands?.length,
    }),
  );
  // 토글 OFF 드래그 → base 갱신, responsive 없음
  const baseBefore = await readStyle(page, boxId);
  const px = (v) => parseFloat(String(v ?? "0"));
  // 11) 코너 resize 가 박스를 height 116px 고정으로 만들었다 — 고정 높이의 bottom 띠는 안쪽 (위)
  //   으로 끌어야 커진다 (안쪽 가장자리가 위로 움직인다) — 화면 −8*zoom
  const bottomM = await handleScreenPoint(page, "padding:bottom");
  await drag(page, bottomM, 0, -8 * bottomM.zoom);
  await page.mouse.up();
  await page.waitForTimeout(1200);
  const baseAfterOff = await readStyle(page, boxId);
  const respAfterOff = await readResponsive(page, boxId);
  record(
    "mobile 토글 OFF 드래그 bottom +8 → base paddingBottom +8 · responsive 없음 (전역 쓰기)",
    px(baseAfterOff.paddingBottom) === px(baseBefore.paddingBottom) + 8 &&
      !respAfterOff?.styles?.paddingBottom,
    JSON.stringify({
      before: baseBefore.paddingBottom,
      after: baseAfterOff.paddingBottom,
      responsive: respAfterOff,
    }),
  );
  // 토글 ON (padding) → 드래그 → responsive.styles.paddingTop.mobile 갱신 · base 그대로
  await page.evaluate(() =>
    window.__composition_STORE__
      .getState()
      .setResponsiveStyleOverrideEnabled("padding", true),
  );
  await page.waitForTimeout(900);
  await focusOwner(page);
  const respSeeded = await readResponsive(page, boxId);
  const baseTopBefore = px(baseAfterOff.paddingTop);
  const topM = await handleScreenPoint(page, "padding:top");
  await drag(page, topM, 0, 12 * topM.zoom);
  await page.mouse.up();
  await page.waitForTimeout(1200);
  const baseAfterOn = await readStyle(page, boxId);
  const respAfterOn = await readResponsive(page, boxId);
  const bandsOn = (await spacingDebug(page)).bands;
  record(
    "mobile 토글 ON 드래그 top +12 → responsive.styles.paddingTop.mobile = base+12 · base paddingTop 유지 · 띠 값 = override",
    respSeeded?.styles?.paddingTop?.mobile === baseTopBefore &&
      respAfterOn?.styles?.paddingTop?.mobile === baseTopBefore + 12 &&
      px(baseAfterOn.paddingTop) === baseTopBefore &&
      bandsOn?.find((b) => b.id === "padding:top")?.value ===
        baseTopBefore + 12,
    JSON.stringify({
      seeded: respSeeded?.styles?.paddingTop,
      after: respAfterOn?.styles?.paddingTop,
      base: baseAfterOn.paddingTop,
      band: bandsOn?.find((b) => b.id === "padding:top")?.value,
    }),
  );
  await page.screenshot({ path: resolve(OUT_DIR, "7-mobile-override.png") });
  // desktop 복귀 → 띠 값은 base 로 돌아온다 (override 는 mobile 에만)
  await switchBreakpoint(page, "desktop");
  await page.waitForTimeout(900);
  let bandsDesktop = (await spacingDebug(page)).bands;
  for (
    let i = 0;
    i < 6 &&
    bandsDesktop?.find((b) => b.id === "padding:top")?.value !== baseTopBefore;
    i++
  ) {
    log(
      "desktop 복귀 대기",
      JSON.stringify({
        top: bandsDesktop?.find((b) => b.id === "padding:top")?.value,
        layout: await readLayout(page, boxId),
        engine: await page.evaluate(
          (id) =>
            window.__composition_SPACING_DEBUG__.getSnapshot().owner?.padding,
          boxId,
        ),
      }),
    );
    await page.waitForTimeout(500);
    bandsDesktop = (await spacingDebug(page)).bands;
  }
  record(
    "desktop 복귀 → padding:top 띠 값 = base — override 는 mobile 에만",
    bandsDesktop?.find((b) => b.id === "padding:top")?.value === baseTopBefore,
    JSON.stringify(bandsDesktop?.map((b) => `${b.id}=${b.value}`)),
  );

  // 19) 패널 padding link ON → 캔버스 어느 변을 끌어도 4변 같은 값 (잡은 변 시작값 + delta)
  await setPanel(page, "styles", true);
  await page.waitForTimeout(500);
  const linkBtn = page.locator(".box-model__link").first();
  await linkBtn.click();
  await page.waitForTimeout(200);
  const linkPressed = await linkBtn.getAttribute("aria-pressed");
  await focusOwner(page);
  const styleLinkBefore = await readStyle(page, boxId);
  const rightL = await handleScreenPoint(page, "padding:right");
  // right 띠는 고정 폭 (314px) 이라 안쪽 (왼쪽, −x) 으로 끌어야 커진다
  await drag(page, rightL, -6 * rightL.zoom, 0);
  await page.waitForTimeout(250);
  const dbgLink = await spacingDebug(page);
  await page.mouse.up();
  await page.waitForTimeout(1200);
  const styleLink = await readStyle(page, boxId);
  const expectedLink = `${px(styleLinkBefore.paddingRight) + 6}px`;
  record(
    "padding link ON: right +6 드래그 → 세션 4변 · canonical 4변 모두 right 시작값+6 (top/bottom 이 달랐어도 같은 값)",
    linkPressed === "true" &&
      dbgLink.session?.properties?.length === 4 &&
      ["paddingTop", "paddingRight", "paddingBottom", "paddingLeft"].every(
        (k) => styleLink[k] === expectedLink,
      ) &&
      styleLinkBefore.paddingBottom !== styleLinkBefore.paddingRight,
    JSON.stringify({
      linkPressed,
      before: styleLinkBefore,
      after: styleLink,
      sessionProps: dbgLink.session?.properties,
    }),
  );
  await linkBtn.click();
  await page.waitForTimeout(200);

  record(
    "page error 0",
    errors.length === 0,
    errors.join(" | ").slice(0, 300) || "0",
  );
} catch (e) {
  record("harness", false, String(e?.stack ?? e));
} finally {
  writeFileSync(
    resolve(OUT_DIR, "findings.json"),
    JSON.stringify({ findings, errors }, null, 2),
  );
  const pass = findings.filter((f) => f.pass).length;
  log(`${pass}/${findings.length} PASS → ${OUT_DIR}`);
  await browser.close();
  process.exit(pass === findings.length ? 0 : 1);
}
