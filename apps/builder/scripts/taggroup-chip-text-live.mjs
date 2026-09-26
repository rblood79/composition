// TagGroup chip 텍스트 live 하니스 (2026-09-21 사용자 보고: "Label A" 처럼 공백이 있는 라벨의 글자가
//   세로 중앙에 안 온다). 실제 빌더 (dev 5173 · .auth-session.json) 에 TagGroup instance 를 놓고 items 를
//   추가한 뒤 Skia 텍스트 상자 (dev 훅 __composition_RENDER_DEBUG__.resolveTextNodeDebug) · 레이아웃 rect ·
//   Compare mode Preview DOM chip 을 같이 읽는다.
//
// 판정:
//   1. 모든 chip 텍스트 상자 = 1줄 높이 (chip 30 · paddingTop 5) — 공백 라벨도 같다
//   2. chip content 폭 ≥ Canvas 2D 글자 폭 (nowrap 넘침 없음)
//   3. 레이아웃 chip 높이 = DOM chip 높이 (30) · 폭 차 ≤ 3px (shaping 차)
//   4. 공백 라벨과 무공백 라벨의 draw y 차 < 0.5px (descender 없는 라벨끼리)
//
// 사용: node apps/builder/scripts/taggroup-chip-text-live.mjs [--headed]
import { chromium } from "playwright";
import { resolve } from "node:path";
import { mkdirSync } from "node:fs";
import { waitReady } from "./perf-baseline.mjs";

const BASE_URL = process.env.BUILDER_URL ?? "http://localhost:5173";
const STORAGE_STATE = resolve("apps/builder/scripts/.auth-session.json");
const OUT_DIR =
  process.env.TAGGROUP_CHIP_OUT ?? "/private/tmp/taggroup-chip-text-live";
const headed = process.argv.includes("--headed");
const LABELS = ["Alpha", "Label A", "Beta Gamma Delta"];

const results = [];
const record = (name, ok, detail) => {
  results.push({ name, ok, detail });
  console.log(`[taggroup chip] ${ok ? "PASS" : "FAIL"} — ${name} :: ${detail}`);
};

mkdirSync(OUT_DIR, { recursive: true });
const browser = await chromium.launch({ headless: !headed });
const context = await browser.newContext({
  storageState: STORAGE_STATE,
  viewport: { width: 1440, height: 900 },
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));

