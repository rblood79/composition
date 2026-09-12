#!/usr/bin/env node
// adr209-f4-production-network.mjs — ADR-209 후속 F4 (§8.3 network 시나리오, G5·G6).
//
// production 산출물 (`apps/builder/dist` base `/composition/`, `apps/publish/dist`) 을 로컬 정적 서버로
// 띄우고, **로그인된** production Builder 에서 다음을 실제 요청 로그로 판정한다:
//   1) Chart 포함 populated 프로젝트 cold boot (hydration → Skia ready) 동안 Recharts/차트 runtime chunk 요청 0
//   2) Chart 선택·showGrid 편집·재선택 동안 같은 chunk 요청 0
//   3) 차트 포함 Preview(Compare Mode iframe) 최초 진입에서 lazy chunk 1회 + 실제 `.recharts-surface`
//   4) 재선택·데이터 교체에서 runtime 모듈 재다운로드 0 (서버 데이터 요청과 구분)
//   5) 차트 없는 Preview cold load 요청 0 · 독립 Publish cold load: 차트 없는 export 0 / 차트 export 1
// 인증은 `.auth-session.json` 의 로컬 라이선스 인증 기록을 production origin 으로 옮겨 쓴다 (우회 없음).
// 준비: `pnpm -F @composition/builder build` · `pnpm -F @composition/publish build` 가 끝난 dist.
//
// 사용: node apps/builder/scripts/adr209-f4-production-network.mjs [--headed] [--repo <worktree>] [--out <dir>]
import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  existsSync,
  statSync,
} from "node:fs";
import { resolve, join, extname } from "node:path";
import { createServer } from "node:http";
import { execSync } from "node:child_process";
import { chromium } from "playwright";
import {
  waitReady,
  createInstrumentedContext,
  loadStorageState,
} from "./perf-baseline.mjs";

const headed = process.argv.includes("--headed");
const opt = (name, fallback) => {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : fallback;
};
const REPO = resolve(opt("repo", "."));
const OUT_DIR = resolve(opt("out", "/private/tmp/adr209-f3/f4"));
const BUILDER_DIST = resolve(REPO, "apps/builder/dist");
const PUBLISH_DIST = resolve(REPO, "apps/publish/dist");
const BUILDER_PORT = 4177,
  PUBLISH_PORT = 4178;
const STORAGE_STATE = resolve("apps/builder/scripts/.auth-session.json");
const CHUNK = /RechartsChart|recharts/i;
const log = (...a) => console.log("[ADR-209 F4]", ...a);
const findings = [];
const record = (name, pass, detail) => {
  findings.push({ name, pass, detail });
  log(`${pass ? "PASS" : "FAIL"} — ${name} :: ${detail}`);
};

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".wasm": "application/wasm",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".ttf": "font/ttf",
  ".ico": "image/x-icon",
  ".map": "application/json",
};
function staticServer(
  dist,
  { prefix = "", fallback = "index.html", extraJson = new Map() } = {},
) {
  return createServer((req, res) => {
    const url = new URL(req.url, "http://x");
    let path = decodeURIComponent(url.pathname);
    if (extraJson.has(path)) {
      res.writeHead(200, {
        "content-type": "application/json",
        "access-control-allow-origin": "*",
      });
      res.end(extraJson.get(path));
      return;
    }
    if (prefix && path.startsWith(prefix)) path = path.slice(prefix.length);
    if (path === "" || path === "/") path = `/${fallback}`;
    let file = join(dist, path);
    if (!existsSync(file) || statSync(file).isDirectory())
      file = join(dist, fallback);
    res.writeHead(200, {
      "content-type": MIME[extname(file)] ?? "application/octet-stream",
      "cache-control": "no-store",
    });
    res.end(readFileSync(file));
  });
}

