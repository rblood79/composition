import { chromium } from "playwright";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const output = process.argv[2];
mkdirSync(output, { recursive: true });
const base = process.env.BUILDER_URL ?? "http://localhost:5173";
const type = process.env.S2_GROUP ?? "SegmentedControl";
const longLabel = process.env.S2_LONG_LABEL === "1";
const itemType = {
  SegmentedControl: "SegmentedControlItem",
  ToggleButtonGroup: "ToggleButton",
  ActionButtonGroup: "ActionButton",
}[type];
const palette = {
  SegmentedControl: "segmented control",
  ToggleButtonGroup: "toggle button group",
  ActionButtonGroup: "action button group",
}[type];
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
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
const panel = () => page.locator('[data-panel-id="properties"]');
const settle = () => page.waitForTimeout(400);
function check(scenario, pass, detail) {
  results.push({ scenario, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"} ${scenario}`);
  writeFileSync(
    `${output}/results.json`,
    JSON.stringify({ results, errors, url: page.url() }, null, 2),
  );
}
async function rail(name) {
  const button = page
    .getByRole("toolbar", { name: /panel controls$/ })
    .getByRole("button", { name, exact: true });
  if ((await button.getAttribute("aria-pressed")) !== "true")
    await button.click();
}
async function sample() {
  return page.evaluate(
    async ({ type, itemType }) => {
      const { textNeedsEllipsis } =
        await import("/src/builder/workspace/canvas/skia/textParagraphKey.ts");
      const root = window.__COMPOSITION_CATALOG__.workspace.root;
      const doc = document.querySelector("#previewFrame").contentDocument;
      const group = [...root.canvasInputs.values()].find(
        (n) => root.typeOf(n) === type,
      );
      const items = [...root.canvasInputs.values()].filter(
        (n) => root.typeOf(n) === itemType,
      );
      const box = root.getGeometry([group.id]).get(group.id);
      const radius = window.__composition_SKIA_DEBUG__?.getSkiaNode(group.id)
        ?.box?.borderRadius;
      const element = doc.querySelector(`[data-catalog-id="${group.id}"]`);
      return {
        group: {
          id: group.id,
          canvas: box,
          dom: element.getBoundingClientRect().toJSON(),
          radius: Array.isArray(radius) ? radius[0] : radius,
          cssRadius: doc.defaultView.getComputedStyle(element).borderRadius,
          props: group.props,
          justified: element.hasAttribute("data-justified"),
        },
        items: items.map((n) => {
          const element = doc.querySelector(`[data-catalog-id="${n.id}"]`);
          return {
            id: n.id,
            canvas: root.getGeometry([n.id]).get(n.id),
            dom: element.getBoundingClientRect().toJSON(),
            derived: n.derivedProps,
            labels: [...root.canvasInputs.values()]
              .filter(
                (node) =>
                  root.typeOf(node) === "Text" &&
                  root.canvasInputs.get(node.parentId)?.parentId === n.id,
              )
              .map((node) => {
                const element = doc.querySelector(
                  `[data-catalog-id="${node.id}"]`,
                );
                const style = doc.defaultView.getComputedStyle(element);
                const drawn = window.__composition_SKIA_DEBUG__?.getSkiaNode(
                  node.id,
                );
                return {
                  id: node.id,
                  canvas: root.getGeometry([node.id]).get(node.id),
                  skia: drawn?.text,
                  needsEllipsis: textNeedsEllipsis(drawn),
                  clientWidth: element.clientWidth,
                  scrollWidth: element.scrollWidth,
                  overflow: style.overflow,
                  textOverflow: style.textOverflow,
                  whiteSpace: style.whiteSpace,
                };
              }),
          };
        }),
      };
    },
    { type, itemType },
  );
}
async function selectRecord(id) {
  await rail("Navigator");
  const ancestors = await page.evaluate((id) => {
    const root = window.__COMPOSITION_CATALOG__.workspace.root;
    const ids = [];
    for (
      let node = root.canvasInputs.get(id);
      node;
      node = root.canvasInputs.get(node.parentId)
    )
      ids.unshift(node.id);
    return ids;
  }, id);
  const layers = page.getByRole("treegrid", { name: "Layers", exact: true });
  for (const id of ancestors) {
    const row = layers.locator(`[role="row"][data-key="${id}"]`);
    const expand = row.getByRole("button", { name: /^Expand / });
    if (await expand.count()) await expand.click();
  }
  await layers.locator(`[role="row"][data-key="${id}"]`).press("Space");
  await rail("Design");
  await panel().getByRole("tab", { name: "Property", exact: true }).click();
}
function checkTruncation(name, value) {
  const label = value.items[0].labels[0];
  check(
    name,
    label.needsEllipsis &&
      label.skia.textOverflow === "ellipsis" &&
      label.skia.clipText === true &&
      label.textOverflow === "ellipsis" &&
      label.overflow === "hidden" &&
      label.whiteSpace === "nowrap" &&
      label.scrollWidth > label.clientWidth &&
      label.canvas.width <= value.items[0].canvas.width - 24 + 0.2,
    value,
  );
  const short = value.items[1].labels[0];
  check(
    `${name} keeps a fitting short label whole`,
    !short.needsEllipsis && short.scrollWidth <= short.clientWidth,
    short,
  );
}
async function screenshot(name) {
  await page.bringToFront();
  await page.evaluate((type) => {
    const catalog = window.__COMPOSITION_CATALOG__;
    const root = catalog.workspace.root;
    const group = [...root.canvasInputs.values()].find(
      (node) => root.typeOf(node) === type,
    );
    const box = catalog.canvas.boundsOf(group.id);
    catalog.canvas.setCamera({ scale: 1, x: 600 - box.x, y: 260 - box.y });
  }, type);
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
    await page.screenshot({ path: `${output}/${name}-${renderer}.png` });
  }
  for (const name of ["Navigator", "Components", "Design"]) await rail(name);
}
function checkWidths(name, value) {
  check(
    `${name} Canvas and Preview item widths match`,
    value.items.every((n) => Math.abs(n.canvas.width - n.dom.width) < 0.2),
    value,
  );
  if (type === "SegmentedControl" || name !== "Hug Justified")
    check(
      `${name} items have equal widths`,
      Math.abs(value.items[0].canvas.width - value.items[1].canvas.width) <
        0.2 &&
        Math.abs(value.items[0].dom.width - value.items[1].dom.width) < 0.2,
      value,
    );
}
try {
  await page.goto(`${base}/dashboard`);
  await page
    .getByRole("button", { name: "New project", exact: true })
    .first()
    .click();
  await page
    .getByRole("textbox", { name: "Project name" })
    .fill(`Segmented layout ${Date.now()}`);
  await page.getByRole("button", { name: "Create", exact: true }).click();
  await page.waitForURL(/\/builder\//);
  await page.waitForFunction(() => window.__COMPOSITION_CATALOG__?.workspace);
  for (const name of ["Navigator", "Components", "Design"]) await rail(name);
  await page
    .getByRole("treegrid", { name: "Layers", exact: true })
    .getByRole("row", { name: "Body", exact: true })
    .press("Space");
  const components = page.locator('[data-panel-id="components"]');
  await components.getByRole("searchbox").fill(palette);
  await components.getByRole("button", { name: palette, exact: true }).click();
  await page
    .getByRole("button", { name: "Compare Mode (Preview + Skia)", exact: true })
    .click();
  await page
    .frameLocator("#previewFrame")
    .locator(`.react-aria-${type}`)
    .waitFor();
  await panel().getByRole("tab", { name: "Property", exact: true }).click();
  await settle();
  let value = await sample();
  if (type === "SegmentedControl")
    check(
      "Default group radius matches the Preview",
      value.group.radius === Number.parseFloat(value.group.cssRadius) &&
        value.group.radius > 0,
      value,
    );
  await screenshot("default");
  if (type !== "SegmentedControl") {
    await panel().getByRole("tab", { name: "Layout", exact: true }).click();
    await panel()
      .getByRole("button", { name: "Width Size mode", exact: true })
      .click();
    await page
      .getByRole("option", { name: "Fit content", exact: true })
      .click();
    await panel().getByRole("tab", { name: "Property", exact: true }).click();
  }
  await panel().getByRole("button", { name: "Justified", exact: true }).click();
  await settle();
  value = await sample();
  checkWidths("Hug Justified", value);
  await screenshot("hug-justified");
  await panel().getByRole("tab", { name: "Layout", exact: true }).click();
  await panel()
    .getByRole("button", { name: "Width Size mode", exact: true })
    .click();
  await page.getByRole("option", { name: "Fixed", exact: true }).click();
  const width = panel().getByRole("combobox", { name: "Width", exact: true });
  await width.fill("440");
  await width.press("Enter");
  await settle();
  value = await sample();
  checkWidths("Fixed Justified", value);
  await screenshot("fixed-justified");
  if (longLabel) {
    await selectRecord(value.items[0].id);
    const label = panel()
      .getByRole("group", { name: "Label", exact: true })
      .getByRole("textbox");
    await label.fill(
      "아주 긴 목록 보기 레이블 Long segmented control label that must truncate",
    );
    await label.press("Tab");
    await settle();
    value = await sample();
    checkTruncation("Long Korean and English label truncates", value);
    await screenshot("long-label");
    await selectRecord(value.group.id);
    await panel().getByRole("tab", { name: "Layout", exact: true }).click();
    const narrow = panel().getByRole("combobox", {
      name: "Width",
      exact: true,
    });
    await narrow.fill("220");
    await narrow.press("Enter");
    await settle();
    value = await sample();
    checkTruncation("Narrower group preserves ellipsis", value);
    checkWidths("Narrow Justified", value);
    await screenshot("narrow-long-label");
  }
  await page.keyboard.press("Meta+z");
  await settle();
  await page.keyboard.press("Meta+Shift+z");
  await settle();
  checkWidths("Width Undo and Redo", await sample());
  if (type === "SegmentedControl") {
    await panel().getByRole("tab", { name: "Style", exact: true }).click();
    const radius = panel().getByRole("combobox", {
      name: "Radius",
      exact: true,
    });
    await radius.fill("18");
    await radius.press("Enter");
    await radius.press("Tab");
    await settle();
    value = await sample();
    check(
      "Authored radius reaches both renderers",
      value.group.radius === 18 && value.group.cssRadius === "18px",
      value,
    );
    await page.keyboard.press("Meta+z");
    await settle();
    value = await sample();
    check(
      "Radius Undo restores the shared default",
      value.group.radius === 8 && value.group.cssRadius === "8px",
      value,
    );
    await page.keyboard.press("Meta+Shift+z");
    await settle();
    value = await sample();
    check(
      "Radius Redo restores the authored value",
      value.group.radius === 18 && value.group.cssRadius === "18px",
      value,
    );
    await screenshot("edited-radius");
  }
  await page.waitForTimeout(1300);
  await page.reload();
  await page.waitForFunction(() => window.__COMPOSITION_CATALOG__?.workspace);
  if (!(await page.locator("#previewFrame").count()))
    await page
      .getByRole("button", {
        name: "Compare Mode (Preview + Skia)",
        exact: true,
      })
      .click();
  await page
    .frameLocator("#previewFrame")
    .locator(`.react-aria-${type}`)
    .waitFor();
  await settle();
  value = await sample();
  checkWidths("Saved and reloaded Justified", value);
  if (longLabel) checkTruncation("Saved label retains truncation", value);
  if (type === "SegmentedControl")
    check(
      "Saved group keeps rounded background",
      value.group.radius === Number.parseFloat(value.group.cssRadius),
      value,
    );
  check("Console and page errors", errors.length === 0, errors);
} catch (e) {
  check("Live exercise", false, String(e));
  await page.screenshot({ path: `${output}/failure.png` });
  writeFileSync(
    `${output}/page.txt`,
    await page.locator("body").ariaSnapshot(),
  );
} finally {
  await browser.close();
}
if (results.some((r) => !r.pass) || errors.length) process.exitCode = 1;
