// S2 boolean 시각 prop live (사용자 2026-10-10 「개별 10건 착수」 — NumberField hideStepper ·
// ToggleButtonGroup isJustified · Link isStandalone): real Builder (headed Chrome, Compare Mode).
// A NumberField from the palette: Hide Stepper removes the increment · decrement buttons from the
// Preview and the Canvas. A ToggleButtonGroup 600px wide: Justified makes its buttons divide the
// width equally in both consumers. A Link: Standalone sets medium weight (500) in both; no errors.
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/s2-boolean-visual-live.mjs <out>
import { chromium } from "playwright";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const OUT = process.argv[2];
mkdirSync(OUT, { recursive: true });
const REPO = process.cwd();
const BASE = process.env.BUILDER_URL ?? "http://localhost:5173";
const commands = `/@fs${REPO}/packages/shared/src/catalog/commands/index.ts`;
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
    `${pass ? "PASS" : "FAIL"} ${id} — ${JSON.stringify(detail).slice(0, 1200)}\n`,
  );
};
page.on("pageerror", (e) =>
  errors.push(`pageerror: ${e.message.slice(0, 300)}`),
);
page.on("console", (m) => {
  if (m.type() === "error") errors.push(`console: ${m.text().slice(0, 300)}`);
});
async function addFromPalette(label) {
  await page.evaluate(() => {
    window.__COMPOSITION_CATALOG__.workspace.selectRecords([]);
  });
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
const field = (label) =>
  page
    .locator(".panel-wrapper[data-panel='properties'] fieldset", {
      has: page.locator("legend", { hasText: new RegExp(`^${label}$`) }),
    })
    .first();
// A boolean prop is a checkbox row — its visible handle is the label text (disclosure live).
const panelText = (label) =>
  page
    .locator(".panel-wrapper[data-panel='properties']")
    .getByText(label, { exact: true })
    .first();
const toggleBool = async (label) => {
  await panelText(label).click();
  await page.waitForTimeout(1500);
};
const openDesign = async (label) => {
  for (let i = 0; i < 3; i++) {
    if (await field(label).isVisible().catch(() => false)) return true;
    if (await panelText(label).isVisible().catch(() => false)) return true;
    await page
      .getByRole("button", { name: "Design", exact: true })
      .first()
      .click();
    await page.waitForTimeout(1200);
  }
  return (
    (await field(label).isVisible().catch(() => false)) ||
    (await panelText(label).isVisible().catch(() => false))
  );
};
const select = (kind) =>
  page.evaluate((kind) => {
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    const root = ws.root;
    const node = [...root.canvasInputs.values()]
      .filter((r) => root.typeOf(r) === kind)
      .at(-1);
    ws.selectRecords([node.id]);
    return { id: node.id, source: node.sourceId };
  }, kind);
const setWidth = (source, width) =>
  page.evaluate(
    async ({ commands, source, width }) => {
      const c = await import(commands);
      window.__COMPOSITION_CATALOG__.workspace.execute(
        c.setFields({
          targets: [{ kind: "node", id: source }],
          sizing: { width: { kind: "set", value: width } },
        }),
      );
      await new Promise((r) => setTimeout(r, 800));
    },
    { commands, source, width },
  );

await page.goto(`${BASE}/dashboard`);
await page
  .getByRole("button", { name: /new project/i })
  .first()
  .click();
await page.waitForTimeout(300);
await page.keyboard.type("S2 booleans");
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

// ── NumberField hideStepper ──
await addFromPalette("number field");
const nf = await select("NumberField");
const hasHide = await openDesign("Hide Stepper");
record("Design offers Hide Stepper on a NumberField", hasHide, { nf });
const steppers = (id) =>
  page.evaluate((id) => {
    const doc = document.querySelector("#previewFrame").contentDocument;
    const owner = doc.querySelector(`[data-catalog-id="${id}"]`);
    const dom = owner
      ? owner.querySelectorAll("[slot='increment'], [slot='decrement']").length
      : null;
    const root = window.__COMPOSITION_CATALOG__.workspace.root;
    const hidden = [...root.canvasInputs.values()]
      .filter(
        (r) => r.props.slot === "increment" || r.props.slot === "decrement",
      )
      .map((r) => r.hidden === true);
    return { dom, hidden };
  }, id);
const before = await steppers(nf.id);
record(
  "default: the stepper buttons are there (Preview 2, Canvas records shown)",
  before.dom === 2 && before.hidden.length === 2 && before.hidden.every((h) => !h),
  before,
);
await toggleBool("Hide Stepper");
const after = await steppers(nf.id);
await page.screenshot({ path: `${OUT}/numberfield-hidden.png` });
record(
  "Hide Stepper: the buttons are gone in both consumers",
  after.dom === 0 && after.hidden.length === 2 && after.hidden.every(Boolean),
  after,
);

// ── ToggleButtonGroup isJustified ──
await addFromPalette("toggle button group");
const tbg = await select("ToggleButtonGroup");
await setWidth(tbg.source, 600);
const hasJustified = await openDesign("Justified");
record("Design offers Justified on a ToggleButtonGroup", hasJustified, { tbg });
const buttonWidths = (id) =>
  page.evaluate((id) => {
    const doc = document.querySelector("#previewFrame").contentDocument;
    const group = doc.querySelector(`[data-catalog-id="${id}"]`);
    const dom = group
      ? [...group.querySelectorAll(":scope > .react-aria-ToggleButton")].map(
          (b) => b.getBoundingClientRect().width,
        )
      : [];
    const root = window.__COMPOSITION_CATALOG__.workspace.root;
    const owner = root.canvasInputs.get(id);
    const kids = owner.children
      .map((childId) => root.canvasInputs.get(childId))
      .filter(Boolean);
    const geometry = root.getGeometry(kids.map((k) => k.id));
    const canvas = kids.map((k) => geometry.get(k.id)?.width ?? null);
    return { dom, canvas, justified: group?.hasAttribute("data-justified") };
  }, id);
const fit = await buttonWidths(tbg.id);
await toggleBool("Justified");
const grown = await buttonWidths(tbg.id);
await page.screenshot({ path: `${OUT}/tbg-justified.png` });
const spread = (xs) => Math.max(...xs) - Math.min(...xs);
const sum = (xs) => xs.reduce((a, b) => a + b, 0);
record(
  "Justified: the buttons divide 600px equally in both consumers",
  grown.justified === true &&
    grown.dom.length > 1 &&
    spread(grown.dom) <= 1 &&
    sum(grown.dom) > 560 &&
    spread(grown.canvas) <= 1 &&
    sum(grown.canvas) > 560 &&
    sum(fit.dom) < 500 &&
    fit.justified === false,
  { fit, grown },
);

// ── Link isStandalone ──
await addFromPalette("link");
const link = await select("Link");
const hasStandalone = await openDesign("Standalone");
record("Design offers Standalone on a Link", hasStandalone, { link });
const linkWeight = (id) =>
  page.evaluate((id) => {
    const doc = document.querySelector("#previewFrame").contentDocument;
    const el = doc.querySelector(`[data-catalog-id="${id}"]`);
    const node = window.__composition_SKIA_DEBUG__?.getSkiaNode(id);
    const textOf = (n) =>
      n?.text?.fontWeight ??
      (n?.children ?? []).map(textOf).find((w) => w !== undefined);
    return {
      dom: el ? Number(doc.defaultView.getComputedStyle(el).fontWeight) : null,
      standalone: el?.getAttribute("data-standalone") ?? null,
      canvas: textOf(node) ?? null,
    };
  }, id);
const rest = await linkWeight(link.id);
await toggleBool("Standalone");
const standalone = await linkWeight(link.id);
await page.screenshot({ path: `${OUT}/link-standalone.png` });
record(
  "Standalone: medium weight (500) in both consumers; default 400",
  rest.dom === 400 &&
    rest.canvas === 400 &&
    standalone.dom === 500 &&
    standalone.canvas === 500 &&
    standalone.standalone === "true",
  { rest, standalone },
);

record("no errors", errors.length === 0, errors.slice(0, 5));
writeFileSync(
  `${OUT}/results.json`,
  JSON.stringify({ results, errors }, null, 2),
);
await browser.close();
