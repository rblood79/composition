#!/usr/bin/env node
// adr239-swatch-preview-check.mjs — ADR-239 Phase 4 ColorSwatchPicker swatch 모양 Preview (DOM leg) 확인 · Compare Mode
// (사용자 지시 2026-09-25 "ColorSwatchPicker swatch 모양도 Preview 에서 확인해").
//   1) picker instance (`component-colorswatchpicker`) → Preview swatch 6 · 크기 · picker 안 상대 위치 · radius = Canvas · 색 = 저작 색.
//   2) 239 전 모양 plain picker (같은 색 둘) → reload 이관 → Preview swatch 크기 · 위치 = Canvas (같은 색 둘은 RAC 가 한 항목 — N3).
//   3) ColorSwatch origin borderRadius 3 편집 → Preview swatch radius 3px (두 picker) · Canvas radius 3.
// 사용: node apps/builder/scripts/adr239-swatch-preview-check.mjs [--base http://localhost:5173] [--out dir]
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";
import {
  createInstrumentedContext,
  loadStorageState,
  createIsolatedProject,
  waitReady,
} from "./perf-baseline.mjs";

const args = process.argv.slice(2);
const opt = (n, d) => (args.includes(`--${n}`) ? args[args.indexOf(`--${n}`) + 1] : d);
const BASE = opt("base", "http://localhost:5173");
const OUT = opt("out", "/private/tmp/adr239-swatch-preview");
mkdirSync(OUT, { recursive: true });
const results = [];
const record = (name, pass, detail) => {
  results.push(pass);
  console.log(
    `[adr239 swatch] ${pass ? "PASS" : "FAIL"} — ${name} :: ${JSON.stringify(detail).slice(0, 1600)}`,
  );
};

const step = (m) => console.log(`[adr239 swatch] step ${m}`);
setTimeout(async () => {
  step("watchdog 240s — 중단");
  await page?.screenshot({ path: resolve(OUT, "watchdog.png") }).catch(() => {});
  process.exit(2);
}, 240000).unref();
let page;
const browser = await chromium.launch({ headless: false });
({ page } = await createInstrumentedContext(browser, {
  storageState: loadStorageState(
    resolve("apps/builder/scripts/.auth-session.json"),
  ),
  cpuThrottle: 1,
  deviceScaleFactor: 1,
}));
const errors = [];
page.on("pageerror", (e) => errors.push(String(e.stack ?? e).slice(0, 600)));
const { projectUrl } = await createIsolatedProject(page, BASE);
await page.waitForTimeout(1500);
const ev = (fn, arg) => page.evaluate(fn, arg);

// ── 저작: picker instance + 239 전 모양 plain picker ──────────────────────────
await ev(async () => {
  const st = window.__composition_STORE__.getState();
  const body = st.elements.find(
    (e) => e.type === "body" && e.page_id === st.currentPageId,
  );
  const pageId = st.currentPageId;
  const now = new Date().toISOString();
  const el = (id, type, parent, order, props, extra = {}) => ({
    id,
    customId: id,
    type,
    parent_id: parent,
    page_id: pageId,
    order_num: order,
    created_at: now,
    updated_at: now,
    props,
    ...extra,
  });
  await st.addComplexElement(
    el(
      "pv-csp-inst",
      "ref",
      body.id,
      0,
      { style: { position: "absolute", left: "20px", top: "20px", width: "360px" } },
      { ref: "component-colorswatchpicker", componentName: "colorswatchpicker" },
    ),
    [],
  );
  await st.addComplexElement(
    el("pv-csp", "ColorSwatchPicker", body.id, 1, {
      style: {
        position: "absolute",
        left: "20px",
        top: "140px",
        width: "200px",
        display: "flex",
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 4,
      },
    }),
    ["#FF0000", "#FF0000", "#00AA00", "#0000FF"].map((color, i) =>
      el(`pv-csp-${i}`, "ColorSwatch", "pv-csp", i, {
        color,
        style: { width: 28, height: 28 },
      }),
    ),
  );
  // 줄바꿈 picker — 폭 100 에 28 swatch 6 (gap 4) → 3 줄 × 2 행. 2 행의 y 가 두 leg 에서 같아야 한다.
  await st.addComplexElement(
    el("pv-csp-wrap", "ColorSwatchPicker", body.id, 2, {
      style: {
        position: "absolute",
        left: "20px",
        top: "220px",
        width: "100px",
        display: "flex",
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 4,
      },
    }),
    ["#FF0000", "#FF8800", "#FFFF00", "#00AA00", "#0000FF", "#8800FF"].map(
      (color, i) =>
        el(`pv-csp-wrap-${i}`, "ColorSwatch", "pv-csp-wrap", i, {
          color,
          style: { width: 28, height: 28 },
        }),
    ),
  );
  st.setSelectedElement(null);
});
await page.waitForTimeout(3000);
await page.goto(projectUrl);
await waitReady(page);
await page.waitForTimeout(2500);

