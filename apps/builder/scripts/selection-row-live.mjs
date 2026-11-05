import { chromium } from "playwright";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const OUT = process.argv[2];
mkdirSync(OUT, { recursive: true });
const REPO = process.cwd();
const BASE = process.env.BUILDER_URL ?? "http://localhost:5173";
const state = JSON.parse(
  readFileSync(`${REPO}/apps/builder/scripts/.auth-session.json`, "utf8"),
);
state.origins = (state.origins ?? []).map((o) => ({ ...o, origin: BASE }));
const browser = await chromium.launch({ headless: false, channel: "chrome" });
const context = await browser.newContext({
  storageState: state,
  viewport: { width: 1600, height: 1000 },
});
const page = await context.newPage();
const errors = [];
const results = [];
const record = (id, pass, detail) => {
  results.push({ id, pass, detail });
  process.stdout.write(
    `${pass ? "PASS" : "FAIL"} ${id} — ${JSON.stringify(detail).slice(0, 1500)}\n`,
  );
};
page.on("pageerror", (e) =>
  errors.push(`pageerror: ${e.message.slice(0, 300)}`),
);
page.on("console", (m) => {
  if (m.type() === "error") errors.push(`console: ${m.text().slice(0, 300)}`);
});
async function addFromPalette(label, match = new RegExp(`^${label}$`, "i")) {
  const search = page.getByLabel("Search components");
  if (!(await search.isVisible().catch(() => false)))
    await page
      .getByRole("button", { name: "Components", exact: true })
      .first()
      .click();
  await search.fill(label);
  await page.waitForTimeout(300);
  await page.locator(".list-item", { hasText: match }).first().click();
  await page.waitForTimeout(800);
  await page.keyboard.press("Escape");
  // (Close the Components panel: it covers the Preview half in Compare Mode.)
  await page
    .getByRole("button", { name: "Components", exact: true })
    .first()
    .click()
    .catch(() => {});
  await page.waitForTimeout(300);
}
async function compareOn() {
  const button = page
    .getByRole("button", { name: "Compare Mode (Preview + Skia)", exact: true })
    .first();
  if (
    !(await page.locator("#previewFrame").count()) &&
    (await button.isVisible().catch(() => false))
  )
    await button.click();
  await page.waitForSelector("#previewFrame", { timeout: 15000 });
  await page.waitForFunction(
    () =>
      !!document
        .querySelector("#previewFrame")
        ?.contentDocument?.querySelector("[data-catalog-id]"),
    null,
    { timeout: 15000 },
  );
  await page.waitForTimeout(1500);
}

