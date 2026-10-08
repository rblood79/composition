// ADR-256 후속 live — B · C (사용자 2026-10-09 「8~19번 묶어서 수정해」) in the real Builder (headed
// Chrome, Compare Mode opens the Preview): L-1 ProgressBar track · fill corners (Canvas pixels and the
// Preview radius) · L-2 a static ProgressBar's fill · track derived paint · L-3 a Slider snaps to its
// step on Canvas and Preview alike · L-4 a ColorSwatchPicker's first swatch at the picker's origin on
// both · L-5 an expanded Tree item's child row below its row on both · L-6 a Table's header paint and
// separators on both · L-7 a checkbox Tree's bare item has no automatic checkbox · L-8 no errors.
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/adr256-followups-bc-live.mjs <out>
import { chromium } from "playwright";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";

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


const pngjsDir = readdirSync(`${REPO}/node_modules/.pnpm`).find((d) => d.startsWith("pngjs@"));
const { PNG } = createRequire(import.meta.url)(`${REPO}/node_modules/.pnpm/${pngjsDir}/node_modules/pngjs/lib/png.js`);
/** Canvas pixels of scene points (the camera maps scene → canvas element px). */
async function canvasPixels(points) {
  const canvasEl = page.locator("canvas").first();
  const box = await canvasEl.boundingBox();
  const camera = await page.evaluate(() => window.__COMPOSITION_CATALOG__.canvas.camera());
  const png = PNG.sync.read(await canvasEl.screenshot());
  const sx = png.width / box.width;
  return points.map(([x, y]) => {
    const px = Math.round((x * camera.zoom + camera.x) * sx);
    const py = Math.round((y * camera.zoom + camera.y) * sx);
    const i = (py * png.width + px) * 4;
    return [png.data[i], png.data[i + 1], png.data[i + 2]];
  });
}
const bounds = (id) => page.evaluate((id) => window.__COMPOSITION_CATALOG__.canvas.boundsOf(id), id);
const recordOf = (type, n = 0) =>
  page.evaluate(({ type, n }) => {
    const root = window.__COMPOSITION_CATALOG__.workspace.root;
    const r = [...root.canvasInputs.values()].filter((x) => root.typeOf(x) === type)[n];
    return r && { id: r.id, sourceId: r.sourceId, children: r.children, derived: r.derivedProps ?? null, visual: r.visual, props: r.props };
  }, { type, n });
const setOn = (id, props) =>
  exec(
    (c, ws, arg) => c.setFields({ targets: [ws.positionOfRecord(arg.id).target], props: Object.fromEntries(Object.entries(arg.props).map(([k, v]) => [k, { kind: "set", value: v }])) }),
    { id, props },
  );
const insertOrigin = (type) =>
  exec((c, ws, type) => {
    const body = [...ws.root.canvasInputs.values()].find((r) => r.sourceId.endsWith("home-body"));
    const id = ws.newId("node");
    return c.insertNodes({ parent: { kind: "node", id: body.sourceId }, entries: [{ kind: "node", id, definitionId: `lib:definition:origin-component-${type}`, children: [], props: {}, visual: {}, sizing: {}, descendantOverrides: [] }], rootIds: [id], newId: ws.newId });
  }, type);

// ── B
await newProject(`adr256-followups-b-${Date.now()}`);
await compareOn();
await addFromPalette("progress bar");
await page.waitForTimeout(1500);
const track = await recordOf("ProgressBarTrack");
const tb = await bounds(track.id);
// (Magnified ×8 on the track's left end: a 4px radius is 32 screen px.)
await page.evaluate((tb) => window.__COMPOSITION_CATALOG__.canvas.setCamera({ scale: 8, x: 100 - tb.x * 8, y: 100 - tb.y * 8 }), tb);
await page.waitForTimeout(1200);
// (A corner pixel is the page on a rounded track; inside the radius, the fill's paint.)
const [corner, middle] = await canvasPixels([
  [tb.x + 0.3, tb.y + 0.3],
  [tb.x + 4, tb.y + tb.height / 2],
]);
const domBar = await preview((doc) => getComputedStyle(doc.querySelector(".react-aria-ProgressBar .bar")).borderTopLeftRadius);
const same = (a, b) => a.every((v, i) => Math.abs(v - b[i]) <= 12);
record(
  "L-1 ProgressBar track corner: Canvas corner pixel is the page (rounded) · middle is the track · Preview .bar radius > 0",
  // (The page body is white: the rounded corner shows it; inside the radius, the fill.)
  same(corner, [255, 255, 255]) && !same(middle, [255, 255, 255]) && parseFloat(domBar) > 0,
  { track: tb, corner, middle, domBar },
);
errorsAt.push(["L-1", errors.length]);