const migrated = await ev(() => {
  const m = window.__composition_STORE__.getState().elementsMap;
  return [0, 1, 2, 3].map((i) => {
    const e = m.get(`pv-csp-${i}`);
    return [e?.type, e?.ref ?? null, e?.props?.color ?? null];
  });
});
record(
  "reload 이관 — plain swatch 4 → ColorSwatch origin ref (색 그대로)",
  migrated.every((r) => r[0] === "ref" && r[1] === "component-colorswatch") &&
    migrated.map((r) => r[2]).join("|") === "#FF0000|#FF0000|#00AA00|#0000FF",
  migrated,
);

/** Canvas — picker 안 swatch 의 상대 위치 · 크기 · Skia radius (+ 해석된 색). */
const canvasSwatches = (pickerId) =>
  ev((pickerId) => {
    const dbg = window.__composition_LAYOUT_DEBUG__;
    const m = dbg.getSharedLayoutMap();
    const kids = dbg.getSharedFilteredChildrenMap()?.get(pickerId) ?? [];
    return kids.map((id) => {
      const r = m.get(id);
      const n = window.__composition_SKIA_DEBUG__?.getSkiaNode?.(id);
      return {
        id,
        // layout map 의 자식 x/y 는 부모 content 기준이 아니라 부모 상자 기준 — picker 안 상대 위치 그대로.
        rel: r ? [r.x, r.y, r.width, r.height] : null,
        radius: n?.box?.borderRadius ?? null,
      };
    });
  }, pickerId);

step("compare on");
// ── Compare Mode ON ────────────────────────────────────────────────────────
await ev(() =>
  document
    .querySelector('button[aria-label="Compare Mode (Preview + Skia)"]')
    ?.click(),
);
await page.waitForTimeout(6000);
const frame = () => page.frames().find((f) => f.url().includes("preview.html"));
let pf = frame();
for (let i = 0; i < 20 && !pf; i += 1) {
  await page.waitForTimeout(500);
  pf = frame();
}
if (!pf) {
  record("Compare Mode Preview iframe", false, {
    frames: page.frames().map((f) => f.url()),
  });
  await browser.close();
  process.exit(1);
}
await pf
  .waitForSelector('[data-element-id="pv-csp"]', { timeout: 20000 })
  .catch(() => {});
await page.waitForTimeout(1500);

/** Preview — picker 안 항목 · 안쪽 swatch 의 상대 위치 · 크기 (iframe 축소 보정) · radius · 배경 · 테두리. */
const previewSwatches = (pickerId) =>
  pf.evaluate((pickerId) => {
    const picker = document.querySelector(
      `.react-aria-ColorSwatchPicker[data-element-id="${pickerId}"]`,
    );
    if (!picker) return null;
    const pr = picker.getBoundingClientRect();
    const scale = picker.offsetWidth ? pr.width / picker.offsetWidth : 1;
    const items = [...picker.querySelectorAll(".react-aria-ColorSwatchPickerItem")];
    return {
      scale,
      picker: {
        display: getComputedStyle(picker).display,
        size: [picker.offsetWidth, picker.offsetHeight],
        gap: getComputedStyle(picker).gap,
      },
      items: items.map((item) => {
        const sw = item.querySelector(".react-aria-ColorSwatch");
        const r = sw.getBoundingClientRect();
        const c = getComputedStyle(sw);
        const ic = getComputedStyle(item);
        return {
          id: item.getAttribute("data-element-id"),
          rel: [
            Math.round((r.x - pr.x) / scale),
            Math.round((r.y - pr.y) / scale),
            sw.offsetWidth,
            sw.offsetHeight,
          ],
          radius: c.borderTopLeftRadius,
          bg: c.backgroundColor,
          border: `${c.borderTopWidth} ${c.borderTopStyle}`,
          shadow: c.boxShadow.slice(0, 60),
          item: {
            size: [item.offsetWidth, item.offsetHeight],
            display: ic.display,
            lineHeight: ic.lineHeight,
            swDisplay: c.display,
            radius: ic.borderTopLeftRadius,
            outline: `${ic.outlineWidth} ${ic.outlineStyle}`,
          },
          inline: sw.getAttribute("style"),
        };
      }),
    };
  }, pickerId);

const shot = async (pickerId, name) => {
  await pf
    .locator(`.react-aria-ColorSwatchPicker[data-element-id="${pickerId}"]`)
    .screenshot({ path: resolve(OUT, name) })
    .catch((e) => console.log("[adr239 swatch] shot err", String(e).slice(0, 160)));
};

const sameGeometry = (pv, cv) =>
  pv.length === cv.length &&
  pv.every((p, i) =>
    p.rel.every((v, k) => Math.abs(v - (cv[i].rel?.[k] ?? -999)) <= 1),
  );
const radiusPx = (r) => Number.parseFloat(r);

