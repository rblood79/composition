#!/usr/bin/env node
// adr209-f2-residual-live.mjs — ADR-209 후속 F2 의 남은 두 항목 (T11 · T12) live exercise.
//
// 자동 테스트가 못 보는 것만 확인한다:
//   T11 — 실제 Sample Rows 편집기(ItemsManager)에서 기본 행 편집·삭제·Undo/Redo·Chart 재선택,
//         id 없는 기본 행과 중복/누락/숫자 id 행: 올바른 행만 바뀌고 원본 행에 UI id 가 주입되지
//         않으며 그 재현에서 React key/선택 경고가 0 이다.
//   T12 — Styles 패널의 실제 4방향 padding 입력·크기 입력·Themes 패널의 dark 전환:
//         Canvas(Skia 픽셀) 의 plot 이동량과 Preview(Recharts SVG) 의 이동량이 같고, Preview 의
//         content box 가 입력한 padding 과 같으며, dark 에서 series 토큰이 바뀌어도 라벨은 그대로다.
//
// 사용: node apps/builder/scripts/adr209-f2-residual-live.mjs [--headed]
//   결과: /private/tmp/adr209-f2-residual/{findings.json, project.json, *.png, run.log}
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { waitReady, createInstrumentedContext } from "./perf-baseline.mjs";

const BASE_URL = "http://localhost:5173";
const STORAGE_STATE = resolve("apps/builder/scripts/.auth-session.json");
const OUT_DIR = "/private/tmp/adr209-f2-residual";
const headed = process.argv.includes("--headed");

const log = (...a) => console.log("[ADR-209 F2-residual]", ...a);

const findings = [];
function record(name, pass, detail) {
  findings.push({ name, pass, detail });
  log(`${pass ? "PASS" : "FAIL"} — ${name} :: ${detail}`);
}

/**
 * Skia 캔버스 픽셀은 페이지 안에서 못 읽는다 — 스크린샷 PNG 를 페이지에서 디코드한다.
 * 채도 있는 픽셀의 bbox 를 CSS px 로 돌려준다 (선택 overlay 도 채도가 있으므로 측정 전 선택을 푼다).
 */
async function inkBox(page, { minRow = 0 } = {}) {
  const canvas = page.locator("canvas").first();
  const box = await canvas.boundingBox();
  const png = await canvas.screenshot();
  const out = await page.evaluate(
    async ({ base64, minRow }) => {
      const blob = await (await fetch(`data:image/png;base64,${base64}`)).blob();
      const bitmap = await createImageBitmap(blob);
      const off = document.createElement("canvas");
      off.width = bitmap.width;
      off.height = bitmap.height;
      const ctx = off.getContext("2d");
      ctx.drawImage(bitmap, 0, 0);
      const { data, width, height } = ctx.getImageData(0, 0, off.width, off.height);
      let minX = Infinity, minY = Infinity, maxX = -1, maxY = -1, chroma = 0;
      const hues = new Map();
      // 상단 device 툴바(DOM overlay, 채색 아이콘) 행은 제외한다 — 캔버스 스크린샷은 overlay 를 포함한다.
      const startRow = Math.round(minRow);
      for (let y = Math.max(0, startRow); y < height; y++) {
        for (let x = 0; x < width; x++) {
          const i = (y * width + x) * 4;
          const r = data[i], g = data[i + 1], b = data[i + 2];
          const max = Math.max(r, g, b), min = Math.min(r, g, b);
          if (max - min < 60 || max < 90) continue;
          chroma++;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
          const key = `${r >> 5}:${g >> 5}:${b >> 5}`;
          hues.set(key, (hues.get(key) ?? 0) + 1);
        }
      }
      const bands = [...hues.entries()].filter(([, n]) => n > 300).sort((a, b) => b[1] - a[1]);
      return { width, height, chroma, minX, minY, maxX, maxY, signature: `${chroma}|${bands.slice(0, 6).map(([k, n]) => `${k}=${n}`).join(",")}` };
    },
    // minRow 는 CSS px — 하니스 컨텍스트는 DPR 1 이라 이미지 행과 같다 (scale 로 아래에서 확인).
    { base64: png.toString("base64"), minRow },
  );
  const scale = box ? out.width / box.width : 1;
  return {
    chroma: out.chroma,
    signature: out.signature,
    scale,
    // CSS px (DPR 보정). 오른쪽/아래는 픽셀 끝 = index + 1.
    left: out.minX / scale,
    top: out.minY / scale,
    right: (out.maxX + 1) / scale,
    bottom: (out.maxY + 1) / scale,
    clipped: out.minX <= 0 || out.minY <= 0 || out.maxX >= out.width - 1 || out.maxY >= out.height - 1,
  };
}

