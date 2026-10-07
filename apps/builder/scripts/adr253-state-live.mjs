// ADR-253 Round 3: shared origin states in the real Builder/Preview; RAC pointer dispatch and keyboard.
import { chromium } from "playwright";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const OUT = process.argv[2];
mkdirSync(OUT, { recursive: true });
const REPO = process.cwd();
const BASE = process.env.BUILDER_URL ?? "http://localhost:5173";
const AUTH =
  process.env.AUTH_SESSION ?? `${REPO}/apps/builder/scripts/.auth-session.json`;
const state = JSON.parse(readFileSync(AUTH, "utf8"));
state.origins = (state.origins ?? []).map((o) => ({ ...o, origin: BASE }));
const browser = await chromium.launch({ headless: false, channel: "chrome" });
const context = await browser.newContext({
  storageState: state,
  viewport: { width: 1600, height: 1000 },
  locale: "en-US",
});
const errors = [];
const results = [];
const record = (id, pass, detail) => {
  results.push({ id, pass, detail });
  process.stdout.write(
    `${pass ? "PASS" : "FAIL"} ${id} — ${JSON.stringify(detail).slice(0, 3000)}\n`,
  );
};
const page = await context.newPage();
page.on("pageerror", (e) =>
  errors.push(`pageerror: ${e.message.slice(0, 300)}`),
);
page.on("console", (m) => {
  if (m.type() === "error") errors.push(`console: ${m.text().slice(0, 300)}`);
});
const step = async (id, run) => {
  try {
    await run();
  } catch (error) {
    record(id, false, { threw: String(error?.message ?? error).slice(0, 800) });
    writeFileSync(`${OUT}/${id}-error.png`, await page.screenshot());
  }
};
async function addFromPalette(label) {
  const search = page.getByLabel("Search components");
  if (!(await search.isVisible().catch(() => false)))
    await page
      .getByRole("button", { name: "Components", exact: true })
      .first()
      .click();
  await search.fill(label);
  await page.waitForTimeout(300);
  await page
    .locator(".list-item", { hasText: new RegExp(`^${label}$`, "i") })
    .first()
    .click();
  await page.waitForTimeout(700);
}
const commands = `/@fs${REPO}/packages/shared/src/catalog/commands/index.ts`;
await page.goto(`${BASE}/dashboard`);
await page
  .getByRole("button", { name: /new project/i })
  .first()
  .click();
