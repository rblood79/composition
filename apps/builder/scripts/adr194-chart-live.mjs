#!/usr/bin/env node
// adr194-chart-live.mjs — ADR-194 G5 live exercise.
//
// 무엇을 확인하는가 (test/type-check 가 못 보는 것만):
//   1) 팔레트에 Chart 가 실제로 나오고 클릭으로 캔버스에 놓인다 (등록 8지점이 live 에서 이어졌는가)
//   2) Skia 가 그 자리에 실제 픽셀을 그린다 (rect + 캔버스 크롭의 비배경 픽셀 수)
//   3) Preview 가 같은 자리에 SVG 를 그리고 마크 개수가 0 이 아니다
//   4) chartType 을 바꾸면 Skia 픽셀이 실제로 바뀐다 (prop → 렌더 채널이 살아 있는가)
//   5) dataBinding 없이도 샘플로 보인다 (빈 상자 아님)
//
// 사용: node apps/builder/scripts/adr194-chart-live.mjs [--headed]
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { waitReady, createInstrumentedContext } from "./perf-baseline.mjs";

const BASE_URL = "http://localhost:5173";
const STORAGE_STATE = resolve("apps/builder/scripts/.auth-session.json");
const OUT_DIR = "/private/tmp/adr194-chart-live";
const headed = process.argv.includes("--headed");

function log(...args) {
  console.log("[ADR-194 live]", ...args);
}

async function createProject(page) {
  await page.goto(`${BASE_URL}/dashboard`, { waitUntil: "networkidle" });
  const create = page.locator("button.dashboard-create-button").first();
  await create.waitFor({ state: "visible", timeout: 20_000 });
  await create.click();
  const input = page.locator("#new-project-name");
  await input.waitFor({ state: "visible", timeout: 10_000 });
  await input.fill(`adr194-chart-${Date.now()}`);
  await input.press("Enter");
  await page.waitForURL(/\/builder\/[^/?]+$/, { timeout: 90_000 });
  await waitReady(page);
  return page.url();
}

/**
 * Skia 캔버스의 픽셀은 **페이지 안에서 읽을 수 없다**. WebGL 컨텍스트가
 * `preserveDrawingBuffer:false` 라 합성 후 `drawImage` 가 빈 화면을 준다 — 2026-09-08
 * 1차 시도가 그래서 "안 그려졌다" 로 오판했다(실제로는 스크린샷에 멀쩡히 있었다).
 * 그래서 Playwright 스크린샷을 찍어 그 PNG 를 페이지에서 디코드해 분석한다.
 */
