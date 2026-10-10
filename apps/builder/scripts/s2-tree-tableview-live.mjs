// S2 Tree isEmphasized · TableView isQuiet live (사용자 2026-10-10 「toggle 강조 축 전환」
// Phase 3): real Builder (headed Chrome, Compare Mode). Tree 의 Emphasized · TableView 의
// Quiet 토글이 파생 variant (emphasized · quiet) 로 두 consumer 에 닿는다.
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/s2-tree-tableview-live.mjs <out>
import { chromium } from "playwright";
import { mkdirSync, readFileSync } from "node:fs";

const OUT = process.argv[2];
mkdirSync(OUT, { recursive: true });
const REPO = process.cwd();
const BASE = process.env.BUILDER_URL ?? "http://localhost:5173";
const commands = `/@fs${REPO}/packages/shared/src/catalog/commands/index.ts`;
const paletteModule = `/@fs${REPO}/apps/builder/src/builder/catalogRuntime/paletteInsert.ts`;
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
async function addToBody(type) {
  return page.evaluate(
    async ({ commands, paletteModule, type }) => {
      const c = await import(commands);
      const palette = await import(paletteModule);
      const ws = window.__COMPOSITION_CATALOG__.workspace;
      ws.selectRecords([]);
      const graph = ws.runtime.graph;
      const { pageId } = ws.session.getSnapshot();
      const body = graph.getEntry(pageId).children[0];
      const id = ws.newId("node");
      ws.execute(
        c.insertNodes({
          parent: { kind: "node", id: body },
          entries: [
            {
              kind: "node",
              id,
              definitionId: palette.catalogPaletteDefinitionId(
                graph.library,
                type,
              ),
              children: [],
              props: {},
              visual: {},
              sizing: {},
              descendantOverrides: [],
            },
          ],
          rootIds: [id],
          newId: ws.newId,
          label: "Add element",
        }),
      );
      await new Promise((r) => setTimeout(r, 1200));
      return id;
    },
    { commands, paletteModule, type },
  );
}
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
    if (await panelText(label).isVisible().catch(() => false)) return true;
    await page
      .getByRole("button", { name: "Design", exact: true })
      .first()
      .click();
    await page.waitForTimeout(1200);
  }
  return panelText(label).isVisible().catch(() => false);
};
const selectSource = (source) =>
  page.evaluate((source) => {
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    const root = ws.root;
    const node = [...root.canvasInputs.values()].find(
      (r) => r.sourceId === source,
    );
    ws.selectRecords([node.id]);
    return { id: node.id };
  }, source);
const stateOf = (source, className) =>
  page.evaluate(
    ({ source, className }) => {
      const root = window.__COMPOSITION_CATALOG__.workspace.root;
      const node = [...root.canvasInputs.values()].find(
        (r) => r.sourceId === source,
      );
      const doc = document.querySelector("#previewFrame").contentDocument;
      const el = doc.querySelector(`[data-catalog-id="${node.id}"]`);
      return {
        variant: node.props.variant,
        domVariant: el?.getAttribute("data-variant") ?? null,
        className: el?.className ?? null,
      };
    },
    { source, className },
  );

await page.goto(`${BASE}/dashboard`);
await page
  .getByRole("button", { name: /new project/i })
  .first()
  .click();
await page.waitForTimeout(300);
await page.keyboard.type("S2 tree tableview");
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

// ── Tree ──
const tree = await addToBody("Tree");
await selectSource(tree);
const hasTreeEmphasized = await openDesign("Emphasized");
record("Design offers Emphasized on a Tree", hasTreeEmphasized, { tree });
const treeBefore = await stateOf(tree, "react-aria-Tree");
await toggleBool("Emphasized");
const treeAfter = await stateOf(tree, "react-aria-Tree");
await page.screenshot({ path: `${OUT}/tree-emphasized.png` });
record(
  // (The shared Tree keeps its own data-variant="primary" — the catalog variant was Canvas-only
  // before this conversion too; the sheet has no variant-keyed styles.)
  "Tree Emphasized: the derived emphasized variant reaches the record (the Canvas rule paint)",
  treeBefore.variant === "default" && treeAfter.variant === "emphasized",
  { before: treeBefore, after: treeAfter },
);

// ── TableView ──
const tv = await addToBody("TableView");
await selectSource(tv);
const hasQuiet = await openDesign("Quiet");
record("Design offers Quiet on a TableView", hasQuiet, { tv });
const tvBefore = await stateOf(tv, "react-aria-TableView");
await toggleBool("Quiet");
const tvAfter = await stateOf(tv, "react-aria-TableView");
await page.screenshot({ path: `${OUT}/tableview-quiet.png` });
record(
  "TableView Quiet: the derived quiet variant reaches the record and the Preview data-variant",
  tvBefore.variant === "default" &&
    tvBefore.domVariant === "default" &&
    tvAfter.variant === "quiet" &&
    tvAfter.domVariant === "quiet",
  { before: tvBefore, after: tvAfter },
);

record("no page or console errors", errors.length === 0, { errors });
process.stdout.write(
  `\nRESULT ${results.filter((r) => r.pass).length}/${results.length} PASS\n`,
);
await browser.close();
process.exit(results.every((r) => r.pass) ? 0 : 1);
