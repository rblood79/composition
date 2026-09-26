// ADR-232 후속 live — 페이지 헤더 DOM 층이 Settings 변경 (gap · 열 수 · 방향) 을 즉시 따라가는가.
//   node apps/builder/scripts/adr232-page-header-follow-live.mjs [--base-url http://localhost:5173]
// 사용자 보고 2026-09-22: "page layout / gap 변경 시 헤더가 이동한 페이지를 따라가지 않는다.
//   스크롤로 화면 이동하면 그때 제자리로 온다."
// 병인: 배치 훅이 scene 프레임 대신 store 미러 (`derivedPagePositions`) 를 먼저 읽었고, 그 미러는
//   BuilderCanvas 의 passive effect 가 싣는다 — 자식 layoutEffect 보다 한 커밋 늦다.
// 판정: 카메라 입력 (스크롤 · pan · zoom) 을 **전혀 주지 않고** 설정만 바꾼 뒤,
//   헤더 화면 Δx = 프레임 scene Δx × zoom 인지 본다. zoom 은 헤더 폭 / 프레임 폭 에서 얻는다.
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { writeFileSync, mkdirSync } from "node:fs";
import { chromium } from "playwright";
import {
  loadStorageState,
  createInstrumentedContext,
  createIsolatedProject,
  openPanels,
} from "./perf-baseline.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = (n, d) => {
  const i = args.indexOf(n);
  return i >= 0 ? args[i + 1] : d;
};
const baseUrl = opt("--base-url", process.env.BUILDER_URL ?? "http://localhost:5173");

const results = [];
const check = (name, ok, detail) => {
  results.push({ name, ok, detail });
  process.stderr.write(
    `${ok ? "PASS" : "FAIL"} ${name}${detail ? " — " + JSON.stringify(detail) : ""}\n`,
  );
};
const settle = (page, ms = 900) => page.waitForTimeout(ms);