const commands = `/@fs${REPO}/packages/shared/src/catalog/commands/index.ts`;
async function newProject(name) {
  await page.goto(`${BASE}/dashboard`);
  await page
    .getByRole("button", { name: /new project/i })
    .first()
    .click();
  await page.waitForTimeout(300);
  await page.keyboard.type(name);
  await page.keyboard.press("Enter");
  await page.waitForURL(/\/builder\//, { timeout: 30000 });
  await page.waitForSelector(".app:not(.builder-booting)", { timeout: 30000 });
  await page.waitForFunction(
    () => window.__COMPOSITION_CATALOG__?.workspace,
    null,
    { timeout: 30000 },
  );
}
/** Run a catalog command in the page: `build(c, ws, find, arg)` returns the command. */
async function run(build, arg) {
  return page.evaluate(
    async ({ commands, build, arg }) => {
      const c = await import(commands);
      const ws = window.__COMPOSITION_CATALOG__.workspace;
      // `find(type, within)` — the first record of `type` (inside the first `within` record).
      const find = (type, within) => {
        const all = [...ws.root.canvasInputs.values()];
        const scope = within
          ? all.find((r) => ws.root.typeOf(r) === within)
          : undefined;
        const inScope = (r) => {
          if (!scope) return true;
          for (let c = r; c; c = ws.root.canvasInputs.get(c.parentId))
            if (c.id === scope.id) return true;
          return false;
        };
        return all.find((r) => ws.root.typeOf(r) === type && inScope(r));
      };
      try {
        ws.execute(
          new Function(
            "c",
            "ws",
            "find",
            "arg",
            `return (${build})(c, ws, find, arg);`,
          )(c, ws, find, arg),
        );
        await new Promise((r) => setTimeout(r, 500));
        return { ok: true };
      } catch (error) {
        return { ok: false, code: error?.code ?? String(error) };
      }
    },
    { commands, build: build.toString(), arg },
  );
}
const preview = (fn, arg) =>
  page.evaluate(
    ({ fn, arg }) => {
      const doc = document.querySelector("#previewFrame")?.contentDocument;
      return new Function("doc", "arg", `return (${fn})(doc, arg);`)(doc, arg);
    },
    { fn: fn.toString(), arg },
  );
const press = async (selector) => {
  await page
    .frameLocator("#previewFrame")
    .locator(selector)
    .first()
    // (Compare Mode shrinks the Preview under the Builder header — RAC's virtual press.)
    .dispatchEvent("click");
  await page.waitForTimeout(800);
};
const closeOverlay = async () => {
  await page.frameLocator("#previewFrame").locator("body").press("Escape");
  await page.waitForTimeout(500);
};

try {
  for (const [type, mode] of [
    ["Select", "single"],
    ["Select", "multiple"],
    ["ComboBox", "single"],
    ["Menu", "single"],
    ["Menu", "multiple"],
  ]) {
    if (process.argv[3] && process.argv[3] !== type) continue;
    await newProject(`selection-row-${type}-${mode}-${Date.now()}`);
    await addFromPalette(
      type === "ComboBox" ? "combo" : type,
      type === "ComboBox" ? /combo/i : new RegExp(`^${type}$`, "i"),
    );
    const setup = await run(
      (c, ws, find, arg) => {
        const owner = find(arg.type);
        const trigger = arg.type === "Menu" ? find("MenuTrigger") : owner;
        const item = find(arg.type === "Menu" ? "MenuItem" : "ListBoxItem");
        const label = item.children
          .map((id) => ws.root.canvasInputs.get(id))
          .find((n) => n?.props.slot === "label");
        const target = ws.itemOfRecord(label.id).target;
        const desc = {
          ...target,
          address: {
            ...target.address,
            templatePath: target.address.templatePath.map((id) =>
              id.replace(/__label$/, "__description"),
            ),
          },
        };
        return () =>
          c.composeCommands(ws.runtime.graph, "Selection row fixture", [
            c.setFields({
              targets: [ws.itemOfRecord(trigger.id).target],
              props: { isOpen: { kind: "set", value: true } },
            }),
            ...(arg.type === "ComboBox"
              ? []
              : [
                  c.setFields({
                    targets: [ws.itemOfRecord(owner.id).target],
                    props: { selectionMode: { kind: "set", value: arg.mode } },
                  }),
                ]),
            c.setWholeField({ targets: [desc], field: "enabled", value: true }),
            c.setFields({
              targets: [desc],
              props: {
                children: { kind: "set", value: "Description on the next row" },
              },
            }),
          ]);
      },
      { type, mode },
    );
    record(`${type}-${mode}-setup`, setup.ok, setup);
    await compareOn();
    await page.waitForTimeout(1200);
    const rows = await preview((doc) =>
      [
        ...doc.querySelectorAll(
          '[role="option"], [role="menuitemradio"], [role="menuitemcheckbox"]',
        ),
      ].map((row) => {
        const mark = row.querySelector('[slot="selection"]');
        const label = row.querySelector('[slot="label"]');
        const rect = (el) =>
          el
            ? {
                x: el.getBoundingClientRect().x,
                y: el.getBoundingClientRect().y,
                w: el.getBoundingClientRect().width,
                h: el.getBoundingClientRect().height,
              }
            : null;
        return {
          text: row.textContent,
          row: rect(row),
          mark: rect(mark),
          label: rect(label),
          visibility: mark && getComputedStyle(mark).visibility,
          position: mark && getComputedStyle(mark).position,
        };
      }),
    );
    record(
      `${type}-${mode}-parts`,
      rows.length > 0 && rows.every((row) => row.mark && row.label),
      rows,
    );
    const canvas = await page.evaluate(() => {
      const root = window.__COMPOSITION_CATALOG__.workspace.root;
      const item = [...root.canvasInputs.values()].find((n) =>
        ["MenuItem", "ListBoxItem"].includes(root.typeOf(n)),
      );
      const parts = item.children.map((id) => root.canvasInputs.get(id));
      const label = parts.find((n) => n.props.slot === "label");
      const mark = parts.find(
        (n) =>
          n.props.slot === "selection" &&
          root.getGeometry([n.id]).get(n.id)?.width > 0,
      );
      const boxes = root.getGeometry([label.id, mark.id]);
      return { label: boxes.get(label.id), mark: boxes.get(mark.id) };
    });
    record(
      `${type}-${mode}-canvas-row`,
      Math.abs(
        canvas.label.y +
          canvas.label.height / 2 -
          canvas.mark.y -
          canvas.mark.height / 2,
      ) < 0.1 &&
        Math.abs(
          canvas.label.x - canvas.mark.x - (rows[0].label.x - rows[0].mark.x),
        ) < 0.1 &&
        Math.abs(canvas.mark.x - (rows[0].mark.x - rows[0].row.x)) < 0.1 &&
        Math.abs(canvas.label.x - (rows[0].label.x - rows[0].row.x)) < 0.1,
      canvas,
    );
    const before = rows[0];
    const frame = page.frameLocator("#previewFrame");
    const option = frame
      .locator(
        '[role="option"], [role="menuitemradio"], [role="menuitemcheckbox"]',
      )
      .first();
    if (await option.count()) {
      await option.dispatchEvent("click");
      await page.waitForTimeout(500);
      // Reopen after a committed single selection via its real trigger.
      if (mode === "single" && (await option.count()) === 0) {
        await frame
          .locator(
            type === "Menu"
              ? "button.react-aria-ActionButton"
              : '[aria-haspopup="listbox"]',
          )
          .first()
          .dispatchEvent("click");
        await page.waitForTimeout(500);
      }
      const selected = await preview((doc) => {
        const row = doc.querySelector(
          '[aria-selected="true"], [role="menuitemradio"][aria-checked="true"], [role="menuitemcheckbox"][aria-checked="true"]',
        );
        const mark = row?.querySelector('[slot="selection"]');
        const label = row?.querySelector('[slot="label"]');
        return {
          selected: !!row,
          visibility: mark && getComputedStyle(mark).visibility,
          x: label?.getBoundingClientRect().x,
        };
      });
      record(
        `${type}-${mode}-select`,
        selected.selected &&
          selected.visibility === "visible" &&
          selected.x === before?.label?.x,
        selected,
      );
    }
    const authored = await run(
      (c, ws, find, arg) => {
        const item = find(arg.type === "Menu" ? "MenuItem" : "ListBoxItem");
        const commands = [
          c.setFields({
            targets: [ws.itemOfRecord(item.id).target],
            props: { isSelected: { kind: "set", value: true } },
          }),
        ];
        return () =>
          c.composeCommands(
            ws.runtime.graph,
            "Persist selection fixture",
            commands,
          );
      },
      { type },
    );
    record(`${type}-${mode}-authored`, authored.ok, authored);
    const splitter = page.locator(".workspace-compare-splitter");
    await splitter.press("Home");
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${OUT}/${type}-${mode}-canvas.png` });
    await splitter.press("End");
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${OUT}/${type}-${mode}-dom.png` });
    await page.waitForTimeout(1000);
    await page.reload();
    await page.waitForFunction(
      () => !!window.__COMPOSITION_CATALOG__?.workspace,
    );
    await compareOn();
    const restored = await preview((doc) => ({
      description: doc.body.textContent.includes("Description on the next row"),
      selected: !!doc.querySelector(
        '[aria-selected="true"], [role="menuitemradio"][aria-checked="true"], [role="menuitemcheckbox"][aria-checked="true"]',
      ),
    }));
    record(
      `${type}-${mode}-reload`,
      restored.description && restored.selected,
      restored,
    );
  }
} catch (error) {
  record("live-error", false, String(error));
} finally {
  writeFileSync(
    `${OUT}/results.json`,
    JSON.stringify({ results, errors }, null, 2),
  );
  await browser.close();
}

process.exitCode = results.every((result) => result.pass) ? 0 : 1;
