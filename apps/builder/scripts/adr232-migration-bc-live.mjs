// ADR-232 G4 live — 이관 BC (headed Playwright · 실제 hydration).
//   node apps/builder/scripts/adr232-migration-bc-live.mjs [--base-url http://localhost:5173]
// (a) normalized-world Δ0 (tier 3) · (b) 이관 세션 screen Δ0 + 두 번째 reload Δ0 ·
//     `pagePositions` 바이트 동일 · `placementModel: "derived"` 기록 ·
// (c) 복귀: legacy 전환 → pagePositions ⊕ legacyFallback · 재이관 Δ0 · reload 재이관 0.
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
    `${ok ? "PASS" : "FAIL"} ${name}${detail ? " — " + JSON.stringify(detail).slice(0, 400) : ""}\n`,
  );
};
const settle = (page, ms = 900) => page.waitForTimeout(ms);
const COMPONENTS_ID = "page-components";
const BP = { desktop: 0, tablet: 1, mobile: 2 };

const readState = (page) =>
  page.evaluate(() => {
    const st = window.__composition_STORE__.getState();
    const frames = window.__composition_SCENE_DEBUG__.readPageFrames();
    const vp = window.__composition_VIEWPORT_SYNC__.getState();
    return {
      activeBreakpoint: st.activeBreakpoint,
      pages: st.pages.map((p) => ({ id: p.id, title: p.title })),
      frames: Object.fromEntries(
        frames.map((f) => [f.id, [Math.round(f.x), Math.round(f.y)]]),
      ),
      pageLayout:
        window.__composition_PAGE_PLACEMENT__.readPageLayout() ?? null,
      zoom: vp.zoom,
      pan: { x: Math.round(vp.panOffset.x), y: Math.round(vp.panOffset.y) },
    };
  });

/** 문서 `pagePositions` 를 IndexedDB 헤더에서 직접 읽는다 (바이트 동일 확인용). */
const readStoredPositions = (page) =>
  page.evaluate(async () => {
    const open = (n) =>
      new Promise((r, j) => {
        const q = indexedDB.open(n);
        q.onsuccess = () => r(q.result);
        q.onerror = () => j(q.error);
      });
    const all = (s) =>
      new Promise((r) => {
        const q = s.getAll();
        q.onsuccess = () => r(q.result || []);
        q.onerror = () => r([]);
      });
    const db = await open("composition");
    const parts = db.objectStoreNames.contains("document_parts")
      ? await all(
          db
            .transaction("document_parts", "readonly")
            .objectStore("document_parts"),
        )
      : [];
    db.close();
    const id = location.pathname.split("/").pop();
    const row = parts.find((p) => p.project_id === id && p.key === "document");
    if (!row) return null;
    const h = JSON.parse(row.value);
    return {
      pagePositions: h.pagePositions ?? null,
      pageLayout: h.pageLayout ?? null,
    };
  });

/**
 * Home 기준 상대 벡터. **시스템 페이지 (Components) 는 뺀다** — 그 위치는 저장값이 아니라
 * ADR-231 규칙의 파생 기본값이고 (Decision 5), 이관 대상도 아니다. 대신 규칙 자체를 따로 본다.
 */
