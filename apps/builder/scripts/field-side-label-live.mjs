// S2 field side label live (사용자 2026-10-10 「text, number, search, date, time, color, date picker,
// date range 모든 field 컴퍼넌트들과 picker 컴퍼넌트들 Label Position - Side 로 변경시 label width 가
// fit content 로 지정 되지않았거나 … slider 와 같은 패턴」): real Builder (headed Chrome, Compare Mode).
// Each field from the palette: Label Position Side and a Description from the Design panel → the
// label is its text's width (not 176) on the Canvas and the Preview alike, the control starts after
// it and takes the rest, the description sits under the control at its x (Canvas = Preview); the
// label is in the middle of a one-line control (S2 baseline), at a TextArea's first line, at a
// group's top; a
// side Form's fields share the 176 column on both; no errors.
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/field-side-label-live.mjs <out>
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
  await page
    .getByRole("button", { name: "Components", exact: true })
    .first()
    .click()
    .catch(() => {});
  await page.waitForTimeout(300);
}
const field = (label) =>
  page
    .locator(".panel-wrapper[data-panel='properties'] fieldset", {
      has: page.locator("legend", { hasText: new RegExp(`^${label}$`) }),
    })
    .first();
const pick = async (label, option) => {
  const box = field(label);
  const radio = box.getByRole("radio", { name: option, exact: true });
  if (await radio.count()) await radio.first().click();
  else {
    await box.locator("button").first().click();
    await page.waitForTimeout(400);
    await page.getByRole("option", { name: option, exact: true }).click();
  }
  await page.waitForTimeout(1500);
};
const type = async (label, text) => {
  const box = field(label).locator("input, textarea").first();
  await box.fill(text);
  await box.press("Enter");
  await page.waitForTimeout(1500);
};
const openDesign = async (legend) => {
  for (let i = 0; i < 3; i++) {
    if (await field(legend).isVisible().catch(() => false)) return;
    await page.getByRole("button", { name: "Design", exact: true }).first().click();
    await page.waitForTimeout(1200);
  }
};
/** The newest record of `kind` (the one just added). */
const select = (kind) =>
  page.evaluate((kind) => {
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    const root = ws.root;
    const node = [...root.canvasInputs.values()]
      .filter((r) => root.typeOf(r) === kind)
      .at(-1);
    ws.selectRecords([node.id]);
    return node.id;
  }, kind);
/** Canvas and Preview boxes of a field's label · control · description, owner-relative. */
const read = (id) =>
  page.evaluate((id) => {
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    const root = ws.root;
    const owner = root.canvasInputs.get(id);
    const children = owner.children.map((c) => root.canvasInputs.get(c));
    const kinds = new Set(["Label", "Description", "FieldError"]);
    const pick = (fn) => children.find(fn);
    const label = pick((r) => root.typeOf(r) === "Label");
    const control = pick((r) => !kinds.has(root.typeOf(r)));
    const description = pick((r) => root.typeOf(r) === "Description");
    const abs = (rid) => {
      // (geometry is parent-relative: sum up to the owner)
      let x = 0;
      let y = 0;
      let cur = root.canvasInputs.get(rid);
      while (cur && cur.id !== id) {
        const g = root.getGeometry([cur.id]).get(cur.id);
        x += g.x;
        y += g.y;
        cur = root.canvasInputs.get(cur.parentId);
      }
      const g = root.getGeometry([rid]).get(rid);
      return { x, y, width: g.width, height: g.height };
    };
    const doc = document.querySelector("#previewFrame").contentDocument;
    const el = doc.querySelector(`[data-catalog-id="${id}"]`);
    const base = el?.getBoundingClientRect();
    const dom = (node) => {
      if (!node || !base) return null;
      const r = node.getBoundingClientRect();
      return {
        x: r.left - base.left,
        y: r.top - base.top,
        width: r.width,
        height: r.height,
      };
    };
    const domChildren = el ? [...el.children] : [];
    const domLabel = domChildren.find((c) => c.matches(".react-aria-Label"));
    const domDescription = domChildren.find((c) =>
      c.matches('[slot="description"]'),
    );
    const domControl = domChildren.find(
      (c) =>
        !c.matches(
          '.react-aria-Label, .react-aria-FieldError, [slot="description"]',
        ),
    );
    return {
      labelPosition: owner.props.labelPosition,
      canvas: {
        label: label && abs(label.id),
        control: control && abs(control.id),
        description: description && abs(description.id),
        owner: root.getGeometry([id]).get(id).width,
      },
      preview: {
        label: dom(domLabel),
        control: dom(domControl),
        description: dom(domDescription),
        owner: base?.width ?? null,
      },
    };
  }, id);
const near = (a, b, tolerance = 1) =>
  typeof a === "number" && typeof b === "number" && Math.abs(a - b) <= tolerance;

