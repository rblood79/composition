// ADR-232 G2 live — 배치 편집 (headed Playwright · 실제 드래그/입력).
//   node apps/builder/scripts/adr232-placement-edit-live.mjs [--base-url http://localhost:5173]
// 드래그 격자 밖 → absolute → Cmd+Z 복귀 → reload 보존 · 드래그 흐름 칸 → 고정 + 뒤 페이지 재흐름 ·
// 드래그 고정 칸 → 교환 (Cmd+Z 1회) · Home 드래그/X·Y/nudge 무반응 · Home 칸 교환 거부 ·
// align → 전부 흐름 · Settings 열 수 · Navigator 순서 변경. Compare Mode/Preview 는 열지 않는다.
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
const settle = (page, ms = 800) => page.waitForTimeout(ms);
const COMPONENTS_ID = "page-components";

const readState = (page) =>
  page.evaluate(() => {
    const st = window.__composition_STORE__.getState();
    const frames = window.__composition_SCENE_DEBUG__.readPageFrames();
    return {
      activeBreakpoint: st.activeBreakpoint,
      pages: st.pages.map((p) => ({ id: p.id, title: p.title })),
      frames: Object.fromEntries(
        frames.map((f) => [f.id, [Math.round(f.x), Math.round(f.y)]]),
      ),
      sizes: Object.fromEntries(
        frames.map((f) => [f.id, [Math.round(f.width), Math.round(f.height)]]),
      ),
      pageLayout:
        window.__composition_PAGE_PLACEMENT__.readPageLayout() ?? null,
      storePositions: Object.fromEntries(
        Object.entries(st.derivedPagePositions).map(([k, v]) => [
          k,
          [Math.round(v.x), Math.round(v.y)],
        ]),
      ),
    };
  });

const setLayout = (page, patch) =>
  page.evaluate(
    (p) => window.__composition_PAGE_PLACEMENT__.setPageLayout(p),
    patch,
  );

/** scene(world) 좌표 → 화면 좌표. 캔버스 위 실제 포인터 이벤트를 쏜다. */
const worldToScreen = (page, point) =>
  page.evaluate((p) => {
    const vp = window.__composition_VIEWPORT_SYNC__.getState();
    const canvas = document.querySelector(
      '[data-testid="skia-canvas-unified"]',
    );
    const rect = canvas.getBoundingClientRect();
    return {
      x: rect.left + p.x * vp.zoom + vp.panOffset.x,
      y: rect.top + p.y * vp.zoom + vp.panOffset.y,
      zoom: vp.zoom,
    };
  }, point);

/** 그 페이지의 헤더가 화면에 들어오도록 pan 을 맞춘다 (드래그 전 필수 — 밖이면 헤더가 없다). */
async function ensureVisible(page, pageId) {
  await page.evaluate((id) => {
    const frames = window.__composition_SCENE_DEBUG__.readPageFrames();
    const frame = frames.find((f) => f.id === id);
    if (!frame) return;
    const vp = window.__composition_VIEWPORT_SYNC__.getState();
    const canvas = document.querySelector(
      '[data-testid="skia-canvas-unified"]',
    );
    const rect = canvas.getBoundingClientRect();
    vp.setPanOffset?.({
      x: rect.width / 2 - (frame.x + frame.width / 2) * vp.zoom,
      y: rect.height / 2 - (frame.y + frame.height / 2) * vp.zoom,
    });
  }, pageId);
  await settle(page, 700);
}

