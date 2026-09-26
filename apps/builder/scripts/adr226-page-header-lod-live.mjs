// ADR-226 G3 live — headed Playwright (실제 빌더 부팅 · 실입력).
//   node apps/builder/scripts/adr226-page-header-lod-live.mjs [--base-url http://localhost:5173]
// ① 휠 pan · 휠 zoom · 스페이스 pan settle 뒤 헤더 집합 = 뷰포트 안 페이지 (+ 층 visible)
// ② pointercancel · blur · visibility hidden 뒤 store false · 헤더 visible · 최신 집합
// ③ mobile 페이지 줌 0.1 → compact (버튼 0 · 타이틀) / 0.3 → full
// ④ compact 헤더 drag 로 페이지 이동 · shift-클릭 body 토글 · dblclick 이름 편집 (편집 중 full)
// ⑤ 편집 페이지가 200 px 가시 마진 안에 남는 pan → 편집기 유지 · 밖으로 나간 settle → 닫힘
// pointer pan 중 control unmount 경로는 live 로 재현할 표면이 없어 (컨테이너 교체 트리거 없음)
// 단위 테스트 (useViewportControl.pointerCleanup.test.tsx) 가 정본이다.
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import {
  loadStorageState,
  createInstrumentedContext,
  createIsolatedProject,
  seedDocument,
  wheelBurst,
} from "./perf-baseline.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : def;
};
const baseUrl = opt("--base-url", process.env.BUILDER_URL ?? "http://localhost:5173");

const results = [];
const check = (name, ok, detail) => {
  results.push({ name, ok, detail });
  process.stderr.write(
    `${ok ? "PASS" : "FAIL"} ${name}${detail ? " — " + JSON.stringify(detail) : ""}\n`,
  );
};

const headerState = (page) =>
  page.evaluate(() => {
    const layer = document.querySelector(".page-header-layer");
    const hs = [...layer.querySelectorAll(".page-header")];
    const titled = new Set(
      window.__composition_STORE__
        .getState()
        .pages.filter((p) => p.title)
        .map((p) => p.id),
    );
    const mounted = hs.map((h) => h.dataset.pageId).sort();
    const visible = (window.__composition_VISIBLE_PAGE_IDS__?.() ?? [])
      .filter((id) => titled.has(id))
      .sort();
    return {
      hidden: layer.hasAttribute("data-hidden"),
      gate: window.__composition_VIEWPORT_SYNC__.getState().cameraGestureActive,
      mounted,
      visible,
      setsEqual:
        mounted.length === visible.length &&
        mounted.every((id, i) => id === visible[i]),
      cam: window.__composition_VIEWPORT__(),
      lods: Object.fromEntries(
        hs.map((h) => [
          h.dataset.pageId,
          {
            lod: h.dataset.lod,
            buttons: h.querySelectorAll(".page-header__action").length,
            title: h.querySelector(".page-header__title")?.textContent ?? null,
            editing: h.hasAttribute("data-editing"),
            display: h.style.display,
          },
        ]),
      ),
    };
  });

const settle = (page, ms = 450) => page.waitForTimeout(ms);
const applyViewport = (page, s) =>
  page.evaluate(async (s) => {
    window.__composition_APPLY_VIEWPORT__(s);
    await new Promise((r) =>
      requestAnimationFrame(() => requestAnimationFrame(r)),
    );
  }, s);

