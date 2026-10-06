// ADR-253 Phase 4 (G4) live — a Select · ComboBox holds its items in its ListBox (an instance of
// the ListBox origin): the real Builder + Preview (Compare Mode), headed Chrome, saved auth
// session → /dashboard. The Preview's option list is the ListBox node's element inside the
// picker's Popover, so the picker opens with the items the Canvas document holds — an added,
// renamed or removed item shows on both sides, and the ListBox origin's style reaches the list.
//
//   BUILDER_URL=http://localhost:5175 node apps/builder/scripts/adr253-p4-live.mjs <out>
import { chromium } from "playwright";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const OUT = process.argv[2];
mkdirSync(OUT, { recursive: true });
const REPO = process.cwd();
const BASE = process.env.BUILDER_URL ?? "http://localhost:5173";
const AUTH =
  process.env.AUTH_SESSION ?? `${REPO}/apps/builder/scripts/.auth-session.json`;
const state = JSON.parse(readFileSync(AUTH, "utf8"));
state.origins = (state.origins ?? []).map((o) => ({ ...o, origin: BASE }));
const browser = await chromium.launch({ headless: false, channel: "chrome" });
const context = await browser.newContext({
  storageState: state,
  viewport: { width: 1600, height: 1000 },
  locale: "en-US",
});
const errors = [];
const results = [];
const record = (id, pass, detail) => {
  results.push({ id, pass, detail });
  process.stdout.write(
    `${pass ? "PASS" : "FAIL"} ${id} — ${JSON.stringify(detail).slice(0, 3000)}\n`,
  );
};
const page = await context.newPage();
page.on("pageerror", (e) =>
  errors.push(`pageerror: ${e.message.slice(0, 300)}`),
);
page.on("console", (m) => {
  if (m.type() === "error") errors.push(`console: ${m.text().slice(0, 300)}`);
});
const step = async (id, run) => {
  try {
    await run();
  } catch (error) {
    record(id, false, { threw: String(error?.message ?? error).slice(0, 800) });
    writeFileSync(`${OUT}/${id}-error.png`, await page.screenshot());
  }
};
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
  await page.waitForTimeout(700);
}
const commands = `/@fs${REPO}/packages/shared/src/catalog/commands/index.ts`;
const LISTBOX_ORIGIN = "lib:definition:origin-component-listbox";
const LABELS = ["Aardvark", "Cat", "Dog", "Kangaroo"];
const frame = page.frameLocator("#previewFrame");
const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);

/**
 * Each placed picker (and the standalone ListBox): its Canvas records — the ListBox and the item
 * labels — with what the Preview document shows now (the open list, if any).
 */
