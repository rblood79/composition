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
  reducedMotion:
    process.env.REDUCED_MOTION === "1" ? "reduce" : "no-preference",
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
try {
  for (const [type, palette] of [
    ["RangeSlider", "range slider"],
    ["SegmentedControl", "segmented control"],
  ].filter(
    ([type]) =>
      !process.env.COMPONENT_FILTER || type === process.env.COMPONENT_FILTER,
  )) {
    try {
      await page.goto(`${BASE}/dashboard`);
      await page
        .getByRole("button", { name: "New project", exact: true })
        .first()
        .click();
      await page
        .getByRole("textbox", { name: "Project name" })
        .fill(`S2 stage4 ${type} ${Date.now()}`);
      await page.getByRole("button", { name: "Create", exact: true }).click();
      await page.waitForURL(/\/builder\//);
      await page.waitForFunction(
        () => window.__COMPOSITION_CATALOG__?.workspace,
      );
      for (const name of ["Design", "Navigator", "Components"])
        await rail(name);
      await page
        .getByRole("button", {
          name: "Compare Mode (Preview + Skia)",
          exact: true,
        })
        .click();
      const frame = page.frameLocator("#previewFrame");
      await frame.locator("body").waitFor();
      await layers()
        .getByRole("row", { name: "Body", exact: true })
        .press("Space");
      await page
        .locator('[data-panel-id="components"]')
        .getByRole("searchbox")
        .fill(palette);
      await page
        .locator('[data-panel-id="components"]')
        .getByRole("button", { name: palette, exact: true })
        .click();
      await settle();
      const nodes = await read();
      const owner = nodes.find((n) => n.type === type);
      check(
        type,
        "palette authored children",
        !!owner &&
          nodes.some(
            (n) =>
              n.type ===
              (type === "RangeSlider" ? "SliderThumb" : "SegmentedControlItem"),
          ),
        nodes.map((n) => n.type),
      );
      const split = page.getByRole("separator", {
        name: "Resize the CSS / Canvas compare split",
        exact: true,
      });
      await split.press("End");
      if (type === "RangeSlider") {
        const inputs = frame.locator('input[type="range"]');
        await inputs.first().waitFor();
        check(
          type,
          "two default thumb inputs",
          (await inputs.count()) === 2 &&
            (await inputs.nth(0).inputValue()) === "25" &&
            (await inputs.nth(1).inputValue()) === "75",
        );
        await inputs.first().press("ArrowRight");
        await settle();
        check(
          type,
          "keyboard moves lower thumb",
          (await inputs.first().inputValue()) === "26",
        );
        await select(owner.id);
        for (const [name, value] of [
          ["Value Start", "15"],
          ["Value End", "85"],
        ]) {
          const input = panel().getByRole("textbox", { name, exact: true });
          await input.fill(value);
          await input.press("Enter");
          await settle();
        }
        const current = (await read()).find((n) => n.id === owner.id);
        check(
          type,
          "Property RangeValue reaches both consumers",
          current.props.value.start === 15 &&
            current.props.value.end === 85 &&
            (await inputs.first().inputValue()) === "15" &&
            (await inputs.nth(1).inputValue()) === "85",
          current.props,
        );
      } else {
        const items = frame.getByRole("radio");
        await items.first().waitFor();
        check(
          type,
          "item origin labels resolve",
          (await items.first().textContent()) === "List" &&
            (await items.nth(1).textContent()) === "Grid",
        );
        check(
          type,
          "first item selected",
          (await items.first().getAttribute("aria-checked")) === "true",
        );
        const typography = await items.first().evaluate((button) =>
          [button, ...button.querySelectorAll("div, .react-aria-Text")].map(
            (element) => ({
              cls: element.className,
              style: element.getAttribute("style"),
              font: getComputedStyle(element).fontSize,
              family: getComputedStyle(element).fontFamily,
              line: getComputedStyle(element).lineHeight,
              width: element.getBoundingClientRect().width,
            }),
          ),
        );
        writeFileSync(
          `${OUT}/typography.json`,
          JSON.stringify(typography, null, 2),
        );
        check(
          type,
          "content Text inherits the item typography",
          typography
            .filter((part) => part.cls === "react-aria-Text")
            .every(
              (part) =>
                part.font === typography[0].font &&
                part.line === typography[0].line,
            ),
          typography,
        );
        const pressBox = () =>
          items.first().evaluate((button) => {
            const content = button.querySelector(
              ":scope > div:not(.react-aria-SelectionIndicator)",
            );
            const indicator = button.querySelector(
              ".react-aria-SelectionIndicator",
            );
            return {
              content: content.getBoundingClientRect().width,
              host: button.getBoundingClientRect().width,
              indicator: indicator.getBoundingClientRect().width,
              pressed: button.hasAttribute("data-pressed"),
              transform: getComputedStyle(content).transform,
              widthVar: getComputedStyle(content).getPropertyValue(
                "--catalog-press-width",
              ),
            };
          });
        const resting = await pressBox();
        await items.first().focus();
        await page.keyboard.down("Space");
        await page.waitForTimeout(250);
        const pressed = await pressBox();
        await page.keyboard.up("Space");
        await settle();
        const released = await pressBox();
        check(
          type,
          "press scales only content and release restores it",
          pressed.content < resting.content &&
            Math.abs(pressed.host - resting.host) < 0.1 &&
            Math.abs(pressed.indicator - resting.indicator) < 0.1 &&
            Math.abs(released.content - resting.content) < 0.1,
          { resting, pressed, released },
        );
        await frame.getByRole("radiogroup").evaluate((group) => {
          const start = performance.now();
          const probe = {
            samples: [],
            reduced: matchMedia("(prefers-reduced-motion: reduce)").matches,
          };
          window.__segmentedMotionProbe = probe;
          const sample = () => {
            const indicator = group.querySelector(
              '[aria-checked="true"] .react-aria-SelectionIndicator',
            );
            if (indicator) {
              const bounds = indicator.getBoundingClientRect();
              const root = group.getBoundingClientRect();
              const css = getComputedStyle(indicator);
              probe.samples.push({
                time: performance.now() - start,
                x: bounds.x - root.x,
                width: bounds.width,
                connected: group.isConnected,
                transition: css.transitionProperty,
                duration: css.transitionDuration,
                animations: indicator
                  .getAnimations()
                  .map((animation) => animation.transitionProperty),
              });
            }
            if (performance.now() - start < 600) requestAnimationFrame(sample);
          };
          sample();
        });
        await items.first().press("ArrowRight");
        await items.nth(1).press("Space");
        await settle();
        const motion = await frame
          .locator("body")
          .evaluate(() => window.__segmentedMotionProbe);
        const firstX = motion.samples[0].x,
          lastX = motion.samples.at(-1).x;
        const middleFrames = motion.samples.filter(
          (sample) => sample.x > firstX + 0.5 && sample.x < lastX - 0.5,
        );
        const activeTranslate = motion.samples.some((sample) =>
          sample.animations.includes("translate"),
        );
        check(
          type,
          motion.reduced
            ? "reduced motion disables indicator transition"
            : "indicator animates through intermediate positions",
          motion.samples.every((sample) => sample.connected) &&
            lastX > firstX &&
            (motion.reduced
              ? middleFrames.length === 0 &&
                !activeTranslate &&
                motion.samples.every((sample) => sample.transition === "none")
              : middleFrames.length > 0 && activeTranslate),
          motion,
        );
        check(
          type,
          "keyboard selection changes",
          (await items.nth(1).getAttribute("aria-checked")) === "true",
        );
        await items.nth(1).press("Space");
        check(
          type,
          "cannot deselect active item",
          (await items.nth(1).getAttribute("aria-checked")) === "true",
        );
        await select(owner.id);
        check(
          type,
          "root slot uses shared section without a free text input",
          (await panel()
            .getByRole("group", { name: "Slot", exact: true })
            .getByRole("textbox")
            .count()) === 0,
        );
        const orientation = panel().getByRole("group", {
          name: "Orientation",
          exact: true,
        });
        await orientation
          .getByRole("radio", { name: "Vertical", exact: true })
          .click();
        await settle();
        const vertical = await frame
          .getByRole("radiogroup")
          .evaluate((group) => {
            const buttons = group.querySelectorAll("button");
            return {
              orientation: group.getAttribute("aria-orientation"),
              first: buttons[0].getBoundingClientRect().toJSON(),
              second: buttons[1].getBoundingClientRect().toJSON(),
            };
          });
        await items.first().focus();
        await items.first().press("ArrowDown");
        check(
          type,
          "vertical property changes geometry and keyboard axis",
          vertical.orientation === "vertical" &&
            vertical.second.y > vertical.first.y &&
            (await items.nth(1).getAttribute("aria-checked")) === "true",
          vertical,
        );
        await orientation
          .getByRole("radio", { name: "Horizontal", exact: true })
          .click();
        await settle();
        const input = panel()
          .getByRole("group", {
            name: "Selected Key",
            exact: true,
          })
          .getByRole("textbox");
        await input.fill("second");
        await input.press("Tab");
        await settle();
        check(
          type,
          "Property key selects second item",
          (await items.nth(1).getAttribute("aria-checked")) === "true",
        );
        const item = nodes.find((n) => n.type === "SegmentedControlItem");
        await select(item.id);
        check(
          type,
          "item slot uses shared section without a free text input",
          (await panel()
            .getByRole("group", { name: "Slot", exact: true })
            .getByRole("textbox")
            .count()) === 0,
        );
        const label = panel()
          .getByRole("group", {
            name: "Label",
            exact: true,
          })
          .getByRole("textbox");
        await label.fill("Edited List");
        await label.press("Tab");
        await settle();
        check(
          type,
          "independent item label edit",
          (await items.first().textContent()) === "Edited List",
        );
      }
      await page.evaluate((id) => {
        const cat = window.__COMPOSITION_CATALOG__;
        const b = cat.canvas.boundsOf(id);
        const scale =
          cat.workspace.root.typeOf(cat.workspace.root.canvasInputs.get(id)) ===
          "RangeSlider"
            ? 0.5
            : 1;
        cat.canvas.setCamera({
          scale,
          x: 450 - b.x * scale,
          y: 220 - b.y * scale,
        });
      }, owner.id);
      for (const name of ["Navigator", "Components", "Design"]) {
        const b = page
          .getByRole("toolbar", { name: /panel controls$/ })
          .getByRole("button", { name, exact: true });
        if ((await b.getAttribute("aria-pressed")) === "true") await b.click();
      }
      await page.mouse.move(350, 900);
      await settle();
      await split.press("Home");
      await settle();
      await page.screenshot({ path: `${OUT}/${type}-canvas.png` });
      await split.press("End");
      await settle();
      await page.screenshot({ path: `${OUT}/${type}-preview.png` });
      if (type === "SegmentedControl") {
        const boxes = await page.evaluate(() => {
          const root = window.__COMPOSITION_CATALOG__.workspace.root;
          const doc = document.querySelector("#previewFrame").contentDocument;
          return [...root.canvasInputs.values()]
            .filter((n) => root.typeOf(n) === "SegmentedControlItem")
            .map((n) => ({
              canvas: root.getGeometry([n.id]).get(n.id),
              dom: doc
                .querySelector(`[data-catalog-id="${n.id}"]`)
                .getBoundingClientRect()
                .toJSON(),
            }));
        });
        check(
          type,
          "edited item Canvas and Preview sizes agree",
          boxes.every(
            (box) =>
              Math.abs(box.canvas.width - box.dom.width) <= 1 &&
              Math.abs(box.canvas.height - box.dom.height) <= 1,
          ),
          boxes,
        );
      }

      await page.waitForTimeout(1300);
      await page.reload();
      await page.waitForFunction(
        () => window.__COMPOSITION_CATALOG__?.workspace,
      );
      await settle();
      const loaded = (await read()).find((n) => n.id === owner.id);
      check(
        type,
        "authored state survives reload",
        type === "RangeSlider"
          ? loaded?.props.value?.start === 15 && loaded?.props.value?.end === 85
          : loaded?.props.selectedKey === "second",
        loaded?.props,
      );
      if (type === "SegmentedControl") {
        if (!(await page.locator("#previewFrame").count()))
          await page
            .getByRole("button", {
              name: "Compare Mode (Preview + Skia)",
              exact: true,
            })
            .click();
        const labels = page.frameLocator("#previewFrame").getByRole("radio");
        await labels.first().waitFor();
        check(
          type,
          "independent item label survives reload",
          (await labels.first().textContent()) === "Edited List",
        );
      }
    } catch (error) {
      check(type, "exercise", false, String(error));
      await page
        .screenshot({ path: `${OUT}/${type}-failure.png` })
        .catch(() => {});
      writeFileSync(
        `${OUT}/${type}-panel.txt`,
        await panel()
          .ariaSnapshot()
          .catch(() => ""),
      );
    }
  }
  check("all", "console and page errors", errors.length === 0, errors);
} finally {
  save();
  await browser.close();
}
if (results.some((r) => !r.pass) || errors.length) process.exitCode = 1;
