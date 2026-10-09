// size S2 names live (사용자 2026-10-09 「size 는 S2기준에 XS추가해서 XS/S/M/L/XL 로 맞춰 진행해」 ·
// 「표기만 변경」) — real Builder (headed Chrome, Compare Mode): a new Button's size is `M`; the Design
// panel's Size field offers XS · S · M · L · XL and picking L writes `L`; the Preview element carries
// `data-size="L"` and the generated CSS sizes it (height 42) as the Canvas does; a TextField at XL
// and a Text at XXL the same; no errors.
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/size-s2-names-live.mjs <out>
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
  await search.fill(label);
  await page.waitForTimeout(300);
  await page
    .locator(".list-item", { hasText: new RegExp(`^${label}$`, "i") })
    .first()
    .click();
  await page.waitForTimeout(800);
  await page.keyboard.press("Escape");
  await page
    .getByRole("button", { name: "Components", exact: true })
    .first()
    .click()
    .catch(() => {});
  await page.waitForTimeout(300);
}
const commands = `/@fs${REPO}/packages/shared/src/catalog/commands/index.ts`;
const setProps = (type, props) =>
  page.evaluate(
    async ({ commands, type, props }) => {
      const c = await import(commands);
      const ws = window.__COMPOSITION_CATALOG__.workspace;
      const root = ws.root;
      const node = [...root.canvasInputs.values()].find(
        (r) => root.typeOf(r) === type,
      );
      ws.execute(
        c.setFields({
          targets: [ws.positionOfRecord(node.id).target],
          props: Object.fromEntries(
            Object.entries(props).map(([k, v]) => [
              k,
              { kind: "set", value: v },
            ]),
          ),
        }),
      );
      await new Promise((r) => setTimeout(r, 900));
    },
    { commands, type, props },
  );
const read = (type) =>
  page.evaluate((type) => {
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    const root = ws.root;
    const node = [...root.canvasInputs.values()].find(
      (r) => root.typeOf(r) === type,
    );
    const geo = root.getGeometry([node.id]).get(node.id);
    const doc = document.querySelector("#previewFrame").contentDocument;
    const el = doc.querySelector(`[data-catalog-id="${node.id}"]`);
    const style = el ? doc.defaultView.getComputedStyle(el) : null;
    return {
      size: node.props.size,
      dataSize: el?.getAttribute("data-size") ?? null,
      canvas: geo ? { width: geo.width, height: geo.height } : null,
      preview: el
        ? {
            width: el.getBoundingClientRect().width,
            height: el.getBoundingClientRect().height,
            fontSize: style.fontSize,
          }
        : null,
    };
  }, type);
const sizeField = () =>
  page
    .locator(".panel-wrapper[data-panel='properties'] fieldset", {
      has: page.locator("legend", { hasText: /^Size$/ }),
    })
    .first();

await page.goto(`${BASE}/dashboard`);
await page
  .getByRole("button", { name: /new project/i })
  .first()
  .click();
await page.waitForTimeout(300);
await page.keyboard.type("Size S2 names");
await page.keyboard.press("Enter");
await page.waitForURL(/\/builder\//, { timeout: 30000 });
await page.waitForSelector(".app:not(.builder-booting)", { timeout: 30000 });
await page.waitForFunction(
  () => window.__COMPOSITION_CATALOG__?.workspace,
  null,
  { timeout: 30000 },
);
await page.waitForTimeout(1500);
const compare = page
  .getByRole("button", { name: "Compare Mode (Preview + Skia)", exact: true })
  .first();
if (await compare.isVisible().catch(() => false)) await compare.click();
await page.waitForTimeout(1500);

await addFromPalette("button");
await page.waitForTimeout(1500);
const fresh = await read("Button");
record(
  "new Button: size M · Preview data-size M",
  fresh.size === "M" && fresh.dataSize === "M",
  fresh,
);

// The Design panel's Size field, with the Button selected.
await page.evaluate(() => {
  const ws = window.__COMPOSITION_CATALOG__.workspace;
  const root = ws.root;
  const node = [...root.canvasInputs.values()].find(
    (r) => root.typeOf(r) === "Button",
  );
  ws.selectRecords([node.id]);
});
await page.waitForTimeout(1200);
await page.getByRole("button", { name: "Design", exact: true }).first().click();
await page.waitForTimeout(1200);
const field = sizeField();
const options = (
  await field.locator("[role='radio'], button").allInnerTexts()
).map((t) => t.trim());
record(
  "Design Size field offers XS · S · M · L · XL",
  JSON.stringify(options) === JSON.stringify(["XS", "S", "M", "L", "XL"]),
  options,
);
await field.getByText("L", { exact: true }).click();
await page.waitForTimeout(1500);
const large = await read("Button");
record(
  "Size L from the panel: node L · Preview data-size L · height 42 on both",
  large.size === "L" &&
    large.dataSize === "L" &&
    Math.round(large.preview.height) === 42 &&
    Math.round(large.canvas.height) === 42,
  large,
);
await page.screenshot({ path: `${OUT}/button-L.png` });

await addFromPalette("text field");
await setProps("TextField", { size: "XL" });
const field2 = await read("TextField");
record(
  "TextField XL: Preview data-size XL · Canvas height = Preview height",
  field2.dataSize === "XL" &&
    Math.abs(field2.canvas.height - field2.preview.height) <= 1,
  field2,
);

await addFromPalette("text");
await setProps("Text", { size: "XXL" });
const heading = await read("Text");
record(
  "Text XXL: Preview data-size XXL · font-size 24px · Canvas height = Preview height",
  heading.dataSize === "XXL" &&
    heading.preview.fontSize === "24px" &&
    Math.abs(heading.canvas.height - heading.preview.height) <= 1,
  heading,
);
await page.screenshot({ path: `${OUT}/textfield-heading.png` });

record("no errors", errors.length === 0, errors.slice(0, 5));
writeFileSync(
  `${OUT}/results.json`,
  JSON.stringify({ results, errors }, null, 2),
);
await browser.close();