const bar = await recordOf("ProgressBar");
const r2 = await setOn(bar.id, { staticColor: "white" });
await page.waitForTimeout(1200);
const fill2 = await recordOf("ProgressBarFill");
const track2 = await recordOf("ProgressBarTrack");
const domStatic = await preview((doc) => {
  const root = doc.querySelector(".react-aria-ProgressBar");
  return { attr: root.getAttribute("data-static-color"), fill: getComputedStyle(root.querySelector(".fill")).backgroundColor };
});
record(
  "L-2 static white ProgressBar: Canvas fill · track take staticColor · Preview fill is white",
  r2.ok && fill2.derived?.staticColor === "white" && track2.derived?.staticColor === "white" && /255, 255, 255/.test(domStatic.fill),
  { fill: fill2.derived, track: track2.derived, domStatic },
);
errorsAt.push(["L-2", errors.length]);

await addFromPalette("slider");
await page.waitForTimeout(1500);
const slider = await recordOf("Slider");
const r3 = await setOn(slider.id, { value: 26, step: 10, minValue: 0, maxValue: 100 });
await page.waitForTimeout(1500);
const sf = await recordOf("SliderFill");
const st = await recordOf("SliderTrack");
const fb = await bounds(sf.id);
const tb3 = await bounds(st.id);
const domSlider = await preview((doc) => {
  const s = doc.querySelector(".react-aria-Slider");
  const fill = s.querySelector(".react-aria-SliderFill") ?? s.querySelector("[class*=fill]");
  const trackEl = s.querySelector(".react-aria-SliderTrack");
  const out = s.querySelector(".react-aria-SliderOutput");
  return { ratio: fill && trackEl ? fill.getBoundingClientRect().width / trackEl.getBoundingClientRect().width : null, output: out?.textContent };
});
const canvasRatio = fb.width / tb3.width;
record(
  "L-3 Slider value 26 · step 10: Canvas fill 30% = Preview fill 30% · output 30",
  r3.ok && Math.abs(canvasRatio - 0.3) < 0.02 && Math.abs((domSlider.ratio ?? 0) - 0.3) < 0.02 && domSlider.output === "30",
  { canvasRatio, domSlider },
);
errorsAt.push(["L-3", errors.length]);

const r4 = await insertOrigin("colorswatchpicker");
await page.waitForTimeout(1500);
const picker = await recordOf("ColorSwatchPicker");
const pb = await bounds(picker.id);
const ib = await bounds(picker.children[0]);
const domPicker = await preview((doc) => {
  const p = doc.querySelector(".react-aria-ColorSwatchPicker");
  const first = p.querySelector(".react-aria-ColorSwatchPickerItem");
  const a = p.getBoundingClientRect(), b = first.getBoundingClientRect();
  return { dx: b.x - a.x, dy: b.y - a.y, border: getComputedStyle(p).borderTopWidth };
});
record(
  "L-4 ColorSwatchPicker: first swatch at the picker's origin on the Canvas (no 1px border) as in the Preview",
  r4.ok && ib.x - pb.x === domPicker.dx && ib.y - pb.y === domPicker.dy,
  { canvas: { dx: ib.x - pb.x, dy: ib.y - pb.y }, domPicker },
);
errorsAt.push(["L-4", errors.length]);

// ── C
await newProject(`adr256-followups-c-${Date.now()}`);
await compareOn();
await addFromPalette("Tree");
await page.waitForTimeout(1500);
const tree = await recordOf("Tree");
const r5 = await setOn(tree.id, { expandedKeys: ["item-1"] });
await page.waitForTimeout(1500);
const rows5 = await page.evaluate(() => {
  const root = window.__COMPOSITION_CATALOG__.workspace.root;
  const canvas = window.__COMPOSITION_CATALOG__.canvas;
  const tree = [...root.canvasInputs.values()].find((r) => root.typeOf(r) === "Tree");
  const t = canvas.boundsOf(tree.id);
  const contents = [...root.canvasInputs.values()].filter((r) => root.typeOf(r) === "TreeItemContent" && !r.hidden);
  return contents.map((c) => { const b = canvas.boundsOf(c.id); return [Math.round(b.x - t.x), Math.round(b.y - t.y)]; }).sort((a, b) => a[1] - b[1]);
});
const domRows5 = await preview((doc) => {
  const t = doc.querySelector(".react-aria-Tree").getBoundingClientRect();
  return [...doc.querySelectorAll(".react-aria-TreeItem")].map((r) => { const b = r.getBoundingClientRect(); return [Math.round(b.x - t.x), Math.round(b.y - t.y)]; });
});
record(
  "L-5 expanded Tree: each row's (x, y) in the tree — Canvas = Preview (±1), child row below its parent",
  r5.ok && rows5.length === domRows5.length && rows5.length >= 3 && rows5.every((r, i) => Math.abs(r[0] - domRows5[i][0]) <= 1 && Math.abs(r[1] - domRows5[i][1]) <= 1),
  { canvas: rows5, dom: domRows5 },
);
errorsAt.push(["L-5", errors.length]);