const snap = () =>
  page.evaluate(() => {
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    const g = ws.runtime.graph;
    const doc = document.querySelector("#previewFrame")?.contentDocument;
    const view = doc?.defaultView;
    const typeOf = (node) => g.getDefinition(node.definitionId)?.name;
    const records = ws.root.canvasInputs;
    const out = {};
    for (const field of records.values()) {
      const type = typeOf(field);
      if (
        !["Select", "ComboBox", "ListBox"].includes(type) ||
        !field.sourceId.startsWith("project:")
      )
        continue;
      const children = field.children.map((id) => records.get(id));
      const list =
        type === "ListBox"
          ? field
          : children.find((child) => typeOf(child) === "ListBox");
      const items = (list?.children ?? []).map((id) => records.get(id));
      const labels = items.map(
        (item) =>
          item.children
            .map((id) => records.get(id))
            .find((part) => part.props.slot === "label")?.props.children,
      );
      const fieldEl = doc?.querySelector(
        `[data-catalog-id="${CSS.escape(field.id)}"]`,
      );
      const listEl =
        type === "ListBox"
          ? fieldEl
          : doc?.querySelector('.react-aria-Popover [role="listbox"]');
      const popover = listEl?.closest(".react-aria-Popover");
      const owner = popover?.getAttribute("data-trigger");
      // (One popover is open at a time: it is this picker's when its trigger says so.)
      const mine = type === "ListBox" || owner === type;
      const trigger = fieldEl?.querySelector("button");
      out[type] = {
        id: field.id,
        sourceId: field.sourceId,
        canvas: {
          listId: list?.id,
          listHidden: list?.hidden === true,
          listBackground: list?.visual.backgroundColor,
          itemsBesideList: children.filter(
            (child) => typeOf(child) === "ListBoxItem",
          ).length,
          itemIds: items.map((item) => item.id),
          labels,
        },
        preview: {
          present: !!fieldEl,
          expanded:
            (
              fieldEl?.querySelector("[aria-expanded]") ?? trigger
            )?.getAttribute("aria-expanded") ?? null,
          value:
            type === "Select"
              ? (trigger?.textContent ?? "").trim()
              : (fieldEl?.querySelector("input")?.value ?? null),
          ...(listEl && mine
            ? {
                listId: listEl.getAttribute("data-catalog-id"),
                listClass: listEl.className,
                listSize: listEl.getAttribute("data-size"),
                listBackground: view.getComputedStyle(listEl).backgroundColor,
                options: [...listEl.querySelectorAll('[role="option"]')].map(
                  (option) => (option.textContent ?? "").trim(),
                ),
                optionIds: [...listEl.querySelectorAll('[role="option"]')].map(
                  (option) => option.getAttribute("data-catalog-id"),
                ),
                popover: popover
                  ? (() => {
                      const cs = view.getComputedStyle(popover);
                      const box = popover.getBoundingClientRect();
                      const anchor = fieldEl.getBoundingClientRect();
                      return {
                        background: cs.backgroundColor,
                        border: `${cs.borderTopWidth} ${cs.borderTopStyle}`,
                        width: Math.round(box.width),
                        fieldWidth: Math.round(anchor.width),
                        below: box.top >= anchor.top,
                      };
                    })()
                  : null,
              }
            : { options: null }),
        },
      };
    }
    return out;
  });
const run = (body, args = []) =>
  page.evaluate(
    async ([path, source, args]) => {
      const ws = window.__COMPOSITION_CATALOG__.workspace;
      const api = await import(/* @vite-ignore */ path);
      // eslint-disable-next-line no-new-func
      return new Function("ws", "api", "args", source)(ws, api, args);
    },
    [commands, body, args],
  );
const openPicker = async (id) => {
  await frame
    .locator(`[data-catalog-id="${id}"] button`)
    .first()
    .click({ timeout: 5000 });
  await page.waitForTimeout(500);
  // (The click scrolls the wide Preview document to the trigger's middle: back to its left edge,
  // where the list's items are, for the screenshots.)
  await page.evaluate(() => {
    const frame = document.querySelector("#previewFrame");
    const doc = frame?.contentDocument;
    doc?.defaultView?.scrollTo(0, 0);
    for (const el of [doc?.scrollingElement, doc?.body])
      if (el) el.scrollLeft = 0;
    for (let el = frame?.parentElement; el; el = el.parentElement)
      el.scrollLeft = 0;
  });
  await page.waitForTimeout(200);
};
const closePicker = async () => {
  await frame.locator("body").press("Escape");
  await page.waitForTimeout(400);
};
let steps = 0;

await page.goto(`${BASE}/dashboard`);
await page
  .getByRole("button", { name: /new project/i })
  .first()
  .click();
