// G5 example 12 — Slider vanilla (react-aria.adobe.com Slider.md): Slider > Label + SliderOutput +
// SliderTrack > (div.track > SliderFill) + SliderThumb. States: default (value 30) · disabled · the
// SliderOutput moved below the track (G0 ⑥ procedure — the instance detached first: Layers moves
// owned nodes only, `layerTree.ts` catalogLayerDropCommand). Vertical: S2 Slider takes no
// `orientation` (Slider.binding accepts) — not reachable.
import { edit, launch, newProject, place, reopen } from "./harness.mjs";
import { compareCase, summarize } from "./helpers-b.mjs";

const CASES = [
  ["Slider default", { label: "Volume", value: 30 }],
  ["Slider disabled", { label: "Volume", value: 30, isDisabled: true }],
  ["Slider output moved", { label: "Volume", value: 30 }],
];

const reference = (state, outputLast) => {
  const output = `h(R.SliderOutput)`;
  const track = `h(R.SliderTrack, { children: () => [h("div", { key: "t", className: "track inset" }, h(R.SliderFill)), h(R.SliderThumb, { key: "0", index: 0 })] })`;
  return `(h, R) => h(R.Slider, ${JSON.stringify(state)}, h(R.Label, null, "Volume"), ${outputLast ? `${track}, ${output}` : `${output}, ${track}`})`;
};

export async function run(page) {
  const placed = [];
  for (const _ of CASES) placed.push(await place(page, "lib:definition:origin-component-slider"));
  const edits = [];
  for (let i = 0; i < CASES.length; i++)
    edits.push(await edit(page, (c, ws, h, [source, props]) => h.props(h.bySource(source).id, props), [placed[i], CASES[i][1]]));
  // The reference's `div.track` around the fill is a frame the author wraps it in (breakdown Phase 7c
  // 「작성자가 Frame 으로 끼울 자리 (G5 에서 그 조립으로 확인)」): detach (owned parts), then Group
  // (canvasMenu.ts — a type-frame) around the SliderFill.
  for (const source of placed) {
    edits.push(await edit(page, (c, ws, h, source) => c.detachInstances({ ids: [h.bySource(source).sourceId], newId: ws.newId }), source));
    edits.push(await edit(page, (c, ws, h, source) => {
      const fill = h.within(h.bySource(source).id, "SliderFill")[0];
      return c.groupNodes({ ids: [fill.sourceId], group: h.node(h.newId(), "lib:definition:type-frame"), newId: ws.newId, label: "Group" });
    }, source));
  }
  // Then move the SliderOutput after the SliderTrack (Layers drop = moveNodes).
  edits.push(await edit(page, (c, ws, h, source) => {
    const slider = h.bySource(source);
    const output = h.within(slider.id, "SliderOutput")[0];
    return c.moveNodes({ ids: [output.sourceId], parent: { kind: "node", id: slider.sourceId }, newId: ws.newId, label: "Move" });
  }, placed[2]));
  const reopened = await reopen(page);
  const out = [];
  for (let i = 0; i < CASES.length; i++) {
    const p = await page.evaluate((source) => {
      const r = [...window.__COMPOSITION_CATALOG__.workspace.root.canvasInputs.values()].find((x) => x.sourceId === source);
      return { minValue: r.props.minValue, maxValue: r.props.maxValue, step: r.props.step, value: r.props.value, isDisabled: r.props.isDisabled };
    }, placed[i]);
    const state = Object.fromEntries(Object.entries({ defaultValue: p.value, minValue: p.minValue, maxValue: p.maxValue, step: p.step, isDisabled: p.isDisabled }).filter(([, v]) => v !== undefined && v !== null));
    out.push({ ...(await compareCase(page, CASES[i][0], placed[i], reference(state, i === 2))), state });
  }
  const order = await page.evaluate((source) => {
    const root = window.__COMPOSITION_CATALOG__.workspace.root;
    const r = [...root.canvasInputs.values()].find((x) => x.sourceId === source);
    return r.children.map((k) => root.typeOf(root.canvasInputs.get(k)));
  }, placed[2]);
  return { edits, reopened, out, order };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { browser, page, errors } = await launch();
  await newProject(page, `g5-ex12-${Date.now()}`);
  const r = await run(page);
  console.log(summarize("ex12", r, errors));
  console.log("states", JSON.stringify(r.out.map((o) => o.state)), "moved order", JSON.stringify(r.order));
  await browser.close();
}
