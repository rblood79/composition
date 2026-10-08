// ADR-256 후속 3 · 5 · 7 live (사용자 2026-10-09 「3~7번도 수정해」) — in the real Builder (headed
// Chrome, Compare Mode opens the Preview): L-1 a Select with Selection Mode Multiple keeps two
// options selected in the Preview and its trigger lists both · L-2 detaching a Select with the
// Preview open adds no React update-loop errors · L-3 the palette Checkbox detaches and stays
// checked · L-4 a palette CheckboxGroup's · RadioGroup's items show no selection on the Canvas and
// in the Preview, and every Radio is in the Tab order · L-5 no errors.
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/adr256-followups-357-live.mjs <out>
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
const errorsAt = [];
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
async function addFromPalette(label, match = new RegExp(`^${label}$`, "i")) {
  const search = page.getByLabel("Search components");
  if (!(await search.isVisible().catch(() => false)))
    await page
      .getByRole("button", { name: "Components", exact: true })
      .first()
      .click();
  await search.fill(label);
  await page.waitForTimeout(300);
  await page
    .locator(".list-item", { hasText: match })
    .first()
    .click();
  await page.waitForTimeout(800);
  await page.keyboard.press("Escape");
  // (Close the Components panel: it covers the Preview half in Compare Mode.)
  await page
    .getByRole("button", { name: "Components", exact: true })
    .first()
    .click()
    .catch(() => {});
  await page.waitForTimeout(300);
}
async function compareOn() {
  const button = page
    .getByRole("button", { name: "Compare Mode (Preview + Skia)", exact: true })
    .first();
  if (await button.isVisible().catch(() => false)) await button.click();
  await page.waitForTimeout(3000);
}

const commands = `/@fs${REPO}/packages/shared/src/catalog/commands/index.ts`;
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
/** Run a catalog command in the page: `build(c, ws, find, arg)` returns the command. */
async function run(build, arg) {
  return page.evaluate(
    async ({ commands, build, arg }) => {
      const c = await import(commands);
      const ws = window.__COMPOSITION_CATALOG__.workspace;
      // `find(type, within)` — the first record of `type` (inside the first `within` record).
      const find = (type, within) => {
        const all = [...ws.root.canvasInputs.values()];
        const scope = within
          ? all.find((r) => ws.root.typeOf(r) === within)
          : undefined;
        const inScope = (r) => {
          if (!scope) return true;
          for (let c = r; c; c = ws.root.canvasInputs.get(c.parentId))
            if (c.id === scope.id) return true;
          return false;
        };
        return all.find((r) => ws.root.typeOf(r) === type && inScope(r));
      };
      try {
        ws.execute(
          new Function(
            "c",
            "ws",
            "find",
            "arg",
            `return (${build})(c, ws, find, arg);`,
          )(c, ws, find, arg),
        );
        await new Promise((r) => setTimeout(r, 500));
        return { ok: true };
      } catch (error) {
        return { ok: false, code: error?.code ?? String(error) };
      }
    },
    { commands, build: build.toString(), arg },
  );
}
const preview = (fn, arg) =>
  page.evaluate(
    ({ fn, arg }) => {
      const doc = document.querySelector("#previewFrame")?.contentDocument;
      return new Function("doc", "arg", `return (${fn})(doc, arg);`)(doc, arg);
    },
    { fn: fn.toString(), arg },
  );
const press = async (selector) => {
  await page
    .frameLocator("#previewFrame")
    .locator(selector)
    .first()
    // (Compare Mode shrinks the Preview under the Builder header — RAC's virtual press.)
    .dispatchEvent("click");
  await page.waitForTimeout(800);
};
const closeOverlay = async () => {
  await page.frameLocator("#previewFrame").locator("body").press("Escape");
  await page.waitForTimeout(500);
};



const exec = (build, arg) =>
  page.evaluate(async ({ commands, build, arg }) => {
    const c = await import(commands);
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    try {
      ws.execute(new Function("c", "ws", "arg", `return (${build})(c, ws, arg);`)(c, ws, arg));
      await new Promise((r) => setTimeout(r, 800));
      return { ok: true };
    } catch (error) {
      return { ok: false, code: error?.code ?? String(error) };
    }
  }, { commands, build: build.toString(), arg });
/** The first record of `type` (its source id, record id, props, visual, derived props, hidden). */
const canvas = (type, title) =>
  page.evaluate(({ type, title }) => {
    const root = window.__COMPOSITION_CATALOG__.workspace.root;
    const r = [...root.canvasInputs.values()].find(
      (x) => root.typeOf(x) === type && (title === undefined || x.props.title === title),
    );
    return r && { id: r.id, sourceId: r.sourceId, props: r.props, visual: r.visual, derived: r.derivedProps ?? null, hidden: !!r.hidden };
  }, { type, title });
/** Each section's Canvas panel shown, by its Disclosure's title. */
const canvasPanels = () =>
  page.evaluate(() => {
    const root = window.__COMPOSITION_CATALOG__.workspace.root;
    return Object.fromEntries(
      [...root.canvasInputs.values()]
        .filter((r) => root.typeOf(r) === "DisclosurePanel")
        .map((p) => [String(root.canvasInputs.get(p.parentId).props.title), !p.hidden]),
    );
  });
const domExpanded = () =>
  preview((doc) => [...doc.querySelectorAll(".react-aria-Disclosure")].map((d) => d.hasAttribute("data-expanded")));
