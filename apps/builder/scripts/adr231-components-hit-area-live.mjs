// ADR-231 후속 live — Components 페이지의 **선택/히트 영역 = 페이지 frame** (사용자 보고 2026-09-23).
//   node apps/builder/scripts/adr231-components-hit-area-live.mjs [--base-url http://localhost:5173]
// Components 페이지는 breakpoint 를 읽지 않는다 (frame = 1920 × 발행 body 높이, floor 1080).
// 그런데 빈 영역 히트는 `readPageFrameSize` 를 neutral 옵션 없이 불러 활성 breakpoint 크기를
// 썼다 — mobile 에서 390×844 밖을 누르면 그려진 페이지 안인데도 선택이 안 됐다.
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
const baseUrl = opt("--base-url", "http://localhost:5173");

const results = [];
const check = (name, ok, detail) => {
  results.push({ name, ok, detail });
  process.stderr.write(
    `${ok ? "PASS" : "FAIL"} ${name}${detail ? " — " + JSON.stringify(detail) : ""}\n`,
  );
};
const settle = (page, ms = 900) => page.waitForTimeout(ms);

const ZOOM = 0.2;
const PAN = { x: 700, y: 300 };

const readState = (page) =>
  page.evaluate(() => {
    const st = window.__composition_STORE__.getState();
    const comp = st.pages.find(
      (p) => p.pageRole === "components" || p.id === "page-components",
    );
    const f = window.__composition_SCENE_DEBUG__
      .readPageFrames()
      .find((x) => x.id === comp?.id);
    return {
      activeBreakpoint: st.activeBreakpoint,
      compId: comp?.id ?? null,
      frame: f
        ? {
            x: Math.round(f.x),
            y: Math.round(f.y),
            w: Math.round(f.width),
            h: Math.round(f.height),
          }
        : null,
      selected: st.selectedElementId,
      selectedInfo: (() => {
        const id = st.selectedElementId;
        if (!id) return null;
        const el = st.elements?.find?.((e) => e.id === id) ?? null;
        return el
          ? { type: el.type, page: el.page_id }
          : { type: "?", page: "?" };
      })(),
      currentPageId: st.currentPageId,
      allFrames: window.__composition_SCENE_DEBUG__
        .readPageFrames()
        .map((x) => ({
          id: x.id.slice(0, 8),
          x: Math.round(x.x),
          y: Math.round(x.y),
          w: Math.round(x.width),
          h: Math.round(x.height),
        })),
      storePos: Object.fromEntries(
        Object.entries(st.derivedPagePositions).map(([k, v]) => [
          k.slice(0, 8),
          [Math.round(v.x), Math.round(v.y)],
        ]),
      ),
    };
  });

/**
 * scene 좌표 → 브라우저 client 좌표.
 *
 * 캔버스 요소의 bounding rect 를 **페이지 안에서** 읽어 더한다 — 요소 기준 좌표로 클릭하면
 * 툴바·패널이 만드는 오프셋만큼 어긋난다 (첫 시도에서 엉뚱한 페이지가 잡혔다).
 */
const toClient = (page, scene) =>
  page.evaluate((s) => {
    const c = document.querySelector("canvas");
    const r = c.getBoundingClientRect();
    // 카메라는 **지금 값**을 읽는다 — breakpoint 를 바꾸면 앱이 다시 pan 한다 (상수로 두면
    //   두 번째 breakpoint 부터 클릭이 옆 페이지로 샌다).
    const v = window.__composition_VIEWPORT__();
    const pan = v.panOffset ?? { x: 0, y: 0 };
    return {
      x: r.left + pan.x + s.x * v.zoom,
      y: r.top + pan.y + s.y * v.zoom,
      zoom: v.zoom,
      pan,
    };
  }, scene);

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
    await settle(page, 3000);
    await openPanels(page, ["Navigator"]);

    const compId = await page.evaluate(() => {
      const st = window.__composition_STORE__.getState();
      const c = st.pages.find(
        (p) => p.pageRole === "components" || p.id === "page-components",
      );
      st.activatePage?.(c.id);
      return c.id;
    });
    await settle(page, 1500);
    await page.evaluate(
      ({ z, p }) => window.__composition_APPLY_VIEWPORT__({ scale: z, ...p }),
      { z: ZOOM, p: PAN },
    );
    await settle(page, 1000);

    for (const bp of ["desktop", "tablet", "mobile"]) {
      // breakpoint 전환은 툴바 버튼으로 — store setter 는 값만 바꾸고 재레이아웃을
      //   부르지 않는다 (BuilderCore bridge 가 invalidateLayout 소유, canvasSettings.ts:357).
      await page
        .locator(".builder-control-group button")
        .nth({ desktop: 0, tablet: 1, mobile: 2 }[bp])
        .click();
      await settle(page, 1500);
      const st = await readState(page);
      check(
        `${bp} — Components frame 은 breakpoint 와 무관 (1920 폭)`,
        st.frame?.w === 1920,
        { frame: st.frame },
      );

      // 선택 해제 후, mobile 뷰포트 (390×844) 밖이지만 frame 안인 지점을 누른다.
      const cleared = await page.evaluate(() => {
        const st = window.__composition_STORE__.getState();
        const names = Object.keys(st).filter((k) => /select/i.test(k));
        st.setSelectedElement?.(null);
        st.clearSelection?.();
        return {
          names,
          after: window.__composition_STORE__.getState().selectedElementId,
        };
      });
      await settle(page, 500);
      process.stderr.write(`[clear ${bp}] ${JSON.stringify(cleared)}\n`);
      // 오른쪽 아래 빈 여백 — mobile 390 · tablet 768 폭 밖이고 844 높이 밖이지만
      //   frame (1920 × 발행 높이) 안이다. 요소가 없는 자리라 body 히트로만 잡힌다.
      const target = await toClient(page, {
        // 오른쪽 여백 — breakpoint 폭 (390·768) 밖이고 frame (1920) 안. 경계에서 200 world px
        //   안쪽을 잡는다: 프레임 오른쪽 끝은 Home 과 gap 80 뿐이라 zoom 0.2 에서 16px 틈이고,
        //   pan 오차 한 번에 옆 페이지로 넘어간다 (첫 시도에서 Home body 가 잡혔다).
        x: st.frame.x + st.frame.w - 200,
        y: st.frame.y + 1000, // mobile 844 · tablet 1024 높이 밖
      });
      record.steps.push({ step: `${bp}-click`, frame: st.frame, target });
      await page.mouse.click(target.x, target.y);
      await settle(page, 900);
      const after = await readState(page);
      check(
        `${bp} — frame 오른쪽 아래 빈 여백 클릭이 Components body 를 고른다`,
        after.selected === `${compId}-body`,
        {
          selected: after.selected,
          info: after.selectedInfo,
          frames: after.allFrames,
          store: after.storePos,
          target,
        },
      );
    }
  } finally {
    await browser.close();
  }

  const dir = resolve(here, "../../../docs/adr/evidence");
  mkdirSync(dir, { recursive: true });
  record.results = results;
  writeFileSync(
    resolve(dir, "231-components-hit-area-live.json"),
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
