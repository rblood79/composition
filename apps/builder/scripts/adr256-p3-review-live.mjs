// ADR-256 Phase 3 review (round 8) live: layout frames the author puts inside a detached CheckboxGroup
// keep the toggles whole. The first item wrapped in a frame stays selected (m3); the second item's
// text wrapped in a frame stays the button's span and the group label still names the group (m2);
// the first item's indicator wrapped in a frame is still drawn in the Preview and keeps its Canvas
// box (m1). Real Builder, headed Chrome.
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/adr256-p3-review-live.mjs <out>
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
await page.keyboard.type("ADR-256 P3 review frames");
await page.keyboard.press("Enter");
await page.waitForURL(/\/builder\//, { timeout: 30000 });
await page.waitForSelector(".app:not(.builder-booting)", { timeout: 30000 });
await page.waitForFunction(
  () => window.__COMPOSITION_CATALOG__?.workspace,
  null,
  { timeout: 30000 },
);
await page.waitForTimeout(1500);
await addFromPalette("checkbox group");
const commands = `/@fs${REPO}/packages/shared/src/catalog/commands/index.ts`;
const actions = `/@fs${REPO}/apps/builder/src/builder/catalogRuntime/componentActions.ts`;
// Records of the group's tree (type · source id), in order.
const tree = () =>
  page.evaluate(() => {
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    const top = [...ws.root.canvasInputs.values()].find(
      (r) => ws.root.typeOf(r) === "CheckboxGroup",
    );
    const out = [];
    const visit = (r, depth) => {
      for (const c of r.children) {
        const child = ws.root.canvasInputs.get(c);
        if (!child) continue;
        const g = ws.root.getGeometry([child.id]).get(child.id);
        out.push({
          id: child.id,
          source: child.sourceId,
          type: ws.root.typeOf(child),
          depth,
          box: g ? [Math.round(g.width), Math.round(g.height)] : null,
        });
        visit(child, depth + 1);
      }
    };
    visit(top, 1);
    return { group: top.sourceId, nodes: out };
  });
const preview = (group) =>
  page.evaluate((group) => {
    const doc = document.querySelector("#previewFrame")?.contentDocument;
    const root = [...(doc?.querySelectorAll("[data-catalog-id]") ?? [])].find(
      (e) =>
        e.getAttribute("data-catalog-id").endsWith(`::${group}`) &&
        e.classList.contains("react-aria-CheckboxGroup"),
    );
    if (!root) return null;
    const first = root.getAttribute("aria-labelledby")?.split(" ")[0];
    return {
      checked: [...root.querySelectorAll("input")].map((i) => i.checked),
      indicators: root.querySelectorAll(".checkbox").length,
      labelledBy: first ? doc.getElementById(first)?.textContent : null,
      nestedLabels: root.querySelectorAll("label label").length,
      texts: [...root.querySelectorAll(".react-aria-CheckboxButton span.react-aria-Label")].map(
        (e) => e.textContent,
      ),
    };
  }, group);
const before = await tree();
await compareOn();
const dom0 = await preview(before.group);
record("R-0 before: the group's Preview", !!dom0, dom0);
const wrapped = await page.evaluate(
  async ({ commands, actions, group }) => {
    const { insertNodes, moveNodes } = await import(commands);
    const { catalogComponentCommands } = await import(actions);
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    const errors = [];
    const run = (label, fn) => {
      try {
        fn();
      } catch (error) {
        errors.push(`${label}: ${String(error?.code ?? error?.message ?? error)}`);
      }
    };
    run("detach", () => ws.execute(catalogComponentCommands.detach(group, ws.newId)));
    const all = () =>
      [...ws.root.canvasInputs.values()].map((r) => ({
        r,
        type: ws.root.typeOf(r),
      }));
    const frameAround = (label, parent, index, ids) =>
      run(label, () => {
        const frame = ws.newId("node");
        ws.execute(
          insertNodes({
            parent: { kind: "node", id: parent },
            index,
            entries: [
              {
                kind: "node",
                id: frame,
                definitionId: "lib:definition:type-frame",
                children: [],
                props: {},
                visual: {},
                sizing: {},
                descendantOverrides: [],
              },
            ],
            rootIds: [frame],
            newId: ws.newId,
          }),
        );
        ws.execute(
          moveNodes({ ids, parent: { kind: "node", id: frame }, newId: ws.newId }),
        );
      });
    const of = (type) => all().filter((x) => x.type === type).map((x) => x.r);
    const [items] = of("CheckboxItems");
    const [first, second] = of("Checkbox");
    const buttonOf = (box) =>
      ws.root.canvasInputs.get(
        box.children.find(
          (c) => ws.root.typeOf(ws.root.canvasInputs.get(c)) === "CheckboxButton",
        ),
      );
    const childOf = (button, type) =>
      button.children
        .map((c) => ws.root.canvasInputs.get(c))
        .find((r) => ws.root.typeOf(r) === type);
    // m3: the first item in a frame.
    frameAround("m3", items.sourceId, 0, [first.sourceId]);
    // m1 · m2: a Checkbox built from its parts (a group item is an origin instance — its root shows
    // a display state, so it does not detach): the indicator and the text each in a frame.
    run("authored", () => {
      const id = (n) => `project:node:review-${n}`;
      const node = (n, type, children, props = {}) => ({
        kind: "node",
        id: id(n),
        definitionId: `lib:definition:type-${type}`,
        children: children.map(id),
        props: Object.fromEntries(
          Object.entries(props).map(([k, v]) => [k, { kind: "set", value: v }]),
        ),
        visual: {},
        sizing: {},
        descendantOverrides: [],
      });
      const body = [...ws.root.canvasInputs.values()].find(
        (r) => r.sourceId.endsWith("home-body") || ws.root.typeOf(r) === "body",
      );
      ws.execute(
        insertNodes({
          parent: { kind: "node", id: body.sourceId },
          entries: [
            node("box", "Checkbox", ["button"], { isSelected: true }),
            node("button", "CheckboxButton", ["indicator", "text"]),
            node("indicator", "CheckboxIndicator", []),
            node("text", "Label", [], { children: "Own" }),
          ],
          rootIds: [id("box")],
          newId: ws.newId,
        }),
      );
    });
    frameAround("m1", "project:node:review-button", 0, ["project:node:review-indicator"]);
    frameAround("m2", "project:node:review-button", 1, ["project:node:review-text"]);
    return errors;
  },
  { commands, actions, group: before.group },
);
record("R-1 detach the group + frame around an item; a Checkbox from parts + frames around its indicator and text", wrapped.length === 0, wrapped);
await page.waitForTimeout(2500);
const dom1 = await preview(before.group);
record(
  "R-2 Preview: the wrapped first group item stays selected (m3); the group label still names the group",
  !!dom1 &&
    JSON.stringify(dom1.checked) === JSON.stringify(dom0?.checked) &&
    dom1.indicators === dom0?.indicators &&
    dom1.labelledBy === dom0?.labelledBy &&
    dom1.nestedLabels === 0 &&
    JSON.stringify(dom1.texts) === JSON.stringify(dom0?.texts),
  { before: dom0, after: dom1 },
);
const after = await tree();
const boxes = (t) =>
  t.nodes.filter((n) => n.type === "CheckboxIndicator").map((n) => n.box);
record(
  "R-3 Canvas: the group items\u0027 indicators keep their boxes",
  JSON.stringify(boxes(after)) === JSON.stringify(boxes(before)) &&
    boxes(after).every((b) => b && b[0] > 0),
  { before: boxes(before), after: boxes(after) },
);
const authored = await page.evaluate(() => {
  const ws = window.__COMPOSITION_CATALOG__.workspace;
  const rec = (n) =>
    [...ws.root.canvasInputs.values()].find(
      (r) => r.sourceId === `project:node:review-${n}`,
    );
  const g = ws.root.getGeometry([rec("indicator").id]).get(rec("indicator").id);
  const doc = document.querySelector("#previewFrame")?.contentDocument;
  const box = [...(doc?.querySelectorAll("[data-catalog-id]") ?? [])].find((e) =>
    e.getAttribute("data-catalog-id").endsWith("::project:node:review-box"),
  );
  return {
    canvas: [Math.round(g.width), Math.round(g.height)],
    indicators: box?.querySelectorAll(".checkbox").length ?? null,
    checked: box?.querySelector("input")?.checked ?? null,
    nestedLabels: box?.querySelectorAll("label label").length ?? null,
    text: box?.querySelector(".react-aria-CheckboxButton span.react-aria-Label")?.textContent ?? null,
  };
});
record(
  "R-5 a Checkbox from parts, indicator and text in frames: Preview draws the indicator (m1) and the text as the button's span (m2); Canvas indicator 20x20",
  authored.indicators === 1 &&
    authored.checked === true &&
    authored.nestedLabels === 0 &&
    authored.text === "Own" &&
    JSON.stringify(authored.canvas) === "[20,20]",
  authored,
);
await page.screenshot({ path: `${OUT}/frames-compare.png` });
record("R-4 no page errors", errors.length === 0, { errors });
writeFileSync(`${OUT}/results.json`, JSON.stringify({ results, errors }, null, 2));
await browser.close();
process.exit(results.every((r) => r.pass) ? 0 : 1);
