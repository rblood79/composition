// ADR-256 Phase 6b live — a field's control box is a RAC Group node, in the real Builder with the
// Preview open (Compare Mode), headed Chrome: palette NumberField · SearchField · DateRangePicker —
// the Preview's Group (NumberField `div.react-aria-Group[role=group]`, SearchField the same with its
// container class) at the Canvas Group box; the range picker's Group paints its box on the Canvas;
// the field's size reaches the parts through the Group (lg → 42 tall on both sides).
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/adr256-p6b-live.mjs <out>
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

const commands = `/@fs${REPO}/packages/shared/src/catalog/commands/index.ts`;
const shortcuts = `/@fs${REPO}/apps/builder/src/builder/catalogRuntime/shortcuts.ts`;
async function newProject(name) {
  await page.goto(`${BASE}/dashboard`);
  await page
    .getByRole("button", { name: /new project/i })
    .first()
    .click();
  await page.waitForTimeout(300);
  await page.keyboard.type(name);
  await page.keyboard.press("Enter");
  await page.waitForURL(/\/builder\//, { timeout: 30000 });
  await page.waitForSelector(".app:not(.builder-booting)", { timeout: 30000 });
  await page.waitForFunction(
    () => window.__COMPOSITION_CATALOG__?.workspace,
    null,
    { timeout: 30000 },
  );
}
const partId = (type, index = 0) =>
  page.evaluate(
    ({ type, index }) => {
      const ws = window.__COMPOSITION_CATALOG__.workspace;
      return [...ws.root.canvasInputs.values()].filter(
        (r) => ws.root.typeOf(r) === type,
      )[index]?.id;
    },
    { type, index },
  );
async function insertVia(partType, label, times) {
  const id = await partId(partType);
  await page.evaluate(
    (id) => window.__COMPOSITION_CATALOG__.workspace.selectRecords([id]),
    id,
  );
  await page.waitForTimeout(600);
  if (
    !(await page
      .getByRole("button", { name: label, exact: true })
      .first()
      .isVisible()
      .catch(() => false))
  ) {
    await page
      .getByRole("button", { name: "Design", exact: true })
      .first()
      .click()
      .catch(() => {});
    await page.waitForTimeout(800);
  }
  for (let k = 0; k < times; k++) {
    await page
      .getByRole("button", { name: label, exact: true })
      .first()
      .click();
    await page.waitForTimeout(500);
    await page.evaluate(
      (id) => window.__COMPOSITION_CATALOG__.workspace.selectRecords([id]),
      id,
    );
    await page.waitForTimeout(400);
  }
}
/** Run a catalog command in the page: `build(commands, ws)` returns the command. */
async function run(build, arg) {
  return page.evaluate(
    async ({ commands, build, arg }) => {
      const c = await import(commands);
      const ws = window.__COMPOSITION_CATALOG__.workspace;
      const at = (id) => ws.positionOfRecord(id).target;
      try {
        ws.execute(
          new Function(
            "c",
            "ws",
            "at",
            "arg",
            `return (${build})(c, ws, at, arg);`,
          )(c, ws, at, arg),
        );
        await new Promise((r) => setTimeout(r, 400));
        return { ok: true };
      } catch (error) {
        return { ok: false, code: error?.code ?? String(error) };
      }
    },
    { commands, build: build.toString(), arg },
  );
}

await newProject("ADR-256 P6b control group");
await addFromPalette("number field");
await addFromPalette("search field");
await addFromPalette("date range picker");
await compareOn();
const groups = () =>
  page.evaluate(() => {
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    const root = ws.root;
    const doc = document.querySelector("#previewFrame")?.contentDocument;
    return [...root.canvasInputs.values()]
      .filter((r) => root.typeOf(r) === "Group")
      .map((group) => {
        const field = root.canvasInputs.get(group.parentId);
        const box = root.getGeometry([group.id]).get(group.id);
        const fieldEl = doc?.querySelector(
          `[data-catalog-id="${CSS.escape(field.id)}"]`,
        );
        const dom =
          doc?.querySelector(`[data-catalog-id="${CSS.escape(group.id)}"]`) ??
          fieldEl?.querySelector(".react-aria-Group");
        const r = dom?.getBoundingClientRect();
        const input = group.children
          .map((id) => root.canvasInputs.get(id))
          .find((c) => ["Input", "DateInput"].includes(root.typeOf(c)));
        const inputBox = input && root.getGeometry([input.id]).get(input.id);
        return {
          field: root.typeOf(field),
          size: field.props.size,
          canvas: box ? [Math.round(box.width), Math.round(box.height)] : null,
          dom: r ? [Math.round(r.width), Math.round(r.height)] : null,
          tag: dom
            ? `${dom.tagName.toLowerCase()}.${[...dom.classList].join(".")}`
            : null,
          role: dom?.getAttribute("role") ?? null,
          fill: group.visual.fill ?? null,
          borderColor: group.visual.borderColor ?? null,
          borderWidth: group.visual.borderWidth ?? null,
          inputHeight: inputBox ? Math.round(inputBox.height) : null,
          domInputHeight: (() => {
            const el = dom?.querySelector(".react-aria-Input, .react-aria-DateInput");
            return el ? Math.round(el.getBoundingClientRect().height) : null;
          })(),
        };
      });
  });
const before = await groups();
const of = (list, type) => list.find((g) => g.field === type);
const same = (g) => JSON.stringify(g?.canvas) === JSON.stringify(g?.dom);
const nf = of(before, "NumberField");
record(
  "L-1 NumberField: the Preview control is RAC's Group (div.react-aria-Group[role=group]) at the Canvas Group box",
  nf?.tag === "div.react-aria-Group" && nf.role === "group" && same(nf),
  { nf },
);
const sf = of(before, "SearchField");
record(
  "L-2 SearchField: the Preview control is RAC's Group with its container class, at the Canvas Group box",
  sf?.tag === "div.react-aria-Group.searchfield-container" &&
    sf.role === "group" &&
    same(sf),
  { sf },
);
const drp = of(before, "DateRangePicker");
record(
  "L-3 DateRangePicker: its Group paints the box on the Canvas (fill · border 1) at the Preview Group box",
  drp?.fill === "var(--bg-inset)" && drp.borderColor === "var(--border)" && drp.borderWidth === 1 && same(drp),
  { drp },
);
// The field's size reaches the parts through the Group.
const nfId = await page.evaluate(() => {
  const ws = window.__COMPOSITION_CATALOG__.workspace;
  return [...ws.root.canvasInputs.values()].find(
    (r) => ws.root.typeOf(r) === "NumberField",
  ).sourceId;
});
const sized = await run(
  (c, ws, at, id) =>
    c.setFields({
      targets: [{ kind: "node", id }],
      props: { size: { kind: "set", value: "lg" } },
    }),
  nfId,
);
await page.waitForTimeout(1000);
const after = of(await groups(), "NumberField");
record(
  "L-4 NumberField size lg reaches the Input through the Group: 42 tall on the Canvas and in the Preview",
  sized.ok && after?.inputHeight === 42 && after.domInputHeight === 42 && same(after),
  { sized, after },
);
await page.screenshot({ path: `${OUT}/fields.png` });
record("L-5 no page errors", errors.length === 0, { errors });
writeFileSync(
  `${OUT}/results.json`,
  JSON.stringify({ results, errors }, null, 2),
);
await browser.close();
process.exit(results.every((r) => r.pass) ? 0 : 1);
