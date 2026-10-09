// Property wiring live (사용자 2026-10-09 「1번 결함 수리」) — real Builder (headed Chrome, Compare
// Mode): properties the Design panel edits now reach the Preview — a ButtonGroup's Disabled (Design
// panel switch) disables its Buttons on the Canvas and in the Preview; FileTrigger Accepted File
// Types sets the file input's `accept`; GridList Selection Style reaches the list (highlight =
// RAC `selectionBehavior` replace: no checkbox); an InlineAlert is `role="alert"` · no errors.
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/property-wiring-live.mjs <out>
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
async function addFromPalette(label) {
  const search = page.getByLabel("Search components");
  if (!(await search.isVisible().catch(() => false)))
    await page
      .getByRole("button", { name: "Components", exact: true })
      .first()
      .click();
  await search.fill(label instanceof RegExp ? "chart" : label);
  await page.waitForTimeout(300);
  await page
    .locator(".list-item", {
      hasText: label instanceof RegExp ? label : new RegExp(`^${label}$`, "i"),
    })
    .first()
    .click();
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
  if (await button.isVisible().catch(() => false)) await button.click();
  await page.waitForTimeout(3000);
}
const commands = `/@fs${REPO}/packages/shared/src/catalog/commands/index.ts`;
const exec = (build, arg) =>
  page.evaluate(
    async ({ commands, build, arg }) => {
      const c = await import(commands);
      const ws = window.__COMPOSITION_CATALOG__.workspace;
      try {
        ws.execute(
          new Function("c", "ws", "arg", `return (${build})(c, ws, arg);`)(
            c,
            ws,
            arg,
          ),
        );
        await new Promise((r) => setTimeout(r, 800));
        return { ok: true };
      } catch (error) {
        return { ok: false, code: error?.code ?? String(error) };
      }
    },
    { commands, build: build.toString(), arg },
  );

await page.goto(`${BASE}/dashboard`);
await page.getByRole("button", { name: /new project/i });

await page.goto(`${BASE}/dashboard`);
await page
  .getByRole("button", { name: /new project/i })
  .first()
  .click();
