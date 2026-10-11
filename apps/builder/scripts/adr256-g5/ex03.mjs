// G5 example 3 — Select: trigger SelectValue + icon · Popover > ListBox with ListBoxSection + Header ·
// items with a Check shown while selected (vanilla DropdownItem) — react-aria.adobe.com Select.
import { canvasVsPreview, diff, edit, launch, newProject, place, press, previewHtml, recordOf, reopen, structure } from "./harness.mjs";
import { closeOverlays, dropAnchors, lastHtml, plus, refMount } from "./helpers-a.mjs";

const OPTIONS = [
  ["Fruit", ["Apple", "Banana", "Orange", "Honeydew", "Grapes", "Watermelon", "Cantaloupe", "Pear"]],
  ["Vegetable", ["Cabbage", "Broccoli", "Carrots", "Lettuce", "Spinach", "Bok Choy", "Cauliflower", "Potatoes"]],
];
const LABEL = "Preferred fruit or vegetable";

const kids = (page, id, type) =>
  page.evaluate(({ id, type }) => {
    const root = window.__COMPOSITION_CATALOG__.workspace.root;
    return root.canvasInputs.get(id).children.filter((k) => !type || root.typeOf(root.canvasInputs.get(k)) === type);
  }, { id, type });
const firstOf = async (page, id, type) => (await kids(page, id, type))[0];
const labelText = (page, itemId) =>
  page.evaluate((itemId) => {
    const root = window.__COMPOSITION_CATALOG__.workspace.root;
    return root.canvasInputs.get(itemId).children.map((k) => root.canvasInputs.get(k)).find((k) => root.typeOf(k) === "Text" && k.props.slot === "label")?.id;
  }, itemId);

/** The reference (vanilla Select expanded; `extra` = Select props). */
const reference = (extra) => new Function("h", "R", "React", `
  const OPTIONS = ${JSON.stringify(OPTIONS)};
  const item = (name) => h(R.ListBoxItem, { key: name, id: name, textValue: name }, ({ isSelected }) =>
    h(React.Fragment, null, isSelected ? h("svg", { "aria-hidden": "true" }) : null, h(R.Text, { slot: "label" }, name)));
  return h(R.Select, ${JSON.stringify(extra)},
    h(R.Label, null, ${JSON.stringify(LABEL)}),
    h(R.Button, null, h(R.SelectValue), h("svg", { "aria-hidden": "true" })),
    h(R.FieldError, null),
    h(R.Popover, null, h(R.ListBox, null, ...OPTIONS.map(([section, names]) =>
      h(R.ListBoxSection, { key: section, id: section }, h(R.Header, null, section), ...names.map(item))))));`);
const pickPopover = (host, doc) => { const all = doc.querySelectorAll(".react-aria-Popover"); return all[all.length - 1]?.outerHTML ?? null; };

async function compare(page, label, previewSide, referenceSide, ignore = []) {
  const p = await structure(page, dropAnchors(previewSide), { ignore });
  const r = await structure(page, referenceSide ?? "", { ignore });
  const d = diff(p, r);
  return { label, structure: d ? { pass: false, d } : { pass: true } };
}

