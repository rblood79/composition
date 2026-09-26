// ADR-232 Phase 1b live — headed Playwright (실제 빌더 부팅 · 실제 파생 경로).
//   node apps/builder/scripts/adr232-derived-placement-live.mjs [--base-url http://localhost:5173]
// 확인: derived 모드 전환 → 페이지 frame x·y 가 파생값 · 저장 좌표 무변경 (쓰기 0) ·
//   열 수/gap/direction/breakpoint override 반영 · 칸 고정 · absolute · reflow 없이 행 높이 추종.
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
const settle = (page, ms = 700) => page.waitForTimeout(ms);
const BP_INDEX = { desktop: 0, tablet: 1, mobile: 2 };

const readFrames = (page) =>
  page.evaluate(() => {
    const frames = window.__composition_SCENE_DEBUG__.readPageFrames();
    const st = window.__composition_STORE__.getState();
    return {
      activeBreakpoint: st.activeBreakpoint,
      frames: frames.map((f) => ({
        id: f.id,
        x: Math.round(f.x),
        y: Math.round(f.y),
        w: Math.round(f.width),
        h: Math.round(f.height),
      })),
      storePositions: Object.fromEntries(
        Object.entries(st.derivedPagePositions).map(([k, v]) => [
          k,
          [Math.round(v.x), Math.round(v.y)],
        ]),
      ),
      pages: st.pages.map((p) => ({
        id: p.id,
        title: p.title,
        slug: p.slug,
        pageRole: p.pageRole,
        systemOwned: p.systemOwned,
      })),
      docPageLayout:
        window.__composition_PAGE_PLACEMENT__.readPageLayout() ?? null,
      // **문서에 저장된** 좌표 — 위 storePositions (파생 미러) 와 다르다.
      docPagePositions:
        window.__composition_PAGE_PLACEMENT__.readPagePositions() ?? null,
    };
  });

const setLayout = (page, patch) =>
  page.evaluate(
    (p) => window.__composition_PAGE_PLACEMENT__.setPageLayout(p),
    patch,
  );
