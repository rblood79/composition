// ADR-254 Decision 5 live: a part whose text the template binds to its container's prop
// (`{label}` · `{title}` · `{description}`) is edited on the Canvas by double click, then the
// container's prop is written. The text on the Canvas (record) and in the Preview (Compare Mode)
// must follow the container's prop — one source. Undo must step the same way back.
// Phase 0 runs it on the build before the repair (the defect's reproduction).
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/adr254-text-binding-live.mjs <out-dir>
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
const errors = [];
const results = [];
const record = (id, pass, detail) => {
  results.push({ id, pass, detail });
  process.stdout.write(
    `${pass ? "PASS" : "FAIL"} ${id} — ${JSON.stringify(detail).slice(0, 1800)}\n`,
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
  await page.waitForTimeout(800);
  await page.keyboard.press("Escape");
}
const commands = `/@fs${REPO}/packages/shared/src/catalog/commands/index.ts`;

/**
 * The placed container of `type` and its part record whose binding is `binding` (the first one):
 * the record id, its text on the Canvas, its screen center, and the Preview element's text.
 */
const partOf = (type, binding, selector) =>
  page.evaluate(
    ([type, binding, selector]) => {
      const handle = window.__COMPOSITION_CATALOG__;
      const ws = handle.workspace;
      const g = ws.runtime.graph;
      const records = ws.root.canvasInputs;
      const typeOf = (r) => g.getDefinition(r.definitionId)?.name;
      const container = [...records.values()].find(
        (r) => typeOf(r) === type && r.sourceId.startsWith("project:node:"),
      );
      if (!container) return { missing: type };
      const find = (r) =>
        r.bindingId === binding
          ? r
          : r.children
              .map((id) => find(records.get(id)))
              .find((found) => found !== undefined);
      const part = find(container);
      const box = handle.canvas.boundsOf(part.id);
      const camera = handle.canvas.camera();
      const rect = document
        .querySelector('[data-catalog-canvas="true"]')
        .getBoundingClientRect();
      const doc = document.querySelector("#previewFrame")?.contentDocument;
      const element = doc?.querySelector(selector);
      return {
        containerNode: container.sourceId,
        part: part.id,
        canvasText: part.props.children,
        previewText: element?.textContent ?? null,
        point: box
          ? {
              x: rect.left + camera.x + (box.x + box.width / 2) * camera.zoom,
              y: rect.top + camera.y + (box.y + box.height / 2) * camera.zoom,
            }
          : null,
      };
    },
    [type, binding, selector],
  );
/** Double click the part on the Canvas, replace its text, commit with Escape. */
const editInline = async (point, text) => {
  // (Each double click enters one level of the instance — a Card's title is two levels in:
  // the text edit opens on the double click that reaches the part.)
  for (let tries = 0; tries < 4; tries++) {
    await page.mouse.dblclick(point.x, point.y);
    await page.waitForTimeout(300);
    if ((await page.getByTestId("catalog-text-editor").count()) > 0) break;
  }
  const editor = page.getByTestId("catalog-text-editor");
  const opened = (await editor.count()) > 0;
  if (opened) {
    await page.keyboard.press("ControlOrMeta+A");
    await page.keyboard.type(text);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(800);
  }
  return opened;
};
const writeProp = (node, key, value) =>
  page.evaluate(
    async ([path, node, key, value]) => {
      const ws = window.__COMPOSITION_CATALOG__.workspace;
      const { setFields } = await import(/* @vite-ignore */ path);
      ws.execute(
        setFields({
          targets: [{ kind: "node", id: node }],
          props: { [key]: { kind: "set", value } },
        }),
      );
    },
    [commands, node, key, value],
  );
const undo = () =>
  page.evaluate(() => window.__COMPOSITION_CATALOG__.workspace.undo());

await page.goto(`${BASE}/dashboard`);
await page
  .getByRole("button", { name: /new project/i })
  .first()
  .click();
await page.waitForTimeout(300);
await page.keyboard.type("ADR-254 text binding live");
await page.keyboard.press("Enter");
await page.waitForURL(/\/builder\//, { timeout: 30000 });
await page.waitForSelector(".app:not(.builder-booting)", { timeout: 30000 });
await page.waitForFunction(
  () => window.__COMPOSITION_CATALOG__?.workspace,
  null,
  { timeout: 30000 },
);
await page.waitForTimeout(1500);

const CASES = (
  process.env.CASES ??
  "text field:TextField:label:label,card:Card:heading:title"
)
  .split(",")
  .map((spec) => {
    const [palette, type, binding, prop] = spec.split(":");
    return { palette, type, binding, prop };
  });
const SELECTOR = {
  label: ".react-aria-TextField .react-aria-Label",
  heading: ".react-aria-Card .react-aria-Heading",
};

await step("setup", async () => {
  for (const { palette } of CASES) await addFromPalette(palette);
  await page
    .getByRole("button", { name: "Compare Mode (Preview + Skia)", exact: true })
    .first()
    .click();
  await page.waitForTimeout(3000);
  writeFileSync(`${OUT}/0-setup.png`, await page.screenshot());
  record("setup", true, {});
});
for (const { type, binding, prop } of CASES)
  await step(`${type}-${binding}`, async () => {
    const selector = SELECTOR[binding];
    const before = await partOf(type, binding, selector);
    const opened = await editInline(before.point, `Child ${prop}`);
    const afterInline = await partOf(type, binding, selector);
    await writeProp(before.containerNode, prop, `Parent ${prop}`);
    await page.waitForTimeout(1200);
    const afterParent = await partOf(type, binding, selector);
    writeFileSync(`${OUT}/${type}-after-parent.png`, await page.screenshot());
    await undo();
    await page.waitForTimeout(1200);
    const undoParent = await partOf(type, binding, selector);
    await undo();
    await page.waitForTimeout(1200);
    const undoInline = await partOf(type, binding, selector);
    const follows =
      afterParent.canvasText === `Parent ${prop}` &&
      afterParent.previewText === `Parent ${prop}`;
    record(`${type}-${binding}`, opened && follows, {
      opened,
      before: [before.canvasText, before.previewText],
      afterInline: [afterInline.canvasText, afterInline.previewText],
      afterParent: [afterParent.canvasText, afterParent.previewText],
      undoParent: [undoParent.canvasText, undoParent.previewText],
      undoInline: [undoInline.canvasText, undoInline.previewText],
    });
  });

writeFileSync(
  `${OUT}/results.json`,
  JSON.stringify({ results, errors }, null, 2),
);
process.stdout.write(`errors: ${errors.length}\n${errors.join("\n")}\n`);
await browser.close();