const r7 = await exec((c, ws, id) => {
  const bare = ws.newId("node");
  return c.insertNodes({ parent: ws.positionOfRecord(id).target, entries: [{ kind: "node", id: bare, definitionId: "lib:definition:type-TreeItem", children: [], props: { children: { kind: "set", value: "Bare" } }, visual: {}, sizing: {}, descendantOverrides: [] }], rootIds: [bare], newId: ws.newId });
}, tree.id);
await setOn(tree.id, { selectionStyle: "checkbox", selectionMode: "multiple" });
await page.waitForTimeout(1500);
const checks = await preview((doc) => ({ bare: [...doc.querySelectorAll(".react-aria-TreeItem")].some((r) => r.textContent.includes("Bare")), checkboxes: doc.querySelectorAll('[slot="selection"]').length }));
record("L-7 checkbox Tree: the bare item shows · no automatic selection checkbox", r7.ok && checks.bare && checks.checkboxes === 0, checks);
errorsAt.push(["L-7", errors.length]);

await addFromPalette("table");
await page.waitForTimeout(1500);
const t6 = await page.evaluate(async (commands) => {
  const c = await import(commands);
  const ws = window.__COMPOSITION_CATALOG__.workspace;
  const root = ws.root;
  const of = (type) => [...root.canvasInputs.values()].find((r) => root.typeOf(r) === type);
  const entry = (type) => ({ kind: "node", id: ws.newId("node"), definitionId: `lib:definition:type-${type}`, children: [], props: type === "Cell" ? { children: { kind: "set", value: "x" } } : {}, visual: {}, sizing: {}, descendantOverrides: [] });
  ws.execute(c.insertTableColumns({ header: ws.positionOfRecord(of("TableHeader").id).target, buildColumn: () => { const col = { ...entry("Column"), props: { children: { kind: "set", value: "Name" } } }; return { entries: [col], rootId: col.id }; }, buildCell: () => { const cell = entry("Cell"); return { entries: [cell], rootId: cell.id }; }, newId: ws.newId }));
  ws.execute(c.insertTableRow({ body: ws.positionOfRecord(of("TableBody").id).target, buildRow: (n) => { const cells = Array.from({ length: n }, () => entry("Cell")); const row = { ...entry("Row"), children: cells.map((x) => x.id) }; return { entries: [row, ...cells], rootId: row.id }; }, newId: ws.newId }));
  await new Promise((r) => setTimeout(r, 800));
  const header = of("TableHeader"), row = of("Row");
  return { header: header.visual.fill, row: [row.visual.borderBottomWidth, row.visual.borderColor], rowId: row.id, headerId: header.id };
}, commands);
await page.waitForTimeout(1200);
const domTable = await preview((doc) => {
  const header = doc.querySelector(".react-aria-Table .react-aria-TableHeader");
  const row = doc.querySelector(".react-aria-Table tbody .react-aria-Row");
  return { header: getComputedStyle(header).backgroundColor, row: [getComputedStyle(row).borderBottomWidth, getComputedStyle(row).borderBottomStyle] };
});
const hb = await bounds(t6.headerId);
const [headerPixel, pagePixel] = await canvasPixels([[hb.x + 4, hb.y + hb.height / 2], [hb.x - 6, hb.y + hb.height / 2]]);
record(
  "L-6 Table: header on --bg-raised and a 1px line under each row — Canvas record and pixels · Preview computed",
  t6.header === "var(--bg-raised)" && t6.row[0] === 1 && domTable.header !== "rgba(0, 0, 0, 0)" && domTable.row[0] === "1px" && domTable.row[1] === "solid" && !same(headerPixel, pagePixel),
  { canvas: t6, domTable, headerPixel, pagePixel },
);
errorsAt.push(["L-6", errors.length]);
await page.screenshot({ path: `${OUT}/c-series.png` });
record("L-8 no page errors", errors.length === 0, { errorsAt, errors: errors.slice(0, 3) });
writeFileSync(`${OUT}/results.json`, JSON.stringify({ results, errors }, null, 2));
await browser.close();
process.exit(results.every((r) => r.pass) ? 0 : 1);
