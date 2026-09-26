// ADR-232 후속 live — Settings 의 열 수 `auto` (2026-09-23 사용자 요청).
//   node apps/builder/scripts/adr232-auto-columns-live.mjs [--base-url http://localhost:5173]
// 확인: 실제 Settings 입력으로 auto 를 고르면 문서에 `columns: "auto"` 가 쓰이고, 열 수가
//   보이는 캔버스 폭 / zoom 에서 나오며, **정수가 그대로인 zoom 변화에는 파생이 0** 이다
//   (「가장 적은 비용」 — 파생 입력이 zoom 연속값이 아니라 양자화된 정수).
// Compare Mode / Preview iframe 은 열지 않는다 (사용자 지시 2026-09-22).
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

const TRACK = 1920; // desktop 페이지 폭
const GAP = 80;

const readState = (page) =>
  page.evaluate(() => ({
    layout: window.__composition_PAGE_PLACEMENT__.readPageLayout() ?? null,
    derivations: window.__composition_PAGE_PLACEMENT__.derivationCount(),
    containerWidth:
      window.__composition_VIEWPORT_SYNC__.getState().containerSize.width,
    // 패널 토글 레일이 캔버스 위에서 가리는 좌우 띠 — auto 열 수는 이걸 뺀 폭을 쓴다.
    railInset: (() => {
      let inset = 0;
      for (const side of ["left", "right"]) {
        const rail = document.querySelector(
          `.panel-toggle-rail[data-side="${side}"]`,
        );
        if (!rail) continue;
        const r = rail.getBoundingClientRect();
        if (r.width <= 0) continue;
        inset +=
          side === "left" ? r.right : Math.max(0, window.innerWidth - r.left);
      }
      return inset;
    })(),
    zoom: window.__composition_VIEWPORT_SYNC__.getState().zoom,
    frames: window.__composition_SCENE_DEBUG__
      .readPageFrames()
      .map((f) => ({ id: f.id, x: Math.round(f.x), y: Math.round(f.y) })),
    systemIds: window.__composition_STORE__
      .getState()
      .pages.filter(
        (p) => p.pageRole === "components" || p.id === "page-components",
      )
      .map((p) => p.id),
  }));

/** 흐름 페이지의 첫 행에 놓인 개수 = 실제로 적용된 열 수. */
const observedColumns = (state) => {
  const rows = state.frames.filter(
    (f) => !state.systemIds.includes(f.id) && f.y === 0,
  );
  return rows.length;
};

const expectedColumns = (width, zoom, railInset = 0) =>
  Math.min(
    24,
    Math.max(1, Math.floor(((width - railInset) / zoom + GAP) / (TRACK + GAP))),
  );

const setZoom = async (page, scale) => {
  await page.evaluate(
    (s) => window.__composition_APPLY_VIEWPORT__({ scale: s, x: 300, y: 200 }),
    scale,
  );
  await settle(page, 900);
};

