// text-edit-camera-follow-live.mjs — 텍스트 편집 중 휠 팬/줌 시 편집 오버레이가 **제스처 중** 캔버스와
//   같이 움직이는지 (React mirror 동기화 전 = 휠 종료 150ms 디바운스 안). 2026-09-20 사용자 보고:
//   "canvas 는 이동하지만 text edit 창은 이전 위치에 머무르고 이동이 끝난 후 동기화".
//   node apps/builder/scripts/text-edit-camera-follow-live.mjs [--headless]
import { chromium } from "playwright";
import { resolve } from "node:path";
const REPO = "/Users/admin/work/composition";
const { createIsolatedProject } = await import(
  `${REPO}/apps/builder/scripts/perf-baseline.mjs`
);
const STORAGE_STATE = resolve(REPO, "apps/builder/scripts/.auth-session.json");
const headless = process.argv.includes("--headless");
const log = (...a) => console.log("[edit-follow]", ...a);
const RAIL = [
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
async function setPanel(page, id, open) {
  const b = page.locator(".panel-toggle-rail button").nth(RAIL.indexOf(id));
  if (((await b.getAttribute("aria-pressed")) === "true") !== open) {
    await b.click();
    await page.waitForTimeout(700);
  }
}
async function addFromPalette(page, query) {
  await setPanel(page, "components", true);
  await page.evaluate(() =>
    window.__composition_STORE__.getState().setSelectedElement(null),
  );
  const before = await page.evaluate(() =>
    window.__composition_STORE__.getState().elements.map((e) => e.id),
  );
  const search = page.locator('[data-panel-id="components"] input').first();
  await search.fill(query);
  await page.waitForTimeout(300);
  const items = page.locator('[data-panel-id="components"] .list-item');
  const n = await items.count();
  let picked = 0;
  for (let i = 0; i < n; i++) {
    const t = (await items.nth(i).innerText()).trim().toLowerCase();
    if (t === query || t.startsWith(`${query}\n`)) {
      picked = i;
      break;
    }
  }
  await items.nth(picked).click();
  await page.waitForFunction(
    (b) =>
      window.__composition_STORE__
        .getState()
        .elements.some((e) => !b.includes(e.id)),
    before,
    { timeout: 15000 },
  );
  await page.waitForTimeout(500);
  return page.evaluate(
    (b) =>
      window.__composition_STORE__
        .getState()
        .elements.filter((e) => !b.includes(e.id))[0].id,
    before,
  );
}
const overlayRect = (page) =>
  page.evaluate(() => {
    const el = document.querySelector("[data-text-edit-overlay] > div");
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const cam = window.__composition_VIEWPORT__();
    return {
      x: r.x,
      y: r.y,
      w: r.width,
      h: r.height,
      mirror: { zoom: cam.zoom, pan: cam.panOffset },
    };
  });
const nextFrames = (page, n) =>
  page.evaluate(
    (n) =>
      new Promise((res) => {
        let k = 0;
        const step = () => (++k >= n ? res() : requestAnimationFrame(step));
        requestAnimationFrame(step);
      }),
    n,
  );

const browser = await chromium.launch({ headless });
const context = await browser.newContext({
  storageState: STORAGE_STATE,
  viewport: { width: 1440, height: 900 },
});
await context.addInitScript(() => {
  try {
    localStorage.setItem("builder-breakpoint", "mobile");
  } catch {}
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
let bad = 0;
const check = (label, cond, detail) => {
  log(`${cond ? "ok  " : "DIFF"} ${label} ${detail ?? ""}`);
  if (!cond) bad++;
};
try {
  await createIsolatedProject(page, process.env.BUILDER_URL ?? "http://localhost:5173");
  const id = await addFromPalette(page, "text");
  await page.evaluate(
    (id) =>
      window.__composition_STORE__
        .getState()
        .updateElementProps(id, {
          children: "Follow the camera",
          style: { width: "200px", padding: "8px" },
        }),
    id,
  );
  await setPanel(page, "components", false);
  await page.waitForTimeout(1200);
  // 요소 화면 중심 (mirror 카메라 — 유휴 상태라 presentation 과 같다)
  const center = await page.evaluate((id) => {
    const r = window.__composition_RENDER_DEBUG__.getSceneBounds(id);
    const cam = window.__composition_VIEWPORT__();
    const c = document
      .querySelector('[data-testid="skia-canvas-unified"]')
      .getBoundingClientRect();
    return {
      x: c.left + (r.x + r.width / 2) * cam.zoom + cam.panOffset.x,
      y: c.top + (r.y + r.height / 2) * cam.zoom + cam.panOffset.y,
    };
  }, id);
  await page.mouse.dblclick(center.x, center.y);
  await page.waitForSelector("[data-text-edit-overlay]", { timeout: 4000 });
  await page.waitForTimeout(400);
  const r0 = await overlayRect(page);
  log("edit overlay", JSON.stringify(r0));

  // 1) 휠 팬 (세로 +120 → 씬은 위로) — 2 프레임 뒤, 150ms 디바운스 전에 읽는다.
  await page.mouse.move(center.x + 150, center.y + 150);
  await page.mouse.wheel(0, 120);
  await nextFrames(page, 2);
  const r1 = await overlayRect(page);
  const mirrorMoved1 = r1.mirror.pan.y !== r0.mirror.pan.y;
  await page.mouse.wheel(0, 120);
  await nextFrames(page, 2);
  const r2 = await overlayRect(page);
  await page.waitForTimeout(400); // 디바운스 → mirror 동기
  const r3 = await overlayRect(page);
  // 휠 1회의 pan 량은 컨트롤러 소관 (배율) — 제스처 종료 뒤 mirror 의 총 Δ 가 정답이다.
  const total = r3.mirror.pan.y - r0.mirror.pan.y;
  check(
    "휠 팬 중 (mirror 미동기) 오버레이가 즉시 이동 (총 Δ 의 절반)",
    Math.abs(r1.y - r0.y - total / 2) < 2 && !mirrorMoved1 && total !== 0,
    `Δy ${(r1.y - r0.y).toFixed(1)} / 총 ${total} · mirror moved ${mirrorMoved1}`,
  );
  check(
    "연속 휠 2회 누적",
    Math.abs(r2.y - r0.y - total) < 2,
    `Δy ${(r2.y - r0.y).toFixed(1)}`,
  );
  check(
    "제스처 종료 후 위치 유지 (되돌림 없음)",
    Math.abs(r3.y - r2.y) < 1,
    `Δy ${(r3.y - r2.y).toFixed(1)} mirror pan.y ${r0.mirror.pan.y}→${r3.mirror.pan.y}`,
  );
  const still = await page.evaluate(
    () => !!document.querySelector("[data-text-edit-overlay]"),
  );
  check("팬 중 편집 유지", still);

  // 2) Ctrl+휠 줌 — 제스처 중 scale 반영
  await page.keyboard.down("Control");
  await page.mouse.wheel(0, -60);
  await page.keyboard.up("Control");
  await nextFrames(page, 2);
  const r4 = await overlayRect(page);
  const scale = await page.evaluate(
    () =>
      document.querySelector("[data-text-edit-overlay] > div").style.transform,
  );
  check(
    "줌 중 (mirror 미동기) 오버레이 크기 변화",
    r4.w > r3.w * 1.02 && r4.mirror.zoom === r3.mirror.zoom,
    `w ${r3.w.toFixed(1)}→${r4.w.toFixed(1)} ${scale} mirror zoom ${r4.mirror.zoom}`,
  );
  await page.waitForTimeout(400);
  const r5 = await overlayRect(page);
  // 줌 확정 뒤 오버레이 = Skia 상자 (mirror 기준 기대 rect)
  const expect5 = await page.evaluate((id) => {
    const r = window.__composition_RENDER_DEBUG__.getSceneBounds(id);
    const cam = window.__composition_VIEWPORT__();
    const c = document
      .querySelector('[data-testid="skia-canvas-unified"]')
      .getBoundingClientRect();
    return {
      x: c.left + r.x * cam.zoom + cam.panOffset.x,
      y: c.top + r.y * cam.zoom + cam.panOffset.y,
      w: r.width * cam.zoom,
      h: r.height * cam.zoom,
      zoom: cam.zoom,
    };
  }, id);
  check(
    "줌 종료 후 오버레이 = Skia 상자",
    ["x", "y", "w", "h"].every((k) => Math.abs(r5[k] - expect5[k]) < 1.5),
    `overlay ${[r5.x, r5.y, r5.w, r5.h].map((v) => v.toFixed(1))} skia ${[expect5.x, expect5.y, expect5.w, expect5.h].map((v) => v.toFixed(1))} zoom ${expect5.zoom.toFixed(2)}`,
  );

  // 3) 편집 중 타이핑이 여전히 동작 + 프레임 시간 (팬 20 스텝)
  await page.keyboard.type(" ok");
  const typed = await page.evaluate(
    () =>
      document.querySelector("[data-text-edit-overlay] .ql-editor")
        ?.innerText ?? "",
  );
  check(
    "팬·줌 뒤 타이핑",
    typed.includes("Follow the camera ok"),
    JSON.stringify(typed),
  );
  const t0 = Date.now();
  for (let i = 0; i < 20; i++) {
    await page.mouse.wheel(i % 2 ? 40 : -40, 0);
    await nextFrames(page, 1);
  }
  const frameMs = await page.evaluate(
    () =>
      new Promise((res) => {
        const ts = [];
        let last = performance.now();
        const step = () => {
          const n = performance.now();
          ts.push(n - last);
          last = n;
          if (ts.length < 30) requestAnimationFrame(step);
          else res(ts.sort((a, b) => a - b));
        };
        requestAnimationFrame(step);
      }),
  );
  log(
    "pan 20 steps",
    Date.now() - t0,
    "ms · idle frame p50",
    frameMs[15].toFixed(1),
    "p95",
    frameMs[28].toFixed(1),
  );
  // 스크린샷용 — 편집 상자가 화면 안에 오도록 되돌린다 (Skia 텍스트는 편집 중 숨김, 보이는 건 오버레이).
  await page.mouse.move(center.x + 150, center.y + 150);
  await page.mouse.wheel(0, total * 1.2);
  await page.waitForTimeout(500);
  const r6 = await overlayRect(page);
  log(
    "final overlay",
    JSON.stringify([r6.x, r6.y, r6.w, r6.h].map((v) => +v.toFixed(1))),
  );
  await page.screenshot({
    path: `${process.env.SHOT_DIR ?? "/tmp"}/edit-follow.png`,
  });
  await page.keyboard.press("Escape");
  log("pageerrors", errors.length, errors.slice(0, 3));
  log(bad === 0 ? "ALL OK" : `DIFF ${bad}`);
} finally {
  await browser.close();
}
