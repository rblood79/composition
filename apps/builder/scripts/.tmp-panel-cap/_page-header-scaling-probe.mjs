// PAGE_HEADER_DOM_LAYER_SCALING_2026-09.md §4-1 — 페이지 헤더 DOM 층 V 확장 계측.
//   node page-header-scaling-probe.mjs --pages 200 --zoom 0.1 --out <dir> [--drag-ms 3000] [--pan-ms 3000]
// (a) 헤더 층 MutationObserver — attributes 와 childList 를 나눠 센다 (수평 휠 pan 중)
// (b) CDP LayerTree — 합성 레이어 수 · .page-header 귀속 레이어 수 · 텍스처 바이트 추정 (w*h*4)
// (c) 페이지 드래그 3s — render.frame p95 · callback gap p95 · 할당 · 드래그 중 헤더 attribute 쓰기 수
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";
import {
  loadStorageState,
  createInstrumentedContext,
  createIsolatedProject,
  openPanels,
  seedDocument,
  RECORDER_SCRIPT,
  summarizeRecording,
  wheelBurst,
} from "/Users/admin/work/composition/apps/builder/scripts/perf-baseline.mjs";

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : def;
};
const pages = Number(opt("--pages", "22"));
const zoom = opt("--zoom", null) === null ? null : Number(opt("--zoom"));
const out = resolve(opt("--out", "/private/tmp/perf-baseline/hdr200"));
const dragMs = Number(opt("--drag-ms", "3000"));
const panMs = Number(opt("--pan-ms", "3000"));
const baseUrl = "http://localhost:5173";
mkdirSync(out, { recursive: true });

const OBSERVER_SCRIPT = `(() => {
  window.__hdrObs = {
    start() {
      const layer = document.querySelector(".page-header-layer");
      if (!layer) throw new Error(".page-header-layer 없음");
      const c = { layerAttr: 0, headerAttr: 0, headerAttrByName: {}, childAdded: 0, childRemoved: 0, childListRecords: 0, other: 0 };
      const mo = new MutationObserver((records) => {
        for (const r of records) {
          if (r.type === "childList") {
            c.childListRecords += 1;
            for (const n of r.addedNodes) if (n.nodeType === 1 && n.classList?.contains("page-header")) c.childAdded += 1;
            for (const n of r.removedNodes) if (n.nodeType === 1 && n.classList?.contains("page-header")) c.childRemoved += 1;
          } else if (r.type === "attributes") {
            if (r.target === layer) c.layerAttr += 1;
            else if (r.target.classList?.contains("page-header")) { c.headerAttr += 1; c.headerAttrByName[r.attributeName] = (c.headerAttrByName[r.attributeName] || 0) + 1; }
            else c.other += 1;
          } else c.other += 1;
        }
      });
      mo.observe(layer, { attributes: true, childList: true, subtree: true });
      this._stop = () => { mo.takeRecords().length; mo.disconnect(); return c; };
    },
    stop() { const c = this._stop(); return c; },
  };
})();`;

const headerCount = (page) =>
  page.evaluate(() => ({
    mounted: document.querySelectorAll(".page-header").length,
    hidden: document.querySelector(".page-header-layer")?.hasAttribute("data-hidden") ?? null,
    allPages: window.__composition_STORE__.getState().pages.length,
    viewport: window.__composition_VIEWPORT__?.() ?? null,
  }));