/** 페이지 헤더를 잡고 world Δ 만큼 끈다. */
async function dragPageBy(page, pageId, dx, dy) {
  await ensureVisible(page, pageId);
  const header = page
    .locator(`[data-page-header][data-page-id="${pageId}"]`)
    .first();
  if ((await header.count()) === 0)
    throw new Error(`page header 없음: ${pageId}`);
  // 제목 span 을 잡는다 — 액션 아이콘 (`page-header__action`) 은 드래그를 시작하지 않는다.
  const title = header.locator(".page-header__title").first();
  const box =
    (await title.count()) > 0
      ? await title.boundingBox()
      : await header.boundingBox();
  const zoom = await page.evaluate(
    () => window.__composition_VIEWPORT_SYNC__.getState().zoom,
  );
  // 헤더 **중앙**은 액션 아이콘 (삭제 등) 위일 수 있다 — 실측 09-22: 페이지가 지워졌다.
  //   제목 쪽 왼쪽 가장자리를 잡는다.
  const from = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  const hit = await page.evaluate(({ x, y }) => {
    const el = document.elementFromPoint(x, y);
    return el
      ? {
          tag: el.tagName,
          cls: el.className,
          pageId:
            el.closest("[data-page-id]")?.getAttribute("data-page-id") ?? null,
        }
      : null;
  }, from);
  process.stderr.write(
    `[drag] ${pageId.slice(0, 6)} at (${Math.round(from.x)},${Math.round(from.y)}) → ${JSON.stringify(hit)}\n`,
  );
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  const steps = 12;
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(
      from.x + (dx * zoom * i) / steps,
      from.y + (dy * zoom * i) / steps,
    );
    await page.waitForTimeout(16);
  }
  await page.mouse.up();
  await settle(page, 900);
}

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
    // breakpoint 를 명시 고정한다 (컨텍스트 기본값에 기대지 않는다 — 실행마다 갈렸다)
    await page.locator(".builder-control-group button").nth(0).click();
    await settle(page, 1100);
    const bp0 = await readState(page);
    check("desktop 고정", bp0.activeBreakpoint === "desktop", {
      bp: bp0.activeBreakpoint,
    });
    await addPages(page, 4);
    await settle(page, 1200);

    await setLayout(page, {
      placementModel: "derived",
      direction: "auto",
      gap: 80,
      columns: 3,
    });
    await settle(page, 1200);

    // 화면에 격자가 다 보이도록 줌 아웃 + 원점 근처로 pan
    await page.evaluate(() => {
      const vp = window.__composition_VIEWPORT_SYNC__.getState();
      // 격자 (3열 × 2행 + 시스템 열 + 아래 absolute 자리) 를 한 화면에 담는 줌.
      vp.setZoom?.(0.06);
      vp.setPanOffset?.({ x: 420, y: 180 });
    });
    await settle(page, 900);

    const base = await readState(page);
    const userIds = base.pages
      .filter((p) => p.id !== COMPONENTS_ID)
      .map((p) => p.id);
    const homeId = userIds[0];
    record.steps.push({ step: "base", ...base });
    check("3열 격자 시작", base.frames[userIds[3]]?.[1] === 1160, {
      p3: base.frames[userIds[3]],
    });
    check(
      "시스템 페이지 기본 배치 — placement 저장 없이 왼쪽 열",
      base.frames[COMPONENTS_ID]?.[0] === -2000 &&
        base.pageLayout?.placements === undefined,
      {
        comp: base.frames[COMPONENTS_ID],
        placements: base.pageLayout?.placements,
      },
    );

    const stride = 2000;
    // ── 1) 격자 밖으로 드래그 → absolute ──
    await dragPageBy(page, userIds[4], 0, 6000);
    const s1 = await readState(page);
    const p4 = s1.pageLayout?.placements?.[userIds[4]];
    check(
      "격자 밖 드래그 → absolute placement",
      p4?.style?.position === "absolute",
      { placement: p4 },
    );
    // 파생 좌표 == placement 가 적은 좌표 (드래그 이동량은 zoom/스냅에 따라 달라지므로 자기 정합으로 본다)
    check(
      "absolute 파생 좌표 = placement inset · 아래로 이동",
      s1.frames[userIds[4]]?.[0] === (p4?.style?.left ?? null) &&
        s1.frames[userIds[4]]?.[1] === (p4?.style?.top ?? null) &&
        (s1.frames[userIds[4]]?.[1] ?? 0) > (base.frames[userIds[4]]?.[1] ?? 0),
      { frame: s1.frames[userIds[4]], inset: p4?.style },
    );

    // Cmd+Z → 복귀
    await page.keyboard.press("Meta+z");
    await settle(page, 1000);
    const s2 = await readState(page);
    check(
      "Cmd+Z 1회로 흐름 복귀",
      s2.pageLayout?.placements?.[userIds[4]] === undefined,
      { placements: s2.pageLayout?.placements },
    );
    check(
      "복귀 좌표 = 원래 칸",
      JSON.stringify(s2.frames[userIds[4]]) ===
        JSON.stringify(base.frames[userIds[4]]),
      { before: base.frames[userIds[4]], after: s2.frames[userIds[4]] },
    );

    // 다시 absolute 로 만들고 reload 보존
    await dragPageBy(page, userIds[4], 0, 6000);
    await settle(page, 1200);
    const beforeReload = await readState(page);
    await page.reload({ waitUntil: "networkidle" });
    await settle(page, 4000);
    await page.evaluate(() => {
      const vp = window.__composition_VIEWPORT_SYNC__.getState();
      vp.setZoom?.(0.12);
      vp.setPanOffset?.({ x: 700, y: 300 });
    });
    await settle(page, 1200);
    const afterReload = await readState(page);
    check(
      "reload 보존 — placement 유지",
      JSON.stringify(afterReload.pageLayout?.placements?.[userIds[4]]) ===
        JSON.stringify(beforeReload.pageLayout?.placements?.[userIds[4]]),
      {
        before: beforeReload.pageLayout?.placements?.[userIds[4]],
        after: afterReload.pageLayout?.placements?.[userIds[4]],
      },
    );
    check(
      "reload 뒤 파생 좌표 Δ0",
      JSON.stringify(afterReload.frames) ===
        JSON.stringify(beforeReload.frames),
      { before: beforeReload.frames, after: afterReload.frames },
    );
    record.steps.push({
      step: "reload",
      before: beforeReload.frames,
      after: afterReload.frames,
    });

    /**
     * 칸 판정 (고정 · 교환 · 거부) 은 드래그 finish 와 **같은 커밋 진입점** 으로 실행한다 —
     * 포인터 플럼빙은 위 absolute 드래그와 아래 Home 무반응이 실제 마우스로 덮는다.
     * (헤더를 잡는 합성 드래그는 작은 Δ 에서 실행마다 갈려 판정 자체를 못 본다.)
     */
    const dropAt = async (pageId, point) => {
      await page.evaluate(
        ({ id, p }) =>
          window.__composition_PAGE_PLACEMENT__.commitFromPoint(id, p),
        { id: pageId, p: point },
      );
      await settle(page, 900);
    };

    // ── 2) 흐름 칸으로 드래그 → 고정 + 뒤 페이지 재흐름 ──
    await page.evaluate(
      (id) =>
        window.__composition_PAGE_PLACEMENT__.setPagePlacements([
          { pageId: id, placement: null },
        ]),
      userIds[4],
    );
    await settle(page, 900);
    const flowBase = await readState(page);
    // p3 (행2 열1) 을 행1 열3 (= p2 자리) 으로
    await dropAt(userIds[3], { x: 2 * stride + 40, y: 30 });
    const s3 = await readState(page);
    const pinned = s3.pageLayout?.placements?.[userIds[3]];
    check(
      "흐름 칸 드래그 → 칸 고정 longhand",
      pinned?.style?.gridColumnStart === 3 && pinned?.style?.gridRowStart === 1,
      { placement: pinned },
    );
    check("밀려난 흐름 페이지는 재흐름", s3.frames[userIds[2]]?.[1] === 1160, {
      p2: s3.frames[userIds[2]],
      was: flowBase.frames[userIds[2]],
    });
    record.steps.push({
      step: "pin-flow",
      frames: s3.frames,
      placements: s3.pageLayout?.placements,
    });

    // ── 3) 고정 칸으로 드래그 → 교환 (Cmd+Z 1회) ──
    const beforeSwap = await readState(page);
    const from = beforeSwap.frames[userIds[2]];
    const to = beforeSwap.frames[userIds[3]];
    await dropAt(userIds[2], { x: to[0] + 40, y: to[1] + 30 });
    const s4 = await readState(page);
    const a = s4.pageLayout?.placements?.[userIds[2]]?.style;
    const b = s4.pageLayout?.placements?.[userIds[3]]?.style;
    // 교환 = 끈 페이지가 대상 칸을, 원래 그 칸을 고정하던 페이지가 끈 페이지의 옛 배치를 갖는다
    const swapped =
      a?.gridColumnStart === 3 &&
      a?.gridRowStart === 1 &&
      JSON.stringify(s4.frames[userIds[2]]) ===
        JSON.stringify(beforeSwap.frames[userIds[3]]) &&
      JSON.stringify(s4.frames[userIds[3]]) ===
        JSON.stringify(beforeSwap.frames[userIds[2]]);
    check("고정 칸 드래그 → 두 페이지 교환", swapped, {
      moved: a,
      occupant: b,
      before: [beforeSwap.frames[userIds[2]], beforeSwap.frames[userIds[3]]],
      after: [s4.frames[userIds[2]], s4.frames[userIds[3]]],
    });
    check(
      "교환 결과 겹침 0",
      new Set(Object.values(s4.frames).map((f) => f.join(","))).size ===
        Object.keys(s4.frames).length,
      { frames: s4.frames },
    );
    await page.keyboard.press("Meta+z");
    await settle(page, 1000);
    const s5 = await readState(page);
    check(
      "교환 Cmd+Z 1회로 전체 복귀",
      JSON.stringify(s5.frames) === JSON.stringify(beforeSwap.frames),
      { before: beforeSwap.frames, after: s5.frames },
    );
    record.steps.push({
      step: "swap",
      before: beforeSwap.frames,
      after: s4.frames,
      undone: s5.frames,
    });

    // ── 4) Home 은 이동 불가 ──
    const beforeHome = await readState(page);
    await dragPageBy(page, homeId, 3000, 3000);
    const s6 = await readState(page);
    check(
      "Home 드래그 무반응",
      JSON.stringify(s6.frames[homeId]) ===
        JSON.stringify(beforeHome.frames[homeId]) &&
        s6.pageLayout?.placements?.[homeId] === undefined,
      { before: beforeHome.frames[homeId], after: s6.frames[homeId] },
    );

    // Home 선택 후 nudge
    await page.evaluate((id) => {
      const st = window.__composition_STORE__.getState();
      st.setCurrentPageId(id);
      const body = st.elements.find(
        (e) => e.page_id === id && String(e.type).toLowerCase() === "body",
      );
      if (body) st.setSelectedElement(body.id, st.selectedElementProps);
    }, homeId);
    await settle(page, 700);
    await page.keyboard.press("ArrowRight");
    await settle(page, 700);
    const s7 = await readState(page);
    check(
      "Home nudge 무반응",
      JSON.stringify(s7.frames[homeId]) ===
        JSON.stringify(beforeHome.frames[homeId]),
      { after: s7.frames[homeId] },
    );

    // Home 칸(첫 칸) 으로 교환 시도 → 거부
    const beforeReject = await readState(page);
    const target = beforeReject.frames[homeId];
    const source = beforeReject.frames[userIds[1]];
    await dragPageBy(
      page,
      userIds[1],
      target[0] - source[0],
      target[1] - source[1],
    );
    const s8 = await readState(page);
    check(
      "첫 칸(Home) 교환 거부",
      s8.pageLayout?.placements?.[userIds[1]] === undefined &&
        JSON.stringify(s8.frames[homeId]) === JSON.stringify(target),
      {
        placement: s8.pageLayout?.placements?.[userIds[1]],
        home: s8.frames[homeId],
      },
    );
    record.steps.push({
      step: "home-immovable",
      frames: s8.frames,
      pages: s8.pages,
    });

    // ── 5) align → 전부 흐름 ──
    await page.evaluate(() => {
      const st = window.__composition_STORE__.getState();
      st.setPageLayoutDirection?.("auto");
    });
    await page.evaluate(() =>
      import("/src/builder/workspace/canvas/viewport/pageLayoutActions.ts").then(
        (m) => m.alignPagesToScreen(),
      ),
    );
    await settle(page, 1200);
    const s9 = await readState(page);
    check(
      "align → placement 0",
      Object.keys(s9.pageLayout?.placements ?? {}).length === 0,
      { placements: s9.pageLayout?.placements },
    );
    check(
      "align 뒤에도 시스템 페이지는 기본 배치 (흐름에 합류하지 않는다)",
      s9.frames[COMPONENTS_ID]?.[0] === -2000,
      { comp: s9.frames[COMPONENTS_ID] },
    );
    const userFrames = userIds.map((id) => s9.frames[id]);
    check(
      "align 뒤 3열 격자 복귀",
      JSON.stringify(userFrames) ===
        JSON.stringify([
          [0, 0],
          [2000, 0],
          [4000, 0],
          [0, 1160],
          [2000, 1160],
        ]),
      { userFrames },
    );
    record.steps.push({ step: "align", frames: s9.frames });

    // ── 6) Settings 열 수 ──
    await setLayout(page, { columns: 5 });
    await settle(page, 900);
    const s10 = await readState(page);
    check(
      "열 수 5 — 5 페이지가 한 행",
      userIds.every((id) => s10.frames[id]?.[1] === 0),
      { ys: userIds.map((id) => s10.frames[id]?.[1]) },
    );
    await setLayout(page, { columns: 3 });
    await settle(page, 900);

    // ── 7) Navigator 순서 변경 → 배치 추종 (Home 0번 유지) ──
    const beforeReorder = await readState(page);
    await page.evaluate((ids) => {
      const st = window.__composition_STORE__.getState();
      const reorder = st.reorderPages ?? st.movePage;
      if (!reorder) return;
      reorder(ids[2], 1);
    }, userIds);
    await settle(page, 1200);
    const s11 = await readState(page);
    const orderNow = s11.pages
      .filter((p) => p.id !== COMPONENTS_ID)
      .map((p) => p.id);
    check("Home 은 0번 유지", orderNow[0] === homeId, { orderNow });
    check(
      "순서가 바뀌면 흐름 배치가 따라간다",
      JSON.stringify(s11.frames[orderNow[1]]) === JSON.stringify([2000, 0]),
      { second: orderNow[1], at: s11.frames[orderNow[1]] },
    );
    record.steps.push({
      step: "reorder",
      before: beforeReorder.frames,
      after: s11.frames,
      order: orderNow,
    });

    // 키 순서는 무시한다 (Object 순서는 의미가 없다)
    const sortedStore = (m) =>
      JSON.stringify(
        Object.fromEntries(
          Object.entries(m).sort(([a], [b]) => a.localeCompare(b)),
        ),
      );
    check(
      "저장 좌표 쓰기 0 (파생 모드 전 구간)",
      sortedStore(s11.storePositions) === sortedStore(base.storePositions),
      { before: base.storePositions, after: s11.storePositions },
    );

    record.results = results;
  } finally {
    await browser.close();
  }
  const outDir = resolve(here, "../../../docs/adr/evidence");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(
    resolve(outDir, "232-g2-placement-edit-live.json"),
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