await page.waitForTimeout(300);
await page.keyboard.type("Property wiring");
await page.keyboard.press("Enter");
await page.waitForURL(/\/builder\//, { timeout: 30000 });
await page.waitForSelector(".app:not(.builder-booting)", { timeout: 30000 });
await page.waitForFunction(
  () => window.__COMPOSITION_CATALOG__?.workspace,
  null,
  { timeout: 30000 },
);
await page.waitForTimeout(1500);
const selectType = (type) =>
  page.evaluate((type) => {
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    const r = [...ws.root.canvasInputs.values()].find(
      (x) => ws.root.typeOf(x) === type,
    );
    ws.session.select([
      { identity: r.id, target: ws.positionOfRecord(r.id).target },
    ]);
  }, type);
const setProps = (type, props) =>
  exec(
    (c, ws, arg) => {
      const r = [...ws.root.canvasInputs.values()].find(
        (x) => ws.root.typeOf(x) === arg.type,
      );
      return c.setFields({
        targets: [ws.positionOfRecord(r.id).target],
        props: Object.fromEntries(
          Object.entries(arg.props).map(([k, v]) => [k, { kind: "set", value: v }]),
        ),
      });
    },
    { type, props },
  );
const preview = (fn, arg) =>
  page.evaluate(
    ({ fn, arg }) =>
      new Function(
        "doc",
        "arg",
        `return (${fn})(doc, arg);`,
      )(document.querySelector("#previewFrame").contentDocument, arg),
    { fn: fn.toString(), arg },
  );
const groupButtons = () =>
  page.evaluate(async (repo) => {
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    const root = ws.root;
    const { catalogStateValue } = await import(
      `/@fs${repo}/packages/shared/src/catalog/runtime/presence.ts`
    );
    const doc = document.querySelector("#previewFrame").contentDocument;
    const group = [...root.canvasInputs.values()].find(
      (r) => root.typeOf(r) === "ButtonGroup",
    );
    const buttons = [...root.canvasInputs.values()].filter(
      (r) => root.typeOf(r) === "Button" && r.parentId === group.id,
    );
    return buttons.map((b) => ({
      canvas: catalogStateValue(
        b,
        "isDisabled",
        (id) => root.canvasInputs.get(id),
        (r) => root.typeOf(r),
      ),
      preview: !!doc
        .querySelector(`[data-catalog-id="${b.id}"]`)
        ?.closest("button")
        ?.hasAttribute("disabled"),
    }));
  }, REPO);

await addFromPalette("button group");
await compareOn();
await page.waitForTimeout(800);
const enabled = await groupButtons();
await selectType("ButtonGroup");
await page.waitForTimeout(800);
const disabledSwitch = page
  .getByRole("switch", { name: "Disabled", exact: true })
  .or(page.getByRole("checkbox", { name: "Disabled", exact: true }))
  .or(page.getByRole("button", { name: "Disabled", exact: true }))
  .first();
if (!(await disabledSwitch.isVisible().catch(() => false))) {
  await page
    .getByRole("button", { name: /^Design/ })
    .first()
    .click()
    .catch(() => {});
  await page.waitForTimeout(1000);
}
const offered = await disabledSwitch.isVisible().catch(() => false);
if (offered) await disabledSwitch.click();
await page.waitForTimeout(1200);
const disabled = await groupButtons();
record(
  "ButtonGroup: Design panel Disabled disables every Button (Canvas · Preview)",
  offered &&
    enabled.length > 0 &&
    enabled.every((b) => !b.canvas && !b.preview) &&
    disabled.every((b) => b.canvas && b.preview),
  { offered, enabled, disabled },
);
await page.screenshot({ path: `${OUT}/buttongroup-disabled.png` });

await page.evaluate(() =>
  window.__COMPOSITION_CATALOG__.workspace.session.clearSelection(),
);
await addFromPalette("file trigger");
await setProps("FileTrigger", { acceptedFileTypes: "image/png, .pdf" });
const accept = await preview((doc) =>
  doc.querySelector('input[type="file"]')?.getAttribute("accept"),
);
record("FileTrigger: Accepted File Types → the file input's accept", accept === "image/png,.pdf", { accept });

await page.evaluate(() =>
  window.__COMPOSITION_CATALOG__.workspace.session.clearSelection(),
);
await addFromPalette("grid list");
// (RSP selectionStyle → RAC selectionBehavior: checkbox = toggle — a press adds to the selection;
// highlight = replace — a press replaces it.)
const pressTwo = async () => {
  const rows = page.frameLocator("#previewFrame").locator('.react-aria-GridList [role="row"]');
  await rows.nth(0).click();
  await page.waitForTimeout(300);
  await rows.nth(1).click();
  await page.waitForTimeout(500);
  return preview((doc) =>
    doc.querySelectorAll('.react-aria-GridList [role="row"][aria-selected="true"]').length,
  );
};
await setProps("GridList", { selectionMode: "multiple", selectionStyle: "checkbox" });
await page.waitForTimeout(800);
const toggle = await pressTwo();
await setProps("GridList", { selectionStyle: "highlight" });
await page.waitForTimeout(800);
const replace = await pressTwo();
record(
  "GridList: Selection Style reaches RAC (checkbox: two presses select 2 · highlight: 1)",
  toggle === 2 && replace === 1,
  { toggle, replace },
);

await page.evaluate(() =>
  window.__COMPOSITION_CATALOG__.workspace.session.clearSelection(),
);
await addFromPalette("inline alert");
const alert = await preview((doc) => {
  const el = doc.querySelector(".react-aria-InlineAlert");
  return el && { role: el.getAttribute("role"), live: el.getAttribute("aria-live") };
});
record("InlineAlert: role=alert · aria-live=polite in the Preview", alert?.role === "alert" && alert?.live === "polite", alert);
await page.screenshot({ path: `${OUT}/property-wiring.png` });
record("no errors", errors.length === 0, { errors: errors.slice(0, 6) });
writeFileSync(
  `${OUT}/results.json`,
  JSON.stringify({ results, errors, url: page.url() }, null, 2),
);
await browser.close();
