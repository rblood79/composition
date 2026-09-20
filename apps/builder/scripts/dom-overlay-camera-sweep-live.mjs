// dom-overlay-camera-sweep-live.mjs — 캔버스 위 DOM 오버레이가 휠 팬 **제스처 중** (React mirror 동기화 전)
//   어떻게 반응하는지 sweep: spacing 인라인 입력 (ADR-222) · 컨텍스트 메뉴. 2026-09-20 텍스트 편집
//   오버레이 (mirror 를 읽어 제스처 끝에야 따라옴) 의 유사 패턴 점검.
//   node apps/builder/scripts/dom-overlay-camera-sweep-live.mjs [--headless]
import { chromium } from "playwright";
import { resolve } from "node:path";
const REPO = "/Users/admin/work/composition";
const { createIsolatedProject } = await import(
  `${REPO}/apps/builder/scripts/perf-baseline.mjs`
);
const STORAGE_STATE = resolve(REPO, "apps/builder/scripts/.auth-session.json");
const headless = process.argv.includes("--headless");
const log = (...a) => console.log("[overlay-sweep]", ...a);
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
    await page.waitForTimeout(800);
  }
}
async function addFromPalette(page, query, parentId = null) {
  await setPanel(page, "components", true);
  await page.evaluate(
    (pid) => window.__composition_STORE__.getState().setSelectedElement(pid),
    parentId,
  );
  await page.waitForTimeout(250);
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
    if (t === query.toLowerCase() || t.startsWith(`${query.toLowerCase()}\n`)) {
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
  return page.evaluate((b) => {
    const st = window.__composition_STORE__.getState();
    const f = st.elements.filter((e) => !b.includes(e.id));
    const ids = new Set(f.map((e) => e.id));
    return f.find((e) => !ids.has(e.parent_id)).id;
  }, before);
}
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
const mirror = (page) => page.evaluate(() => window.__composition_VIEWPORT__());
const rectOf = (page, sel) =>
  page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height };
  }, sel);
