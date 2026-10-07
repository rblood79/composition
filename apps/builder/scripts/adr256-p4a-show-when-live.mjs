// ADR-256 Phase 4a live: a node's `showWhen`. A Checkbox built from its parts holds a check Icon
// (`isSelected` and not `isIndeterminate`) and a dash Icon (`isIndeterminate`) in its button
// (reference example 7). The Preview follows RAC's state (Space selects → the check appears); the
// Canvas follows the record (an edit of `isSelected` / `isIndeterminate` shows the check / dash). A
// Disclosure header Icon (`isExpanded`) follows the Preview's expansion and the Canvas's prop.
// Real Builder, headed Chrome.
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/adr256-p4a-show-when-live.mjs <out>
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
}
async function compareOn() {
  const button = page
    .getByRole("button", { name: "Compare Mode (Preview + Skia)", exact: true })
    .first();
  if (await button.isVisible().catch(() => false)) await button.click();
  await page.waitForTimeout(3000);
}

await page.goto(`${BASE}/dashboard`);
await page
  .getByRole("button", { name: /new project/i })
  .first()
  .click();
await page.waitForTimeout(300);
await page.keyboard.type("ADR-256 P4a showWhen");
await page.keyboard.press("Enter");
await page.waitForURL(/\/builder\//, { timeout: 30000 });
await page.waitForSelector(".app:not(.builder-booting)", { timeout: 30000 });
await page.waitForFunction(
  () => window.__COMPOSITION_CATALOG__?.workspace,
  null,
  { timeout: 30000 },
);
await page.waitForTimeout(1500);
const commands = `/@fs${REPO}/packages/shared/src/catalog/commands/index.ts`;
await page.evaluate(
  async ({ commands }) => {
    const { insertNodes } = await import(commands);
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    const id = (n) => `project:node:p4a-${n}`;
    const node = (n, definitionId, children, props = {}, showWhen) => ({
      kind: "node",
      id: id(n),
      definitionId,
      children: children.map(id),
      props: Object.fromEntries(
        Object.entries(props).map(([k, v]) => [k, { kind: "set", value: v }]),
      ),
      visual: {},
      sizing: {},
      descendantOverrides: [],
      ...(showWhen ? { showWhen } : {}),
    });
    const t = (type) => `lib:definition:type-${type}`;
    const body = [...ws.root.canvasInputs.values()].find((r) =>
      r.sourceId.endsWith("home-body"),
    );
    ws.execute(
      insertNodes({
        parent: { kind: "node", id: body.sourceId },
        entries: [
          node("box", t("Checkbox"), ["button"]),
          node("button", t("CheckboxButton"), ["indicator", "check", "dash", "text"]),
          node("indicator", t("CheckboxIndicator"), []),
          node("check", t("Icon"), [], { iconName: "check" }, {
            all: ["isSelected", { not: "isIndeterminate" }],
          }),
          node("dash", t("Icon"), [], { iconName: "minus" }, { all: ["isIndeterminate"] }),
          node("text", t("Label"), [], { children: "Subscribe" }),
          node("d", t("Disclosure"), ["d-header"], { isExpanded: false }),
          node("d-header", t("DisclosureHeader"), ["open", "d-title"]),
          node("open", t("Icon"), [], { iconName: "chevron-down" }, { all: ["isExpanded"] }),
          node("d-title", "lib:definition:text", [], { children: "Details" }),
        ],
        rootIds: [id("box"), id("d")],
        newId: ws.newId,
      }),
    );
  },
  { commands },
);
await compareOn();
const read = () =>
  page.evaluate(() => {
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    const doc = document.querySelector("#previewFrame")?.contentDocument;
    const out = {};
    for (const n of ["check", "dash", "open"]) {
      const sid = `project:node:p4a-${n}`;
      const rec = [...ws.root.canvasInputs.values()].find((r) => r.sourceId === sid);
      out[n] = {
        canvas: rec ? rec.hidden !== true : null,
        preview: !!doc?.querySelector(`[data-catalog-id$="::${sid}"]`),
      };
    }
    return out;
  });
const flat = (s) => Object.fromEntries(Object.entries(s).map(([k, v]) => [k, [v.canvas, v.preview]]));
const s0 = await read();
record(
  "L-1 rest: no check · no dash · no open icon (Canvas and Preview)",
  JSON.stringify(flat(s0)) ===
    JSON.stringify({ check: [false, false], dash: [false, false], open: [false, false] }),
  flat(s0),
);
// Preview: Space on the checkbox → RAC selects it → the check (the Canvas keeps the record).
const frame = page.frameLocator("#previewFrame");
await frame.locator('[data-catalog-id$="::project:node:p4a-box"] input').focus();
await page.keyboard.press("Space");
// Preview: the Disclosure's trigger → expanded → the open icon.
await frame
  .locator('[data-catalog-id$="::project:node:p4a-d"] button')
  .first()
  .click();
await page.waitForTimeout(600);
const s1 = await read();
record(
  "L-2 Preview: Space shows the check (RAC state), the trigger shows the open icon; the Canvas keeps the record",
  s1.check.preview === true &&
    s1.dash.preview === false &&
    s1.open.preview === true &&
    s1.check.canvas === false &&
    s1.open.canvas === false,
  flat(s1),
);
// Canvas: the record's isIndeterminate → the dash; the Disclosure's isExpanded → the open icon.
await page.evaluate(async ({ commands }) => {
  const { setFields } = await import(commands);
  const ws = window.__COMPOSITION_CATALOG__.workspace;
  ws.execute(
    setFields({
      targets: [{ kind: "node", id: "project:node:p4a-box" }],
      props: {
        isSelected: { kind: "set", value: true },
        isIndeterminate: { kind: "set", value: true },
      },
    }),
  );
  ws.execute(
    setFields({
      targets: [{ kind: "node", id: "project:node:p4a-d" }],
      props: { isExpanded: { kind: "set", value: true } },
    }),
  );
}, { commands });
await page.waitForTimeout(1500);
const s2 = await read();
record(
  "L-3 Canvas: isIndeterminate shows the dash not the check; isExpanded shows the open icon (Preview the same)",
  s2.dash.canvas === true &&
    s2.check.canvas === false &&
    s2.open.canvas === true &&
    s2.dash.preview === true &&
    s2.check.preview === false &&
    s2.open.preview === true,
  flat(s2),
);
await page.screenshot({ path: `${OUT}/show-when-compare.png` });
record("L-4 no page errors", errors.length === 0, { errors });
writeFileSync(`${OUT}/results.json`, JSON.stringify({ results, errors }, null, 2));
await browser.close();
process.exit(results.every((r) => r.pass) ? 0 : 1);
