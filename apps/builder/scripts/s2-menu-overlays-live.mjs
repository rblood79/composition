// UI-authored scratch projects. Read-only runtime inspection; no direct document writes.
import { chromium } from "playwright";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
const OUT = process.argv[2];
mkdirSync(OUT, { recursive: true });
const BASE = process.env.BUILDER_URL ?? "http://localhost:5173";
const screenshotProjects = process.env.S2_SCREENSHOT_PROJECTS
  ? JSON.parse(readFileSync(process.env.S2_SCREENSHOT_PROJECTS, "utf8"))
  : null;
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
  results.push({ type, scenario, pass, detail });
  console.log(
    `${pass ? "PASS" : "FAIL"} ${type} ${scenario} ${JSON.stringify(detail)}`,
  );
  save();
};
const panel = () => page.locator('[data-panel-id="properties"]');
const layers = () =>
  page.getByRole("treegrid", { name: "Layers", exact: true });
async function rail(name) {
  const b = page
    .getByRole("toolbar", { name: /panel controls$/ })
    .getByRole("button", { name, exact: true });
  if ((await b.getAttribute("aria-pressed")) !== "true") await b.click();
}
async function settle() {
  await page.waitForTimeout(450);
}
async function select(id) {
  const row = layers().locator(`[role="row"][data-key="${id}"]`);
  await row.scrollIntoViewIfNeeded();
  await row.press("Space");
  await rail("Design");
  await panel().getByRole("tab", { name: "Property", exact: true }).click();
  await settle();
}
async function read() {
  return page.evaluate(() => {
    const doc = document.querySelector("#previewFrame").contentDocument;
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    return {
      nodes: [...ws.root.canvasInputs.values()].map((n) => ({
        id: n.id,
        type: ws.root.typeOf(n),
        hidden: n.hidden,
        props: n.props,
        rect: ws.root.getGeometry([n.id]).get(n.id),
      })),
      buttons: [...doc.querySelectorAll("button")].map((n) => ({
        text: n.textContent,
        expanded: n.getAttribute("aria-expanded"),
        disabled: n.disabled,
      })),
      focused: doc.activeElement?.textContent,
      selection: ws.session.getSnapshot().selection,
    };
  });
}
async function capture(type) {
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
  for (const [surface, key] of [
    ["canvas", "Home"],
    ["preview", "End"],
  ]) {
    await split.press(key);
    const range = surface === "canvas" ? "aria-valuemin" : "aria-valuemax";
    const target = Number(await split.getAttribute(range));
    if (
      Math.abs(Number(await split.getAttribute("aria-valuenow")) - target) > 1
    ) {
      // An open Menu can retain keyboard focus in its iframe. Drag the actual
      // separator instead and verify the exposed surface before naming the file.
      const box = await split.boundingBox();
      const container = await page
        .locator(".workspace--compare-mode")
        .boundingBox();
      if (!box || !container)
        throw new Error("Compare separator is not measurable");
      await page.mouse.move(
        Math.max(1, box.x + box.width / 2),
        container.y + 300,
      );
      await page.mouse.down();
      await page.mouse.move(
        // Include the splitter handle offset at the clipped viewport edge.
        surface === "canvas"
          ? container.x - 64
          : container.x + container.width + 64,
        container.y + 300,
        { steps: 8 },
      );
      await page.mouse.up();
    }
    await page.waitForFunction(
      ({ range }) => {
        const separator = document.querySelector(".workspace-compare-splitter");
        return (
          separator &&
          Math.abs(
            Number(separator.getAttribute("aria-valuenow")) -
              Number(separator.getAttribute(range)),
          ) <= 1
        );
      },
      { range },
    );
    await page.mouse.move(350, 900);
    if (type === "Menu" && process.env.S2_MENU_BLUR) {
      await page
        .frameLocator("#previewFrame")
        .locator("body")
        .evaluate((body) => {
          const active = body.ownerDocument.activeElement;
          if (active instanceof body.ownerDocument.defaultView.HTMLElement)
            active.blur();
        });
      await page.frameLocator("#previewFrame").getByRole("menu").waitFor();
    }
    await settle();
    await page.screenshot({ path: `${OUT}/${type}-${surface}.png` });
  }
}
try {
  for (const type of (
    process.env.S2_OVERLAYS ?? "Menu,Popover,Dialog,Accordion"
  ).split(",")) {
    try {
      if (screenshotProjects) {
        await page.goto(screenshotProjects[type]);
        await page.waitForFunction(
          () => window.__COMPOSITION_CATALOG__?.workspace,
        );
        const compare = page.getByRole("button", {
          name: "Compare Mode (Preview + Skia)",
          exact: true,
        });
        if ((await compare.getAttribute("aria-pressed")) !== "true")
          await compare.click();
        await page.frameLocator("#previewFrame").locator("body").waitFor();
        await settle();
        const existing = await read();
        if (!existing.nodes.some((node) => node.type === type))
          throw new Error(`Screenshot project has no ${type} component`);
        await capture(type);
        check(type, "screenshots captured with panels closed", true, {
          url: page.url(),
        });
        continue;
      }
      await page.goto(`${BASE}/dashboard`);
      await page
        .getByRole("button", { name: "New project", exact: true })
        .first()
        .click();
      await page
        .getByRole("textbox", { name: "Project name" })
        .fill(`S2 overlay ${type} ${Date.now()}`);
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
        .fill(type.toLowerCase());
      await page
        .locator('[data-panel-id="components"]')
        .getByRole("button", { name: type.toLowerCase(), exact: true })
        .click();
      await settle();
      const initial = await read();
      const id = initial.selection[0]?.identity;
      check(
        type,
        "palette assembly",
        initial.nodes.some((n) => n.type === type),
        { id, types: initial.nodes.map((n) => n.type), url: page.url() },
      );
      if (process.env.S2_SCREENSHOT_ONLY) {
        if (type !== "Accordion") {
          await select(id);
          await panel()
            .getByRole("button", { name: "Open", exact: true })
            .click();
          await frame.locator(".react-aria-Popover").first().waitFor();
        }
        await settle();
        await capture(type);
        writeFileSync(
          `${OUT}/${type}-snapshot.json`,
          JSON.stringify(await read(), null, 2),
        );
        check(type, "screenshots captured with panels closed", true, {
          url: page.url(),
          mode: "fresh UI-authored scratch",
        });
        continue;
      }
      const split = page.getByRole("separator", {
        name: "Resize the CSS / Canvas compare split",
        exact: true,
      });
      await split.press("End");
      const trigger = frame
        .locator(type === "Accordion" ? 'button[slot="trigger"]' : "button")
        .first();
      if (type === "Accordion") {
        const headers = frame.locator('button[slot="trigger"]');
        const before = await headers.evaluateAll((ns) =>
          ns.map((n) => n.getAttribute("aria-expanded")),
        );
        await trigger.press("Enter");
        await settle();
        const after = await headers.evaluateAll((ns) =>
          ns.map((n) => n.getAttribute("aria-expanded")),
        );
        check(type, "Enter toggles first disclosure", after[0] !== before[0], {
          before,
          after,
        });
        await trigger.press("Space");
        await settle();
        check(
          type,
          "Space restores expansion",
          (await trigger.getAttribute("aria-expanded")) === before[0],
          await read(),
        );
        await select(id);
        await panel()
          .getByRole("button", { name: "Allow Multiple Expanded", exact: true })
          .click();
        await settle();
        await headers.nth(1).press("Enter");
        await settle();
        const single = await headers.evaluateAll((ns) =>
          ns.map((n) => n.getAttribute("aria-expanded")),
        );
        check(
          type,
          "single expansion after property edit",
          single.filter((x) => x === "true").length === 1,
          single,
        );
      } else {
        await trigger.press(type === "Menu" ? "ArrowDown" : "Enter");
        const popup = frame
          .locator(
            type === "Dialog" ? ".react-aria-Modal" : ".react-aria-Popover",
          )
          .first();
        await popup.waitFor();
        await settle();
        const active = await popup.evaluate((n) => ({
          inside: n.contains(n.ownerDocument.activeElement),
          role: n.ownerDocument.activeElement.getAttribute("role"),
          text: n.ownerDocument.activeElement.textContent,
        }));
        check(type, "keyboard opens and moves focus", active.inside, active);
        if (type === "Menu") {
          const menu = frame.getByRole("menu");
          await menu.press("End");
          await settle();
          const last = await menu.evaluate((n) => ({
            active: n.ownerDocument.activeElement.textContent,
            last: [...n.querySelectorAll('[role^="menuitem"]')].at(-1)
              ?.textContent,
          }));
          check(type, "End focuses last item", last.active === last.last, last);
          await menu.press("Home");
          await settle();
          const first = await menu.evaluate((n) => ({
            active: n.ownerDocument.activeElement.textContent,
            first: n.querySelector('[role^="menuitem"]')?.textContent,
          }));
          check(
            type,
            "Home focuses first item",
            first.active === first.first,
            first,
          );
        }
        if (type === "Dialog") {
          await popup.press("Tab");
          await popup.press("Tab");
          check(
            type,
            "Tab remains in modal",
            await popup.evaluate((n) =>
              n.contains(n.ownerDocument.activeElement),
            ),
            null,
          );
        }
        await popup.press("Escape");
        await popup.waitFor({ state: "hidden" });
        await settle();
        check(
          type,
          "Escape restores trigger focus",
          await trigger.evaluate((n) => n === n.ownerDocument.activeElement),
          await read(),
        );
        await trigger.press("Enter");
        await popup.waitFor();
        if (type === "Dialog")
          await frame
            .getByRole("button", { name: "Close", exact: true })
            .click();
        else if (type === "Menu")
          await frame.locator('[role^="menuitem"]:focus').press("Enter");
        else
          await frame.locator("body").click({ position: { x: 1000, y: 700 } });
        await popup.waitFor({ state: "hidden" });
        await settle();
        check(
          type,
          "action or outside press closes",
          !(await popup.isVisible()),
          null,
        );
        await select(id);
        await panel()
          .getByRole("button", { name: "Open", exact: true })
          .click();
        await popup.waitFor();
        await settle();
        const authored = await read();
        check(
          type,
          "authored Open shows Canvas portal",
          authored.nodes.some(
            (n) => ["Modal", "Popover"].includes(n.type) && n.hidden !== true,
          ),
          authored.nodes.filter((n) => ["Modal", "Popover"].includes(n.type)),
        );
      }
      const geometry = await page.evaluate((type) => {
        const h = window.__COMPOSITION_CATALOG__,
          doc = document.querySelector("#previewFrame").contentDocument;
        const el = doc.querySelector(
          type === "Dialog"
            ? ".react-aria-Modal"
            : type === "Accordion"
              ? ".react-aria-Accordion"
              : ".react-aria-Popover",
        );
        const dom = el.getBoundingClientRect().toJSON(),
          canvas = h.canvas.boundsOf(el.dataset.catalogId);
        return {
          dom,
          canvas,
          delta: canvas
            ? Object.fromEntries(
                ["x", "y", "width", "height"].map((k) => [
                  k,
                  Math.abs(canvas[k] - dom[k]),
                ]),
              )
            : null,
        };
      }, type);
      check(
        type,
        "Canvas/Preview geometry",
        !!geometry.delta &&
          Object.values(geometry.delta).every((v) => v <= 1.1),
        geometry,
      );
      await capture(type);
      await page.waitForTimeout(1000);
      await page.reload();
      await page.waitForFunction(
        () => window.__COMPOSITION_CATALOG__?.workspace,
      );
      const compare = page.getByRole("button", {
        name: "Compare Mode (Preview + Skia)",
        exact: true,
      });
      if ((await compare.getAttribute("aria-pressed")) !== "true")
        await compare.click();
      await page.frameLocator("#previewFrame").locator("body").waitFor();
      await settle();
      const restored = await read();
      check(
        type,
        "save reload retains authored state",
        type === "Accordion"
          ? restored.nodes.some(
              (n) =>
                n.type === "Accordion" &&
                n.props.allowsMultipleExpanded === false,
            )
          : restored.nodes.some(
              (n) => ["Modal", "Popover"].includes(n.type) && n.hidden !== true,
            ),
        restored.nodes.filter((n) =>
          ["Accordion", "Modal", "Popover"].includes(n.type),
        ),
      );
    } catch (e) {
      check(type, "exercise", false, String(e));
      await page.screenshot({ path: `${OUT}/${type}-failure.png` });
    }
  }
  check("all", "browser errors", errors.length === 0, errors);
} finally {
  save();
  await browser.close();
}
if (results.some((r) => !r.pass)) process.exitCode = 1;
