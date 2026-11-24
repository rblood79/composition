#!/usr/bin/env node
// S2 overlay 여백 live 대조 (2026-11-24, 사용자 「dialog, alert dialog, custom dialog, fullscreen dialog, sheet,
// popover, PreviewTrigger, ContextualHelp 모두 popover 내에 padding값이 일정하지가않다」).
//
// 새 프로젝트에 여덟 overlay 를 놓고, 각 본체 (Dialog · SheetContent · Popover · 그 안 첫 상자) 의
//   ① Canvas record 의 padding · gap
//   ② Publish 에서 trigger 를 눌러 연 DOM 의 computed padding · gap
// 을 대조한다.
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/s2-overlay-padding-live.mjs <out-dir>
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";

const OUT = process.argv[2] ?? "/private/tmp/s2-overlay-padding";
mkdirSync(OUT, { recursive: true });
const REPO = process.cwd();
const BASE = process.env.BUILDER_URL ?? "http://localhost:5173";
const TYPES = [
  "Dialog",
  "AlertDialog",
  "CustomDialog",
  "FullscreenDialog",
  "Sheet",
  "Popover",
  "PreviewTrigger",
  "ContextualHelp",
];
/** The overlay box types whose inset the row reports, and their first box. */
const BOX_TYPES = ["Dialog", "SheetContent", "Popover"];

const state = JSON.parse(
  readFileSync(`${REPO}/apps/builder/scripts/.auth-session.json`, "utf8"),
);
state.origins = (state.origins ?? []).map((o) => ({ ...o, origin: BASE }));
const browser = await chromium.launch({ headless: false, channel: "chrome" });
const context = await browser.newContext({
  storageState: state,
  viewport: { width: 1400, height: 900 },
});
const errors = [];
const page = await context.newPage();
page.on("pageerror", (e) => errors.push(`builder: ${e.message}`));

