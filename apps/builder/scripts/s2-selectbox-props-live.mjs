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
async function editCanvasText(id, value) {
  await page.evaluate((id) => {
    const c = window.__COMPOSITION_CATALOG__,
      b = c.canvas.boundsOf(id);
    c.canvas.setCamera({ scale: 1, x: 700 - b.x, y: 350 - b.y });
  }, id);
  await page
    .getByRole("separator", {
      name: "Resize the CSS / Canvas compare split",
      exact: true,
    })
    .press("Home");
  await settle();
  const editor = page.locator(
    '.catalog-text-editor-input[contenteditable="true"]',
  );
  for (let attempt = 0; attempt < 4 && !(await editor.count()); attempt++) {
    await page.mouse.dblclick(710, 360);
    await settle();
  }
  await editor.fill(value);
  await page.mouse.click(1100, 750);
  await settle();
}
try {
  const type = "SelectBoxGroup";
  await page.goto(`${BASE}/dashboard`);
  await page
    .getByRole("button", { name: "New project", exact: true })
    .first()
    .click();
  await page
    .getByRole("textbox", { name: "Project name" })
    .fill(`SelectBox props ${Date.now()}`);
  await page.getByRole("button", { name: "Create", exact: true }).click();
  await page.waitForURL(/\/builder\//);
  await page.waitForFunction(() => window.__COMPOSITION_CATALOG__?.workspace);
  await rail("Navigator");
  await rail("Components");
  await rail("Design");
  await page
    .getByRole("button", { name: "Compare Mode (Preview + Skia)", exact: true })
    .click();
  const frame = page.frameLocator("#previewFrame");
  await frame.locator("body").waitFor();
  await layers().getByRole("row", { name: "Body", exact: true }).press("Space");
  await page
    .locator('[data-panel-id="components"]')
    .getByRole("searchbox")
    .fill("select box group");
  await page
    .locator('[data-panel-id="components"]')
    .getByRole("button", { name: "select box group", exact: true })
    .click();
  await settle();
  const owner = (await read()).find((node) => node.type === type);
  await select(owner.id);
  check(
    type,
    "Property omits RAC context slot controls",
    (await panel()
      .getByRole("textbox", { name: "Slot", exact: true })
      .count()) === 0 &&
      (await panel().getByText("RAC slot", { exact: true }).count()) === 0,
  );
  await panel().getByRole("radio", { name: "Multiple", exact: true }).click();
  const keys = panel()
    .getByRole("group", { name: "Selected Keys IDs", exact: true })
    .getByRole("textbox");
  await keys.fill("two");
  await keys.press("Tab");
  await settle();
  const state = async () =>
    page.evaluate((id) => {
      const root = window.__COMPOSITION_CATALOG__.workspace.root,
        doc = document.querySelector("#previewFrame").contentDocument;
      return {
        props: root.canvasInputs.get(id).props,
        canvas: [...root.canvasInputs.values()]
          .filter((node) => root.typeOf(node) === "SelectBox")
          .map((node) => ({
            id: node.props.id,
            selected: node.derivedProps?._isSelected,
            disabled: node.derivedProps?.isDisabled,
          })),
        dom: [...doc.querySelectorAll('[role="option"]')].map((el) => ({
          selected: el.getAttribute("aria-selected") === "true",
          disabled: el.getAttribute("aria-disabled") === "true",
        })),
      };
    }, owner.id);
  let value = await state();
  check(
    type,
    "Selected Keys string array reaches Canvas and Preview",
    value.props.selectedKeys?.[0] === "two" &&
      value.canvas[0].selected === false &&
      value.canvas[1].selected === true &&
      value.dom[0].selected === false &&
      value.dom[1].selected === true,
    value,
  );
  const disabled = panel()
    .getByRole("group", { name: "Disabled Keys", exact: true })
    .getByRole("textbox");
  await disabled.fill("one");
  await disabled.press("Tab");
  await settle();
  value = await state();
  check(
    type,
    "Disabled Keys reaches both consumers",
    value.canvas[0].disabled === true && value.dom[0].disabled === true,
    value,
  );
  await disabled.fill("");
  await disabled.press("Tab");
  await settle();
  await panel()
    .getByRole("toolbar", { name: "Selected Keys", exact: true })
    .getByRole("button", { name: "All", exact: true })
    .click();
  await settle();
  value = await state();
  check(
    type,
    "All remains a scalar and selects both consumers",
    value.props.selectedKeys === "all" &&
      value.canvas.every((item) => item.selected) &&
      value.dom.every((item) => item.selected),
    value,
  );
  await panel()
    .getByRole("toolbar", { name: "Auto Focus", exact: true })
    .getByRole("button", { name: "Last", exact: true })
    .click();
  await settle();
  await panel().getByRole("radio", { name: "None", exact: true }).click();
  await settle();
  value = await state();
  check(
    type,
    "Focus strategy and escape behavior preserve native values",
    value.props.autoFocus === "last" &&
      value.props.escapeKeyBehavior === "none",
    value.props,
  );
  await frame.getByRole("option").last().press("Escape");
  await settle();
  value = await state();
  check(
    type,
    "Escape None keeps selection",
    value.dom.every((item) => item.selected),
    value,
  );
  await panel()
    .getByRole("group", { name: "Described By", exact: true })
    .getByRole("textbox")
    .fill("audit-help");
  await panel()
    .getByRole("group", { name: "Described By", exact: true })
    .getByRole("textbox")
    .press("Tab");
  await settle();
  check(
    type,
    "Described By is forwarded to the real listbox",
    (await frame.getByRole("listbox").getAttribute("aria-describedby")) ===
      "audit-help",
  );
  await page.screenshot({ path: `${OUT}/properties.png` });
  await page.waitForTimeout(1000);
  await page.reload();
  await page.waitForFunction(() => window.__COMPOSITION_CATALOG__?.workspace);
  await settle();
  const restored = (await read()).find((node) => node.id === owner.id);
  check(
    type,
    "New property values survive save and reload",
    restored.props.selectedKeys === "all" &&
      restored.props.autoFocus === "last" &&
      restored.props.escapeKeyBehavior === "none" &&
      restored.props["aria-describedby"] === "audit-help",
    restored.props,
  );
  check(type, "console/page errors", errors.length === 0, errors);
} catch (error) {
  check("SelectBoxGroup", "exercise", false, String(error));
  await page.screenshot({ path: `${OUT}/failure.png` });
  writeFileSync(`${OUT}/ui.txt`, await page.locator("body").ariaSnapshot());
} finally {
  save();
  await browser.close();
}
if (results.some((result) => !result.pass)) process.exitCode = 1;