/** 패널 레일 버튼 — `aria-label` 은 locale 로 번역되므로 **순서**로 잡는다. */
const RAIL_ORDER = ["navigator", "components", "datatable", "datatableEditor", "theme", "ai", "properties", "styles", "interactions", "history"];
function railButton(page, panelId) {
  return page.locator(".panel-toggle-rail button").nth(RAIL_ORDER.indexOf(panelId));
}
async function setPanel(page, panelId, open) {
  const button = railButton(page, panelId);
  const pressed = (await button.getAttribute("aria-pressed")) === "true";
  if (pressed !== open) {
    await button.click();
    await page.waitForTimeout(900);
  }
}

/** 열린 패널을 전부 닫는다 — floating 패널이 캔버스 위에 떠서 Skia 픽셀 측정을 가린다. */
async function closeAllPanels(page) {
  const buttons = page.locator(".panel-toggle-rail button");
  const n = await buttons.count();
  for (let i = 0; i < n; i++) {
    if ((await buttons.nth(i).getAttribute("aria-pressed")) === "true") {
      await buttons.nth(i).click();
      await page.waitForTimeout(500);
    }
  }
  await page.waitForTimeout(600);
}

/** 이름으로 필드셋 하나를 잡는다 (legend 텍스트 = 역할 라벨). scope 로 좁힐 수 있다. */
function fieldset(scope, legend) {
  // `has` 의 내부 locator 는 바깥 요소 기준으로 다시 평가된다 — page 기준 selector 여야 한다.
  const page = typeof scope.page === "function" ? scope.page() : scope;
  return scope.locator("fieldset.properties-aria").filter({ has: page.locator(`legend:text-is("${legend}")`) }).first();
}

async function readOptions(page, legend) {
  const fs = fieldset(page, legend);
  await fs.locator("button.react-aria-Button").first().click();
  await page.waitForTimeout(500);
  const options = await page.evaluate(() =>
    [...document.querySelectorAll('[role="option"]')].map((o) => ({ key: o.id.replace(/^.*?-option-/, ""), text: o.textContent ?? "" })),
  );
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  return options;
}
async function selectOption(page, legend, index) {
  const fs = fieldset(page, legend);
  await fs.locator("button.react-aria-Button").first().click();
  await page.waitForTimeout(500);
  const option = page.locator('[role="option"]').nth(index);
  const text = (await option.textContent()) ?? "";
  await option.click();
  await page.waitForTimeout(1200);
  return text;
}

/** 실제 입력 컨트롤에 값을 넣고 Enter 로 commit 한다. */
async function commitInput(locator, value) {
  await locator.click();
  await locator.fill(String(value));
  await locator.press("Enter");
  await locator.page().waitForTimeout(700);
}

async function chartState(page, id) {
  return page.evaluate((chartId) => {
    const canonical = window.__canonical_STORE__?.getState?.();
    const doc = canonical?.documents?.get?.(canonical.currentProjectId);
    const find = (nodes) => {
      for (const n of nodes ?? []) {
        if (n.id === chartId) return n;
        const hit = find(n.children);
        if (hit) return hit;
      }
      return null;
    };
    const node = doc ? find(doc.children) : null;
    const props = node?.props ?? {};
    return {
      chartType: props.chartType,
      showLegend: props.showLegend,
      data: props.data,
      style: props.style,
      hasColorKey: Object.hasOwn(props, "color"),
    };
  }, id);
}

function selectChart(page, id) {
  return page.evaluate((chartId) => window.__composition_STORE__.getState().setSelectedElement(chartId), id);
}

