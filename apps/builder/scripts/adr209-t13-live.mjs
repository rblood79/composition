#!/usr/bin/env node
// adr209-t13-live.mjs — ADR-209 후속 F3 의 T13 최종 revision live.
//
// §7.2 T13: animation on/off · reduced-motion · tooltip·키보드 · 해제 후 데이터 교체 —
// 판정: Canvas 정적 결과와 runtime(Recharts) 완료 결과가 정합하고, runtime 애니메이션·hover·키보드
// 프레임이 canonical 에 write 0.
//
// 흐름 (실제 Builder, DEV 5173, headed): 새 프로젝트 → Data 패널 collection → Chart → Properties 로
// 연결·Series 선택·해제(color "") → Data 연결 해제로 sample rows 로 되돌린 뒤 데이터 교체 →
// Compare Mode(Preview iframe) 에서 animation off/on/reduced-motion 의 프레임 수, tooltip hover,
// 키보드 ArrowRight 를 실제로 돌리고 그때마다 canonical 문서 JSON 이 그대로인지 본다.
//
// 사용: node apps/builder/scripts/adr209-t13-live.mjs [--headed] [--base http://localhost:5175]
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { waitReady, createInstrumentedContext } from "./perf-baseline.mjs";

const baseIdx = process.argv.indexOf("--base");
const BASE_URL =
  baseIdx >= 0 ? process.argv[baseIdx + 1] : "http://localhost:5173";
const STORAGE_STATE = resolve("apps/builder/scripts/.auth-session.json");
const OUT_DIR = "/private/tmp/adr209-f3/t13";
const headed = process.argv.includes("--headed");
const log = (...a) => console.log("[ADR-209 T13]", ...a);
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
  const pressed = (await button.getAttribute("aria-pressed")) === "true";
  if (pressed !== open) {
    await button.click();
    await page.waitForTimeout(900);
  }
}
const fieldset = (page, legend) =>
  page
    .locator("fieldset.properties-aria")
    .filter({ has: page.locator(`legend:text-is("${legend}")`) })
    .first();
async function readOptions(page, legend) {
  await fieldset(page, legend)
    .locator("button.react-aria-Button")
    .first()
    .click();
  await page.waitForTimeout(500);
  const options = await page.evaluate(() =>
    [...document.querySelectorAll('[role="option"]')].map((o) => ({
      key: o.id.replace(/^.*?-option-/, ""),
      text: (o.textContent ?? "").trim(),
    })),
  );
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  return options;
}
async function selectOption(page, legend, index) {
  await fieldset(page, legend)
    .locator("button.react-aria-Button")
    .first()
    .click();
  await page.waitForTimeout(500);
  const option = page.locator('[role="option"]').nth(index);
  const text = ((await option.textContent()) ?? "").trim();
  await option.click();
  await page.waitForTimeout(1200);
  return text;
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
    const el = window.__composition_STORE__
      .getState()
      .elements.find((e) => e.id === chartId);
    return {
      props: node
        ? {
            dimension: node.props?.dimension,
            metric: node.props?.metric,
            color: node.props?.color,
            dataBinding: node.props?.dataBinding,
            rows: Array.isArray(node.props?.data)
              ? node.props.data.length
              : null,
            isAnimationActive: node.props?.isAnimationActive,
            showTooltip: node.props?.showTooltip,
          }
        : null,
      extension: node?.["x-composition"] ?? null,
      hasColorKey: node ? Object.hasOwn(node.props ?? {}, "color") : null,
      legacyRows: Array.isArray(el?.props?.data) ? el.props.data.length : null,
      docJson: doc ? JSON.stringify(doc) : null,
    };
  }, id);
}
/** Skia 캔버스 픽셀 서명 — 페이지 안에서 못 읽으므로 스크린샷을 디코드한다. */
async function canvasSignature(page) {
  const png = await page.locator("canvas").first().screenshot();
  return page.evaluate(
    async ({ base64 }) => {
      const blob = await (
        await fetch(`data:image/png;base64,${base64}`)
      ).blob();
      const bitmap = await createImageBitmap(blob);
      const off = document.createElement("canvas");
      off.width = bitmap.width;
      off.height = bitmap.height;
      const ctx = off.getContext("2d");
      ctx.drawImage(bitmap, 0, 0);
      const data = ctx.getImageData(0, 0, off.width, off.height).data;
      const hues = new Map();
      let chroma = 0;
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i],
          g = data[i + 1],
          b = data[i + 2];
        if (
          Math.max(r, g, b) - Math.min(r, g, b) < 60 ||
          Math.max(r, g, b) < 90
        )
          continue;
        chroma++;
        const k = `${r >> 5}:${g >> 5}:${b >> 5}`;
        hues.set(k, (hues.get(k) ?? 0) + 1);
      }
      const bands = [...hues.entries()]
        .filter(([, n]) => n > 300)
        .sort((a, b) => b[1] - a[1]);
      return {
        chroma,
        bands: bands.length,
        signature: `${chroma}|${bands
          .slice(0, 6)
          .map(([k, n]) => `${k}=${n}`)
          .join(",")}`,
      };
    },
    { base64: png.toString("base64") },
  );
}
const previewFrame = (page) =>
  page.frames().find((f) => f.url().includes("preview.html"));
