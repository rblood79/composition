#!/usr/bin/env node
// S2 체크리스트 §4.1 ListBox live (2026-11-22) — a ListBox item's label · description text steps follow its
// size (S2 PickerItem: label = control font · description one step down) on the Canvas and in Publish.
//
// 새 프로젝트에 팔레트 ListBox 셋 (S · M · XL — 항목마다 label · description Text) 과 Select (L) 를 둔다.
//   ① Canvas record — label · description 글자 크기 · 상자 높이
//   ② Publish DOM — 같은 글자의 computed font-size · line-height · 상자 높이, Select 팝오버 안 항목 (L)
//   ③ 크기 편집 (S → L) 이 Canvas 에 바로 · Undo 로 되돌아옴
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/s2-listbox-text-live.mjs <out-dir>
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";

const OUT = process.argv[2] ?? "/private/tmp/s2-listbox-text-live";
mkdirSync(OUT, { recursive: true });
const REPO = process.cwd();
const BASE = process.env.BUILDER_URL ?? "http://localhost:5173";
const SIZES = ["S", "M", "XL"];
const EXPECT = {
  S: { label: 12, description: 11 },
  M: { label: 14, description: 12 },
  L: { label: 16, description: 14 },
  XL: { label: 18, description: 16 },
};

const results = [];
const record = (id, pass, detail) => {
  results.push({ id, pass, detail });
  process.stdout.write(
    `${pass ? "PASS" : "FAIL"} ${id} — ${JSON.stringify(detail).slice(0, 1200)}\n`,
  );
};

const state = JSON.parse(
  readFileSync(`${REPO}/apps/builder/scripts/.auth-session.json`, "utf8"),
);
state.origins = (state.origins ?? []).map((o) => ({ ...o, origin: BASE }));
const browser = await chromium.launch({ headless: false, channel: "chrome" });
const context = await browser.newContext({
  storageState: state,
  viewport: { width: 1400, height: 800 },
});
const errors = [];
const failed = [];
context.on(
  "response",
  (r) => r.status() >= 400 && failed.push(`${r.status()} ${r.url()}`),
);
const page = await context.newPage();
page.on("pageerror", (e) => errors.push(`builder: ${e.message}`));
page.on(
  "console",
  (m) => m.type() === "error" && errors.push(`builder console: ${m.text()}`),
);

