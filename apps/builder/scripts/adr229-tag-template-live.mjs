#!/usr/bin/env node
// adr229-tag-template-live.mjs — ADR-229 Phase 1 live (실제 빌더, headed Playwright).
//   TagGroup chip item template origin (`component-tag-item-default` / `-selected`) 이 실제 문서에
//   시드되고, 사용자 페이지의 TagGroup instance chip 이 그 origin 을 두 leg (Skia · Preview) 에서 읽는가.
//   P1-a) 신규 프로젝트 — item origin 2 (자식 Icon·Avatar·Text) + `component-taggroup` 의 TagList 자식 slot
//   P1-b) instance chip 기준값 — Skia rect 높이 = Preview chip 높이 (30, md)
//   P1-c) default origin root style 편집 (padding 24/8) → Skia rect · Preview computed 둘 다 따라감 · 높이 동일
//   P1-d) default origin 의 Avatar slot 자식 삭제 → avatar 데이터 chip 이 두 leg 모두 icon 으로 (존재 gating)
//   P1-e) label slot 자식 fontSize 편집 → chip 글자 크기 (Preview computed font-size · Skia 텍스트 상자)
//   P1-f) Undo 로 origin 원상 → chip 원상 · reload → origin 편집 보존 · Components body Δ0 (재hydration 멱등)
//   page error 0 · dialog 0
// 사용: node apps/builder/scripts/adr229-tag-template-live.mjs [--headed]  (dev 5173 · .auth-session.json)
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { waitReady } from "./perf-baseline.mjs";

const BASE_URL = "http://localhost:5173";
const STORAGE_STATE = resolve("apps/builder/scripts/.auth-session.json");
const OUT_DIR = process.env.ADR229_OUT ?? "/private/tmp/adr229-tag-live";
const headed = process.argv.includes("--headed");
const log = (...a) => console.log("[adr229 tag live]", ...a);
const findings = [];
const record = (name, pass, detail) => {
  findings.push({ name, pass, detail });
  log(`${pass ? "PASS" : "FAIL"} — ${name} :: ${detail}`);
};

const DEFAULT_ORIGIN = "component-tag-item-default";
const SELECTED_ORIGIN = "component-tag-item-selected";
const TAGGROUP_ORIGIN = "component-taggroup";
const INSTANCE_ID = "adr229-tg-1";
const TAGLIST_SYNTH = `${INSTANCE_ID}/${TAGGROUP_ORIGIN}__2`;
const AVATAR_PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
const ITEMS = [
  { id: "a", label: "Alpha", icon: "star", avatar: AVATAR_PNG },
  { id: "b", label: "Beta", icon: "inbox" },
  { id: "c", label: "Gamma" },
];

const state = (page, fn, arg) => page.evaluate(fn, arg);
const elementById = (page, id) =>
  state(
    page,
    (id) => {
      const e = window.__composition_STORE__
        .getState()
        .elements.find((x) => x.id === id);
      return e
        ? {
            id: e.id,
            type: e.type,
            ref: e.ref ?? null,
            reusable: e.reusable ?? null,
            slot: e.slot ?? null,
            props: e.props ?? {},
            parent_id: e.parent_id ?? null,
          }
        : null;
    },
    id,
  );
const childrenOf = (page, id) =>
  state(
    page,
    (id) =>
      window.__composition_STORE__
        .getState()
        .elements.filter((e) => e.parent_id === id)
        .map((e) => ({ id: e.id, type: e.type, slot: e.slot ?? null, props: e.props })),
    id,
  );
/** Skia leg — synthetic TagList 의 chip layout rect (itemKey 별). */
const chipRects = (page) =>
  state(
    page,
    (tagListId) => {
      const map = window.__composition_LAYOUT_DEBUG__.getSharedLayoutMap();
      const out = {};
      for (const [key, l] of map.entries()) {
        const prefix = `projection:tag-row:${tagListId}:`;
        if (!String(key).startsWith(prefix)) continue;
        const itemKey = String(key).slice(prefix.length);
        const text = window.__composition_RENDER_DEBUG__?.resolveTextNodeDebug?.(key);
        out[itemKey] = {
          w: Math.round(l.width * 100) / 100,
          h: Math.round(l.height * 100) / 100,
          fontSize: text?.fontSize ?? null,
          textX: text?.x ?? text?.drawX ?? null,
        };
      }
      return out;
    },
    TAGLIST_SYNTH,
  );