try {
  await page.goto(`${BASE_URL}/dashboard`, { waitUntil: "networkidle" });
  const create = page.locator("button.dashboard-create-button").first();
  await create.waitFor({ state: "visible", timeout: 20_000 });
  await create.click();
  const input = page.locator("#new-project-name");
  await input.waitFor({ state: "visible", timeout: 10_000 });
  await input.fill(`taggroup-chip-${Date.now()}`);
  await input.press("Enter");
  await page.waitForURL(/\/builder\/[^/?]+$/, { timeout: 90_000 });
  await waitReady(page);

  const ID = "probe-taggroup";
  const seeded = await page.evaluate(
    async ({ id, labels }) => {
      const st = window.__composition_STORE__.getState();
      const body = st.elements.find(
        (e) => e.type === "body" && e.page_id === st.currentPageId,
      );
      const now = new Date().toISOString();
      st.addElement({
        id,
        customId: id,
        type: "ref",
        ref: "component-taggroup",
        componentName: "TagGroup",
        parent_id: body.id,
        page_id: st.currentPageId,
        props: {},
        created_at: now,
        updated_at: now,
      });
      await new Promise((r) => setTimeout(r, 600));
      for (const label of labels) await st.addItem(id, "items", { label });
      await new Promise((r) => setTimeout(r, 800));
      const el = window.__composition_STORE__
        .getState()
        .elements.find((e) => e.id === id);
      return el?.props?.items?.map((it) => it.label) ?? [];
    },
    { id: ID, labels: LABELS },
  );
  record(
    "instance 에 items 추가",
    LABELS.every((l) => seeded.includes(l)),
    seeded.join(","),
  );

  // stage 를 뷰포트 안에 · 선택/hover 해제
  await page.evaluate((id) => {
    const st = window.__composition_STORE__.getState();
    const el = st.elements.find((e) => e.id === id);
    const positions = st.pagePositions;
    const pos = (positions instanceof Map
      ? positions.get(el.page_id)
      : positions?.[el.page_id]) ?? { x: 0, y: 0 };
    const l = window.__composition_LAYOUT_DEBUG__
      ?.getSharedLayoutMap?.()
      .get(id);
    window.__composition_APPLY_VIEWPORT__?.({
      scale: 2,
      x: 100 - 2 * (pos.x + (l?.x ?? 0)),
      y: 140 - 2 * (pos.y + (l?.y ?? 0)),
    });
    st.setSelectedElement(null);
    st.setSelectedElements?.([]);
    st.setHoveredElementId?.(null);
  }, ID);
  await page.waitForTimeout(1000);
  await page
    .locator("canvas")
    .first()
    .screenshot({ path: `${OUT_DIR}/skia.png` });

  const skia = await page.evaluate((id) => {
    const map = window.__composition_LAYOUT_DEBUG__.getSharedLayoutMap();
    const c = document.createElement("canvas").getContext("2d");
    const rows = [];
    for (const [key, l] of map.entries()) {
      if (!String(key).includes(`tag-row:${id}`)) continue;
      const d = window.__composition_RENDER_DEBUG__.resolveTextNodeDebug(key);
      if (!d || String(key).endsWith("__show_all__")) continue;
      c.font = `${d.fontWeight ?? 400} ${d.fontSize}px ${d.fontFamilies.join(", ")}`;
      rows.push({
        label: d.content,
        layoutW: l.width,
        layoutH: l.height,
        textH: d.height,
        paddingTop: d.paddingTop,
        maxWidth: d.maxWidth,
        c2dW: c.measureText(d.content).width,
        lines: d.lines?.length ?? 0,
        drawY: d.origin?.y ?? null,
        fontWeight: d.fontWeight,
      });
    }
    return rows;
  }, ID);
  const byLabel = Object.fromEntries(skia.map((r) => [r.label, r]));
  const spaced = LABELS.filter((l) => l.includes(" ")).map((l) => byLabel[l]);

  record(
    "1. 텍스트 상자 1줄 · chip 30 · paddingTop 5 (공백 라벨 포함)",
    skia.length > 0 &&
      skia.every(
        (r) =>
          r.lines === 1 &&
          r.textH === 30 &&
          r.paddingTop === 5 &&
          r.layoutH === 30,
      ),
    skia
      .map(
        (r) =>
          `${r.label}: lines ${r.lines} · h ${r.textH} · padT ${r.paddingTop}`,
      )
      .join(" | "),
  );
  record(
    "2. chip content 폭 ≥ 글자 폭 (nowrap 넘침 없음) · weight 400",
    skia.every((r) => r.maxWidth >= r.c2dW && r.fontWeight === 400),
    skia
      .map((r) => `${r.label}: ${r.maxWidth} ≥ ${r.c2dW.toFixed(1)}`)
      .join(" | "),
  );
  const noDescender = skia.filter(
    (r) => !/[gjpqy]/.test(r.label) && r.drawY != null,
  );
  const ys = noDescender.map((r) => r.drawY);
  record(
    "4. 공백 라벨 draw y = 무공백 라벨 draw y (descender 없는 라벨, 차 < 0.5)",
    spaced.every((r) => r && r.drawY != null) &&
      Math.max(...ys) - Math.min(...ys) < 0.5,
    noDescender.map((r) => `${r.label}: y ${r.drawY?.toFixed(2)}`).join(" | "),
  );

  // DOM leg — Compare mode Preview
  const compare = page
    .locator(".header_right .builder-control-group button")
    .first();
  if (
    (await compare.getAttribute("aria-pressed")) !== "true" &&
    (await compare.getAttribute("aria-checked")) !== "true"
  ) {
    await compare.click();
    await page.waitForTimeout(3000);
  }
  await page
    .waitForFunction(
      () =>
        [...document.querySelectorAll("iframe")].some((f) =>
          f.contentDocument?.querySelector(".react-aria-Tag"),
        ),
      null,
      { timeout: 15_000 },
    )
    .catch(() => {});
  const dom = await page.evaluate(() => {
    for (const f of document.querySelectorAll("iframe")) {
      const tags = f.contentDocument?.querySelectorAll(".react-aria-Tag");
      if (!tags?.length) continue;
      return [...tags].map((t) => {
        const r = t.getBoundingClientRect();
        return { label: t.textContent.trim(), w: r.width, h: r.height };
      });
    }
    return [];
  });
  const domByLabel = Object.fromEntries(dom.map((r) => [r.label, r]));
  const widthRows = skia
    .filter((r) => domByLabel[r.label])
    .map((r) => ({
      label: r.label,
      dw: Math.abs(domByLabel[r.label].w - r.layoutW),
      domH: domByLabel[r.label].h,
    }));
  record(
    "3. 레이아웃 chip 높이 = DOM 30 · 폭 차 ≤ 3px",
    widthRows.length > 0 && widthRows.every((r) => r.domH === 30 && r.dw <= 3),
    widthRows
      .map((r) => `${r.label}: Δw ${r.dw.toFixed(2)} · domH ${r.domH}`)
      .join(" | "),
  );
  await page.screenshot({ path: `${OUT_DIR}/compare.png` });
  record("page error 0", errors.length === 0, String(errors.length));
} finally {
  await browser.close();
}

const pass = results.filter((r) => r.ok).length;
console.log(`[taggroup chip] ${pass}/${results.length} PASS`);
process.exit(pass === results.length ? 0 : 1);