const previewSig = (frame) =>
  frame.evaluate(() => {
    const chart = document.querySelector(".react-aria-Chart");
    const svg = chart?.querySelector("svg");
    const paths = [...(svg?.querySelectorAll("path, rect") ?? [])];
    const fills = new Set(
      paths
        .map((n) => n.getAttribute("fill"))
        .filter((f) => f && f !== "none" && !/transparent/i.test(f)),
    );
    return {
      found: !!chart,
      marks: paths.length,
      fills: fills.size,
      sig: paths
        .map(
          (p) =>
            p.getAttribute("d") ??
            `${p.getAttribute("x")},${p.getAttribute("y")},${p.getAttribute("width")},${p.getAttribute("height")}`,
        )
        .join("|"),
    };
  });
/** ms 동안 rAF 마다 Recharts 기하 서명을 읽어 **서로 다른 서명의 수**를 센다 (애니메이션 프레임 증거). */
const sampleFrames = (frame, ms) =>
  frame.evaluate(async (duration) => {
    const read = () =>
      [
        ...document.querySelectorAll(
          ".react-aria-Chart svg path, .react-aria-Chart svg rect",
        ),
      ]
        .map(
          (p) =>
            p.getAttribute("d") ??
            `${p.getAttribute("x")},${p.getAttribute("y")},${p.getAttribute("width")},${p.getAttribute("height")}`,
        )
        .join("|");
    const seen = [];
    const t0 = performance.now();
    let last = null;
    let lastChangeAt = 0;
    while (performance.now() - t0 < duration) {
      await new Promise((r) => requestAnimationFrame(r));
      const s = read();
      if (s !== last) {
        seen.push(s);
        last = s;
        lastChangeAt = performance.now() - t0;
      }
    }
    return {
      distinct: seen.length,
      lastChangeAt: Math.round(lastChangeAt),
      final: last,
      reducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches,
    };
  }, ms);
