#!/usr/bin/env node
// adr194-chart-extensions-live.mjs — shadcn 대조 확장분(P1~P5) live exercise.
//
// 단위 테스트가 못 보는 것만 본다:
//   1) 새 prop 이 **두 leg 에 실제로 도달**하는가 (Skia 픽셀이 바뀌는가 / Preview DOM 이 바뀌는가)
//   2) 툴팁은 Preview 에만 있어야 하고 hover 로 실제로 뜨는가 (DOM 전용 축)
//   3) 도넛/누적/보간이 화면에서 정말 다른 그림인가 (같은 scene 을 두 번 그린 게 아니라)
//
// 사용: node apps/builder/scripts/adr194-chart-extensions-live.mjs [--headed]
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { waitReady, createInstrumentedContext } from "./perf-baseline.mjs";

const BASE_URL = "http://localhost:5173";
const STORAGE_STATE = resolve("apps/builder/scripts/.auth-session.json");
const OUT_DIR = "/private/tmp/adr194-chart-ext-live";
const headed = process.argv.includes("--headed");

function log(...args) {
  console.log("[chart-ext live]", ...args);
}

async function createProject(page) {
  await page.goto(`${BASE_URL}/dashboard`, { waitUntil: "networkidle" });
  const create = page.locator("button.dashboard-create-button").first();
  await create.waitFor({ state: "visible", timeout: 20_000 });
  await create.click();
  const input = page.locator("#new-project-name");
  await input.waitFor({ state: "visible", timeout: 10_000 });
  await input.fill(`chart-ext-${Date.now()}`);
  await input.press("Enter");
  await page.waitForURL(/\/builder\/[^/?]+$/, { timeout: 90_000 });
  await waitReady(page);
  return page.url();
}

/** Skia 캔버스 픽셀 — 페이지 안에서 못 읽어 스크린샷을 디코드한다 (선행 하니스와 같은 이유). */
async function canvasInk(page) {
  const png = await page.locator("canvas").first().screenshot();
  return page.evaluate(
    async ({ base64 }) => {
      const blob = await (await fetch(`data:image/png;base64,${base64}`)).blob();
      const bitmap = await createImageBitmap(blob);
      const off = document.createElement("canvas");
      off.width = bitmap.width;
      off.height = bitmap.height;
      const ctx = off.getContext("2d");
      ctx.drawImage(bitmap, 0, 0);
      const data = ctx.getImageData(0, 0, off.width, off.height).data;
      let ink = 0;
      let hash = 0;
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        // 회색(빌더 크롬)이 아닌 픽셀 = 차트가 그린 것
        if (Math.max(r, g, b) - Math.min(r, g, b) > 30) ink++;
        hash = (hash * 31 + r + g * 3 + b * 7) % 2147483647;
      }
      return { ink, hash };
    },
    { base64: png.toString("base64") },
  );
}

async function setProps(page, id, props) {
  await page.evaluate(
    ({ id, props }) =>
      window.__composition_STORE__.getState().updateElementProps(id, props),
    { id, props },
  );
  await page.waitForTimeout(1400);
}