await page.waitForTimeout(300);
await page.keyboard.type("ADR-253 P4 picker list live");
await page.keyboard.press("Enter");
await page.waitForURL(/\/builder\//, { timeout: 30000 });
await page.waitForSelector(".app:not(.builder-booting)", { timeout: 30000 });
await page.waitForFunction(
  () => window.__COMPOSITION_CATALOG__?.workspace,
  null,
  { timeout: 30000 },
);
await page.waitForTimeout(1500);

await step("place", async () => {
  // (The Select is placed last: it stays selected for the Properties "+".)
  for (const label of ["list box", "combo box", "select"]) {
    await addFromPalette(label);
    steps += 1;
  }
  await page
    .getByRole("button", { name: "Compare Mode (Preview + Skia)", exact: true })
    .first()
    .click();
  await page.waitForTimeout(3000);
  // (The palette panel covers the Preview's left edge, where the lists open.)
  await page
    .getByRole("button", { name: "Components", exact: true })
    .first()
    .click()
    .catch(() => {});
  await page.waitForTimeout(400);
  const shot = await snap();
  writeFileSync(`${OUT}/1-placed.png`, await page.screenshot());
  const ok = ["Select", "ComboBox"].every((type) => {
    const s = shot[type];
    return (
      s?.preview.present &&
      s.canvas.listHidden &&
      s.canvas.itemsBesideList === 0 &&
      same(s.canvas.labels, LABELS) &&
      s.preview.expanded === "false" &&
      s.preview.options === null
    );
  });
  record("place", ok, {
    select: shot.Select,
    combo: shot.ComboBox?.canvas,
    listBox: shot.ListBox?.canvas.labels,
  });
});

await step("select-opens", async () => {
  const before = await snap();
  await openPicker(before.Select.id);
  const open = (await snap()).Select;
  writeFileSync(`${OUT}/2-select-open.png`, await page.screenshot());
  // Choose "Dog": RAC shows the item as the value and closes the list.
  await frame.locator('[role="option"]', { hasText: "Dog" }).first().click();
  await page.waitForTimeout(500);
  const chosen = (await snap()).Select;
  record(
    "select-opens",
    open.preview.expanded === "true" &&
      same(open.preview.options, open.canvas.labels) &&
      same(open.preview.optionIds, open.canvas.itemIds) &&
      open.preview.listId === open.canvas.listId &&
      open.preview.listClass === "react-aria-ListBox" &&
      open.preview.listSize === "md" &&
      open.preview.popover?.below === true &&
      open.preview.popover.width === open.preview.popover.fieldWidth &&
      chosen.preview.options === null &&
      chosen.preview.value.includes("Dog"),
    { open: open.preview, value: chosen.preview.value },
  );
});

await step("combobox-opens-and-filters", async () => {
  const before = await snap();
  await openPicker(before.ComboBox.id);
  const open = (await snap()).ComboBox;
  writeFileSync(`${OUT}/3-combobox-open.png`, await page.screenshot());
  await closePicker();
  // Typing filters the list by the items' text (their label part's).
  const input = frame.locator(
    `[data-catalog-id="${before.ComboBox.id}"] input`,
  );
  await input.click();
  await input.pressSequentially("ca", { delay: 60 });
  await page.waitForTimeout(500);
  const filtered = (await snap()).ComboBox;
  await frame.locator('[role="option"]', { hasText: "Cat" }).first().click();
  await page.waitForTimeout(500);
  const chosen = (await snap()).ComboBox;
  record(
    "combobox-opens-and-filters",
    same(open.preview.options, open.canvas.labels) &&
      same(open.preview.optionIds, open.canvas.itemIds) &&
      open.preview.listId === open.canvas.listId &&
      same(filtered.preview.options, ["Cat"]) &&
      chosen.preview.options === null &&
      chosen.preview.value === "Cat",
    {
      open: open.preview,
      filtered: filtered.preview.options,
      value: chosen.preview.value,
    },
  );
});

await step("add-item", async () => {
  // The Select selected: the Design panel's "+" adds an item to its ListBox.
  const selected = (await snap()).Select;
  await page.evaluate(
    (id) => window.__COMPOSITION_CATALOG__.workspace.selectRecords([id]),
    selected.id,
  );
  const insert = page.getByRole("button", { name: "Insert ListBoxItem" });
  if (
    !(await insert
      .first()
      .isVisible()
      .catch(() => false))
  )
    await page
      .getByRole("button", { name: "Design", exact: true })
      .first()
      .click();
  await page.waitForTimeout(600);
  const offered = await insert.count();
  await insert.first().click();
  steps += 1;
  await page.waitForTimeout(1200);
  const added = (await snap()).Select;
  await openPicker(added.id);
  const open = (await snap()).Select;
  writeFileSync(`${OUT}/4-select-added.png`, await page.screenshot());
  await closePicker();
  const fills = await run(
    `const node = ws.runtime.graph.getEntry(args[0]);
     return node.descendantOverrides.filter((item) => item.kind === "fillSlot").map((item) => item.address);`,
    [added.sourceId],
  );
  record(
    "add-item",
    offered === 1 &&
      same(added.canvas.labels, [...LABELS, "Item 5"]) &&
      added.canvas.itemsBesideList === 0 &&
      same(open.preview.options, [...LABELS, "Item 5"]) &&
      same(open.preview.optionIds, open.canvas.itemIds) &&
      fills.length === 1 &&
      fills[0].instances.length === 2 &&
      same(fills[0].templatePath, ["lib:template:component-listbox"]),
    { canvas: added.canvas.labels, preview: open.preview.options, fills },
  );
});

await step("rename-and-remove", async () => {
  const before = (await snap()).Select;
  // The second item's label text, then the third item removed.
  await run(
    `const records = ws.root.canvasInputs;
     const item = records.get(args[0]);
     const label = item.children.map((id) => records.get(id)).find((part) => part.props.slot === "label");
     ws.execute(api.setFields({ targets: [ws.itemOfRecord(label.id).target], props: { children: { kind: "set", value: "Capybara" } } }));
     ws.execute(api.removeTargets({ targets: [ws.itemOfRecord(args[1]).target] }));`,
    [before.canvas.itemIds[1], before.canvas.itemIds[2]],
  );
  steps += 2;
  await page.waitForTimeout(1200);
  const edited = (await snap()).Select;
  await openPicker(edited.id);
  const open = (await snap()).Select;
  writeFileSync(`${OUT}/5-select-edited.png`, await page.screenshot());
  await closePicker();
  const expected = ["Aardvark", "Capybara", "Kangaroo", "Item 5"];
  record(
    "rename-and-remove",
    same(edited.canvas.labels, expected) &&
      same(open.preview.options, expected),
    { canvas: edited.canvas.labels, preview: open.preview.options },
  );
});

await step("origin-style", async () => {
  // The ListBox origin's style (the Components page's edit) reaches every ListBox: the picker's
  // list and the standalone ListBox, on the Canvas and in the Preview.
  const colors = [];
  for (const [hex, rgb] of [
    ["#ffe4b5", "rgb(255, 228, 181)"],
    ["#c8e6c9", "rgb(200, 230, 201)"],
  ]) {
    await run(
      `ws.execute(api.setLibraryDefault({ definitionId: args[0], scope: "visual", key: "backgroundColor", write: { kind: "set", value: args[1] }, newId: ws.newId }));`,
      [LISTBOX_ORIGIN, hex],
    );
    steps += 1;
    await page.waitForTimeout(1200);
    const closed = await snap();
    await openPicker(closed.Select.id);
    const select = (await snap()).Select;
    await closePicker();
    await openPicker(closed.ComboBox.id);
    const combo = (await snap()).ComboBox;
    if (hex === "#c8e6c9")
      writeFileSync(`${OUT}/6-origin-style.png`, await page.screenshot());
    await closePicker();
    colors.push({
      hex,
      rgb,
      canvas: [
        select.canvas.listBackground,
        combo.canvas.listBackground,
        closed.ListBox.canvas.listBackground,
      ],
      preview: [
        select.preview.listBackground,
        combo.preview.listBackground,
        closed.ListBox.preview.listBackground,
      ],
    });
  }
  record(
    "origin-style",
    colors.every(
      (c) =>
        c.canvas.every((value) => value === c.hex) &&
        c.preview.every((value) => value === c.rgb),
    ),
    colors,
  );
});

await step("undo", async () => {
  // Back to the placed pickers: every edit is one history step. (One undo per Preview delta: a
  // node created and removed between two deltas — undoing a removal and then the insert in one
  // frame — is a removal the Preview replica never held; it rejects that delta and asks for a
  // snapshot. That is the Preview channel's own recovery, not this step's subject.)
  for (let i = 0; i < steps - 3; i += 1) {
    await page.evaluate(() => window.__COMPOSITION_CATALOG__.workspace.undo());
    await page.waitForTimeout(250);
  }
  await page.waitForTimeout(1500);
  const shot = await snap();
  await openPicker(shot.Select.id);
  const open = (await snap()).Select;
  await closePicker();
  record(
    "undo",
    same(shot.Select.canvas.labels, LABELS) &&
      shot.Select.canvas.listBackground === undefined &&
      same(open.preview.options, LABELS),
    {
      canvas: shot.Select.canvas.labels,
      preview: open.preview.options,
      background: open.preview.listBackground,
    },
  );
});

record("errors", errors.length === 0, errors.slice(0, 8));
writeFileSync(
  `${OUT}/results.json`,
  JSON.stringify({ base: BASE, results }, null, 1),
);
await browser.close();
process.exit(results.every((result) => result.pass) ? 0 : 1);
