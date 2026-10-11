// G5 example 4 — Autocomplete (CommandPalette): DialogTrigger > Button + Modal[isDismissable] > Dialog >
// Autocomplete > SearchField[aria-label, no label] + Menu — react-aria.adobe.com Autocomplete.
import { childIds, canvasVsPreview, diff, edit, launch, newProject, place, press, previewHtml, recordOf, reopen, structure } from "./harness.mjs";
import { closeOverlays, dropAnchors, dumpTree, lastHtml, plus, refMount, typeInto, unwrapTrigger } from "./helpers-a.mjs";

const ITEMS = ["News", "Travel", "Shopping", "Business", "Entertainment", "Food", "Technology", "Health", "Science"];

const kids = (page, id, type) =>
  page.evaluate(({ id, type }) => {
    const root = window.__COMPOSITION_CATALOG__.workspace.root;
    return root.canvasInputs.get(id).children.filter((k) => !type || root.typeOf(root.canvasInputs.get(k)) === type);
  }, { id, type });
const labelOf = (page, itemId) =>
  page.evaluate((itemId) => {
    const root = window.__COMPOSITION_CATALOG__.workspace.root;
    return root.canvasInputs.get(itemId).children.map((k) => root.canvasInputs.get(k)).find((k) => root.typeOf(k) === "Text" && k.props.slot === "label")?.id;
  }, itemId);

const reference = (typed) => new Function("h", "R", "React", `
  const ITEMS = ${JSON.stringify(ITEMS)};
  function Palette() {
    const { contains } = R.useFilter({ sensitivity: "base" });
    return h(R.Autocomplete, { filter: contains },
      h(R.SearchField, { autoFocus: true, "aria-label": "Search commands" },
        h("svg", { "aria-hidden": "true" }),
        h(R.Input, { placeholder: "Search commands" }),
        h(R.Button, null, h("svg", { "aria-hidden": "true" })),
        h(R.FieldError, null)),
      h(R.Menu, { renderEmptyState: () => "No results found." },
        ...ITEMS.map((t) => h(R.MenuItem, { key: t, textValue: t }, h(R.Text, { slot: "label" }, t)))));
  }
  return h(R.DialogTrigger, { defaultOpen: true }, h(R.Button, null, "Open Dialog"),
    h(R.Modal, { isDismissable: true }, h(R.Dialog, null, h(Palette))));`);
const pickOverlay = (host, doc) => { const all = doc.querySelectorAll(".react-aria-ModalOverlay"); return all[all.length - 1]?.outerHTML ?? null; };
const typeRef = (value) => new Function("host", "doc", `
  const all = doc.querySelectorAll(".react-aria-ModalOverlay input");
  const input = all[all.length - 1];
  input.focus();
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(input, ${JSON.stringify(value)});
  input.dispatchEvent(new Event("input", { bubbles: true }));`);

async function compare(page, label, previewSide, referenceSide, ignore = []) {
  const p = await structure(page, dropAnchors(previewSide), { ignore });
  const r = await structure(page, referenceSide ?? "", { ignore });
  const d = diff(p, r);
  return { label, structure: d ? { pass: false, d } : { pass: true } };
}