/** Preview(Compare Mode) iframe 안의 Chart 를 읽는다 — SVG 내부 좌표는 iframe 배율과 무관하다. */
async function readPreview(page) {
  return page.evaluate(() => {
    for (const frame of document.querySelectorAll("iframe")) {
      const doc = frame.contentDocument;
      const chart = doc?.querySelector(".react-aria-Chart");
      if (!chart) continue;
      const svg = chart.querySelector("svg");
      const cs = doc.defaultView.getComputedStyle(chart);
      const paths = [...(svg?.querySelectorAll("path") ?? [])].filter((p) => {
        const fill = doc.defaultView.getComputedStyle(p).fill;
        return fill && fill !== "none" && !/^rgba?\(0, 0, 0, 0\)$/.test(fill);
      });
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const p of paths) {
        const b = p.getBBox();
        minX = Math.min(minX, b.x); minY = Math.min(minY, b.y);
        maxX = Math.max(maxX, b.x + b.width); maxY = Math.max(maxY, b.y + b.height);
      }
      const fills = new Set(paths.map((p) => doc.defaultView.getComputedStyle(p).fill));
      return {
        found: true,
        theme: doc.documentElement.getAttribute("data-theme"),
        padding: [cs.paddingTop, cs.paddingRight, cs.paddingBottom, cs.paddingLeft],
        box: { w: chart.getBoundingClientRect().width, h: chart.getBoundingClientRect().height },
        svg: { w: svg?.getAttribute("width"), h: svg?.getAttribute("height"), viewBox: svg?.getAttribute("viewBox") },
        ink: paths.length ? { left: minX, top: minY, right: maxX, bottom: maxY } : null,
        pathCount: paths.length,
        fills: [...fills],
        seriesVar: cs.getPropertyValue("--chart-series-1").trim(),
        background: cs.backgroundColor,
        texts: [...(svg?.querySelectorAll("text") ?? [])].map((t) => t.textContent?.trim()).filter(Boolean),
      };
    }
    return { found: false };
  });
}