try {
  await page.goto(`${BASE}/dashboard`);
  await page
    .getByRole("button", { name: /new project/i })
    .first()
    .click();
  await page.waitForTimeout(300);
  await page.keyboard.type("S2 overlay padding");
  await page.keyboard.press("Enter");
  await page.waitForURL(/\/builder\//, { timeout: 30000 });
  await page.waitForFunction(
    () => window.__COMPOSITION_CATALOG__?.workspace,
    null,
    { timeout: 30000 },
  );
  await page.waitForTimeout(1500);

  const canvas = await page.evaluate(
    ({ TYPES, BOX_TYPES }) => {
      const h = window.__COMPOSITION_CATALOG__;
      const ws = h.workspace;
      const ctx = () => ({
        graph: ws.runtime.graph,
        records: ws.root.domInputs,
        selection: () => ws.session.getSnapshot().selection,
        itemOfRecord: (i) => ws.itemOfRecord(i),
        pageContent: () => ({ kind: "node", id: "project:node:home-body" }),
        newId: ws.newId,
      });
      const rows = [];
      for (const type of TYPES) {
        const before = new Set(ws.root.canvasInputs.keys());
        ws.selectRecords([]);
        ws.execute(h.palette.catalogPaletteInsertPlan(ctx(), type).command);
        const root = ws.root;
        const added = [...root.canvasInputs.values()].filter(
          (r) => !before.has(r.id),
        );
        const side = (r, key, axis) => {
          for (const k of [key, axis, "padding"]) {
            const v = r.derivedProps?.[k] ?? r.visual[k];
            if (v !== undefined) return Number(v);
          }
          return 0;
        };
        const pad = (r) =>
          [
            side(r, "paddingTop", "paddingY"),
            side(r, "paddingRight", "paddingX"),
            side(r, "paddingBottom", "paddingY"),
            side(r, "paddingLeft", "paddingX"),
          ].join(" ");
        const box = added.find((r) => BOX_TYPES.includes(root.typeOf(r)));
        const popover = added.find((r) => root.typeOf(r) === "Popover");
        const inner =
          popover &&
          added.find(
            (r) =>
              r.parentId === popover.id && root.typeOf(r) !== "OverlayArrow",
          );
        const trigger = added.find((r) =>
          ["Button", "ActionButton"].includes(root.typeOf(r)),
        );
        // The body's own ButtonGroup (S2 footer row — 16 above it) and the Modal (S2 `size` width).
        const buttons = added.find(
          (r) => r.parentId === box.id && root.typeOf(r) === "ButtonGroup",
        );
        const modal = added.find((r) => root.typeOf(r) === "Modal");
        rows.push({
          buttons: buttons && { id: buttons.id, marginTop: parseFloat(buttons.layout.marginTop ?? "0") },
          modal: modal && { id: modal.id, size: modal.props.size ?? null },
          type,
          trigger: trigger.id,
          box: { id: box.id, type: root.typeOf(box), pad: pad(box), gap: Number(box.visual.gap ?? 0) },
          inner: inner && { id: inner.id, type: root.typeOf(inner), pad: pad(inner) },
        });
      }
      return rows;
    },
    { TYPES, BOX_TYPES },
  );
  await page.waitForTimeout(2000);

  const popup = context.waitForEvent("page", { timeout: 30000 });
  await page.evaluate(() =>
    [...document.querySelectorAll("button")]
      .find((b) =>
        ["Preview", "미리보기"].includes(b.getAttribute("aria-label")),
      )
      ?.click(),
  );
  const pub = await popup;
  pub.on("pageerror", (e) => errors.push(`publish: ${e.message}`));
  await pub.bringToFront();
  await pub.waitForSelector("[data-catalog-id]", { timeout: 60000 });
  await pub.waitForTimeout(2000);

  const rows = [];
  for (const row of canvas) {
    const trigger = pub.locator(`[data-catalog-id="${row.trigger}"]`).first();
    // (PreviewTrigger opens on hover after its `delay` 600 — the others on press.)
    if (row.type === "PreviewTrigger") {
      await trigger.hover();
      await pub.waitForTimeout(1200);
    } else {
      await trigger.click();
      await pub.waitForTimeout(700);
    }
    const dom = await pub.evaluate(({ box, inner, buttons, modal }) => {
      const read = (id) => {
        const el = document.querySelector(`[data-catalog-id="${id}"]`);
        if (!el) return null;
        const cs = getComputedStyle(el);
        return {
          pad: [cs.paddingTop, cs.paddingRight, cs.paddingBottom, cs.paddingLeft]
            .map((v) => parseFloat(v))
            .join(" "),
          gap: parseFloat(cs.rowGap) || 0,
        };
      };
      const el = (id) => document.querySelector(`[data-catalog-id="${id}"]`);
      return {
        box: read(box.id),
        inner: inner ? read(inner.id) : null,
        buttonsMarginTop: buttons
          ? parseFloat(getComputedStyle(el(buttons.id)).marginTop)
          : null,
        modalWidth: modal
          ? Math.round(document.querySelector(".react-aria-Modal")?.getBoundingClientRect().width ?? 0)
          : null,
      };
    }, row);
    await pub.screenshot({ path: `${OUT}/${row.type}.png` });
    await pub.keyboard.press("Escape");
    await pub.mouse.move(1300, 850);
    await pub.waitForTimeout(500);
    rows.push({ ...row, dom });
  }
  writeFileSync(`${OUT}/result.json`, JSON.stringify({ rows, errors }, null, 2));
  for (const r of rows) {
    const same =
      r.dom.box?.pad === r.box.pad &&
      r.dom.box?.gap === r.box.gap &&
      (!r.inner || r.dom.inner?.pad === r.inner.pad) &&
      (!r.buttons || r.dom.buttonsMarginTop === r.buttons.marginTop);
    console.log(
      `${same ? "PASS" : "FAIL"} ${r.type.padEnd(16)} ${r.box.type} canvas ${r.box.pad} / gap ${r.box.gap}` +
        ` · dom ${r.dom.box?.pad} / gap ${r.dom.box?.gap}` +
        (r.inner ? ` | ${r.inner.type} canvas ${r.inner.pad} · dom ${r.dom.inner?.pad}` : "") +
        (r.buttons ? ` | ButtonGroup margin-top canvas ${r.buttons.marginTop} · dom ${r.dom.buttonsMarginTop}` : "") +
        (r.modal ? ` | Modal size ${r.modal.size} · dom width ${r.dom.modalWidth}` : ""),
    );
  }
  console.log(`errors: ${errors.length}`);
} finally {
  await browser.close();
}
