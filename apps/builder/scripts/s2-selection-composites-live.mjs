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
  await page.waitForFunction(() => window.__COMPOSITION_CATALOG__?.workspace);
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
      const expand = row.getByRole("button", { name: /^Expand / });
      if (await expand.count()) {
        await expand.first().click();
        await settle();
      }
    }
  }
  const row = layers().locator(`[role="row"][data-key="${id}"]`);
  await row.scrollIntoViewIfNeeded();
  await row.focus();
  if ((await row.getAttribute("aria-selected")) !== "true") {
    await row.press("Space");
  }
  await page.waitForFunction((id) => {
    const row = document.querySelector(`[role="row"][data-key="${id}"]`);
    return row?.getAttribute("aria-selected") === "true";
  }, id);
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
  for (const [type, palette] of [
    ["ActionBar", "action bar"],
    ["SelectBoxGroup", "select box group"],
  ]) {
    if (
      process.env.S2_COMPOSITES &&
      !process.env.S2_COMPOSITES.split(",").includes(type)
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
        .fill(`S2 ${type} ${Date.now()}`);
      await page.getByRole("button", { name: "Create", exact: true }).click();
      await page.waitForURL(/\/builder\//);
      await page.waitForFunction(
        () => window.__COMPOSITION_CATALOG__?.workspace,
      );
      await rail("Navigator");
      await rail("Components");
      await rail("Design");
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
      const nodes = await read(),
        owner = nodes.find((n) => n.type === type);
      check(
        type,
        "palette creates editable parts",
        !!owner && nodes.length > 3,
        nodes.map((n) => n.type),
      );
      const slotPart = nodes.find((node) =>
        type === "ActionBar"
          ? node.type === "ActionButton" && node.props.slot === "clear"
          : node.type === "Text" && node.props.slot === "label",
      );
      const provider = type === "ActionBar" ? "ActionBar" : "ListBoxItem";
      await select(slotPart.id);
      const slotField = panel().getByRole("group", {
        name: `Slot of ${provider}`,
        exact: true,
      });
      check(
        type,
        "named part keeps its context role without a RAC slot editor",
        (await slotField.count()) === 0 &&
          (await panel().getByText("RAC slot", { exact: true }).count()) ===
            0 &&
          (await read()).find((node) => node.id === slotPart.id)?.props.slot ===
            slotPart.props.slot,
      );
      const child = nodes.find(
        (n) =>
          n.type === "Text" &&
          n.props.children === (type === "ActionBar" ? "Edit" : "Option one"),
      );
      const editedText =
        type === "ActionBar" ? "Edited action" : "Edited option";
      await editCanvasText(child.id, editedText);
      await settle();
      check(
        type,
        "authored child text reaches Preview",
        (await frame.locator("body").textContent()).includes(editedText),
      );
      if (type === "SelectBoxGroup") {
        const description = nodes.find(
          (n) =>
            n.type === "Text" &&
            n.props.slot === "description" &&
            n.props.children === "Description",
        );
        await select(owner.id);
        await panel()
          .getByRole("radio", { name: "Horizontal", exact: true })
          .click();
        await settle();
        await editCanvasText(description.id, "Edited description");
        check(
          type,
          "Canvas edits the real description child",
          (await read()).find((n) => n.id === description.id)?.props
            .children === "Edited description",
        );
        await select(owner.id);
        await panel()
          .getByRole("radio", { name: "Vertical", exact: true })
          .click();
        await settle();
        await settle();
        const descriptionState = await page.evaluate((id) => {
          const w = window.__COMPOSITION_CATALOG__.workspace;
          const n = w.root.canvasInputs.get(id);
          const el = document
            .querySelector("#previewFrame")
            .contentDocument.querySelector(`[data-catalog-id="${id}"]`);
          const option = el?.closest('[role="option"]');
          return {
            props: n?.props,
            hidden: n?.hidden,
            display: el && getComputedStyle(el).display,
            slot: el?.getAttribute("slot"),
            orientation: option?.getAttribute("data-orientation"),
            matches: option?.matches('[data-orientation="vertical"]'),
            html: el?.outerHTML,
          };
        }, description.id);
        check(
          type,
          "vertical authored and edited descriptions stay hidden",
          !(await frame
            .getByText("Edited description", { exact: true })
            .isVisible()),
          descriptionState,
        );
        const defaultBox = await frame
          .getByRole("option")
          .first()
          .evaluate((el) => {
            const r = el.getBoundingClientRect(),
              s = getComputedStyle(el);
            return {
              width: r.width,
              height: r.height,
              border: s.borderColor,
              borderWidth: s.borderTopWidth,
            };
          });
        check(
          type,
          "vertical default box and selected paint are emitted",
          defaultBox.width === 170 &&
            defaultBox.height === 170 &&
            defaultBox.borderWidth === "2px" &&
            defaultBox.border !== "rgba(0, 0, 0, 0)",
          defaultBox,
        );
      }
      await select(owner.id);
      if (type === "ActionBar") {
        await panel()
          .getByRole("button", { name: "Emphasized", exact: true })
          .click();
        await settle();
        await panel()
          .getByRole("button", { name: "Emphasized", exact: true })
          .click();
        await settle();
        await panel()
          .getByRole("button", { name: "Emphasized", exact: true })
          .click();
        await settle();
        const paint = await frame
          .locator(".react-aria-ActionBar")
          .evaluate((el) => ({
            emphasized: el.getAttribute("data-emphasized"),
            variant: el.getAttribute("data-variant"),
            fill: getComputedStyle(el).backgroundColor,
            countColor: [...el.querySelectorAll(".react-aria-Text")]
              .filter((text) => !text.closest("button"))
              .map((text) => getComputedStyle(text).color),
            buttons: [...el.querySelectorAll("button")].map((button) => ({
              color: getComputedStyle(button).color,
              staticColor: button.getAttribute("data-static-color"),
              text: [
                ...button.querySelectorAll(".react-aria-Text,.react-aria-Icon"),
              ].map((text) => getComputedStyle(text).color),
            })),
          }));
        check(
          type,
          "emphasized variant paints the real surface",
          paint.emphasized === "true" &&
            paint.variant === "default" &&
            paint.fill !== "rgba(0, 0, 0, 0)",
          paint,
        );
        check(
          type,
          "emphasis toggle preserves count/action/clear foreground",
          paint.countColor.every((color) => color === "rgb(255, 255, 255)") &&
            paint.buttons.every(
              (button) =>
                button.color === "rgb(255, 255, 255)" &&
                button.text.every((color) => color === button.color),
            ),
          paint,
        );
        const canvasForeground = await page.evaluate(() => {
          const root = window.__COMPOSITION_CATALOG__.workspace.root;
          return [...root.canvasInputs.values()]
            .filter(
              (node) =>
                !node.hidden &&
                ((root.typeOf(node) === "Icon" &&
                  node.props.iconName === "x") ||
                  (root.typeOf(node) === "Text" &&
                    (["Edited action", "Delete"].includes(
                      node.props.children,
                    ) ||
                      node.sourceId?.includes("component-actionbar__count")))),
            )
            .map((node) => ({
              type: root.typeOf(node),
              text: node.props.children ?? node.props.iconName,
              color: node.derivedProps?.color,
            }));
        });
        check(
          type,
          "Canvas resolves count/action/clear foreground",
          canvasForeground.length === 4 &&
            canvasForeground.every((node) => node.color === "#ffffff"),
          canvasForeground,
        );
        await panel().getByRole("button", { name: "All", exact: true }).click();
        await settle();
        check(
          type,
          "all sentinel is preserved",
          (await read()).find((n) => n.id === owner.id).props
            .selectedItemCount === "all",
        );
        const countLocale = await page.evaluate(
          () =>
            window.__COMPOSITION_CATALOG__.workspace.root.environmentLocale ??
            "en-US",
        );
        const expectedCount = countLocale.startsWith("ko")
          ? "모두 선택됨"
          : "All selected";
        const countText = await frame
          .locator(".react-aria-ActionBar")
          .textContent();
        check(
          type,
          "localized count reaches Preview",
          countText.includes(expectedCount),
          { locale: countLocale, expected: expectedCount, actual: countText },
        );
      } else {
        await panel()
          .getByRole("radio", { name: "Multiple", exact: true })
          .click();
        await settle();
        const options = frame.getByRole("option");
        await options.nth(1).press("Space");
        await settle();
        check(
          type,
          "keyboard selects second authored option",
          (await options.nth(1).getAttribute("aria-selected")) === "true",
        );
        await options.nth(1).press("Space");
        await settle();
        const selection = {
          authored: (await read())
            .filter((n) => n.type === "SelectBox")
            .map((n) => ({
              id: n.props.id,
              selected: n.props.isSelected === true,
            })),
          dom: await options.evaluateAll((els) =>
            els.map((el) => ({
              selected: el.getAttribute("aria-selected") === "true",
              border: getComputedStyle(el).borderColor,
            })),
          ),
        };
        check(
          type,
          "Canvas and Preview authored selection matches before capture",
          selection.authored.length === selection.dom.length &&
            selection.authored.every(
              (item, index) => item.selected === selection.dom[index].selected,
            ),
          selection,
        );
        await select(owner.id);
        await panel()
          .getByRole("radio", { name: "Horizontal", exact: true })
          .click();
        await settle();
        check(
          type,
          "orientation reaches authored layout",
          (await read()).find((n) => n.id === owner.id).props.orientation ===
            "horizontal",
        );
        check(
          type,
          "horizontal layout reveals edited description",
          await frame
            .getByText("Edited description", { exact: true })
            .isVisible(),
        );
      }
      // Move the camera only, then close Builder panels without mutating the document.
      await page.evaluate((id) => {
        const c = window.__COMPOSITION_CATALOG__,
          b = c.canvas.boundsOf(id);
        c.canvas.setCamera({ scale: 1, x: 460 - b.x, y: 240 - b.y });
      }, owner.id);
      await page.mouse.click(1350, 850);
      await page.keyboard.press("Escape");
      await page.keyboard.press("Escape");
      for (const name of ["Navigator", "Components", "Design"]) {
        const b = page
          .getByRole("toolbar", { name: /panel controls$/ })
          .getByRole("button", { name, exact: true });
        if ((await b.getAttribute("aria-pressed")) === "true") await b.click();
      }
      const split = page.getByRole("separator", {
        name: "Resize the CSS / Canvas compare split",
        exact: true,
      });
      await split.press("Home");
      await page.mouse.move(350, 900);
      await page.waitForTimeout(700);
      await page.screenshot({ path: `${OUT}/${type}-canvas.png` });
      await split.press("End");
      await page.mouse.move(350, 900);
      await page.waitForTimeout(700);
      await page.screenshot({ path: `${OUT}/${type}-preview.png` });
      const geometry = await page.evaluate((id) => {
        const c = window.__COMPOSITION_CATALOG__,
          n = c.workspace.root.canvasInputs.get(id),
          b = c.workspace.root.getGeometry([id]).get(id),
          el = document
            .querySelector("#previewFrame")
            .contentDocument.querySelector(`[data-catalog-id="${id}"]`),
          r = el.getBoundingClientRect();
        return {
          canvas: b,
          dom: { width: r.width, height: r.height },
          type: c.workspace.root.typeOf(n),
        };
      }, owner.id);
      check(
        type,
        "Canvas and Preview geometry agrees",
        Math.abs(geometry.canvas.width - geometry.dom.width) <= 1 &&
          Math.abs(geometry.canvas.height - geometry.dom.height) <= 1,
        geometry,
      );
      if (type === "ActionBar") {
        const parts = await page.evaluate((id) => {
          const root = window.__COMPOSITION_CATALOG__.workspace.root;
          const records = [...root.canvasInputs.values()].filter(
            (node) =>
              root.typeOf(node) === "ActionButton" ||
              node.sourceId?.includes("component-actionbar__count"),
          );
          const canvas = window.__COMPOSITION_CATALOG__.canvas;
          const base = canvas.boundsOf(id);
          const doc = document.querySelector("#previewFrame").contentDocument,
            domBase = doc
              .querySelector(`[data-catalog-id="${id}"]`)
              .getBoundingClientRect();
          return records.map((node) => {
            const box = canvas.boundsOf(node.id),
              rect = doc
                .querySelector(`[data-catalog-id="${node.id}"]`)
                .getBoundingClientRect();
            return {
              source: node.sourceId,
              type: root.typeOf(node),
              slot: node.props.slot,
              canvas: {
                x: box.x - base.x,
                y: box.y - base.y,
                width: box.width,
                height: box.height,
              },
              dom: {
                x: rect.x - domBase.x,
                y: rect.y - domBase.y,
                width: rect.width,
                height: rect.height,
              },
            };
          });
        }, owner.id);
        check(
          type,
          "child geometry agrees between Canvas and Preview",
          parts.every((part) =>
            ["x", "y", "width", "height"].every(
              (axis) => Math.abs(part.canvas[axis] - part.dom[axis]) <= 1,
            ),
          ),
          parts,
        );
      }
      await page.waitForTimeout(1000);
      await page.reload();
      await page.waitForFunction(
        () => window.__COMPOSITION_CATALOG__?.workspace,
      );
      await settle();
      const restored = (await read()).find((n) => n.id === owner.id);
      check(
        type,
        "authored child edit survives reload",
        (await read()).find((n) => n.id === child.id)?.props.children ===
          editedText,
      );
      check(
        type,
        "authored state survives reload",
        type === "ActionBar"
          ? restored.props.selectedItemCount === "all"
          : restored.props.orientation === "horizontal" &&
              restored.props.selectionMode === "multiple",
        restored.props,
      );
    } catch (error) {
      check(type, "exercise", false, String(error));
      await page.screenshot({ path: `${OUT}/${type}-failure.png` });
      writeFileSync(
        `${OUT}/${type}-ui.txt`,
        await page.locator("body").ariaSnapshot(),
      );
    }
  }
  check("all", "console/page errors", errors.length === 0, errors);
} finally {
  save();
  await browser.close();
}
if (results.some((x) => !x.pass)) process.exitCode = 1;
