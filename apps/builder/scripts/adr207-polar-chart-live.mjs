#!/usr/bin/env node
// adr207-polar-chart-live.mjs — 극좌표 차트(radar/radial) live exercise (G5).
//
// 단위·parity 테스트가 못 보는 것만 본다:
//   1) 팔레트 → binding enum → factory → 두 leg 이 실제로 이어져 있는가
//      (`chartType: "radar"` 가 화면을 바꾸는가 — 등록만 되고 안 받는 형태가 아닌가)
//   2) `AxisScene.grid` 의 PathMark 가 두 leg 에 실제로 도달하는가
//      (Skia 픽셀 변화 + Preview DOM 의 격자 path)
//   3) gridType polygon/circle 이 화면에서 정말 다른 그림인가
//   4) radial 툴팁 히트가 반지름으로 갈리는가 (누적에서 각도로는 안 갈린다)
//
// 측정 규율: Skia 픽셀은 **Compare Mode 를 끄고 전체 폭에서 먼저** 잰다 —
//   Compare Mode 는 캔버스를 반폭으로 줄여 면적 변화를 지운다
//   (메모리 `feedback-compare-mode-halves-canvas-hides-area-delta`).
//
// 사용: node apps/builder/scripts/adr207-polar-chart-live.mjs [--headed]
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { waitReady, createInstrumentedContext } from "./perf-baseline.mjs";

const BASE_URL = "http://localhost:5173";
const STORAGE_STATE = resolve("apps/builder/scripts/.auth-session.json");
const OUT_DIR = "/private/tmp/adr207-polar-live";
const headed = process.argv.includes("--headed");

function log(...args) {
  console.log("[polar live]", ...args);
}

async function createProject(page) {
  await page.goto(`${BASE_URL}/dashboard`, { waitUntil: "networkidle" });
  const create = page.locator("button.dashboard-create-button").first();
  await create.waitFor({ state: "visible", timeout: 20_000 });
  await create.click();
  const input = page.locator("#new-project-name");
  await input.waitFor({ state: "visible", timeout: 10_000 });
  await input.fill(`polar-${Date.now()}`);
  await input.press("Enter");
  await page.waitForURL(/\/builder\/[^/?]+$/, { timeout: 90_000 });
  await waitReady(page);
  return page.url();
}

/** Skia 캔버스 픽셀 — 페이지 안에서 못 읽어 스크린샷을 디코드한다. */
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

