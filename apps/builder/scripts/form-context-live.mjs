// S2 Form context live (사용자 2026-10-10 「1번 Form 상속 수정부터 진행해」): real Builder (headed
// Chrome, Compare Mode). The palette Form (two TextFields inside): from the Form's Design panel,
// Label Position Side → both fields draw the 176 label column on the Canvas and the Preview; Label
// Align End → the label text at the column end on both; Required → the Preview inputs are required
// and both labels show the indicator; Disabled → the Preview inputs are disabled and the fields dim
// to 0.38 on both, the form box itself not (S2); Disabled off → back; no errors.
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/form-context-live.mjs <out>
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
const read = () =>
  page.evaluate(() => {
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    const root = ws.root;
    const all = [...root.canvasInputs.values()];
    const form = all.find((r) => root.typeOf(r) === "Form");
    const fields = all.filter((r) => root.typeOf(r) === "TextField");
    const doc = document.querySelector("#previewFrame").contentDocument;
    const win = doc.defaultView;
    const geo = (id) => root.getGeometry([id]).get(id);
    return {
      formOpacity: form.visual.opacity ?? 1,
      previewFormOpacity: win.getComputedStyle(doc.querySelector(".react-aria-Form")).opacity,
      fields: fields.map((field) => {
        const label = field.children
          .map((id) => root.canvasInputs.get(id))
          .find((r) => root.typeOf(r) === "Label");
        const el = doc.querySelector(`[data-catalog-id="${field.id}"]`);
        const labelEl = el?.querySelector(":scope > .react-aria-Label");
        const input = el?.querySelector("input");
        let textRight = null;
        if (labelEl) {
          const range = doc.createRange();
          range.selectNodeContents(labelEl);
          textRight = range.getBoundingClientRect().right;
        }
        return {
          props: {
            labelPosition: field.props.labelPosition,
            labelAlign: field.props.labelAlign,
            isRequired: field.props.isRequired,
            isDisabled: field.props.isDisabled,
          },
          canvasLabelWidth: label ? geo(label.id)?.width : null,
          canvasTextAlign: label?.visual.textAlign ?? null,
          canvasOpacity: field.visual.opacity ?? 1,
          previewPosition: el?.getAttribute("data-label-position") ?? null,
          previewLabelWidth: labelEl?.getBoundingClientRect().width ?? null,
          previewTextAtEnd: labelEl
            ? Math.abs(textRight - labelEl.getBoundingClientRect().right) <= 1
            : null,
          previewLabelText: labelEl?.textContent ?? null,
          previewRequired: input?.required ?? null,
          previewDisabled: input?.disabled ?? null,
          previewOpacity: el ? win.getComputedStyle(el).opacity : null,
        };
      }),
    };
  });
const selectForm = () =>
  page.evaluate(() => {
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    const root = ws.root;
    const node = [...root.canvasInputs.values()].find(
      (r) => root.typeOf(r) === "Form",
    );
    ws.selectRecords([node.id]);
  });

await page.goto(`${BASE}/dashboard`);
await page
  .getByRole("button", { name: /new project/i })
  .first()
  .click();
await page.waitForTimeout(300);
await page.keyboard.type("Form context");
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

await addFromPalette("form");
await page.waitForTimeout(1500);
await selectForm();
await page.waitForTimeout(1000);
for (let i = 0; i < 3; i++) {
  if (await field("Label Position").isVisible().catch(() => false)) break;
  await page.getByRole("button", { name: "Design", exact: true }).first().click();
  await page.waitForTimeout(1200);
}
const before = await read();
await pick("Label Position", "Side");
const side = await read();
record(
  "Form Label Position Side: every field side · label column 176 on the Canvas and the Preview (top before)",
  before.fields.length >= 2 &&
    before.fields.every((f) => f.props.labelPosition === "top") &&
    side.fields.every(
      (f) =>
        f.props.labelPosition === "side" &&
        f.previewPosition === "side" &&
        f.canvasLabelWidth === 176 &&
        f.previewLabelWidth === 176,
    ),
  { before: before.fields, side: side.fields },
);
await pick("Label Align", "End");
const end = await read();
record(
  "Form Label Align End: label text at the column end on both",
  end.fields.every(
    (f) => f.canvasTextAlign === "end" && f.previewTextAtEnd === true,
  ),
  end.fields,
);
const panel = page.locator(".panel-wrapper[data-panel='properties']");
await panel.getByText("Required", { exact: true }).first().click();
await page.waitForTimeout(1500);
const required = await read();
record(
  "Form Required: Preview inputs required · label shows the indicator",
  required.fields.every(
    (f) =>
      f.props.isRequired === true &&
      f.previewRequired === true &&
      /[*＊]|required/i.test(f.previewLabelText ?? ""),
  ),
  required.fields,
);
await panel.getByText("Disabled", { exact: true }).first().click();
await page.waitForTimeout(1500);
const disabled = await read();
await page.screenshot({ path: `${OUT}/form-disabled.png` });
record(
  "Form Disabled: Preview inputs disabled · fields 0.38 on both · the form box itself not dimmed",
  disabled.fields.every(
    (f) =>
      f.props.isDisabled === true &&
      f.previewDisabled === true &&
      f.canvasOpacity === 0.38 &&
      Number(f.previewOpacity) === 0.38,
  ) &&
    disabled.formOpacity === 1 &&
    Number(disabled.previewFormOpacity) === 1,
  disabled,
);
await panel.getByText("Disabled", { exact: true }).first().click();
await page.waitForTimeout(1500);
const enabled = await read();
record(
  "Disabled off: fields back on both",
  enabled.fields.every(
    (f) =>
      f.props.isDisabled === false &&
      f.previewDisabled === false &&
      f.canvasOpacity === 1,
  ),
  enabled.fields,
);

record("no errors", errors.length === 0, errors.slice(0, 5));
writeFileSync(
  `${OUT}/results.json`,
  JSON.stringify({ results, errors }, null, 2),
);
await browser.close();
