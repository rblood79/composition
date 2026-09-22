// ADR-231 live — headed Playwright (실제 빌더 부팅 · 실입력). Compare Mode/Preview 는 열지 않는다.
//   node apps/builder/scripts/adr231-components-frame-live.mjs [--base-url http://localhost:5173] [--phase 1|2]
// Phase 1 (G1 live smoke): Components frame = 1920 × 내용 (≥1080) · body maxScrollTop 0 · origin bbox 가 frame 안
//   · desktop→tablet→mobile→desktop 전환 시 Components frame width/height Δ0 · 사용자 페이지는 breakpoint 크기
// Phase 2 (G2): + 위치 Δ0 · align → 시스템 열 · 드래그 좌표 보존 · override origin 왕복 Δheight == Δ내용 · reload
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { writeFileSync, mkdirSync } from "node:fs";
import { chromium } from "playwright";
import {
  loadStorageState,
  createInstrumentedContext,
  createIsolatedProject,
} from "./perf-baseline.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : def;
};
const baseUrl = opt("--base-url", "http://localhost:5173");
const phase = Number(opt("--phase", "1"));

const results = [];
const check = (name, ok, detail) => {
  results.push({ name, ok, detail });
  process.stderr.write(
    `${ok ? "PASS" : "FAIL"} ${name}${detail ? " — " + JSON.stringify(detail) : ""}\n`,
  );
};
const settle = (page, ms = 600) => page.waitForTimeout(ms);