/** Preview(Compare Mode iframe) 의 차트 DOM 요약. */
async function previewInfo(page) {
  return page.evaluate(() => {
    const docs = [document];
    for (const frame of document.querySelectorAll("iframe")) {
      if (frame.contentDocument) docs.push(frame.contentDocument);
    }
    for (const doc of docs) {
      const chart = doc.querySelector(".react-aria-Chart");
      if (!chart) continue;
      const svg = chart.querySelector("svg");
      if (!svg) continue;
      const paths = [...svg.querySelectorAll("path")];
      const rects = [...svg.querySelectorAll("rect")];
      const texts = [...svg.querySelectorAll("text")];
      const tooltip = chart.querySelector(".react-aria-Chart-tooltip");
      // 세로 막대 열별 높이 합 (expand 검증용)
      const columns = new Map();
      for (const r of rects) {
        const x = Math.round(Number(r.getAttribute("x")));
        const h = Number(r.getAttribute("height"));
        columns.set(x, (columns.get(x) ?? 0) + h);
      }
      return {
        found: true,
        pathCount: paths.length,
        rectCount: rects.length,
        textCount: texts.length,
        firstD: paths[0]?.getAttribute("d") ?? "",
        allD: paths.map((p) => p.getAttribute("d") ?? "").join("|"),
        fillRules: paths.map((p) => p.getAttribute("fill-rule") ?? ""),
        rectFills: rects.map((r) => r.getAttribute("fill") ?? ""),
        fontSizes: texts.map((t) => t.getAttribute("font-size") ?? ""),
        textContent: texts.map((t) => t.textContent ?? ""),
        columnHeights: [...columns.entries()].sort((a, b) => a[0] - b[0]).map((e) => e[1]),
        tooltip: tooltip ? tooltip.textContent : null,
      };
    }
    return { found: false };
  });
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: !headed });
  const storageState = JSON.parse(readFileSync(STORAGE_STATE, "utf8"));
  const { context, page } = await createInstrumentedContext(browser, {
    storageState,
    cpuThrottle: 1,
  });
  const findings = [];
  const record = (name, pass, detail) => {
    findings.push({ name, pass, detail });
    log(`${pass ? "PASS" : "FAIL"} — ${name} :: ${detail}`);
  };

  try {
    const projectUrl = await createProject(page);
    log("project", projectUrl);

    const componentsToggle = page
      .locator('.panel-toggle-rail button[aria-label="components" i]')
      .first();
    if (await componentsToggle.count()) {
      const pressed = await componentsToggle.getAttribute("aria-pressed");
      if (pressed === "false") await componentsToggle.click();
      await page.waitForTimeout(600);
    }
    const chartButton = page
      .locator('[data-component-type="Chart"], button:has-text("chart")')
      .first();
    await chartButton.click();
    await page.waitForTimeout(2500);

    const id = await page.evaluate(
      () =>
        window.__composition_STORE__
          .getState()
          .elements.find((e) => e.type === "Chart")?.id ?? null,
    );
    record("차트가 캔버스에 놓였다", !!id, `id=${id}`);
    if (!id) throw new Error("Chart 요소 없음");

    // ── Phase A — Skia 만 (Compare Mode 끄고) ────────────────────────────
    //   Compare Mode 를 켜면 캔버스가 반폭으로 줄어 차트가 잘려, 도넛 구멍 같은
    //   면적 변화가 픽셀 수에 안 잡힌다 (1차 측정에서 Δ1 로 나왔다 — 실제로는
    //   Δ13,015). 그래서 픽셀은 **전체 폭 상태에서** 먼저 잰다.
    const inkOf = async (props) => {
      await setProps(page, id, props);
      return canvasInk(page);
    };

    const areaDodgedInk = await inkOf({
      chartType: "area",
      stackType: "dodged",
      showLegend: false,
    });
    const areaStackedInk = await inkOf({ stackType: "stacked" });
    record(
      "P1 area 누적 — Skia 픽셀이 갈린다",
      areaDodgedInk.hash !== areaStackedInk.hash,
      `hash ${areaDodgedInk.hash} → ${areaStackedInk.hash} (ink ${areaDodgedInk.ink} → ${areaStackedInk.ink})`,
    );

    const linearInk = await inkOf({
      chartType: "line",
      stackType: "dodged",
      curve: "linear",
    });
    const monotoneInk = await inkOf({ curve: "monotone" });
    record(
      "P2 monotone — Skia 픽셀이 갈린다",
      linearInk.hash !== monotoneInk.hash,
      `hash ${linearInk.hash} → ${monotoneInk.hash}`,
    );

    const dotsInk = await inkOf({ curve: "linear", showDots: true });
    record(
      "P2 showDots — Skia 잉크가 는다 (점이 실제로 찍힌다)",
      dotsInk.ink > linearInk.ink,
      `ink ${linearInk.ink} → ${dotsInk.ink}`,
    );

    const barInk = await inkOf({
      chartType: "bar",
      showDots: false,
      showValueLabels: false,
    });
    const labelInk = await inkOf({ showValueLabels: true });
    record(
      "P3 값 레이블 — Skia 픽셀이 갈린다",
      labelInk.hash !== barInk.hash,
      `hash ${barInk.hash} → ${labelInk.hash}`,
    );

    const pieInk = await inkOf({
      chartType: "pie",
      showValueLabels: false,
      innerRadius: 0,
    });
    const donutInk = await inkOf({ innerRadius: 60 });
    const holeDrop = pieInk.ink - donutInk.ink;
    record(
      "P4 도넛 — Skia 에서 구멍만큼 잉크가 준다",
      holeDrop > pieInk.ink * 0.05,
      `ink ${pieInk.ink} → ${donutInk.ink} (Δ ${holeDrop}, 파이 대비 ${((holeDrop / pieInk.ink) * 100).toFixed(1)}%)`,
    );

    // ── Phase B — Compare Mode 로 Preview DOM 대조 ────────────────────────
    const previewTab = page
      .locator('[aria-label="Compare Mode (Preview + Skia)"]')
      .first();
    await previewTab.click();
    await page.waitForTimeout(6000);

    await setProps(page, id, {
      chartType: "area",
      stackType: "dodged",
      innerRadius: 0,
    });
    const base = await previewInfo(page);
    record(
      "Preview 가 차트를 그린다",
      base.found,
      JSON.stringify({
        paths: base.pathCount,
        rects: base.rectCount,
        texts: base.textCount,
      }),
    );

    const areaDodged = await previewInfo(page);
    await setProps(page, id, { stackType: "stacked" });
    const areaStacked = await previewInfo(page);
    record(
      "P1 area 누적 — Preview path 가 실제로 갈린다",
      areaDodged.allD !== areaStacked.allD &&
        areaStacked.pathCount === areaDodged.pathCount,
      `path ${areaDodged.pathCount} → ${areaStacked.pathCount}, d 동일=${areaDodged.allD === areaStacked.allD}`,
    );

    await setProps(page, id, { chartType: "bar", stackType: "expand" });
    const expand = await previewInfo(page);
    const heights = expand.columnHeights;
    const equalColumns =
      heights.length > 1 && heights.every((h) => Math.abs(h - heights[0]) < 1.5);
    record(
      "P1 expand — 모든 열의 막대 합이 같다 (100% 누적)",
      equalColumns,
      `열 높이 합 ${heights.map((h) => h.toFixed(1)).join(", ")}`,
    );

    await setProps(page, id, {
      chartType: "line",
      stackType: "dodged",
      curve: "linear",
    });
    const linear = await previewInfo(page);
    await setProps(page, id, { curve: "monotone" });
    const monotone = await previewInfo(page);
    record(
      "P2 monotone — Preview d 에 C 명령이 온다",
      monotone.firstD.includes(" C ") && !linear.firstD.includes(" C "),
      `linear="${linear.firstD.slice(0, 40)}" monotone="${monotone.firstD.slice(0, 40)}"`,
    );

    await setProps(page, id, { curve: "step" });
    const step = await previewInfo(page);
    record(
      "P2 step — linear/monotone 과 또 다른 그림",
      step.firstD !== linear.firstD && step.firstD !== monotone.firstD,
      `step="${step.firstD.slice(0, 40)}"`,
    );

    await setProps(page, id, { curve: "linear", showDots: true });
    const dots = await previewInfo(page);
    record(
      "P2 showDots — 시리즈당 path 1개가 늘어난다",
      dots.pathCount === linear.pathCount + 2,
      `path ${linear.pathCount} → ${dots.pathCount}`,
    );

    await setProps(page, id, {
      chartType: "bar",
      showDots: false,
      showValueLabels: false,
    });
    const noLabels = await previewInfo(page);
    await setProps(page, id, { showValueLabels: true });
    const withLabels = await previewInfo(page);
    record(
      "P3 값 레이블 — Preview text 가 막대 수만큼 는다",
      withLabels.textCount > noLabels.textCount,
      `text ${noLabels.textCount} → ${withLabels.textCount}`,
    );

    await setProps(page, id, { showValueLabels: false, colorBy: "category" });
    const mixed = await previewInfo(page);
    record(
      "P3 colorBy=category — 막대 색이 범주 축으로 바뀐다",
      mixed.rectFills.join(",") !== noLabels.rectFills.join(","),
      `series=${noLabels.rectFills.slice(0, 4).join(" ")} / category=${mixed.rectFills.slice(0, 4).join(" ")}`,
    );

    await setProps(page, id, {
      chartType: "pie",
      colorBy: "series",
      innerRadius: 0,
    });
    const pie = await previewInfo(page);
    await setProps(page, id, { innerRadius: 60, showTotal: true });
    const donut = await previewInfo(page);
    record(
      "P4 도넛 — 조각이 evenodd 고리가 된다",
      donut.fillRules.some((r) => r === "evenodd") &&
        !pie.fillRules.some((r) => r === "evenodd"),
      `pie=${pie.fillRules.join(",")} donut=${donut.fillRules.join(",")}`,
    );
    record(
      "P4 합계 — em 배율 텍스트가 DOM 에 온다",
      donut.fontSizes.some((f) => f.endsWith("em")),
      `font-size=${donut.fontSizes.filter(Boolean).join(",")} texts=${donut.textContent.join("/")}`,
    );

    await setProps(page, id, {
      stackType: "stacked",
      innerRadius: 30,
      showTotal: false,
    });
    const rings = await previewInfo(page);
    record(
      "P4 링 — 시리즈마다 조각 묶음이 하나씩 는다",
      rings.pathCount > donut.pathCount,
      `path ${donut.pathCount} → ${rings.pathCount}`,
    );

    // ── P5 툴팁 (Preview 전용) ────────────────────────────────────────────
    await setProps(page, id, {
      chartType: "bar",
      stackType: "dodged",
      innerRadius: 0,
      showTooltip: true,
    });
    const beforeHover = await previewInfo(page);
    record(
      "P5 툴팁 — hover 전에는 없다",
      beforeHover.tooltip === null,
      `tooltip=${beforeHover.tooltip}`,
    );

    const chartFrame = page
      .frames()
      .find((f) => f !== page.mainFrame() && f.url().includes("preview"));
    const target = (chartFrame ?? page.mainFrame())
      .locator(".react-aria-Chart")
      .first();
    await target.hover({ position: { x: 120, y: 100 } });
    await page.waitForTimeout(400);
    const hovered = await previewInfo(page);
    record(
      "P5 툴팁 — hover 하면 범주와 시리즈 값이 뜬다",
      typeof hovered.tooltip === "string" && hovered.tooltip.length > 0,
      `tooltip="${hovered.tooltip}"`,
    );

    // 차트 밖으로 — 요소 좌상단(헤더에 가림)이 아니라 페이지 좌상단으로 뺀다.
    await page.mouse.move(5, 5);
    await page.waitForTimeout(400);
    const left = await previewInfo(page);
    record(
      "P5 툴팁 — 밖으로 나가면 닫힌다",
      left.tooltip === null,
      `tooltip=${left.tooltip}`,
    );

    await page.screenshot({ path: `${OUT_DIR}/final.png`, fullPage: false });

    const passed = findings.filter((f) => f.pass).length;
    writeFileSync(
      `${OUT_DIR}/result.json`,
      JSON.stringify({ projectUrl, findings }, null, 2),
    );
    log(`결과 ${passed}/${findings.length} PASS — ${OUT_DIR}/result.json`);
    process.exitCode = passed === findings.length ? 0 : 1;
  } catch (error) {
    log("ERROR", error.message);
    writeFileSync(
      `${OUT_DIR}/result.json`,
      JSON.stringify({ error: error.message, findings }, null, 2),
    );
    process.exitCode = 1;
  } finally {
    await context.close();
    await browser.close();
  }
}

main();
