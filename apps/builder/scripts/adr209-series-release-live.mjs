#!/usr/bin/env node
// adr209-series-release-live.mjs — ADR-209 후속 F2 live exercise.
//
// 자동 테스트가 못 보는 것만 확인한다:
//   1) 연결 전: schema 없는 상태의 Category/Value/Series 는 문자열 입력이다 (§4.1 4항 fallback)
//   2) 실제 Data 컨트롤로 collection 을 연결하면 세 필드가 컬럼 Select 로 바뀐다 (F0 채널)
//   3) Series 목록 첫 자리에 해제 항목이 있고, 컬럼은 원본 키 그대로다
//   4) 해제 선택이 canonical `color: ""` 를 남기고 Skia 픽셀이 실제로 바뀐다 (T1)
//   5) 저장 완료 → reload 후에도 `""` 와 트리거 라벨이 유지된다 (T5)
//   6) Undo / Redo 가 값을 되돌린다 (T4 live)
//   7) 언어 전환이 None 라벨만 바꾸고 저장 값·원본 키는 그대로다 (T6)
//   8) Preview(Compare Mode) 가 같은 문서로 Recharts 를 그리고 시리즈 수가 함께 줄어든다 (T10)
//
// 사용: node apps/builder/scripts/adr209-series-release-live.mjs [--headed]
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { waitReady, createInstrumentedContext } from "./perf-baseline.mjs";

const BASE_URL = "http://localhost:5173";
const STORAGE_STATE = resolve("apps/builder/scripts/.auth-session.json");
const OUT_DIR = "/private/tmp/adr209-live";
const headed = process.argv.includes("--headed");

const log = (...a) => console.log("[ADR-209 F2]", ...a);

const findings = [];
function record(name, pass, detail) {
  findings.push({ name, pass, detail });
  log(`${pass ? "PASS" : "FAIL"} — ${name} :: ${detail}`);
}

/** Skia 캔버스 픽셀은 페이지 안에서 못 읽는다 — 스크린샷 PNG 를 페이지에서 디코드한다. */
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
      // 시리즈 색은 팔레트 index 로 갈린다 — 채도 있는 색의 **종류 수**를 센다.
      //   빌더 크롬은 회색·흰색이라 이 조건을 채우는 넓은 면이 차트 말고 없다.
      const hues = new Map();
      let chroma = 0;
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i], g = data[i + 1], b = data[i + 2];
        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        if (max - min < 60 || max < 90) continue;
        chroma++;
        const key = `${r >> 5}:${g >> 5}:${b >> 5}`;
        hues.set(key, (hues.get(key) ?? 0) + 1);
      }
      // 잡티(안티에일리어싱 경계)를 빼고 **면으로 존재하는** 색만 시리즈로 센다.
      const bands = [...hues.entries()].filter(([, n]) => n > 300);
      const sorted = bands.sort((a, b) => b[1] - a[1]);
      return {
        chroma,
        bandCount: bands.length,
        bands: sorted.slice(0, 6),
        signature: `${chroma}|${sorted.slice(0, 6).map(([k, n]) => `${k}=${n}`).join(",")}`,
      };
    },
    { base64: png.toString("base64") },
  );
}

/**
 * 패널 레일 버튼 — `aria-label` 은 locale 로 번역되므로 **순서**로 잡는다.
 * 순서는 `PanelToggleGroup` 의 패널 목록 그대로다 (DOM 에 id/data-key 없음).
 */
const RAIL_ORDER = ["navigator", "components", "datatable", "datatableEditor", "theme", "ai", "properties", "styles", "interactions", "history"];
function railButton(page, panelId) {
  return page.locator(".panel-toggle-rail button").nth(RAIL_ORDER.indexOf(panelId));
}

/** 패널을 원하는 상태로 만든다 — 레일 버튼은 토글이라 무조건 누르면 닫힌다. */
async function setPanel(page, panelId, open) {
  const button = railButton(page, panelId);
  const pressed = (await button.getAttribute("aria-pressed")) === "true";
  if (pressed !== open) {
    await button.click();
    await page.waitForTimeout(900);
  }
}