await page.waitForTimeout(300);
await page.keyboard.type("ADR-253 state repair live");
await page.keyboard.press("Enter");
await page.waitForURL(/\/builder\//, { timeout: 30000 });
await page.waitForSelector(".app:not(.builder-booting)", { timeout: 30000 });
await page.waitForFunction(
  () => window.__COMPOSITION_CATALOG__?.workspace,
  null,
  { timeout: 30000 },
);
await page.waitForTimeout(1500);

const FIELDS = [
  "text field",
  "text area",
  "number field",
  "search field",
  "color field",
  "combo box",
  "date field",
  "time field",
  "date picker",
  "button",
  "toggle button",
];
const write = (origin, scope, key, value, stateName) =>
  page.evaluate(
    async ([path, origin, scope, key, value, stateName]) => {
      const ws = window.__COMPOSITION_CATALOG__.workspace;
      const { setLibraryDefault } = await import(/* @vite-ignore */ path);
      ws.execute(
        setLibraryDefault({
          definitionId: `lib:definition:origin-component-${origin}`,
          scope,
          key,
          ...(stateName ? { state: stateName } : {}),
          write: { kind: "set", value },
          newId: ws.newId,
        }),
      );
    },
    [commands, origin, scope, key, value, stateName],
  );
const shot = async (selector, action) =>
  page.evaluate(
    async ([selector, action]) => {
      const ws = window.__COMPOSITION_CATALOG__.workspace;
      const doc = document.querySelector("#previewFrame").contentDocument;
      const view = doc.defaultView;
      const out = [];
      for (const element of doc.querySelectorAll(selector)) {
        const target = element.querySelector('[role="spinbutton"]') ?? element;
        if (action === "focus") target.focus();
        const entering = action === "hover";
        if (action === "hover" || action === "leave") {
          element.dispatchEvent(
            new view.PointerEvent(entering ? "pointerover" : "pointerout", {
              bubbles: true,
              pointerType: "mouse",
            }),
          );
          element.dispatchEvent(
            new view.PointerEvent(entering ? "pointerenter" : "pointerleave", {
              bubbles: true,
              pointerType: "mouse",
            }),
          );
          element.dispatchEvent(
            new view.MouseEvent(entering ? "mouseover" : "mouseout", {
              bubbles: true,
            }),
          );
        }
        await new Promise((r) => setTimeout(r, 350));
        const record = ws.root.canvasInputs.get(
          element.getAttribute("data-catalog-id"),
        );
        const style = view.getComputedStyle(element);
        out.push({
          id: element.getAttribute("data-catalog-id"),
          tag: element.tagName,
          hovered: element.hasAttribute("data-hovered"),
          disabled: element.hasAttribute("data-disabled"),
          selected: element.hasAttribute("data-selected"),
          bg: style.backgroundColor,
          color: style.color,
          radius: style.borderTopLeftRadius,
          stateVisual: record?.stateVisual,
        });
      }
      return out;
    },
    [selector, action],
  );
const INPUTS =
  "input[data-catalog-id]:not([type=hidden]), textarea[data-catalog-id], .react-aria-DateInput[data-catalog-id]";
await step("place", async () => {
  for (const label of FIELDS) {
    await addFromPalette(label);
    await page.evaluate(() =>
      window.__COMPOSITION_CATALOG__.workspace.selectItems([]),
    );
  }
  await page
    .getByRole("button", { name: "Compare Mode (Preview + Skia)", exact: true })
    .first()
    .click();
  await page.waitForTimeout(1800);
  const values = await shot(INPUTS, "leave");
  record("place", values.length === 9, values);
});
await step("input-state", async () => {
  for (const origin of ["input", "dateinput"]) {
    await write(origin, "stateRules", "backgroundColor", "#123456", "hover");
    await write(origin, "stateRules", "radius", 11, "hover");
  }
  await page.waitForTimeout(500);
  const hovered = await shot(INPUTS, "hover");
  const released = await shot(INPUTS, "leave");
  record(
    "input-state",
    hovered.length === 9 &&
      hovered.every(
        (s) =>
          s.hovered &&
          s.bg === "rgb(18, 52, 86)" &&
          s.radius === "11px" &&
          s.stateVisual?.hover.backgroundColor === "#123456",
      ) &&
      released.every((s) => !s.hovered && s.bg !== "rgb(18, 52, 86)"),
    { hovered, released },
  );
});
await step("state-edit-undo", async () => {
  await write("input", "stateRules", "backgroundColor", "#abcdef", "hover");
  await page.waitForTimeout(400);
  const selector =
    "input[data-catalog-id]:not([type=hidden]), textarea[data-catalog-id]";
  const edited = await shot(selector, "hover");
  await page.evaluate(() => window.__COMPOSITION_CATALOG__.workspace.undo());
  await page.waitForTimeout(400);
  const undone = await shot(selector, "hover");
  record(
    "state-edit-undo",
    edited.every((s) => s.bg === "rgb(171, 205, 239)") &&
      undone.every((s) => s.bg === "rgb(18, 52, 86)"),
    { edited, undone },
  );
  await shot(selector, "leave");
});
await step("equal-rest-hover", async () => {
  await write("button", "visual", "backgroundColor", "#123456");
  await write("button", "stateRules", "backgroundColor", "#123456", "hover");
  await page.waitForTimeout(500);
  const selector =
    "button.react-aria-Button[data-catalog-id]:not([data-disabled])";
  const rest = await shot(selector, "leave");
  const hovered = await shot(selector, "hover");
  record(
    "equal-rest-hover",
    hovered.length > 0 &&
      hovered.every((s) => s.hovered && s.bg === "rgb(18, 52, 86)") &&
      rest.every((s) => s.bg === "rgb(18, 52, 86)"),
    { rest, hovered },
  );
  await shot(selector, "leave");
});
await step("selected-state", async () => {
  await write(
    "togglebutton",
    "stateRules",
    "backgroundColor",
    "#aabbcc",
    "selected",
  );
  await write(
    "togglebutton",
    "stateRules",
    "backgroundColor",
    "#112233",
    "selectedHover",
  );
  const toggle = page
    .frameLocator("#previewFrame")
    .locator(".react-aria-ToggleButton")
    .first();
  if ((await toggle.getAttribute("data-selected")) === null)
    await toggle.press("Space");
  await page.waitForTimeout(300);
  const rest = await shot(".react-aria-ToggleButton", "leave");
  const hovered = await shot(".react-aria-ToggleButton", "hover");
  record(
    "selected-state",
    rest.every((s) => s.selected && s.bg === "rgb(170, 187, 204)") &&
      hovered.every(
        (s) => s.selected && s.hovered && s.bg === "rgb(17, 34, 51)",
      ),
    { rest, hovered },
  );
});
await step("disabled-state", async () => {
  await write("input", "stateRules", "backgroundColor", "#445566", "disabled");
  await page.evaluate(async (path) => {
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    const { setFields } = await import(/* @vite-ignore */ path);
    const field = [...ws.root.canvasInputs.values()].find(
      (r) => r.bindingId === "textfield" && r.sourceId.startsWith("project:"),
    );
    ws.execute(
      setFields({
        targets: [{ kind: "node", id: field.sourceId }],
        props: { isDisabled: { kind: "set", value: true } },
      }),
    );
  }, commands);
  await page.waitForTimeout(400);
  const disabled = await shot(
    ".react-aria-TextField input[data-catalog-id]",
    "hover",
  );
  record(
    "disabled-state",
    disabled.length > 0 &&
      disabled.every((s) => s.disabled && s.bg === "rgb(68, 85, 102)"),
    disabled,
  );
});
writeFileSync(`${OUT}/state.png`, await page.screenshot());
record("errors", errors.length === 0, errors);
writeFileSync(
  `${OUT}/results.json`,
  JSON.stringify({ base: BASE, results, errors }, null, 2),
);
await browser.close();
process.exit(results.every((r) => r.pass) ? 0 : 1);