export async function run(page) {
  const edits = [];
  const src = await place(page, "lib:definition:origin-component-select");
  // In the instance a section in the Popover's ListBox takes no item: NESTING_NOT_ALLOWED
  // "ListBoxSection>ListBoxItem" (context.ts nodeAncestorTypes skips the template ListBox · Popover
  // above an owned node in a fillSlot) — probe it, then the Design panel's Detach instance.
  const probe = await (async () => {
    const list0 = await page.evaluate((s) => {
      const root = window.__COMPOSITION_CATALOG__.workspace.root;
      const sel = [...root.canvasInputs.values()].find((r) => r.sourceId === s);
      const find = (id, t) => root.canvasInputs.get(id).children.find((k) => root.typeOf(root.canvasInputs.get(k)) === t);
      return find(find(sel.id, "Popover"), "ListBox");
    }, src);
    const section = await plus(page, list0, "ListBoxSection");
    const sec = (await kids(page, list0, "ListBoxSection"))[0];
    const item = sec ? await plus(page, sec, "ListBoxItem") : null;
    if (sec) await edit(page, (c, ws, h, sec) => c.removeTargets({ targets: [h.target(sec)] }), sec);
    return { section, item };
  })();
  edits.push(await edit(page, (c, ws, h, s) => c.detachInstances({ ids: [s], newId: ws.newId }), src));
  const select = await page.evaluate((s) => [...window.__COMPOSITION_CATALOG__.workspace.root.canvasInputs.values()].find((r) => r.sourceId === s).id, src);
  edits.push(await edit(page, (c, ws, h, id) => [
    h.props(id, { label: "Preferred fruit or vegetable", placeholder: "" }),
    // (detached, the Label part holds its own text — the root prop no longer reaches it)
    ...h.within(id, "Label").map((k) => h.props(k.id, { children: "Preferred fruit or vegetable" })),
  ], select));
  const popover = await firstOf(page, select, "Popover");
  const list = await firstOf(page, popover, "ListBox");
  // The origin's four items out, two sections in (Design "+").
  edits.push(await edit(page, (c, ws, h, list) => h.within(list, "ListBoxItem").map((item) => h.later(() => c.removeTargets({ targets: [h.target(item.id)] }))), list));
  for (const [s, [section, names]] of OPTIONS.entries()) {
    const addedSection = await plus(page, list, "ListBoxSection");
    edits.push(addedSection);
    console.error("section", section, JSON.stringify(addedSection));
    const sec = (await kids(page, list, "ListBoxSection"))[s];
    if (!sec) break;
    // ("+" adds a bare ListBoxSection — its Header is put in.)
    edits.push(await edit(page, (c, ws, h, [sec, section]) => {
      const header = h.within(sec, "Header")[0];
      return header ? h.props(header.id, { children: section }) : h.insert(sec, [h.node(h.newId(), "lib:definition:type-Header", { children: section })], 0);
    }, [sec, section]));
    // ("+" on this new section adds a bare type-ListBoxItem — no label part, no sibling to copy — so
    //  the ListBoxItem original is placed, its `{description}` · `{icon}` parts cleared.)
    const plusItem = await plus(page, sec, "ListBoxItem");
    const bare = await kids(page, sec, "ListBoxItem");
    const bareLabel = bare.length ? !!(await labelText(page, bare[0])) : null;
    if (bare.length) edits.push(await edit(page, (c, ws, h, ids) => ids.map((id) => h.later(() => c.removeTargets({ targets: [h.target(id)] }))), bare));
    console.error("plus item", JSON.stringify(plusItem), "bare label", bareLabel);
    for (const _ of names)
      edits.push(await edit(page, (c, ws, h, sec) => h.insert(sec, [h.node(h.newId(), "lib:definition:origin-component-listbox-item-default")]), sec));
    console.error("items", (await kids(page, sec, "ListBoxItem")).length);
    // (An item original's own children render after its template parts — the reference's Check before
    //  the label needs the item's Detach instance first.)
    const placed = await kids(page, sec, "ListBoxItem");
    edits.push(await edit(page, (c, ws, h, ids) => c.detachInstances({ ids: ids.map((id) => h.get(id).sourceId), newId: ws.newId }), placed));
    const items = await kids(page, sec, "ListBoxItem");
    for (const [i, item] of items.entries()) {
      edits.push(await edit(page, (c, ws, h, [item, label, name]) => [
        h.props(label, { children: name }),
        ...h.within(item, "Text").filter((k) => k.props.slot === "description").map((k) => h.props(k.id, { children: "" })),
        ...h.within(item, "Icon").map((k) => h.later(() => c.removeTargets({ targets: [h.target(k.id)] }))),
        // the reference DropdownItem's Check while selected
        h.insert(item, [{ ...h.node(h.newId(), "lib:definition:type-Icon", { iconName: "check", size: "S" }), showWhen: { all: ["isSelected"] } }], 0),
      ], [item, await labelText(page, item), names[i]]));
    }
  }
  const reopened = await reopen(page);
  const id = await recordOf(page, src);
  const out = [];
  const closed = async (label, extra) => {
    const p = await previewHtml(page, id);
    const r = await refMount(page, reference(extra));
    out.push(await compare(page, label, p, r));
    // (the selected value's Text slot — see the report — set aside to compare the rest)
    if (extra.defaultSelectedKey) out.push(await compare(page, `${label} (slot attrs excluded)`, p, r, ["slot"]));
  };
  const opened = async (label, extra) => {
    await press(page, `[data-catalog-id="${id}"] button`);
    const html = await lastHtml(page, ".react-aria-Popover");
    await closeOverlays(page);
    out.push(await compare(page, label, html, await refMount(page, reference({ ...extra, defaultOpen: true }), { pick: pickPopover })));
  };
  await closed("default closed", {});
  out[out.length - 1].canvas = await canvasVsPreview(page, id);
  await opened("default open", {});
  // selected: press Banana in the Preview's open list
  await press(page, `[data-catalog-id="${id}"] button`);
  const openOptions = await page.frameLocator("#previewFrame").locator(".react-aria-Popover [role=option]").allTextContents();
  out.push({ label: "open option texts", structure: { pass: null, texts: openOptions } });
  await page.frameLocator("#previewFrame").locator(".react-aria-Popover [role=option]", { hasText: "Banana" }).first().dispatchEvent("click", {}, { timeout: 5000 }).catch((e) => out.push({ label: "press Banana", structure: { pass: false, error: String(e).slice(0, 200) } }));
  await page.waitForTimeout(800);
  await closeOverlays(page);
  await closed("selected Banana closed", { defaultSelectedKey: "Banana" });
  await opened("selected Banana open", { defaultSelectedKey: "Banana" });
  // invalid · disabled (Select props)
  edits.push(await edit(page, (c, ws, h, id) => h.props(id, { isInvalid: true }), id));
  await closed("invalid (selected Banana) closed", { defaultSelectedKey: "Banana", isInvalid: true });
  edits.push(await edit(page, (c, ws, h, id) => h.props(id, { isInvalid: false, isDisabled: true }), id));
  await closed("disabled (selected Banana) closed", { defaultSelectedKey: "Banana", isDisabled: true });
  return { probe, edits: edits.filter((e) => !e.ok), editCount: edits.length, reopened, out };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { browser, page, errors } = await launch();
  await newProject(page, `g5-ex03-${Date.now()}`);
  const r = await run(page);
  console.log(JSON.stringify(r, null, 1));
  console.log("errors", JSON.stringify(errors.slice(0, 6)));
  await browser.close();
}