/** Preview 의 차트 DOM 요약 — 격자 path 를 stroke 토큰으로 가려낸다. */
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
      // 격자 = 축 토큰으로 **긋는** path (radar 동심 격자).
      const gridPaths = paths.filter((p) =>
        (p.getAttribute("stroke") ?? "").includes("--chart-grid"),
      );
      // 트랙 = 축 토큰으로 **채우는** path (radial). 둘은 다른 축이다.
      const trackPaths = paths.filter((p) =>
        (p.getAttribute("fill") ?? "").includes("--chart-grid"),
      );
      const dataPaths = paths.filter((p) =>
        (p.getAttribute("fill") ?? "").includes("--chart-series"),
      );
      const tooltip = chart.querySelector(".react-aria-Chart-tooltip");
      return {
        found: true,
        pathCount: paths.length,
        gridCount: gridPaths.length,
        trackCount: trackPaths.length,
        dataCount: dataPaths.length,
        lineCount: svg.querySelectorAll("line").length,
        textCount: svg.querySelectorAll("text").length,
        gridD: gridPaths.map((p) => p.getAttribute("d") ?? "").join("|"),
        allD: paths.map((p) => p.getAttribute("d") ?? "").join("|"),
        fillRules: paths.map((p) => p.getAttribute("fill-rule") ?? ""),
        textContent: [...svg.querySelectorAll("text")].map(
          (t) => t.textContent ?? "",
        ),
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

    // ── binding enum 이 실제로 팔레트 UI 에 왔는가 (등록 8지점의 Inspector 축) ──
    await page.evaluate(
      ({ id }) =>
        window.__composition_STORE__
          .getState()
          .setSelectedElementId?.(id) ??
        window.__composition_STORE__.getState().selectElement?.(id),
      { id },
    );
    await page.waitForTimeout(1200);
    const enumOptions = await page.evaluate(() => {
      const labels = [...document.querySelectorAll("select, [role=listbox], button")];
      const chartTypeSelect = document.querySelector(
        'select[name="chartType"], [data-prop-key="chartType"] select',
      );
      if (chartTypeSelect) {
        return [...chartTypeSelect.options].map((o) => o.value);
      }
      return labels.length ? null : null;
    });
    if (enumOptions) {
      record(
        "Properties 패널의 chartType 에 radar/radial 이 있다",
        enumOptions.includes("radar") && enumOptions.includes("radial"),
        `options=${enumOptions.join(",")}`,
      );
    }

    // ── Phase A — Skia 만 (Compare Mode 끄고 전체 폭) ────────────────────
    const inkOf = async (props) => {
      await setProps(page, id, props);
      return canvasInk(page);
    };

    const barInk = await inkOf({
      chartType: "bar",
      showLegend: false,
      showGrid: false,
    });
    const radarInk = await inkOf({ chartType: "radar", showGrid: true });
    record(
      "P2 radar — Skia 픽셀이 bar 와 갈린다 (enum 이 실제로 도달)",
      radarInk.hash !== barInk.hash && radarInk.ink > 0,
      `hash ${barInk.hash} → ${radarInk.hash} (ink ${barInk.ink} → ${radarInk.ink})`,
    );

    const polygonInk = radarInk;
    const circleInk = await inkOf({ gridType: "circle" });
    record(
      "P2 gridType — polygon/circle 이 Skia 에서 다른 그림",
      circleInk.hash !== polygonInk.hash,
      `hash ${polygonInk.hash} → ${circleInk.hash} (ink ${polygonInk.ink} → ${circleInk.ink})`,
    );

    const radialInk = await inkOf({ chartType: "radial", gridType: "polygon" });
    record(
      "P3 radial — Skia 픽셀이 radar 와 갈린다",
      radialInk.hash !== radarInk.hash && radialInk.ink > 0,
      `hash ${radarInk.hash} → ${radialInk.hash} (ink ${radialInk.ink})`,
    );

    const radialStackedInk = await inkOf({ stackType: "stacked" });
    record(
      "P3 radial 누적 — 호가 각도로 이어 붙어 그림이 갈린다",
      radialStackedInk.hash !== radialInk.hash,
      `hash ${radialInk.hash} → ${radialStackedInk.hash}`,
    );

    // 후속 #1 — `fillArea` 는 **Compare Mode 를 켜기 전에** 잰다. Compare Mode 는
    //   캔버스를 반폭으로 줄여 픽셀 변화를 지운다 (실제로 1차 실행에서 해시가
    //   완전히 동일하게 나왔다 — 메모리 `feedback-compare-mode-halves-canvas-...`).
    const fillOnInk = await inkOf({
      chartType: "radar",
      gridType: "polygon",
      showGrid: true,
      fillArea: true,
    });
    const fillOffInk = await inkOf({ fillArea: false });
    record(
      "#1 fillArea — Skia 잉크가 준다 (DOM 만 반응하는 형태가 아니다)",
      fillOffInk.ink < fillOnInk.ink &&
        fillOffInk.ink > 0 &&
        fillOnInk.hash !== fillOffInk.hash,
      `ink ${fillOnInk.ink} → ${fillOffInk.ink} (hash ${fillOnInk.hash} → ${fillOffInk.hash})`,
    );
    await setProps(page, id, { fillArea: true });

    // ── Phase B — Compare Mode 로 Preview DOM 대조 ────────────────────────
    const previewTab = page
      .locator('[aria-label="Compare Mode (Preview + Skia)"]')
      .first();
    await previewTab.click();
    await page.waitForTimeout(6000);

    await setProps(page, id, {
      chartType: "radar",
      stackType: "dodged",
      showGrid: true,
      gridType: "polygon",
    });
    const polygon = await previewInfo(page);
    record(
      "P1 격자 PathMark 가 Preview DOM 에 도달한다",
      polygon.found && polygon.gridCount > 0,
      `grid path ${polygon.gridCount} / 전체 ${polygon.pathCount}, line ${polygon.lineCount}`,
    );
    record(
      "P2 polygon 격자에는 호 명령(A)이 없다",
      polygon.gridD.length > 0 && !polygon.gridD.includes("A "),
      `gridD="${polygon.gridD.slice(0, 60)}"`,
    );

    await setProps(page, id, { gridType: "circle" });
    const circle = await previewInfo(page);
    record(
      "P2 circle 격자는 호 명령(A)으로 온다 — 같은 개수, 다른 그림",
      circle.gridCount === polygon.gridCount &&
        circle.gridD.includes("A ") &&
        circle.gridD !== polygon.gridD,
      `grid ${polygon.gridCount} → ${circle.gridCount}, gridD="${circle.gridD.slice(0, 60)}"`,
    );

    record(
      "P1 스포크 — 범주 수만큼 line 이 온다",
      polygon.lineCount >= 3,
      `line ${polygon.lineCount}`,
    );

    await setProps(page, id, { chartType: "radial", showGrid: false });
    const radial = await previewInfo(page);
    record(
      "P3 radial — 트랙 호가 evenodd 고리로 온다",
      radial.fillRules.filter((r) => r === "evenodd").length > 0,
      `path ${radial.pathCount}, fillRule=${radial.fillRules.join(",")}`,
    );
    record(
      "P3 radial — 트랙이 축 토큰으로 **채워진다** (선만이면 동심원 2개로 읽힌다)",
      radial.trackCount > 0,
      `track(fill) ${radial.trackCount}, data(fill) ${radial.dataCount}`,
    );
    record(
      "P3 radial — 극좌표 축을 안 그린다 (트랙이 격자 노릇)",
      radial.gridCount === 0 && radial.lineCount === 0,
      `grid stroke path ${radial.gridCount}, line ${radial.lineCount}`,
    );

    await setProps(page, id, { stackType: "stacked", showValueLabels: true });
    const radialStacked = await previewInfo(page);
    record(
      "P3 radial 누적 + 값 레이블 — 호와 텍스트가 는다",
      radialStacked.pathCount > radial.pathCount &&
        radialStacked.textCount > 0,
      `path ${radial.pathCount} → ${radialStacked.pathCount}, text ${radialStacked.textCount}`,
    );

    // ── P4 툴팁 — radial 은 반지름으로 갈린다 ─────────────────────────────
    await setProps(page, id, {
      stackType: "dodged",
      showValueLabels: false,
      showTooltip: true,
    });
    const beforeHover = await previewInfo(page);
    record(
      "P4 툴팁 — hover 전에는 없다",
      beforeHover.tooltip === null,
      `tooltip=${beforeHover.tooltip}`,
    );

    const chartFrame = page
      .frames()
      .find((f) => f !== page.mainFrame() && f.url().includes("preview"));
    const target = (chartFrame ?? page.mainFrame())
      .locator(".react-aria-Chart")
      .first();
    const box = await target.boundingBox();
    // 바깥 링 위쪽 — 중심에서 위로 (outer + inner)/2 쯤. 상자 높이의 ~12% 지점.
    await target.hover({
      position: { x: box.width / 2, y: box.height * 0.12 },
    });
    await page.waitForTimeout(500);
    const outerHover = await previewInfo(page);
    record(
      "P4 radial 툴팁 — 바깥 링 hover 로 뜬다",
      typeof outerHover.tooltip === "string" && outerHover.tooltip.length > 0,
      `tooltip="${outerHover.tooltip}"`,
    );

    // 같은 각도(12시) 에서 안쪽으로만 이동 — 각도가 같으므로 반지름이 갈라야 한다.
    await target.hover({
      position: { x: box.width / 2, y: box.height * 0.36 },
    });
    await page.waitForTimeout(500);
    const innerHover = await previewInfo(page);
    record(
      "P4 radial 툴팁 — 같은 각도에서 반지름만 바꾸면 다른 범주가 나온다",
      typeof innerHover.tooltip === "string" &&
        innerHover.tooltip.length > 0 &&
        innerHover.tooltip !== outerHover.tooltip,
      `바깥="${outerHover.tooltip}" 안쪽="${innerHover.tooltip}"`,
    );

    await page.mouse.move(5, 5);
    await page.waitForTimeout(400);
    const left = await previewInfo(page);
    record(
      "P4 툴팁 — 밖으로 나가면 닫힌다",
      left.tooltip === null,
      `tooltip=${left.tooltip}`,
    );

    // ── shadcn 대조 후속 #1 · #5 · #7 ─────────────────────────────────────
    await setProps(page, id, {
      chartType: "radar",
      showTooltip: false,
      showGrid: true,
      gridType: "polygon",
      showSpokes: true,
      gridRings: 0,
      fillGrid: false,
      fillArea: true,
    });
    const radarBase = await previewInfo(page);
    await setProps(page, id, { showSpokes: false });
    const noSpokes = await previewInfo(page);
    record(
      "#1 showSpokes=false — 스포크만 사라지고 각도 레이블은 남는다",
      noSpokes.lineCount === 0 &&
        radarBase.lineCount > 0 &&
        noSpokes.textCount === radarBase.textCount,
      `line ${radarBase.lineCount} → ${noSpokes.lineCount}, text ${radarBase.textCount} → ${noSpokes.textCount}`,
    );

    await setProps(page, id, { showSpokes: true, gridRings: 1 });
    const oneRing = await previewInfo(page);
    record(
      "#1 gridRings=1 — 격자 링이 하나만 남는다",
      oneRing.gridCount === 1 && radarBase.gridCount > 1,
      `grid ${radarBase.gridCount} → ${oneRing.gridCount}`,
    );

    await setProps(page, id, { gridRings: 0, fillGrid: true });
    const filled = await previewInfo(page);
    record(
      "#1 fillGrid — 가장 바깥 링 **하나만** 축 토큰으로 채워진다",
      filled.trackCount === 1,
      `채운 링 ${filled.trackCount} / 격자 ${filled.gridCount}`,
    );

    await setProps(page, id, { fillGrid: false, fillArea: false });
    const linesOnly = await previewInfo(page);
    record(
      "#1 fillArea=false — 다각형 채우기가 사라진다 (좌표는 그대로)",
      linesOnly.dataCount === 0 && radarBase.dataCount > 0,
      `series fill ${radarBase.dataCount} → ${linesOnly.dataCount}`,
    );

    await setProps(page, id, { fillArea: true });

    await setProps(page, id, {
      chartType: "radial",
      innerRadius: 60,
      startAngle: 0,
      endAngle: 360,
      showTotal: false,
    });
    const fullRing = await previewInfo(page);
    await setProps(page, id, { endAngle: 180 });
    const halfRing = await previewInfo(page);
    record(
      "#5 반원 게이지 — 트랙도 같은 범위만 돈다 (한 바퀴 트랙이면 도넛으로 읽힌다)",
      halfRing.allD !== fullRing.allD && halfRing.trackCount === fullRing.trackCount,
      `track ${fullRing.trackCount} → ${halfRing.trackCount}, d 동일=${halfRing.allD === fullRing.allD}`,
    );

    await setProps(page, id, { showTotal: true });
    const withTotal = await previewInfo(page);
    record(
      "#5 radial 중앙 합계 — em 배율 텍스트가 온다 (pie 와 같은 자리)",
      withTotal.textCount > halfRing.textCount,
      `text ${halfRing.textCount} → ${withTotal.textCount}: ${withTotal.textContent.join("/")}`,
    );

    await setProps(page, id, {
      chartType: "pie",
      startAngle: 0,
      endAngle: 360,
      showTotal: false,
      innerRadius: 0,
      showValueLabels: true,
      labelKey: "value",
    });
    const byValue = await previewInfo(page);
    await setProps(page, id, { labelKey: "category" });
    const byCategory = await previewInfo(page);
    record(
      "#7 labelKey — 좌표는 그대로고 글자만 값→범주명으로 바뀐다",
      byCategory.allD === byValue.allD &&
        byCategory.textContent.join() !== byValue.textContent.join() &&
        byCategory.textContent.some((t) => t === "Mon"),
      `값="${byValue.textContent.join("/")}" 범주="${byCategory.textContent.join("/")}"`,
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
    log("ERROR", error?.message ?? error);
    await page
      .screenshot({ path: `${OUT_DIR}/error.png`, fullPage: false })
      .catch(() => {});
    process.exitCode = 1;
  } finally {
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
  }
}

main();
