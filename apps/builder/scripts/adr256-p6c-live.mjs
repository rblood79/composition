// ADR-256 Phase 6c live — a Select draws its node tree (`Select > Label + Button(SelectValue +
// Icon) + Description + FieldError + Popover > ListBox`), in the real Builder with the Preview open
// (Compare Mode), headed Chrome: the Preview's RAC Select holds the part nodes' elements in order at
// the Canvas boxes; the Popover node is closed on both sides; pressing the Preview trigger opens the
// Popover node's element (RAC's, in the Select's context — `data-trigger=Select`, no arrow, below
// the trigger's start edge) holding the ListBox node's items; choosing one shows it as the value;
// "+" on the Select adds an item to the list in its Popover on both sides.
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/adr256-p6c-live.mjs <out>
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

await newProject("ADR-256 P6c select node tree");
await addFromPalette("select");
await compareOn();
const frame = () => page.frameLocator("#previewFrame");
const snapshot = () =>
  page.evaluate(() => {
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    const root = ws.root;
    const doc = document.querySelector("#previewFrame")?.contentDocument;
    const select = [...root.canvasInputs.values()].find(
      (r) => root.typeOf(r) === "Select",
    );
    const kids = select.children.map((id) => root.canvasInputs.get(id));
    const box = (id) => {
      const b = root.getGeometry([id]).get(id);
      return b ? [Math.round(b.width), Math.round(b.height)] : null;
    };
    const domBox = (id) => {
      const el = doc?.querySelector(`[data-catalog-id="${CSS.escape(id)}"]`);
      const r = el?.getBoundingClientRect();
      return r ? [Math.round(r.width), Math.round(r.height)] : null;
    };
    const rootEl = doc?.querySelector(
      `[data-catalog-id="${CSS.escape(select.id)}"]`,
    );
    const popover = kids.find((k) => root.typeOf(k) === "Popover");
    const list = popover
      ? popover.children
          .map((id) => root.canvasInputs.get(id))
          .find((k) => root.typeOf(k) === "ListBox")
      : undefined;
    return {
      selectId: select.sourceId,
      recordId: select.id,
      kinds: kids.map((k) => root.typeOf(k)),
      rootTag: rootEl
        ? `${rootEl.tagName.toLowerCase()}.${[...rootEl.classList].join(".")}`
        : null,
      // The Preview root's element children that are part nodes, in order (RAC's hidden select aside).
      domOrder: rootEl
        ? [...rootEl.children]
            .map((el) => el.getAttribute("data-catalog-id"))
            .filter(Boolean)
            .map((id) => root.typeOf(root.canvasInputs.get(id)))
        : null,
      boxes: kids
        .filter((k) => !k.hidden)
        .map((k) => ({
          type: root.typeOf(k),
          canvas: box(k.id),
          dom: domBox(k.id),
        })),
      selectBox: { canvas: box(select.id), dom: domBox(select.id) },
      popoverId: popover?.id ?? null,
      popoverHidden: popover?.hidden ?? null,
      listItems: list ? list.children.length : null,
      openPopover: !!doc?.querySelector(".react-aria-Popover"),
    };
  });