const frameEntry = (ws) => ({ kind: "node", id: ws.newId("node"), definitionId: "lib:definition:type-frame", children: [], props: {}, visual: {}, sizing: {}, descendantOverrides: [] });


const recordOf = (type, n = 0) =>
  page.evaluate(({ type, n }) => {
    const root = window.__COMPOSITION_CATALOG__.workspace.root;
    const r = [...root.canvasInputs.values()].filter((x) => root.typeOf(x) === type)[n];
    return r && { id: r.id, sourceId: r.sourceId, props: r.props, displayState: r.displayState ?? null };
  }, { type, n });
const recordsOf = (type) =>
  page.evaluate((type) => {
    const root = window.__COMPOSITION_CATALOG__.workspace.root;
    return [...root.canvasInputs.values()].filter((x) => root.typeOf(x) === type).map((r) => ({ selected: r.props.isSelected === true, displayState: r.displayState ?? null }));
  }, type);
const setOn = (id, props) =>
  exec(
    (c, ws, arg) => c.setFields({ targets: [ws.positionOfRecord(arg.id).target], props: Object.fromEntries(Object.entries(arg.props).map(([k, v]) => [k, { kind: "set", value: v }])) }),
    { id, props },
  );
const loops = () => errors.filter((e) => e.includes("Maximum update depth")).length;

// ── 3 · 5: Select
await newProject(`adr256-followups-357-${Date.now()}`);
await compareOn();
await addFromPalette("select");
await page.waitForTimeout(1500);
const select = await recordOf("Select");
await setOn(select.id, { selectionMode: "multiple" });
await page.waitForTimeout(1500);
await press(".react-aria-Select button");
await press('.react-aria-Popover [role="option"] >> nth=0');
await press('.react-aria-Popover [role="option"] >> nth=1');
const multi = await preview((doc) => ({
  selected: [...doc.querySelectorAll('.react-aria-Popover [role="option"]')].map((o) => o.hasAttribute("data-selected")),
  labels: [...doc.querySelectorAll('.react-aria-Popover [role="option"]')].slice(0, 2).map((o) => o.textContent.trim()),
  value: doc.querySelector(".react-aria-SelectValue")?.textContent ?? "",
}));
record("L-1 Select Multiple: two options selected, the trigger lists both",
  multi.selected[0] === true && multi.selected[1] === true && multi.labels.every((l) => multi.value.includes(l)), multi);
await closeOverlay();
const before = loops();
const detached = await exec((c, ws, id) => c.detachInstances({ ids: [id], newId: ws.newId }), select.sourceId);
await page.waitForTimeout(4000);
const triggerId = await preview((doc) => doc.querySelector(".react-aria-Select button")?.id ?? null);
record("L-2 Select detach with the Preview open: no update loop", detached.ok && loops() === before, { detached, loopsAdded: loops() - before, triggerId });

// ── 7: Checkbox detach · groups
await newProject(`adr256-followups-7-${Date.now()}`);
await compareOn();
await addFromPalette("checkbox");
await page.waitForTimeout(1500);
const box = await recordOf("Checkbox");
const boxDetach = await exec((c, ws, id) => c.detachInstances({ ids: [id], newId: ws.newId }), box.sourceId);
await page.waitForTimeout(1500);
const boxAfter = await page.evaluate((id) => {
  const ws = window.__COMPOSITION_CATALOG__.workspace;
  const e = ws.runtime.graph.getEntry(id);
  return { definitionId: e.definitionId, isSelected: e.props.isSelected ?? null };
}, box.sourceId);
const boxDom = await preview((doc) => doc.querySelector(".react-aria-Checkbox")?.hasAttribute("data-selected") ?? null);
record("L-3 palette Checkbox detaches and stays checked (Canvas · Preview)",
  boxDetach.ok && boxAfter.isSelected?.value === true && boxDom === true, { box: { selected: box.props.isSelected }, boxDetach, boxAfter, boxDom });
await addFromPalette("checkbox group");
await addFromPalette("radio group");
await page.waitForTimeout(2000);
const groupCanvas = { Checkbox: await recordsOf("Checkbox"), Radio: await recordsOf("Radio") };
const groupDom = await preview((doc) => ({
  checkboxes: [...doc.querySelectorAll(".react-aria-CheckboxGroup .react-aria-Checkbox")].map((x) => x.hasAttribute("data-selected")),
  radios: [...doc.querySelectorAll(".react-aria-RadioGroup .react-aria-Radio")].map((x) => x.hasAttribute("data-selected")),
  radioTab: [...doc.querySelectorAll('.react-aria-RadioGroup input[type="radio"]')].map((x) => x.tabIndex),
}));
// (The detached Checkbox above stays checked — the group items are the last ones.)
const groupBoxes = groupCanvas.Checkbox.slice(-groupDom.checkboxes.length);
record("L-4 group items: no selection on the Canvas and in the Preview; every Radio tabbable",
  groupDom.checkboxes.length > 1 && groupDom.radios.length > 1 &&
    [...groupBoxes, ...groupCanvas.Radio].every((r) => !r.selected && r.displayState === null) &&
    [...groupDom.checkboxes, ...groupDom.radios].every((s) => !s) && groupDom.radioTab.every((t) => t === 0),
  { groupCanvas, groupDom });
await page.screenshot({ path: `${OUT}/groups.png` });

record("L-5 no errors", errors.length === 0, errors.slice(0, 6));
writeFileSync(`${OUT}/results.json`, JSON.stringify({ results, errors }, null, 2));
await browser.close();
process.exit(results.every((r) => r.pass) ? 0 : 1);
