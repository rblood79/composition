// G5 example 8 — Tabs (react-aria.adobe.com Tabs.md L424-478): `Tabs > div(TabList[Dynamic tabs] >
// Tab × 3 (text + SelectionIndicator) + div.button-group(Button[Add tab] + Button[Remove tab])) +
// TabPanels > TabPanel × 3`. Builder: Tabs original → detach → "+" a third Tab (with its panel) →
// panels' text → TabList into a frame with two icon Buttons → the list's name. States: default ·
// the second tab selected (pressed in the Preview and in the reference) · vertical.
import { edit, place, press, reopen } from "./harness.mjs";
import { compareCase, main, plus, tree } from "./helpers-c.mjs";

const reference = (orientation) =>
  `(h, R) => h(R.Tabs, { orientation: "${orientation}" },
    h("div", null,
      h(R.TabList, { "aria-label": "Dynamic tabs" },
        ...[1, 2, 3].map((n) => h(R.Tab, { key: n, id: "t" + n }, h("span", null, "Tab " + n), h(R.SelectionIndicator)))),
      h("div", null,
        h(R.Button, { "aria-label": "Add tab" }, h("svg", { "aria-hidden": "true" })),
        h(R.Button, { "aria-label": "Remove tab" }, h("svg", { "aria-hidden": "true" })))),
    h(R.TabPanels, null,
      ...[1, 2, 3].map((n) => h(R.TabPanel, { key: n, id: "t" + n }, h("span", null, "Tab body " + n)))))`;

export async function run(page, errors = []) {
  const edits = [];
  const mark = (label) => edits.push({ mark: label, errors: errors.length });
  const T = await place(page, "lib:definition:origin-component-tabs");
  edits.push(await edit(page, (c, ws, h, T) => c.detachInstances({ ids: [T], newId: ws.newId }), T));
  const afterDetach = await tree(page, T);
  edits.push(await plus(page, `(root) => [...root.canvasInputs.values()].find((r) => root.typeOf(r) === "TabList").id`, "Tab"));
  // (Defect: after "+" the template's order-paired panels lose their Tab — `presence.ts`
  // `catalogTabsSelection` pairs by `itemId` once any panel has one. The author's workaround in
  // Properties: key the first two Tabs (`id`) and their panels (`itemId`).)
  const afterPlus = await tree(page, T);
  mark("before id workaround");
  edits.push(
    await edit(page, (c, ws, h, T) => {
      const tabs = h.bySource(T);
      const tabItems = h.within(tabs.id, "Tab");
      const panels = h.within(tabs.id, "TabPanel");
      return [0, 1].flatMap((i) => [h.props(tabItems[i].id, { id: "tab-" + (i + 1) }), h.props(panels[i].id, { itemId: "tab-" + (i + 1) })]);
    }, T),
  );
  mark("after id workaround");
  // Panels' text · the list's name · TabList into a frame with two icon Buttons.
  edits.push(
    await edit(page, (c, ws, h, T) => {
      const tabs = h.bySource(T);
      const steps = [];
      h.within(tabs.id, "TabPanel").forEach((panel, i) =>
        steps.push(h.insert(panel.id, [h.node(h.newId(), "lib:definition:text", { children: `Tab body ${i + 1}` })])),
      );
      const list = h.within(tabs.id, "TabList")[0];
      steps.push(h.ariaLabel(list.id, "Dynamic tabs"));
      const row = h.newId();
      steps.push(c.groupNodes({ ids: [list.sourceId], group: h.node(row, "lib:definition:type-frame"), newId: ws.newId }));
      steps.push(
        h.later(() => {
          const frame = ws.root.canvasInputs.get([...ws.root.canvasInputs.keys()].find((k) => ws.root.canvasInputs.get(k).sourceId === row));
          const group = h.newId(), add = h.newId(), remove = h.newId(), i1 = h.newId(), i2 = h.newId();
          const g = h.node(group, "lib:definition:type-frame");
          g.children = [add, remove];
          const a = h.node(add, "lib:definition:type-Button", { children: "" });
          a.children = [i1];
          const r = h.node(remove, "lib:definition:type-Button", { children: "" });
          r.children = [i2];
          return c.insertNodes({
            parent: h.target(frame.id),
            entries: [g, a, r, h.node(i1, "lib:definition:type-Icon", { iconName: "plus" }), h.node(i2, "lib:definition:type-Icon", { iconName: "minus" })],
            rootIds: [group],
            newId: ws.newId,
          });
        }),
      );
      steps.push(
        h.later(() => {
          const buttons = h.within(tabs.id, "Button");
          return c.setNodeAttribute({ id: buttons[0].sourceId, field: "ariaLabel", value: "Add tab" });
        }),
      );
      steps.push(
        h.later(() => {
          const buttons = h.within(tabs.id, "Button");
          return c.setNodeAttribute({ id: buttons[1].sourceId, field: "ariaLabel", value: "Remove tab" });
        }),
      );
      return steps;
    }, T),
  );
  const reopened = await reopen(page);
  const out = [];
  const atDefault = await tree(page, T);
  out.push(await compareCase(page, T, "default", reference("horizontal"), { full: true }));
  // The second tab selected: pressed in the Preview, and in the reference.
  await press(page, '[role="tab"]:nth-child(2)');
  out.push(
    await compareCase(page, T, "second tab pressed", reference("horizontal"), {
      act: `async (host) => { host.querySelectorAll('[role="tab"]')[1].dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, pointerType: "mouse", button: 0 })); host.querySelectorAll('[role="tab"]')[1].dispatchEvent(new PointerEvent("pointerup", { bubbles: true, pointerType: "mouse", button: 0 })); host.querySelectorAll('[role="tab"]')[1].click(); }`,
      noCanvas: true,
      full: true,
    }),
  );
  edits.push(await edit(page, (c, ws, h, T) => h.props(h.bySource(T).id, { orientation: "vertical" }), T));
  // (Reopened — the Preview's pressed selection is run state; the vertical case starts from the document's.)
  await reopen(page);
  out.push(await compareCase(page, T, "vertical (reopened)", reference("vertical")));
  return { edits, reopened, out, afterDetach, afterPlus, atDefault };
}

if (import.meta.url === `file://${process.argv[1]}`) await main("ex08", run);