const s1 = await snapshot();
const sameBoxes = s1.boxes.every(
  (b) => JSON.stringify(b.canvas) === JSON.stringify(b.dom),
);
record(
  "L-1 the Preview's RAC Select holds the part nodes in order (Label · Button) at the Canvas boxes",
  s1.rootTag === "div.react-aria-Select" &&
    JSON.stringify(s1.kinds) ===
      JSON.stringify(["Label", "Button", "Description", "FieldError", "Popover"]) &&
    JSON.stringify(s1.domOrder) === JSON.stringify(["Label", "Button"]) &&
    sameBoxes &&
    JSON.stringify(s1.selectBox.canvas) === JSON.stringify(s1.selectBox.dom),
  s1,
);
record(
  "L-2 the Popover node is closed on both sides (hidden on the Canvas, absent in the Preview)",
  s1.popoverHidden === true && s1.openPopover === false && s1.listItems === 4,
  { popoverHidden: s1.popoverHidden, openPopover: s1.openPopover, listItems: s1.listItems },
);
// A narrow Select (320): the open list then fits beside it — Compare Mode shrinks the Preview page,
// and a full-width list is pushed inside the screen edge, not placed by the Select.
const narrowed = await run(
  (c, ws, at, id) =>
    c.setFields({
      targets: [{ kind: "node", id }],
      sizing: { width: { kind: "set", value: 320 } },
    }),
  s1.selectId,
);
await page.waitForTimeout(1000);
// Press the Preview's trigger.
// (Compare Mode's Builder header covers the Preview's top edge: focus the trigger and open it
// from the keyboard — RAC's Select opens on Enter.)
await frame().locator(".react-aria-Select button").first().focus();
await page.keyboard.press("Enter");
await page.waitForTimeout(800);
const open = await page.evaluate((popoverId) => {
  const doc = document.querySelector("#previewFrame").contentDocument;
  const popover = doc.querySelector(".react-aria-Popover");
  const trigger = doc.querySelector(".react-aria-Select button");
  const p = popover?.getBoundingClientRect();
  const t = trigger?.getBoundingClientRect();
  return {
    catalogId: popover?.getAttribute("data-catalog-id") === popoverId,
    trigger: popover?.getAttribute("data-trigger"),
    arrow: !!popover?.querySelector(".react-aria-OverlayArrow"),
    options: [...(popover?.querySelectorAll('[role="option"]') ?? [])].map((o) =>
      o.textContent.trim(),
    ),
    left: p && t ? [Math.round(p.left), Math.round(t.left)] : null,
    below: p && t ? Math.round(p.top - t.bottom) : null,
    // (RAC's `--trigger-width` is the trigger's layout width — the Preview's scale aside.)
    width: popover && trigger ? [popover.offsetWidth, trigger.offsetWidth] : null,
    focused: doc.activeElement?.getAttribute("role") ?? doc.activeElement?.tagName,
    style: popover?.getAttribute("style"),
    computed: popover
      ? (({ width, minWidth, paddingLeft, boxSizing }) => ({ width, minWidth, paddingLeft, boxSizing }))(
          doc.defaultView.getComputedStyle(popover),
        )
      : null,
    listWidth: Math.round(popover?.querySelector('[role="listbox"]')?.getBoundingClientRect().width ?? 0),
    listStyle: popover?.querySelector('[role="listbox"]')?.getAttribute("style"),
  };
}, s1.popoverId);
await page.screenshot({ path: `${OUT}/open.png` });
record(
  "L-3 pressing the trigger opens the Popover node's element — RAC's in the Select's context (data-trigger=Select, no arrow, at the trigger's start edge, below it) with the ListBox node's items",
  open.catalogId &&
    open.trigger === "Select" &&
    !open.arrow &&
    JSON.stringify(open.options) ===
      JSON.stringify(["Aardvark", "Cat", "Dog", "Kangaroo"]) &&
    // (RAC keeps a Popover 12px inside the screen — its `containerPadding`; the page's trigger
    // sits 8px from the edge.)
    open.left?.[0] === Math.max(open.left?.[1], 12) &&
    open.below >= 0 &&
    open.width?.[0] >= open.width?.[1],
  { narrowed, ...open },
);
// Keyboard: RAC's list has focus on an option; ArrowDown + Enter chooses the next one.
await page.keyboard.press("ArrowDown");
await page.keyboard.press("Enter");
await page.waitForTimeout(600);
const chosen = await page.evaluate(() => {
  const doc = document.querySelector("#previewFrame").contentDocument;
  return {
    value: doc.querySelector(".react-aria-SelectValue")?.textContent,
    open: !!doc.querySelector(".react-aria-Popover"),
  };
});
record(
  "L-4 the open list takes the keyboard (option focus) and choosing shows the value, closing the list",
  open.focused === "option" && chosen.value === "Cat" && chosen.open === false,
  { focused: open.focused, chosen },
);
// "+" on the Select adds an item to the list in its Popover.
await insertVia("Select", "Insert ListBoxItem", 1);
await page.waitForTimeout(800);
const s2 = await snapshot();
// (Compare Mode's Builder header covers the Preview's top edge: focus the trigger and open it
// from the keyboard — RAC's Select opens on Enter.)
await frame().locator(".react-aria-Select button").first().focus();
await page.keyboard.press("Enter");
await page.waitForTimeout(800);
const options = await page.evaluate(() =>
  [
    ...(document
      .querySelector("#previewFrame")
      .contentDocument.querySelectorAll('.react-aria-Popover [role="option"]') ?? []),
  ].map((o) => o.textContent.trim()),
);
await page.keyboard.press("Escape");
record(
  "L-5 \"+\" on the Select adds an item to the ListBox in its Popover on both sides",
  s2.listItems === 5 && options.length === 5,
  { listItems: s2.listItems, options },
);
await page.screenshot({ path: `${OUT}/select.png` });
record("L-6 no page errors", errors.length === 0, { errors });
writeFileSync(
  `${OUT}/results.json`,
  JSON.stringify({ results, errors }, null, 2),
);
await browser.close();
process.exit(results.every((r) => r.pass) ? 0 : 1);