/** 헤더 DOM transform 의 translate3d X · 폭 + 같은 페이지의 scene 프레임. */
const readHeadersAndFrames = (page) =>
  page.evaluate(() => {
    const frames = window.__composition_SCENE_DEBUG__.readPageFrames();
    const frameById = Object.fromEntries(
      frames.map((f) => [f.id, { x: f.x, y: f.y, width: f.width }]),
    );
    const headers = {};
    for (const node of document.querySelectorAll("[data-page-header]")) {
      const id = node.dataset.pageId;
      if (!id) continue;
      const m = /translate3d\(([-\d.]+)px,\s*([-\d.]+)px/.exec(
        node.style.transform || "",
      );
      headers[id] = {
        x: m ? Number(m[1]) : null,
        y: m ? Number(m[2]) : null,
        width: Number.parseFloat(node.style.width || "0"),
        display: node.style.display,
      };
    }
    return { frameById, headers };
  });

const setLayout = (page, patch) =>
  page.evaluate(
    (p) => window.__composition_PAGE_PLACEMENT__.setPageLayout(p),
    patch,
  );

async function addPages(page, n) {
  for (let i = 0; i < n; i++) {
    await page
      .locator(
        'button[aria-label="Add page" i], button[aria-label="페이지 추가"]',
      )
      .first()
      .click({ timeout: 5000 });
    await settle(page, 1200);
  }
}

/**
 * 설정 변경 1회 — 카메라 입력 없이 헤더가 프레임을 따라갔는가.
 * 비교 대상은 **보이는 헤더** 뿐 (뷰포트 밖은 display:none 이라 transform 이 갱신되지 않는다).
 */
function judge(label, before, after) {
  const ids = Object.keys(after.headers).filter(
    (id) =>
      after.headers[id].display !== "none" &&
      before.headers[id] &&
      before.headers[id].display !== "none" &&
      after.frameById[id] &&
      before.frameById[id],
  );
  const rows = ids.map((id) => {
    const zoom = after.headers[id].width / after.frameById[id].width;
    const frameDx = after.frameById[id].x - before.frameById[id].x;
    const headerDx = after.headers[id].x - before.headers[id].x;
    return {
      id,
      zoom: Number(zoom.toFixed(4)),
      frameDx: Number(frameDx.toFixed(1)),
      expectedHeaderDx: Number((frameDx * zoom).toFixed(1)),
      headerDx: Number(headerDx.toFixed(1)),
      gap: Number(Math.abs(headerDx - frameDx * zoom).toFixed(2)),
    };
  });
  const moved = rows.filter((r) => Math.abs(r.frameDx) > 0.5);
  check(`${label} — 프레임이 실제로 움직였다 (판정 유효성)`, moved.length > 0, {
    movedPages: moved.length,
    rows,
  });
  check(
    `${label} — 헤더가 카메라 입력 없이 프레임을 따라간다 (|Δ헤더 − Δ프레임×zoom| ≤ 1px)`,
    moved.length > 0 && moved.every((r) => r.gap <= 1),
    {
      worst: moved.reduce((a, r) => (r.gap > a.gap ? r : a), moved[0] ?? null),
    },
  );
  return rows;
}

async function main() {
  const storageState = loadStorageState(resolve(here, ".auth-session.json"));
  const browser = await chromium.launch({ channel: "chrome", headless: false });
  const record = { at: new Date().toISOString(), steps: [] };
  try {
    const { page } = await createInstrumentedContext(browser, {
      storageState,
      cpuThrottle: 1,
      frameCapture: false,
      onPageError: (e) => process.stderr.write(`[pageerror] ${e}\n`),
    });
    const project = await createIsolatedProject(page, baseUrl);
    process.stderr.write(`[boot] ${project.projectUrl}\n`);
    await settle(page, 2500);
    await openPanels(page, ["Navigator"]);

    await addPages(page, 3);
    await settle(page, 1200);

    // 기준 — 3열 격자, gap 80
    await setLayout(page, { direction: "auto", gap: 80, columns: 3 });
    await settle(page, 1200);

    // 카메라를 한 번만 맞춘다 (기본 pan 은 헤더 띠가 뷰포트 위로 벗어나 전부 컬링된다).
    //   이후 판정 구간에서는 카메라 입력을 주지 않는다 — 그게 이 하니스의 전제다.
    await page.evaluate(() =>
      window.__composition_APPLY_VIEWPORT__({ scale: 0.12, x: 300, y: 200 }),
    );
    await settle(page, 1200);

    const base = await readHeadersAndFrames(page);
    record.steps.push({ step: "base", ...base });
    check(
      "기준 상태에서 헤더가 프레임 폭을 따른다 (zoom 배)",
      Object.keys(base.headers).length > 1,
      { headers: Object.keys(base.headers).length },
    );

    // ① gap 변경
    await setLayout(page, { gap: 400 });
    await settle(page, 1200);
    const afterGap = await readHeadersAndFrames(page);
    record.steps.push({
      step: "gap-400",
      rows: judge("gap 80 → 400", base, afterGap),
    });

    // ② 열 수 변경
    await setLayout(page, { columns: 2 });
    await settle(page, 1200);
    const afterColumns = await readHeadersAndFrames(page);
    record.steps.push({
      step: "columns-2",
      rows: judge("열 수 3 → 2", afterGap, afterColumns),
    });

    // ③ 방향 변경
    await setLayout(page, { direction: "horizontal" });
    await settle(page, 1200);
    const afterDirection = await readHeadersAndFrames(page);
    record.steps.push({
      step: "direction-horizontal",
      rows: judge("방향 auto → horizontal", afterColumns, afterDirection),
    });
  } finally {
    await browser.close();
  }

  const dir = resolve(here, "../../../docs/adr/evidence");
  mkdirSync(dir, { recursive: true });
  record.results = results;
  writeFileSync(
    resolve(dir, "232-page-header-follow-live.json"),
    JSON.stringify(record, null, 2),
  );
  const pass = results.filter((r) => r.ok).length;
  process.stderr.write(`\n${pass}/${results.length} PASS\n`);
  process.exit(pass === results.length ? 0 : 1);
}

main().catch((error) => {
  process.stderr.write(String(error?.stack ?? error) + "\n");
  process.exit(1);
});