/** Preview leg — instance wrapper 안 chip (label 별) computed. */
const previewChips = (page) =>
  state(page, (instanceId) => {
    for (const f of document.querySelectorAll("iframe")) {
      const doc = f.contentDocument;
      const wrapper = doc?.querySelector(`[data-element-id="${instanceId}"]`);
      const tags = wrapper?.querySelectorAll(
        ".tag-list-wrapper .react-aria-Tag, .react-aria-TagList .react-aria-Tag",
      );
      if (!tags?.length) continue;
      const out = {};
      for (const t of tags) {
        const r = t.getBoundingClientRect();
        if (r.width === 0) continue;
        const cs = doc.defaultView.getComputedStyle(t);
        const leading = t.querySelector(".tag-leading-avatar")
          ? "avatar"
          : t.querySelector(".tag-leading-icon")
            ? "icon"
            : null;
        out[t.textContent.trim()] = {
          w: Math.round(r.width * 100) / 100,
          h: Math.round(r.height * 100) / 100,
          paddingLeft: cs.paddingLeft,
          paddingTop: cs.paddingTop,
          fontSize: cs.fontSize,
          borderColor: cs.borderColor,
          selected: t.getAttribute("data-selected") === "true",
          leading,
        };
      }
      return out;
    }
    return null;
  }, INSTANCE_ID);