async function addPages(page, n) {
  for (let i = 0; i < n; i++) {
    await page
      .locator(
        'button[aria-label="Add page" i], button[aria-label="페이지 추가"]',
      )
      .first()
      .click({ timeout: 5000 });
    await settle(page, 1100);
  }
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
    await addPages(page, 7); // 사용자 페이지 8 — 넓은 zoom 에서도 행이 채워진다
    await setZoom(page, 0.12);

    // Settings 패널 (헤더 메뉴 대신 단축키 — 진입점은 2026-08-25 에 옮겨졌다)
    await page.keyboard.press("Meta+Comma");
    await settle(page, 1500);
    const columns = page
      .locator('input[aria-label="Column Count"], input[aria-label="열 수"]')
      .first();
    check("Settings 에 열 수 입력이 있다", (await columns.count()) === 1, {});

    // ── 기본값 확인 (2026-09-23 사용자 판정: 열 수 기본값 = auto) ──
    const fresh = await readState(page);
    const freshShown = await columns.evaluate(
      (n) => n.value || n.placeholder || "",
    );
    check(
      "새 문서의 기본 열 수는 auto (문서에 columns 필드 없음)",
      freshShown.trim().toLowerCase() === "auto" &&
        fresh.layout?.columns === undefined,
      { shown: freshShown, layout: fresh.layout },
    );
    check(
      "기본 auto 도 레일 뺀 폭을 따른다",
      observedColumns(fresh) ===
        expectedColumns(fresh.containerWidth, fresh.zoom, fresh.railInset),
      {
        got: observedColumns(fresh),
        want: expectedColumns(
          fresh.containerWidth,
          fresh.zoom,
          fresh.railInset,
        ),
      },
    );

    // ── 실제 입력으로 auto 선택 ──
    //   기본이 이미 auto 라, 숫자를 한 번 거쳐야 "auto" 쓰기가 실제로 일어난다
    //   (같은 값 재입력은 commit 되지 않는다 — PropertyUnitInput 규약).
    await columns.click();
    await page.keyboard.press("ControlOrMeta+a");
    await page.keyboard.type("3");
    await page.keyboard.press("Enter");
    await settle(page, 1200);
    const numbered = await readState(page);
    check(
      "숫자 입력이 먼저 문서에 실린다 (auto 쓰기의 전제)",
      numbered.layout?.columns === 3,
      {
        layout: numbered.layout,
      },
    );

    await columns.click();
    await page.keyboard.press("ControlOrMeta+a");
    await page.keyboard.type("auto");
    await page.keyboard.press("Enter");
    await settle(page, 1200);
    const afterAuto = await readState(page);
    record.steps.push({ step: "auto", ...afterAuto });
    check(
      '입력 "auto" 가 문서에 columns: "auto" 로 쓰인다',
      afterAuto.layout?.columns === "auto",
      { layout: afterAuto.layout },
    );
    // suffix 모드의 키워드 값은 포커스 전 placeholder 로 보인다 (PropertyUnitInput 규약).
    const columnsShown = await columns.evaluate(
      (n) => n.value || n.placeholder || "",
    );
    check(
      "입력 칸이 auto 를 보여준다 (포커스 전에는 placeholder)",
      columnsShown.trim().toLowerCase() === "auto",
      { shown: columnsShown },
    );

    // ── zoom 별 열 수 ──
    for (const scale of [0.1, 0.12, 0.2, 0.35]) {
      await setZoom(page, scale);
      const st = await readState(page);
      const want = expectedColumns(st.containerWidth, st.zoom, st.railInset);
      record.steps.push({ step: `zoom-${scale}`, want, ...st });
      check(
        `zoom ${scale} — 열 수 = 보이는 폭에 들어가는 개수 (${want})`,
        observedColumns(st) === want,
        {
          got: observedColumns(st),
          want,
          width: st.containerWidth,
          zoom: st.zoom,
        },
      );
    }

    // 레일을 빼지 않으면 마지막 열이 레일 밑으로 들어간다 — 전폭 기준 열 수와 갈리는
    //   zoom 을 하나 찾아 "전폭이 아니라 레일 뺀 폭" 임을 직접 본다.
    {
      const probe = await readState(page);
      const full = expectedColumns(probe.containerWidth, probe.zoom, 0);
      const inset = expectedColumns(
        probe.containerWidth,
        probe.zoom,
        probe.railInset,
      );
      check(
        "레일 폭을 뺀 폭으로 센다 (전폭 기준과 갈리는 zoom 에서 확인)",
        probe.railInset > 0 &&
          (full === inset || observedColumns(probe) === inset),
        {
          railInset: probe.railInset,
          full,
          inset,
          got: observedColumns(probe),
        },
      );
    }

    // ── 「가장 적은 비용」 — 정수가 그대로인 zoom 변화는 파생 0 ──
    await setZoom(page, 0.12);
    const base = await readState(page);
    const baseCols = expectedColumns(
      base.containerWidth,
      base.zoom,
      base.railInset,
    );
    await page.evaluate(() =>
      window.__composition_PAGE_PLACEMENT__.resetDerivationCount(),
    );
    const sameIntegerZooms = [0.105, 0.11, 0.115, 0.118].filter(
      (z) =>
        expectedColumns(base.containerWidth, z, base.railInset) === baseCols,
    );
    for (const z of sameIntegerZooms) await setZoom(page, z);
    const afterJitter = await readState(page);
    check(
      `정수가 같은 zoom ${sameIntegerZooms.length} 회 변화 → 파생 0`,
      sameIntegerZooms.length >= 2 && afterJitter.derivations === 0,
      { derivations: afterJitter.derivations, zooms: sameIntegerZooms },
    );

    // 정수가 바뀌는 zoom 은 다시 파생한다 (설정이 살아 있다는 반대 증거)
    await page.evaluate(() =>
      window.__composition_PAGE_PLACEMENT__.resetDerivationCount(),
    );
    await setZoom(page, 0.35);
    const afterStep = await readState(page);
    check(
      "정수가 바뀌는 zoom 은 다시 파생한다",
      afterStep.derivations >= 1 &&
        observedColumns(afterStep) ===
          expectedColumns(
            afterStep.containerWidth,
            afterStep.zoom,
            afterStep.railInset,
          ),
      { derivations: afterStep.derivations, got: observedColumns(afterStep) },
    );

    // ── 숫자로 되돌리면 zoom 과 무관해진다 ──
    await columns.click();
    await page.keyboard.press("ControlOrMeta+a");
    await page.keyboard.type("2");
    await page.keyboard.press("Enter");
    await settle(page, 1200);
    const fixedA = await readState(page);
    await setZoom(page, 0.1);
    const fixedB = await readState(page);
    check(
      "숫자로 되돌리면 zoom 이 바뀌어도 열 수 고정 (2)",
      fixedA.layout?.columns === 2 &&
        observedColumns(fixedA) === 2 &&
        observedColumns(fixedB) === 2,
      { a: observedColumns(fixedA), b: observedColumns(fixedB) },
    );
    record.steps.push({ step: "fixed-2", a: fixedA, b: fixedB });
  } finally {
    await browser.close();
  }

  const dir = resolve(here, "../../../docs/adr/evidence");
  mkdirSync(dir, { recursive: true });
  record.results = results;
  writeFileSync(
    resolve(dir, "232-auto-columns-live.json"),
    JSON.stringify(record, null, 2),
  );
  const pass = results.filter((r) => r.ok).length;
  process.stderr.write(`\n[summary] ${pass}/${results.length}\n`);
  process.exit(pass === results.length ? 0 : 1);
}

main().catch((error) => {
  process.stderr.write(String(error?.stack ?? error) + "\n");
  process.exit(1);
});
