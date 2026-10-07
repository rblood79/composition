// Live: the Canvas's inline text field is as tall as the text's box — one line for a one-line
// text (a textarea's default two rows made it twice that) — and grows with the typed lines. The
// real Builder, headed Chrome, saved auth session.
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/text-editor-height-live.mjs <out-dir>
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
    `${pass ? "PASS" : "FAIL"} ${id} — ${JSON.stringify(detail).slice(0, 1500)}\n`,
  );
};
const page = await context.newPage();
page.on("pageerror", (e) =>
  errors.push(`pageerror: ${e.message.slice(0, 300)}`),
);
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
/** The first placed record of `binding` under a placed `type`: its screen box. */
const boxOf = (type, binding) =>
  page.evaluate(
    ([type, binding]) => {
      const handle = window.__COMPOSITION_CATALOG__;
      const ws = handle.workspace;
      const g = ws.runtime.graph;
      const records = ws.root.canvasInputs;
      const typeOf = (r) => g.getDefinition(r.definitionId)?.name;
      const root = [...records.values()].find(
        (r) => typeOf(r) === type && r.sourceId.startsWith("project:node:"),
      );
      const find = (r) =>
        r.bindingId === binding
          ? r
          : r.children
              .map((id) => find(records.get(id)))
              .find((found) => found !== undefined);
      const part = root && find(root);
      const box = part && handle.canvas.boundsOf(part.id);
      const camera = handle.canvas.camera();
      const rect = document
        .querySelector('[data-catalog-canvas="true"]')
        .getBoundingClientRect();
      return box
        ? {
            x: rect.left + camera.x + box.x * camera.zoom,
            y: rect.top + camera.y + box.y * camera.zoom,
            width: box.width * camera.zoom,
            height: box.height * camera.zoom,
          }
        : null;
    },
    [type, binding],
  );
const fieldBox = () =>
  page
    .getByTestId("catalog-text-editor")
    .evaluate((el) => {
      const r = el.getBoundingClientRect();
      return {
        x: r.left,
        y: r.top,
        width: r.width,
        height: r.height,
        lineHeight: getComputedStyle(el).lineHeight,
      };
    });
const near = (a, b) => Math.abs(a - b) <= 1;

await page.goto(`${BASE}/dashboard`);
await page
  .getByRole("button", { name: /new project/i })
  .first()
  .click();
await page.waitForTimeout(300);
await page.keyboard.type("Text editor height live");
await page.keyboard.press("Enter");
await page.waitForURL(/\/builder\//, { timeout: 30000 });
await page.waitForSelector(".app:not(.builder-booting)", { timeout: 30000 });
await page.waitForFunction(
  () => window.__COMPOSITION_CATALOG__?.workspace,
  null,
  { timeout: 30000 },
);
await page.waitForTimeout(1500);

for (const [palette, type, binding] of [
  ["text", "Text", "text"],
  ["card", "Card", "heading"],
]) {
  await step(type, async () => {
    await addFromPalette(palette);
    await page.waitForTimeout(800);
    const box = await boxOf(type, binding);
    // (Each double click enters one level; the editor opens on the one that reaches the text.)
    for (let tries = 0; tries < 4; tries++) {
      await page.mouse.dblclick(
        box.x + box.width / 2,
        box.y + box.height / 2,
      );
      await page.waitForTimeout(300);
      if ((await page.getByTestId("catalog-text-editor").count()) > 0) break;
    }
    const opened = await fieldBox();
    writeFileSync(`${OUT}/${type}-open.png`, await page.screenshot());
    await page.keyboard.press("End");
    await page.keyboard.press("Enter");
    await page.keyboard.type("second line");
    await page.waitForTimeout(200);
    const grown = await fieldBox();
    writeFileSync(`${OUT}/${type}-grown.png`, await page.screenshot());
    await page.keyboard.press("Escape");
    await page.waitForTimeout(600);
    record(
      type,
      near(opened.height, box.height) &&
        near(opened.y, box.y) &&
        grown.height > opened.height * 1.8,
      { box, opened, grown },
    );
    await page.keyboard.press("ControlOrMeta+z");
    await page.waitForTimeout(400);
  });
}

writeFileSync(
  `${OUT}/results.json`,
  JSON.stringify({ results, errors }, null, 2),
);
process.stdout.write(`errors: ${errors.length}\n${errors.join("\n")}\n`);
await browser.close();
