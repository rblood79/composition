#!/usr/bin/env node
/**
 * ADR-190 Phase 2 / G2 — structure commit 의 sparse lane 진입과 렌더 정합성.
 *
 * style 축(G1)과 판정 기준이 다르다. structure 는 트리 모양을 바꾸므로,
 * "빨라졌는가" 보다 **추가한 노드가 실제로 그려지고 삭제한 노드가 사라지는가**
 * 가 먼저다. 누락은 성능 저하가 아니라 요소 소실·유령 노드로 나타난다.
 *
 * 시나리오 2종:
 *  - deep: 5,000-node 문서 안의 **작은 컨테이너**에 추가/삭제 (실사용 형태)
 *  - shallow: 자식이 매우 많은 body 에 직접 추가 (sparse 이득이 없을 수 있는
 *    최악 케이스 — dirty root 가 body 라 affected subtree 가 문서 전체)
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";

const BASE_URL = process.env.ADR190_BASE_URL ?? "http://localhost:5173";
const OUT = process.env.ADR190_OUT ?? "/private/tmp/adr190-phase2-g2.json";
const DOC_SIZE = Number(process.env.ADR190_DOC ?? "1000");

const browser = await chromium.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true,
  args: ["--no-sandbox", "--disable-gpu"],
});
const context = await browser.newContext({
  storageState: JSON.parse(
    readFileSync(resolve("apps/builder/scripts/.auth-session.json"), "utf8"),
  ),
  viewport: { width: 1440, height: 900 },
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});

const settle = (n = 6) =>
  page.evaluate(
    (frames) =>
      new Promise((done) => {
        let remaining = frames;
        const step = () => {
          remaining -= 1;
          if (remaining <= 0) done();
          else requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      }),
    n,
  );

await page.goto(`${BASE_URL}/dashboard`, { waitUntil: "networkidle" });
const projectName = `adr190-struct-${Date.now()}`;
await page.getByLabel("New project name").fill(projectName);
await page.locator('form.new-project-form button[type="submit"]').click();
await page.waitForURL(/\/builder\/[^/?]+$/, { timeout: 30000 });
await page.goto(`${page.url()}?adr187Metrics=1&adr189Metrics=1`, {
  waitUntil: "networkidle",
});
await page.waitForFunction(
  () =>
    Boolean(
      window.__composition_STORE__ && window.__composition_COMMIT_LANE_DEBUG__,
    ),
  undefined,
  { timeout: 30000 },
);
await page.waitForTimeout(2500);

// 큰 문서 + 그 안의 작은 컨테이너를 만든다.
await page.evaluate(async (docSize) => {
  const store = window.__composition_STORE__;
  const st = store.getState();
  const body = st.elements.find(
    (e) => e.page_id === st.currentPageId && e.type === "body",
  );
  const mk = (i, id, parentId) => ({
    id,
    type: "frame",
    parent_id: parentId,
    page_id: st.currentPageId,
    order_num: 100 + i,
    props: {
      style: {
        backgroundColor: "#4A6CF7",
        height: "10px",
        left: `${(i % 40) * 12}px`,
        position: "absolute",
        top: `${Math.floor(i / 40) * 12 + 200}px`,
        width: "10px",
      },
    },
  });
  // 작은 컨테이너 (deep 시나리오의 부모)
  const container = {
    id: "adr190-container",
    type: "frame",
    parent_id: body.id,
    page_id: st.currentPageId,
    order_num: 50,
    props: {
      style: {
        backgroundColor: "#35B85A",
        height: "120px",
        left: "20px",
        position: "absolute",
        top: "30px",
        width: "200px",
      },
    },
  };
  await st.addComplexElement(
    container,
    Array.from({ length: docSize - 1 }, (_, i) =>
      mk(i + 1, `adr190-doc-${i + 1}`, body.id),
    ),
  );
}, DOC_SIZE);
await page.waitForTimeout(3000);
await page.evaluate(() =>
  window.__composition_STORE__.getState().setSelectedElement(null),
);
await settle(8);

const runStructure = (kind, parentKey, index) =>
  page.evaluate(
    async ({ k, parentSel, i }) => {
      const store = window.__composition_STORE__;
      window.__composition_COMMIT_LANE_DEBUG__.reset();
      window.__composition_STORE_COMMIT_SINK_DEBUG__?.reset();
      window.__composition_PERF__.reset();

      const st = store.getState();
      const body = st.elements.find(
        (e) => e.page_id === st.currentPageId && e.type === "body",
      );
      const parentId = parentSel === "container" ? "adr190-container" : body.id;
      const nodeId = `adr190-${parentSel}-add-${i}`;

      if (k === "add") {
        await st.addElement({
          id: nodeId,
          type: "frame",
          parent_id: parentId,
          page_id: st.currentPageId,
          order_num: 5000 + i,
          props: {
            style: {
              backgroundColor: "#E0417A",
              height: "24px",
              left: `${20 + i * 30}px`,
              position: "absolute",
              top: "40px",
              width: "24px",
            },
          },
        });
      } else {
        await store.getState().removeElement(nodeId);
      }
      await new Promise((r) => {
        let n = 6;
        const step = () => (--n <= 0 ? r() : requestAnimationFrame(step));
        requestAnimationFrame(step);
      });

      const debug = window.__composition_COMMIT_LANE_DEBUG__.snapshot();
      const after = store.getState();
      // 실제로 그려지는지: Skia registry 등록 여부로 판정한다. registry 에
      // 없으면 command stream 이 그 노드를 방문하지 않는다.
      const skiaNode =
        window.__composition_SKIA_DEBUG__?.getSkiaNode?.(nodeId) ?? null;
      const inSkia = Boolean(skiaNode);
      return {
        kind: k,
        parent: parentSel,
        nodeId,
        inStore: after.elementsMap.has(nodeId),
        inSkia,
        sink: window.__composition_STORE_COMMIT_SINK_DEBUG__?.read() ?? null,
        queueCount: debug.queueCount,
        patchSuccessCount: debug.patchSuccessCount,
        patchFallbackCount: debug.patchFallbackCount,
        fullBuildCount: debug.buildMetrics.filter((m) => !m.subtree).length,
        subtreeBuildCount: debug.buildMetrics.filter((m) => m.subtree).length,
        framePerf: window.__composition_PERF__.snapshot("render.frame"),
      };
    },
    { k: kind, parentSel: parentKey, i: index },
  );

const results = { deepAdd: [], deepRemove: [], shallowAdd: [] };
for (let i = 0; i < 4; i += 1) {
  results.deepAdd.push(await runStructure("add", "container", i));
  await settle(4);
}
for (let i = 0; i < 4; i += 1) {
  results.deepRemove.push(await runStructure("remove", "container", i));
  await settle(4);
}
for (let i = 0; i < 4; i += 1) {
  results.shallowAdd.push(await runStructure("add", "body", i));
  await settle(4);
}

const summarize = (rows) => ({
  runs: rows.length,
  queueTotal: rows.reduce((s, r) => s + r.queueCount, 0),
  patchSuccessTotal: rows.reduce((s, r) => s + r.patchSuccessCount, 0),
  fallbackTotal: rows.reduce((s, r) => s + r.patchFallbackCount, 0),
  fullBuildTotal: rows.reduce((s, r) => s + r.fullBuildCount, 0),
  sinkPublished: rows.reduce((s, r) => s + (r.sink?.published ?? 0), 0),
  sinkDelivered: rows.reduce((s, r) => s + (r.sink?.delivered ?? 0), 0),
  framePeakP95: Math.max(...rows.map((r) => r.framePerf?.p95 ?? 0)),
  // 렌더 정합성: add 는 store+hitBounds 둘 다 있어야, remove 는 둘 다 없어야 한다.
  renderParityOk: rows.every((r) =>
    r.kind === "add" ? r.inStore && r.inSkia : !r.inStore && !r.inSkia,
  ),
});

const out = {
  capturedAt: new Date().toISOString(),
  browser: await browser.version(),
  docSize: DOC_SIZE,
  projectName,
  summary: {
    deepAdd: summarize(results.deepAdd),
    deepRemove: summarize(results.deepRemove),
    shallowAdd: summarize(results.shallowAdd),
  },
  results,
  errors,
};
writeFileSync(OUT, `${JSON.stringify(out, null, 2)}\n`);
console.log(
  JSON.stringify({ summary: out.summary, errors: errors.length }, null, 2),
);
await browser.close();