await page.goto(`${BASE}/dashboard`);
await page
  .getByRole("button", { name: /new project/i })
  .first()
  .click();
await page.waitForTimeout(300);
await page.keyboard.type("Field side label");
await page.keyboard.press("Enter");
await page.waitForURL(/\/builder\//, { timeout: 30000 });
await page.waitForSelector(".app:not(.builder-booting)", { timeout: 30000 });
await page.waitForFunction(
  () => window.__COMPOSITION_CATALOG__?.workspace,
  null,
  { timeout: 30000 },
);
await page.waitForTimeout(1500);
const compare = page
  .getByRole("button", { name: "Compare Mode (Preview + Skia)", exact: true })
  .first();
if (await compare.isVisible().catch(() => false)) await compare.click();
await page.waitForTimeout(1500);

const FIELDS = [
  ["TextField", "text field"],
  ["NumberField", "number field"],
  ["SearchField", "search field"],
  ["DateField", "date field"],
  ["TimeField", "time field"],
  ["ColorField", "color field"],
  ["DatePicker", "date picker"],
  ["DateRangePicker", "date range picker"],
  ["Select", "select"],
  ["ComboBox", "combo box"],
  ["TextArea", "text area"],
  ["CheckboxGroup", "checkbox group"],
  ["RadioGroup", "radio group"],
];
for (const [kind, paletteLabel] of FIELDS) {
  await page.evaluate(() =>
    window.__COMPOSITION_CATALOG__.workspace.selectRecords([]),
  );
  await page.waitForTimeout(300);
  await addFromPalette(paletteLabel);
  await page.waitForTimeout(1200);
  const id = await select(kind);
  await page.waitForTimeout(800);
  await openDesign("Label Position");
  await pick("Label Position", "Side");
  await type("Description", "Help text");
  const got = await read(id);
  const { canvas, preview } = got;
  // The label's height: a one-line control's middle; a TextArea's first line (top + 5); a group's
  // first item line (top).
  const vertical =
    kind === "TextArea"
      ? near(canvas.label.y - canvas.control.y, 5) &&
        near(preview.label.y - preview.control.y, 5)
      : kind === "CheckboxGroup" || kind === "RadioGroup"
        ? near(canvas.label.y, canvas.control.y)
        : near(
            canvas.label.y + canvas.label.height / 2,
            canvas.control.y + canvas.control.height / 2,
          );
  record(
    `${kind}: side label = its text (< 176, Canvas = Preview) · its height (${kind === "TextArea" ? "the first line" : kind.endsWith("Group") ? "the top" : "the middle"}, Canvas = Preview) · control after it · description under the control (Canvas = Preview)`,
    got.labelPosition === "side" &&
      vertical &&
      near(canvas.label.y, preview.label.y) &&
      canvas.label.width > 0 &&
      canvas.label.width < 120 &&
      near(canvas.label.width, preview.label.width) &&
      near(canvas.control.x, preview.control.x) &&
      near(canvas.control.width, preview.control.width) &&
      canvas.control.x > canvas.label.width &&
      near(canvas.description.x, canvas.control.x) &&
      near(canvas.description.x, preview.description.x) &&
      near(canvas.description.y, preview.description.y),
    got,
  );
  await page.screenshot({ path: `${OUT}/${kind}.png` });
}

// A side Form: its fields share the 176 label column on both sides.
await page.evaluate(() =>
  window.__COMPOSITION_CATALOG__.workspace.selectRecords([]),
);
await addFromPalette("form");
await page.waitForTimeout(1200);
const formId = await select("Form");
await page.waitForTimeout(800);
await openDesign("Label Position");
await pick("Label Position", "Side");
const formFields = await page.evaluate((formId) => {
  const root = window.__COMPOSITION_CATALOG__.workspace.root;
  const form = root.canvasInputs.get(formId);
  return form.children.filter((c) =>
    root.canvasInputs.get(c).children.some(
      (g) => root.typeOf(root.canvasInputs.get(g)) === "Label",
    ),
  );
}, formId);
const inForm = [];
for (const id of formFields) inForm.push(await read(id));
await page.screenshot({ path: `${OUT}/form-side.png` });
record(
  "side Form: its fields' labels share the 176 column (Canvas = Preview)",
  inForm.length > 0 &&
    inForm.every(
      (got) =>
        near(got.canvas.label.width, 176) &&
        near(got.preview.label.width, 176) &&
        near(got.canvas.control.x, got.preview.control.x),
    ),
  inForm.map((got) => ({
    canvas: got.canvas.label.width,
    preview: got.preview.label.width,
    controlX: [got.canvas.control.x, got.preview.control.x],
  })),
);

record("no errors", errors.length === 0, errors.slice(0, 5));
writeFileSync(
  `${OUT}/results.json`,
  JSON.stringify({ results, errors }, null, 2),
);
await browser.close();
