// UI-authored scratch projects; runtime inspection is read-only.
import { chromium } from "playwright";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const OUT = process.argv[2];
mkdirSync(OUT, { recursive: true });
const BASE = process.env.BUILDER_URL ?? "http://localhost:5173";
const auth = JSON.parse(
  readFileSync("apps/builder/scripts/.auth-session.json", "utf8"),
);
auth.origins = (auth.origins ?? []).map((o) => ({ ...o, origin: BASE }));
const browser = await chromium.launch({ headless: false, channel: "chrome" });
const context = await browser.newContext({
  storageState: auth,
  viewport: { width: 1800, height: 1100 },
});
const page = await context.newPage();
page.setDefaultTimeout(10000);
const results = [],
  errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
const save = () =>
  writeFileSync(
    `${OUT}/results.json`,
    JSON.stringify({ results, errors }, null, 2),
  );
const check = (type, scenario, pass, detail) => {
  results.push({ type, scenario, pass, detail, url: page.url() });
  console.log(
    `${pass ? "PASS" : "FAIL"} ${type} ${scenario} ${JSON.stringify(detail ?? "")}`,
  );
  save();
};
const panel = () => page.locator('[data-panel-id="properties"]');
const layers = () =>
  page.getByRole("treegrid", { name: "Layers", exact: true });