function storageStateFor(origin) {
  const state = loadStorageState(STORAGE_STATE);
  const source = state.origins?.[0];
  if (source && !state.origins.some((o) => o.origin === origin))
    state.origins.push({
      origin,
      localStorage: source.localStorage.map((e) => ({ ...e })),
    });
  return state;
}
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
function rows200() {
  const rows = [];
  for (let i = 0; i < 50; i++)
    for (const s of ["A", "B", "C", "D"])
      rows.push({
        category: `c${i}`,
        value: ((i * 7 + s.charCodeAt(0)) % 40) + 1,
        series: s,
      });
  return rows;
}
/** 요청 로그 — phase 태그를 붙여 모은다 (iframe 요청도 page 이벤트로 들어온다). */
function requestLog(page) {
  const entries = [];
  let phase = "idle";
  page.on("request", (r) =>
    entries.push({
      phase,
      url: r.url(),
      type: r.resourceType(),
      frame: r.frame() === page.mainFrame() ? "main" : "child",
    }),
  );
  return {
    entries,
    setPhase: (p) => {
      phase = p;
    },
    chunks: (p) => entries.filter((e) => e.phase === p && CHUNK.test(e.url)),
    scripts: (p) =>
      entries.filter((e) => e.phase === p && e.type === "script").length,
    all: (p) => entries.filter((e) => e.phase === p).length,
  };
}
async function createProject(page, base, name) {
  await page.goto(`${base}/dashboard`, { waitUntil: "networkidle" });
  const create = page.locator("button.dashboard-create-button").first();
  await create.waitFor({ state: "visible", timeout: 30_000 });
  await create.click();
  const input = page.locator("#new-project-name");
  await input.waitFor({ state: "visible", timeout: 10_000 });
  await input.fill(name);
  await input.press("Enter");
  await page.waitForURL(/\/builder\/[^/?]+$/, { timeout: 90_000 });
  await waitReady(page);
  return page.url();
}
async function addFromPalette(page, type) {
  await setPanel(page, "components", true);
  await page
    .locator(
      `[data-component-type="${type}"], button:has-text("${type.toLowerCase()}")`,
    )
    .first()
    .click();
  await page.waitForTimeout(1500);
  await setPanel(page, "components", false);
}
async function exportProject(page, path) {
  await page
    .locator(
      ".header-menu-trigger, button.header-menu-button, [aria-label='Menu']",
    )
    .first()
    .click();
  await page.waitForTimeout(600);
  const item = page
    .locator('.header-menu-item[id$="export"], .header-menu-item')
    .filter({ hasText: /^(내보내기|Export)$/ })
    .first();
  const [download] = await Promise.all([
    page.waitForEvent("download", { timeout: 20_000 }),
    item.click(),
  ]);
  await download.saveAs(path);
  return readFileSync(path, "utf8");
}
const canvasChroma = async (page) => {
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
      const d = ctx.getImageData(0, 0, off.width, off.height).data;
      let n = 0;
      for (let i = 0; i < d.length; i += 4) {
        const r = d[i],
          g = d[i + 1],
          b = d[i + 2];
        if (
          Math.max(r, g, b) - Math.min(r, g, b) >= 60 &&
          Math.max(r, g, b) >= 90
        )
          n++;
      }
      return n;
    },
    { base64: png.toString("base64") },
  );
};
const previewState = (page) => {
  const frame = page.frames().find((f) => f.url().includes("preview.html"));
  return frame
    ? frame.evaluate(() => ({
        chart: !!document.querySelector(".react-aria-Chart"),
        surface: !!document.querySelector(".recharts-surface"),
        marks: document.querySelectorAll(
          ".recharts-surface path, .recharts-surface rect",
        ).length,
        chunk: performance
          .getEntriesByType("resource")
          .filter((e) => /RechartsChart/.test(e.name))
          .map((e) => ({
            name: e.name.split("/").pop(),
            durationMs: +e.duration.toFixed(1),
            transferSize: e.transferSize,
            encodedBodySize: e.encodedBodySize,
          })),
      }))
    : Promise.resolve(null);
};

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  for (const [dist, name] of [
    [BUILDER_DIST, "builder"],
    [PUBLISH_DIST, "publish"],
  ])
    if (!existsSync(join(dist, "index.html")))
      throw new Error(`${name} dist 없음 — 먼저 build`);
  const exports = new Map();
  const builderServer = staticServer(BUILDER_DIST, { prefix: "/composition" });
  const publishServer = staticServer(PUBLISH_DIST, { extraJson: exports });
  await new Promise((r) => builderServer.listen(BUILDER_PORT, "127.0.0.1", r));
  await new Promise((r) => publishServer.listen(PUBLISH_PORT, "127.0.0.1", r));
  const BASE = `http://localhost:${BUILDER_PORT}/composition`;
  const ORIGIN = `http://localhost:${BUILDER_PORT}`;
  const revision = execSync("git rev-parse HEAD", { cwd: REPO, encoding: "utf8" }).trim();
  const browser = await chromium.launch({ headless: !headed });
  const { context, page, errors } = await createInstrumentedContext(browser, {
    storageState: storageStateFor(ORIGIN),
    cpuThrottle: 1,
  });
  const net = requestLog(page);
  try {
    // ── 로그인된 production Builder ─────────────────────────────────────────
    net.setPhase("dashboard");
    await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
    const signIn = await page
      .locator(
        'form input[type="password"], button:has-text("Sign In"), button:has-text("로그인")',
      )
      .count();
    const createVisible = await page
      .locator("button.dashboard-create-button")
      .first()
      .isVisible()
      .catch(() => false);
    record(
      "production 빌드가 실제 세션으로 로그인된 dashboard 를 연다 (우회 없음)",
      signIn === 0 && createVisible,
      `url=${page.url()} · signInControls=${signIn} · create=${createVisible} · rev ${revision.slice(0, 9)}`,
    );

    // ── populated 프로젝트 (Chart 포함) ──────────────────────────────────
    net.setPhase("seed");
    const chartProjectUrl = await createProject(
      page,
      BASE,
      `adr209-f4-chart-${Date.now()}`,
    );
    await addFromPalette(page, "Button");
    await addFromPalette(page, "Chart");
    await addFromPalette(page, "Chart");
    const chartIds = await page.evaluate((rows) => {
      const st = window.__composition_STORE__.getState();
      const ids = st.elements
        .filter((e) => e.type === "Chart")
        .map((e) => e.id);
      ids.forEach((id, i) =>
        st.updateElementProps(id, {
          data: rows,
          chartType: i ? "line" : "bar",
          color: "series",
          showLegend: true,
          showGrid: true,
          style: { width: 640, height: 300 },
        }),
      );
      return ids;
    }, rows200());
    await page.waitForTimeout(3500);
    record(
      "Chart 2 + Button 이 실린 populated 프로젝트가 저장된다",
      chartIds.length === 2,
      `charts=${chartIds.length} · ${chartProjectUrl}`,
    );

    // ── 1) cold boot ─────────────────────────────────────────────────────
    net.setPhase("boot");
    await page.goto(chartProjectUrl, { waitUntil: "domcontentloaded" });
    await waitReady(page, { settleMs: 4000 });
    const bootCharts = await page.evaluate(
      () =>
        window.__composition_STORE__
          .getState()
          .elements.filter((e) => e.type === "Chart").length,
    );
    const bootChroma = await canvasChroma(page);
    record(
      "cold boot (hydration → Skia ready) 동안 Recharts/차트 runtime chunk 요청 0",
      net.chunks("boot").length === 0 && bootCharts === 2 && bootChroma > 0,
      `chunk 요청 ${net.chunks("boot").length} · script 요청 ${net.scripts("boot")} · 전체 ${net.all("boot")} · 문서 Chart ${bootCharts} · Skia chroma ${bootChroma}`,
    );

    // ── 2) 선택·편집·재선택 ────────────────────────────────────────────────
    net.setPhase("edit");
    await setPanel(page, "properties", true);
    await page.evaluate(
      (id) => window.__composition_STORE__.getState().setSelectedElement(id),
      chartIds[0],
    );
    await page.waitForTimeout(1200);
    const grid = fieldsetSwitch(page, "Show Grid");
    if (await grid.count()) {
      await grid.click();
      await page.waitForTimeout(1000);
      await grid.click();
    } else
      await page.evaluate((id) => {
        const st = window.__composition_STORE__.getState();
        const el = st.elements.find((e) => e.id === id);
        st.updateElementProps(id, { showGrid: !el.props.showGrid });
      }, chartIds[0]);
    await page.waitForTimeout(1000);
    await page.evaluate(
      (id) => window.__composition_STORE__.getState().setSelectedElement(id),
      chartIds[1],
    );
    await page.waitForTimeout(1000);
    await page.evaluate(
      (id) => window.__composition_STORE__.getState().setSelectedElement(id),
      chartIds[0],
    );
    await page.waitForTimeout(1500);
    record(
      "Chart 선택·showGrid 편집·재선택 동안 같은 chunk 요청 0 (Canvas 로 갱신)",
      net.chunks("edit").length === 0,
      `chunk 요청 ${net.chunks("edit").length} · 전체 ${net.all("edit")} · grid 컨트롤 ${(await grid.count()) ? "패널 스위치" : "store"}`,
    );

    // ── 3) 차트 포함 Preview 최초 진입 ───────────────────────────────────
    net.setPhase("preview-chart");
    await page
      .locator('[aria-label="Compare Mode (Preview + Skia)"]')
      .first()
      .click();
    await page.waitForTimeout(9000);
    const pv = await previewState(page);
    record(
      "차트 포함 Preview 최초 진입 — lazy chunk 1회 + 실제 Recharts 완료 그림",
      net.chunks("preview-chart").filter((e) => /RechartsChart/.test(e.url))
        .length === 1 &&
        !!pv?.surface &&
        (pv?.marks ?? 0) > 0,
      `chunk 요청 ${net
        .chunks("preview-chart")
        .map((e) => e.url.split("/").pop())
        .join(
          ",",
        )} · surface=${pv?.surface} marks=${pv?.marks} · resource ${JSON.stringify(pv?.chunk)}`,
    );

    // ── 4) 재선택·데이터 교체 — 재다운로드 0 ─────────────────────────────
    net.setPhase("swap");
    await page.evaluate(
      ({ id, rows }) =>
        window.__composition_STORE__
          .getState()
          .updateElementProps(id, {
            data: rows.map((r) => ({ ...r, value: r.value + 3 })),
          }),
      { id: chartIds[0], rows: rows200() },
    );
    await page.waitForTimeout(3000);
    await page.evaluate(
      (id) => window.__composition_STORE__.getState().setSelectedElement(id),
      chartIds[1],
    );
    await page.waitForTimeout(1500);
    const pv2 = await previewState(page);
    record(
      "재선택·데이터 교체에서 runtime 모듈 재다운로드 0 (Preview 는 새 데이터로 다시 그림)",
      net.chunks("swap").length === 0 && !!pv2?.surface,
      `chunk 요청 ${net.chunks("swap").length} · 전체 ${net.all("swap")} (서버 데이터/HMR 없음 = 정적 서버) · marks ${pv?.marks}→${pv2?.marks}`,
    );
    net.setPhase("export-chart");
    const chartExport = await exportProject(
      page,
      `${OUT_DIR}/chart-project.json`,
    );
    exports.set("/chart-project.json", chartExport);

    // ── 5) 차트 없는 Preview cold ──────────────────────────────────────────
    net.setPhase("seed-plain");
    const plainUrl = await createProject(
      page,
      BASE,
      `adr209-f4-plain-${Date.now()}`,
    );
    await addFromPalette(page, "Button");
    await page.waitForTimeout(2000);
    net.setPhase("preview-plain");
    await page.goto(plainUrl, { waitUntil: "domcontentloaded" });
    await waitReady(page, { settleMs: 3000 });
    await page
      .locator('[aria-label="Compare Mode (Preview + Skia)"]')
      .first()
      .click();
    await page.waitForTimeout(7000);
    const pvPlain = await previewState(page);
    record(
      "차트 없는 Builder boot + Preview cold load — chart lazy graph 요청 0",
      net.chunks("preview-plain").length === 0 &&
        pvPlain !== null &&
        !pvPlain.surface,
      `chunk 요청 ${net.chunks("preview-plain").length} · 전체 ${net.all("preview-plain")} · preview chart=${pvPlain?.chart} surface=${pvPlain?.surface}`,
    );
    net.setPhase("export-plain");
    const plainExport = await exportProject(
      page,
      `${OUT_DIR}/plain-project.json`,
    );
    exports.set("/plain-project.json", plainExport);

    // ── 독립 Publish cold load ─────────────────────────────────────────────
    for (const [name, expectChunk] of [
      ["plain", 0],
      ["chart", 1],
    ]) {
      const pubPage = await context.newPage();
      const pubNet = requestLog(pubPage);
      pubNet.setPhase("cold");
      await pubPage.goto(
        `http://localhost:${PUBLISH_PORT}/?project=${encodeURIComponent(`http://localhost:${PUBLISH_PORT}/${name}-project.json`)}`,
        { waitUntil: "networkidle" },
      );
      await pubPage.waitForTimeout(6000);
      const state = await pubPage.evaluate(() => ({
        chart: !!document.querySelector(".react-aria-Chart"),
        surface: !!document.querySelector(".recharts-surface"),
        marks: document.querySelectorAll(
          ".recharts-surface path, .recharts-surface rect",
        ).length,
        buttons: document.querySelectorAll("button").length,
      }));
      const chunks = pubNet
        .chunks("cold")
        .filter((e) => /RechartsChart/.test(e.url)).length;
      record(
        `독립 Publish cold load (${name === "plain" ? "차트 없는 export" : "차트 export"}) — chart chunk 요청 ${expectChunk}`,
        chunks === expectChunk &&
          (expectChunk ? state.surface && state.marks > 0 : !state.chart),
        `chunk ${chunks} · 전체 ${pubNet.all("cold")} · ${JSON.stringify(state)}`,
      );
      writeFileSync(
        `${OUT_DIR}/publish-${name}-network.log`,
        pubNet.entries.map((e) => `${e.phase}\t${e.type}\t${e.url}`).join("\n"),
      );
      await pubPage.close();
    }

    writeFileSync(
      `${OUT_DIR}/builder-network.log`,
      net.entries
        .map((e) => `${e.phase}\t${e.frame}\t${e.type}\t${e.url}`)
        .join("\n"),
    );
    writeFileSync(
      `${OUT_DIR}/findings.json`,
      JSON.stringify(
        {
          revision,
          builderOrigin: BASE,
          chartProjectUrl,
          findings,
          errors: errors.slice(0, 10),
        },
        null,
        2,
      ),
    );
    const failed = findings.filter((f) => !f.pass);
    log(
      `결과 ${findings.length - failed.length}/${findings.length} PASS · errors ${errors.length}`,
    );
    if (failed.length) process.exitCode = 1;
  } catch (error) {
    log("ERROR", error?.stack ?? error);
    await page.screenshot({ path: `${OUT_DIR}/error.png` }).catch(() => {});
    process.exitCode = 1;
  } finally {
    await context.close();
    await browser.close();
    builderServer.close();
    publishServer.close();
  }
}
function fieldsetSwitch(page, legend) {
  return page
    .locator("fieldset.properties-aria")
    .filter({ has: page.locator(`legend:text-is("${legend}")`) })
    .first()
    .locator(".react-aria-Switch")
    .first();
}
main();