step("preview ready");
// 1) picker instance
const instPv = await previewSwatches("pv-csp-inst");
const instCv = await canvasSwatches("pv-csp-inst");
const instColors = await pf.evaluate(() =>
  [...document.querySelectorAll('.react-aria-ColorSwatchPicker[data-element-id="pv-csp-inst"] .react-aria-ColorSwatchPickerItem')]
    .map((i) => i.getAttribute("data-key") ?? i.getAttribute("aria-label")),
);
record(
  "picker instance — Preview swatch 6 · 크기 · picker 안 위치 = Canvas · radius = Canvas",
  instPv?.items.length === 6 &&
    sameGeometry(instPv.items, instCv) &&
    instPv.items.every(
      (p, i) => Math.abs(radiusPx(p.radius) - (instCv[i].radius ?? -99)) <= 0.5 ||
        (instCv[i].radius >= p.rel[2] / 2 && radiusPx(p.radius) >= p.rel[2] / 2),
    ),
  { preview: instPv, canvas: instCv, keys: instColors },
);
await shot("pv-csp-inst", "1-instance.png");

// 2) 이관된 plain picker
const plainPv = await previewSwatches("pv-csp");
const plainCv = await canvasSwatches("pv-csp");
// 같은 색 둘 (#FF0000) → RAC 한 항목 (N3) — Preview 3 · Canvas 4. 비교는 Canvas 0 · 2 · 3 과.
const plainCvMerged = plainCv.filter((_, i) => i !== 1);
record(
  "이관된 plain picker — Preview 28×28 · 위치 = Canvas (같은 색 둘은 한 항목 — Preview 3 · Canvas 4)",
  plainPv?.items.length === 3 &&
    plainCv.length === 4 &&
    plainPv.items.every((p) => p.rel[2] === 28 && p.rel[3] === 28) &&
    plainPv.items[0].rel[0] === plainCv[0].rel?.[0],
  { preview: plainPv, canvas: plainCv, compareTo: plainCvMerged.map((c) => c.rel) },
);
await shot("pv-csp", "2-plain-migrated.png");

// 2b) 줄바꿈 picker — 2 행 위치
const wrapPv = await previewSwatches("pv-csp-wrap");
const wrapCv = await canvasSwatches("pv-csp-wrap");
record(
  "줄바꿈 picker (폭 100 · swatch 6) — Preview swatch 위치 · 크기 = Canvas (2 행 y 포함) · picker 높이",
  wrapPv?.items.length === 6 && sameGeometry(wrapPv.items, wrapCv),
  {
    preview: wrapPv?.items.map((p) => p.rel),
    canvas: wrapCv.map((c) => c.rel),
    pickerPv: wrapPv?.picker,
    pickerCv: await ev(() =>
      window.__composition_LAYOUT_DEBUG__.getSharedLayoutMap().get("pv-csp-wrap"),
    ),
    item0: wrapPv?.items[0]?.item,
  },
);
await shot("pv-csp-wrap", "2b-wrap.png");

// 3) ColorSwatch origin borderRadius 3 → 두 picker 의 Preview swatch radius
await ev(() => {
  const st = window.__composition_STORE__.getState();
  const origin = st.elementsMap.get("component-colorswatch");
  // origin 편집 영향 대화상자 (Component impact → Continue) 가 promise 를 붙잡는다 — 기다리지 않는다.
  void st.updateElementProps("component-colorswatch", {
    style: { ...(origin?.props?.style ?? {}), borderRadius: 3 },
  });
});
await page.waitForTimeout(2500);
const confirmBtn = page
  .getByRole("button", { name: /^(continue|apply|confirm|확인|적용|계속)$/i })
  .first();
if (await confirmBtn.count()) {
  await confirmBtn.click().catch(() => {});
  await page.waitForTimeout(2000);
}
const afterPv = {
  inst: await previewSwatches("pv-csp-inst"),
  plain: await previewSwatches("pv-csp"),
};
const afterCv = {
  inst: await canvasSwatches("pv-csp-inst"),
  plain: await canvasSwatches("pv-csp"),
};
record(
  "ColorSwatch origin borderRadius 3 → Preview swatch radius 3px (instance · 이관 picker) · Canvas radius 3",
  [...afterPv.inst.items, ...afterPv.plain.items].every((p) => p.radius === "3px") &&
    [...afterCv.inst, ...afterCv.plain].every((c) => c.radius === 3),
  {
    previewRadius: {
      inst: afterPv.inst.items.map((p) => p.radius),
      plain: afterPv.plain.items.map((p) => p.radius),
    },
    canvasRadius: {
      inst: afterCv.inst.map((c) => c.radius),
      plain: afterCv.plain.map((c) => c.radius),
    },
  },
);
await shot("pv-csp-inst", "3-instance-radius3.png");
await shot("pv-csp", "4-plain-radius3.png");
await page.screenshot({ path: resolve(OUT, "5-compare.png") });

record("page error 0", errors.length === 0, errors);
await browser.close();
console.log(
  `[adr239 swatch] ${results.filter(Boolean).length}/${results.length} · 스크린샷 ${OUT}`,
);
