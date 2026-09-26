#!/usr/bin/env node
// page-positions-breakpoint-live.mjs — 사용자 보고 (2026-09-22) 재현·검증: 새 프로젝트 → desktop 에서 페이지 3 추가
//   → tablet 전환 → tablet 에서 페이지 1 추가 → mobile → desktop 왕복. 각 breakpoint 에서 (1) 좌표 쌍 중복 0
//   (2) 모든 사용자 페이지 x 가 그 breakpoint 격자 stride (pageWidth+gap) 의 배수 (다른 격자 좌표 유입 0)
//   (3) 두 frame 이 겹치지 않는다 · (4) 왕복 뒤 위치 Δ0. 실입력 = Navigator "페이지 추가" · breakpoint 토글 버튼.
// 사용: node apps/builder/scripts/page-positions-breakpoint-live.mjs [--base http://localhost:5173]
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import {
  createInstrumentedContext,
  createIsolatedProject,
  loadStorageState,
  openPanels,
} from "./perf-baseline.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = (n, d) => (args.indexOf(`--${n}`) >= 0 ? args[args.indexOf(`--${n}`) + 1] : d);
const baseUrl = opt("base", process.env.BUILDER_URL ?? "http://localhost:5173");
const settle = (page, ms) => page.waitForTimeout(ms);
const BP = { desktop: { w: 1920, h: 1080 }, tablet: { w: 768, h: 1024 }, mobile: { w: 390, h: 844 } };
const BP_INDEX = { desktop: 0, tablet: 1, mobile: 2 };
const results = [];
const check = (name, ok, detail) => {
  results.push({ name, ok, detail });
  process.stdout.write(`${ok ? "PASS" : "FAIL"} ${name} ${detail ? JSON.stringify(detail) : ""}\n`);
};
const readState = (page) =>
  page.evaluate(() => {
    const st = window.__composition_STORE__.getState();
    const frames = window.__composition_SCENE_DEBUG__?.readPageFrames?.() ?? [];
    return {
      bp: st.activeBreakpoint,
      gap: st.pageGap,
      pages: st.pages.map((p) => ({ id: p.id, title: p.title })),
      positions: st.pagePositions,
      byBp: st.pagePositionsByBreakpoint,
      frames: Object.fromEntries(frames.map((f) => [f.id, f])),
    };
  });
const switchBreakpoint = async (page, id) => {
  await page.locator(".builder-control-group button").nth(BP_INDEX[id]).click();
  await settle(page, 900);
};
const addPage = async (page) => {
  await page
    .locator('button[aria-label="Add page" i], button[aria-label="페이지 추가"]')
    .first()
    .click({ timeout: 5000 });
  await settle(page, 1200);
};
function verify(label, s) {
  const user = s.pages.filter((p) => p.id !== "page-components");
  const pos = user.map((p) => ({ id: p.title, ...s.positions[p.id] }));
  const stride = BP[s.bp].w + s.gap;
  const keys = pos.map((p) => `${p.x},${p.y}`);
  check(`${label} [${s.bp}] 사용자 페이지 ${user.length} 좌표 중복 0`, new Set(keys).size === keys.length, pos);
  // 격자 원점 = 최소 x (leftInset 은 panel 상태에 따라 0/317) — 원점 기준 stride 배수여야 한다
  const originX = Math.min(...pos.map((p) => p.x));
  const offGrid = pos.filter((p) => (p.x - originX) % stride !== 0);
  check(`${label} [${s.bp}] x−원점 이 격자 stride ${stride} 배수 (다른 breakpoint 좌표 유입 0)`, offGrid.length === 0, offGrid.length ? offGrid : { originX });
  const overlaps = [];
  for (let i = 0; i < user.length; i++)
    for (let j = i + 1; j < user.length; j++) {
      const a = s.frames[user[i].id], b = s.frames[user[j].id];
      if (!a || !b) continue;
      const sep = a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y;
      if (!sep) overlaps.push([user[i].title, user[j].title]);
    }
  check(`${label} [${s.bp}] frame 겹침 0`, overlaps.length === 0, overlaps);
}

const browser = await chromium.launch({ channel: "chrome", headless: false });
try {
  const { page } = await createInstrumentedContext(browser, {
    storageState: loadStorageState(resolve(here, ".auth-session.json")),
    cpuThrottle: 1,
    frameCapture: false,
    initScript: null,
    onPageError: (e) => process.stderr.write(`[pageerror] ${e}\n`),
  });
  const project = await createIsolatedProject(page, baseUrl);
  process.stderr.write(`[boot] ${project.projectUrl}\n`);
  await settle(page, 2500);
  await openPanels(page, ["Navigator"]);
  const s0 = await readState(page);
  if (s0.bp !== "desktop") await switchBreakpoint(page, "desktop");
  await addPage(page); await addPage(page); await addPage(page);
  const d1 = await readState(page);
  check("desktop 에서 페이지 3 추가 (사용자 4)", d1.pages.filter((p) => p.id !== "page-components").length === 4, d1.pages.map((p) => p.title));
  verify("추가 후", d1);

  await switchBreakpoint(page, "tablet");
  const t1 = await readState(page);
  verify("tablet 첫 진입", t1);
  await addPage(page);
  const t2 = await readState(page);
  verify("tablet 에서 1 추가", t2);

  await switchBreakpoint(page, "mobile");
  const m1 = await readState(page);
  verify("mobile 첫 진입 (desktop 3 + tablet 1 추가분 포함)", m1);

  await switchBreakpoint(page, "desktop");
  const d2 = await readState(page);
  verify("desktop 복귀 (tablet 추가분 포함)", d2);
  const d1Ids = Object.keys(d1.positions);
  check("desktop 복귀: 기존 페이지 위치 Δ0", d1Ids.every((id) => d2.positions[id]?.x === d1.positions[id].x && d2.positions[id]?.y === d1.positions[id].y));

  await switchBreakpoint(page, "tablet");
  const t3 = await readState(page);
  check("tablet 재진입: 위치 Δ0 (스냅샷 저장)", Object.keys(t2.positions).every((id) => t3.positions[id]?.x === t2.positions[id].x && t3.positions[id]?.y === t2.positions[id].y));

  // reload 뒤 세 breakpoint 스냅샷 보존
  await page.reload({ waitUntil: "networkidle" });
  await settle(page, 3000);
  const r = await readState(page);
  process.stderr.write(`[reload] before=${JSON.stringify(t3.positions)}\n[reload] after=${JSON.stringify(r.positions)} bp=${r.bp}\n[reload] byBp=${JSON.stringify(r.byBp)}\n`);
  check("reload: 활성 breakpoint 위치 Δ0", Object.keys(t3.positions).every((id) => r.positions[id]?.x === t3.positions[id].x && r.positions[id]?.y === t3.positions[id].y), { bp: r.bp });
  await switchBreakpoint(page, "desktop");
  const r2 = await readState(page);
  check("reload 후 desktop: 위치 Δ0", Object.keys(d2.positions).every((id) => r2.positions[id]?.x === d2.positions[id].x && r2.positions[id]?.y === d2.positions[id].y));
} finally {
  await browser.close();
}
const fails = results.filter((r) => !r.ok).length;
process.stdout.write(`\n${results.length - fails}/${results.length} PASS\n`);
process.exit(fails ? 1 : 0);
