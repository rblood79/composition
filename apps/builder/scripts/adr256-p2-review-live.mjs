// ADR-256 Phase 2 review live (round 6 repair). A NumberField and a DateField are placed and
// detached; a layout frame is put in each and the control (the NumberField's wrapper, the
// DateField's DateInput) and the Label moved into it: the Preview still draws RAC's control
// (Group + Input + 2 Buttons · date segments), the Canvas keeps it. The NumberField's label is
// emptied then filled: the Canvas Label follows (hidden ↔ shown) as the Preview does. A
// Description given its own text under an empty field `description` shows on both sides.
// Real Builder, headed Chrome.
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/adr256-p2-review-live.mjs <out>
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
const frameDoc = () => page.frameLocator("#previewFrame");

await page.goto(`${BASE}/dashboard`);
await page
  .getByRole("button", { name: /new project/i })
  .first()
  .click();
await page.waitForTimeout(300);
await page.keyboard.type("ADR-256 P2 review");
await page.keyboard.press("Enter");
await page.waitForURL(/\/builder\//, { timeout: 30000 });
await page.waitForSelector(".app:not(.builder-booting)", { timeout: 30000 });
await page.waitForFunction(
  () => window.__COMPOSITION_CATALOG__?.workspace,
  null,
  { timeout: 30000 },
);
await page.waitForTimeout(1500);
await addFromPalette("number field");
await addFromPalette("date field");
await addFromPalette("text field");
await page.waitForTimeout(800);

const commands = `/@fs${REPO}/packages/shared/src/catalog/commands/index.ts`;
const actions = `/@fs${REPO}/apps/builder/src/builder/catalogRuntime/componentActions.ts`;
const ids = await page.evaluate(
  async ({ commands, actions }) => {
    const { insertNodes, moveNodes, setFields } = await import(commands);
    const { catalogComponentCommands } = await import(actions);
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    const of = (type) =>
      [...ws.root.canvasInputs.values()].find((r) => ws.root.typeOf(r) === type)
        .sourceId;
    const out = {};
    for (const [type, control] of [
      ["NumberField", "SelectTrigger"],
      ["DateField", "DateInput"],
    ]) {
      const id = of(type);
      ws.execute(
        setFields({
          targets: [{ kind: "node", id }],
          props: { label: { kind: "set", value: type } },
        }),
      );
      ws.execute(catalogComponentCommands.detach(id, ws.newId));
      const child = (t) =>
        [...ws.root.canvasInputs.values()].find(
          (r) =>
            ws.root.typeOf(r) === t &&
            ws.root.canvasInputs.get(r.parentId)?.sourceId === id,
        ).sourceId;
      const moved = [child(control), child("Label")];
      const frame = ws.newId("node");
      ws.execute(
        insertNodes({
          parent: { kind: "node", id },
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
        moveNodes({
          ids: moved,
          parent: { kind: "node", id: frame },
          newId: ws.newId,
        }),
      );
      out[type] = id;
    }
    return out;
  },
  { commands, actions },
);
await page
  .getByRole("button", { name: "Compare Mode (Preview + Skia)", exact: true })
  .first()
  .click();
await page.waitForTimeout(3000);
const previewOf = (id, cls) =>
  page.evaluate(
    ({ id, cls }) => {
      const doc = document.querySelector("#previewFrame")?.contentDocument;
      const root = [...(doc?.querySelectorAll("[data-catalog-id]") ?? [])].find(
        (e) =>
          e.getAttribute("data-catalog-id").endsWith(`::${id}`) &&
          e.classList.contains(cls),
      );
      if (!root) return null;
      const html = root.outerHTML;
      return {
        groups: root.querySelectorAll('[role="group"]').length,
        inputs: root.querySelectorAll("input").length,
        buttons: root.querySelectorAll("button").length,
        spinbuttons: root.querySelectorAll('[role="spinbutton"]').length,
        // (RAC DateField draws its Label as a `span` — a DateInput is not labelable.)
        label: root.querySelector(".react-aria-Label")?.textContent ?? null,
        hint: root.querySelector('[slot="description"]')?.textContent ?? null,
        frameWrapped: /data-catalog-id="[^"]*"[^>]*>\s*<label/.test(html),
      };
    },
    { id, cls },
  );
const number1 = await previewOf(ids.NumberField, "react-aria-NumberField");
record(
  "R6-1 Preview: NumberField with its wrapper and Label in a frame keeps Group + Input + 2 Buttons + Label",
  !!number1 &&
    number1.groups >= 1 &&
    number1.inputs === 1 &&
    number1.buttons === 2 &&
    !!number1.label,
  number1,
);
const date1 = await previewOf(ids.DateField, "react-aria-DateField");
record(
  "R6-2 Preview: DateField with its DateInput and Label in a frame keeps the date segments",
  !!date1 && date1.spinbuttons >= 3 && !!date1.label,
  date1,
);
const canvasParts = (id) =>
  page.evaluate((id) => {
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    const field = [...ws.root.canvasInputs.values()].find(
      (r) => r.sourceId === id,
    );
    const out = [];
    const visit = (record) => {
      for (const childId of record.children) {
        const child = ws.root.canvasInputs.get(childId);
        if (!child) continue;
        out.push({
          type: ws.root.typeOf(child),
          hidden: !!child.hidden,
          text: child.props.children ?? null,
          derived: child.derivedProps ?? null,
        });
        visit(child);
      }
    };
    visit(field);
    return out;
  }, id);
const dateCanvas = await canvasParts(ids.DateField);
record(
  "R6-3 Canvas: the DateInput in the frame keeps its field's segment values (_parentTag DateField)",
  dateCanvas.some(
    (p) => p.type === "DateInput" && p.derived?._parentTag === "DateField",
  ),
  dateCanvas.filter((p) => p.type === "DateInput"),
);
// The label emptied, then filled: the Canvas Label follows. (a) The detached NumberField's Label
// (in the frame) — its own text. (b) A TextField instance — the field's `label` prop.
const setText = (target, key, value) =>
  page.evaluate(
    async ({ commands, target, key, value }) => {
      const { setFields } = await import(commands);
      const ws = window.__COMPOSITION_CATALOG__.workspace;
      ws.execute(
        setFields({
          targets: [{ kind: "node", id: target }],
          props: { [key]: { kind: "set", value } },
        }),
      );
    },
    { commands, target, key, value },
  );
const labelOf = (id) =>
  page.evaluate((id) => {
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    const field = [...ws.root.canvasInputs.values()].find(
      (r) => r.sourceId === id,
    );
    const seen = [];
    const visit = (record) => {
      for (const childId of record.children) {
        const child = ws.root.canvasInputs.get(childId);
        if (!child) continue;
        if (ws.root.typeOf(child) === "Label")
          seen.push({
            source: child.sourceId,
            hidden: !!child.hidden,
            text: child.props.children ?? null,
          });
        visit(child);
      }
    };
    visit(field);
    return seen[0];
  }, id);
const textFieldId = await page.evaluate(() => {
  const ws = window.__COMPOSITION_CATALOG__.workspace;
  return [...ws.root.canvasInputs.values()].find(
    (r) => ws.root.typeOf(r) === "TextField",
  ).sourceId;
});
const cases = [
  ["NumberField", ids.NumberField, "react-aria-NumberField"],
  ["TextField", textFieldId, "react-aria-TextField"],
];
const observed = {};
for (const [name, id, cls] of cases) {
  const label = await labelOf(id);
  const [target, key] =
    name === "NumberField" ? [label.source, "children"] : [id, "label"];
  await setText(target, key, "");
  await page.waitForTimeout(1200);
  const emptied = {
    canvas: await labelOf(id),
    preview: (await previewOf(id, cls))?.label ?? null,
  };
  await setText(target, key, "Width");
  await page.waitForTimeout(1200);
  const filled = {
    canvas: await labelOf(id),
    preview: (await previewOf(id, cls))?.label ?? null,
  };
  observed[name] = { emptied, filled };
}
record(
  "R6-4 label emptied → Canvas Label hidden, Preview none; filled → Canvas shown, Preview 'Width' (detached Label in a frame · TextField instance prop)",
  Object.values(observed).every(
    ({ emptied, filled }) =>
      emptied.canvas?.hidden === true &&
      emptied.preview === null &&
      filled.canvas?.hidden === false &&
      /^Width/.test(filled.preview ?? ""),
  ),
  observed,
);
// The Description given its own text while the field's description stays empty.
await page.evaluate(
  async ({ commands, id }) => {
    const { setFields } = await import(commands);
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    const hint = [...ws.root.canvasInputs.values()].find(
      (r) =>
        ws.root.typeOf(r) === "Description" &&
        ws.root.canvasInputs.get(r.parentId)?.sourceId === id,
    );
    ws.execute(
      setFields({
        targets: [{ kind: "node", id }],
        props: { description: { kind: "set", value: "" } },
      }),
    );
    ws.execute(
      setFields({
        targets: [{ kind: "node", id: hint.sourceId }],
        props: { children: { kind: "set", value: "Authored hint" } },
      }),
    );
  },
  { commands, id: ids.NumberField },
);
await page.waitForTimeout(1500);
const hintCanvas = (await canvasParts(ids.NumberField)).find(
  (p) => p.type === "Description",
);
const hintPreview = (await previewOf(ids.NumberField, "react-aria-NumberField"))
  ?.hint;
record(
  "R6-5 a Description with its own text shows on the Canvas and in the Preview",
  hintCanvas?.hidden === false && hintPreview === "Authored hint",
  { hintCanvas, hintPreview },
);
await page.mouse.click(265, 77);
await page.waitForTimeout(300);
await page.keyboard.down("Control");
for (let i = 0; i < 10; i += 1) {
  await page.mouse.move(846, 312);
  await page.mouse.wheel(0, -120);
  await page.waitForTimeout(80);
}
await page.keyboard.up("Control");
await page.waitForTimeout(1500);
await page.screenshot({ path: `${OUT}/review-compare.png` });
record("R6-6 no page errors", errors.length === 0, { errors });
writeFileSync(
  `${OUT}/results.json`,
  JSON.stringify({ results, errors }, null, 2),
);
await browser.close();
process.exit(results.every((r) => r.pass) ? 0 : 1);
