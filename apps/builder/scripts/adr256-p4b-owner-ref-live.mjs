// ADR-256 Phase 4b live: a stored state owner stays linked (breakdown §1-1). A ToggleButton holds a
// Text shown while selected, by the ToggleButton's address. Moving the Text out of it is refused
// (the document stays); duplicating the ToggleButton gives the copy its own owner (turning the
// original off hides only the original's Text); after a reload (contract 9) the reference and the
// display are the same. Real Builder, headed Chrome.
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/adr256-p4b-owner-ref-live.mjs <out>
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
await page.keyboard.type("ADR-256 P4b owner ref");
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
const run = (fn, arg) => page.evaluate(fn, { commands, ...arg });
await run(async ({ commands }) => {
  const { insertNodes } = await import(commands);
  const ws = window.__COMPOSITION_CATALOG__.workspace;
  const body = [...ws.root.canvasInputs.values()].find((r) =>
    r.sourceId.endsWith("home-body"),
  );
  const set = (v) => ({ kind: "set", value: v });
  ws.execute(
    insertNodes({
      parent: { kind: "node", id: body.sourceId },
      entries: [
        {
          kind: "node",
          id: "project:node:p4b-tb",
          definitionId: "lib:definition:type-ToggleButton",
          children: ["project:node:p4b-on"],
          props: { isSelected: set(true) },
          visual: {},
          sizing: {},
          descendantOverrides: [],
        },
        {
          kind: "node",
          id: "project:node:p4b-on",
          definitionId: "lib:definition:text",
          children: [],
          props: { children: set("On") },
          visual: {},
          sizing: {},
          descendantOverrides: [],
          showWhen: {
            all: ["isSelected"],
            from: { ancestor: { nodeId: "project:node:p4b-tb" } },
          },
        },
        {
          kind: "node",
          id: "project:node:p4b-f",
          definitionId: "lib:definition:type-frame",
          children: [],
          props: {},
          visual: {},
          sizing: {},
          descendantOverrides: [],
        },
      ],
      rootIds: ["project:node:p4b-tb", "project:node:p4b-f"],
      newId: ws.newId,
    }),
  );
});
await compareOn();
const ons = () =>
  page.evaluate(() => {
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    const doc = document.querySelector("#previewFrame")?.contentDocument;
    return [...ws.root.canvasInputs.values()]
      .filter((r) => r.props.children === "On")
      .map((r) => ({
        source: r.sourceId,
        owner: r.showWhen?.from?.ancestor?.nodeId,
        canvas: r.hidden !== true,
        preview: !!doc?.querySelector(`[data-catalog-id$="::${r.sourceId}"]`),
      }));
  });
const o0 = await ons();
record(
  "B-1 the Text shows while its ToggleButton is selected (Canvas and Preview)",
  o0.length === 1 && o0[0].canvas && o0[0].preview,
  o0,
);
const refused = await run(async ({ commands }) => {
  const { moveNodes } = await import(commands);
  const ws = window.__COMPOSITION_CATALOG__.workspace;
  try {
    ws.execute(
      moveNodes({
        ids: ["project:node:p4b-on"],
        parent: { kind: "node", id: "project:node:p4b-f" },
        newId: ws.newId,
      }),
    );
    return null;
  } catch (error) {
    return String(error?.code ?? error?.message);
  }
});
const parentOf = () =>
  page.evaluate(() => {
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    return ws.runtime.graph.ownerOf("project:node:p4b-on");
  });
record(
  "B-2 moving the Text out of its owner is refused; it stays",
  refused === "STATE_OWNER_UNLINKED" && (await parentOf()) === "project:node:p4b-tb",
  { refused, parent: await parentOf() },
);
await run(async ({ commands }) => {
  const { duplicateNodes, setFields } = await import(commands);
  const ws = window.__COMPOSITION_CATALOG__.workspace;
  ws.execute(duplicateNodes({ ids: ["project:node:p4b-tb"], newId: ws.newId }));
  ws.execute(
    setFields({
      targets: [{ kind: "node", id: "project:node:p4b-tb" }],
      props: { isSelected: { kind: "set", value: false } },
    }),
  );
});
await page.waitForTimeout(1500);
const o1 = await ons();
const original = o1.find((o) => o.source === "project:node:p4b-on");
const copy = o1.find((o) => o.source !== "project:node:p4b-on");
record(
  "B-3 the duplicate's Text reads the duplicate; the original turned off hides only its own (Canvas and Preview)",
  !!copy &&
    copy.owner !== "project:node:p4b-tb" &&
    original.canvas === false &&
    original.preview === false &&
    copy.canvas === true &&
    copy.preview === true,
  o1,
);
await page.waitForTimeout(1500);
await page.reload();
await page.waitForSelector(".app:not(.builder-booting)", { timeout: 30000 });
await page.waitForFunction(() => window.__COMPOSITION_CATALOG__?.workspace, null, {
  timeout: 30000,
});
await page.waitForTimeout(2500);
await compareOn();
const o2 = await ons();
record(
  "B-4 reopened: the same references and display",
  JSON.stringify(o2.map((o) => [o.owner, o.canvas, o.preview]).sort()) ===
    JSON.stringify(o1.map((o) => [o.owner, o.canvas, o.preview]).sort()),
  o2,
);
await page.screenshot({ path: `${OUT}/owner-ref.png` });
record("B-5 no page errors", errors.length === 0, { errors });
writeFileSync(`${OUT}/results.json`, JSON.stringify({ results, errors }, null, 2));
await browser.close();
process.exit(results.every((r) => r.pass) ? 0 : 1);