const setPlacements = (page, entries) =>
  page.evaluate(
    (e) => window.__composition_PAGE_PLACEMENT__.setPagePlacements(e),
    entries,
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

const COMPONENTS_ID = "page-components";
const isComponents = (p) =>
  p.id === COMPONENTS_ID ||
  p.pageRole === "components" ||
  String(p.slug ?? "").replace(/^\//, "") === "components";

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

    const before = await readFrames(page);
    record.steps.push({ step: "before", ...before });
    check(
      "부팅 시 hydration 이 derived 를 기록한다 (새 문서 — ADR-232 Phase 3)",
      before.docPageLayout?.placementModel === "derived",
      { docPageLayout: before.docPageLayout },
    );

    const userPages = before.pages.filter((p) => !isComponents(p));
    const compId = before.pages.find(isComponents)?.id ?? null;
    const homeId = userPages[0]?.id ?? null;
    check("Home · Components 페이지 식별", Boolean(homeId && compId), {
      homeId,
      compId,
    });

    // 사용자 페이지 4 추가 (총 5)
    await addPages(page, 4);
    await settle(page, 1200);
    const afterAdd = await readFrames(page);
    record.steps.push({ step: "after-add", ...afterAdd });
    check("사용자 페이지 5", afterAdd.pages.length === 6, {
      pages: afterAdd.pages.length,
    });

    const legacyFrames = Object.fromEntries(
      afterAdd.frames.map((f) => [f.id, [f.x, f.y]]),
    );
    const storedBefore = JSON.stringify(afterAdd.docPagePositions);

    // ── derived 모드 전환 ──
    await setLayout(page, {
      placementModel: "derived",
      direction: "auto",
      gap: 80,
      columns: 3,
      placements: {
        [compId]: { style: { position: "absolute", left: -2000, top: 0 } },
      },
    });
    await settle(page, 1200);
    const derived = await readFrames(page);
    record.steps.push({ step: "derived", ...derived });
    const dmap = Object.fromEntries(
      derived.frames.map((f) => [f.id, [f.x, f.y]]),
    );

    check(
      "derived 전환 후 Home 은 원점 (0,0)",
      dmap[homeId]?.[0] === 0 && dmap[homeId]?.[1] === 0,
      { home: dmap[homeId] },
    );
    check(
      "Components 는 absolute −2000",
      dmap[compId]?.[0] === -2000 && dmap[compId]?.[1] === 0,
      { comp: dmap[compId] },
    );

    const userIds = derived.pages
      .filter((p) => p.id !== compId)
      .map((p) => p.id);
    const expectedAuto = userIds.map((id, i) => [
      id,
      [(i % 3) * 2000, Math.floor(i / 3) * 1160],
    ]);
    const autoOk = expectedAuto.every(
      ([id, xy]) => dmap[id]?.[0] === xy[0] && dmap[id]?.[1] === xy[1],
    );
    check("3열 auto 격자 (stride 2000 · 행 1160)", autoOk, {
      got: userIds.map((id) => dmap[id]),
      want: expectedAuto.map(([, xy]) => xy),
    });

    // 파생 미러 (`derivedPagePositions`) 가 아니라 **문서의 `pagePositions`** 를 본다 —
    //   미러는 열 수·gap 이 바뀌면 당연히 바뀌는 파생값이라 "쓰기 0" 의 증거가 아니다
    //   (열 수 기본값이 auto 가 되자 이 검사가 미러 변화로 실패해 드러났다, 2026-09-23).
    check(
      "파생 전환이 저장 좌표를 쓰지 않았다 (쓰기 0)",
      JSON.stringify(derived.docPagePositions) === storedBefore,
      {
        before: storedBefore,
        after: JSON.stringify(derived.docPagePositions),
      },
    );

    const overlapping = [];
    for (let i = 0; i < derived.frames.length; i++)
      for (let j = i + 1; j < derived.frames.length; j++) {
        const a = derived.frames[i],
          b = derived.frames[j];
        if (
          a.x < b.x + b.w &&
          b.x < a.x + a.w &&
          a.y < b.y + b.h &&
          b.y < a.y + a.h
        )
          overlapping.push([a.id, b.id]);
      }
    check("겹침 0", overlapping.length === 0, { overlapping });

    // ── 열 수 3 → 4 ──
    await setLayout(page, { columns: 4 });
    await settle(page, 900);
    const cols4 = await readFrames(page);
    const c4 = Object.fromEntries(cols4.frames.map((f) => [f.id, [f.x, f.y]]));
    check(
      "열 수 4 반영 (5번째가 둘째 행 첫 칸)",
      c4[userIds[4]]?.[0] === 0 && c4[userIds[4]]?.[1] === 1160,
      { p4: c4[userIds[4]] },
    );
    await setLayout(page, { columns: 3 });
    await settle(page, 900);

    // ── 칸 고정 (3번째 페이지를 3열 2행에) ──
    await setPlacements(page, [
      {
        pageId: userIds[2],
        placement: { style: { gridColumnStart: 3, gridRowStart: 2 } },
      },
    ]);
    await settle(page, 900);
    const pinned = await readFrames(page);
    const pm = Object.fromEntries(pinned.frames.map((f) => [f.id, [f.x, f.y]]));
    check(
      "칸 고정 — 지정 칸으로",
      pm[userIds[2]]?.[0] === 4000 && pm[userIds[2]]?.[1] === 1160,
      { pinned: pm[userIds[2]] },
    );
    check(
      "고정으로 빈 칸을 뒤 페이지가 채운다",
      pm[userIds[3]]?.[0] === 4000 && pm[userIds[3]]?.[1] === 0,
      { next: pm[userIds[3]] },
    );
    await setPlacements(page, [{ pageId: userIds[2], placement: null }]);
    await settle(page, 700);

    // ── breakpoint 전환 왕복 ──
    const snapshots = {};
    for (const bp of ["desktop", "tablet", "mobile", "desktop"]) {
      await page
        .locator(".builder-control-group button")
        .nth(BP_INDEX[bp])
        .click();
      await settle(page, 1100);
      const s = await readFrames(page);
      snapshots[`${bp}-${Object.keys(snapshots).length}`] = Object.fromEntries(
        s.frames.map((f) => [f.id, [f.x, f.y]]),
      );
    }
    const keys = Object.keys(snapshots);
    check(
      "desktop 왕복 Δ0",
      JSON.stringify(snapshots[keys[0]]) === JSON.stringify(snapshots[keys[3]]),
      { first: snapshots[keys[0]][homeId], last: snapshots[keys[3]][homeId] },
    );
    const tabletStride = snapshots[keys[1]][userIds[1]]?.[0];
    check("tablet 열 stride = 768 + 80", tabletStride === 848, {
      tabletStride,
    });
    const mobileStride = snapshots[keys[2]][userIds[1]]?.[0];
    check("mobile 열 stride = 390 + 80", mobileStride === 470, {
      mobileStride,
    });
    record.steps.push({ step: "breakpoints", snapshots });

    // ── mobile 열 수 override ──
    await setLayout(page, { responsive: { columns: { mobile: 6 } } });
    await page
      .locator(".builder-control-group button")
      .nth(BP_INDEX.mobile)
      .click();
    await settle(page, 1100);
    const mob = await readFrames(page);
    const mm = Object.fromEntries(mob.frames.map((f) => [f.id, [f.x, f.y]]));
    check(
      "mobile 열 수 override 6 — 5 페이지가 한 행",
      userIds.every((id, i) => mm[id]?.[1] === 0),
      { ys: userIds.map((id) => mm[id]?.[1]) },
    );
    await page
      .locator(".builder-control-group button")
      .nth(BP_INDEX.desktop)
      .click();
    await settle(page, 1100);
    const back = await readFrames(page);
    const bm = Object.fromEntries(back.frames.map((f) => [f.id, [f.x, f.y]]));
    check(
      "desktop 은 override 무영향 (3열 유지)",
      bm[userIds[3]]?.[1] === 1160,
      { p3: bm[userIds[3]] },
    );

    // ── Home body 높이 변경 → 뒤 행만 이동 (reflow 코드 없이) ──
    await page.evaluate((id) => {
      const st = window.__composition_STORE__.getState();
      const body = st.elements.find(
        (e) => e.page_id === id && String(e.type).toLowerCase() === "body",
      );
      st.updateElementProps(body.id, {
        style: { ...(body.props?.style ?? {}), height: "1600px" },
      });
    }, homeId);
    await settle(page, 1400);
    const grown = await readFrames(page);
    const gm = Object.fromEntries(grown.frames.map((f) => [f.id, [f.x, f.y]]));
    const homeFrame = grown.frames.find((f) => f.id === homeId);
    check("Home frame 높이 1600", homeFrame?.h === 1600, { h: homeFrame?.h });
    check(
      "첫 행은 제자리",
      gm[userIds[1]]?.[1] === 0 && gm[userIds[2]]?.[1] === 0,
      { row1: [gm[userIds[1]], gm[userIds[2]]] },
    );
    check(
      "둘째 행이 행 최대 높이를 따라 내려온다 (1600 + 80)",
      gm[userIds[3]]?.[1] === 1680,
      { row2: gm[userIds[3]] },
    );
    // 기준은 직전 상태 (`back`) — 그 사이 breakpoint 전환은 **Phase 3 에서 삭제될 legacy 경로**
    //   (`switchPagePositionsBreakpoint`) 가 아직 살아 있어 저장 좌표를 건드린다. derived 모드에서
    //   그 값은 읽히지 않으며, 여기서 보는 것은 "파생 갱신 자체가 쓰지 않는다" 다.
    check(
      "파생 갱신 (body 높이 변경) 이 문서 배치를 쓰지 않았다",
      JSON.stringify(grown.docPageLayout?.placements ?? null) ===
        JSON.stringify(back.docPageLayout?.placements ?? null),
      { before: back.docPageLayout, after: grown.docPageLayout },
    );
    record.steps.push({
      step: "grown",
      frames: grown.frames,
      storePositions: grown.storePositions,
    });

    // ── 고정 칸이 열 수를 무력화하지 않는가 (사용자 보고 2026-09-23) ──
    //   grid 는 명시 track 밖 line 에 implicit track 을 만들고 auto-placement 가 그 격자를
    //   쓴다 → 3열에서 3번 칸에 고정한 페이지 하나가 「열 수」 설정을 통째로 무시하게 만들었다.
    await setLayout(page, { direction: "auto", gap: 80, columns: 3 });
    await settle(page, 1000);
    const pinTarget = userIds[2];
    await setPlacements(page, [
      {
        pageId: pinTarget,
        placement: { style: { gridColumnStart: 3, gridRowStart: 2 } },
      },
    ]);
    await settle(page, 1000);
    const pinned3 = await readFrames(page);
    const p3map = Object.fromEntries(
      pinned3.frames.map((f) => [f.id, [f.x, f.y]]),
    );

    await setLayout(page, { columns: 2 });
    await settle(page, 1100);
    const pinned2 = await readFrames(page);
    const p2map = Object.fromEntries(
      pinned2.frames.map((f) => [f.id, [f.x, f.y]]),
    );
    const flowIds = userIds.filter((id) => id !== pinTarget);
    check(
      "고정 페이지가 있어도 열 수 3→2 가 흐름 페이지를 접는다",
      flowIds.every((id) => p2map[id]?.[0] <= 2000) &&
        flowIds.some((id) => p2map[id]?.[1] > 0),
      { got: flowIds.map((id) => p2map[id]) },
    );
    check(
      "열 밖 고정 칸은 마지막 열로 clamp 된다 (문서 placement 는 유지)",
      p2map[pinTarget]?.[0] === 2000 &&
        p2map[pinTarget]?.[1] === p3map[pinTarget]?.[1],
      { pinned: p2map[pinTarget], at3: p3map[pinTarget] },
    );
    const cells2 = pinned2.frames.map((f) => `${f.x}:${f.y}`);
    check(
      "clamp 뒤에도 겹치는 페이지가 없다",
      new Set(cells2).size === cells2.length,
      { cells: cells2 },
    );

    await setLayout(page, { columns: 3 });
    await settle(page, 1100);
    const back3 = await readFrames(page);
    const b3map = Object.fromEntries(
      back3.frames.map((f) => [f.id, [f.x, f.y]]),
    );
    check(
      "열 수를 되돌리면 고정 칸도 원래 자리로 (clamp 는 파생 시점만)",
      b3map[pinTarget]?.[0] === p3map[pinTarget]?.[0] &&
        b3map[pinTarget]?.[1] === p3map[pinTarget]?.[1],
      { back: b3map[pinTarget], original: p3map[pinTarget] },
    );
    await setPlacements(page, [{ pageId: pinTarget, placement: null }]);
    await settle(page, 900);

    // ── legacy 복귀 ──
    await setLayout(page, { placementModel: "legacy" });
    await settle(page, 1100);
    const legacyBack = await readFrames(page);
    const lm = Object.fromEntries(
      legacyBack.frames.map((f) => [f.id, [f.x, f.y]]),
    );
    const storeMatches = Object.entries(legacyBack.storePositions).every(
      ([id, xy]) => lm[id]?.[0] === xy[0] && lm[id]?.[1] === xy[1],
    );
    check('"legacy" 전환 → 저장 좌표로 복귀', storeMatches, {
      store: legacyBack.storePositions,
      frames: lm,
    });
    record.steps.push({ step: "legacy", frames: legacyBack.frames });

    record.results = results;
  } finally {
    await browser.close();
  }
  const outDir = resolve(here, "../../../docs/adr/evidence");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(
    resolve(outDir, "232-phase1b-live.json"),
    JSON.stringify(record, null, 2),
  );
  const pass = results.filter((r) => r.ok).length;
  process.stderr.write(`\n[summary] ${pass}/${results.length}\n`);
  process.exit(pass === results.length ? 0 : 1);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
