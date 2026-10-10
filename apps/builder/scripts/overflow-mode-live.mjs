// ADR-257 후속 live: S2 `overflowMode` on GridList (ListView — default truncate, the items'
// label · description) and Badge (default wrap). In the real Builder: a palette GridList, its
// first item's label made long → in Compare Mode the label is one line with an ellipsis on the
// Canvas and in the Preview, the cards as tall on both → the GridList's Overflow set to Wrap in
// the Design panel (Property tab) → the label wraps and the card grows the same on both legs, no
// reload → undo; a palette Badge with a long text at width 120 → wraps (default) on both legs →
// Overflow Truncate in the Design panel → one line cut with an ellipsis on both. Headed Chrome,
// saved auth session.
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/overflow-mode-live.mjs <out>
import { chromium } from "playwright";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const OUT = process.argv[2];
mkdirSync(OUT, { recursive: true });
const REPO = process.cwd();
const BASE = process.env.BUILDER_URL ?? "http://localhost:5173";
const state = JSON.parse(
  readFileSync(`${REPO}/apps/builder/scripts/.auth-session.json`, "utf8"),
);
state.origins = (state.origins ?? []).map((o) => ({ ...o, origin: BASE }));
const browser = await chromium.launch({ headless: false, channel: "chrome" });
const context = await browser.newContext({
  storageState: state,
  viewport: { width: 1600, height: 1000 },
  deviceScaleFactor: 2,
});
const page = await context.newPage();
const errors = [];
const results = [];
const record = (id, pass, detail) => {
  results.push({ id, pass, detail });
  process.stdout.write(
    `${pass ? "PASS" : "FAIL"} ${id} — ${JSON.stringify(detail).slice(0, 1400)}\n`,
  );
};
page.on("pageerror", (e) =>
  errors.push(`pageerror: ${e.message.slice(0, 300)}`),
);
page.on("console", (m) => {
  if (m.type() === "error") errors.push(`console: ${m.text().slice(0, 300)}`);
});
async function addFromPalette(label) {
  const search = page.getByLabel("Search components");
  if (!(await search.isVisible().catch(() => false)))
    await page
      .getByRole("button", { name: "Components", exact: true })
      .first()
      .click();
  await search.fill(label);
  await page.waitForTimeout(300);
  await page
    .locator(".list-item", { hasText: new RegExp(`^${label}$`, "i") })
    .first()
    .click();
  await page.waitForTimeout(800);
  await page.keyboard.press("Escape");
}
async function compareOn() {
  const button = page
    .getByRole("button", { name: "Compare Mode (Preview + Skia)", exact: true })
    .first();
  if (await button.isVisible().catch(() => false)) await button.click();
  await page.waitForTimeout(3000);
}
const ready = async () => {
  await page.waitForSelector(".app:not(.builder-booting)", { timeout: 30000 });
  await page.waitForFunction(
    () => window.__COMPOSITION_CATALOG__?.workspace,
    null,
    { timeout: 30000 },
  );
};
const commands = `/@fs${REPO}/packages/shared/src/catalog/commands/index.ts`;
const LONG =
  "a long label that does not fit in its card at all, not even close to it";

/** Records of a type under the newest `ownerType` record, in document order. */
const recordsOf = (type, ownerType) =>
  page.evaluate(
    ({ type, ownerType }) => {
      const root = window.__COMPOSITION_CATALOG__.workspace.root;
      const owner = [...root.canvasInputs.values()]
        .filter((r) => root.typeOf(r) === ownerType)
        .at(-1);
      const out = [];
      const walk = (id) => {
        const r = root.canvasInputs.get(id);
        if (!r) return;
        if (root.typeOf(r) === type)
          out.push({ id: r.id, parentId: r.parentId, slot: r.props.slot });
        for (const child of r.children) walk(child);
      };
      if (owner) walk(owner.id);
      return out;
    },
    { type, ownerType },
  );
