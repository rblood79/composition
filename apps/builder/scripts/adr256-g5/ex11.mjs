// G5 example 11 — Table (react-aria.adobe.com Table.md L74-223 vanilla Table / Column / TableHeader /
// Row / Cell + L885-959 FileTable): `Table[Files, multiple] > TableHeader > (Column > Checkbox[selection])
// + Column(column-header > Group.column-name > text) × 4 · TableBody > Row × 5 > (Cell > Checkbox
// [selection]) + Cell × 4`. Builder: Table original → "+" five Columns (header) and five Rows (body —
// a Cell per column) → the first column empty with a Checkbox[selection], each row's first Cell the
// same → column · cell texts, Title is the row header. States: default · two rows selected (pressed)
// · a sortable column (Price `allowsSorting`). The example's TableFooter row and the CheckboxGroup /
// Add row Button around the table are not compared (no TableFooter type — see the report).
import { edit, place, press, reopen } from "./harness.mjs";
import { compareCase, KNOWN, main, plus, tree } from "./helpers-c.mjs";

const COLUMNS = ["Title", "Status", "Payment Method", "Price"];
const ROWS = [
  ["Website Design", "Paid", "Credit Card", "$1,200"],
  ["Logo Creation", "Pending", "PayPal", "$350"],
  ["SEO Optimization", "Overdue", "Bank Transfer", "$800"],
  ["Social Media Setup", "Paid", "Debit Card", "$450"],
  ["Content Writing", "Pending", "Credit Card", "$600"],
];

const reference = (sortable) => `(h, R) => {
  const check = () => h(R.CheckboxField, { slot: "selection" }, h(R.CheckboxButton, null,
    h("div", { className: "indicator" }, h("svg", { viewBox: "0 0 18 18", "aria-hidden": "true" }, h("polyline", { points: "2 9 7 14 16 4" })))));
  const column = (name, i) => h(R.Column, { key: name, id: "c" + i, isRowHeader: i === 0, allowsSorting: ${sortable} && name === "Price" },
    ({ allowsSorting }) => h("div", { className: "column-header" },
      h(R.Group, { role: "presentation", tabIndex: -1, className: "column-name" }, name),
      allowsSorting ? h("span", { "aria-hidden": "true", className: "sort-indicator" }, h("svg", { "aria-hidden": "true" })) : null));
  return h(R.Table, { "aria-label": "Files", selectionMode: "multiple" },
    h(R.TableHeader, null,
      h(R.Column, { key: "select", id: "select", width: 32, minWidth: 32 }, check()),
      ...${JSON.stringify(COLUMNS)}.map(column)),
    h(R.TableBody, null,
      ...${JSON.stringify(ROWS)}.map((cells, r) => h(R.Row, { key: r, id: "r" + r },
        h(R.Cell, null, check()),
        ...cells.map((text, c) => h(R.Cell, { key: c }, text))))));
}`;

export async function run(page, errors = []) {
  const edits = [];
  const T = await place(page, "lib:definition:origin-component-table");
  const header = `(root) => [...root.canvasInputs.values()].find((r) => root.typeOf(r) === "TableHeader").id`;
  const body = `(root) => [...root.canvasInputs.values()].find((r) => root.typeOf(r) === "TableBody").id`;
  edits.push(await plus(page, header, "Column", 5));
  edits.push(await plus(page, body, "Row", 5));
  // The vanilla Column's `div.column-header` around its name Group: detach the column instances (the
  // Group is the column original's) → each name Group into a frame · the selection column's Group out.
  edits.push(
    await edit(page, (c, ws, h, T) => c.detachInstances({ ids: h.within(h.bySource(T).id, "Column").map((col) => col.sourceId), newId: ws.newId }), T),
  );
  edits.push(
    await edit(page, (c, ws, h, T) => {
      const columns = h.within(h.bySource(T).id, "Column");
      const steps = [c.removeTargets({ targets: [h.target(h.within(columns[0].id, "Group")[0].id)] })];
      // (The frame is the reference's `.column-header`: `display: flex; align-items: center` — and
      // it fills the cell, `flex-grow: 1` in a sortable column's row.)
      for (const col of columns.slice(1)) {
        const frame = { ...h.node(h.newId(), "lib:definition:type-frame"), layout: { display: h.set("flex"), alignItems: h.set("center"), flexGrow: h.set("1") } };
        steps.push(c.groupNodes({ ids: [h.within(col.id, "Group")[0].sourceId], group: frame, newId: ws.newId }));
      }
      return steps;
    }, T),
  );
  edits.push(
    await edit(page, (c, ws, h, [T, COLUMNS, ROWS]) => {
      const table = h.bySource(T);
      const steps = [h.ariaLabel(table.id, "Files"), h.props(table.id, { selectionMode: "multiple" })];
      const columns = h.within(table.id, "Column");
      steps.push(h.props(columns[0].id, { children: "" }));
      steps.push(h.insert(columns[0].id, [h.node(h.newId(), "lib:definition:origin-component-checkbox", { children: "", slot: "selection" })]));
      // (A detached column's label is its own Text — the column's `children` no longer reaches it.)
      COLUMNS.forEach((name, i) => {
        // (The name Group is the reference's `.column-name`: `flex: 1`.)
        steps.push(c.setFields({ targets: [h.target(h.within(columns[i + 1].id, "Group")[0].id)], layout: { flexGrow: h.set("1") } }));
        steps.push(h.props(columns[i + 1].id, { children: name, ...(i === 0 ? { isRowHeader: true } : {}) }));
        steps.push(h.props(h.within(columns[i + 1].id, "Text")[0].id, { children: name }));
      });
      h.within(table.id, "Row").forEach((row, r) => {
        const cells = h.within(row.id, "Cell");
        steps.push(h.props(cells[0].id, { children: "" }));
        steps.push(h.insert(cells[0].id, [h.node(h.newId(), "lib:definition:origin-component-checkbox", { children: "", slot: "selection" })]));
        ROWS[r].forEach((text, c) => steps.push(h.props(cells[c + 1].id, { children: text })));
      });
      return steps;
    }, [T, COLUMNS, ROWS]),
  );
  const reopened = await reopen(page);
  const atDefault = await tree(page, T);
  const out = [];
  // (+ the column name: our label is a Text node — a span; user decision 2026-10-09 「글자 span 유지」.)
  const known = [KNOWN.checkGlyph, ['(<div[^>]*role="presentation"[^>]*>)<span[^>]*>([^<]*)</span>', "$1$2"]];
  out.push(await compareCase(page, T, "default", reference(false), { full: true, known }));
  await press(page, 'tbody [role="row"]:nth-child(1) input[type="checkbox"]');
  await press(page, 'tbody [role="row"]:nth-child(3) input[type="checkbox"]');
  out.push(
    await compareCase(page, T, "rows 1 · 3 selected (pressed)", reference(false), {
      noCanvas: true,
      full: true,
      known,
      act: `async (host) => { const boxes = host.querySelectorAll('tbody [role="row"] input[type="checkbox"]'); for (const i of [0, 2]) { boxes[i].click(); await new Promise((r) => setTimeout(r, 100)); } }`,
    }),
  );
  edits.push(
    await edit(page, (c, ws, h, T) => {
      const price = h.within(h.bySource(T).id, "Column").find((col) => col.props.children === "Price");
      return h.props(price.id, { allowsSorting: true });
    }, T),
  );
  await reopen(page);
  out.push(await compareCase(page, T, "Price sortable (reopened)", reference(true), { full: true, known }));
  return { edits, reopened, out, atDefault };
}

if (import.meta.url === `file://${process.argv[1]}`) await main("ex11", run);