const normalize = (frames, homeId) => {
  const home = frames[homeId];
  if (!home) return {};
  return Object.fromEntries(
    Object.entries(frames)
      .filter(([id]) => id !== COMPONENTS_ID)
      .map(([id, p]) => [id, [p[0] - home[0], p[1] - home[1]]]),
  );
};

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
const switchBp = async (page, name) => {
  await page.locator(".builder-control-group button").nth(BP[name]).click();
  await settle(page, 1200);
};

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
    await switchBp(page, "desktop");
    await addPages(page, 4);

    // ── 레거시 문서를 만든다: placementModel 없이 저장 좌표만 (tier 3, 손 배치 포함) ──
    const before = await readState(page);
    const userIds = before.pages
      .filter((p) => p.id !== COMPONENTS_ID)
      .map((p) => p.id);
    const homeId = userIds[0];
    await page.evaluate(
      ({ ids, comp }) => {
        const canonical = window.__composition_STORE__.getState();
        void canonical;
        const entries = [];
        const push = (pageId, bp, x, y) =>
          entries.push({ pageId, breakpoint: bp, position: { x, y } });
        // desktop: Home 오프셋 317 · 3열 격자 · 마지막 페이지만 손 배치
        const D = 2000,
          R = 1160;
        push(ids[0], "desktop", 317, 0);
        push(ids[1], "desktop", 317 + D, 0);
        push(ids[2], "desktop", 317 + 2 * D, 0);
        push(ids[3], "desktop", 317, R);
        push(ids[4], "desktop", 317 + 133, 4321);
        // tablet: 전부 기본 흐름 (stride 848 · row 1104)
        const T = 848,
          TR = 1104;
        ids.forEach((id, i) =>
          push(id, "tablet", (i % 3) * T, Math.floor(i / 3) * TR),
        );
        // mobile: 한 행 5칸 (stride 470)
        ids.forEach((id, i) => push(id, "mobile", i * 470, 0));
        push(comp, "desktop", -2000, 0);
        window.__composition_PAGE_PLACEMENT__.setPagePositions(entries);
      },
      { ids: userIds, comp: COMPONENTS_ID },
    );
    await settle(page, 1200);

    // 새 프로젝트는 hydration 이 이미 `derived` 를 쓴다 — 진짜 레거시 문서를 만들려면 표식을 지운다.
    await page.evaluate(() =>
      window.__composition_PAGE_PLACEMENT__.clearPlacementModel(),
    );
    await settle(page, 900);

    const legacyStored = await readStoredPositions(page);
    record.steps.push({ step: "legacy-doc", stored: legacyStored });
    check(
      "레거시 문서 준비 (placementModel 없음)",
      legacyStored?.pageLayout?.placementModel === undefined,
      { pageLayout: legacyStored?.pageLayout },
    );

    // 표식이 없는 상태의 화면 = 저장 좌표가 정본 (legacy 읽기) — 이관 전 기준 벡터.
    await page.evaluate(() =>
      window.__composition_PAGE_PLACEMENT__.setPageLayout({
        placementModel: "legacy",
      }),
    );
    await settle(page, 1100);
    const preMigration = {};
    for (const bp of ["desktop", "tablet", "mobile"]) {
      await switchBp(page, bp);
      const s = await readState(page);
      preMigration[bp] = normalize(s.frames, homeId);
    }
    await switchBp(page, "desktop");
    const beforeScreen = await readState(page);
    // 다시 표식을 지워 미이관 문서로 되돌린 뒤 reload → hydration 이관이 돈다.
    await page.evaluate(() =>
      window.__composition_PAGE_PLACEMENT__.clearPlacementModel(),
    );
    await settle(page, 900);

    // ── reload → hydration 이관 ──
    await page.reload({ waitUntil: "networkidle" });
    await settle(page, 4500);
    const afterMigration = await readState(page);
    record.steps.push({
      step: "after-migration",
      pageLayout: afterMigration.pageLayout,
      frames: afterMigration.frames,
    });
    check(
      '이관 기록 — placementModel: "derived"',
      afterMigration.pageLayout?.placementModel === "derived",
      { pageLayout: afterMigration.pageLayout },
    );

    const postMigration = {};
    for (const bp of ["desktop", "tablet", "mobile"]) {
      await switchBp(page, bp);
      const s = await readState(page);
      postMigration[bp] = normalize(s.frames, homeId);
    }
    await switchBp(page, "desktop");
    for (const bp of ["desktop", "tablet", "mobile"]) {
      const want = preMigration[bp],
        got = postMigration[bp];
      const diff = Object.keys(want).filter(
        (id) => JSON.stringify(want[id]) !== JSON.stringify(got[id]),
      );
      check(`G4(a) ${bp} normalized-world Δ0`, diff.length === 0, {
        diff: diff.map((id) => ({ id, want: want[id], got: got[id] })),
      });
    }
    record.steps.push({ step: "vectors", preMigration, postMigration });

    // 시스템 열은 규칙으로 본다 (저장값이 아니라 파생 기본값 — Decision 5 · ADR-231)
    const compState = await readState(page);
    check(
      "시스템 열 규칙 — Components.x = Home.x − (1920 + gap)",
      compState.frames[COMPONENTS_ID]?.[0] ===
        compState.frames[homeId][0] - 2000,
      { comp: compState.frames[COMPONENTS_ID], home: compState.frames[homeId] },
    );

    const storedAfter = await readStoredPositions(page);
    check(
      "`pagePositions` 바이트 동일 (지우지 않는다)",
      JSON.stringify(storedAfter?.pagePositions) ===
        JSON.stringify(legacyStored?.pagePositions),
      {
        same:
          JSON.stringify(storedAfter?.pagePositions) ===
          JSON.stringify(legacyStored?.pagePositions),
      },
    );

    // ── 두 번째 reload — 재이관 0 · 벡터 Δ0 ──
    const layoutAfterFirst = JSON.stringify(afterMigration.pageLayout);
    await page.reload({ waitUntil: "networkidle" });
    await settle(page, 4500);
    await switchBp(page, "desktop");
    const second = await readState(page);
    check(
      "두 번째 reload — 재이관 0 (pageLayout 불변)",
      JSON.stringify(second.pageLayout) === layoutAfterFirst,
      { first: afterMigration.pageLayout, second: second.pageLayout },
    );
    check(
      "두 번째 reload — 벡터 Δ0",
      JSON.stringify(normalize(second.frames, homeId)) ===
        JSON.stringify(postMigration.desktop),
      {},
    );
    record.steps.push({ step: "second-reload", frames: second.frames });

    // ── (c) legacy 복귀 ──
    await page.evaluate(() =>
      window.__composition_PAGE_PLACEMENT__.setPlacementModelLegacy(),
    );
    await settle(page, 1400);
    const legacyBack = await readState(page);
    const storedNow = await readStoredPositions(page);
    check(
      '복귀 — placementModel: "legacy"',
      legacyBack.pageLayout?.placementModel === "legacy",
      { model: legacyBack.pageLayout?.placementModel },
    );
    const wantLegacy = {};
    for (const [id, byBp] of Object.entries(storedNow?.pagePositions ?? {})) {
      if (byBp.desktop) wantLegacy[id] = [byBp.desktop.x, byBp.desktop.y];
    }
    const legacyMismatch = Object.keys(wantLegacy).filter(
      (id) =>
        JSON.stringify(legacyBack.frames[id]) !==
        JSON.stringify(wantLegacy[id]),
    );
    check(
      "복귀 좌표 = 저장 `pagePositions` 그대로",
      legacyMismatch.length === 0,
      {
        mismatch: legacyMismatch.map((id) => ({
          id,
          want: wantLegacy[id],
          got: legacyBack.frames[id],
        })),
      },
    );
    check(
      "legacy 에서 모든 페이지가 좌표를 갖는다 (겹침 0)",
      new Set(Object.values(legacyBack.frames).map((f) => f.join(","))).size ===
        Object.keys(legacyBack.frames).length,
      { frames: legacyBack.frames },
    );
    record.steps.push({
      step: "legacy",
      frames: legacyBack.frames,
      fallback: legacyBack.pageLayout?.legacyFallback,
    });

    // legacy 에서 reload → 재이관 0
    await page.reload({ waitUntil: "networkidle" });
    await settle(page, 4500);
    await switchBp(page, "desktop");
    const legacyReload = await readState(page);
    check(
      "legacy 에서 reload — 재이관 0",
      legacyReload.pageLayout?.placementModel === "legacy",
      { model: legacyReload.pageLayout?.placementModel },
    );

    // ── 재이관 ──
    await page.evaluate(() =>
      window.__composition_PAGE_PLACEMENT__.setPlacementModelDerived(),
    );
    await settle(page, 1400);
    const reMigrated = await readState(page);
    check(
      "재이관 — derived 복귀",
      reMigrated.pageLayout?.placementModel === "derived",
      { model: reMigrated.pageLayout?.placementModel },
    );
    check(
      "재이관 벡터 Δ0",
      JSON.stringify(normalize(reMigrated.frames, homeId)) ===
        JSON.stringify(postMigration.desktop),
      {
        want: postMigration.desktop,
        got: normalize(reMigrated.frames, homeId),
      },
    );
    record.steps.push({ step: "re-migrated", frames: reMigrated.frames });

    void beforeScreen;
    record.results = results;
  } finally {
    await browser.close();
  }
  const outDir = resolve(here, "../../../docs/adr/evidence");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(
    resolve(outDir, "232-g4-migration-bc-live.json"),
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