const setOn = (id, props, visual = {}) =>
  page.evaluate(
    async ({ id, props, visual, commands }) => {
      const { setFields } = await import(commands);
      const ws = window.__COMPOSITION_CATALOG__.workspace;
      const set = (values) =>
        Object.fromEntries(
          Object.entries(values).map(([k, v]) => [k, { kind: "set", value: v }]),
        );
      ws.execute(
        setFields({
          targets: [ws.positionOfRecord(id).target],
          props: set(props),
          ...(Object.keys(visual).length ? { visual: set(visual) } : {}),
        }),
      );
    },
    { id, props, visual, commands },
  );
/** Canvas (engine rect) and Preview (DOM rect + computed text box) of each record. */
const boxes = (ids, textSelector) =>
  page.evaluate(
    ({ ids, textSelector }) => {
      const root = window.__COMPOSITION_CATALOG__.workspace.root;
      const doc = document.querySelector("#previewFrame")?.contentDocument;
      const round = (v) => Math.round(v * 100) / 100;
      const rects = root.getGeometry(ids);
      return ids.map((id) => {
        const r = rects.get(id);
        const el = doc?.querySelector(`[data-catalog-id="${CSS.escape(id)}"]`);
        const text = textSelector ? el?.querySelector(textSelector) : el;
        const style = text ? getComputedStyle(text) : undefined;
        const dom = el?.getBoundingClientRect();
        return {
          canvas: r ? [round(r.width), round(r.height)] : null,
          dom: dom ? [round(dom.width), round(dom.height)] : null,
          whiteSpace: style?.whiteSpace,
          textOverflow: style?.textOverflow,
          textAlign: style?.textAlign,
          overflow: style?.overflowX,
          clipped: text ? text.scrollWidth > text.clientWidth : null,
          visual: root.canvasInputs.get(id)?.visual.whiteSpace,
        };
      });
    },
    { ids, textSelector },
  );
const near = (box, tolerance) =>
  box.canvas &&
  box.dom &&
  Math.abs(box.canvas[0] - box.dom[0]) <= tolerance &&
  Math.abs(box.canvas[1] - box.dom[1]) <= tolerance;
const propertyTab = page.getByRole("tab", { name: "Property", exact: true });
/** The Design panel's Overflow field (Property tab) of the selected record → `option`. */
async function overflowFromPanel(recordId, option) {
  await page.evaluate(
    (id) => window.__COMPOSITION_CATALOG__.workspace.selectRecords([id]),
    recordId,
  );
  await page.waitForTimeout(800);
  if (!(await propertyTab.first().isVisible().catch(() => false)))
    await page
      .getByRole("button", { name: "Design", exact: true })
      .first()
      .click()
      .catch(() => {});
  await page.waitForTimeout(400);
  await propertyTab.first().click().catch(() => {});
  await page.waitForTimeout(600);
  const field = page
    .locator("fieldset", {
      has: page.locator("legend", { hasText: /^(Overflow|오버플로)$/ }),
    })
    .first();
  writeFileSync(
    `${OUT}/field-${option}.html`,
    (await field.evaluate((el) => el.outerHTML).catch(() => "none")) ?? "none",
  );
  // (A two-value enum is a segmented RAC ToggleButtonGroup — one radio per value.)
  await field.getByRole("radio", { name: option, exact: true }).click();
  await page.waitForTimeout(1500);
}

await page.goto(`${BASE}/dashboard`);
await page
  .getByRole("button", { name: /new project/i })
  .first()
  .click();