async function canvasCenter(page) {
  const box = await page
    .locator('[data-testid="skia-canvas-unified"]')
    .boundingBox();
  return { x: box.x + box.width / 2, y: box.y + box.height / 2, box };
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
    const seed = await seedDocument(page, 20, "mixed", 40);
    process.stderr.write(`[seed] pages ${seed.pageIds.length}\n`);
    await applyViewport(page, { scale: 0.1, x: 40, y: 80 });
    await settle(page, 1200);

    // ① 휠 pan / 휠 zoom / 스페이스 pan
    await wheelBurst(
      page,
      400,
      "return { deltaX: (Math.floor(i / 12) % 2 ? -1 : 1) * 24, deltaY: 0 };",
      true,
    );
    await settle(page);
    let s = await headerState(page);
    check(
      "① 휠 pan settle — 집합 = 뷰포트 · visible · gate off",
      s.setsEqual && !s.hidden && !s.gate && s.mounted.length > 0,
      { mounted: s.mounted.length, cam: s.cam },
    );
    await wheelBurst(
      page,
      400,
      "return { deltaY: (Math.floor(i / 6) % 2 ? 30 : -30), ctrlKey: true };",
      true,
    );
    await settle(page);
    s = await headerState(page);
    check(
      "① 휠 zoom settle — 집합 = 뷰포트 · visible · gate off",
      s.setsEqual && !s.hidden && !s.gate && s.mounted.length > 0,
      { mounted: s.mounted.length, zoom: s.cam.zoom },
    );
    await applyViewport(page, { scale: 0.1, x: 40, y: 80 });
    await settle(page, 600);
    {
      const c = await canvasCenter(page);
      await page.mouse.move(c.x, c.y);
      await page.keyboard.down("Space");
      await page.mouse.down({ button: "left" });
      const during = [];
      for (let i = 1; i <= 20; i += 1) {
        await page.mouse.move(c.x - i * 12, c.y + i * 4);
        if (i === 10) during.push(await headerState(page));
      }
      await page.mouse.up({ button: "left" });
      await page.keyboard.up("Space");
      await settle(page);
      s = await headerState(page);
      check(
        "① 스페이스 pan — 제스처 중 hidden+gate, settle 뒤 집합 = 뷰포트 · visible",
        during[0]?.hidden &&
          during[0]?.gate &&
          s.setsEqual &&
          !s.hidden &&
          !s.gate,
        {
          duringMounted: during[0]?.mounted.length,
          after: s.mounted.length,
          cam: s.cam,
        },
      );
    }

    // ② interrupt 3경로 — 스페이스 pan 도중 pointercancel / blur / visibilitychange
    for (const kind of ["pointercancel", "blur", "visibility"]) {
      const c = await canvasCenter(page);
      await page.mouse.move(c.x, c.y);
      await page.keyboard.down("Space");
      await page.mouse.down({ button: "left" });
      await page.mouse.move(c.x - 60, c.y);
      await page.mouse.move(c.x - 120, c.y);
      const mid = await headerState(page);
      await page.evaluate((kind) => {
        if (kind === "pointercancel")
          window.dispatchEvent(
            new PointerEvent("pointercancel", { pointerId: 1, bubbles: true }),
          );
        else if (kind === "blur") window.dispatchEvent(new Event("blur"));
        else {
          Object.defineProperty(document, "visibilityState", {
            configurable: true,
            get: () => "hidden",
          });
          document.dispatchEvent(new Event("visibilitychange"));
          delete document.visibilityState;
        }
      }, kind);
      await settle(page, 300);
      s = await headerState(page);
      check(
        `② ${kind} — store false · 헤더 visible · 최신 집합`,
        mid.gate && !s.gate && !s.hidden && s.setsEqual,
        { midGate: mid.gate, after: s.mounted.length },
      );
      await page.mouse.up({ button: "left" }).catch(() => {});
      await page.keyboard.up("Space");
      await settle(page, 300);
    }

    // ③ 티어 — 헤더 breakpoint 토글 (전역: 모든 페이지 폭 390) · 대상은 seeded 페이지 (components 미러 제외)
    const mobileId = await page.evaluate(() => {
      const st = window.__composition_STORE__.getState();
      return (
        st.pages.find((p) => p.title && /perf-seed/.test(p.id))?.id ?? null
      );
    });
    await page
      .locator('[aria-label="Mobile"], [aria-label="모바일"]')
      .first()
      .click();
    await settle(page, 800);
    await applyViewport(page, { scale: 0.1, x: 40, y: 80 });
    await settle(page, 800);
    s = await headerState(page);
    const mob = s.lods[mobileId];
    check(
      "③ mobile × 0.1 → compact (버튼 0 · 타이틀 보임)",
      mob?.lod === "compact" && mob?.buttons === 0 && Boolean(mob?.title),
      mob,
    );
    await applyViewport(page, { scale: 0.3, x: 40, y: 80 });
    await settle(page, 800);
    s = await headerState(page);
    check(
      "③ mobile × 0.3 → full (버튼 2)",
      s.lods[mobileId]?.lod === "full" && s.lods[mobileId]?.buttons === 2,
      s.lods[mobileId],
    );

    // ④ compact 에서 drag · shift 토글 · 이름 편집 — 대상 헤더를 뷰포트 중앙쯤으로
    const mobPos = await page.evaluate(
      (id) => window.__composition_STORE__.getState().pagePositions[id],
      mobileId,
    );
    await applyViewport(page, {
      scale: 0.1,
      x: 500 - mobPos.x * 0.1,
      y: 300 - mobPos.y * 0.1,
    });
    await settle(page, 800);
    const hdr = page.locator(`.page-header[data-page-id="${mobileId}"]`);
    let box = await hdr.boundingBox();
    const posBefore = await page.evaluate(
      (id) => window.__composition_STORE__.getState().pagePositions[id],
      mobileId,
    );
    await page.mouse.move(box.x + 8, box.y + box.height / 2);
    await page.mouse.down();
    for (let i = 1; i <= 10; i += 1)
      await page.mouse.move(box.x + 8 + i * 10, box.y + box.height / 2 + i * 3);
    await page.mouse.up();
    await settle(page, 400);
    const posAfter = await page.evaluate(
      (id) => window.__composition_STORE__.getState().pagePositions[id],
      mobileId,
    );
    check(
      "④ compact 헤더 drag → 페이지 이동",
      posAfter &&
        posBefore &&
        (posAfter.x !== posBefore.x || posAfter.y !== posBefore.y),
      { posBefore, posAfter },
    );
    box = await hdr.boundingBox();
    // drag 가 페이지를 선택 상태로 두므로 토글 대조는 빈 선택에서 시작
    await page.evaluate(() =>
      window.__composition_STORE__.getState().setSelectedElement(null),
    );
    await settle(page, 200);
    await page.keyboard.down("Shift");
    await page.mouse.click(box.x + 8, box.y + box.height / 2);
    await page.keyboard.up("Shift");
    await settle(page, 300);
    const sel1 = await page.evaluate(() =>
      window.__composition_STORE__.getState().selectedElementIds.slice(),
    );
    await page.keyboard.down("Shift");
    await page.mouse.click(box.x + 8, box.y + box.height / 2);
    await page.keyboard.up("Shift");
    await settle(page, 300);
    const sel2 = await page.evaluate(() =>
      window.__composition_STORE__.getState().selectedElementIds.slice(),
    );
    check(
      "④ compact shift-클릭 body 토글",
      sel1.length === 1 && sel2.length === 0,
      { sel1, sel2 },
    );
    await page.mouse.dblclick(box.x + 8, box.y + box.height / 2);
    await settle(page, 300);
    s = await headerState(page);
    const editing = s.lods[mobileId];
    check(
      "④ compact dblclick 이름 편집 → data-editing · full",
      editing?.editing &&
        editing?.lod === "full" &&
        (await hdr.locator("input").count()) === 1,
      editing,
    );

    // ⑤ 편집 중 pan — 가시 마진 안 (작은 pan) 은 편집기 유지, 밖 (큰 pan) 은 닫힘
    await wheelBurst(page, 200, "return { deltaX: 4, deltaY: 0 };", true);
    await settle(page);
    s = await headerState(page);
    check(
      "⑤ 마진 안 pan → 편집기 유지",
      s.lods[mobileId]?.editing === true && !s.hidden,
      { cam: s.cam, editing: s.lods[mobileId]?.editing },
    );
    await wheelBurst(page, 1500, "return { deltaX: 40, deltaY: 0 };", true);
    await settle(page);
    s = await headerState(page);
    check(
      "⑤ 마진 밖 settle → 편집기 닫힘 (헤더 unmount)",
      !(mobileId in s.lods) || s.lods[mobileId].editing === false,
      { mounted: s.mounted.length, cam: s.cam },
    );

    check(
      "console/page error 0",
      pageErrors.length === 0 && consoleErrors.length === 0,
      {
        page: pageErrors.length,
        console: consoleErrors.length,
        sample: [...pageErrors, ...consoleErrors].slice(0, 3),
      },
    );
  } finally {
    await browser.close();
  }
  const pass = results.filter((r) => r.ok).length;
  process.stderr.write(`\n[adr226 live] ${pass}/${results.length}\n`);
  if (pass !== results.length) process.exitCode = 2;
}

main().catch((e) => {
  process.stderr.write(`[fail] ${e?.stack ?? e}\n`);
  process.exit(1);
});