const rowsFor = (revision) =>
  ["a", "b", "c", "d", "e", "f", "g", "h"].map((status, i) => ({
    status: `${status}${revision}`,
    num: 10 + ((i * 7 + revision * 5) % 40),
    role: i % 2 ? "x" : "y",
  }));

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: !headed });
  // storage state 의 localStorage 는 origin 별 — --base 가 다른 포트면 같은 세션을 그 origin 에도 싣는다.
  const storageState = JSON.parse(readFileSync(STORAGE_STATE, "utf8"));
  const origin = new URL(BASE_URL).origin;
  const source = storageState.origins?.[0];
  if (source && !storageState.origins.some((o) => o.origin === origin))
    storageState.origins.push({
      origin,
      localStorage: source.localStorage.map((e) => ({ ...e })),
    });
  const { page, errors } = await createInstrumentedContext(browser, {
    storageState,
    cpuThrottle: 1,
  });
  try {
    await page.goto(`${BASE_URL}/dashboard`, { waitUntil: "networkidle" });
    const create = page.locator("button.dashboard-create-button").first();
    await create.waitFor({ state: "visible", timeout: 20_000 });
    await create.click();
    const nameInput = page.locator("#new-project-name");
    await nameInput.waitFor({ state: "visible", timeout: 10_000 });
    await nameInput.fill(`adr209-t13-${Date.now()}`);
    await nameInput.press("Enter");
    await page.waitForURL(/\/builder\/[^/?]+$/, { timeout: 90_000 });
    await waitReady(page);
    log("project", page.url());

    await setPanel(page, "datatable", true);
    await page.getByRole("button", { name: "Add Table" }).first().click();
    await page.waitForTimeout(1200);
    await page.getByText("Users", { exact: true }).first().click();
    await page.waitForTimeout(500);
    await page
      .getByRole("button", { name: "Create", exact: true })
      .first()
      .click();
    await page.waitForTimeout(3000);
    await setPanel(page, "datatable", false);
    await setPanel(page, "components", true);
    await page
      .locator('[data-component-type="Chart"], button:has-text("chart")')
      .first()
      .click();
    await page.waitForTimeout(2500);
    const chartId = await page.evaluate(
      () =>
        window.__composition_STORE__
          .getState()
          .elements.find((e) => e.type === "Chart")?.id ?? null,
    );
    if (!chartId) throw new Error("Chart 미생성");
    await setPanel(page, "components", false);
    await setPanel(page, "properties", true);
    await page.waitForTimeout(900);

    // ── 전제: 연결 → 원본 키 → 해제 ────────────────────────────────────────
    await fieldset(page, "Data")
      .locator("button.react-aria-Button")
      .first()
      .click();
    await page.waitForTimeout(600);
    await page.locator('[role="option"]', { hasText: "Users" }).first().click();
    await page.waitForTimeout(2500);
    const pick = async (legend, text) => {
      const i = (await readOptions(page, legend)).findIndex(
        (o) => o.text === text,
      );
      if (i >= 0) await selectOption(page, legend, i);
    };
    await pick("Category", "status");
    await pick("Value", "num");
    await pick("Series", "role");
    await page.waitForTimeout(1500);
    await selectOption(page, "Series", 0);
    await page.waitForTimeout(2000);
    const released = await chartState(page, chartId);
    record(
      '전제 — 연결·원본 키·해제가 canonical `color:""` 로 서 있다',
      released.props?.color === "" &&
        released.hasColorKey &&
        released.props?.dimension === "status" &&
        !!released.props?.dataBinding,
      JSON.stringify(released.props),
    );

    // ── 해제 후 데이터 교체 ────────────────────────────────────────────────
    // (1) 연결을 끊어 sample rows 로 되돌린다 — Data Select 의 비-Users 항목.
    const dataOptions = await readOptions(page, "Data");
    const noneIdx = dataOptions.findIndex((o) => o.text !== "Users");
    let unboundVia = "select";
    if (noneIdx >= 0) await selectOption(page, "Data", noneIdx);
    let unbound = await chartState(page, chartId);
    if (unbound.props?.dataBinding) {
      unboundVia = "store";
      await page.evaluate(
        (id) =>
          window.__composition_STORE__
            .getState()
            .updateElementProps(id, { dataBinding: undefined }),
        chartId,
      );
      await page.waitForTimeout(1500);
      unbound = await chartState(page, chartId);
    }
    // (2) rows 교체 v1 → 필드 키는 남은 dimension/metric(status/num) 그대로.
    // bar 로 고정한다 — tooltip/키보드는 `.recharts-bar-rectangle` 를 hover 하므로 (팔레트 기본 종류에 기대지 않는다).
    await page.evaluate(
      ({ id, rows }) =>
        window.__composition_STORE__.getState().updateElementProps(id, {
          chartType: "bar",
          data: rows,
          style: { width: 480, height: 320 },
        }),
      { id: chartId, rows: rowsFor(1) },
    );
    await page.waitForTimeout(2000);
    const skiaV1 = await canvasSignature(page);
    await page.evaluate(
      ({ id, rows }) =>
        window.__composition_STORE__
          .getState()
          .updateElementProps(id, { data: rows }),
      { id: chartId, rows: rowsFor(2) },
    );
    await page.waitForTimeout(2000);
    const skiaV2 = await canvasSignature(page);
    const swapped = await chartState(page, chartId);
    record(
      '해제 후 데이터 교체 — 연결 해제·행 교체 뒤에도 `color:""` 키가 남고 Skia 가 새 데이터를 그린다',
      swapped.props?.color === "" &&
        swapped.hasColorKey &&
        swapped.props?.rows === 8 &&
        !swapped.props?.dataBinding &&
        skiaV1.signature !== skiaV2.signature &&
        skiaV2.chroma > 0,
      `unbound via ${unboundVia} · dataBinding=${JSON.stringify(swapped.props?.dataBinding)} · color=${JSON.stringify(swapped.props?.color)} rows=${swapped.props?.rows} · skia ${skiaV1.chroma}→${skiaV2.chroma}`,
    );

    // ── Compare Mode ────────────────────────────────────────────────────────
    await page
      .locator('[aria-label="Compare Mode (Preview + Skia)"]')
      .first()
      .click();
    await page.waitForTimeout(8000);
    let frame = previewFrame(page);
    if (!frame) throw new Error("preview iframe 없음");
    const pv0 = await previewSig(frame);
    record(
      "Preview 가 해제된 단일 시리즈로 같은 데이터를 그린다",
      pv0.found && pv0.marks > 0 && pv0.fills === 1,
      JSON.stringify({ marks: pv0.marks, fills: pv0.fills }),
    );

    // ── animation off ───────────────────────────────────────────────────────
    await page.evaluate(
      (id) =>
        window.__composition_STORE__
          .getState()
          .updateElementProps(id, { isAnimationActive: false }),
      chartId,
    );
    await page.waitForTimeout(2500);
    const docBeforeOff = (await chartState(page, chartId)).docJson;
    const [offFrames] = await Promise.all([
      sampleFrames(frame, 1500),
      page.evaluate(
        ({ id, rows }) =>
          window.__composition_STORE__
            .getState()
            .updateElementProps(id, { data: rows }),
        { id: chartId, rows: rowsFor(3) },
      ),
    ]);
    await page.waitForTimeout(1500);
    const offFinal = await previewSig(frame);
    const skiaOff = await canvasSignature(page);
    record(
      "animation off — 데이터 교체가 한 번에 최종 기하로 간다 (중간 프레임 0)",
      offFrames.distinct <= 2 && offFinal.sig === offFrames.final,
      `distinct ${offFrames.distinct} · lastChange ${offFrames.lastChangeAt}ms`,
    );

    // ── animation on ────────────────────────────────────────────────────────
    await page.evaluate(
      (id) =>
        window.__composition_STORE__.getState().updateElementProps(id, {
          isAnimationActive: true,
          animationDuration: 600,
          animationBegin: 0,
        }),
      chartId,
    );
    await page.waitForTimeout(2500);
    const docBeforeOn = (await chartState(page, chartId)).docJson;
    const [onFrames] = await Promise.all([
      sampleFrames(frame, 2000),
      page.evaluate(
        ({ id, rows }) =>
          window.__composition_STORE__
            .getState()
            .updateElementProps(id, { data: rows }),
        { id: chartId, rows: rowsFor(4) },
      ),
    ]);
    await page.waitForTimeout(1000);
    const onFinal = await previewSig(frame);
    const docAfterOn = (await chartState(page, chartId)).docJson;
    record(
      "animation on(600ms) — 중간 프레임이 실제로 여러 개 그려지고 600ms 안에 끝난다",
      onFrames.distinct >= 4 && onFrames.lastChangeAt <= 1400,
      `distinct ${onFrames.distinct} · lastChange ${onFrames.lastChangeAt}ms`,
    );
    // 완료 결과 정합: 같은 데이터를 animation off 로 다시 그리면 같은 기하여야 한다.
    await page.evaluate(
      (id) =>
        window.__composition_STORE__
          .getState()
          .updateElementProps(id, { isAnimationActive: false }),
      chartId,
    );
    await page.waitForTimeout(2500);
    const staticFinal = await previewSig(frame);
    const skiaOn = await canvasSignature(page);
    record(
      "animation 완료 결과 = 정적 결과 (Recharts 최종 기하 동일) · Canvas 는 정적 결과만",
      onFinal.sig === staticFinal.sig &&
        onFinal.fills === 1 &&
        skiaOn.chroma > 0,
      `marks ${onFinal.marks} · fills ${onFinal.fills} · skia chroma ${skiaOff.chroma}→${skiaOn.chroma}`,
    );
    record(
      "애니메이션 프레임의 canonical write 0 (데이터 교체 commit 뒤 문서 JSON 불변)",
      docAfterOn !== null && docBeforeOn !== docAfterOn
        ? (() => {
            const a = JSON.parse(docBeforeOn),
              b = JSON.parse(docAfterOn);
            const strip = (d) =>
              JSON.stringify(d, (k, v) => (k === "data" ? undefined : v));
            return strip(a) === strip(b);
          })()
        : true,
      `doc before/after 길이 ${docBeforeOn?.length}/${docAfterOn?.length} (data 교체 자체는 사용자 편집)`,
    );

    // ── reduced-motion ──────────────────────────────────────────────────────
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.evaluate(
      (id) =>
        window.__composition_STORE__.getState().updateElementProps(id, {
          isAnimationActive: true,
          animationDuration: 600,
        }),
      chartId,
    );
    await page.waitForTimeout(2500);
    frame = previewFrame(page);
    const [rmFrames] = await Promise.all([
      sampleFrames(frame, 1500),
      page.evaluate(
        ({ id, rows }) =>
          window.__composition_STORE__
            .getState()
            .updateElementProps(id, { data: rows }),
        { id: chartId, rows: rowsFor(5) },
      ),
    ]);
    record(
      "reduced-motion — animation on 이어도 중간 프레임 없이 최종 기하로 간다",
      rmFrames.reducedMotion === true && rmFrames.distinct <= 2,
      `matchMedia reduce=${rmFrames.reducedMotion} · distinct ${rmFrames.distinct}`,
    );
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.evaluate(
      (id) =>
        window.__composition_STORE__
          .getState()
          .updateElementProps(id, { isAnimationActive: false }),
      chartId,
    );
    await page.waitForTimeout(2000);

    // ── tooltip ─────────────────────────────────────────────────────────────
    frame = previewFrame(page);
    // iframe 상단은 Builder 헤더가 덮으므로 (pointer 가로챔) 막대 중심 좌표로 실제 마우스를 옮긴다.
    const hoverBar = async () => {
      const bar = frame
        .locator(".recharts-bar-rectangle path, .recharts-bar-rectangle rect")
        .nth(4);
      const box = await bar.boundingBox();
      if (!box) throw new Error("bar bbox 없음");
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, {
        steps: 4,
      });
      await page.waitForTimeout(700);
      return frame.evaluate(() => {
        const w = document.querySelector(".recharts-tooltip-wrapper");
        const visible =
          !!w &&
          getComputedStyle(w).visibility !== "hidden" &&
          (w.textContent ?? "").trim().length > 0;
        return {
          present: !!w,
          visible,
          text: (w?.textContent ?? "").trim().slice(0, 60),
        };
      });
    };
    // 팔레트 초기값이 showTooltip:true 라 off 는 명시적으로 만든다. Canvas 기준선도 이 시점 (reduced-motion 의 데이터 교체 뒤) 에 잡는다.
    await page.evaluate(
      (id) =>
        window.__composition_STORE__
          .getState()
          .updateElementProps(id, { showTooltip: false }),
      chartId,
    );
    await page.waitForTimeout(2500);
    frame = previewFrame(page);
    const docBeforeHover = (await chartState(page, chartId)).docJson;
    const tipOff = await hoverBar();
    await page.evaluate(
      (id) =>
        window.__composition_STORE__
          .getState()
          .updateElementProps(id, { showTooltip: true }),
      chartId,
    );
    await page.waitForTimeout(2500);
    frame = previewFrame(page);
    await page.mouse.move(300, 890); // 차트 밖 빈 영역으로 — tooltip 상태 초기화
    await page.waitForTimeout(300);
    // Canvas 기준선은 showTooltip=true 로 바뀐 뒤 잡는다 — 캔버스 스크린샷에 Properties 패널 overlay(스위치 색) 가 섞이므로 prop 토글 전후를 비교하면 안 된다.
    const skiaHoverBase = await canvasSignature(page);
    const tipOn = await hoverBar();
    const docAfterHover = (await chartState(page, chartId)).docJson;
    record(
      "tooltip — showTooltip off 는 hover 에 tooltip 없음, on 은 hover 에 값 tooltip",
      !tipOff.visible && tipOn.visible,
      `off=${JSON.stringify(tipOff)} on=${JSON.stringify(tipOn)}`,
    );
    const stripTip = (d) =>
      JSON.stringify(JSON.parse(d), (k, v) =>
        k === "showTooltip" ? undefined : v,
      );
    record(
      "hover 프레임의 canonical write 0 (showTooltip 토글 외 문서 불변)",
      stripTip(docBeforeHover) === stripTip(docAfterHover),
      `doc 길이 ${docBeforeHover.length}→${docAfterHover.length}`,
    );

    // ── 키보드 ──────────────────────────────────────────────────────────────
    await page.mouse.move(300, 890);
    await page.waitForTimeout(700);
    const tipAfterLeave = await frame.evaluate(() => {
      const w = document.querySelector(".recharts-tooltip-wrapper");
      return !!w && getComputedStyle(w).visibility !== "hidden";
    });
    // accessibilityLayer 의 focus 대상은 `svg[role="application"]` (tabindex 0) — chartInteraction.browser.test 와 같은 경로.
    const focusTarget = frame.locator('svg[role="application"]').first();
    const focusInfo = await focusTarget
      .evaluate((el) => ({
        tabindex: el.getAttribute("tabindex"),
        tag: el.tagName.toLowerCase(),
      }))
      .catch(() => null);
    await focusTarget.focus();
    await page.waitForTimeout(300);
    await page.keyboard.press("ArrowRight");
    await page.waitForTimeout(500);
    const key1 = await frame.evaluate(() => ({
      focused: `${document.activeElement?.tagName?.toLowerCase()}.${document.activeElement?.getAttribute?.("class") ?? ""}`,
      tip: (
        document.querySelector(".recharts-tooltip-wrapper")?.textContent ?? ""
      )
        .trim()
        .slice(0, 60),
      visible: getComputedStyle(
        document.querySelector(".recharts-tooltip-wrapper") ?? document.body,
      ).visibility,
    }));
    await page.keyboard.press("ArrowRight");
    await page.waitForTimeout(500);
    const key2 = await frame.evaluate(() => ({
      tip: (
        document.querySelector(".recharts-tooltip-wrapper")?.textContent ?? ""
      )
        .trim()
        .slice(0, 60),
    }));
    const docAfterKeys = (await chartState(page, chartId)).docJson;
    record(
      "키보드 — 마우스가 떠나 tooltip 이 닫힌 뒤 focus + ArrowRight 가 tooltip 을 열고 다음 ArrowRight 가 항목을 옮긴다",
      !tipAfterLeave &&
        key1.visible === "visible" &&
        key1.tip.length > 0 &&
        key2.tip !== key1.tip,
      `leave→visible=${tipAfterLeave} · target=${JSON.stringify(focusInfo)} · 1=${JSON.stringify(key1)} 2=${JSON.stringify(key2)}`,
    );
    record(
      "키보드 프레임의 canonical write 0",
      docAfterKeys === docAfterHover,
      `doc 길이 ${docAfterKeys.length}`,
    );
    const skiaEnd = await canvasSignature(page);
    record(
      "hover·키보드 동안 Canvas 정적 결과 불변 (tooltip 은 Preview 의 것)",
      skiaEnd.signature === skiaHoverBase.signature,
      `skia ${skiaHoverBase.chroma} → ${skiaEnd.chroma}`,
    );

    await page.screenshot({ path: `${OUT_DIR}/t13-final.png` });
    writeFileSync(
      `${OUT_DIR}/findings.json`,
      JSON.stringify(
        { url: page.url(), findings, errors: errors.slice(0, 10) },
        null,
        2,
      ),
    );
    const failed = findings.filter((f) => !f.pass);
    log(
      `결과 ${findings.length - failed.length}/${findings.length} PASS · console/page errors ${errors.length}`,
    );
    if (failed.length) process.exitCode = 1;
  } catch (error) {
    log("ERROR", error?.stack ?? error);
    await page.screenshot({ path: `${OUT_DIR}/t13-error.png` }).catch(() => {});
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}
main();
