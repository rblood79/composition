// G5 example 14 — ProgressBar vanilla (react-aria.adobe.com ProgressBar.md): ProgressBar > Label +
// span.value {valueText} + div.track > div.fill (width {percentage}%). States: value 30 · 100 ·
// indeterminate. The value text and fill width are template bindings (Decision 12) — also checked.
import { edit, launch, newProject, place, reopen } from "./harness.mjs";
import { compareCase, summarize } from "./helpers-b.mjs";

const CASES = [
  ["ProgressBar 30", { label: "Loading", value: 30 }],
  ["ProgressBar 100", { label: "Loading", value: 100 }],
  ["ProgressBar indeterminate", { label: "Loading", isIndeterminate: true }],
];

const reference = (state) =>
  `(h, R) => h(R.ProgressBar, ${JSON.stringify(state)}, ({ percentage, valueText, isIndeterminate }) => [
    h(R.Label, { key: "l" }, "Loading"),
    h("span", { key: "v", className: "value" }, valueText),
    h("div", { key: "t", className: "track inset" },
      h("div", { className: "fill", style: { width: (isIndeterminate ? 100 : percentage) + "%" } })),
  ])`;

const previewFrame = (page) => page.frames().find((f) => f.url().includes("preview.html"));

export async function run(page) {
  const placed = [];
  for (const _ of CASES) placed.push(await place(page, "lib:definition:origin-component-progressbar"));
  const edits = [];
  for (let i = 0; i < CASES.length; i++)
    edits.push(await edit(page, (c, ws, h, [source, props]) => h.props(h.bySource(source).id, props), [placed[i], CASES[i][1]]));
  const reopened = await reopen(page);
  const out = [];
  for (let i = 0; i < CASES.length; i++) {
    const p = await page.evaluate((source) => {
      const r = [...window.__COMPOSITION_CATALOG__.workspace.root.canvasInputs.values()].find((x) => x.sourceId === source);
      return { value: r.props.value, minValue: r.props.minValue, maxValue: r.props.maxValue, isIndeterminate: r.props.isIndeterminate };
    }, placed[i]);
    const state = Object.fromEntries(Object.entries(p).filter(([, v]) => v !== undefined && v !== null));
    const row = await compareCase(page, CASES[i][0], placed[i], reference(state));
    // Decision 12: the Preview's value text and fill width (RAC's values) and the Canvas records'.
    const id = (await page.evaluate((s) => [...window.__COMPOSITION_CATALOG__.workspace.root.canvasInputs.values()].find((x) => x.sourceId === s).id, placed[i]));
    row.values = {
      dom: await previewFrame(page).evaluate((id) => {
        const el = document.querySelector(`[data-catalog-id="${CSS.escape(id)}"]`);
        return { text: el.querySelector(".value")?.textContent ?? null, fill: el.querySelector(".fill")?.style.width ?? null };
      }, id),
      canvas: await page.evaluate((id) => {
        const root = window.__COMPOSITION_CATALOG__.workspace.root;
        const all = [];
        const visit = (rid) => { const r = root.canvasInputs.get(rid); all.push(r); r.children.forEach(visit); };
        visit(id);
        const v = all.find((r) => root.typeOf(r) === "ProgressBarValue");
        const f = all.find((r) => root.typeOf(r) === "ProgressBarFill");
        return { text: v?.props.children ?? null, hidden: v?.hidden ?? null, fill: f?.visual.width ?? null };
      }, id),
    };
    row.state = state;
    out.push(row);
  }
  return { edits, reopened, out };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { browser, page, errors } = await launch();
  await newProject(page, `g5-ex14-${Date.now()}`);
  const r = await run(page);
  console.log(summarize("ex14", r, errors));
  console.log(JSON.stringify(r.out.map((o) => [o.label, o.state, o.values])));
  await browser.close();
}
