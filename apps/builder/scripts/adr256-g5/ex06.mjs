// G5 example 6 — NumberField vanilla (react-aria.adobe.com NumberField.md): Label + Group (Input +
// Button[decrement] + Button[increment]) + FieldError. States: default · disabled · at its minimum
// (decrement disabled) · the increment Button swapped for another Button original (G0 ⑥ procedure).
import { edit, launch, newProject, place, reopen } from "./harness.mjs";
import { compareCase, summarize } from "./helpers-b.mjs";

const CASES = [
  ["NumberField default", { label: "Width", description: "" }],
  ["NumberField disabled", { label: "Width", description: "", isDisabled: true }],
  ["NumberField at minimum", { label: "Width", description: "", minValue: 0, value: "0" }],
  ["NumberField increment swapped", { label: "Width", description: "" }],
];

const reference = (state) =>
  `(h, R) => h(R.NumberField, ${JSON.stringify(state)},
    h(R.Label, null, "Width"),
    h(R.Group, null,
      h(R.Input),
      h(R.Button, { slot: "decrement" }, h("svg", { "aria-hidden": "true" })),
      h(R.Button, { slot: "increment" }, h("svg", { "aria-hidden": "true" }))),
    h(R.FieldError))`;

export async function run(page) {
  const placed = [];
  for (const _ of CASES) placed.push(await place(page, "lib:definition:origin-component-numberfield"));
  const edits = [];
  for (let i = 0; i < CASES.length; i++)
    edits.push(await edit(page, (c, ws, h, [source, props]) => h.props(h.bySource(source).id, props), [placed[i], CASES[i][1]]));
  // The swap: a new Button original (slot increment · plus Icon) after the old one, then the old one out.
  edits.push(await edit(page, (c, ws, h, source) => {
    const field = h.bySource(source);
    const group = h.within(field.id, "Group")[0];
    const button = h.newId();
    const icon = h.newId();
    return [
      c.insertNodes({
        parent: h.target(group.id),
        entries: [
          { ...h.node(button, "lib:definition:origin-component-button", { slot: "increment", variant: "secondary", children: "" }), children: [icon] },
          h.node(icon, "lib:definition:type-Icon", { iconName: "plus" }),
        ],
        rootIds: [button],
        newId: ws.newId,
      }),
      // (Found again after the insert: the first child into the instance's Group copies its template
      //  children to owned nodes — the old Button's record id changes.)
      h.later(() => {
        const group = h.within(h.bySource(source).id, "Group")[0];
        const stale = h.within(group.id, "Button").find((b) => b.props.slot === "increment" && b.sourceId !== button);
        return c.removeTargets({ targets: [h.target(stale.id)] });
      }),
    ];
  }, placed[3]));
  // (Probe: any child into the instance's Group — Decision 3 free content.)
  edits.push(await edit(page, (c, ws, h, source) => {
    const group = h.within(h.bySource(source).id, "Group")[0];
    return h.insert(group.id, [h.node(h.newId(), "lib:definition:text", { children: "note" })]);
  }, placed[3]));
  const reopened = await reopen(page);
  const out = [];
  for (let i = 0; i < CASES.length; i++) {
    // (The reference gets the document's range — the field's minValue · value as written.)
    const props = await page.evaluate((source) => {
      const r = [...window.__COMPOSITION_CATALOG__.workspace.root.canvasInputs.values()].find((x) => x.sourceId === source);
      return { minValue: r.props.minValue, maxValue: r.props.maxValue, value: r.props.value, isDisabled: r.props.isDisabled };
    }, placed[i]);
    const state = Object.fromEntries(
      Object.entries({ minValue: props.minValue, maxValue: props.maxValue, defaultValue: props.value === undefined || props.value === "" ? undefined : Number(props.value), isDisabled: props.isDisabled })
        .filter(([, v]) => v !== undefined && v !== null && v !== ""),
    );
    out.push({ ...(await compareCase(page, CASES[i][0], placed[i], reference(state))), state });
  }
  const tree = await page.evaluate((source) => {
    const root = window.__COMPOSITION_CATALOG__.workspace.root;
    const field = [...root.canvasInputs.values()].find((x) => x.sourceId === source);
    const group = field.children.map((k) => root.canvasInputs.get(k)).find((r) => root.typeOf(r) === "Group");
    return group.children.map((k) => { const r = root.canvasInputs.get(k); return `${root.typeOf(r)}${r.props.slot ? "[" + r.props.slot + "]" : ""}`; });
  }, placed[3]);
  return { edits, reopened, out, swapTree: tree };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { browser, page, errors } = await launch();
  await newProject(page, `g5-ex06-${Date.now()}`);
  const r = await run(page);
  console.log(summarize("ex06", r, errors));
  console.log("states", JSON.stringify(r.out.map((o) => o.state)), "swapTree", JSON.stringify(r.swapTree));
  await browser.close();
}
