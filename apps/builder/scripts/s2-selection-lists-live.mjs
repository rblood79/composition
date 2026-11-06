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
try {
  for (const [type, palette] of [
    ["ListBox", "list box"],
    ["Select", "select"],
    ["ComboBox", "combo box"],
  ]) {
    if (
      process.env.S2_SELECTION &&
      !process.env.S2_SELECTION.split(",").includes(type)
    )
      continue;
    try {
      await page.goto(`${BASE}/dashboard`);
      await page
        .getByRole("button", { name: "New project", exact: true })
        .first()
        .click();
      await page
        .getByRole("textbox", { name: "Project name" })
        .fill(`S2 selection ${type} ${Date.now()}`);
      await page.getByRole("button", { name: "Create", exact: true }).click();
      await page.waitForURL(/\/builder\//);
      await page.waitForFunction(
        () => window.__COMPOSITION_CATALOG__?.workspace,
      );
      await rail("Design");
      await rail("Navigator");
      await rail("Components");
      await page
        .getByRole("button", {
          name: "Compare Mode (Preview + Skia)",
          exact: true,
        })
        .click();
      const frame = page.frameLocator("#previewFrame");
      await frame.locator("body").waitFor();
      await layers().getByRole("row").first().press("Home");
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
        "palette assembly",
        !!owner,
        nodes.map((n) => n.type),
      );
      await page
        .getByRole("separator", {
          name: "Resize the CSS / Canvas compare split",
          exact: true,
        })
        .press("End");
      if (type === "ListBox") {
        await select(owner.id);
        await panel()
          .getByRole("radio", { name: "Multiple", exact: true })
          .click();
        await settle();
        const options = frame.getByRole("option");
        await options.first().press("ControlOrMeta+a");
        await settle();
        const selected = await options.evaluateAll((ns) =>
          ns.map((n) => n.getAttribute("aria-selected")),
        );
        check(
          type,
          "platform select-all selects all without crashing",
          selected.length > 1 && selected.every((x) => x === "true"),
          selected,
        );
        await options.first().press("Escape");
        await settle();
        const cleared = await options.evaluateAll((ns) =>
          ns.map((n) => n.getAttribute("aria-selected")),
        );
        check(
          type,
          "Escape clears selection",
          cleared.length > 1 && cleared.every((x) => x === "false"),
          cleared,
        );
        const item = nodes.find((n) => n.type === "ListBoxItem");
        await select(item.id);
        await panel()
          .getByRole("button", { name: "Disabled", exact: true })
          .click();
        await settle();
        check(
          type,
          "item Disabled reaches Preview",
          (await options.first().getAttribute("aria-disabled")) === "true",
        );
      } else {
        const trigger =
          type === "Select"
            ? frame.getByRole("button").first()
            : frame.getByRole("combobox");
        await trigger.press("ArrowDown");
        await frame.getByRole("option").first().waitFor();
        const label = (
          await frame.getByRole("option").first().textContent()
        ).trim();
        await page.keyboard.press("Enter");
        await settle();
        const value =
          type === "Select"
            ? await trigger.textContent()
            : await trigger.inputValue();
        check(
          type,
          "ArrowDown and Enter select first option",
          value.includes(label),
          { label, value },
        );
        await trigger.press("ArrowDown");
        await frame.getByRole("option").first().waitFor();
        await page.keyboard.press("Escape");
        await settle();
        check(
          type,
          "Escape closes popup",
          (await frame.getByRole("option").count()) === 0,
        );
        await select(owner.id);
        await panel()
          .getByRole("button", { name: "Required", exact: true })
          .click();
        await settle();
        check(
          type,
          "Required property authored",
          (await read()).find((n) => n.id === owner.id)?.props.isRequired ===
            true,
        );
      }
      await page.screenshot({ path: `${OUT}/${type}-before-reload.png` });
      await page.waitForTimeout(1200);
      await page.reload();
      await page.waitForFunction(
        () => window.__COMPOSITION_CATALOG__?.workspace,
      );
      await settle();
      const loaded = (await read()).find((n) => n.id === owner.id);
      check(
        type,
        "authored property survives reload",
        type === "ListBox"
          ? loaded?.props.selectionMode === "multiple"
          : loaded?.props.isRequired === true,
        loaded?.props,
      );
    } catch (error) {
      check(type, "scenario execution", false, String(error));
      writeFileSync(`${OUT}/${type}-panel.txt`, await panel().ariaSnapshot());
      writeFileSync(
        `${OUT}/${type}-contract.json`,
        JSON.stringify(
          await page
            .evaluate(async () => {
              const ws = window.__COMPOSITION_CATALOG__.workspace;
              const { catalogEditContract } =
                await import("/src/builder/catalogRuntime/editContract.ts");
              const selected = ws.session.getSnapshot().selection[0];
              return {
                selected,
                contract: catalogEditContract(
                  ws.runtime.graph,
                  ws.readModel,
                  selected.target,
                ),
              };
            })
            .catch((e) => String(e)),
          null,
          2,
        ),
      );
      await page
        .screenshot({ path: `${OUT}/${type}-failure.png` })
        .catch(() => {});
    }
  }
} finally {
  save();
  await browser.close();
}
if (results.some((r) => !r.pass) || errors.length) process.exitCode = 1;