const delta = (a, b) => ({
  left: +(b.left - a.left).toFixed(2),
  top: +(b.top - a.top).toFixed(2),
  right: +(b.right - a.right).toFixed(2),
  bottom: +(b.bottom - a.bottom).toFixed(2),
});
const close = (a, b, tol) => Math.abs(a - b) <= tol;

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: !headed });
  const storageState = JSON.parse(readFileSync(STORAGE_STATE, "utf8"));
  const { page } = await createInstrumentedContext(browser, { storageState, cpuThrottle: 1 });
  const consoleMessages = [];
  page.on("console", (m) => {
    if (m.type() === "error" || m.type() === "warning") consoleMessages.push(m.text());
  });
  const keyWarnings = () => consoleMessages.filter((t) => /same key|unique "key"|unique key|Selection key|selectedKey/i.test(t));

  try {
    await page.goto(`${BASE_URL}/dashboard`, { waitUntil: "networkidle" });
    const create = page.locator("button.dashboard-create-button").first();
    await create.waitFor({ state: "visible", timeout: 20_000 });
    await create.click();
    const nameInput = page.locator("#new-project-name");
    await nameInput.waitFor({ state: "visible", timeout: 10_000 });
    await nameInput.fill(`adr209-f2r-${Date.now()}`);
    await nameInput.press("Enter");
    await page.waitForURL(/\/builder\/[^/?]+$/, { timeout: 90_000 });
    await waitReady(page);
    log("project", page.url());

    // ── Chart 배치 (binding 없음 → Sample Rows 편집기가 보인다) ─────────────
    await setPanel(page, "components", true);
    await page.locator('[data-component-type="Chart"], button:has-text("chart")').first().click();
    await page.waitForTimeout(2500);
    const chartId = await page.evaluate(() => window.__composition_STORE__.getState().elements.find((e) => e.type === "Chart")?.id ?? null);
    if (!chartId) throw new Error("Chart 미생성");
    await setPanel(page, "components", false);
    await setPanel(page, "properties", true);
    await page.waitForTimeout(900);
    const initial = await chartState(page, chartId);
    const sampleRows = initial.data.map((r) => ({ ...r }));
    const consoleAtStart = consoleMessages.length;

    // ══ T11 ═══════════════════════════════════════════════════════════════
    const rows = page.locator(".items-manager-row");
    const rowCount = await rows.count();
    record(
      "T11 · 기본 행이 id 없이 Sample Rows 편집기에 나열된다",
      rowCount === sampleRows.length && sampleRows.every((r) => !Object.hasOwn(r, "id")),
      `행 ${rowCount} / canonical ${sampleRows.length} · id 보유 행 ${sampleRows.filter((r) => Object.hasOwn(r, "id")).length}`,
    );
    await page.screenshot({ path: `${OUT_DIR}/10-rows.png` });

    // 행 1 (Tue/A) 펼쳐서 Value 와 Category 편집
    await rows.nth(1).locator('button[aria-label="Expand"]').click();
    await page.waitForTimeout(400);
    const row1Fields = rows.nth(1).locator(".items-manager-row-fields");
    await commitInput(fieldset(row1Fields, "Value").locator("input").first(), "99");
    await commitInput(fieldset(row1Fields, "Category").locator("input").first(), "Tue-edit");
    const afterEdit = await chartState(page, chartId);
    const editedRow = afterEdit.data[1];
    const others = afterEdit.data.filter((_, i) => i !== 1);
    record(
      "T11 · 편집은 그 행만 바꾸고 다른 행·id 는 그대로다",
      String(editedRow?.value) === "99" && editedRow?.category === "Tue-edit" && editedRow?.series === "A" &&
        others.every((r, i) => JSON.stringify(r) === JSON.stringify(sampleRows.filter((_, j) => j !== 1)[i])) &&
        afterEdit.data.every((r) => !Object.hasOwn(r, "id")),
      `row1=${JSON.stringify(editedRow)} · 나머지 ${others.length}행 불변 · id 주입 ${afterEdit.data.filter((r) => Object.hasOwn(r, "id")).length}`,
    );
    const title1 = (await rows.nth(1).locator(".editor-item-title").textContent())?.trim();
    record("T11 · 편집기 라벨이 편집 결과를 따라간다", title1 === "Tue-edit", `label=${JSON.stringify(title1)}`);

    // 행 2 (Wed/A) 삭제
    await rows.nth(2).locator('button[aria-label="Remove item"]').click();
    await page.waitForTimeout(900);
    const afterDelete = await chartState(page, chartId);
    record(
      "T11 · 삭제는 지정한 행만 지운다",
      afterDelete.data.length === sampleRows.length - 1 && afterDelete.data[2]?.category === "Thu" && afterDelete.data[1]?.category === "Tue-edit",
      `${sampleRows.length} → ${afterDelete.data.length} · data[2]=${JSON.stringify(afterDelete.data[2])}`,
    );

    // Undo / Redo — 실제 store 액션 (단축키 경로는 F2 본 하니스가 확인)
    await page.evaluate(() => window.__composition_STORE__.getState().undo());
    await page.waitForTimeout(1200);
    const undone = await chartState(page, chartId);
    await page.evaluate(() => window.__composition_STORE__.getState().redo());
    await page.waitForTimeout(1200);
    const redone = await chartState(page, chartId);
    record(
      "T11 · Undo 가 삭제한 행을 되살리고 Redo 가 다시 지운다",
      undone.data.length === sampleRows.length && undone.data[2]?.category === "Wed" && redone.data.length === sampleRows.length - 1,
      `undo ${undone.data.length}행 (data[2]=${undone.data[2]?.category}) · redo ${redone.data.length}행`,
    );

    // Chart 재선택 — 편집기가 다시 열리고 행 수가 canonical 과 같다
    await selectChart(page, null);
    await page.waitForTimeout(800);
    const rowsWhenDeselected = await rows.count();
    await selectChart(page, chartId);
    await page.waitForTimeout(1200);
    const rowsReselected = await rows.count();
    record(
      "T11 · Chart 재선택 뒤 편집기가 canonical 행 수로 다시 열린다",
      rowsWhenDeselected === 0 && rowsReselected === redone.data.length,
      `해제 ${rowsWhenDeselected} → 재선택 ${rowsReselected} (canonical ${redone.data.length})`,
    );

    // 중복·누락·숫자 id 행 — 실제 store 액션으로 실어 실제 편집기에서 편집/삭제
    const oddRows = [
      { id: "same", category: "A", value: 1, series: "A" },
      { id: "same", category: "B", value: 2, series: "A" },
      { category: "C", value: 3, series: "A" },
      { id: 7, category: "D", value: 4, series: "A" },
    ];
    await page.evaluate(({ id, data }) => window.__composition_STORE__.getState().updateElementProps(id, { data }), { id: chartId, data: oddRows });
    await page.waitForTimeout(1200);
    const oddCount = await rows.count();
    await rows.nth(1).locator('button[aria-label="Expand"]').click();
    await page.waitForTimeout(400);
    await commitInput(fieldset(rows.nth(1).locator(".items-manager-row-fields"), "Value").locator("input").first(), "42");
    const oddEdited = await chartState(page, chartId);
    await rows.nth(3).locator('button[aria-label="Remove item"]').click();
    await page.waitForTimeout(900);
    const oddDeleted = await chartState(page, chartId);
    record(
      "T11 · 중복 id 두 행 중 편집한 위치만 바뀌고 숫자 id 행 삭제도 그 행만 지운다",
      oddCount === 4 && String(oddEdited.data[1]?.value) === "42" && oddEdited.data[0]?.value === 1 &&
        oddDeleted.data.length === 3 && oddDeleted.data.map((r) => r.category).join(",") === "A,B,C",
      `rows=${oddCount} · edited=${JSON.stringify(oddEdited.data.map((r) => [r.id, r.value]))} · deleted=${JSON.stringify(oddDeleted.data.map((r) => [r.id, r.category]))}`,
    );
    record(
      "T11 · 원본 행의 id 필드는 그대로다 (UI id 주입 0)",
      JSON.stringify(oddDeleted.data.map((r) => (Object.hasOwn(r, "id") ? r.id : "∅"))) === JSON.stringify(["same", "same", "∅"]),
      JSON.stringify(oddDeleted.data.map((r) => (Object.hasOwn(r, "id") ? r.id : "∅"))),
    );
    const warnings = keyWarnings();
    record(
      "T11 · 위 재현에서 React key / 선택 경고 0",
      warnings.length === 0,
      warnings.length ? warnings.slice(0, 3).join(" | ").slice(0, 300) : `console error/warning ${consoleMessages.length - consoleAtStart}건 중 key/selection 0`,
    );
    await page.screenshot({ path: `${OUT_DIR}/11-odd-rows.png` });

    // ══ T12 ═══════════════════════════════════════════════════════════════
    // 기본 행으로 되돌리고 pie 로 — 원은 padding 이동량을 한 값으로 드러낸다.
    await page.evaluate(({ id, data }) => window.__composition_STORE__.getState().updateElementProps(id, { data }), { id: chartId, data: sampleRows });
    await page.waitForTimeout(800);
    // Chart Type 은 기본 dropdown 으로 노출하지 않는 계약(T8) 이라 F2 본 하니스와 같이 실제 store 액션으로 바꾼다.
    await page.evaluate(({ id }) => window.__composition_STORE__.getState().updateElementProps(id, { chartType: "pie" }), { id: chartId });
    await page.waitForTimeout(1500);
    // 범례를 실제 스위치로 끈다 — 범례 색 견본은 Skia 픽셀 bbox 에 섞이고(하단 밴드) Recharts 범례는 별도 HTML 이라
    //   두 leg 의 잉크 집합을 원 하나로 맞춘다. plot 높이도 범례 폭(outer.w 의존)에 흔들리지 않는다.
    const legendSwitch = fieldset(page, "Show Legend").locator(".react-aria-Switch").first();
    if (await legendSwitch.count()) {
      await legendSwitch.click();
      await page.waitForTimeout(1200);
    }
    const pieState = await chartState(page, chartId);
    record("T12 · pie 전환·범례 해제가 canonical 에 실린다", pieState.chartType === "pie" && pieState.showLegend === false, `chartType=${pieState.chartType} showLegend=${pieState.showLegend} (switch ${await legendSwitch.count()})`);

    // 줌 100% — 픽셀 = scene px
    await commitInput(page.getByLabel("Zoom level").first(), "100");
    const zoomText = await page.getByLabel("Zoom level").first().inputValue();

    // 페이지를 아래로 밀어 차트가 상단 device 툴바 아래에 오게 한다.
    await page.mouse.move(700, 500);
    await page.mouse.wheel(0, -160);
    await page.waitForTimeout(800);

    // Skia 픽셀 측정: 패널 전부 닫고 · 선택 해제 · 마우스 치우고 · 툴바 행(48px) 제외
    async function measureSkia() {
      await closeAllPanels(page);
      await selectChart(page, null);
      await page.mouse.move(300, 890);
      await page.waitForTimeout(800);
      const ink = await inkBox(page, { minRow: 48 });
      await setPanel(page, "styles", true);
      await selectChart(page, chartId);
      await page.waitForTimeout(900);
      return ink;
    }

    // 크기 360×260 (Styles 패널 실제 입력, 페이지 390 폭 안) — resize
    const inkBefore = await measureSkia();
    await commitInput(page.locator("fieldset.property-unit-input.width input").first(), "360");
    await commitInput(page.locator("fieldset.property-unit-input.height input").first(), "260");
    const sized = await chartState(page, chartId);
    const inkSized = await measureSkia();
    record(
      "T12 · resize 가 canonical 과 Skia 픽셀에 같이 반영된다",
      String(sized.style?.width).startsWith("360") && String(sized.style?.height).startsWith("260") &&
        inkSized.chroma > 0 && inkSized.signature !== inkBefore.signature && !inkSized.clipped,
      `style=${JSON.stringify({ width: sized.style?.width, height: sized.style?.height })} · zoom=${zoomText} · ink ${Math.round(inkBefore.right - inkBefore.left)}×${Math.round(inkBefore.bottom - inkBefore.top)} → ${Math.round(inkSized.right - inkSized.left)}×${Math.round(inkSized.bottom - inkSized.top)} (scale ${inkSized.scale})`,
    );

    // 4방향 padding — 상태 A 와 B. 기대 이동량 (범례 off, 높이가 짧은 변):
    //   A: T8 L40 R16 B24 · B: T24 L8 R40 B8
    //   Δplot.x = ΔL = -32, Δplot.y = ΔT = +16, Δplot.w = -(ΔL+ΔR) = +8, Δplot.h = -(ΔT+ΔB) = 0
    //   원 중심 Δ = (ΔL + Δw/2, ΔT + Δh/2) = (-28, +16), 반지름 Δ = 0 → 네 변 모두 (-28, +16)
    const PAD_A = { Top: 8, Left: 40, Right: 16, Bottom: 24 };
    const PAD_B = { Top: 24, Left: 8, Right: 40, Bottom: 8 };
    const EXPECTED = { left: -28, top: 16, right: -28, bottom: 16 };
    async function setPadding(pad) {
      await setPanel(page, "styles", true);
      await selectChart(page, chartId);
      await page.waitForTimeout(900);
      const expand = page.locator('button[aria-label="Expand spacing to 4-way input"]');
      if (await expand.count()) {
        await expand.first().click();
        await page.waitForTimeout(500);
      }
      const grid = page.locator("fieldset.layout-padding");
      for (const [dir, value] of Object.entries(pad)) {
        await commitInput(grid.locator(`input[aria-label="${dir}"]`).first(), value);
      }
      await page.waitForTimeout(600);
      return chartState(page, chartId);
    }
    const stateA = await setPadding(PAD_A);
    const skiaA = await measureSkia();
    await page.locator("canvas").first().screenshot({ path: `${OUT_DIR}/12-skia-padding-A.png` });
    const stateB = await setPadding(PAD_B);
    const skiaB = await measureSkia();
    await page.locator("canvas").first().screenshot({ path: `${OUT_DIR}/13-skia-padding-B.png` });
    const padOf = (s) => [s.style?.paddingTop, s.style?.paddingRight, s.style?.paddingBottom, s.style?.paddingLeft];
    // presentation lane 은 숫자, immediate lane 은 "Npx" 문자열을 남긴다 (LayoutSection.handlePaddingChange) — 둘 다 같은 해석기를 탄다.
    const padNum = (s) => padOf(s).map((v) => (typeof v === "number" ? v : parseFloat(String(v))));
    record(
      "T12 · 4방향 padding 이 각 방향 longhand 로 canonical 에 실린다",
      JSON.stringify(padNum(stateA)) === JSON.stringify([8, 16, 24, 40]) && JSON.stringify(padNum(stateB)) === JSON.stringify([24, 40, 8, 8]),
      `A=${JSON.stringify(padOf(stateA))} B=${JSON.stringify(padOf(stateB))} (원형 그대로)`,
    );
    const skiaDelta = delta(skiaA, skiaB);
    record(
      "T12 · Skia plot 이동량이 padding 차이에서 계산한 기대값과 같다 (±1.5px)",
      !skiaA.clipped && !skiaB.clipped && Object.keys(EXPECTED).every((k) => close(skiaDelta[k], EXPECTED[k], 1.5)),
      `Skia Δ=${JSON.stringify(skiaDelta)} 기대=${JSON.stringify(EXPECTED)} · clipped ${skiaA.clipped}/${skiaB.clipped} · A bbox=${JSON.stringify({ l: +skiaA.left.toFixed(1), t: +skiaA.top.toFixed(1), r: +skiaA.right.toFixed(1), b: +skiaA.bottom.toFixed(1) })}`,
    );

    // Preview (Compare Mode) — DOM leg 는 Skia 뒤에 잰다 (Compare Mode 는 캔버스를 반폭으로 줄인다)
    const compare = page.locator('[aria-label="Compare Mode (Preview + Skia)"]').first();
    let domB = null, domA = null;
    if (await compare.count()) {
      await compare.click();
      await page.waitForTimeout(8000);
      domB = await readPreview(page);
      await page.screenshot({ path: `${OUT_DIR}/14-preview-padding-B.png` });
      await setPadding(PAD_A);
      await page.waitForTimeout(2500);
      domA = await readPreview(page);
      await page.screenshot({ path: `${OUT_DIR}/15-preview-padding-A.png` });
    }
    record(
      "T12 · Preview content box 가 입력한 padding 과 같다",
      !!domA?.found && JSON.stringify(domA.padding) === JSON.stringify(["8px", "16px", "24px", "40px"]) && JSON.stringify(domB?.padding) === JSON.stringify(["24px", "40px", "8px", "8px"]),
      `A=${JSON.stringify(domA?.padding)} B=${JSON.stringify(domB?.padding)} · box=${JSON.stringify(domA?.box)} (기대 360×260) svg=${JSON.stringify(domA?.svg)}`,
    );
    const domDelta = domA?.ink && domB?.ink ? delta(domA.ink, domB.ink) : null;
    record(
      "T12 · Preview plot 이동량이 Skia 와 같다 (±1.5px)",
      !!domDelta && Object.keys(EXPECTED).every((k) => close(domDelta[k], skiaDelta[k], 1.5) && close(domDelta[k], EXPECTED[k], 1.5)),
      `Preview Δ=${JSON.stringify(domDelta)} · Skia Δ=${JSON.stringify(skiaDelta)} · Preview A ink=${JSON.stringify(domA?.ink && { l: +domA.ink.left.toFixed(1), t: +domA.ink.top.toFixed(1), r: +domA.ink.right.toFixed(1), b: +domA.ink.bottom.toFixed(1) })}`,
    );
    record(
      "T12 · Preview 의 원이 content box 안에 있다",
      !!domA?.ink && domA.ink.left >= 40 - 1 && domA.ink.top >= 8 - 1 && domA.ink.right <= domA.box.w - 16 + 1 && domA.ink.bottom <= domA.box.h - 24 + 1,
      `ink=${JSON.stringify(domA?.ink)} content=[40..${domA?.box?.w - 16}]×[8..${domA?.box?.h - 24}]`,
    );

    // light → dark (Themes 패널 실제 스위치) — Preview 토큰·Skia 픽셀은 바뀌고 라벨은 그대로
    const lightPreview = domA;
    const lightSkia = await inkBox(page, { minRow: 48 });
    await setPanel(page, "theme", true);
    await page.waitForTimeout(900);
    const darkSwitch = page.getByLabel("Switch to dark mode").first();
    const hasDarkSwitch = await darkSwitch.count();
    if (hasDarkSwitch) {
      await darkSwitch.click({ force: true });
      await page.waitForTimeout(3000);
    }
    const darkPreview = await readPreview(page);
    const darkSkia = await inkBox(page, { minRow: 48 });
    await page.screenshot({ path: `${OUT_DIR}/16-dark.png` });
    record(
      "T12 · dark 전환이 Preview 의 data-theme 과 series/배경 토큰을 바꾼다",
      !!hasDarkSwitch && darkPreview?.theme === "dark" && lightPreview?.theme !== "dark" &&
        (darkPreview.seriesVar !== lightPreview?.seriesVar || darkPreview.background !== lightPreview?.background),
      `theme ${lightPreview?.theme} → ${darkPreview?.theme} · --chart-series-1 ${lightPreview?.seriesVar} → ${darkPreview?.seriesVar} · bg ${lightPreview?.background} → ${darkPreview?.background}`,
    );
    record(
      "T12 · dark 에서도 라벨·경로 수·padding 은 그대로다",
      !!darkPreview?.found && JSON.stringify(darkPreview.texts) === JSON.stringify(lightPreview?.texts) && darkPreview.pathCount === lightPreview?.pathCount && JSON.stringify(darkPreview.padding) === JSON.stringify(lightPreview?.padding),
      `texts ${lightPreview?.texts?.length} → ${darkPreview?.texts?.length} · paths ${lightPreview?.pathCount} → ${darkPreview?.pathCount}`,
    );
    record(
      "T12 · Skia 도 같은 스위치로 dark 로 바뀐다",
      darkSkia.chroma > 0 && darkSkia.signature !== lightSkia.signature,
      `signature ${lightSkia.signature.slice(0, 60)} → ${darkSkia.signature.slice(0, 60)}`,
    );
    if (hasDarkSwitch) {
      await page.getByLabel("Switch to light mode").first().click({ force: true });
      await page.waitForTimeout(2000);
    }
    const backToLight = await readPreview(page);
    record("T12 · light 복귀", backToLight?.theme !== "dark" && backToLight?.seriesVar === lightPreview?.seriesVar, `theme=${backToLight?.theme} series=${backToLight?.seriesVar}`);
    await setPanel(page, "theme", false);

    // ── 저장 완료 뒤 실제 메뉴 Export → 독립 Publish 하니스 입력 ────────────
    await page.waitForTimeout(3000);
    let exported = null;
    try {
      await page.locator(".header-menu-trigger, button.header-menu-button, [aria-label='Menu']").first().click();
      await page.waitForTimeout(600);
      const exportItem = page.locator('.header-menu-item[id$="export"], .header-menu-item').filter({ hasText: /^(내보내기|Export)$/ }).first();
      const [download] = await Promise.all([page.waitForEvent("download", { timeout: 20_000 }), exportItem.click()]);
      const exportPath = `${OUT_DIR}/project.json`;
      await download.saveAs(exportPath);
      exported = JSON.parse(readFileSync(exportPath, "utf8"));
    } catch (error) {
      log("export 실패", error?.message ?? error);
    }
    const find = (nodes) => {
      for (const n of nodes ?? []) {
        if (n.id === chartId) return n;
        const hit = find(n.children);
        if (hit) return hit;
      }
      return null;
    };
    const exportedChart = exported ? find(exported.document?.children) : null;
    record(
      "Export 문서가 pie · 360×260 · padding A · 기본 행을 보존한다 (Publish 입력)",
      !!exportedChart && exportedChart.props?.chartType === "pie" && exportedChart.props?.style?.paddingLeft === "40px" && exportedChart.props?.style?.paddingTop === "8px" && Array.isArray(exportedChart.props?.data) && exportedChart.props.data.length === sampleRows.length,
      exportedChart ? JSON.stringify({ chartType: exportedChart.props?.chartType, style: exportedChart.props?.style, rows: exportedChart.props?.data?.length, darkMode: exported?.document?.themes?.darkMode ?? exported?.document?.themeConfig?.darkMode ?? null }) : "export 없음",
    );

    writeFileSync(`${OUT_DIR}/findings.json`, JSON.stringify({ project: page.url(), chartId, findings, consoleMessages: consoleMessages.slice(0, 60) }, null, 2));
    const failed = findings.filter((f) => !f.pass);
    log(`결과 ${findings.length - failed.length}/${findings.length} PASS`);
    if (failed.length) process.exitCode = 1;
  } catch (error) {
    log("ERROR", error?.stack ?? error);
    await page.screenshot({ path: `${OUT_DIR}/error.png` }).catch(() => {});
    writeFileSync(`${OUT_DIR}/findings.json`, JSON.stringify({ findings, error: String(error?.stack ?? error), consoleMessages: consoleMessages.slice(0, 60) }, null, 2));
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

main();