async function waitChips(page, predicate, ms = 10_000) {
  const start = Date.now();
  let last = { skia: await chipRects(page), preview: await previewChips(page) };
  while (!predicate(last) && Date.now() - start < ms) {
    await page.waitForTimeout(500);
    last = { skia: await chipRects(page), preview: await previewChips(page) };
  }
  return last;
}
async function ensureCompareMode(page) {
  const compare = page
    .locator(".header_right .builder-control-group button")
    .first();
  if (
    (await compare.getAttribute("aria-pressed")) !== "true" &&
    (await compare.getAttribute("aria-checked")) !== "true"
  ) {
    await compare.click();
    await page.waitForTimeout(2500);
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
}
const approx = (a, b, tol = 1) =>
  typeof a === "number" && typeof b === "number" && Math.abs(a - b) <= tol;
const componentsBodySnapshot = (page) =>
  state(page, () => {
    const st = window.__composition_STORE__.getState();
    const body = st.elements.find((e) => e.id === "page-components-body");
    const sub = (id) =>
      st.elements
        .filter((e) => e.parent_id === id)
        .map((e) => ({ id: e.id, type: e.type, slot: e.slot ?? null, props: e.props, children: sub(e.id) }));
    return {
      n: st.elements.length,
      order: st.elements.filter((e) => e.parent_id === body.id).map((e) => e.id),
      tag: sub("component-tag-item-default"),
      tagSelected: sub("component-tag-item-selected"),
      tagGroup: sub("component-taggroup"),
    };
  });

mkdirSync(OUT_DIR, { recursive: true });
const browser = await chromium.launch({ headless: !headed });
const context = await browser.newContext({
  storageState: STORAGE_STATE,
  viewport: { width: 1440, height: 900 },
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
  await input.fill(`adr229-tag-${Date.now()}`);
  await input.press("Enter");
  await page.waitForURL(/\/builder\/[^/?]+$/, { timeout: 90_000 });
  await waitReady(page);
  log("project", page.url().split("/builder/")[1]);

  // ── P1-a: seed ──
  const defaultOrigin = await elementById(page, DEFAULT_ORIGIN);
  const selectedOrigin = await elementById(page, SELECTED_ORIGIN);
  const defaultChildren = await childrenOf(page, DEFAULT_ORIGIN);
  const tagGroupChildren = await childrenOf(page, TAGGROUP_ORIGIN);
  const tagList = tagGroupChildren.find((c) => c.type === "TagList");
  record(
    "P1-a: item origin 2 (reusable · Tag · 자식 Icon/Avatar/Text) + component-taggroup 의 TagList 자식 slot [default, selected]",
    defaultOrigin?.reusable === true &&
      defaultOrigin?.type === "Tag" &&
      selectedOrigin?.reusable === true &&
      JSON.stringify(defaultChildren.map((c) => c.type)) ===
        JSON.stringify(["Icon", "Avatar", "Text"]) &&
      JSON.stringify(tagList?.slot) ===
        JSON.stringify([DEFAULT_ORIGIN, SELECTED_ORIGIN]),
    JSON.stringify({
      defaultOrigin: { type: defaultOrigin?.type, reusable: defaultOrigin?.reusable, parent: defaultOrigin?.parent_id },
      children: defaultChildren.map((c) => `${c.type}:${c.props?.slot}`),
      tagList: { id: tagList?.id, slot: tagList?.slot },
    }),
  );
  const bodyBefore = await componentsBodySnapshot(page);

  // ── instance + items (icon/avatar 데이터) ──
  await state(
    page,
    ({ INSTANCE_ID, ITEMS }) => {
      const st = window.__composition_STORE__.getState();
      const body = st.elements.find(
        (e) => e.type === "body" && e.page_id === st.currentPageId,
      );
      const now = new Date().toISOString();
      st.addElement({
        id: INSTANCE_ID,
        customId: INSTANCE_ID,
        type: "ref",
        ref: "component-taggroup",
        componentName: "TagGroup",
        parent_id: body.id,
        page_id: st.currentPageId,
        props: { items: ITEMS, selectedKeys: ["b"], selectionMode: "multiple", maxRows: 0 },
        created_at: now,
        updated_at: now,
      });
    },
    { INSTANCE_ID, ITEMS },
  );
  await page.waitForTimeout(1200);
  // stage 를 뷰포트 안에 · 선택 해제
  await state(page, (id) => {
    const st = window.__composition_STORE__.getState();
    const el = st.elements.find((e) => e.id === id);
    const positions = st.pagePositions;
    const pos = (positions instanceof Map
      ? positions.get(el.page_id)
      : positions?.[el.page_id]) ?? { x: 0, y: 0 };
    const l = window.__composition_LAYOUT_DEBUG__?.getSharedLayoutMap?.().get(id);
    window.__composition_APPLY_VIEWPORT__?.({
      scale: 1,
      x: 200 - (pos.x + (l?.x ?? 0)),
      y: 200 - (pos.y + (l?.y ?? 0)),
    });
    st.setSelectedElement(null);
  }, INSTANCE_ID);
  await page.waitForTimeout(800);
  await ensureCompareMode(page);

  // ── P1-b: 기준값 ──
  const base = await waitChips(
    page,
    (s) => s.skia.a && s.preview?.Alpha && s.preview?.Beta && s.preview?.Gamma,
  );
  const baseOk =
    approx(base.skia.a?.h, 30, 0.5) &&
    approx(base.preview?.Alpha?.h, 30, 0.5) &&
    base.preview?.Alpha?.leading === "avatar" &&
    base.preview?.Beta?.leading === "icon" &&
    base.preview?.Gamma?.leading === null &&
    approx(base.skia.a?.w, base.preview?.Alpha?.w, 3) &&
    approx(base.skia.c?.w, base.preview?.Gamma?.w, 3);
  record(
    "P1-b: 기준 — Skia chip 높이 30 = Preview 30 · avatar > icon > 없음 · 폭 차 ≤ 3",
    baseOk,
    JSON.stringify(base),
  );
  await page.screenshot({ path: resolve(OUT_DIR, "p1-b-base.png") });

  // ── P1-c: default origin root style 편집 ──
  await state(page, (id) => {
    const st = window.__composition_STORE__.getState();
    const el = st.elements.find((e) => e.id === id);
    st.updateElementProps(id, {
      style: { ...(el.props?.style ?? {}), paddingLeft: 24, paddingRight: 24, paddingTop: 8, paddingBottom: 8 },
    });
  }, DEFAULT_ORIGIN);
  const padded = await waitChips(
    page,
    (s) => s.preview?.Alpha?.paddingLeft === "24px" && approx(s.skia.a?.h, 38, 0.5),
  );
  const paddedOk =
    approx(padded.skia.a?.h, 38, 0.5) &&
    approx(padded.preview?.Alpha?.h, 38, 0.5) &&
    padded.preview?.Alpha?.paddingLeft === "24px" &&
    padded.preview?.Alpha?.paddingTop === "8px" &&
    approx(padded.skia.a?.w, padded.preview?.Alpha?.w, 3) &&
    padded.skia.c?.w - base.skia.c?.w > 20;
  record(
    "P1-c: default origin padding 24/8 → Skia chip 38 = Preview 38 · padding-left 24px · 폭 +24 이상 · 폭 차 ≤ 3",
    paddedOk,
    JSON.stringify({ skia: padded.skia, preview: padded.preview }),
  );
  await page.screenshot({ path: resolve(OUT_DIR, "p1-c-padding.png") });

  // ── P1-d: Avatar slot 자식 삭제 → 존재 gating ──
  await state(page, (id) => {
    const st = window.__composition_STORE__.getState();
    st.removeElement(id);
    st.setSelectedElement(null);
  }, `${DEFAULT_ORIGIN}__avatar`);
  const gated = await waitChips(
    page,
    (s) => s.preview?.Alpha?.leading === "icon",
  );
  const slotChildrenAfter = await childrenOf(page, DEFAULT_ORIGIN);
  // Skia: avatar (16+4=20) → icon (14+4=18) 이면 chip 폭이 2 줄어든다.
  const gatedOk =
    gated.preview?.Alpha?.leading === "icon" &&
    gated.preview?.Beta?.leading === "icon" &&
    approx(gated.skia.a?.w, padded.skia.a?.w - 2, 0.6) &&
    approx(gated.skia.a?.w, gated.preview?.Alpha?.w, 3) &&
    slotChildrenAfter.map((c) => c.type).join(",") === "Icon,Text";
  record(
    "P1-d: Avatar slot 자식 삭제 → avatar 데이터 chip 이 두 leg 모두 icon (Skia 폭 −2 · Preview .tag-leading-icon)",
    gatedOk,
    JSON.stringify({ skiaA: gated.skia.a, prevA: gated.preview?.Alpha, children: slotChildrenAfter.map((c) => c.type) }),
  );

  // ── P1-e: label slot fontSize 편집 ──
  await state(page, (id) => {
    const st = window.__composition_STORE__.getState();
    const el = st.elements.find((e) => e.id === id);
    st.updateElementProps(id, { style: { ...(el.props?.style ?? {}), fontSize: 18 } });
  }, `${DEFAULT_ORIGIN}__label`);
  const sized = await waitChips(
    page,
    (s) => s.preview?.Gamma?.fontSize === "18px" && s.skia.c?.fontSize === 18,
  );
  // DOM line-height 는 비율 토큰 (20/14) 이라 18px 글자에서 chip 이 25.71 + 16 + 2 = 43.7 로 자란다 —
  //   Canvas 도 같은 비율로 lineHeight 를 실어 높이가 같아야 한다.
  const sizedOk =
    sized.preview?.Gamma?.fontSize === "18px" &&
    sized.skia.c?.fontSize === 18 &&
    sized.skia.c?.w > gated.skia.c?.w &&
    approx(sized.skia.c?.w, sized.preview?.Gamma?.w, 3) &&
    approx(sized.skia.c?.h, sized.preview?.Gamma?.h, 1);
  record(
    "P1-e: label slot fontSize 18 → Preview chip font-size 18px · Skia 텍스트 18 · 폭 증가 · 폭 차 ≤ 3 · 높이 차 ≤ 1 (line-height 비율)",
    sizedOk,
    JSON.stringify({ skiaC: sized.skia.c, prevC: sized.preview?.Gamma }),
  );
  await page.screenshot({ path: resolve(OUT_DIR, "p1-e-fontsize.png") });

  // ── P1-f: Undo ×3 → 원상 · reload → 편집 보존 · Components body Δ0 ──
  await state(page, () => {
    const st = window.__composition_STORE__.getState();
    st.undo();
    st.undo();
    st.undo();
  });
  const restored = await waitChips(
    page,
    (s) =>
      approx(s.skia.a?.h, 30, 0.5) &&
      s.preview?.Alpha?.leading === "avatar" &&
      s.preview?.Alpha?.paddingLeft === base.preview?.Alpha?.paddingLeft &&
      s.preview?.Gamma?.fontSize === "14px",
    12_000,
  );
  record(
    "P1-f: Undo ×3 → origin 원상 → chip 30 · avatar 복귀 · Preview padding 12px",
    approx(restored.skia.a?.h, 30, 0.5) &&
      restored.preview?.Alpha?.leading === "avatar" &&
      restored.preview?.Alpha?.paddingLeft === base.preview?.Alpha?.paddingLeft,
    JSON.stringify({ skiaA: restored.skia.a, prevA: restored.preview?.Alpha }),
  );
  // 다시 padding 편집 → reload 보존 확인
  await state(page, (id) => {
    const st = window.__composition_STORE__.getState();
    const el = st.elements.find((e) => e.id === id);
    st.updateElementProps(id, { style: { ...(el.props?.style ?? {}), paddingTop: 8, paddingBottom: 8 } });
  }, DEFAULT_ORIGIN);
  await waitChips(page, (s) => approx(s.skia.a?.h, 38, 0.5));
  const bodyBeforeReload = await componentsBodySnapshot(page);
  await page.waitForTimeout(3000);
  await page.reload({ waitUntil: "networkidle" });
  await waitReady(page);
  await ensureCompareMode(page);
  const bodyAfterReload = await componentsBodySnapshot(page);
  const reloaded = await waitChips(
    page,
    (s) => approx(s.skia.a?.h, 38, 0.5) && s.preview?.Alpha?.paddingTop === "8px",
    15_000,
  );
  record(
    "P1-f: reload → origin 편집 (paddingTop 8) 보존 · chip 38 두 leg · Components body Δ0 · 최초 시드 대비 origin 3 그대로",
    approx(reloaded.skia.a?.h, 38, 0.5) &&
      reloaded.preview?.Alpha?.paddingTop === "8px" &&
      JSON.stringify(bodyBeforeReload) === JSON.stringify(bodyAfterReload) &&
      bodyAfterReload.order.filter((id) => id === DEFAULT_ORIGIN).length === 1 &&
      bodyAfterReload.order.length === bodyBefore.order.length,
    JSON.stringify({
      skiaA: reloaded.skia.a,
      prevA: reloaded.preview?.Alpha,
      nBefore: bodyBeforeReload.n,
      nAfter: bodyAfterReload.n,
      bodySame: JSON.stringify(bodyBeforeReload) === JSON.stringify(bodyAfterReload),
      originCount: bodyAfterReload.order.length,
    }),
  );
  await page.screenshot({ path: resolve(OUT_DIR, "p1-f-reload.png") });

  record(
    "page error 0 · dialog 0",
    errors.length === 0 && dialogs === 0,
    `${errors.length} / ${dialogs} ${errors.slice(0, 2).join(" | ")}`,
  );
} catch (e) {
  record("harness", false, String(e?.stack ?? e));
  await page.screenshot({ path: resolve(OUT_DIR, "error.png") }).catch(() => {});
} finally {
  writeFileSync(
    resolve(OUT_DIR, "findings.json"),
    JSON.stringify({ findings, errors, dialogs, at: new Date().toISOString() }, null, 2),
  );
  const pass = findings.filter((f) => f.pass).length;
  log(`${pass}/${findings.length} PASS · errors ${errors.length}`);
  await browser.close();
  process.exit(pass === findings.length ? 0 : 1);
}
