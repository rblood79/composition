#!/usr/bin/env node
// S2 체크리스트 §6 검증 잔여 (2026-11-22) — field · picker FieldGroup 커밋 (33b1133b8) live (headed Chrome).
//   열 가지 field 를 놓고, 상자를 그리는 control Group 의 자리 · 크기를 Canvas 와 Publish 에서 잰다.
//   ① Canvas — 각 field 의 Group 상자 (field 기준 x · y · 폭 · 높이)
//   ② Publish — 같은 Group 의 DOM 상자가 Canvas 와 0.5 안에서 같다
//   ③ Publish — 상자는 Group 이 그리고 안의 Input / DateInput 은 테두리 · 배경이 없다
//   ④ page error 0
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/s2-fieldgroup-live.mjs <out-dir>
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";

const OUT = process.argv[2] ?? "/private/tmp/s2-fieldgroup-live";
mkdirSync(OUT, { recursive: true });
const REPO = process.cwd();
const BASE = process.env.BUILDER_URL ?? "http://localhost:5173";
const FIELDS = [
  "TextField",
  "TextArea",
  "NumberField",
  "SearchField",
  "ComboBox",
  "ColorField",
  "DateField",
  "TimeField",
  "DatePicker",
  "DateRangePicker",
];

const results = [];
const record = (id, pass, detail) => {
  results.push({ id, pass, detail });
  process.stdout.write(
    `${pass ? "PASS" : "FAIL"} ${id} — ${JSON.stringify(detail).slice(0, 1500)}\n`,
  );
};

const state = JSON.parse(
  readFileSync(`${REPO}/apps/builder/scripts/.auth-session.json`, "utf8"),
);
state.origins = (state.origins ?? []).map((o) => ({ ...o, origin: BASE }));
const browser = await chromium.launch({ headless: false, channel: "chrome" });
const context = await browser.newContext({
  storageState: state,
  viewport: { width: 1920, height: 1000 },
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
  await page.keyboard.type("S2 fieldgroup live");
  await page.keyboard.press("Enter");
  await page.waitForURL(/\/builder\//, { timeout: 30000 });
  await page.waitForFunction(
    () => window.__COMPOSITION_CATALOG__?.workspace,
    null,
    { timeout: 30000 },
  );
  await page.waitForTimeout(1500);

  await page.evaluate((fields) => {
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
    for (const type of fields) {
      ws.selectRecords([]);
      ws.execute(h.palette.catalogPaletteInsertPlan(ctx(), type).command);
    }
    ws.selectRecords([]);
  }, FIELDS);
  await page.waitForTimeout(1500);

  // Geometry is parent-relative — walk from the field, adding offsets.
  const canvas = await page.evaluate((fields) => {
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    const r = ws.root;
    const g = (id) => r.getGeometry([id]).get(id);
    const name = (rec) => r.typeOf(rec);
    const out = {};
    const used = new Set();
    for (const type of fields) {
      const want = type === "TextArea" ? "TextField" : type;
      const field = [...r.canvasInputs.values()].find(
        (x) =>
          name(x) === type &&
          x.sourceId?.startsWith("project:") &&
          !used.has(x.id),
      );
      if (!field) continue;
      used.add(field.id);
      let found = null;
      const walk = (id, ox, oy) => {
        if (found) return;
        const node = r.canvasInputs.get(id);
        const rect = g(id);
        if (!node || !rect) return;
        const x = ox + rect.x;
        const y = oy + rect.y;
        if (name(node) === "Group" && !node.hidden) {
          found = { id, x, y, w: rect.width, h: rect.height };
          return;
        }
        for (const c of node.children ?? []) walk(c, x, y);
      };
      for (const c of field.children ?? []) walk(c, 0, 0);
      out[type] = found && { ...found, fieldId: field.id, domClass: want };
    }
    return out;
  }, FIELDS);
  await page.screenshot({ path: `${OUT}/1-canvas.png` });
  record(
    "① Canvas — every field has a drawn control Group",
    FIELDS.every((t) => canvas[t] && canvas[t].w > 0 && canvas[t].h > 0),
    canvas,
  );

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
  await pub.waitForURL((url) => String(url) !== "about:blank", {
    timeout: 30000,
  });
  await pub.waitForSelector(".react-aria-DateRangePicker", { timeout: 60000 });
  await pub.waitForTimeout(1200);
  const dom = await pub.evaluate((canvas) => {
    const out = {};
    for (const [type, c] of Object.entries(canvas)) {
      if (!c) continue;
      const field = document.querySelector(
        `[data-catalog-id="${CSS.escape(c.fieldId)}"]`,
      );
      if (!field) continue;
      const group =
        document.querySelector(`[data-catalog-id="${CSS.escape(c.id)}"]`) ??
        field.querySelector(".react-aria-Group");
      const f = field.getBoundingClientRect();
      const b = group?.getBoundingClientRect();
      const gs = group && getComputedStyle(group);
      const inner = field.querySelector(
        ".react-aria-Input, .react-aria-TextArea, .react-aria-DateInput",
      );
      const is = inner && getComputedStyle(inner);
      out[type] = b && {
        x: b.x - f.x,
        y: b.y - f.y,
        w: b.width,
        h: b.height,
        groupBorder: gs.borderTopWidth,
        groupBg: gs.backgroundColor,
        innerBorder: is?.borderTopWidth ?? null,
        innerBg: is?.backgroundColor ?? null,
      };
    }
    return out;
  }, canvas);
  await pub.screenshot({ path: `${OUT}/2-publish.png` });
  const near = (a, b) => Math.abs(a - b) < 0.5;
  const diffs = FIELDS.filter((t) => {
    const c = canvas[t];
    const d = dom[t];
    return !(
      c &&
      d &&
      near(c.x, d.x) &&
      near(c.y, d.y) &&
      near(c.w, d.w) &&
      near(c.h, d.h)
    );
  });
  record(
    "② Publish — each Group box = Canvas (±0.5)",
    diffs.length === 0,
    { diffs, canvas: Object.fromEntries(diffs.map((t) => [t, canvas[t]])), dom: Object.fromEntries(diffs.map((t) => [t, dom[t]])) },
  );
  const boxed = FIELDS.filter((t) => {
    const d = dom[t];
    return !(
      d &&
      d.groupBorder !== "0px" &&
      (d.innerBorder === null || d.innerBorder === "0px") &&
      (d.innerBg === null ||
        d.innerBg === "rgba(0, 0, 0, 0)" ||
        d.innerBg === "transparent")
    );
  });
  record(
    "③ Publish — the Group draws the box; the inner Input / DateInput has none",
    boxed.length === 0,
    { offenders: Object.fromEntries(boxed.map((t) => [t, dom[t]])) },
  );
  record("④ no page errors", errors.length === 0, errors);
} finally {
  writeFileSync(
    `${OUT}/result.json`,
    JSON.stringify({ results, errors }, null, 2),
  );
  await browser.close();
}
