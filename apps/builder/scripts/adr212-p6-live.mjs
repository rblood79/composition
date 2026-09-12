#!/usr/bin/env node
// adr212-p6-live.mjs — ADR-212 Phase 6 (캔버스 바인딩 배지, UI-7/B3) live:
//   data-bound 요소 위에 Skia overlay 배지(테이블명 + 상태색)가 뜨고, 클릭하면 그 테이블
//   편집기가 열린다. 바인딩 없는 요소엔 배지 없음(비침습). Skia 픽셀은 페이지에서 못 읽으므로
//   렌더러가 채운 scene bounds(window.__composition_DATA_BADGES__)와 상태값으로 검증하고,
//   클릭은 viewport 변환(window.__composition_VIEWPORT__)으로 screen 좌표를 계산해 실제 마우스로.
// 사용: node apps/builder/scripts/adr212-p6-live.mjs [--headless]
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { waitReady } from "./perf-baseline.mjs";

const BASE_URL = "http://localhost:5173";
const STORAGE_STATE = resolve("apps/builder/scripts/.auth-session.json");
const OUT_DIR = process.env.ADR212_OUT ?? "/private/tmp/adr212-p6";
const headless = process.argv.includes("--headless");
const log = (...a) => console.log("[ADR-212 p6 live]", ...a);
const findings = [];
const record = (name, pass, detail) => {
  findings.push({ name, pass, detail });
  log(`${pass ? "PASS" : "FAIL"} — ${name} :: ${detail}`);
};

const RAIL_ORDER = [
  "navigator",
  "components",
  "datatable",
  "datatableEditor",
  "theme",
  "ai",
  "properties",
  "styles",
  "interactions",
  "history",
];
async function setPanel(page, panelId, open) {
  const button = page
    .locator(".panel-toggle-rail button")
    .nth(RAIL_ORDER.indexOf(panelId));
  if (((await button.getAttribute("aria-pressed")) === "true") !== open) {
    await button.click();
    await page.waitForTimeout(900);
  }
}

async function idbPut(page, store, arg) {
  return page.evaluate(
    async ({ store, arg }) => {
      const db = await new Promise((res, rej) => {
        const r = indexedDB.open("composition");
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
      });
      await new Promise((res, rej) => {
        const tx = db.transaction(store, "readwrite");
        tx.objectStore(store).put(arg);
        tx.oncomplete = () => res();
        tx.onerror = () => rej(tx.error);
      });
      db.close();
    },
    { store, arg },
  );
}

