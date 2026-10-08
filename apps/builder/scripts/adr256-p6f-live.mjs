// ADR-256 Phase 6f live — a picker's item shows its selection as the reference's DropdownItem does
// (`isSelected && <Check />`), in the real Builder with the Preview open (Compare Mode), headed
// Chrome: by default the sheet's glyph (`ListBox.css` `[data-selected]::before`) marks the chosen
// option; an author's check Icon put in an item with `showWhen isSelected` is absent on the Canvas
// (the closed picker), is RAC's selection in the Preview (shown only while that option is
// selected), stands in for the glyph (`data-selection-mark` — the glyph is `display: none`) and sits
// in the glyph's place (the item's left gutter, centred); it stays after a reload (Decision 11).
// Select and ComboBox.
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/adr256-p6f-live.mjs <out>
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
});
const page = await context.newPage();
const errors = [];
const results = [];
const record = (id, pass, detail) => {
  results.push({ id, pass, detail });
  process.stdout.write(
    `${pass ? "PASS" : "FAIL"} ${id} — ${JSON.stringify(detail).slice(0, 1500)}\n`,
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
  // (Close the Components panel: it covers the Preview half in Compare Mode.)
  await page
    .getByRole("button", { name: "Components", exact: true })
    .first()
    .click()
    .catch(() => {});
  await page.waitForTimeout(300);
}
async function compareOn() {
  const button = page
    .getByRole("button", { name: "Compare Mode (Preview + Skia)", exact: true })
    .first();
  if (await button.isVisible().catch(() => false)) await button.click();
  await page.waitForTimeout(3000);
}

const commands = `/@fs${REPO}/packages/shared/src/catalog/commands/index.ts`;
const shortcuts = `/@fs${REPO}/apps/builder/src/builder/catalogRuntime/shortcuts.ts`;
async function newProject(name) {
  await page.goto(`${BASE}/dashboard`);
  await page
    .getByRole("button", { name: /new project/i })
    .first()
    .click();
  await page.waitForTimeout(300);
  await page.keyboard.type(name);
  await page.keyboard.press("Enter");
  await page.waitForURL(/\/builder\//, { timeout: 30000 });
  await page.waitForSelector(".app:not(.builder-booting)", { timeout: 30000 });
  await page.waitForFunction(
    () => window.__COMPOSITION_CATALOG__?.workspace,
    null,
    { timeout: 30000 },
  );
}
const partId = (type, index = 0) =>
  page.evaluate(
    ({ type, index }) => {
      const ws = window.__COMPOSITION_CATALOG__.workspace;
      return [...ws.root.canvasInputs.values()].filter(
        (r) => ws.root.typeOf(r) === type,
      )[index]?.id;
    },
    { type, index },
  );
async function insertVia(partType, label, times) {
  const id = await partId(partType);
  await page.evaluate(
    (id) => window.__COMPOSITION_CATALOG__.workspace.selectRecords([id]),
    id,
  );
  await page.waitForTimeout(600);
  if (
    !(await page
      .getByRole("button", { name: label, exact: true })
      .first()
      .isVisible()
      .catch(() => false))
  ) {
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
/** Run a catalog command in the page: `build(commands, ws)` returns the command. */
async function run(build, arg) {
  return page.evaluate(
    async ({ commands, build, arg }) => {
      const c = await import(commands);
      const ws = window.__COMPOSITION_CATALOG__.workspace;
      const at = (id) => ws.positionOfRecord(id).target;
      try {
        ws.execute(
          new Function(
            "c",
            "ws",
            "at",
            "arg",
            `return (${build})(c, ws, at, arg);`,
          )(c, ws, at, arg),
        );
        await new Promise((r) => setTimeout(r, 400));
        return { ok: true };
      } catch (error) {
        return { ok: false, code: error?.code ?? String(error) };
      }
    },
    { commands, build: build.toString(), arg },
  );
}


const items = (type) =>
  page.evaluate((type) => {
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    const root = ws.root;
    const picker = [...root.canvasInputs.values()].find(
      (r) => root.typeOf(r) === type,
    );
    const child = (parent, t) =>
      parent.children
        .map((id) => root.canvasInputs.get(id))
        .find((r) => root.typeOf(r) === t);
    const list = child(child(picker, "Popover"), "ListBox");
    return list.children;
  }, type);
const pressTrigger = async (type) => {
  const selector =
    type === "Select"
      ? ".react-aria-Select button"
      : ".react-aria-ComboBox .react-aria-Group button";
  // (Compare Mode: a pointer at the button lands on the Builder header — a click event on the
  // element is RAC's virtual press.)
  await page
    .frameLocator("#previewFrame")
    .locator(selector)
    .first()
    .dispatchEvent("click");
  await page.waitForTimeout(800);
};
const chooseOption = async (index) => {
  await page
    .frameLocator("#previewFrame")
    .locator('.react-aria-Popover [role="option"]')
    .nth(index)
    .dispatchEvent("click");
  await page.waitForTimeout(700);
};
const markSource = "project:node:p6f-mark";
const options = () =>
  page.evaluate((markSource) => {
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    const mark = [...ws.root.domInputs.values()].find(
      (r) => r.sourceId.endsWith(markSource),
    );
    const doc = document.querySelector("#previewFrame").contentDocument;
    const view = doc.defaultView;
    const open = !!doc.querySelector(".react-aria-Popover");
    const markEl = mark
      ? doc.querySelector(
          `.react-aria-Popover [data-catalog-id="${CSS.escape(mark.id)}"]`,
        )
      : null;
    const m = markEl?.getBoundingClientRect();
    return {
      open,
      rows: [...doc.querySelectorAll('.react-aria-Popover [role="option"]')].map(
        (o) => {
          const before = view.getComputedStyle(o, "::before");
          const r = o.getBoundingClientRect();
          return {
            text: o.textContent.trim(),
            selected: o.hasAttribute("data-selected"),
            selectionMark: o.hasAttribute("data-selection-mark"),
            glyph:
              before.display !== "none" && before.content.includes("✓"),
            hasMark: !!markEl && o.contains(markEl),
            box: [Math.round(r.left), Math.round(r.top + r.height / 2)],
          };
        },
      ),
      mark: m
        ? {
            left: Math.round(m.left),
            width: Math.round(m.width),
            centerY: Math.round(m.top + m.height / 2),
            position: view.getComputedStyle(markEl).position,
          }
        : null,
    };
  }, markSource);
const canvasMark = () =>
  page.evaluate((markSource) => {
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    const mark = [...ws.root.canvasInputs.values()].find((r) =>
      r.sourceId.endsWith(markSource),
    );
    return mark
      ? { type: ws.root.typeOf(mark), hidden: mark.hidden === true, showWhen: mark.showWhen }
      : null;
  }, markSource);
const putMark = (itemId) =>
  run(
    (c, ws, at, { itemId, markSource }) =>
      c.insertNodes({
        parent: at(itemId),
        index: 0,
        entries: [
          {
            kind: "node",
            id: markSource,
            definitionId: "lib:definition:type-Icon",
            children: [],
            props: {
              iconName: { kind: "set", value: "check" },
              size: { kind: "set", value: "xs" },
            },
            visual: {},
            sizing: {},
            descendantOverrides: [],
            showWhen: { all: ["isSelected"] },
          },
        ],
        rootIds: [markSource],
        newId: ws.newId,
      }),
    { itemId, markSource },
  );
const inGutter = (state, index) => {
  const row = state.rows[index];
  return (
    !!state.mark &&
    state.mark.position === "absolute" &&
    state.mark.left === row.box[0] &&
    state.mark.width === 18 &&
    Math.abs(state.mark.centerY - row.box[1]) <= 1
  );
};

await newProject("ADR-256 P6f picker selection mark");
await addFromPalette("select");
await compareOn();
// L-1 the default: the sheet's glyph marks the chosen option.
await pressTrigger("Select");
await chooseOption(1);
await pressTrigger("Select");
const d1 = await options();
await page.screenshot({ path: `${OUT}/select-default.png` });
await page.keyboard.press("Escape");
await page.waitForTimeout(400);
record(
  "L-1 Select without an author mark: the chosen option shows the sheet's glyph (✓ ::before), no data-selection-mark",
  d1.open &&
    d1.rows[1]?.selected &&
    d1.rows[1]?.glyph &&
    d1.rows.every((r) => !r.selectionMark) &&
    d1.rows.filter((r) => r.glyph).length === 1,
  d1,
);
// L-2 an author's check Icon (`showWhen isSelected`) in the third item.
const selectItems = await items("Select");
const put = await putMark(selectItems[2]);
const c1 = await canvasMark();
await pressTrigger("Select");
const d2 = await options();
record(
  "L-2 the author's mark: absent on the Canvas (closed picker); in the Preview its item yields the glyph (data-selection-mark), the mark absent while the option is not selected",
  put.ok &&
    c1?.type === "Icon" &&
    c1.hidden &&
    JSON.stringify(d2.rows.map((r) => r.selectionMark)) ===
      JSON.stringify([false, false, true, false]) &&
    d2.mark === null &&
    d2.rows[1]?.glyph,
  { put, c1, d2 },
);
await chooseOption(2);
await pressTrigger("Select");
const d3 = await options();
await page.screenshot({ path: `${OUT}/select-author-mark.png` });
record(
  "L-3 choosing the marked option: RAC's isSelected shows the mark in that option, in the glyph's place (left gutter, 18 wide, centred), no glyph beside it",
  d3.rows[2]?.selected &&
    d3.rows[2]?.hasMark &&
    !d3.rows[2]?.glyph &&
    d3.rows.every((r) => !r.glyph) &&
    inGutter(d3, 2),
  d3,
);
await chooseOption(0);
await pressTrigger("Select");
const d4 = await options();
await page.keyboard.press("Escape");
await page.waitForTimeout(400);
record(
  "L-4 another option chosen: the mark leaves with the selection, the glyph marks the new option",
  d4.mark === null && d4.rows[0]?.selected && d4.rows[0]?.glyph,
  d4,
);
// ComboBox: the same.
await page.evaluate(() =>
  window.__COMPOSITION_CATALOG__.workspace.selectRecords([]),
);
await page.waitForTimeout(400);
await run(
  (c, ws) => {
    const select = [...ws.root.canvasInputs.values()].find(
      (r) => ws.root.typeOf(r) === "Select",
    );
    return c.removeTargets({ targets: [ws.positionOfRecord(select.id).target] });
  },
  null,
);
await addFromPalette("combo box");
await page.waitForTimeout(1000);
const comboItems = await items("ComboBox");
const put2 = await putMark(comboItems[0]);
await pressTrigger("ComboBox");
await chooseOption(0);
await pressTrigger("ComboBox");
const e1 = await options();
await page.screenshot({ path: `${OUT}/combobox-author-mark.png` });
await page.keyboard.press("Escape");
await page.waitForTimeout(400);
record(
  "L-5 ComboBox: the author's mark in the first item shows once it is chosen, in the glyph's place; the other options keep no data-selection-mark",
  put2.ok &&
    e1.rows[0]?.selected &&
    e1.rows[0]?.hasMark &&
    e1.rows[0]?.selectionMark &&
    !e1.rows[0]?.glyph &&
    e1.rows.slice(1).every((r) => !r.selectionMark) &&
    inGutter(e1, 0),
  { put2, e1 },
);
// Decision 11: after a reload the mark keeps its condition.
await page.waitForTimeout(1500);
await page.reload();
await page.waitForSelector(".app:not(.builder-booting)", { timeout: 30000 });
await page.waitForFunction(
  () => window.__COMPOSITION_CATALOG__?.workspace,
  null,
  { timeout: 30000 },
);
await page.waitForTimeout(1500);
const c2 = await canvasMark();
record(
  "L-6 after a reload the mark is there with its condition (showWhen isSelected)",
  c2?.type === "Icon" &&
    JSON.stringify(c2.showWhen) === JSON.stringify({ all: ["isSelected"] }),
  c2,
);
record("L-7 no page errors", errors.length === 0, { errors });
writeFileSync(
  `${OUT}/results.json`,
  JSON.stringify({ results, errors }, null, 2),
);
await browser.close();
process.exit(results.every((r) => r.pass) ? 0 : 1);
