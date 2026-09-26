// ADR-232 G0 — inventory freeze 실측 프로브 (headed Playwright).
//   node apps/builder/scripts/adr232-g0-inventory-probe.mjs [--base-url http://localhost:5173]
// (1) 부팅 순서: 페이지 frame (테두리) 이 엔진 wasm 준비 **전에** 그려지는가 (R3 실재 여부).
// (2) 로컬 IndexedDB 문서의 `pagePositions` 분류 — 칸 일치 / 손 배치 / breakpoint 상이.
//     격리 컨텍스트는 문서가 0 이므로 `--profile <dir>` 로 사용자 프로필을 쓰면 실제 문서를 센다.
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
const opt = (n, d) => {
  const i = args.indexOf(n);
  return i >= 0 ? args[i + 1] : d;
};
const baseUrl = opt("--base-url", process.env.BUILDER_URL ?? "http://localhost:5173");

// 부팅 계측 — 앱 스크립트보다 먼저 실행돼 frame 첫 관측과 engine ready 시점을 기록한다.
const BOOT_PROBE = `
window.__ADR232_BOOT__ = {
  t0: performance.now(),
  firstFrameDataAt: null,   // pagePositions 기반 page frame 이 scene 에 처음 생긴 시각
  firstLayoutRectAt: null,  // 엔진이 레이아웃 rect 를 처음 발행한 시각 (wasm 준비 이후)
  bootingClearedAt: null,   // .builder-booting 해제 시각
  firstSkiaCanvasAt: null,  // Skia <canvas> DOM 등장 시각
};
(function () {
  const b = window.__ADR232_BOOT__;
  const now = () => performance.now() - b.t0;
  const iv = setInterval(() => {
    if (b.firstFrameDataAt === null) {
      try {
        const f = window.__composition_SCENE_DEBUG__ && window.__composition_SCENE_DEBUG__.readPageFrames();
        if (f && f.length > 0) b.firstFrameDataAt = now();
      } catch (e) {}
    }
    if (b.firstLayoutRectAt === null) {
      try {
        const m = window.__composition_LAYOUT_DEBUG__ && window.__composition_LAYOUT_DEBUG__.getSharedLayoutMap && window.__composition_LAYOUT_DEBUG__.getSharedLayoutMap();
        if (m && m.size > 0) b.firstLayoutRectAt = now();
      } catch (e) {}
    }
    if (b.firstSkiaCanvasAt === null && document.querySelector('[data-testid="skia-canvas-unified"]')) {
      b.firstSkiaCanvasAt = now();
    }
    if (b.bootingClearedAt === null && document.querySelector('.app:not(.builder-booting)')) {
      b.bootingClearedAt = now();
    }
  }, 8);
  setTimeout(() => clearInterval(iv), 30000);
})();
`;

const READ_DOCUMENTS_SRC = `(async () => {
  const names = await indexedDB.databases();
  const out = { databases: names.map((d) => d.name), documents: [] };
  const open = (name) => new Promise((res, rej) => {
    const r = indexedDB.open(name);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  const all = (store) => new Promise((res) => {
    const req = store.getAll();
    req.onsuccess = () => res(req.result || []);
    req.onerror = () => res([]);
  });
  for (const { name } of names) {
    let db;
    try { db = await open(name); } catch (e) { continue; }
    const has = (n) => db.objectStoreNames.contains(n);
    if (!has("documents") && !has("document_parts")) { db.close(); continue; }
    // 분할 저장 (document_parts.key === "document") 이 헤더 (pagePositions 포함) 를 갖는다.
    if (has("document_parts")) {
      const tx = db.transaction("document_parts", "readonly");
      const parts = await all(tx.objectStore("document_parts"));
      for (const row of parts) {
        if (row.key !== "document") continue;
        let header = null;
        try { header = JSON.parse(row.value); } catch (e) {}
        out.documents.push({
          db: name, source: "parts", key: row.project_id,
          pageCount: Array.isArray(header && header.children) ? header.children.length : null,
          pagePositions: (header && header.pagePositions) || null,
          hasPageLayout: Boolean(header && header.pageLayout),
        });
      }
    }
    if (has("documents")) {
      const tx = db.transaction("documents", "readonly");
      const rows = await all(tx.objectStore("documents"));
      for (const row of rows) {
        const doc = row && row.document ? row.document : row;
        if (out.documents.some((d) => d.key === row.project_id)) continue;
        out.documents.push({
          db: name, source: "legacy", key: String(row.project_id),
          pageCount: Array.isArray(doc && doc.children) ? doc.children.length : null,
          pagePositions: (doc && doc.pagePositions) || null,
          hasPageLayout: Boolean(doc && doc.pageLayout),
        });
      }
    }
    db.close();
  }
  return out;
})()`;

