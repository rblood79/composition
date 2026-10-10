// ADR-257 Phase 1 live (G1): a Table's columns are the header row's and every Row's shared grid
// tracks. In the real Builder: a palette Table → Insert Column ×2 · Insert Row ×2 → Column widths
// 120 · 1fr · 2fr (the document command) → in Compare Mode, per column, the header cell and every
// Cell have the same x · width (≤ 0.5 px) on the Canvas (engine rects) and in the Preview (DOM
// rects), and the Canvas and the Preview agree → a width typed in the Design panel's Width field
// moves the whole column without a reload → undo → a palette TableView → reload keeps the widths.
// Headed Chrome, saved auth session.
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/table-column-tracks-live.mjs <out>
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
    `${pass ? "PASS" : "FAIL"} ${id} — ${JSON.stringify(detail).slice(0, 1200)}\n`,
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

await page.goto(`${BASE}/dashboard`);
await page
  .getByRole("button", { name: /new project/i })
  .first()
  .click();
await page.waitForTimeout(300);
await page.keyboard.type("ADR-257 column tracks");
await page.keyboard.press("Enter");
await page.waitForURL(/\/builder\//, { timeout: 30000 });
await ready();
await addFromPalette("table");
await page.waitForTimeout(800);
const commands = `/@fs${REPO}/packages/shared/src/catalog/commands/index.ts`;

/** Records of a type, in document order, under the `owner` record (the newest table by default). */
const recordsOf = (type, ownerType = "Table") =>
  page.evaluate(
    ({ type, ownerType }) => {
      const ws = window.__COMPOSITION_CATALOG__.workspace;
      const root = ws.root;
      const owners = [...root.canvasInputs.values()].filter(
        (r) => root.typeOf(r) === ownerType,
      );
      const owner = owners.at(-1);
      const out = [];
      const walk = (id) => {
        const r = root.canvasInputs.get(id);
        if (!r) return;
        if (root.typeOf(r) === type) out.push(r.id);
        for (const child of r.children) walk(child);
      };
      if (owner) walk(owner.id);
      return out;
    },
    { type, ownerType },
  );
async function insertVia(partType, label, times, ownerType = "Table") {
  const [id] = await recordsOf(partType, ownerType);
  await page.evaluate(
    (id) => window.__COMPOSITION_CATALOG__.workspace.selectRecords([id]),
    id,
  );
  await page.waitForTimeout(600);
  const button = page.getByRole("button", { name: label, exact: true }).first();
  if (!(await button.isVisible().catch(() => false))) {
    await page
      .getByRole("button", { name: "Design", exact: true })
      .first()
      .click()
      .catch(() => {});
    await page.waitForTimeout(800);
  }
  for (let k = 0; k < times; k++) {
    await page
      .getByRole("button", { name: label, exact: true })
      .first()
      .click();
    await page.waitForTimeout(500);
    await page.evaluate(
      (id) => window.__COMPOSITION_CATALOG__.workspace.selectRecords([id]),
      id,
    );
    await page.waitForTimeout(400);
  }
}
async function setWidths(widths, ownerType = "Table") {
  const columns = await recordsOf("Column", ownerType);
  await page.evaluate(
    async ({ columns, widths, commands }) => {
      const { setFields } = await import(commands);
      const ws = window.__COMPOSITION_CATALOG__.workspace;
      columns.forEach((id, index) => {
        const width = widths[index];
        if (width === undefined) return;
        // (A TableView's columns are its origin's template positions — the edit target.)
        ws.execute(
          setFields({
            targets: [ws.positionOfRecord(id).target],
            props: { width: { kind: "set", value: width } },
          }),
        );
      });
    },
    { columns, widths, commands },
  );
  await page.waitForTimeout(1200);
}
/**
 * Per row (header first): each cell's [x, width] relative to its row — the Canvas from the engine
 * rects (`getGeometry`, parent-relative), the Preview from the DOM (`getBoundingClientRect`).
 */
async function measure(ownerType = "Table") {
  const headers = await recordsOf("TableHeader", ownerType);
  const rows = await recordsOf("Row", ownerType);
  return page.evaluate(
    ({ headers, rows }) => {
      const ws = window.__COMPOSITION_CATALOG__.workspace;
      const root = ws.root;
      const doc = document.querySelector("#previewFrame")?.contentDocument;
      const round = (v) => Math.round(v * 100) / 100;
      const lines = [...headers, ...rows].map((lineId) => {
        const line = root.canvasInputs.get(lineId);
        const cells = line.children;
        const rects = root.getGeometry(cells);
        const canvas = cells.map((id) => {
          const r = rects.get(id);
          return [round(r.x), round(r.width)];
        });
        const dom = cells.map((id) => {
          const el = doc?.querySelector(`[data-catalog-id="${CSS.escape(id)}"]`);
          const row = el?.parentElement;
          if (!el || !row) return null;
          const a = el.getBoundingClientRect();
          const b = row.getBoundingClientRect();
          return [round(a.left - b.left), round(a.width)];
        });
        return { tracks: line.derivedProps?._tableTracks, canvas, dom };
      });
      return lines;
    },
    { headers, rows },
  );
}
const aligned = (lines, leg) => {
  const head = lines[0][leg];
  return lines.every((line) =>
    line[leg].every(
      (cell, i) =>
        cell &&
        head[i] &&
        Math.abs(cell[0] - head[i][0]) <= 0.5 &&
        Math.abs(cell[1] - head[i][1]) <= 0.5,
    ),
  );
};
const agree = (lines) =>
  lines.every((line) =>
    line.canvas.every(
      (cell, i) =>
        line.dom[i] &&
        Math.abs(cell[0] - line.dom[i][0]) <= 0.5 &&
        Math.abs(cell[1] - line.dom[i][1]) <= 0.5,
    ),
  );

await insertVia("TableHeader", "Insert Column", 3);
await insertVia("TableBody", "Insert Row", 2);
await compareOn();
await setWidths([120, "1fr", "2fr"]);
const m1 = await measure();
const w1 = m1[0].canvas.map((c) => c[1]);
record(
  "G1-1 widths 120 · 1fr · 2fr: every row on the same tracks; header and every Cell line up on the Canvas and in the Preview, and the two agree",
  m1.every((line) => line.tracks === m1[0].tracks) &&
    aligned(m1, "canvas") &&
    aligned(m1, "dom") &&
    agree(m1) &&
    w1[0] === 120 &&
    Math.abs(w1[2] - 2 * w1[1]) <= 1,
  { tracks: m1[0].tracks, header: m1[0], row1: m1[1] },
);

// The Design panel's Width field (Property tab) on the second column — no reload.
const [, second] = await recordsOf("Column");
await page.evaluate(
  (id) => window.__COMPOSITION_CATALOG__.workspace.selectRecords([id]),
  second,
);
await page.waitForTimeout(800);
const propertyTab = page.getByRole("tab", { name: "Property", exact: true });
if (!(await propertyTab.first().isVisible().catch(() => false))) {
  await page
    .getByRole("button", { name: "Design", exact: true })
    .first()
    .click()
    .catch(() => {});
  await page.waitForTimeout(800);
}
await propertyTab.first().click().catch(() => {});
await page.waitForTimeout(600);
const widthField = page
  .locator("fieldset:visible", {
    has: page.locator("legend", { hasText: /^Width$/ }),
  })
  .locator("input")
  .first();
await widthField.click();
await widthField.fill("160");
await widthField.press("Enter");
await page.waitForTimeout(1500);
const m2 = await measure();
record(
  "G1-2 Width 160 typed in the Design panel: the whole column follows without a reload (R1)",
  aligned(m2, "canvas") &&
    aligned(m2, "dom") &&
    agree(m2) &&
    m2[0].canvas[1][1] === 160,
  { tracks: m2[0].tracks, header: m2[0].canvas, row2: m2[2].canvas },
);

await page.evaluate(() => window.__COMPOSITION_CATALOG__.workspace.undo());
await page.waitForTimeout(1200);
const m3 = await measure();
record(
  "G1-3 undo: back to 120 · 1fr · 2fr in every row",
  m3[0].tracks === m1[0].tracks &&
    aligned(m3, "canvas") &&
    aligned(m3, "dom") &&
    agree(m3),
  { tracks: m3[0].tracks },
);

// TableView (palette): its rows take the same tracks.
await page.evaluate(() =>
  window.__COMPOSITION_CATALOG__.workspace.selectRecords([]),
);
await addFromPalette("table view");
await page.waitForTimeout(1000);
await setWidths([90], "TableView");
const m4 = await measure("TableView");
record(
  "G1-4 TableView: width 90 on the first column — header and Cells line up on both legs",
  m4[0].canvas[0][1] === 90 &&
    aligned(m4, "canvas") &&
    aligned(m4, "dom") &&
    agree(m4),
  { tracks: m4[0].tracks, header: m4[0], row: m4[1] },
);

await page.waitForTimeout(1500);
await page.reload();
await ready().catch((error) => {
  process.stdout.write(`BOOT-FAIL ${JSON.stringify(errors).slice(0, 3000)}\n`);
  throw error;
});
await page.waitForTimeout(2500);
await compareOn();
const m5 = await measure();
const m6 = await measure("TableView");
record(
  "G1-5 reopened: the same tracks (saved), still lined up",
  m5[0].tracks === m1[0].tracks &&
    m6[0].tracks === m4[0].tracks &&
    aligned(m5, "canvas") &&
    aligned(m5, "dom") &&
    agree(m5),
  { table: m5[0].tracks, tableView: m6[0].tracks },
);
// ── G2: colSpan (Phase 2) — the Design panel's Column span on the Table's first row cell ──
const [firstCell] = await recordsOf("Cell");
await page.evaluate(
  (id) => window.__COMPOSITION_CATALOG__.workspace.selectRecords([id]),
  firstCell,
);
await page.waitForTimeout(800);
if (!(await propertyTab.first().isVisible().catch(() => false))) {
  await page
    .getByRole("button", { name: "Design", exact: true })
    .first()
    .click()
    .catch(() => {});
  await page.waitForTimeout(800);
}
await propertyTab.first().click().catch(() => {});
await page.waitForTimeout(600);
const spanField = page
  .locator("fieldset:visible", {
    has: page.locator("legend", { hasText: /^Column span$/ }),
  })
  .locator("input")
  .first();
await spanField.click();
await spanField.fill("2");
await spanField.press("Enter");
await page.waitForTimeout(1500);
const spanned = async () => {
  const lines = await measure();
  return { lines, head: lines[0], row1: lines[1], row2: lines[2] };
};
const g2 = await spanned();
const covers = (cell, head, from, to) =>
  cell &&
  Math.abs(cell[0] - head[from][0]) <= 0.5 &&
  Math.abs(cell[0] + cell[1] - (head[to][0] + head[to][1])) <= 0.5;
record(
  "G2-1 Column span 2 (Design panel): the cell covers columns 1–2 exactly on the Canvas and in the Preview; the row keeps one cell per column; other rows unchanged",
  g2.row1.canvas.length === 2 &&
    covers(g2.row1.canvas[0], g2.head.canvas, 0, 1) &&
    covers(g2.row1.dom[0], g2.head.dom, 0, 1) &&
    covers(g2.row1.canvas[1], g2.head.canvas, 2, 2) &&
    agree([g2.row1]) &&
    aligned([g2.head, g2.row2], "canvas") &&
    aligned([g2.head, g2.row2], "dom"),
  { head: g2.head.canvas, row1: g2.row1, row2: g2.row2.canvas },
);
const ariaColspan = await page.evaluate((id) => {
  const doc = document.querySelector("#previewFrame")?.contentDocument;
  return doc
    ?.querySelector(`[data-catalog-id="${CSS.escape(id)}"]`)
    ?.getAttribute("aria-colspan");
}, firstCell);
record("G2-2 RAC gives the spanned cell aria-colspan 2", ariaColspan === "2", {
  ariaColspan,
});
// Delete the second column (crossed by the span): the span narrows, rows stay aligned.
const [, secondColumn] = await recordsOf("Column");
await page.evaluate(
  async ({ id, commands }) => {
    const { removeTargets } = await import(commands);
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    ws.execute(
      removeTargets({
        targets: [ws.positionOfRecord(id).target],
        newId: ws.newId,
      }),
    );
  },
  { id: secondColumn, commands },
);
await page.waitForTimeout(1500);
const g3 = await spanned();
record(
  "G2-3 deleting the crossed column narrows the span: every row one cell per column, lined up on both legs",
  g3.head.canvas.length === 2 &&
    g3.lines.every((line) => line.canvas.length === 2) &&
    aligned(g3.lines, "canvas") &&
    aligned(g3.lines, "dom") &&
    agree(g3.lines),
  { tracks: g3.head.tracks, head: g3.head.canvas, row1: g3.row1.canvas },
);
// ── G3: cell values · Table-wide values (Phase 3) ──
const tableId = (await recordsOf("Table", "Table"))[0];
const setOn = (id, props) =>
  page.evaluate(
    async ({ id, props, commands }) => {
      const { setFields } = await import(commands);
      const ws = window.__COMPOSITION_CATALOG__.workspace;
      ws.execute(
        setFields({
          targets: [ws.positionOfRecord(id).target],
          props: Object.fromEntries(
            Object.entries(props).map(([k, v]) => [k, { kind: "set", value: v }]),
          ),
        }),
      );
    },
    { id, props, commands },
  );
/** Row heights (header first) on both legs, and a cell's DOM text box. */
const rowHeights = async () => {
  const ids = [...(await recordsOf("TableHeader")), ...(await recordsOf("Row"))];
  return page.evaluate(
    ({ ids }) => {
      const root = window.__COMPOSITION_CATALOG__.workspace.root;
      const doc = document.querySelector("#previewFrame")?.contentDocument;
      const rects = root.getGeometry(ids);
      return ids.map((id) => {
        const el = doc?.querySelector(`[data-catalog-id="${CSS.escape(id)}"]`);
        return [
          Math.round(rects.get(id).height * 100) / 100,
          el ? Math.round(el.getBoundingClientRect().height * 100) / 100 : null,
        ];
      });
    },
    { ids },
  );
};
const cellText = (id) =>
  page.evaluate((id) => {
    const doc = document.querySelector("#previewFrame")?.contentDocument;
    const el = doc?.querySelector(`[data-catalog-id="${CSS.escape(id)}"]`);
    if (!el) return null;
    const style = getComputedStyle(el);
    const record = window.__COMPOSITION_CATALOG__.workspace.root.canvasInputs.get(id);
    return {
      whiteSpace: style.whiteSpace,
      textOverflow: style.textOverflow,
      textAlign: style.textAlign,
      borderRight: style.borderRightWidth,
      clipped: el.scrollWidth > el.clientWidth,
      visual: {
        whiteSpace: record?.visual.whiteSpace,
        textAlign: record?.visual.textAlign,
        borderRightWidth: record?.visual.borderRightWidth,
      },
    };
  }, id);
const [longCell] = await recordsOf("Cell");
await setOn(longCell, {
  children: "a long cell value that does not fit in its column at all, really",
});
await page.waitForTimeout(1200);
const truncated = await rowHeights();
const truncText = await cellText(longCell);
record(
  "G3-1 overflowMode truncate (S2 default): the long cell stays one line with an ellipsis on both legs — its row as tall as the others",
  truncText?.whiteSpace === "nowrap" &&
    truncText.textOverflow === "ellipsis" &&
    truncText.clipped &&
    truncated.every(
      ([canvas, dom]) =>
        dom !== null &&
        Math.abs(canvas - dom) <= 0.5 &&
        Math.abs(canvas - truncated[1][0]) <= 0.5,
    ),
  { truncText, truncated },
);
await setOn(tableId, { overflowMode: "wrap" });
await page.waitForTimeout(1500);
const wrapped = await rowHeights();
const wrapText = await cellText(longCell);
const wrapLines = await measure();
record(
  "G3-2 overflowMode wrap (no reload): the long cell wraps at its column, its row grows the same on the Canvas and in the Preview; columns stay lined up",
  wrapText?.whiteSpace === "normal" &&
    wrapped[1][0] > truncated[1][0] * 1.5 &&
    wrapped.every(
      ([canvas, dom]) => dom !== null && Math.abs(canvas - dom) <= 1,
    ) &&
    wrapped[2][0] === truncated[2][0] &&
    aligned(wrapLines, "canvas") &&
    agree(wrapLines),
  { wrapText, wrapped, truncated },
);
// Align end on one Cell, center on its Column (S2: the Column's is its header cell's only).
const columns = await recordsOf("Column");
const cells = await recordsOf("Cell");
await setOn(cells[1], { align: "end" });
await setOn(columns[1], { align: "center" });
await page.waitForTimeout(1200);
const alignedCell = await cellText(cells[1]);
const alignedColumn = await cellText(columns[1]);
const sibling = await cellText(cells[3]);
record(
  "G3-3 align: the Cell's end · the Column's center on their own boxes (Canvas record and Preview DOM); the column's other Cells stay start (S2 — 사용자 결정 7)",
  alignedCell?.textAlign === "right" &&
    alignedCell.visual.textAlign === "right" &&
    alignedColumn?.textAlign === "center" &&
    alignedColumn.visual.textAlign === "center" &&
    sibling?.textAlign === "left" &&
    sibling.visual.textAlign === undefined,
  { alignedCell, alignedColumn, sibling },
);
// showDivider from the Design panel (Property tab) on the first cell.
await page.evaluate(
  (id) => window.__COMPOSITION_CATALOG__.workspace.selectRecords([id]),
  cells[0],
);
await page.waitForTimeout(800);
await propertyTab.first().click().catch(() => {});
await page.waitForTimeout(600);
const before = await measure();
// (A boolean prop is a chip in its section's toggle group — RAC ToggleButton.)
await page
  .getByRole("button", { name: "Divider", exact: true })
  .first()
  .click();
await page.waitForTimeout(1500);
const divided = await cellText(cells[0]);
const after = await measure();
record(
  "G3-4 Show divider (Design panel): a 1px end line on the cell in both legs; the column boxes do not move",
  divided?.borderRight === "1px" &&
    divided.visual.borderRightWidth === 1 &&
    JSON.stringify(after.map((l) => l.canvas)) ===
      JSON.stringify(before.map((l) => l.canvas)) &&
    agree(after),
  { divided },
);
// selectionStyle highlight (Preview runtime): RAC replace behavior and the S2 highlight row.
await setOn(tableId, { selectionMode: "multiple", selectionStyle: "highlight" });
await page.waitForTimeout(1500);
const rows = await recordsOf("Row");
// A mouse press (pointer events, `pointerType: "mouse"`) — RAC toggles on a virtual press
// (`el.click()`) even in replace behavior, as a screen reader's.
const pressRow = (id) =>
  page.evaluate((id) => {
    const frame = document.querySelector("#previewFrame");
    const doc = frame?.contentDocument;
    const view = frame?.contentWindow;
    const cell = doc?.querySelector(
      `[data-catalog-id="${CSS.escape(id)}"] [role="rowheader"], [data-catalog-id="${CSS.escape(id)}"] [role="gridcell"]`,
    );
    if (!cell || !view) return;
    const r = cell.getBoundingClientRect();
    const at = {
      bubbles: true,
      cancelable: true,
      composed: true,
      clientX: r.left + r.width / 2,
      clientY: r.top + r.height / 2,
      button: 0,
      pointerId: 1,
      pointerType: "mouse",
      isPrimary: true,
      view,
    };
    cell.dispatchEvent(new view.PointerEvent("pointerdown", { ...at, buttons: 1 }));
    cell.dispatchEvent(new view.MouseEvent("mousedown", { ...at, buttons: 1, detail: 1 }));
    cell.dispatchEvent(new view.PointerEvent("pointerup", { ...at, buttons: 0 }));
    cell.dispatchEvent(new view.MouseEvent("mouseup", { ...at, buttons: 0, detail: 1 }));
    cell.dispatchEvent(new view.MouseEvent("click", { ...at, buttons: 0, detail: 1 }));
  }, id);
const selection = () =>
  page.evaluate((ids) => {
    const doc = document.querySelector("#previewFrame")?.contentDocument;
    return ids.map((id) => {
      const el = doc?.querySelector(`[data-catalog-id="${CSS.escape(id)}"]`);
      return el
        ? {
            selected: el.hasAttribute("data-selected"),
            background: getComputedStyle(el).backgroundColor,
            shadow: getComputedStyle(el).boxShadow,
          }
        : null;
    });
  }, rows);
await pressRow(rows[0]);
await page.waitForTimeout(500);
await pressRow(rows[1]);
await page.waitForTimeout(800);
const picked = await selection();
const table = await page.evaluate(() => {
  const doc = document.querySelector("#previewFrame")?.contentDocument;
  return doc
    ?.querySelector("[data-node-table]")
    ?.getAttribute("data-selection-style");
});
record(
  "G3-5 selectionStyle highlight: a press replaces the selection (RAC replace — one row selected), the selected row is the S2 highlight wash with an outline",
  table === "highlight" &&
    picked[0]?.selected === false &&
    picked[1]?.selected === true &&
    picked[1].background !== picked[0].background &&
    /inset/.test(picked[1].shadow),
  { table, picked },
);
await page.screenshot({ path: `${OUT}/compare.png` });
record("G1-6 no page errors", errors.length === 0, { errors });
writeFileSync(
  `${OUT}/results.json`,
  JSON.stringify({ results, errors }, null, 2),
);
await browser.close();
process.exit(results.every((r) => r.pass) ? 0 : 1);
