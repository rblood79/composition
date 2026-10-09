// S2 Heading level live (사용자 2026-10-09 「①부터 진행해」 — S2 전용 prop 1순위): real Builder
// (headed Chrome, Compare Mode). A Disclosure's title Heading: the Design panel offers Level (3 until
// set); Level 2 from the panel writes `level: 2`, the Preview draws an `h2` there, and the Canvas
// box keeps its height (the size draws the type) equal to the Preview's; undo returns to `h3`; no
// errors.
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/heading-level-live.mjs <out>
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
const read = () =>
  page.evaluate(() => {
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    const root = ws.root;
    const node = [...root.canvasInputs.values()].find(
      (r) => root.typeOf(r) === "Heading",
    );
    const geo = root.getGeometry([node.id]).get(node.id);
    const doc = document.querySelector("#previewFrame").contentDocument;
    const el = doc.querySelector(".react-aria-Disclosure .react-aria-Heading");
    return {
      id: node.id,
      level: node.props.level ?? null,
      tag: el?.tagName ?? null,
      canvasHeight: geo?.height ?? null,
      previewHeight: el ? el.getBoundingClientRect().height : null,
    };
  });
const levelField = () =>
  page
    .locator(".panel-wrapper[data-panel='properties'] fieldset", {
      has: page.locator("legend", { hasText: /^Level$/ }),
    })
    .first();

await page.goto(`${BASE}/dashboard`);
await page
  .getByRole("button", { name: /new project/i })
  .first()
  .click();
await page.waitForTimeout(300);
await page.keyboard.type("Heading level");
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

await addFromPalette("disclosure");
await page.waitForTimeout(1500);
await page.waitForFunction(
  () => {
    const root = window.__COMPOSITION_CATALOG__.workspace.root;
    return [...root.canvasInputs.values()].some(
      (r) => root.typeOf(r) === "Heading",
    );
  },
  null,
  { timeout: 15000 },
);
const fresh = await read();
record(
  "Disclosure title Heading: no level · Preview h3 · Canvas height = Preview height",
  fresh.level === null &&
    fresh.tag === "H3" &&
    Math.abs(fresh.canvasHeight - fresh.previewHeight) <= 1,
  fresh,
);

await page.evaluate((id) => {
  window.__COMPOSITION_CATALOG__.workspace.selectRecords([id]);
}, fresh.id);
await page.waitForTimeout(1200);
await page.getByRole("button", { name: "Design", exact: true }).first().click();
await page.waitForTimeout(1200);
const field = levelField();
const input = field.locator("input.slider-output--input").first();
const shown = await input.inputValue().catch(() => null);
record("Design panel: Level slider value shows 3", shown === "3", { shown });
await input.fill("2");
await input.press("Enter");
await page.waitForTimeout(1500);
const two = await read();
record(
  "Level 2 from the panel: node level 2 · Preview h2 · Canvas height unchanged = Preview height",
  two.level === 2 &&
    two.tag === "H2" &&
    Math.abs(two.canvasHeight - fresh.canvasHeight) <= 0.5 &&
    Math.abs(two.canvasHeight - two.previewHeight) <= 1,
  two,
);
await page.screenshot({ path: `${OUT}/heading-level-2.png` });

await page.evaluate(() => window.__COMPOSITION_CATALOG__.workspace.undo());
await page.waitForTimeout(1500);
const undone = await read();
record(
  "undo: no level · Preview h3",
  undone.level === null && undone.tag === "H3",
  undone,
);

record("no errors", errors.length === 0, errors.slice(0, 5));
writeFileSync(
  `${OUT}/results.json`,
  JSON.stringify({ results, errors }, null, 2),
);
await browser.close();