const readDocuments = (page) => page.evaluate(READ_DOCUMENTS_SRC);

// 좌표 집합 하나를 auto 격자와 대조한다 (pageWidth/gap 은 breakpoint 상수 · gap 기본 100).
function classifyTier(positions, pageWidth, gap) {
  const ids = Object.keys(positions);
  if (ids.length === 0) return { kind: "empty", n: 0 };
  const pts = ids.map((id) => ({ id, ...positions[id] }));
  const minX = Math.min(...pts.map((p) => p.x));
  const minY = Math.min(...pts.map((p) => p.y));
  const stride = pageWidth + gap;
  const offGrid = pts.filter((p) => {
    const dx = (p.x - minX) / stride;
    return Math.abs(dx - Math.round(dx)) * stride > 1;
  });
  return {
    kind: offGrid.length === 0 ? "on-grid" : "hand-placed",
    n: ids.length,
    offGrid: offGrid.map((p) => p.id),
    minX,
    minY,
  };
}

async function main() {
  const storageState = loadStorageState(resolve(here, ".auth-session.json"));
  const browser = await chromium.launch({ channel: "chrome", headless: false });
  const report = { baseUrl, at: new Date().toISOString() };
  try {
    const { page } = await createInstrumentedContext(browser, {
      storageState,
      cpuThrottle: 1,
      frameCapture: false,
      initScript: BOOT_PROBE,
      onPageError: (e) => process.stderr.write(`[pageerror] ${e}\n`),
    });
    const project = await createIsolatedProject(page, baseUrl);
    process.stderr.write(`[boot] ${project.projectUrl}\n`);
    await page.waitForTimeout(6000);
    report.boot = await page.evaluate(() => window.__ADR232_BOOT__);
    const docs = await readDocuments(page);
    const CANVAS = { desktop: 1920, tablet: 768, mobile: 390 };
    report.documents = docs.documents.map((d) => {
      if (!d.pagePositions) return { ...d, tiers: null };
      const byTier = {};
      for (const [pageId, byBp] of Object.entries(d.pagePositions)) {
        for (const [bp, pos] of Object.entries(byBp || {})) {
          if (!pos) continue;
          (byTier[bp] ??= {})[pageId] = pos;
        }
      }
      const tiers = {};
      for (const [bp, positions] of Object.entries(byTier)) {
        tiers[bp] = classifyTier(positions, CANVAS[bp] ?? 1920, 100);
      }
      // breakpoint 상이 = 같은 페이지의 (x−minX, y−minY) 가 tier 마다 다른가
      const tierNames = Object.keys(byTier);
      let tierDiffers = false;
      if (tierNames.length > 1) {
        const norm = (bp) => {
          const p = byTier[bp];
          const ids = Object.keys(p).sort();
          const minX = Math.min(...ids.map((i) => p[i].x));
          const minY = Math.min(...ids.map((i) => p[i].y));
          return ids
            .map((i) => `${i}:${p[i].x - minX},${p[i].y - minY}`)
            .join("|");
        };
        const first = norm(tierNames[0]);
        tierDiffers = tierNames.slice(1).some((bp) => norm(bp) !== first);
      }
      return { ...d, tiers, tierDiffers };
    });
    report.databases = docs.databases;
  } finally {
    await browser.close();
  }
  const outDir = resolve(here, "../../../docs/adr/evidence");
  mkdirSync(outDir, { recursive: true });
  const out = resolve(outDir, "232-g0-inventory-probe.json");
  writeFileSync(out, JSON.stringify(report, null, 2));
  process.stderr.write(`[out] ${out}\n`);
  console.log(JSON.stringify(report, null, 2));
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
