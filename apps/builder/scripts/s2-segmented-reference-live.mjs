// 문서 편집은 Builder UI로 수행하고, 설치 S2는 독립 페이지에서 비교한다.
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
const results = [],
  errors = [];
page.on("pageerror", (error) => errors.push(error.message));
page.on("console", (message) => {
  if (message.type() === "error") errors.push(message.text());
});
const settle = () => page.waitForTimeout(400);
const panel = () => page.locator('[data-panel-id="properties"]');
function check(scenario, pass, detail) {
  results.push({ scenario, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"} ${scenario}`);
  writeFileSync(
    `${output}/results.json`,
    JSON.stringify({ results, errors, url: page.url() }, null, 2),
  );
}
async function rail(name, visible = true) {
  const button = page
    .getByRole("toolbar", { name: /panel controls$/ })
    .getByRole("button", { name, exact: true });
  if (((await button.getAttribute("aria-pressed")) === "true") !== visible)
    await button.click();
}
async function sampleOwn() {
  return page.evaluate(() => {
    const root = window.__COMPOSITION_CATALOG__.workspace.root;
    const doc = document.querySelector("#previewFrame").contentDocument;
    const sample = (element) => {
      if (!element) return null;
      const style = doc.defaultView.getComputedStyle(element);
      return {
        selected: element.getAttribute("aria-checked"),
        focusVisible: element.hasAttribute("data-focus-visible"),
        box: element.getBoundingClientRect().toJSON(),
        styles: Object.fromEntries(
          [
            "backgroundColor",
            "color",
            "borderTopColor",
            "borderTopWidth",
            "borderRadius",
            "fontFamily",
            "fontSize",
            "fontWeight",
            "lineHeight",
            "paddingTop",
            "paddingLeft",
            "columnGap",
            "outlineColor",
            "outlineWidth",
            "outlineStyle",
            "width",
            "height",
          ].map((key) => [key, style[key]]),
        ),
      };
    };
    const records = [...root.canvasInputs.values()].filter(
      (node) => root.typeOf(node) === "SegmentedControlItem",
    );
    return {
      locale: root.environmentLocale ?? navigator.language,
      group: sample(doc.querySelector('[role="radiogroup"]')),
      items: [...doc.querySelectorAll('[role="radio"]')].map(sample),
      indicator: sample(doc.querySelector(".react-aria-SelectionIndicator")),
      canvas: records.map((node) => root.getGeometry([node.id]).get(node.id)),
    };
  });
}
async function selectGroup() {
  await rail("Navigator");
  const layers = page.getByRole("treegrid", { name: "Layers", exact: true });
  const expand = layers.getByRole("button", {
    name: "Expand Body Body",
    exact: true,
  });
  if (await expand.count()) await expand.click();
  await layers
    .getByRole("row", { name: "SegmentedControl", exact: true })
    .press("Space");
  await rail("Design");
  await panel().getByRole("tab", { name: "Property", exact: true }).click();
}
try {
  await page.goto(`${base}/dashboard`);
  await page
    .getByRole("button", { name: "New project", exact: true })
    .first()
    .click();
  await page
    .getByRole("textbox", { name: "Project name" })
    .fill(`Segmented S2 parity ${Date.now()}`);
  await page.getByRole("button", { name: "Create", exact: true }).click();
  await page.waitForURL(/\/builder\//);
  await page.waitForFunction(() => window.__COMPOSITION_CATALOG__?.workspace);
  for (const name of ["Navigator", "Components", "Design"]) await rail(name);
  await page
    .getByRole("treegrid", { name: "Layers", exact: true })
    .getByRole("row", { name: "Body", exact: true })
    .press("Space");
  const components = page.locator('[data-panel-id="components"]');
  await components.getByRole("searchbox").fill("segmented control");
  await components
    .getByRole("button", { name: "segmented control", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Compare Mode (Preview + Skia)", exact: true })
    .click();
  await page.frameLocator("#previewFrame").getByRole("radio").first().waitFor();
  await settle();
  const own = await sampleOwn();
  const referencePage = await context.newPage();
  await referencePage.route("**/segmented-s2-reference.html", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: '<!doctype html><html><head><meta charset="utf-8"></head><body><script type="module">import * as oracle from "/scripts/s2-segmented-oracle.browser.mjs";window.segmentedOracle=oracle;</script></body></html>',
    }),
  );
  await referencePage.goto(`${base}/segmented-s2-reference.html`);
  await referencePage.waitForFunction(() => window.segmentedOracle);
  const builtinFonts = await page
    .locator("#composition-builtin-fonts")
    .textContent();
  await referencePage.addStyleTag({ content: builtinFonts });
  const reference = await referencePage.evaluate(
    (options) => window.segmentedOracle.mountSegmentedReference(options),
    { locale: own.locale },
  );
  await referencePage.screenshot({ path: `${output}/s2-default.png` });
  const matched = await referencePage.evaluate(
    (options) => window.segmentedOracle.mountSegmentedReference(options),
    { locale: own.locale, fontFamily: own.items[0].styles.fontFamily },
  );
  writeFileSync(
    `${output}/comparison.json`,
    JSON.stringify({ own, reference, matched }, null, 2),
  );
  check(
    "default selection and indicator match S2",
    own.items[0].selected === reference.items[0].selected &&
      own.items[1].selected === reference.items[1].selected &&
      !!own.indicator,
  );
  check(
    "default group background radius and gap match S2",
    ["backgroundColor", "borderRadius", "columnGap"].every(
      (key) => own.group.styles[key] === reference.group.styles[key],
    ),
    { own: own.group, reference: reference.group },
  );
  check(
    "selected color and indicator surface border match S2",
    own.items[0].styles.color === reference.items[0].styles.color &&
      [
        "backgroundColor",
        "borderTopColor",
        "borderTopWidth",
        "borderRadius",
      ].every(
        (key) => own.indicator.styles[key] === reference.indicator.styles[key],
      ),
    { own: own.indicator, reference: reference.indicator },
  );
  check(
    "typography and control geometry match S2 with the project font",
    own.items.every(
      (item, index) =>
        ["fontSize", "fontWeight", "lineHeight", "height", "paddingLeft"].every(
          (key) => item.styles[key] === matched.items[index].styles[key],
        ) && Math.abs(item.box.width - matched.items[index].box.width) < 0.1,
    ),
    { own: own.items, reference: matched.items },
  );
  check(
    "Canvas and Preview item geometry agree",
    own.canvas.every(
      (box, index) =>
        Math.abs(box.width - own.items[index].box.width) < 0.1 &&
        Math.abs(box.height - own.items[index].box.height) < 0.1,
    ),
    own,
  );
  await page.bringToFront();
  for (const name of ["Navigator", "Components", "Design"])
    await rail(name, false);
  const split = page.getByRole("separator", {
    name: "Resize the CSS / Canvas compare split",
    exact: true,
  });
  for (const [name, key] of [
    ["canvas", "Home"],
    ["preview", "End"],
  ]) {
    await split.press(key);
    await settle();
    await page.screenshot({ path: `${output}/${name}.png` });
  }
  const items = page.frameLocator("#previewFrame").getByRole("radio");
  await items.first().focus();
  await items.first().press("ArrowRight");
  await settle();
  const focus = await sampleOwn();
  const referenceItems = referencePage.getByRole("radio");
  await referenceItems.first().focus();
  await referenceItems.first().press("ArrowRight");
  const referenceFocus = await referencePage.evaluate(() =>
    window.segmentedOracle.sampleSegmentedReference(),
  );
  check(
    "ArrowRight focus and selection match S2 with a visible focus ring",
    focus.items.every(
      (item, index) => item.selected === referenceFocus.items[index].selected,
    ) &&
      focus.items[1].focusVisible &&
      focus.items[1].styles.outlineStyle === "solid" &&
      focus.items[1].styles.outlineWidth === "2px",
    focus,
  );
  await items.nth(1).press("Space");
  await settle();
  check(
    "Space selects the focused item",
    (await sampleOwn()).items[1].selected === "true",
  );
  await selectGroup();
  const selected = panel()
    .getByRole("group", { name: "Selected Key", exact: true })
    .getByRole("textbox");
  await selected.fill("second");
  await selected.press("Tab");
  await panel().getByRole("button", { name: "Disabled", exact: true }).click();
  await settle();
  const disabled = await sampleOwn();
  const disabledReference = await referencePage.evaluate(
    (options) => window.segmentedOracle.mountSegmentedReference(options),
    { locale: own.locale, isDisabled: true, selectedKey: "second" },
  );
  check(
    "disabled content and selected border match S2",
    disabled.items.every(
      (item, index) =>
        item.styles.color === disabledReference.items[index].styles.color,
    ) &&
      disabled.indicator.styles.borderTopColor ===
        disabledReference.indicator.styles.borderTopColor,
    { own: disabled, reference: disabledReference },
  );
  await page.bringToFront();
  await page.keyboard.press("Meta+z");
  await settle();
  check(
    "Undo restores the enabled selected surface",
    (await sampleOwn()).indicator.styles.borderTopColor ===
      reference.indicator.styles.borderTopColor,
  );
  await page.waitForTimeout(1200);
  await page.reload();
  await page.waitForFunction(() => window.__COMPOSITION_CATALOG__?.workspace);
  if (!(await page.locator("#previewFrame").count()))
    await page
      .getByRole("button", {
        name: "Compare Mode (Preview + Skia)",
        exact: true,
      })
      .click();
  await page.frameLocator("#previewFrame").getByRole("radio").first().waitFor();
  await settle();
  check(
    "authored selected key and indicator survive reload",
    (await sampleOwn()).items[1].selected === "true" &&
      !!(await sampleOwn()).indicator,
  );
  check("console and page errors", errors.length === 0, errors);
} catch (error) {
  check("exercise", false, String(error));
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
