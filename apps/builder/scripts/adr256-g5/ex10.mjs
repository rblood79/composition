// G5 example 10 — GridList (react-aria.adobe.com GridList.md L565-822 + the vanilla GridListItem /
// Checkbox, L67-131 · Checkbox.md L9-55): `GridList[Nature photos, multiple, grid] > GridListItem >
// (Checkbox[slot=selection] + img + Text + Text[description])`. Builder: GridList original → the
// list's name · multiple → each item: an Image, the title · "By <user>" texts, a Checkbox original
// with slot `selection` first. States: default · multiple selection (two items pressed).
import { edit, place, press, reopen } from "./harness.mjs";
import { compareCase, KNOWN, main, tree } from "./helpers-c.mjs";

const ITEMS = [
  ["A Ficus Lyrata Leaf", "Clay Banks"],
  ["Italian beach", "Alan Bajura"],
  ["Forest road", "Artem Stoliar"],
];

const reference = `(h, R) => h(R.GridList, { "aria-label": "Nature photos", selectionMode: "multiple", layout: "grid" },
  ...${JSON.stringify(ITEMS)}.map(([title, user], i) => h(R.GridListItem, { key: i, id: "i" + i, textValue: title },
    h(R.CheckboxField, { slot: "selection" },
      h(R.CheckboxButton, null,
        h("div", { className: "indicator" }, h("svg", { viewBox: "0 0 18 18", "aria-hidden": "true" }, h("polyline", { points: "2 9 7 14 16 4" }))))),
    h("img", { alt: "" }),
    h(R.Text, null, title),
    h(R.Text, { slot: "description" }, "By " + user))))`;

export async function run(page, errors = []) {
  const edits = [];
  const G = await place(page, "lib:definition:origin-component-gridlist");
  edits.push(
    await edit(page, (c, ws, h, [G, ITEMS]) => {
      const list = h.bySource(G);
      const steps = [h.ariaLabel(list.id, "Nature photos"), h.props(list.id, { selectionMode: "multiple", layout: "grid" })];
      h.within(list.id, "GridListItem").forEach((item, i) => {
        const texts = h.within(item.id, "Text");
        const label = texts.find((t) => t.props.slot !== "description");
        const description = texts.find((t) => t.props.slot === "description");
        steps.push(h.props(label.id, { children: ITEMS[i][0] }));
        steps.push(h.props(description.id, { children: "By " + ITEMS[i][1] }));
        steps.push(h.insert(item.id, [h.node(h.newId(), "lib:definition:type-Image")], 0));
        steps.push(h.insert(item.id, [h.node(h.newId(), "lib:definition:origin-component-checkbox", { children: "", slot: "selection" })], 0));
      });
      return steps;
    }, [G, ITEMS]),
  );
  const reopened = await reopen(page);
  const atDefault = await tree(page, G);
  const out = [];
  out.push(await compareCase(page, G, "default", reference, { full: true, known: [KNOWN.image, KNOWN.checkGlyph] }));
  // Multiple selection: the first and third items' selection checkboxes pressed.
  await press(page, '[role="row"]:nth-child(1) input[type="checkbox"]');
  await press(page, '[role="row"]:nth-child(3) input[type="checkbox"]');
  out.push(
    await compareCase(page, G, "two selected (pressed)", reference, {
      noCanvas: true,
      known: [KNOWN.image, KNOWN.checkGlyph],
      full: true,
      act: `async (host) => { for (const i of [0, 2]) { host.querySelectorAll('[role="row"] input[type="checkbox"]')[i].click(); await new Promise((r) => setTimeout(r, 100)); } }`,
    }),
  );
  return { edits, reopened, out, atDefault };
}

if (import.meta.url === `file://${process.argv[1]}`) await main("ex10", run);
