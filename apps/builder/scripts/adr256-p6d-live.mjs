// ADR-256 Phase 6d live — a ComboBox draws its node tree (`ComboBox > Label + Group(Input +
// Button) + Description + FieldError + Popover > ListBox`), in the real Builder with the Preview open
// (Compare Mode), headed Chrome: the Preview's RAC ComboBox holds the part nodes' elements in order
// at the Canvas boxes (the control Group is RAC's Group with the ComboBox rule's container class);
// the Popover node is closed on both sides; ArrowDown opens the Popover node's element (RAC's, in
// the ComboBox's context — `data-trigger=ComboBox`, no arrow, at the control Group's start edge and
// as wide) holding the ListBox node's items; the keyboard chooses one into the input; typing filters
// the item nodes; "+" on the ComboBox adds an item to the list in its Popover on both sides.
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/adr256-p6d-live.mjs <out>
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

await newProject("ADR-256 P6d combobox node tree");
await addFromPalette("combo box");
await compareOn();
const frame = () => page.frameLocator("#previewFrame");
const snapshot = () =>
  page.evaluate(() => {
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    const root = ws.root;
    const doc = document.querySelector("#previewFrame")?.contentDocument;
    const combo = [...root.canvasInputs.values()].find(
      (r) => root.typeOf(r) === "ComboBox",
    );
    const kids = combo.children.map((id) => root.canvasInputs.get(id));
    const box = (id) => {
      const b = root.getGeometry([id]).get(id);
      return b ? [Math.round(b.width), Math.round(b.height)] : null;
    };
    const elOf = (id) =>
      doc?.querySelector(`[data-catalog-id="${CSS.escape(id)}"]`);
    const domBox = (id) => {
      const r = elOf(id)?.getBoundingClientRect();
      return r ? [Math.round(r.width), Math.round(r.height)] : null;
    };
    const tagOf = (el) =>
      el ? `${el.tagName.toLowerCase()}.${[...el.classList].join(".")}` : null;
    const rootEl = elOf(combo.id);
    const group = kids.find((k) => root.typeOf(k) === "Group");
    const popover = kids.find((k) => root.typeOf(k) === "Popover");
    const list = popover
      ? popover.children
          .map((id) => root.canvasInputs.get(id))
          .find((k) => root.typeOf(k) === "ListBox")
      : undefined;
    return {
      comboId: combo.sourceId,
      kinds: kids.map((k) => root.typeOf(k)),
      rootTag: tagOf(rootEl),
      groupTag: group ? tagOf(elOf(group.id)) : null,
      groupParts: group
        ? [...(elOf(group.id)?.children ?? [])].map((el) =>
            el.tagName.toLowerCase(),
          )
        : null,
      domOrder: rootEl
        ? [...rootEl.children]
            .map((el) => el.getAttribute("data-catalog-id"))
            .filter(Boolean)
            .map((id) => root.typeOf(root.canvasInputs.get(id)))
        : null,
      boxes: [
        ...kids,
        ...(group ? group.children.map((id) => root.canvasInputs.get(id)) : []),
      ]
        .filter((k) => !k.hidden)
        .map((k) => ({
          type: root.typeOf(k),
          canvas: box(k.id),
          dom: domBox(k.id),
        })),
      comboBox: { canvas: box(combo.id), dom: domBox(combo.id) },
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
  "L-1 the Preview's RAC ComboBox holds the part nodes in order (Label · Group > input + button) at the Canvas boxes",
  s1.rootTag === "div.react-aria-ComboBox" &&
    s1.groupTag === "div.react-aria-Group.combobox-container" &&
    JSON.stringify(s1.groupParts) === JSON.stringify(["input", "button"]) &&
    JSON.stringify(s1.kinds) ===
      JSON.stringify([
        "Label",
        "Group",
        "Description",
        "FieldError",
        "Popover",
      ]) &&
    JSON.stringify(s1.domOrder) === JSON.stringify(["Label", "Group"]) &&
    sameBoxes &&
    JSON.stringify(s1.comboBox.canvas) === JSON.stringify(s1.comboBox.dom),
  s1,
);
record(
  "L-2 the Popover node is closed on both sides (hidden on the Canvas, absent in the Preview)",
  s1.popoverHidden === true && s1.openPopover === false && s1.listItems === 4,
  {
    popoverHidden: s1.popoverHidden,
    openPopover: s1.openPopover,
    listItems: s1.listItems,
  },
);
// A narrow ComboBox (320): Compare Mode shrinks the Preview page — a full-width list is pushed
// inside the screen edge, not placed by the ComboBox (6c live record).
const narrowed = await run(
  (c, ws, at, id) =>
    c.setFields({
      targets: [{ kind: "node", id }],
      sizing: { width: { kind: "set", value: 320 } },
    }),
  s1.comboId,
);
await page.waitForTimeout(1000);
// Open from the keyboard (RAC's ComboBox opens on ArrowDown, focusing the first option).
await frame().locator(".react-aria-ComboBox input").first().focus();
await page.keyboard.press("ArrowDown");
await page.waitForTimeout(800);
const open = await page.evaluate((popoverId) => {
  const doc = document.querySelector("#previewFrame").contentDocument;
  const popover = doc.querySelector(".react-aria-Popover");
  const group = doc.querySelector(".react-aria-ComboBox .react-aria-Group");
  const p = popover?.getBoundingClientRect();
  const g = group?.getBoundingClientRect();
  return {
    catalogId: popover?.getAttribute("data-catalog-id") === popoverId,
    trigger: popover?.getAttribute("data-trigger"),
    arrow: !!popover?.querySelector(".react-aria-OverlayArrow"),
    options: [...(popover?.querySelectorAll('[role="option"]') ?? [])].map(
      (o) => o.textContent.trim(),
    ),
    left: p && g ? [Math.round(p.left), Math.round(g.left)] : null,
    below: p && g ? Math.round(p.top - g.bottom) : null,
    width: popover && group ? [popover.offsetWidth, group.offsetWidth] : null,
    expanded: doc
      .querySelector(".react-aria-ComboBox input")
      ?.getAttribute("aria-expanded"),
  };
}, s1.popoverId);
await page.screenshot({ path: `${OUT}/open.png` });
record(
  "L-3 ArrowDown opens the Popover node's element — RAC's in the ComboBox's context (data-trigger=ComboBox, no arrow, at the control Group's start edge, below it, as wide) with the ListBox node's items",
  open.catalogId &&
    open.trigger === "ComboBox" &&
    !open.arrow &&
    open.expanded === "true" &&
    JSON.stringify(open.options) ===
      JSON.stringify(["Aardvark", "Cat", "Dog", "Kangaroo"]) &&
    open.left?.[0] === Math.max(open.left?.[1], 12) &&
    open.below >= 0 &&
    open.width?.[0] === open.width?.[1],
  { narrowed, ...open },
);
// Keyboard: the first option has virtual focus; ArrowDown + Enter chooses the next one.
await page.keyboard.press("ArrowDown");
await page.keyboard.press("Enter");
await page.waitForTimeout(600);
const chosen = await page.evaluate(() => {
  const doc = document.querySelector("#previewFrame").contentDocument;
  return {
    value: doc.querySelector(".react-aria-ComboBox input")?.value,
    open: !!doc.querySelector(".react-aria-Popover"),
  };
});
record(
  "L-4 the keyboard moves through the options and choosing fills the input, closing the list",
  chosen.value === "Cat" && chosen.open === false,
  chosen,
);
// Typing filters the ListBox node's items (RAC's ComboBox filter over the node items).
await frame().locator(".react-aria-ComboBox input").first().fill("");
// (One frame after clearing: right after a choice, RAC's ComboBox applies the clear in its next
// render — a key typed in the same frame is replaced by it (seen with `allowsCustomValue` false,
// gone with a 16ms gap). A person cannot type in that frame.)
await frame().locator(".react-aria-ComboBox input").first().fill("");
await page.waitForTimeout(16);
await frame()
  .locator(".react-aria-ComboBox input")
  .first()
  .pressSequentially("Do");
await page.waitForTimeout(800);
const filtered = await page.evaluate(() => {
  const doc = document.querySelector("#previewFrame").contentDocument;
  return {
    value: doc.querySelector(".react-aria-ComboBox input")?.value,
    options: [
      ...(doc.querySelectorAll('.react-aria-Popover [role="option"]') ?? []),
    ].map((o) => o.textContent.trim()),
  };
});
await page.keyboard.press("Escape");
await page.waitForTimeout(400);
record(
  "L-5 typing filters the list to the matching item nodes",
  filtered.value === "Do" &&
    JSON.stringify(filtered.options) === JSON.stringify(["Dog"]),
  filtered,
);
// "+" on the ComboBox adds an item to the list in its Popover.
await insertVia("ComboBox", "Insert ListBoxItem", 1);
await page.waitForTimeout(800);
const s2 = await snapshot();
await frame().locator(".react-aria-ComboBox input").first().fill("");
await frame().locator(".react-aria-ComboBox input").first().focus();
await page.keyboard.press("ArrowDown");
await page.waitForTimeout(800);
const options = await page.evaluate(() =>
  [
    ...(document
      .querySelector("#previewFrame")
      .contentDocument.querySelectorAll(
        '.react-aria-Popover [role="option"]',
      ) ?? []),
  ].map((o) => o.textContent.trim()),
);
await page.keyboard.press("Escape");
record(
  'L-6 "+" on the ComboBox adds an item to the ListBox in its Popover on both sides',
  s2.listItems === 5 && options.length === 5,
  { listItems: s2.listItems, options },
);
await page.screenshot({ path: `${OUT}/combobox.png` });
record("L-7 no page errors", errors.length === 0, { errors });
writeFileSync(
  `${OUT}/results.json`,
  JSON.stringify({ results, errors }, null, 2),
);
await browser.close();
process.exit(results.every((r) => r.pass) ? 0 : 1);