async function layerTree(cdp, page) {
  await cdp.send("DOM.enable");
  const doc = await cdp.send("DOM.getDocument", { depth: 0 });
  const { nodeIds } = await cdp.send("DOM.querySelectorAll", { nodeId: doc.root.nodeId, selector: ".page-header" });
  const headerBackend = new Set();
  for (const nodeId of nodeIds) {
    const { node } = await cdp.send("DOM.describeNode", { nodeId });
    headerBackend.add(node.backendNodeId);
  }
  let latest = null;
  const onChange = (e) => { latest = e.layers; };
  cdp.on("LayerTree.layerTreeDidChange", onChange);
  await cdp.send("LayerTree.enable");
  // 트리 갱신을 한 번 유도
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  const t0 = Date.now();
  while (!latest && Date.now() - t0 < 5000) await page.waitForTimeout(100);
  cdp.off("LayerTree.layerTreeDidChange", onChange);
  await cdp.send("LayerTree.disable");
  if (!latest) return { error: "layerTreeDidChange 미수신" };
  const layers = latest;
  const drawing = layers.filter((l) => l.drawsContent);
  const header = layers.filter((l) => headerBackend.has(l.backendNodeId));
  const bytes = (ls) => ls.reduce((s, l) => s + l.width * l.height * 4, 0);
  return {
    total: layers.length,
    drawsContent: drawing.length,
    headerLayers: header.length,
    headerNodes: headerBackend.size,
    headerDrawsContent: header.filter((l) => l.drawsContent).length,
    textureBytesAllDrawing: bytes(drawing),
    textureBytesHeader: bytes(header.filter((l) => l.drawsContent)),
    headerSample: header.slice(0, 3).map((l) => ({ w: l.width, h: l.height, draws: l.drawsContent })),
  };
}