const handleScreenPoint = (page, bandId) =>
  page.evaluate((id) => {
    const set = window.__composition_SPACING_DEBUG__.resolveBands();
    const band = set?.bands.find((b) => b.id === id);
    if (!band) return null;
    const vp = window.__composition_VIEWPORT__();
    const rect = document.querySelector("canvas").getBoundingClientRect();
    return {
      x:
        (band.rect.x + band.rect.width / 2) * vp.zoom +
        vp.panOffset.x +
        rect.left,
      y:
        (band.rect.y + band.rect.height / 2) * vp.zoom +
        vp.panOffset.y +
        rect.top,
    };
  }, bandId);

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
  await createIsolatedProject(page, "http://localhost:5173");
  const boxId = await addFromPalette(page, "frame");
  await page.evaluate(
    (id) =>
      window.__composition_STORE__
        .getState()
        .updateElementProps(id, {
          style: {
            display: "flex",
            flexDirection: "column",
            padding: "16px",
            gap: "12px",
            width: "320px",
          },
        }),
    boxId,
  );
  await addFromPalette(page, "Button", boxId);
  await addFromPalette(page, "Button", boxId);
  await setPanel(page, "components", false);
  await page.evaluate(
    (id) => window.__composition_STORE__.getState().setSelectedElement(id),
    boxId,
  );
  await page.waitForTimeout(1200);

  // ── 1) spacing 인라인 입력 — 핸들 클릭으로 열고 휠 팬 ──
  const pt = await handleScreenPoint(page, "padding:bottom");
  check("spacing 띠 핸들 존재", !!pt, JSON.stringify(pt));
  await page.mouse.click(pt.x, pt.y);
  await page.waitForTimeout(500);
  const in0 = await rectOf(page, ".spacing-inline-input");
  check("인라인 입력 열림", !!in0, JSON.stringify(in0));
  const m0 = await mirror(page);
  await page.mouse.move(pt.x + 200, pt.y + 200);
  await page.mouse.wheel(0, 120);
  await nextFrames(page, 2);
  const in1 = await rectOf(page, ".spacing-inline-input");
  const m1 = await mirror(page);
  const handleAfter = await page.evaluate(() => {
    const set = window.__composition_SPACING_DEBUG__.resolveBands();
    return set?.bands.find((b) => b.id === "padding:bottom")?.rect ?? null;
  });
  log(
    "   제스처 중: 입력",
    JSON.stringify(in1),
    "mirror pan.y",
    m0.panOffset.y,
    "→",
    m1.panOffset.y,
    "(mirror 미동기 =",
    m1.panOffset.y === m0.panOffset.y,
    ")",
  );
  // 입력은 핸들을 **따라간다** (2026-09-20 — 종전 mirror 기반 취소는 제스처 끝에야 닫혀 팬 중 옛 자리에 남았다).
  await page.waitForTimeout(400);
  const in2 = await rectOf(page, ".spacing-inline-input");
  const m2 = await mirror(page);
  const total = m2.panOffset.y - m0.panOffset.y;
  check(
    "spacing 입력: 휠 첫 프레임에 핸들과 같이 이동 (mirror 동기 전)",
    !!in1 &&
      m1.panOffset.y === m0.panOffset.y &&
      Math.abs(in1.y - in0.y - total) < 2,
    in1 ? `Δy ${(in1.y - in0.y).toFixed(1)} / 총 ${total}` : "closed",
  );
  check(
    "spacing 입력: 제스처 종료 후 열린 채 핸들 자리 (되돌림 0)",
    !!in2 && Math.abs(in2.y - in0.y - total) < 2 && Math.abs(in2.y - in1.y) < 1,
    in2 ? `Δy ${(in2.y - in0.y).toFixed(1)}` : "closed",
  );
  const ptAfter = await handleScreenPoint(page, "padding:bottom");
  check(
    "spacing 입력: 핸들 중심과 일치 (x 중심 · y 핸들 위)",
    !!in2 &&
      Math.abs(in2.x + in2.w / 2 - ptAfter.x) < 2 &&
      Math.abs(in2.y + in2.h - ptAfter.y) < 30,
    `input ${in2 && [in2.x + in2.w / 2, in2.y + in2.h].map((v) => v.toFixed(0))} handle ${[ptAfter.x, ptAfter.y].map((v) => v.toFixed(0))}`,
  );
  // 팬 뒤 입력이 여전히 동작 — 24 Enter → padding 24
  await page.evaluate(() =>
    document.querySelector(".spacing-inline-input input")?.select(),
  );
  await page.keyboard.type("24");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(600);
  const padAfter = await page.evaluate(
    (id) =>
      window.__composition_STORE__.getState().elements.find((e) => e.id === id)
        ?.props?.style?.paddingBottom ??
      window.__composition_STORE__.getState().elements.find((e) => e.id === id)
        ?.props?.style?.padding,
    boxId,
  );
  check(
    "spacing 입력: 팬 뒤 Enter commit",
    String(padAfter).startsWith("24"),
    JSON.stringify(padAfter),
  );
  await page.keyboard.press("Escape");

  // ── 2) 컨텍스트 메뉴 — 캔버스 우클릭으로 열고 휠 팬 ──
  await page.evaluate(() =>
    window.__composition_STORE__.getState().setSelectedElement(null),
  );
  const c = await page.evaluate(() => {
    const r = document.querySelector("canvas").getBoundingClientRect();
    return { x: r.left + r.width * 0.6, y: r.top + r.height * 0.6 };
  });
  await page.mouse.click(c.x, c.y, { button: "right" });
  await page.waitForTimeout(500);
  const menu0 = await rectOf(page, ".context-menu-popover");
  check("컨텍스트 메뉴 열림", !!menu0, JSON.stringify(menu0));
  if (menu0) {
    const mm0 = await mirror(page);
    await page.mouse.move(c.x - 300, c.y - 200);
    await page.mouse.wheel(0, 120);
    await nextFrames(page, 2);
    await page.waitForTimeout(400);
    const menu1 = await rectOf(page, ".context-menu-popover");
    const mm1 = await mirror(page);
    const panned = mm1.panOffset.y !== mm0.panOffset.y;
    log(
      "   휠 뒤: 메뉴",
      JSON.stringify(menu1),
      "캔버스 pan",
      panned,
      mm0.panOffset.y,
      "→",
      mm1.panOffset.y,
    );
    // 메뉴가 열린 채 캔버스만 움직이면 메뉴가 가리키던 자리와 어긋난다 — Figma 는 스크롤에 메뉴를 닫는다.
    check(
      "컨텍스트 메뉴: 휠 팬이 캔버스를 움직이면 메뉴는 닫힌다 (또는 휠이 차단된다)",
      !(panned && menu1),
      panned && menu1
        ? "캔버스 이동 + 메뉴 잔존"
        : panned
          ? "닫힘"
          : "휠 차단 (캔버스 정지)",
    );
    await page.keyboard.press("Escape");
  }
  log("pageerrors", errors.length, errors.slice(0, 3));
  log(bad === 0 ? "ALL OK" : `DIFF ${bad}`);
} finally {
  await browser.close();
}