const readState = (page) =>
  page.evaluate(() => {
    const store = window.__composition_STORE__.getState();
    const frames = window.__composition_SCENE_DEBUG__.readPageFrames();
    const comp = store.pages.find(
      (p) =>
        p.pageRole === "components" ||
        String(p.slug ?? "").replace(/^\//, "") === "components" ||
        p.id === "page-components",
    );
    const body = store.elements.find(
      (e) => e.page_id === comp?.id && String(e.type).toLowerCase() === "body",
    );
    const layout = window.__composition_LAYOUT_DEBUG__?.getSharedLayoutMap?.();
    let maxBottom = 0;
    let originCount = 0;
    if (layout && body) {
      for (const e of store.elements) {
        if (e.page_id !== comp.id || e.parent_id !== body.id) continue;
        const r = layout.get(e.id);
        if (!r) continue;
        originCount += 1;
        maxBottom = Math.max(maxBottom, r.y + r.height);
      }
    }
    const scroll = window.__composition_SCROLL_STATE__
      ?.getState?.()
      .scrollMap?.get(body?.id);
    return {
      activeBreakpoint: store.activeBreakpoint,
      componentsId: comp?.id ?? null,
      bodyId: body?.id ?? null,
      bodyStyle: body?.props?.style ?? null,
      frames: Object.fromEntries(frames.map((f) => [f.id, f])),
      componentsFrame: frames.find((f) => f.id === comp?.id) ?? null,
      bodyLayoutHeight:
        layout && body ? (layout.get(body.id)?.height ?? null) : null,
      originCount,
      originMaxBottom: maxBottom,
      maxScrollTop: scroll?.maxScrollTop ?? null,
      pageContentHeight:
        window.__composition_VIEWPORT_SYNC__
          .getState()
          .pageContentHeights.get(comp?.id) ?? null,
      positions: store.pagePositions,
      pages: store.pages.map((p) => ({ id: p.id, title: p.title })),
    };
  });

// RAC ToggleButton 의 `id` 는 DOM id 가 아니다 — 순서 (desktop · tablet · mobile) 로 고른다.
const BP_INDEX = { desktop: 0, tablet: 1, mobile: 2 };
async function switchBreakpoint(page, id) {
  await page.locator(".builder-control-group button").nth(BP_INDEX[id]).click();
  await settle(page, 900);
}

async function main() {
  const storageState = loadStorageState(resolve(here, ".auth-session.json"));
  const browser = await chromium.launch({ channel: "chrome", headless: false });
  try {
    const { page, pageErrors, consoleErrors } = await createInstrumentedContext(
      browser,
      {
        storageState,
        cpuThrottle: 1,
        frameCapture: false,
        initScript: null,
        onPageError: (e) => process.stderr.write(`[pageerror] ${e}\n`),
      },
    );
    const project = await createIsolatedProject(page, baseUrl);
    process.stderr.write(`[boot] ${project.projectUrl}\n`);
    await settle(page, 2500);

    // Components 페이지로 이동해 레이아웃이 발행되게 한다 (보이는 페이지만 layout).
    const findComp = (p) =>
      p.pageRole === "components" ||
      String(p.slug ?? "").replace(/^\//, "") === "components" ||
      p.id === "page-components";
    const pagesDump = await page.evaluate(() =>
      window.__composition_STORE__
        .getState()
        .pages.map((p) => ({
          id: p.id,
          title: p.title,
          slug: p.slug,
          pageRole: p.pageRole,
          systemOwned: p.systemOwned,
        })),
    );
    process.stderr.write(`[pages] ${JSON.stringify(pagesDump)}\n`);
    await page.evaluate((findSrc) => {
      const st = window.__composition_STORE__.getState();
      const find = new Function("p", `return (${findSrc})(p)`);
      const comp = st.pages.find((p) => find(p));
      if (!comp)
        throw new Error(
          "components page 없음: " +
            JSON.stringify(st.pages.map((p) => p.slug)),
        );
      st.setCurrentPageId(comp.id);
    }, findComp.toString());
    await settle(page, 2500);

    const s0 = await readState(page);
    check(
      "components 페이지 존재 · origin ≥ 57",
      Boolean(s0.componentsId) && s0.originCount >= 57,
      {
        id: s0.componentsId,
        originCount: s0.originCount,
      },
    );
    check(
      "desktop: frame 폭 1920 · 높이 = 발행 body 높이 (≥ 1080)",
      s0.componentsFrame?.width === 1920 &&
        s0.componentsFrame?.height >= 1080 &&
        Math.abs(s0.componentsFrame.height - s0.bodyLayoutHeight) < 1,
      {
        frame: s0.componentsFrame,
        bodyLayoutHeight: s0.bodyLayoutHeight,
        pageContentHeight: s0.pageContentHeight,
      },
    );
    check(
      "origin 전부 frame 안 (maxBottom ≤ frame 높이) · body maxScrollTop 0",
      s0.originMaxBottom <= s0.componentsFrame.height + 0.5 &&
        (s0.maxScrollTop ?? 0) === 0,
      {
        originMaxBottom: s0.originMaxBottom,
        frameHeight: s0.componentsFrame.height,
        maxScrollTop: s0.maxScrollTop,
      },
    );
    check(
      "body style 은 시드 키만 (width/height 저작 없음)",
      s0.bodyStyle && s0.bodyStyle.width == null && s0.bodyStyle.height == null,
      s0.bodyStyle,
    );

    const trail = [];
    for (const bp of ["tablet", "mobile", "desktop"]) {
      await switchBreakpoint(page, bp);
      const s = await readState(page);
      trail.push({
        bp: s.activeBreakpoint,
        comp: s.componentsFrame,
        home: Object.values(s.frames).find((f) => f.id !== s.componentsId),
      });
    }
    const compFrames = [s0.componentsFrame, ...trail.map((t) => t.comp)];
    const sizeStable = compFrames.every(
      (f) =>
        f.width === compFrames[0].width &&
        Math.abs(f.height - compFrames[0].height) < 1,
    );
    check(
      "전환 왕복: Components frame width/height Δ0",
      sizeStable,
      compFrames.map((f) => [f.width, f.height]),
    );
    check(
      "전환: 사용자 페이지 frame 은 breakpoint 크기 (768×1024 · 390×844 · 1920×1080)",
      trail[0].home.width === 768 &&
        trail[1].home.width === 390 &&
        trail[2].home.width === 1920,
      trail.map((t) => [t.bp, t.home.width, t.home.height]),
    );
    if (phase >= 2) {
      const posStable = compFrames.every(
        (f) => f.x === compFrames[0].x && f.y === compFrames[0].y,
      );
      check(
        "전환 왕복: Components 위치 Δ0",
        posStable,
        compFrames.map((f) => [f.x, f.y]),
      );
    }

    check(
      "pageerror 0 · console error 0",
      pageErrors.length === 0 && consoleErrors.length === 0,
      {
        pageErrors: pageErrors.slice(0, 3),
        consoleErrors: consoleErrors.slice(0, 3),
      },
    );

    const out = resolve(
      here,
      "../../../docs/adr/evidence/231-components-frame-live",
    );
    mkdirSync(out, { recursive: true });
    writeFileSync(
      resolve(out, `phase${phase}-live.json`),
      JSON.stringify(
        { project: project.projectUrl, results, s0, trail },
        null,
        2,
      ),
    );
    const failed = results.filter((r) => !r.ok).length;
    process.stderr.write(
      `\n${results.length - failed}/${results.length} PASS\n`,
    );
    process.exitCode = failed ? 1 : 0;
  } finally {
    await browser.close();
  }
}
main();
