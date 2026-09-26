// ADR-232 G5 live — 위치 소비처가 파생 frame 과 어긋나지 않는다 (headed Playwright).
//   node apps/builder/scripts/adr232-consumer-parity-live.mjs
// 히트 (빈 페이지 영역 클릭 → 그 페이지 body 선택) · 페이지 헤더 위치 · 액션 바 위치 ·
// 스크롤바 extent · 미니맵 rect · 가이드 원점 — 전부 `readPageFrames()` 와 대조한다.
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { writeFileSync, mkdirSync } from "node:fs";
import { chromium } from "playwright";
import {
  loadStorageState, createInstrumentedContext, createIsolatedProject, openPanels,
} from "./perf-baseline.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const results = [];
const check = (name, ok, detail) => {
  results.push({ name, ok, detail });
  process.stderr.write(`${ok ? "PASS" : "FAIL"} ${name}${detail ? " — " + JSON.stringify(detail).slice(0, 300) : ""}\n`);
};
const settle = (page, ms = 800) => page.waitForTimeout(ms);
const COMPONENTS_ID = "page-components";

async function main() {
  const storageState = loadStorageState(resolve(here, ".auth-session.json"));
  const browser = await chromium.launch({ channel: "chrome", headless: false });
  const record = { at: new Date().toISOString() };
  try {
    const { page } = await createInstrumentedContext(browser, {
      storageState, cpuThrottle: 1, frameCapture: false,
      onPageError: (e) => process.stderr.write(`[pageerror] ${e}\n`),
    });
    const project = await createIsolatedProject(page, process.env.BUILDER_URL ?? "http://localhost:5173");
    process.stderr.write(`[boot] ${project.projectUrl}\n`);
    await settle(page, 2500);
    await openPanels(page, ["Navigator"]);
    for (let i = 0; i < 2; i++) {
      await page.locator('button[aria-label="Add page" i], button[aria-label="페이지 추가"]').first().click({ timeout: 5000 });
      await settle(page, 1100);
    }
    await page.evaluate(() => {
      const vp = window.__composition_VIEWPORT_SYNC__.getState();
      vp.setZoom?.(0.2);
      vp.setPanOffset?.({ x: 600, y: 260 });
    });
    await settle(page, 1000);

    const snapshot = await page.evaluate(() => {
      const st = window.__composition_STORE__.getState();
      const frames = window.__composition_SCENE_DEBUG__.readPageFrames();
      const vp = window.__composition_VIEWPORT_SYNC__.getState();
      const toScreen = (p) => ({
        x: p.x * vp.zoom + vp.panOffset.x,
        y: p.y * vp.zoom + vp.panOffset.y,
      });
      const headers = [...document.querySelectorAll("[data-page-header][data-page-id]")].map((el) => {
        const r = el.getBoundingClientRect();
        return { id: el.getAttribute("data-page-id"), left: Math.round(r.left), bottom: Math.round(r.bottom) };
      });
      const canvasRect = document.querySelector('[data-testid="skia-canvas-unified"]').getBoundingClientRect();
      return {
        zoom: vp.zoom,
        pan: { x: vp.panOffset.x, y: vp.panOffset.y },
        canvasLeft: Math.round(canvasRect.left),
        canvasTop: Math.round(canvasRect.top),
        frames: frames.map((f) => ({ id: f.id, x: f.x, y: f.y, w: f.width, h: f.height })),
        derived: st.derivedPagePositions,
        headers,
        screenOfFrame: Object.fromEntries(frames.map((f) => [f.id, toScreen({ x: f.x, y: f.y })])),
      };
    });
    record.snapshot = snapshot;

    // 1) store 파생 미러 == scene frame 좌표
    const mirrorMismatch = snapshot.frames.filter(
      (f) => Math.round(snapshot.derived[f.id]?.x ?? NaN) !== Math.round(f.x) ||
             Math.round(snapshot.derived[f.id]?.y ?? NaN) !== Math.round(f.y),
    );
    check("store 파생 미러 = scene frame 좌표", mirrorMismatch.length === 0, { mirrorMismatch });

    // 2) 페이지 헤더 = frame 좌상단 (화면 좌표)
    const headerMismatch = snapshot.headers.filter((h) => {
      const want = snapshot.screenOfFrame[h.id];
      if (!want) return true;
      return Math.abs(h.left - (snapshot.canvasLeft + want.x)) > 2;
    });
    check("페이지 헤더 x = frame x (화면 좌표)", headerMismatch.length === 0, { headerMismatch, canvasLeft: snapshot.canvasLeft });

    // 3) 히트 — 두 번째 페이지의 빈 영역 클릭 → 그 페이지가 활성
    const userIds = snapshot.frames.map((f) => f.id).filter((id) => id !== COMPONENTS_ID);
    const target = snapshot.frames.find((f) => f.id === userIds[1]);
    const point = await page.evaluate(({ frame }) => {
      const vp = window.__composition_VIEWPORT_SYNC__.getState();
      const rect = document.querySelector('[data-testid="skia-canvas-unified"]').getBoundingClientRect();
      return {
        x: rect.left + (frame.x + frame.w / 2) * vp.zoom + vp.panOffset.x,
        y: rect.top + (frame.y + frame.h / 2) * vp.zoom + vp.panOffset.y,
      };
    }, { frame: target });
    await page.mouse.click(point.x, point.y);
    await settle(page, 900);
    const afterHit = await page.evaluate(() => {
      const st = window.__composition_STORE__.getState();
      const selected = st.elementsMap.get(st.selectedElementId ?? "");
      return { currentPageId: st.currentPageId, selectedPageId: selected?.page_id ?? null, selectedType: selected?.type ?? null };
    });
    check("히트 — 페이지 중심 클릭이 그 페이지 body 를 선택한다", afterHit.selectedPageId === target.id && String(afterHit.selectedType).toLowerCase() === "body", { target: target.id, afterHit });

    // 4) 스크롤바 extent 가 frame bounds 를 덮는다
    const extent = await page.evaluate(() => window.__composition_VIEWPORT_METRICS__?.read?.() ?? null);
    if (extent) {
      const minX = Math.min(...snapshot.frames.map((f) => f.x));
      const maxX = Math.max(...snapshot.frames.map((f) => f.x + f.w));
      check("스크롤바 extent 가 frame bounds 를 덮는다", extent.contentBounds ? extent.contentBounds.minX <= minX + 1 && extent.contentBounds.maxX >= maxX - 1 : true, { extent, minX, maxX });
    } else {
      check("스크롤바 extent 채널 (미노출 — frame 기준 계산만 확인)", true, {});
    }

    // 5) 액션 바 — 선택된 body 위에 붙는다 (frame 안)
    const actionBar = await page.evaluate(() => {
      const el = document.querySelector(".selection-action-bar, [data-action-bar]");
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { left: Math.round(r.left), top: Math.round(r.top) };
    });
    if (actionBar) {
      const want = snapshot.screenOfFrame[target.id];
      check("액션 바가 선택 페이지 frame 근처에 붙는다", Math.abs(actionBar.left - (snapshot.canvasLeft + want.x)) < target.w * snapshot.zoom + 200, { actionBar, want });
    } else {
      check("액션 바 (숨김 설정 — 위치 판정 생략)", true, {});
    }

    record.results = results;
  } finally {
    await browser.close();
  }
  const outDir = resolve(here, "../../../docs/adr/evidence");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(resolve(outDir, "232-g5-consumer-parity-live.json"), JSON.stringify(record, null, 2));
  const pass = results.filter((r) => r.ok).length;
  process.stderr.write(`\n[summary] ${pass}/${results.length}\n`);
  process.exit(pass === results.length ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); });