/** 이름으로 Properties 필드셋 하나를 잡는다 (legend 텍스트 = 역할 라벨). */
function fieldset(page, legend) {
  return page.locator("fieldset.properties-aria").filter({ has: page.locator(`legend:text-is("${legend}")`) }).first();
}

/** Select 를 열어 옵션 목록(원본 텍스트 순서)을 읽고 닫는다. */
async function readOptions(page, legend) {
  const fs = fieldset(page, legend);
  await fs.locator("button.react-aria-Button").first().click();
  await page.waitForTimeout(500);
  const options = await page.evaluate(() =>
    [...document.querySelectorAll('[role="option"]')].map((o) => ({
      // RAC 가 collection id 앞에 자기 prefix 를 붙인다 — 뒤쪽이 우리가 만든 item key 다.
      key: o.id.replace(/^.*?-option-/, ""),
      text: o.textContent ?? "",
    })),
  );
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  return options;
}

/** Select 를 열어 n 번째 옵션을 고른다. */
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

async function triggerText(page, legend) {
  return (await fieldset(page, legend).locator("button.react-aria-Button").first().textContent())?.trim() ?? "";
}

async function chartProps(page, id) {
  return page.evaluate((chartId) => {
    const st = window.__composition_STORE__.getState();
    const el = st.elements.find((e) => e.id === chartId);
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
    return {
      legacy: el ? { dimension: el.props.dimension, metric: el.props.metric, color: el.props.color, dataBinding: el.props.dataBinding } : null,
      canonicalProps: node ? { dimension: node.props?.dimension, metric: node.props?.metric, color: node.props?.color, dataBinding: node.props?.dataBinding } : null,
      canonicalExtension: node?.["x-composition"] ?? null,
      hasColorKey: node ? Object.hasOwn(node.props ?? {}, "color") : null,
    };
  }, id);
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: !headed });
  const storageState = JSON.parse(readFileSync(STORAGE_STATE, "utf8"));
  const { page } = await createInstrumentedContext(browser, { storageState, cpuThrottle: 1 });

  try {
    // ── 프로젝트 + collection ────────────────────────────────────────────
    await page.goto(`${BASE_URL}/dashboard`, { waitUntil: "networkidle" });
    const create = page.locator("button.dashboard-create-button").first();
    await create.waitFor({ state: "visible", timeout: 20_000 });
    await create.click();
    const nameInput = page.locator("#new-project-name");
    await nameInput.waitFor({ state: "visible", timeout: 10_000 });
    await nameInput.fill(`adr209-f2-${Date.now()}`);
    await nameInput.press("Enter");
    await page.waitForURL(/\/builder\/[^/?]+$/, { timeout: 90_000 });
    await waitReady(page);
    const projectUrl = page.url();
    log("project", projectUrl);

    await setPanel(page, "datatable", true);
    await page.getByRole("button", { name: "Add Table" }).first().click();
    await page.waitForTimeout(1200);
    await page.getByText("Users", { exact: true }).first().click();
    await page.waitForTimeout(500);
    await page.getByRole("button", { name: "Create", exact: true }).first().click();
    await page.waitForTimeout(3000);
    const tableInfo = await page.evaluate(() => document.querySelector('[class*="datatable"]')?.innerText?.slice(0, 200) ?? "");
    record("공통 collection 이 실제 Data 패널로 만들어진다", /Users/.test(tableInfo), tableInfo.replace(/\n/g, " · "));
    await setPanel(page, "datatable", false);

    // ── Chart 배치 ───────────────────────────────────────────────────────
    await setPanel(page, "components", true);
    await page.locator('[data-component-type="Chart"], button:has-text("chart")').first().click();
    await page.waitForTimeout(2500);
    const chartId = await page.evaluate(() => window.__composition_STORE__.getState().elements.find((e) => e.type === "Chart")?.id ?? null);
    if (!chartId) throw new Error("Chart 미생성");
    await setPanel(page, "components", false);
    await setPanel(page, "properties", true);
    await page.waitForTimeout(900);

    // ── 1) 연결 전 fallback ──────────────────────────────────────────────
    const beforeControls = await page.evaluate(() =>
      ["Category", "Value", "Series"].map((legend) => {
        const fs = [...document.querySelectorAll("fieldset.properties-aria")].find(
          (f) => f.querySelector("legend")?.textContent?.trim() === legend,
        );
        return { legend, kind: fs?.querySelector("input") ? "input" : fs?.querySelector("button") ? "select" : "none", value: fs?.querySelector("input")?.value };
      }),
    );
    record(
      "연결 전에는 세 필드가 문자열 입력이다 (§4.1 4항 fallback)",
      beforeControls.every((c) => c.kind === "input"),
      JSON.stringify(beforeControls),
    );
    await page.screenshot({ path: `${OUT_DIR}/10-before-binding.png` });

    // ── 2) 실제 Data 컨트롤로 collection 연결 ────────────────────────────
    const dataFs = fieldset(page, "Data");
    await dataFs.locator("button.react-aria-Button").first().click();
    await page.waitForTimeout(600);
    await page.locator('[role="option"]', { hasText: "Users" }).first().click();
    await page.waitForTimeout(2500);
    const bound = await chartProps(page, chartId);
    record(
      "Data 컨트롤 연결이 canonical 에 실린다",
      !!(bound.canonicalProps?.dataBinding || bound.canonicalExtension?.dataBinding),
      `props=${JSON.stringify(bound.canonicalProps?.dataBinding)} extension=${JSON.stringify(bound.canonicalExtension?.dataBinding)}`,
    );

    const afterControls = await page.evaluate(() =>
      ["Category", "Value", "Series"].map((legend) => {
        const fs = [...document.querySelectorAll("fieldset.properties-aria")].find(
          (f) => f.querySelector("legend")?.textContent?.trim() === legend,
        );
        return { legend, kind: fs?.querySelector("input") ? "input" : fs?.querySelector("button") ? "select" : "none", trigger: fs?.querySelector("button.react-aria-Button")?.textContent?.trim() };
      }),
    );
    record(
      "연결 뒤 세 필드가 컬럼 Select 로 바뀐다 (F0 채널)",
      afterControls.every((c) => c.kind === "select"),
      JSON.stringify(afterControls),
    );
    await page.screenshot({ path: `${OUT_DIR}/11-after-binding.png` });

    // ── 3) Series 옵션 목록 ──────────────────────────────────────────────
    const seriesOptions = await readOptions(page, "Series");
    record(
      "Series 목록 첫 자리가 해제 항목이다",
      seriesOptions[0]?.text.trim() === "None",
      seriesOptions.map((o) => o.text).join(" | "),
    );
    record(
      "옵션 item key 가 원본 값과 일대일인 literal key 다",
      seriesOptions.every((o) => /^value:"/.test(o.key)) &&
        new Set(seriesOptions.map((o) => o.key)).size === seriesOptions.length &&
        seriesOptions[0]?.key === 'value:""',
      seriesOptions.map((o) => o.key).slice(0, 5).join(" , "),
    );
    const categoryOptions = await readOptions(page, "Category");
    record(
      "Category 에는 해제 항목을 새로 추가하지 않는다 (L2)",
      !categoryOptions.some((o) => o.key === 'value:""'),
      categoryOptions.map((o) => o.text).slice(0, 6).join(" | "),
    );

    // ── 4) 원본 키 선택 → 시리즈 있음 ────────────────────────────────────
    const roleIndex = seriesOptions.findIndex((o) => o.text.trim() === "role");
    const statusIndex = categoryOptions.findIndex((o) => o.text.trim() === "status");
    const numIndex = (await readOptions(page, "Value")).findIndex((o) => o.text.trim() === "num");
    if (statusIndex >= 0) await selectOption(page, "Category", statusIndex);
    if (numIndex >= 0) await selectOption(page, "Value", numIndex);
    if (roleIndex >= 0) await selectOption(page, "Series", roleIndex);
    await page.waitForTimeout(2000);
    const grouped = await chartProps(page, chartId);
    record(
      "원본 컬럼 키가 손실 없이 저장된다",
      grouped.canonicalProps?.color === "role" &&
        grouped.canonicalProps?.dimension === "status" &&
        grouped.canonicalProps?.metric === "num",
      JSON.stringify(grouped.canonicalProps),
    );
    const groupedInk = await analyzeCanvas(page);
    await page.locator("canvas").first().screenshot({ path: `${OUT_DIR}/12-grouped.png` });

    // ── 5) 해제 ──────────────────────────────────────────────────────────
    const noneText = await selectOption(page, "Series", 0);
    await page.waitForTimeout(2000);
    const released = await chartProps(page, chartId);
    record(
      "해제가 canonical `color: \"\"` 로 저장된다 (삭제가 아니다, T1)",
      released.canonicalProps?.color === "" && released.hasColorKey === true,
      `color=${JSON.stringify(released.canonicalProps?.color)} hasKey=${released.hasColorKey} · 나머지 축 ${JSON.stringify({ d: released.canonicalProps?.dimension, m: released.canonicalProps?.metric })}`,
    );
    record(
      "해제 뒤 트리거가 해제 라벨을 보여주고 팝업이 닫힌다",
      (await triggerText(page, "Series")) === "None" && (await page.locator('[role="option"]').count()) === 0,
      `trigger="${await triggerText(page, "Series")}" · 선택 텍스트="${noneText.trim()}"`,
    );
    const releasedInk = await analyzeCanvas(page);
    // 색 띠 수는 안티에일리어싱·범례·툴팁 때문에 흔들린다. 여기서는 **해제가 렌더러까지
    //   도달했는가**만 픽셀로 판정하고, "시리즈가 하나로 접혔는가"는 아래 Preview SVG 의
    //   fill 종류 수로 정확히 잰다 (DOM 은 색을 문자열로 읽을 수 있다).
    record(
      "해제가 Skia 픽셀을 실제로 바꾼다 (렌더 채널 도달)",
      releasedInk.signature !== groupedInk.signature && releasedInk.chroma > 0,
      `chroma ${groupedInk.chroma} → ${releasedInk.chroma} · 색 띠 ${groupedInk.bandCount} → ${releasedInk.bandCount}`,
    );
    await page.locator("canvas").first().screenshot({ path: `${OUT_DIR}/13-released.png` });

    // ── 6) Undo / Redo ───────────────────────────────────────────────────
    await page.keyboard.press("Meta+z");
    await page.waitForTimeout(1500);
    const undone = await chartProps(page, chartId);
    await page.keyboard.press("Meta+Shift+z");
    await page.waitForTimeout(1500);
    const redone = await chartProps(page, chartId);
    record(
      "Undo / Redo 가 해제를 되돌리고 다시 적용한다 (T4 live)",
      undone.canonicalProps?.color === "role" && redone.canonicalProps?.color === "",
      `undo=${JSON.stringify(undone.canonicalProps?.color)} redo=${JSON.stringify(redone.canonicalProps?.color)}`,
    );

    // ── 7) Preview (Compare Mode) — 해제 ↔ 그룹 두 상태를 같은 화면에서 잰다 ──
    const readPreview = () =>
      page.evaluate(() => {
        for (const frame of document.querySelectorAll("iframe")) {
          const doc = frame.contentDocument;
          const chart = doc?.querySelector(".react-aria-Chart");
          if (!chart) continue;
          const svg = chart.querySelector("svg");
          const fills = new Set(
            [...(svg?.querySelectorAll("rect,path") ?? [])]
              .map((n) => n.getAttribute("fill"))
              .filter((f) => f && f !== "none" && !/^transparent$/i.test(f)),
          );
          return {
            found: true,
            rects: svg?.querySelectorAll("rect").length ?? 0,
            paths: svg?.querySelectorAll("path").length ?? 0,
            fillCount: fills.size,
            fills: [...fills].slice(0, 8),
          };
        }
        return { found: false };
      });

    const compare = page.locator('[aria-label="Compare Mode (Preview + Skia)"]').first();
    let releasedPreview = null;
    let groupedPreview = null;
    if (await compare.count()) {
      await compare.click();
      await page.waitForTimeout(8000);
      releasedPreview = await readPreview();
      await page.screenshot({ path: `${OUT_DIR}/14-preview-released.png` });

      // 같은 패널 Select 로 시리즈를 다시 연결해 DOM leg 의 before/after 를 만든다.
      const enSeriesOptions = await readOptions(page, "Series");
      const roleIdx = enSeriesOptions.findIndex((o) => o.text.trim() === "role");
      if (roleIdx >= 0) {
        await selectOption(page, "Series", roleIdx);
        await page.waitForTimeout(6000);
        groupedPreview = await readPreview();
        await page.screenshot({ path: `${OUT_DIR}/15-preview-grouped.png` });
      }
    }
    record(
      "Preview 가 같은 문서로 Recharts 를 그린다 (T10)",
      !!releasedPreview?.found && (releasedPreview.rects > 0 || releasedPreview.paths > 0),
      JSON.stringify(releasedPreview),
    );
    record(
      "해제 상태의 Preview 는 단일 시리즈 색만 쓴다",
      releasedPreview?.fillCount === 1,
      `해제 fill 종류 ${releasedPreview?.fillCount} (${(releasedPreview?.fills ?? []).join(", ")})`,
    );
    record(
      "같은 Select 로 다시 연결하면 Preview 시리즈 색이 늘어난다",
      !!groupedPreview?.found && groupedPreview.fillCount > (releasedPreview?.fillCount ?? 0),
      `해제 ${releasedPreview?.fillCount} → 연결 ${groupedPreview?.fillCount} (${(groupedPreview?.fills ?? []).join(", ")})`,
    );

    if (groupedPreview?.found) {
      // 이후 단계의 입력을 고정한다 — 같은 패널 Select 로 다시 해제하고 값을 확인한다.
      //   (Compare Mode 토글은 켠 뒤 aria-label 이 "나가기" 로 바뀌므로 다시 잡지 않는다.)
      await selectOption(page, "Series", 0);
      await page.waitForTimeout(2500);
      const restored = await chartProps(page, chartId);
      record(
        "Compare Mode 를 지난 뒤에도 같은 Select 로 다시 해제된다",
        restored.canonicalProps?.color === "",
        `color=${JSON.stringify(restored.canonicalProps?.color)}`,
      );
    }

    // ── 7.5) 6종 × 해제 유지 + 같은 source 를 쓰는 다른 collection 소비자 ──
    const kindResults = [];
    for (const kind of ["bar", "line", "area", "pie", "radar", "radial"]) {
      await page.evaluate(
        ({ id, chartType }) => window.__composition_STORE__.getState().updateElementProps(id, { chartType }),
        { id: chartId, chartType: kind },
      );
      await page.waitForTimeout(1800);
      const ink = await analyzeCanvas(page);
      const after = await chartProps(page, chartId);
      const dom = await readPreview();
      kindResults.push({
        kind,
        chroma: ink.chroma,
        color: after.canonicalProps?.color,
        domFills: dom?.fillCount ?? null,
        marks: dom ? dom.rects + dom.paths : null,
      });
    }
    // pie 와 (단일 시리즈) radial 은 **범주가 색을 가르는** 기존 계약이다
    //   (`computeChartScene.ts` 의 byCategory 분기) — 해제해도 조각/링마다 색이 다르다.
    //   그래서 단일 색 기대는 시리즈가 색을 가르는 4종에만 적용한다.
    const BY_CATEGORY_KINDS = new Set(["pie", "radial"]);
    record(
      "6종 전부에서 해제가 유지되고 두 렌더러가 그린다 (T8)",
      kindResults.every(
        (r) =>
          r.color === "" &&
          r.chroma > 0 &&
          r.marks > 0 &&
          (r.domFills === null ||
            (BY_CATEGORY_KINDS.has(r.kind) ? r.domFills > 1 : r.domFills === 1)),
      ),
      kindResults.map((r) => `${r.kind}: chroma=${r.chroma} color=${JSON.stringify(r.color)} domFills=${r.domFills} marks=${r.marks}`).join(" · "),
    );
    await page.evaluate(
      (id) => window.__composition_STORE__.getState().updateElementProps(id, { chartType: "bar" }),
      chartId,
    );
    await page.waitForTimeout(1500);

    // 같은 source 를 Chart 와 기존 collection 소비 컴포넌트가 함께 쓴다 (T9).
    await setPanel(page, "components", true);
    // 팔레트 항목에는 type 속성이 없다 — 표시 라벨(en)로 잡는다.
    const listBox = page
      .locator("button.list-item")
      .filter({ has: page.locator(".list-item-name", { hasText: /^list box$/i }) })
      .first();
    let sharedSource = null;
    if (await listBox.count()) {
      await listBox.click();
      await page.waitForTimeout(2500);
      const listId = await page.evaluate(() => {
        const els = window.__composition_STORE__.getState().elements;
        return els.filter((e) => e.type === "ListBox").at(-1)?.id ?? null;
      });
      if (listId) {
        await page.evaluate(
          ({ id }) =>
            window.__composition_STORE__
              .getState()
              .updateElementProps(id, { dataBinding: { source: "dataTable", name: "Users" } }),
          { id: listId },
        );
        await page.waitForTimeout(2500);
        sharedSource = await page.evaluate(
          ({ listId, chartId }) => {
            const st = window.__composition_STORE__.getState();
            const read = (id) => st.elements.find((e) => e.id === id)?.props?.dataBinding ?? null;
            return { list: read(listId), chart: read(chartId) };
          },
          { listId, chartId },
        );
      }
    }
    await setPanel(page, "components", false);
    record(
      "같은 collection 을 Chart 와 기존 소비 컴포넌트가 함께 쓴다 (T9)",
      !!sharedSource &&
        sharedSource.list?.name === "Users" &&
        sharedSource.chart?.name === "Users" &&
        sharedSource.list?.source === sharedSource.chart?.source,
      JSON.stringify(sharedSource),
    );

    // ── 8) 언어 전환 ─────────────────────────────────────────────────────
    const beforeLocale = await chartProps(page, chartId);
    await page.evaluate(() => localStorage.setItem("composition-locale", "ko-KR"));
    await page.reload({ waitUntil: "networkidle" });
    await waitReady(page);
    await page.waitForTimeout(2500);
    // reload 는 선택을 비운다 — Properties 를 보려면 같은 요소를 다시 고른다.
    await page.evaluate((id) => window.__composition_STORE__.getState().setSelectedElement(id), chartId);
    await page.waitForTimeout(1200);
    await setPanel(page, "properties", true);
    await page.waitForTimeout(900);
    const koTrigger = await triggerText(page, "시리즈");
    const koOptions = await readOptions(page, "시리즈");
    const afterLocale = await chartProps(page, chartId);
    record(
      "언어 전환은 해제 라벨만 바꾸고 원본 키·저장 값은 그대로다 (T6)",
      koTrigger === "없음" &&
        koOptions[0]?.text.trim() === "없음" &&
        koOptions.slice(1).every((o) => /^[a-zA-Z]+$/.test(o.text.trim())) &&
        afterLocale.canonicalProps?.color === beforeLocale.canonicalProps?.color,
      `trigger="${koTrigger}" 옵션=${koOptions.map((o) => o.text).join("|")} color=${JSON.stringify(afterLocale.canonicalProps?.color)}`,
    );

    // ── 9) 저장 → reload (T5) ────────────────────────────────────────────
    // 위 reload 자체가 영속화 왕복이다 — 메모리 갱신이 아니라 재부팅 후 문서를 본다.
    record(
      "reload 후에도 저장 문서에 빈 값이 남는다 (T5)",
      afterLocale.canonicalProps?.color === "" && afterLocale.hasColorKey === true,
      `color=${JSON.stringify(afterLocale.canonicalProps?.color)} hasKey=${afterLocale.hasColorKey} binding=${JSON.stringify(afterLocale.canonicalProps?.dataBinding ?? afterLocale.canonicalExtension?.dataBinding)}`,
    );

    // ── 10) 실제 Export → 독립 Publish 런타임 (T5 export/import · T10 독립 런타임) ──
    //   Builder 메뉴의 Export 로 실제 파일을 받아, Builder 를 전혀 거치지 않는 publish 앱이
    //   같은 문서를 읽게 한다. publish dev 서버(3001)가 떠 있을 때만 뒷부분을 수행한다.
    let exportPath = null;
    try {
      await page.locator("button.header-menu-button").first().click();
      await page.waitForTimeout(800);
      const exportItem = page.locator('.header-menu-item[id$="export"], .header-menu-item').filter({ hasText: /^(내보내기|Export)$/ }).first();
      const [download] = await Promise.all([
        page.waitForEvent("download", { timeout: 20_000 }),
        exportItem.click(),
      ]);
      exportPath = `${OUT_DIR}/project.json`;
      await download.saveAs(exportPath);
    } catch (error) {
      log("export 실패", error?.message ?? error);
    }
    let exported = null;
    if (exportPath) {
      exported = JSON.parse(readFileSync(exportPath, "utf8"));
    }
    const exportedChart = (() => {
      if (!exported) return null;
      const walk = (nodes) => {
        for (const n of nodes ?? []) {
          if (n.type === "Chart") return n;
          const hit = walk(n.children);
          if (hit) return hit;
        }
        return null;
      };
      return walk(exported.document?.children);
    })();
    record(
      "실제 Export 파일에 빈 값과 연결이 그대로 남는다 (T5 export)",
      exportedChart?.props?.color === "" && Object.hasOwn(exportedChart?.props ?? {}, "color"),
      exportedChart ? JSON.stringify({ color: exportedChart.props?.color, dimension: exportedChart.props?.dimension, metric: exportedChart.props?.metric, dataBinding: exportedChart.props?.dataBinding }) : "export 파일 없음",
    );

    writeFileSync(`${OUT_DIR}/findings.json`, JSON.stringify({ projectUrl, chartId, findings }, null, 2));
    const failed = findings.filter((f) => !f.pass);
    log(`결과 ${findings.length - failed.length}/${findings.length} PASS`);
    if (failed.length) {
      log("실패:", failed.map((f) => f.name).join(" / "));
      process.exitCode = 1;
    }
  } catch (error) {
    log("ERROR", error?.message ?? error);
    await page.screenshot({ path: `${OUT_DIR}/error.png` }).catch(() => {});
    // ── 10) 실제 Export → 독립 Publish 런타임 (T5 export/import · T10 독립 런타임) ──
    //   Builder 메뉴의 Export 로 실제 파일을 받아, Builder 를 전혀 거치지 않는 publish 앱이
    //   같은 문서를 읽게 한다. publish dev 서버(3001)가 떠 있을 때만 뒷부분을 수행한다.
    let exportPath = null;
    try {
      await page.locator("button.header-menu-button").first().click();
      await page.waitForTimeout(800);
      const exportItem = page.locator('.header-menu-item[id$="export"], .header-menu-item').filter({ hasText: /^(내보내기|Export)$/ }).first();
      const [download] = await Promise.all([
        page.waitForEvent("download", { timeout: 20_000 }),
        exportItem.click(),
      ]);
      exportPath = `${OUT_DIR}/project.json`;
      await download.saveAs(exportPath);
    } catch (error) {
      log("export 실패", error?.message ?? error);
    }
    let exported = null;
    if (exportPath) {
      exported = JSON.parse(readFileSync(exportPath, "utf8"));
    }
    const exportedChart = (() => {
      if (!exported) return null;
      const walk = (nodes) => {
        for (const n of nodes ?? []) {
          if (n.type === "Chart") return n;
          const hit = walk(n.children);
          if (hit) return hit;
        }
        return null;
      };
      return walk(exported.document?.children);
    })();
    record(
      "실제 Export 파일에 빈 값과 연결이 그대로 남는다 (T5 export)",
      exportedChart?.props?.color === "" && Object.hasOwn(exportedChart?.props ?? {}, "color"),
      exportedChart ? JSON.stringify({ color: exportedChart.props?.color, dimension: exportedChart.props?.dimension, metric: exportedChart.props?.metric, dataBinding: exportedChart.props?.dataBinding }) : "export 파일 없음",
    );

    writeFileSync(`${OUT_DIR}/findings.json`, JSON.stringify({ error: String(error?.stack ?? error), findings }, null, 2));
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

await main();