async function main() {
  const storageState = loadStorageState("/Users/admin/work/composition/apps/builder/scripts/.auth-session.json");
  const browser = await chromium.launch({ channel: "chrome", headless: false });
  const result = { pages, zoom, at: new Date().toISOString() };
  try {
    const { page, cdp, pageErrors, consoleErrors } = await createInstrumentedContext(browser, {
      storageState,
      cpuThrottle: 1,
      frameCapture: false,
      initScript: null,
      onPageError: (e) => process.stderr.write(`[pageerror] ${e}\n`),
    });
    await cdp.send("Performance.enable", { timeDomain: "timeTicks" });
    const project = await createIsolatedProject(page, baseUrl);
    process.stderr.write(`[boot] ${project.projectUrl}\n`);
    await openPanels(page, ["navigator", "properties"]);
    const seed = await seedDocument(page, 60, "mixed", pages);
    process.stderr.write(`[seed] elements ${seed.seedIds.length} · pages ${seed.pageIds.length}\n`);
    if (zoom !== null) {
      await page.evaluate(async (scale) => {
        window.__composition_APPLY_VIEWPORT__({ scale, x: 40, y: 80 });
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      }, zoom);
    }
    await page.waitForTimeout(1500);
    result.settled = await headerCount(page);
    process.stderr.write(`[V] ${JSON.stringify(result.settled)}\n`);

    // (b) 합성 레이어
    result.layerTree = await layerTree(cdp, page);
    process.stderr.write(`[layers] ${JSON.stringify(result.layerTree)}\n`);

    await page.addScriptTag({ content: RECORDER_SCRIPT });
    await page.addScriptTag({ content: OBSERVER_SCRIPT });

    // (a) 수평 휠 pan — attributes vs childList
    await page.evaluate(() => window.__hdrObs.start());
    await page.evaluate((o) => window.__perfRecorder.start(o), { profile: false, instrumentation: "on" });
    await wheelBurst(page, panMs, "return { deltaX: (Math.floor(i / 40) % 2 ? -1 : 1) * 24, deltaY: 0 };", false);
    const panRec = await page.evaluate(() => window.__perfRecorder.stop());
    await page.waitForTimeout(400); // 제스처 종료 → gate off → placeAll 1회 포함
    result.panMutations = await page.evaluate(() => window.__hdrObs.stop());
    result.pan = summarizeRecording(panRec);
    delete result.pan.raw;
    result.afterPan = await headerCount(page);
    process.stderr.write(`[pan] mut ${JSON.stringify(result.panMutations)} · gap p95 ${result.pan.gapP95} · render.frame p95 ${result.pan.renderFrame?.p95}\n`);

    // (a') 수직 휠 pan — 6열 격자에서 행 전환이 가시 집합을 더 자주 바꾼다
    await page.evaluate(() => window.__hdrObs.start());
    await wheelBurst(page, panMs, "return { deltaX: 0, deltaY: (Math.floor(i / 40) % 2 ? -1 : 1) * 24 };", false);
    await page.waitForTimeout(400);
    result.panVerticalMutations = await page.evaluate(() => window.__hdrObs.stop());
    process.stderr.write(`[pan-v] mut ${JSON.stringify(result.panVerticalMutations)}\n`);

    // (c) 페이지 드래그 — 카메라를 시작 상태로 되돌린 뒤 첫 페이지 헤더를 잡고 좌우 왕복
    await page.evaluate(async (scale) => {
      window.__composition_APPLY_VIEWPORT__({ scale, x: 40, y: 80 });
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    }, zoom ?? 1);
    await page.waitForTimeout(800);
    const box = await page.evaluate(() => {
      // 떠 있는 패널 아래 헤더는 히트가 안 된다 — elementFromPoint 가 자기 자신인 첫 헤더를 고른다
      for (const el of document.querySelectorAll(".page-header")) {
        const title = el.querySelector(".page-header__title");
        if (!title) continue;
        const r = title.getBoundingClientRect();
        if (r.width < 4) continue;
        const x = r.left + Math.min(r.width / 2, 12);
        const y = r.top + r.height / 2;
        const hit = document.elementFromPoint(x, y);
        if (hit === title)
          return { x, y, w: r.width, h: r.height, pageId: el.getAttribute("data-page-id"), hit: `${hit.tagName.toLowerCase()}.${hit.className}` };
      }
      return null;
    });
    if (!box) throw new Error("히트 가능한 page header 없음");
    process.stderr.write(`[drag-target] ${JSON.stringify(box)}\n`);
    await page.evaluate(() => window.__hdrObs.start());
    await page.mouse.move(box.x, box.y);
    await page.evaluate((o) => window.__perfRecorder.start(o), { profile: true, instrumentation: "on" });
    await page.mouse.down();
    const t0 = Date.now();
    let i = 0;
    let moves = 0;
    while (Date.now() - t0 < dragMs) {
      const phase = Math.floor(i / 60) % 2 ? -1 : 1;
      await page.mouse.move(box.x + phase * (i % 60) * 4, box.y + ((i % 30) - 15) * 2);
      moves += 1;
      i += 1;
    }
    await page.mouse.up();
    const dragRec = await page.evaluate(() => window.__perfRecorder.stop());
    await page.waitForTimeout(400);
    result.dragMutations = await page.evaluate(() => window.__hdrObs.stop());
    result.drag = summarizeRecording(dragRec);
    delete result.drag.raw;
    result.drag.moves = moves;
    result.drag.profile = dragRec.profile;
    result.afterDrag = await headerCount(page);
    process.stderr.write(`[drag] moves ${moves} · mut ${JSON.stringify(result.dragMutations)} · gap p95 ${result.drag.gapP95} · render.frame p95 ${result.drag.renderFrame?.p95} · alloc ${result.drag.allocMBps} MB/s\n`);
    if (dragRec.profile) process.stderr.write(`[drag-profile] app top ${JSON.stringify(dragRec.profile.app.slice(0, 6))}\n`);

    result.errors = { page: pageErrors.length, console: consoleErrors.length, sample: [...pageErrors, ...consoleErrors].slice(0, 5) };
    const file = resolve(out, `hdr-probe-p${pages}-z${zoom ?? "default"}-${Date.now()}.json`);
    writeFileSync(file, JSON.stringify(result, null, 2));
    process.stderr.write(`[out] ${file}\n`);
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  process.stderr.write(`[fail] ${e?.stack ?? e}\n`);
  process.exit(1);
});