async function analyzeCanvas(page) {
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
      // 정확한 토큰 RGB 를 빌더 문서에서 못 읽는다 (생성 CSS 미로드 — 2026-09-08 실측).
      //   대신 **채도 있는 파랑/보라** 를 센다: 빌더 크롬은 회색·흰색이라 차트 시리즈
      //   말고는 이 조건을 채우는 넓은 면이 없다.
      const counts = new Map();
      let blue = 0;
      let purple = 0;
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        counts.set((r << 16) | (g << 8) | b, 1);
        // 보라를 **먼저** 본다: 보라(#8B00FF 계열)는 파랑 조건(b-r>70)도 만족해서
        //   순서를 뒤집으면 보라가 통째로 파랑으로 세어진다 (2026-09-08 1차 측정이 그랬다).
        if (b > 120 && r > 90 && b - g > 60 && r - g > 40) purple++;
        else if (b > 140 && b - g > 70 && b - r > 70) blue++;
      }
      return {
        distinctColors: counts.size,
        blue,
        purple,
        pixels: off.width * off.height,
      };
    },
    { base64: png.toString("base64") },
  );
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

    // ── 1) 팔레트에서 Chart 찾기 ────────────────────────────────────────────
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
    const chartVisible = (await chartButton.count()) > 0;
    record(
      "팔레트에 Chart 항목이 있다",
      chartVisible,
      chartVisible ? "found" : "not found in Components panel",
    );
    if (!chartVisible) throw new Error("팔레트에 Chart 없음 — 등록 확인 필요");

    // ── 2) 클릭으로 캔버스에 추가 ──────────────────────────────────────────
    // 추가 **전** 캔버스를 먼저 재둔다 — 차트가 만든 픽셀인지 빌더 크롬인지 가르는 대조군.
    const baselineInk = await analyzeCanvas(page);
    await chartButton.click();
    await page.waitForTimeout(2500);

    const placed = await page.evaluate(() => {
      const store = window.__composition_STORE__;
      const state = store.getState();
      const chart = state.elements.find((e) => e.type === "Chart");
      if (!chart) return null;
      const map = window.__composition_LAYOUT_DEBUG__?.getSharedLayoutMap?.();
      const layout = map?.get?.(chart.id) ?? null;
      return {
        id: chart.id,
        props: chart.props,
        layout: layout
          ? { x: layout.x, y: layout.y, width: layout.width, height: layout.height }
          : null,
      };
    });
    record(
      "팔레트 클릭이 canonical 에 Chart 를 만든다",
      !!placed,
      placed ? `id=${placed.id}` : "store 에 Chart 없음",
    );
    if (!placed) throw new Error("Chart 미생성");

    record(
      "엔진이 Chart 에 크기를 준다",
      !!placed.layout && placed.layout.width > 0 && placed.layout.height > 0,
      placed.layout
        ? `${Math.round(placed.layout.width)}×${Math.round(placed.layout.height)}`
        : "layout map 없음",
    );
    record(
      "factory 샘플 rows 가 실려 있다 (빈 상자 방지)",
      Array.isArray(placed.props?.data) && placed.props.data.length > 0,
      `data ${placed.props?.data?.length ?? 0} rows · chartType=${placed.props?.chartType}`,
    );

    // ── 3) Skia 픽셀 ───────────────────────────────────────────────────────
    const barInk = await analyzeCanvas(page);
    record(
      "Skia 가 차트 시리즈 색을 실제 픽셀로 칠한다 (막대가 보인다)",
      barInk.blue > 500 && barInk.purple > 500,
      `blue=${barInk.blue} purple=${barInk.purple} (차트 추가 전 baseline blue=${baselineInk.blue} purple=${baselineInk.purple})`,
    );
    record(
      "차트 추가가 그 픽셀을 만들었다 (빌더 크롬이 아니다)",
      barInk.blue - baselineInk.blue > 500 &&
        barInk.purple - baselineInk.purple > 500,
      `Δblue=${barInk.blue - baselineInk.blue} Δpurple=${barInk.purple - baselineInk.purple}`,
    );
    await page
      .locator("canvas")
      .first()
      .screenshot({ path: `${OUT_DIR}/skia-bar.png` });

    // ── 4) chartType 전환이 픽셀을 바꾼다 ──────────────────────────────────
    await page.evaluate((id) => {
      window.__composition_STORE__
        .getState()
        .updateElementProps(id, { chartType: "line" });
    }, placed.id);
    await page.waitForTimeout(1800);
    const lineInk = await analyzeCanvas(page);
    record(
      "chartType bar→line 이 Skia 픽셀을 바꾼다 (prop→렌더 채널 살아 있음)",
      lineInk.blue > baselineInk.blue && lineInk.blue < barInk.blue,
      `blue 픽셀 bar=${barInk.blue} → line=${lineInk.blue} (선이 막대보다 적어야 하고 0 은 아니어야 한다)`,
    );
    await page
      .locator("canvas")
      .first()
      .screenshot({ path: `${OUT_DIR}/skia-line.png` });

    await page.evaluate((id) => {
      window.__composition_STORE__
        .getState()
        .updateElementProps(id, { chartType: "pie" });
    }, placed.id);
    await page.waitForTimeout(1800);
    const pieInk = await analyzeCanvas(page);
    record(
      "chartType line→pie 도 픽셀을 바꾼다 (SVG `A` 호 경로 live)",
      pieInk.blue > lineInk.blue,
      `blue 픽셀 line=${lineInk.blue} → pie=${pieInk.blue} (부채꼴이 선보다 많아야 한다)`,
    );
    await page
      .locator("canvas")
      .first()
      .screenshot({ path: `${OUT_DIR}/skia-pie.png` });

    // ── 5) Preview DOM ─────────────────────────────────────────────────────
    await page.evaluate((id) => {
      window.__composition_STORE__
        .getState()
        .updateElementProps(id, { chartType: "bar" });
    }, placed.id);
    await page.waitForTimeout(1200);

    // Preview DOM 은 **Compare Mode** 가 같은 페이지에 iframe 으로 띄운다
    //   (헤더의 "Preview" 아이콘 버튼은 별도 창을 연다 — 같은 문서에서 대조하려면 이쪽).
    const previewTab = page
      .locator('[aria-label="Compare Mode (Preview + Skia)"]')
      .first();
    let previewFindings = null;
    if (await previewTab.count()) {
      await previewTab.click();
      await page.waitForTimeout(6000);
      previewFindings = await page.evaluate(() => {
        const docs = [document];
        for (const frame of document.querySelectorAll("iframe")) {
          if (frame.contentDocument) docs.push(frame.contentDocument);
        }
        for (const doc of docs) {
          const chart = doc.querySelector(".react-aria-Chart");
          if (!chart) continue;
          const frame = { contentWindow: doc.defaultView };
          const svg = chart.querySelector("svg");
          const box = chart.getBoundingClientRect();
          const style = frame.contentWindow.getComputedStyle(chart);
          return {
            found: true,
            rect: { w: box.width, h: box.height },
            role: chart.getAttribute("role"),
            ariaLabel: chart.getAttribute("aria-label"),
            rects: svg ? svg.querySelectorAll("rect").length : 0,
            paths: svg ? svg.querySelectorAll("path").length : 0,
            texts: svg ? svg.querySelectorAll("text").length : 0,
            lines: svg ? svg.querySelectorAll("line").length : 0,
            series1: style.getPropertyValue("--chart-series-1").trim(),
            axis: style.getPropertyValue("--chart-axis").trim(),
          };
        }
        const iframe = document.querySelector("iframe");
        const idoc = iframe?.contentDocument;
        return {
          found: false,
          docs: docs.length,
          iframeSrc: iframe?.src ?? null,
          iframeReady: idoc?.readyState ?? null,
          iframeHtml: (idoc?.body?.innerHTML ?? "").slice(0, 600),
          classes: idoc
            ? [...new Set([...idoc.querySelectorAll("[class]")].map((e) => e.className.toString()))]
                .slice(0, 30)
            : [],
        };
      });
    }
    record(
      "Preview 가 .react-aria-Chart + SVG 를 그린다",
      !!previewFindings?.found && previewFindings.rects > 0,
      previewFindings
        ? JSON.stringify(previewFindings)
        : "Preview 탭을 못 찾음",
    );
    record(
      "생성 CSS 의 chart 팔레트 변수가 DOM 에 도달한다 (R1)",
      !!previewFindings?.series1 && previewFindings.series1.length > 0,
      `--chart-series-1="${previewFindings?.series1 ?? ""}" --chart-axis="${previewFindings?.axis ?? ""}"`,
    );
    record(
      "접근성 — role=img + aria-label (D1 수동 부여 1건)",
      previewFindings?.role === "img" && !!previewFindings?.ariaLabel,
      `role=${previewFindings?.role} aria-label=${previewFindings?.ariaLabel}`,
    );
    await page.screenshot({ path: `${OUT_DIR}/preview.png`, fullPage: false });

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