export async function run(page) {
  const edits = [];
  const src = await place(page, "lib:definition:origin-component-dialog");
  // (the origin's footer cannot be deleted in the instance — see ex09: Detach instance)
  edits.push(await edit(page, (c, ws, h, src) => c.detachInstances({ ids: [src], newId: ws.newId }), src));
  const root = await recordOf(page, src);
  const [modal] = await kids(page, root, "Modal");
  const [dialog] = await kids(page, modal, "Dialog");
  edits.push(await edit(page, (c, ws, h, [modal, dialog]) => [
    h.props(modal, { isDismissable: true }),
    ...h.get(dialog).children.map((k) => h.later(() => c.removeTargets({ targets: [h.target(k)] }))),
    h.later(() => h.insert(dialog, [h.node(h.newId(), "lib:definition:origin-component-autocomplete")])),
  ], [modal, dialog]));
  const [auto] = await kids(page, dialog, "Autocomplete");
  const autoSource = await page.evaluate((id) => window.__COMPOSITION_CATALOG__.workspace.root.canvasInputs.get(id).sourceId, auto);
  // The SearchField's name is its aria-label (Attributes axis — an owned node's): Detach instance.
  edits.push(await edit(page, (c, ws, h, s) => c.detachInstances({ ids: [s], newId: ws.newId }), autoSource));
  const [search] = await kids(page, auto, "SearchField");
  const [list] = await kids(page, auto, "ListBox");
  const searchSource = await page.evaluate((id) => window.__COMPOSITION_CATALOG__.workspace.root.canvasInputs.get(id).sourceId, search);
  edits.push(await edit(page, (c, ws, h, [s, search, list, auto]) => [
    h.props(search, { label: "", placeholder: "Search commands", autoFocus: true }),
    h.later(() => c.detachInstances({ ids: [s], newId: ws.newId })),
    h.later(() => c.removeTargets({ targets: [h.target(list)] })),
    h.later(() => h.insert(auto, [h.node(h.newId(), "lib:definition:type-Menu")])),
  ], [searchSource, search, list, auto]));
  const r1 = await edit(page, (c, ws, h, search) => [h.ariaLabel(search, "Search commands")], search);
  edits.push(r1);
  // The reference SearchField has no control wrapper — the SearchField original has none since
  // G5 example 5 (contract 40); an older one's Group is ungrouped (Builder Ungroup).
  const [group] = await kids(page, search, "Group");
  const ungroup = group
    ? await edit(page, (c, ws, h, group) => c.ungroupNodes({ ids: [h.get(group).sourceId], newId: ws.newId }), group)
    : { ok: true, steps: 0, note: "no Group (the reference's SearchField)" };
  const [menu] = await kids(page, auto, "Menu");
  // (The Design "+" on this fresh Menu adds a bare type-MenuItem — no label part, no sibling to copy;
  //  the MenuItem original is placed instead.)
  const plusProbe = await plus(page, menu, "MenuItem");
  const probeItems = await kids(page, menu, "MenuItem");
  const probeLabel = probeItems.length ? await labelOf(page, probeItems[0]) : null;
  if (probeItems.length) edits.push(await edit(page, (c, ws, h, id) => c.removeTargets({ targets: [h.target(id)] }), probeItems[0]));
  for (let i = 0; i < ITEMS.length; i++)
    edits.push(await edit(page, (c, ws, h, menu) => h.insert(menu, [h.node(h.newId(), "lib:definition:origin-component-menu-item-default")]), menu));
  for (const [i, item] of (await kids(page, menu, "MenuItem")).entries())
    edits.push(await edit(page, (c, ws, h, [item, label, t]) => [
      h.props(label, { children: t }),
      // (placed directly, the origin's `{shortcut}` · `{description}` parts show their placeholders — cleared)
      ...h.within(item, "Keyboard").map((k) => h.props(k.id, { children: "" })),
      ...h.within(item, "Text").filter((k) => k.props.slot === "description").map((k) => h.props(k.id, { children: "" })),
    ], [item, await labelOf(page, item), ITEMS[i]]));
  const tree = await dumpTree(page, src);
  const reopened = await reopen(page);
  const id = await recordOf(page, src);
  const out = [];
  out.push({ label: "closed", canvas: await canvasVsPreview(page, id), structure: { pass: null, note: "trigger only (see ex09)" } });
  await press(page, `[data-catalog-id="${(await childIds(page, id))[0]}"]`); // (the trigger has no element — its Button)
  const opened = await lastHtml(page, ".react-aria-ModalOverlay");
  await typeInto(page, ".react-aria-ModalOverlay input", "te");
  await page.waitForTimeout(800);
  const filtered = await lastHtml(page, ".react-aria-ModalOverlay");
  await closeOverlays(page);
  const refOpen = await refMount(page, reference(), { pick: pickOverlay });
  const refTyped = await refMount(page, reference(), { act: typeRef("te"), pick: pickOverlay });
  out.push(await compare(page, "open", opened, refOpen));
  out.push(await compare(page, "open (Dialog name attrs excluded)", opened, refOpen, ["aria-label", "aria-labelledby"]));
  out.push(await compare(page, "typed 'te' (filtered)", filtered, refTyped));
  out.push(await compare(page, "typed 'te' (Dialog name attrs excluded)", filtered, refTyped, ["aria-label", "aria-labelledby"]));
  return { plusProbe: { ...plusProbe, hasLabel: !!probeLabel }, edits: edits.filter((e) => !e.ok), editCount: edits.length, ungroup, reopened, out, tree };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { browser, page, errors } = await launch();
  await newProject(page, `g5-ex04-${Date.now()}`);
  const r = await run(page);
  console.log(JSON.stringify(r, null, 1));
  console.log("errors", JSON.stringify(errors.slice(0, 6)));
  await browser.close();
}
