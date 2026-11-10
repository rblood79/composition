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
async function project(palette) {
  await page.goto(`${BASE}/dashboard`);
  await page
    .getByRole("button", { name: "New project", exact: true })
    .first()
    .click();
  await page
    .getByRole("textbox", { name: "Project name" })
    .fill(`S2 remaining ${palette} ${Date.now()}`);
  await page.getByRole("button", { name: "Create", exact: true }).click();
  await page.waitForURL(/\/builder\//);
  await page.waitForFunction(() => window.__COMPOSITION_CATALOG__?.workspace);
  await rail("Navigator");
  await rail("Components");
  await rail("Design");
  await layers().getByRole("row", { name: "Body", exact: true }).press("Space");
  const components = page.locator('[data-panel-id="components"]');
  await components.getByRole("searchbox").fill(palette);
  await components.getByRole("button", { name: palette, exact: true }).click();
  await ready();
  await panel().getByRole("tab", { name: "Property", exact: true }).click();
  await page.evaluate(() =>
    window.__COMPOSITION_CATALOG__.canvas.setCamera({
      scale: 1,
      x: 420,
      y: 160,
    }),
  );
  await settle();
}
async function snapshot() {
  return page.evaluate(() => {
    const root = window.__COMPOSITION_CATALOG__.workspace.root,
      doc = document.querySelector("#previewFrame")?.contentDocument;
    return [...root.canvasInputs.values()].map((node) => {
      const el = doc?.querySelector(`[data-catalog-id="${node.id}"]`),
        css = el && doc.defaultView.getComputedStyle(el);
      return {
        id: node.id,
        type: root.typeOf(node),
        props: node.props,
        derived: node.derivedProps,
        box: root.getGeometry([node.id]).get(node.id),
        dom: el
          ? {
              width: parseFloat(css.width),
              height: parseFloat(css.height),
              font: css.fontSize,
              line: css.lineHeight,
              target: el.getAttribute("target"),
              placement: el.getAttribute("data-placement"),
              expanded: el.hasAttribute("data-expanded"),
            }
          : null,
      };
    });
  });
}
async function choose(label, value) {
  const field = panel().getByRole("group", { name: label, exact: true });
  await field.getByRole("button").click();
  await page.getByRole("option", { name: value, exact: true }).click();
  await settle();
}
async function reloaded() {
  await page.waitForTimeout(900);
  await page.reload();
  await ready();
}
async function capture(name) {
  const controls = page.getByRole("toolbar", { name: /panel controls$/ });
  const visiblePanels = [];
  for (const panelName of ["Navigator", "Components", "Design"]) {
    const button = controls.getByRole("button", {
      name: panelName,
      exact: true,
    });
    if ((await button.getAttribute("aria-pressed")) === "true") {
      visiblePanels.push(panelName);
      await button.click();
    }
  }
  const split = page.getByRole("separator", {
    name: "Resize the CSS / Canvas compare split",
    exact: true,
  });
  for (const [surface, key] of [
    ["canvas", "Home"],
    ["preview", "End"],
  ]) {
    await split.press(key);
    await settle();
    await page.screenshot({ path: `${OUT}/${name}-${surface}.png` });
  }
  for (const panelName of visiblePanels) await rail(panelName);
}
const allowed = (type) =>
  !process.env.S2_REMAINING ||
  process.env.S2_REMAINING.split(",").includes(type);
try {
  if (allowed("Avatar")) {
    await project("avatar");
    let nodes = await snapshot(),
      avatar = nodes.find((n) => n.type === "Avatar");
    check(
      "Avatar",
      "default numeric 24 in Canvas and Preview",
      avatar.props.size === 24 &&
        avatar.box.width === 24 &&
        avatar.dom.width === 24,
      avatar,
    );
    await choose("Size", "64");
    avatar = (await snapshot()).find((n) => n.type === "Avatar");
    check(
      "Avatar",
      "numeric preset survives both renderers",
      avatar.props.size === 64 &&
        avatar.box.width === 64 &&
        avatar.dom.width === 64,
      avatar,
    );
    await page.keyboard.press("Meta+z");
    await settle();
    check(
      "Avatar",
      "Undo restores default 24",
      (await snapshot()).find((n) => n.type === "Avatar").props.size === 24,
    );
    await page.keyboard.press("Meta+Shift+z");
    await settle();
    check(
      "Avatar",
      "Redo restores numeric 64",
      (await snapshot()).find((n) => n.type === "Avatar").props.size === 64,
    );
    const custom = panel()
      .getByRole("group", { name: "Custom Size", exact: true })
      .getByRole("textbox");
    await custom.fill("50.5");
    await custom.press("Tab");
    await settle();
    avatar = (await snapshot()).find((n) => n.type === "Avatar");
    check(
      "Avatar",
      "custom numeric 50.5 remains a number",
      avatar.props.size === 50.5 &&
        avatar.box.width === 50.5 &&
        avatar.dom.width === 50.5,
      avatar,
    );
    await custom.fill("1.5lh");
    await custom.press("Tab");
    await settle();
    avatar = (await snapshot()).find((n) => n.type === "Avatar");
    check(
      "Avatar",
      "lh uses the same inherited typography",
      avatar.props.size === "1.5lh" &&
        Math.abs(avatar.box.width - avatar.dom.width) < 0.1,
      avatar,
    );
    await capture("avatar-lh");
    await reloaded();
    avatar = (await snapshot()).find((n) => n.type === "Avatar");
    check(
      "Avatar",
      "lh survives save and reload",
      avatar.props.size === "1.5lh" &&
        Math.abs(avatar.box.width - avatar.dom.width) < 0.1,
      avatar,
    );
    await layers()
      .getByRole("button", { name: "Expand Body Body", exact: true })
      .click();
    await settle();
    await layers()
      .getByRole("row", { name: "Avatar", exact: true })
      .press("Space");
    await panel().getByRole("tab", { name: "Property", exact: true }).click();
    await settle();
    const reset = panel().getByRole("button", {
      name: "Reset Size to default",
      exact: true,
    });
    await reset.click();
    await settle();
    avatar = (await snapshot()).find((n) => n.type === "Avatar");
    check(
      "Avatar",
      "Reset restores S2 default",
      avatar.props.size === 24 &&
        avatar.box.width === 24 &&
        avatar.dom.width === 24,
      avatar,
    );
  }
  if (allowed("AvatarGroup")) {
    await project("avatar group");
    for (const size of [16, 20, 24, 28, 32, 36, 40]) {
      await choose("Size", String(size));
      const nodes = await snapshot(),
        avatars = nodes.filter((n) => n.type === "Avatar"),
        text = nodes.find((n) => n.type === "Text");
      check(
        "AvatarGroup",
        `numeric ${size} and label typography`,
        avatars.length === 3 &&
          avatars.every(
            (n) =>
              n.props.size === size &&
              Math.abs(n.box.width - size) < 0.1 &&
              Math.abs(n.dom.width - size) < 0.1,
          ) &&
          parseFloat(text.dom.font) ===
            [11, 12, 14, 16, 18, 20, 22][
              [16, 20, 24, 28, 32, 36, 40].indexOf(size)
            ],
        { avatars, text },
      );
    }
    await capture("avatar-group");
    await reloaded();
    check(
      "AvatarGroup",
      "numeric group size survives reload",
      (await snapshot())
        .filter((n) => n.type === "Avatar")
        .every((n) => n.props.size === 40 && n.dom.width === 40),
    );
  }
  if (allowed("Accordion")) {
    await project("accordion");
    let nodes = await snapshot(),
      parts = nodes.filter((n) => n.type === "Disclosure");
    check(
      "Accordion",
      "default expands a single section",
      nodes.find((n) => n.type === "Accordion").props.allowsMultipleExpanded ===
        false && parts.filter((n) => n.dom.expanded).length === 1,
      parts,
    );
    await panel().getByRole("radio", { name: "XL", exact: true }).click();
    await settle();
    nodes = await snapshot();
    parts = nodes.filter((n) => n.type === "Disclosure");
    check(
      "Accordion",
      "XL propagates to authored sections",
      parts.every((n) => n.props.size === "XL"),
      parts,
    );
    const buttons = page
      .frameLocator("#previewFrame")
      .locator('button[slot="trigger"]');
    await buttons.nth(1).press("Enter");
    await settle();
    parts = (await snapshot()).filter((n) => n.type === "Disclosure");
    check(
      "Accordion",
      "keyboard switches single expanded section",
      parts.filter((n) => n.dom.expanded).length === 1 && parts[1].dom.expanded,
      parts,
    );
    await buttons.first().press("Enter");
    await settle();
    await capture("accordion-xl");
    await reloaded();
    check(
      "Accordion",
      "XL and single default persist",
      (await snapshot()).find((n) => n.type === "Accordion").props.size ===
        "XL",
    );
  }
  if (allowed("Disclosure")) {
    await project("disclosure");
    await panel().getByRole("radio", { name: "XL", exact: true }).click();
    await settle();
    const record = async () =>
      page.evaluate(() => {
        const root = window.__COMPOSITION_CATALOG__.workspace.root,
          doc = document.querySelector("#previewFrame").contentDocument;
        const node = [...root.canvasInputs.values()].find(
          (n) => root.typeOf(n) === "Button" && n.props.slot === "trigger",
        );
        const el = doc.querySelector(`[data-catalog-id="${node.id}"]`);
        const css = doc.defaultView.getComputedStyle(el);
        const title = [...root.canvasInputs.values()].find(
          (n) => n.parentId === node.id && root.typeOf(n) === "Text",
        );
        const titleElement = doc.querySelector(
          `[data-catalog-id="${title.id}"]`,
        );
        return {
          box: root.getGeometry([node.id]).get(node.id),
          font: css.fontSize,
          line: css.lineHeight,
          padding: css.paddingTop,
          paddingX: css.paddingLeft,
          gap: css.gap,
          height: parseFloat(css.height),
          title: title.visual,
          titleOffset: {
            canvas:
              root.getGeometry([title.id]).get(title.id).x -
              root.getGeometry([node.id]).get(node.id).x,
            dom:
              titleElement.getBoundingClientRect().left -
              el.getBoundingClientRect().left,
          },
        };
      });
    for (const [density, height, padding, paddingX] of [
      ["Regular", 48, 12, 17],
      ["Compact", 40, 8, 14],
      ["Spacious", 56, 16, 20],
    ]) {
      await panel().getByRole("radio", { name: density, exact: true }).click();
      await settle();
      const value = await record();
      check(
        "Disclosure",
        `XL ${density} matches measured S2`,
        value.height === height &&
          value.box.height === height &&
          value.font === "20px" &&
          value.title.fontSize === 20 &&
          value.title.fontWeight === 700 &&
          value.title.lineHeight === 1.2 &&
          parseFloat(value.padding) === padding &&
          parseFloat(value.paddingX) === paddingX &&
          parseFloat(value.gap) === paddingX &&
          Math.abs(value.titleOffset.canvas - value.titleOffset.dom) < 0.1,
        value,
      );
    }
    await capture("disclosure-xl");
  }
  if (allowed("CardView")) {
    await project("card view");
    for (const size of ["XS", "XL"]) {
      await panel().getByRole("radio", { name: size, exact: true }).click();
      await settle();
      const cards = (await snapshot()).filter((n) => n.type === "Card");
      check(
        "CardView",
        `${size} reaches all Card children`,
        cards.length === 3 && cards.every((n) => n.props.size === size),
        cards,
      );
    }
    await capture("card-view-xl");
    await reloaded();
    check(
      "CardView",
      "XL survives save and reload",
      (await snapshot()).find((n) => n.type === "CardView").props.size === "XL",
    );
  }
  if (allowed("Card")) {
    await project("card");
    const link = panel()
      .getByRole("group", { name: "Link", exact: true })
      .getByRole("textbox");
    await link.fill("#card");
    await link.press("Tab");
    await settle();
    for (const [label, value] of [
      ["Parent frame", "_parent"],
      ["Top frame", "_top"],
    ]) {
      await choose("Target", label);
      const card = (await snapshot()).find((n) => n.type === "Card");
      check(
        "Card",
        `${value} forwards to actual anchor`,
        card.props.target === value && card.dom.target === value,
        card,
      );
    }
    await reloaded();
    check(
      "Card",
      "target survives reload",
      (await snapshot()).find((n) => n.type === "Card").props.target === "_top",
    );
  }
  if (allowed("Popover")) {
    await project("popover");
    for (const value of [
      "Start",
      "End",
      "Top left",
      "Top right",
      "Bottom left",
      "Bottom right",
      "Left top",
      "Left bottom",
      "Start top",
      "Start bottom",
      "Right top",
      "Right bottom",
      "End top",
      "End bottom",
    ]) {
      await choose("Placement Value", value);
      const popover = (await snapshot()).find((n) => n.type === "Popover");
      check(
        "Popover",
        `Property writes ${value}`,
        popover.props.placement === value.toLowerCase(),
        popover.props,
      );
    }
    await reloaded();
    check(
      "Popover",
      "placement survives reload",
      (await snapshot()).find((n) => n.type === "Popover").props.placement ===
        "end bottom",
    );
    await page
      .frameLocator("#previewFrame")
      .getByRole("button", { name: "Open Popover", exact: true })
      .press("Enter");
    await settle();
    const opened = (await snapshot()).find((n) => n.type === "Popover");
    check(
      "Popover",
      "new placement opens in running Preview",
      opened.dom?.placement === "right" && opened.dom.width > 0,
      opened,
    );
    await page
      .frameLocator("#previewFrame")
      .locator(".react-aria-Popover")
      .press("Escape");
    await layers()
      .getByRole("button", { name: "Expand Body Body", exact: true })
      .click();
    await layers()
      .getByRole("row", { name: "DialogTrigger", exact: true })
      .press("Space");
    await panel().getByRole("tab", { name: "Property", exact: true }).click();
    await panel().getByRole("button", { name: "Open", exact: true }).click();
    await settle();
    const authored = (await snapshot()).find((n) => n.type === "Popover");
    check(
      "Popover",
      "authored Open measures new placement in both renderers",
      authored.dom?.placement === "right" &&
        authored.box.width > 0 &&
        authored.dom.width > 0,
      authored,
    );
    await capture("popover-placement");
  }
  check("All", "console and page errors", errors.length === 0, errors);
} catch (error) {
  check("Remaining", "exercise", false, String(error));
  await page.screenshot({ path: `${OUT}/failure.png` });
  writeFileSync(`${OUT}/ui.txt`, await page.locator("body").ariaSnapshot());
} finally {
  save();
  await browser.close();
}
if (results.some((row) => !row.pass)) process.exitCode = 1;
