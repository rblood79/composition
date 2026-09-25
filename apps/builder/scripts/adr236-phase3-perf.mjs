// ADR-236 Phase 3 G4 — canOperate 비용 (호출당 · 선택 변경당).
// headed Playwright · 격리 컨텍스트 프로젝트 (사용자 대시보드 오염 없음) · 600 요소 시드 (perf-baseline 과 같은 fixture).
// 측정은 페이지 안에서 Vite dev 가 제공하는 소스 모듈을 직접 import 해 실제 store 문서로 잰다.
// 대조군 = 종전 관문 (selectableWithoutBody: synthetic · 조회 · body) 을 같은 데이터로 인라인 실행.
// 사용: node apps/builder/scripts/adr236-phase3-perf.mjs  →  output/playwright/adr236/phase3-perf.json
import { chromium } from "playwright";
import { resolve } from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { createIsolatedProject, seedDocument } from "./perf-baseline.mjs";

const OUT = "output/playwright/adr236";
await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({ headless: false });
const context = await browser.newContext({
  storageState: resolve("apps/builder/scripts/.auth-session.json"),
  viewport: { width: 1440, height: 900 },
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));

try {
  await createIsolatedProject(page, "http://localhost:5173");
  await page.bringToFront();
  await seedDocument(page, 600, "mixed");
  await page.waitForTimeout(3000);

  const result = await page.evaluate(async () => {
    const canOperateModule = await import("/src/builder/domain/canOperate.ts");
    const menuModule =
      await import("/src/builder/workspace/canvas/contextMenu/canvasContextMenuProviders.ts");
    const bodyModule = await import(
      "/@fs" +
        "/Users/admin/work/composition/packages/shared/src/domain/predicates.ts"
    ).catch(() => null);
    const state = window.__composition_STORE__.getState();
    const map = state.elementsMap;
    const ids = state.elements
      .filter((e) => e.page_id === state.currentPageId && e.type !== "body")
      .map((e) => e.id);
    const lookup = (id) => map.get(id);
    const OPS = [
      "delete",
      "copy",
      "duplicate",
      "group",
      "ungroup",
      "detach",
      "toggleOrigin",
      "move",
    ];
    const p95 = (values) => {
      const sorted = [...values].sort((a, b) => a - b);
      return sorted[
        Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1)
      ];
    };
    const RUNS = 30;

    // 호출당: op 마다 600 id 를 한 번에 판정한 시간 / id 수 — 개별 호출은 타이머 해상도 아래다.
    const perCall = {};
    for (const op of OPS) {
      const samples = [];
      for (let r = 0; r < RUNS; r++) {
        const t0 = performance.now();
        for (const id of ids) canOperateModule.canOperate(op, id, lookup);
        samples.push((performance.now() - t0) / ids.length);
      }
      perCall[op] = {
        p95Ms: p95(samples),
        meanMs: samples.reduce((a, b) => a + b, 0) / RUNS,
      };
    }

    // 선택 변경당: 메뉴 · 액션 바가 선택마다 조립하는 항목 판정 (전체 선택 = 최악).
    const menuSamples = [];
    for (let r = 0; r < RUNS; r++) {
      const t0 = performance.now();
      menuModule.buildCanvasContextMenuItems(
        {
          clientX: 0,
          clientY: 0,
          surface: "canvas-element",
          targetElementIds: ids,
        },
        { getInteractiveElementsMap: () => map },
      );
      menuSamples.push(performance.now() - t0);
    }
    // 그 조립 안의 판정 몫만: selectOperable 6 op × 선택 + 단일 대상 3 op (메뉴가 부르는 그대로).
    const judgeSamples = [];
    for (let r = 0; r < RUNS; r++) {
      const t0 = performance.now();
      for (const op of ["copy", "duplicate", "delete", "move", "group"]) {
        canOperateModule.filterOperable(op, ids, lookup);
      }
      for (const op of ["ungroup", "toggleOrigin", "detach"]) {
        canOperateModule.canOperate(op, ids[0], lookup);
      }
      judgeSamples.push(performance.now() - t0);
    }
    // 대조군: 종전 관문 (selectableWithoutBody) — 메뉴가 선택마다 1 번 불렀다.
    const isBody = (type) =>
      bodyModule?.isBodyType
        ? bodyModule.isBodyType(type)
        : typeof type === "string" && type.toLowerCase() === "body";
    const controlSamples = [];
    for (let r = 0; r < RUNS; r++) {
      const t0 = performance.now();
      ids.filter((id) => {
        if (id.includes("/") && !id.startsWith("projection:")) return false;
        const element = map.get(id);
        return element !== undefined && !isBody(element.type);
      });
      controlSamples.push(performance.now() - t0);
    }

    return {
      elements: ids.length,
      visibilityState: document.visibilityState,
      perCall,
      perSelectionChange: {
        menuBuildP95Ms: p95(menuSamples),
        canOperateShareP95Ms: p95(judgeSamples),
        controlOldGateP95Ms: p95(controlSamples),
      },
    };
  });
  const report = { ...result, errors, headed: true };
  await writeFile(`${OUT}/phase3-perf.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
}