try {
  await page.goto(`${BASE}/dashboard`);
  await page
    .getByRole("button", { name: /new project/i })
    .first()
    .click();
  await page.waitForTimeout(300);
  await page.keyboard.type("S2 listbox text live");
  await page.keyboard.press("Enter");
  await page.waitForURL(/\/builder\//, { timeout: 30000 });
  await page.waitForFunction(
    () => window.__COMPOSITION_CATALOG__?.workspace,
    null,
    { timeout: 30000 },
  );
  await page.waitForTimeout(1500);

  // Place the lists, size them, give each first item a description Text.
  const placed = await page.evaluate(
    async ({ SIZES }) => {
      const h = window.__COMPOSITION_CATALOG__;
      const ws = h.workspace;
      const set = (value) => ({ kind: "set", value });
      const ctx = () => ({
        graph: ws.runtime.graph,
        records: ws.root.domInputs,
        selection: () => ws.session.getSnapshot().selection,
        itemOfRecord: (i) => ws.itemOfRecord(i),
        pageContent: () => ({ kind: "node", id: "project:node:home-body" }),
        newId: ws.newId,
      });
      const typeOf = (r) => ws.root.typeOf(r);
      const recordsOf = (type) =>
        [...ws.root.domInputs.values()].filter((r) => typeOf(r) === type);
      const insert = (type) => {
        ws.selectRecords([]);
        const before = new Set(recordsOf(type).map((r) => r.id));
        ws.execute(h.palette.catalogPaletteInsertPlan(ctx(), type).command);
        return recordsOf(type).find((r) => !before.has(r.id));
      };
      const lists = [];
      for (const size of SIZES) {
        const list = insert("ListBox");
        ws.execute(
          h.commands.setFields({
            targets: [{ kind: "node", id: list.sourceId }],
            props: { size: set(size) },
          }),
        );
        lists.push({ size, sourceId: list.sourceId });
      }
      const select = insert("Select");
      ws.execute(
        h.commands.setFields({
          targets: [{ kind: "node", id: select.sourceId }],
          props: { size: set("L") },
        }),
      );
      // The structure of a placed list (to find its items' Text).
      const tree = (id, depth = 0) => {
        const r = ws.root.domInputs.get(id);
        return {
          type: typeOf(r),
          slot: r.props.slot,
          text: r.props.children,
          children: depth > 4 ? [] : r.children.map((c) => tree(c, depth + 1)),
        };
      };
      const first = recordsOf("ListBox")[0];
      return { lists, selectSource: select.sourceId, tree: tree(first.id) };
    },
    { SIZES },
  );
  writeFileSync(`${OUT}/tree.json`, JSON.stringify(placed.tree, null, 2));

  // (The palette ListBox's items carry a label and a description Text.)
  await page.waitForTimeout(800);

  const canvasRead = () =>
    page.evaluate(({ lists }) => {
      const ws = window.__COMPOSITION_CATALOG__.workspace;
      return lists.map(({ size, sourceId }) => {
        const list = [...ws.root.canvasInputs.values()].find(
          (r) => r.sourceId === sourceId,
        );
        const item = ws.root.canvasInputs.get(list.children[0]);
        const texts = item.children
          .map((c) => ws.root.canvasInputs.get(c))
          .filter((r) => ws.root.typeOf(r) === "Text");
        const geo = ws.root.getGeometry([item.id, ...texts.map((t) => t.id)]);
        const pick = (slot) => {
          const t = texts.find((r) => r.props.slot === slot);
          return (
            t && {
              fontSize: t.visual.fontSize,
              fontWeight: t.visual.fontWeight,
              height: geo.get(t.id)?.height,
            }
          );
        };
        return {
          size: list.props.size,
          itemHeight: geo.get(item.id)?.height,
          label: pick("label"),
          description: pick("description"),
        };
      });
    }, placed);
  const canvas = await canvasRead();
  record(
    "① Canvas — label · description follow the list size",
    canvas.every(
      (c) =>
        c.label?.fontSize === EXPECT[c.size].label &&
        c.description?.fontSize === EXPECT[c.size].description &&
        c.label.fontWeight === 500,
    ),
    canvas,
  );
  await page.screenshot({ path: `${OUT}/1-canvas.png` });

  // ③ an edit of the size and its undo.
  const edit = await page.evaluate(({ lists }) => {
    const h = window.__COMPOSITION_CATALOG__;
    const ws = h.workspace;
    const { sourceId } = lists[0];
    const read = () => {
      const list = [...ws.root.canvasInputs.values()].find(
        (r) => r.sourceId === sourceId,
      );
      const item = ws.root.canvasInputs.get(list.children[0]);
      return item.children
        .map((c) => ws.root.canvasInputs.get(c))
        .filter((r) => ws.root.typeOf(r) === "Text")
        .map((r) => [r.props.slot, r.visual.fontSize]);
    };
    ws.execute(
      h.commands.setFields({
        targets: [{ kind: "node", id: sourceId }],
        props: { size: { kind: "set", value: "L" } },
      }),
    );
    const afterEdit = read();
    ws.undo();
    const afterUndo = read();
    return { afterEdit, afterUndo };
  }, placed);
  record(
    "③ size S → L → Undo on the Canvas",
    JSON.stringify(edit.afterEdit) ===
      JSON.stringify([
        ["label", 16],
        ["description", 14],
      ]) &&
      JSON.stringify(edit.afterUndo) ===
        JSON.stringify([
          ["label", 12],
          ["description", 11],
        ]),
    edit,
  );
  await page.waitForTimeout(800);

  // ② Publish.
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
  pub.on(
    "console",
    (m) => m.type() === "error" && errors.push(`publish console: ${m.text()}`),
  );
  await pub.bringToFront();
  await pub.waitForURL((url) => String(url) !== "about:blank", {
    timeout: 30000,
  });
  await pub.waitForSelector(".react-aria-ListBox", { timeout: 60000 });
  await pub.waitForTimeout(800);
  const dom = await pub.evaluate(() =>
    [...document.querySelectorAll(".react-aria-ListBox")].map((list) => {
      const item = list.querySelector(".react-aria-ListBoxItem");
      const pick = (slot) => {
        const el = item.querySelector(`[slot="${slot}"]`);
        if (!el) return undefined;
        const cs = getComputedStyle(el);
        return {
          fontSize: parseFloat(cs.fontSize),
          fontWeight: Number(cs.fontWeight),
          lineHeight: cs.lineHeight,
          height: el.getBoundingClientRect().height,
        };
      };
      return {
        size: item.getAttribute("data-size"),
        itemHeight: item.getBoundingClientRect().height,
        label: pick("label"),
        description: pick("description"),
      };
    }),
  );
  record(
    "② Publish DOM = Canvas (font size · weight · text and item heights)",
    dom.length === canvas.length &&
      dom.every((d, i) => {
        const c = canvas[i];
        return (
          d.size === c.size &&
          d.label?.fontSize === c.label.fontSize &&
          d.label.fontWeight === 500 &&
          d.description?.fontSize === c.description.fontSize &&
          Math.abs(d.label.height - c.label.height) < 1 &&
          Math.abs(d.description.height - c.description.height) < 1 &&
          Math.abs(d.itemHeight - c.itemHeight) < 1
        );
      }),
    { dom, canvas },
  );
  await pub.screenshot({ path: `${OUT}/2-publish.png` });

  // ② Select (L) — its popover items.
  await pub.locator(".react-aria-Select button").first().click();
  await pub.waitForSelector(".react-aria-Popover .react-aria-ListBoxItem", {
    timeout: 10000,
  });
  await pub.waitForTimeout(400);
  const popover = await pub.evaluate(() =>
    [
      ...document.querySelectorAll(
        ".react-aria-Popover .react-aria-ListBoxItem",
      ),
    ]
      .slice(0, 2)
      .map((item) => {
        const label = item.querySelector('[slot="label"]') ?? item;
        return {
          size: item.getAttribute("data-size"),
          labelFont: parseFloat(getComputedStyle(label).fontSize),
          hasLabelSlot: !!item.querySelector('[slot="label"]'),
        };
      }),
  );
  record(
    "② Select L popover items — label 16",
    popover.length > 0 &&
      popover.every((p) => p.size === "L" && p.labelFont === 16),
    popover,
  );
  await pub.screenshot({ path: `${OUT}/3-select-popover.png` });
  await pub.keyboard.press("Escape");

  record("no page errors · console errors", errors.length === 0, errors);
} finally {
  writeFileSync(
    `${OUT}/result.json`,
    JSON.stringify({ results, errors, failed }, null, 2),
  );
  process.stdout.write(`failed responses: ${failed.join(" | ")}\n`);
  process.stdout.write(
    `errors ${errors.length}: ${errors.slice(0, 5).join(" | ")}\n`,
  );
  await browser.close();
}