const settle = () => page.waitForTimeout(400);
async function rail(name) {
  const b = page
    .getByRole("toolbar", { name: /panel controls$/ })
    .getByRole("button", { name, exact: true });
  if ((await b.getAttribute("aria-pressed")) !== "true") await b.click();
}
async function read() {
  return page.evaluate(() => {
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    return [...ws.root.canvasInputs.values()].map((n) => ({
      id: n.id,
      parentId: n.parentId,
      type: ws.root.typeOf(n),
      props: n.props,
      derivedProps: n.derivedProps,
    }));
  });
}
async function select(id) {
  const ancestors = await page.evaluate((id) => {
    const root = window.__COMPOSITION_CATALOG__.workspace.root;
    const result = [];
    for (
      let n = root.canvasInputs.get(id);
      n;
      n = root.canvasInputs.get(n.parentId)
    )
      result.unshift(n.id);
    return result.slice(0, -1);
  }, id);
  for (const ancestor of ancestors) {
    const row = layers().locator(`[role="row"][data-key="${ancestor}"]`);
    if (await row.count()) {
      await row.press("ArrowRight");
      await settle();
    }
  }
  const row = layers().locator(`[role="row"][data-key="${id}"]`);
  await row.scrollIntoViewIfNeeded();
  await row.press("Space");
  await rail("Design");
  await panel().getByRole("tab", { name: "Property", exact: true }).click();
  await settle();
}
async function previewReady() {
  if (!(await page.locator("#previewFrame").count()))
    await page
      .getByRole("button", {
        name: "Compare Mode (Preview + Skia)",
        exact: true,
      })
      .click();
  await page
    .frameLocator("#previewFrame")
    .locator("[data-catalog-id]")
    .first()
    .waitFor();
  await settle();
}
async function createProject() {
  await page.goto(`${BASE}/dashboard`);
  await page
    .getByRole("button", { name: "New project", exact: true })
    .first()
    .click();
  await page
    .getByRole("textbox", { name: "Project name" })
    .fill(`Existing contracts ${Date.now()}`);
  await page.getByRole("button", { name: "Create", exact: true }).click();
  await page.waitForURL(/\/builder\//);
  await page.waitForFunction(() => window.__COMPOSITION_CATALOG__?.workspace);
  await rail("Navigator");
  await rail("Components");
  await rail("Design");
  await page
    .getByRole("button", { name: "Compare Mode (Preview + Skia)", exact: true })
    .click();
  await page.frameLocator("#previewFrame").locator("body").waitFor();
}
async function add(palette) {
  await layers().getByRole("row").first().press("Home");
  await layers().getByRole("row", { name: "Body", exact: true }).press("Space");
  const components = page.locator('[data-panel-id="components"]');
  await components.getByRole("searchbox").fill(palette);
  await components.getByRole("button", { name: palette, exact: true }).click();
  await settle();
}
async function state() {
  return page.evaluate(async () => {
    const root = window.__COMPOSITION_CATALOG__.workspace.root;
    const bounds = window.__COMPOSITION_CATALOG__.canvas.boundsOf;
    const doc = document.querySelector("#previewFrame")?.contentDocument;
    const { catalogFieldLabelPart } =
      await import("/@fs/Users/admin/work/composition/packages/shared/src/catalog/runtime/presence.ts");
    const fields = [
      "TextField",
      "TextArea",
      "NumberField",
      "SearchField",
      "ColorField",
      "DateField",
      "TimeField",
      "DatePicker",
      "DateRangePicker",
      "CheckboxGroup",
      "RadioGroup",
      "Select",
      "ComboBox",
    ];
    return [...root.canvasInputs.values()]
      .filter((n) => fields.includes(root.typeOf(n)))
      .map((n) => {
        const icon = [...root.canvasInputs.values()].find((part) => {
          if (part.props.slot !== "necessity-icon") return false;
          for (
            let parent = root.canvasInputs.get(part.parentId);
            parent;
            parent = root.canvasInputs.get(parent.parentId)
          )
            if (parent.id === n.id) return true;
          return false;
        });
        const part =
          icon &&
          catalogFieldLabelPart(
            icon,
            (id) => root.canvasInputs.get(id),
            (n) => root.typeOf(n),
          );
        const element = doc?.querySelector(`[data-catalog-id="${n.id}"]`);
        const input = element?.querySelector("input,textarea");
        return {
          type: root.typeOf(n),
          required: part?.required,
          hidden: part?.hidden,
          extraNecessityText: !!element?.querySelector(
            '[slot="necessity-label"]',
          ),
          iconBounds: icon && bounds(icon.id),
          domRequired:
            element?.hasAttribute("data-required") ||
            input?.required ||
            !!element?.querySelector('[aria-required="true"]'),
          disabled: input?.disabled,
          readOnly: input?.readOnly,
        };
      });
  });
}
try {
  await createProject();
  for (const palette of [
    "text field",
    "text area",
    "number field",
    "search field",
    "color field",
    "date field",
    "time field",
    "date picker",
    "date range picker",
    "checkbox group",
    "radio group",
    "select",
    "combo box",
  ])
    await add(palette);
  await layers().getByRole("row").first().press("Home");
  await layers().getByRole("row", { name: "Body", exact: true }).press("Space");
  await panel().getByRole("tab", { name: "Property", exact: true }).click();
  await panel().getByRole("button", { name: "Required", exact: true }).click();
  await settle();
  let value = await state();
  check(
    "Fields",
    "13 inherited required indicators reach Canvas and Preview",
    value.length === 13 &&
      value.every(
        (n) =>
          n.required &&
          !n.hidden &&
          !n.extraNecessityText &&
          n.domRequired &&
          n.iconBounds?.height > 0,
      ),
    value,
  );
  await panel().getByRole("button", { name: "Disabled", exact: true }).click();
  await settle();
  value = await state();
  check(
    "TextArea",
    "body Disabled reaches actual textarea",
    value.find((n) => n.type === "TextArea")?.disabled === true,
    value.find((n) => n.type === "TextArea"),
  );
  await panel().getByRole("button", { name: "Disabled", exact: true }).click();
  await panel().getByRole("button", { name: "Read Only", exact: true }).click();
  await settle();
  value = await state();
  check(
    "TextArea",
    "body Read Only reaches actual textarea",
    value.find((n) => n.type === "TextArea")?.readOnly === true,
    value.find((n) => n.type === "TextArea"),
  );
  await page.evaluate(() =>
    window.__COMPOSITION_CATALOG__.canvas.setCamera({
      scale: 1,
      x: 420,
      y: 150,
    }),
  );
  await settle();
  const split = page.getByRole("separator", {
    name: "Resize the CSS / Canvas compare split",
    exact: true,
  });
  await split.press("Home");
  await settle();
  await page.screenshot({ path: `${OUT}/required-canvas.png` });
  await split.press("End");
  await settle();
  await page.screenshot({ path: `${OUT}/required-preview.png` });
  await page.keyboard.press("Meta+z");
  await settle();
  check(
    "TextArea",
    "Undo restores editability",
    (await state()).find((n) => n.type === "TextArea")?.readOnly === false,
  );
  await page.keyboard.press("Meta+Shift+z");
  await settle();
  check(
    "TextArea",
    "Redo restores inherited readonly",
    (await state()).find((n) => n.type === "TextArea")?.readOnly === true,
  );
  const fieldUrl = page.url();
  await page.waitForTimeout(1200);
  await page.reload();
  await page.waitForFunction(() => window.__COMPOSITION_CATALOG__?.workspace);
  await previewReady();
  value = await state();
  check(
    "Fields",
    "required and readonly survive reload",
    value.length === 13 &&
      value.every(
        (n) =>
          n.required && !n.hidden && !n.extraNecessityText && n.domRequired,
      ) &&
      value.find((n) => n.type === "TextArea")?.readOnly === true,
    { url: fieldUrl, value },
  );
  await createProject();
  await add("avatar group");
  const avatar = (await read()).find((n) => n.type === "Avatar");
  await select(avatar.id);
  const slotField = panel().getByRole("group", {
    name: "Slot of AvatarGroup",
    exact: true,
  });
  check(
    "Avatar",
    "context inheritance is preserved without a RAC slot editor",
    (await slotField.count()) === 0 &&
      (await panel().getByText("RAC slot", { exact: true }).count()) === 0 &&
      (await read()).find((n) => n.id === avatar.id)?.props.slot ===
        avatar.props.slot,
  );
  await page.screenshot({ path: `${OUT}/avatar-slot.png` });
  await add("card");
  const card = (await read()).find((n) => n.type === "Card");

  check(
    "Card",
    "Disabled available on origin Property",
    await panel()
      .getByRole("button", { name: "Disabled", exact: true })
      .isVisible(),
  );
  await panel().getByRole("button", { name: "Disabled", exact: true }).click();
  await settle();
  check(
    "Card",
    "Disabled command reaches Canvas record",
    (await read()).find((n) => n.id === card.id)?.props.isDisabled === true,
  );
  await add("link button");
  const link = (await read()).find((n) => n.type === "LinkButton");

  check(
    "LinkButton",
    "Property contract removes unsupported Link options",
    (await panel()
      .getByRole("button", { name: "Quiet", exact: true })
      .count()) === 0 &&
      (await panel()
        .getByRole("button", { name: "Standalone", exact: true })
        .count()) === 0,
  );
  await page.waitForTimeout(1200);
  const url = page.url();
  await page.reload();
  await page.waitForFunction(() => window.__COMPOSITION_CATALOG__?.workspace);
  await previewReady();
  check(
    "Avatar",
    "Slot detach survives reload",
    (await read()).find((n) => n.id === avatar.id)?.props.slot === false,
  );
  check(
    "Card",
    "Disabled survives reload",
    (await read()).find((n) => n.id === card.id)?.props.isDisabled === true,
  );
  await createProject();
  await add("button group");
  await panel().getByRole("radio", { name: "L", exact: true }).click();
  await panel().getByRole("button", { name: "Disabled", exact: true }).click();
  const groupComponents = page.locator('[data-panel-id="components"]');
  await groupComponents.getByRole("searchbox").fill("link button");
  await groupComponents
    .getByRole("button", { name: "link button", exact: true })
    .click();
  await settle();
  const groupedLink = (await read()).find((n) => n.type === "LinkButton");
  const groupedDom = page
    .frameLocator("#previewFrame")
    .locator(`[data-catalog-id="${groupedLink.id}"]`);
  check(
    "ButtonGroup",
    "LinkButton inherits size and disabled in Canvas and Preview",
    groupedLink.props.size === "L" &&
      groupedLink.derivedProps?.isDisabled === true &&
      (await groupedDom.getAttribute("data-size")) === "L" &&
      (await groupedDom.getAttribute("data-disabled")) !== null,
    groupedLink,
  );
  await page.screenshot({ path: `${OUT}/group-link.png` });
  check("All", "console and page errors", errors.length === 0, errors);
} catch (error) {
  check("Contracts", "exercise", false, String(error));
  await page.screenshot({ path: `${OUT}/failure.png` });
  writeFileSync(`${OUT}/ui.txt`, await page.locator("body").ariaSnapshot());
} finally {
  save();
  await browser.close();
}
if (results.some((row) => !row.pass)) process.exitCode = 1;
