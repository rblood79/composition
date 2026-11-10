import { chromium } from "playwright";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const output = process.argv[2];
mkdirSync(output, { recursive: true });
const base = process.env.BUILDER_URL ?? "http://localhost:5173";
const auth = JSON.parse(
  readFileSync("apps/builder/scripts/.auth-session.json", "utf8"),
);
auth.origins = auth.origins.map((origin) => ({ ...origin, origin: base }));
const browser = await chromium.launch({ channel: "chrome", headless: false });
const context = await browser.newContext({
  storageState: auth,
  viewport: { width: 1800, height: 1100 },
});
const page = await context.newPage();
page.setDefaultTimeout(10000);
const results = [];
const errors = [];
page.on("pageerror", (error) =>
  errors.push({ message: error.message, url: page.url(), time: Date.now() }),
);
page.on("console", (message) => {
  if (message.type() === "error")
    errors.push({ message: message.text(), url: page.url(), time: Date.now() });
});
const panel = () => page.locator('[data-panel-id="properties"]');
const layers = () =>
  page.getByRole("treegrid", { name: "Layers", exact: true });
const settle = () => page.waitForTimeout(400);
function check(type, scenario, pass, detail) {
  results.push({ type, scenario, pass, detail, url: page.url() });
  console.log(`${pass ? "PASS" : "FAIL"} ${type} ${scenario}`);
  writeFileSync(
    `${output}/results.json`,
    JSON.stringify({ results, errors }, null, 2),
  );
}
async function rail(name) {
  const button = page
    .getByRole("toolbar", { name: /panel controls$/ })
    .getByRole("button", { name, exact: true });
  if ((await button.getAttribute("aria-pressed")) !== "true")
    await button.click();
}
async function ready() {
  await page.waitForFunction(() => window.__COMPOSITION_CATALOG__?.workspace);
  if (!(await page.locator("#previewFrame").count()))
    await page
      .getByRole("button", {
        name: "Compare mode (Preview + Skia)",
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
async function read(itemType) {
  return page.evaluate((itemType) => {
    const root = window.__COMPOSITION_CATALOG__.workspace.root;
    const doc = document.querySelector("#previewFrame").contentDocument;
    return [...root.canvasInputs.values()]
      .filter((node) => root.typeOf(node) === itemType)
      .filter(
        (node) =>
          itemType !== "ActionButton" ||
          root.typeOf(root.canvasInputs.get(node.parentId)) ===
            "ActionButtonGroup",
      )
      .map((node) => ({
        id: node.id,
        sourceId: node.sourceId,
        props: node.props,
        canvas: root.getGeometry([node.id]).get(node.id),
        dom: doc
          .querySelector(`[data-catalog-id="${node.id}"]`)
          ?.getBoundingClientRect()
          .toJSON(),
      }));
  }, itemType);
}
async function selectGroup(type, slot) {
  await rail("Navigator");
  const ancestors = await page.evaluate(
    ({ type, slot }) => {
      const root = window.__COMPOSITION_CATALOG__.workspace.root;
      let node = [...root.canvasInputs.values()].find(
        (node) =>
          root.typeOf(node) === type &&
          (slot === undefined || node.props.slot === slot),
      );
      const result = [];
      while (node) {
        result.unshift(node.id);
        node = root.canvasInputs.get(node.parentId);
      }
      return result;
    },
    { type, slot },
  );
  for (const id of ancestors) {
    const row = layers().locator(`[role="row"][data-key="${id}"]`);
    const expand = row.getByRole("button", { name: /^Expand / });
    if (await expand.count()) await expand.click();
  }
  await layers()
    .locator(`[role="row"][data-key="${ancestors.at(-1)}"]`)
    .press("Space");
  await rail("Design");
  await panel().getByRole("tab", { name: "Property", exact: true }).click();
  await settle();
}
try {
  for (const [type, palette, itemType] of [
    ["ToggleButtonGroup", "toggle button group", "ToggleButton"],
    ["SegmentedControl", "segmented control", "SegmentedControlItem"],
    ["SelectBoxGroup", "select box group", "SelectBox"],
    ["Pagination", "pagination", "Button"],
    ["ColorSwatchPicker", "color swatch picker", "ColorSwatchPickerItem"],
    ["ActionButtonGroup", "action button group", "ActionButton"],
    ["ActionBar", "action bar", "ActionButton"],
    ["CheckboxGroup", "checkbox group", "Checkbox"],
    ["RadioGroup", "radio group", "Radio"],
  ].filter(
    ([type]) =>
      !process.env.S2_GROUPS || process.env.S2_GROUPS.split(",").includes(type),
  )) {
    await page.goto(`${base}/dashboard`);
    await page
      .getByRole("button", { name: "New project", exact: true })
      .first()
      .click();
    await page
      .getByRole("textbox", { name: "Project name" })
      .fill(`Items Slot ${type} ${Date.now()}`);
    await page.getByRole("button", { name: "Create", exact: true }).click();
    await page.waitForURL(/\/builder\//);
    await page.waitForFunction(() => window.__COMPOSITION_CATALOG__?.workspace);
    for (const name of ["Navigator", "Components", "Design"]) await rail(name);
    await layers()
      .getByRole("row", { name: "Body", exact: true })
      .press("Space");
    const components = page.locator('[data-panel-id="components"]');
    await components.getByRole("searchbox").fill(palette);
    await components
      .getByRole("button", { name: palette, exact: true })
      .click();
    await ready();
    await panel().getByRole("tab", { name: "Property", exact: true }).click();
    check(
      type,
      "Root Property omits RAC context slot controls",
      (await panel().getByText("RAC slot", { exact: true }).count()) === 0 &&
        (await panel()
          .getByRole("group", { name: /^Slot(?: of .*)?$/ })
          .count()) === 0,
    );
    const itemsHost = {
      ActionBar: "ActionButtonGroup",
      CheckboxGroup: "CheckboxItems",
      RadioGroup: "RadioItems",
    }[type];
    if (itemsHost) {
      check(
        type,
        "Root Property routes insertion to its item wrapper",
        (await panel()
          .getByRole("button", { name: `Insert ${itemType}`, exact: true })
          .count()) === 1,
      );
      await selectGroup(itemsHost);
    }
    const initialCount = (await read(itemType)).length;
    const slotHost = itemsHost ?? type;
    const fill = panel().getByRole("button", {
      name: "Fill slot",
      exact: true,
    });
    check(
      type,
      "Property exposes the item Slot",
      (await fill.count()) === 1 &&
        (await read(itemType)).length === initialCount,
    );
    await fill.click();
    const choices = await page
      .getByRole("listbox")
      .getByRole("option")
      .allTextContents();
    check(
      type,
      "Slot picker offers the matching item",
      choices.includes(itemType),
      choices,
    );
    await page.getByRole("option", { name: itemType, exact: true }).click();
    await settle();
    let items = await read(itemType);
    check(
      type,
      "Slot inserts an editable item into Canvas and Preview",
      items.length === initialCount + 1 &&
        items.every((item) => item.dom && item.canvas.width > 0),
      items,
    );
    await selectGroup(itemType);
    check(
      type,
      "Child Property omits RAC context slot controls",
      (await panel().getByText("RAC slot", { exact: true }).count()) === 0 &&
        (await panel()
          .getByRole("group", { name: /^Slot(?: of .*)?$/ })
          .count()) === 0,
    );
    if (type === "SelectBoxGroup" || type === "ActionBar") {
      const role = type === "SelectBoxGroup" ? "label" : "clear";
      const part = type === "SelectBoxGroup" ? "Text" : "ActionButton";
      await selectGroup(part, role);
      check(
        type,
        "Named role child retains its role without a context slot editor",
        (await panel().getByText("RAC slot", { exact: true }).count()) === 0 &&
          (await panel()
            .getByRole("group", { name: /^Slot(?: of .*)?$/ })
            .count()) === 0,
      );
      await page.screenshot({ path: `${output}/${type}-role-property.png` });
    }
    await page.keyboard.press("Meta+z");
    await settle();
    check(
      type,
      "Undo restores initial items",
      (await read(itemType)).length === initialCount,
    );
    await page.keyboard.press("Meta+Shift+z");
    await settle();
    check(
      type,
      "Redo restores the added item",
      (await read(itemType)).length === initialCount + 1,
    );
    await selectGroup(slotHost);
    await panel()
      .getByRole("button", { name: "Fill slot", exact: true })
      .click();
    await page.getByRole("option", { name: itemType, exact: true }).click();
    await settle();
    check(
      type,
      "Repeated insertion appends a second item",
      (await read(itemType)).length === initialCount + 2,
    );
    await selectGroup(slotHost);
    await page.screenshot({ path: `${output}/${type}-slot.png` });
    for (const name of ["Navigator", "Components", "Design"]) {
      const button = page
        .getByRole("toolbar", { name: /panel controls$/ })
        .getByRole("button", { name, exact: true });
      if ((await button.getAttribute("aria-pressed")) === "true")
        await button.click();
    }
    const split = page.getByRole("separator", {
      name: "Resize the CSS / Canvas compare split",
      exact: true,
    });
    for (const [renderer, key] of [
      ["canvas", "Home"],
      ["preview", "End"],
    ]) {
      await split.press(key);
      await settle();
      await page.screenshot({ path: `${output}/${type}-${renderer}.png` });
    }
    await page.waitForTimeout(1200);
    await page.reload();
    await ready();
    check(
      type,
      "Inserted items survive save and reload",
      (await read(itemType)).length === initialCount + 2,
    );
    if (type === "SelectBoxGroup") {
      const options = page.frameLocator("#previewFrame").getByRole("option");
      await options.nth(initialCount).press("Space");
      check(
        type,
        "Inserted SelectBox participates in single selection",
        (await options.nth(initialCount).getAttribute("aria-selected")) ===
          "true" &&
          (await options.first().getAttribute("aria-selected")) === "false",
      );
    }
    if (type === "SegmentedControl") {
      const buttons = page.frameLocator("#previewFrame").getByRole("radio");
      await buttons.nth(2).press("Space");
      check(
        type,
        "New item participates in single selection",
        (await buttons.nth(2).getAttribute("aria-checked")) === "true" &&
          (await buttons.first().getAttribute("aria-checked")) === "false",
      );
    }
    await selectGroup(slotHost);
    await panel()
      .getByRole("button", { name: "Restore template content", exact: true })
      .click();
    await settle();
    check(
      type,
      "Slot restore returns authored defaults",
      (await read(itemType)).length === initialCount,
    );
  }
  check("All", "console and page errors", errors.length === 0, errors);
} catch (error) {
  check("Items Slot", "exercise", false, String(error));
  await page.screenshot({ path: `${output}/failure.png` });
  writeFileSync(
    `${output}/page.txt`,
    await page.locator("body").ariaSnapshot(),
  );
} finally {
  await browser.close();
}
if (results.some((result) => !result.pass) || errors.length)
  process.exitCode = 1;