await page.waitForTimeout(300);
await page.keyboard.type("ADR-257 overflowMode");
await page.keyboard.press("Enter");
await page.waitForURL(/\/builder\//, { timeout: 30000 });
await ready();
await addFromPalette("grid list");
await page.waitForTimeout(800);
await compareOn();

// ── GridList (S2 ListView, default truncate) ──
const [list] = await recordsOf("GridList", "GridList");
const items = await recordsOf("GridListItem", "GridList");
const label = (await recordsOf("Text", "GridList")).find(
  (t) => t.parentId === items[0].id && t.slot !== "description",
);
// (A card narrower than the label: the GridList at 320.)
await setOn(list.id, {}, { width: 320 });
await setOn(label.id, { children: LONG });
await page.waitForTimeout(1500);
const itemIds = items.map((i) => i.id);
const [labelTrunc] = await boxes([label.id]);
const cardsTrunc = await boxes(itemIds);
record(
  "L1 GridList truncate (S2 default): the long label is one line clipped with an ellipsis on the Canvas and in the Preview; the cards as tall on both legs",
  labelTrunc.whiteSpace === "nowrap" &&
    labelTrunc.textOverflow === "ellipsis" &&
    labelTrunc.overflow === "hidden" &&
    labelTrunc.clipped === true &&
    labelTrunc.visual === "nowrap" &&
    near(labelTrunc, 0.5) &&
    labelTrunc.canvas[1] < 30 &&
    cardsTrunc.every((card) => near(card, 0.5)),
  { labelTrunc, cardsTrunc },
);
await page.screenshot({ path: `${OUT}/gridlist-truncate.png` });
await overflowFromPanel(list.id, "Wrap");
const [labelWrap] = await boxes([label.id]);
const cardsWrap = await boxes(itemIds);
record(
  "L2 GridList Overflow → Wrap (Design panel, no reload): the label wraps in its card and the card grows the same on the Canvas and in the Preview",
  labelWrap.whiteSpace === "normal" &&
    labelWrap.visual === "normal" &&
    labelWrap.canvas[1] > labelTrunc.canvas[1] * 1.5 &&
    near(labelWrap, 1) &&
    cardsWrap[0].canvas[1] > cardsTrunc[0].canvas[1] &&
    cardsWrap.every((card) => near(card, 1)),
  { labelWrap, cardsWrap },
);
await page.screenshot({ path: `${OUT}/gridlist-wrap.png` });
await page.evaluate(() => window.__COMPOSITION_CATALOG__.workspace.undo());
await page.waitForTimeout(1500);
const [labelUndo] = await boxes([label.id]);
record(
  "L3 undo: back to one line on both legs",
  labelUndo.whiteSpace === "nowrap" &&
    labelUndo.canvas[1] === labelTrunc.canvas[1] &&
    near(labelUndo, 0.5),
  { labelUndo },
);

// ── Badge (S2 default wrap) ──
await addFromPalette("badge");
await page.waitForTimeout(800);
const [badge] = await recordsOf("Badge", "Badge").then((all) =>
  all.length ? all : recordsOf("Badge", "body"),
);
await setOn(badge.id, { children: LONG }, { width: 120 });
await page.waitForTimeout(1500);
const [badgeWrap] = await boxes([badge.id], ".badge-text");
record(
  "L4 Badge wrap (S2 default): the long text wraps at the badge width (120) — the same box on the Canvas and in the Preview, lines centered as the Canvas box text",
  badgeWrap.whiteSpace === "normal" &&
    badgeWrap.textAlign === "center" &&
    badgeWrap.visual === "normal" &&
    badgeWrap.canvas[0] === 120 &&
    badgeWrap.canvas[1] > 40 &&
    near(badgeWrap, 1),
  { badgeWrap },
);
await page.screenshot({ path: `${OUT}/badge-wrap.png` });
await overflowFromPanel(badge.id, "Truncate");
const [badgeTrunc] = await boxes([badge.id], ".badge-text");
record(
  "L5 Badge Overflow → Truncate (Design panel, no reload): one line cut with an ellipsis at 120 on both legs",
  badgeTrunc.whiteSpace === "nowrap" &&
    badgeTrunc.textOverflow === "ellipsis" &&
    badgeTrunc.clipped === true &&
    badgeTrunc.visual === "nowrap" &&
    badgeTrunc.canvas[0] === 120 &&
    badgeTrunc.canvas[1] < badgeWrap.canvas[1] &&
    near(badgeTrunc, 0.5),
  { badgeTrunc },
);
await page.screenshot({ path: `${OUT}/badge-truncate.png` });
record("L6 no page errors", errors.length === 0, { errors });
writeFileSync(
  `${OUT}/results.json`,
  JSON.stringify({ results, errors }, null, 2),
);
await browser.close();
process.exit(results.every((r) => r.pass) ? 0 : 1);