mkdirSync(OUT_DIR, { recursive: true });
const browser = await chromium.launch({ headless });
const context = await browser.newContext({
  storageState: STORAGE_STATE,
  viewport: { width: 1600, height: 1000 },
  deviceScaleFactor: 2,
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
let dialogs = 0;
page.on("dialog", (d) => {
  dialogs += 1;
  d.dismiss().catch(() => {});
});

try {
  await page.goto(`${BASE_URL}/dashboard`, { waitUntil: "networkidle" });
  const create = page.locator("button.dashboard-create-button").first();
  await create.waitFor({ state: "visible", timeout: 20_000 });
  await create.click();
  const input = page.locator("#new-project-name");
  await input.waitFor({ state: "visible", timeout: 10_000 });
  await input.fill(`adr212-p6-${Date.now()}`);
  await input.press("Enter");
  await page.waitForURL(/\/builder\/[^/?]+$/, { timeout: 90_000 });
  await waitReady(page);
  const projectId = page.url().split("/builder/")[1];
  log("project", projectId);

  const now = new Date().toISOString();
  const normalId = crypto.randomUUID();
  const emptyId = crypto.randomUUID();
  await idbPut(page, "collections", {
    id: normalId,
    name: "Products",
    project_id: projectId,
    schema: [{ id: "f-id", key: "id", type: "string" }],
    mockData: [{ id: "1" }, { id: "2" }, { id: "3" }],
    useMockData: true,
    created_at: now,
    updated_at: now,
  });
  await idbPut(page, "collections", {
    id: emptyId,
    name: "Empties",
    project_id: projectId,
    schema: [{ id: "f-id", key: "id", type: "string" }],
    mockData: [],
    useMockData: true,
    created_at: now,
    updated_at: now,
  });
  await page.reload({ waitUntil: "networkidle" });
  await waitReady(page);

  // ── 1) 요소 2개 생성 (Components 팔레트) 후 각각 collection 에 바인딩 ──
  await setPanel(page, "components", true);
  const paletteBtn = page
    .locator(
      '.panel-toggle-rail + * [data-component-type], [data-component-type="Button"], button:has-text("Button")',
    )
    .first();
  await paletteBtn.waitFor({ timeout: 15_000 });
  await paletteBtn.click();
  await page.waitForTimeout(1200);
  await paletteBtn.click();
  await page.waitForTimeout(1600);

  const ids = await page.evaluate(() => {
    const st = window.__composition_STORE__.getState();
    return st.elements
      .filter((e) => e.type?.toLowerCase() !== "body")
      .slice(-2)
      .map((e) => e.id);
  });
  record(
    "요소 2개 생성",
    ids.length === 2,
    `ids=${JSON.stringify(ids)}`,
  );
  if (ids.length !== 2) throw new Error("요소 2개 생성 실패");

  await page.evaluate(
    ({ ids, normalId, emptyId }) => {
      const store = window.__composition_STORE__.getState();
      store.updateElementProps(ids[0], {
        dataBinding: { source: "dataTable", collectionId: normalId },
      });
      store.updateElementProps(ids[1], {
        dataBinding: { source: "dataTable", collectionId: emptyId },
      });
    },
    { ids, normalId, emptyId },
  );
  await page.waitForTimeout(1600);

  // ── 2) 배지가 두 요소에 떴는지 (scene bounds + 상태색) ──
  const badges = await page.evaluate(() => {
    const map = window.__composition_DATA_BADGES__;
    if (!map) return null;
    return [...map.values()].map((b) => ({
      collectionId: b.collectionId,
      state: b.state,
      w: Math.round(b.width),
      h: Math.round(b.height),
    }));
  });
  const byCol = new Map((badges ?? []).map((b) => [b.collectionId, b]));
  record(
    "바인딩 요소 2개에 배지 (window.__composition_DATA_BADGES__)",
    !!badges && badges.length === 2,
    JSON.stringify(badges),
  );
  record(
    "정상 collection 배지 = normal 상태",
    byCol.get(normalId)?.state === "normal",
    `Products → ${byCol.get(normalId)?.state}`,
  );
  record(
    "0행 collection 배지 = empty 상태 (색이 갈린다)",
    byCol.get(emptyId)?.state === "empty",
    `Empties → ${byCol.get(emptyId)?.state}`,
  );

  // ── 3) 배지 클릭 → 그 테이블 편집기 열림 ──
  // 요소가 화면 밖일 수 있으니 카메라를 배지 위치로 옮겨 화면 안(300,300)에 둔다.
  await page.evaluate((normalId) => {
    const badge = [...window.__composition_DATA_BADGES__.values()].find(
      (b) => b.collectionId === normalId,
    );
    if (!badge) return;
    const scale = window.__composition_VIEWPORT__().zoom;
    // screen = scene*scale + pan → pan = target - scene*scale (배지 좌상단을 (300,300)에)
    window.__composition_APPLY_VIEWPORT__({
      scale,
      x: 300 - badge.sceneX * scale,
      y: 300 - badge.sceneY * scale,
    });
  }, normalId);
  await page.waitForTimeout(900);
  const clickInfo = await page.evaluate((normalId) => {
    const map = window.__composition_DATA_BADGES__;
    const vp = window.__composition_VIEWPORT__?.();
    const badge = [...map.values()].find((b) => b.collectionId === normalId);
    if (!badge || !vp) return null;
    const canvas = document.querySelector("canvas");
    const rect = canvas.getBoundingClientRect();
    // scene → screen: screenX = sceneX * zoom + panOffset.x (+ canvas rect origin)
    const cx =
      (badge.sceneX + badge.width / 2) * vp.zoom + vp.panOffset.x + rect.left;
    const cy =
      (badge.sceneY + badge.height / 2) * vp.zoom + vp.panOffset.y + rect.top;
    return { cx, cy };
  }, normalId);
  record(
    "배지 클릭 좌표 계산 (viewport 변환)",
    !!clickInfo,
    clickInfo ? `(${Math.round(clickInfo.cx)},${Math.round(clickInfo.cy)})` : "실패",
  );
  if (clickInfo) {
    await page.mouse.click(clickInfo.cx, clickInfo.cy);
    await page.waitForTimeout(1200);
  }
  const editorOpen = await page.evaluate(() => {
    const panel = document.querySelector('[data-panel-id="datatableEditor"]');
    if (!panel) return { open: false, text: "" };
    const visible = panel.getBoundingClientRect().width > 0;
    return { open: visible, text: (panel.textContent ?? "").slice(0, 60) };
  });
  record(
    "배지 클릭 → Products 편집기 열림",
    editorOpen.open && editorOpen.text.includes("Products"),
    `open=${editorOpen.open} text="${editorOpen.text}"`,
  );

  // ── 4) 비침습: 바인딩 없는 요소엔 배지 없음 (2개만) ──
  record(
    "바인딩 없는 요소엔 배지 없음 (총 2개)",
    (badges ?? []).length === 2,
    `badge count=${(badges ?? []).length}`,
  );

  record("native dialog 0", dialogs === 0, String(dialogs));
  record("page error 0", errors.length === 0, errors.join(" | "));

  const passed = findings.filter((f) => f.pass).length;
  log(`${passed}/${findings.length} PASS`);
  await page.screenshot({ path: `${OUT_DIR}/p6.png` });
  if (passed !== findings.length) process.exitCode = 1;
} catch (e) {
  log("FAIL — harness ::", e.message);
  await page.screenshot({ path: `${OUT_DIR}/p6-error.png` }).catch(() => {});
  process.exitCode = 1;
} finally {
  await browser.close();
}
