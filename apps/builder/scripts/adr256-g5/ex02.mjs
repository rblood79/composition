// G5 example 2 — Menu: (a) Text slots + Keyboard · (b) Submenus · (c) Separators (react-aria.adobe.com Menu).
import { canvasVsPreview, diff, edit, launch, newProject, place, press, previewHtml, recordOf, reopen, structure } from "./harness.mjs";
import { closeOverlays, dropAnchors, lastHtml, plus, refMount, unwrapTrigger } from "./helpers-a.mjs";

const SLOTS = [["Copy", "Copy the selected text", "⌘C"], ["Cut", "Cut the selected text", "⌘X"], ["Paste", "Paste the copied text", "⌘V"]];
const SEPARATED = ["New…", "Open…", "Save", "Save as…", "Rename…", "Page setup…", "Print…"];

/** Record ids of a menu tree under a placed MenuTrigger (by source). */
const menuOf = (page, source) =>
  page.evaluate((source) => {
    const root = window.__COMPOSITION_CATALOG__.workspace.root;
    const rec = [...root.canvasInputs.values()].find((r) => r.sourceId === source);
    const kids = (id) => root.canvasInputs.get(id).children.map((k) => root.canvasInputs.get(k));
    const find = (id, type) => kids(id).find((k) => root.typeOf(k) === type);
    const popover = find(rec.id, "Popover");
    const menu = find(popover.id, "Menu");
    return { root: rec.id, button: find(rec.id, "Button").id, menu: menu.id };
  }, source);

const labelOf = (page, itemId) =>
  page.evaluate((itemId) => {
    const root = window.__COMPOSITION_CATALOG__.workspace.root;
    const item = root.canvasInputs.get(itemId);
    return item.children.map((k) => root.canvasInputs.get(k)).find((k) => root.typeOf(k) === "Text" && k.props.slot === "label")?.id;
  }, itemId);

const childrenOf = (page, id, type) =>
  page.evaluate(({ id, type }) => {
    const root = window.__COMPOSITION_CATALOG__.workspace.root;
    return root.canvasInputs.get(id).children.filter((k) => !type || root.typeOf(root.canvasInputs.get(k)) === type);
  }, { id, type });

const setText = (page, id, value) => edit(page, (c, ws, h, [id, value]) => h.props(id, { children: value }), [id, value]);
const rename = async (page, itemId, value) => setText(page, await labelOf(page, itemId), value);

// --- references (vanilla-starter expanded: MenuTrigger > Button + Popover(no arrow under a MenuTrigger) > Menu) ---
const refSlots = (h, R) =>
  h(R.MenuTrigger, { defaultOpen: true }, h(R.Button, null, "Permissions"),
    h(R.Popover, null, h(R.Menu, null,
      ...[["Copy", "Copy the selected text", "⌘C"], ["Cut", "Cut the selected text", "⌘X"], ["Paste", "Paste the copied text", "⌘V"]].map(([l, d, k]) =>
        h(R.MenuItem, { key: l, textValue: l }, h(R.Text, { slot: "label" }, l), h(R.Text, { slot: "description" }, d), h(R.Keyboard, null, k))))));
const refSub = (h, R) => {
  const item = (t, sub) => h(R.MenuItem, { key: t, textValue: t }, h(R.Text, { slot: "label" }, t), sub ? h("svg", { "aria-hidden": "true" }) : null);
  return h(R.MenuTrigger, { defaultOpen: true }, h(R.Button, null, "Actions"),
    h(R.Popover, null, h(R.Menu, null, item("Cut"), item("Copy"), item("Delete"),
      h(R.SubmenuTrigger, null, item("Share", true),
        h(R.Popover, { offset: -2, crossOffset: -4 }, h(R.Menu, null, item("SMS"), item("Instagram"),
          h(R.SubmenuTrigger, null, item("Email", true),
            h(R.Popover, { offset: -2, crossOffset: -4 }, h(R.Menu, null, item("Work"), item("Personal"))))))))));
};
const refSep = (h, R) => {
  const item = (t) => h(R.MenuItem, { key: t, textValue: t }, h(R.Text, { slot: "label" }, t));
  return h(R.MenuTrigger, { defaultOpen: true }, h(R.Button, null, "Actions"),
    h(R.Popover, null, h(R.Menu, null, item("New…"), item("Open…"), h(R.Separator, { key: "s1" }), item("Save"), item("Save as…"), item("Rename…"), h(R.Separator, { key: "s2" }), item("Page setup…"), item("Print…"))));
};
const refClosed = (label) => new Function("h", "R", `return h(R.MenuTrigger, null, h(R.Button, null, ${JSON.stringify(label)}), h(R.Popover, null, h(R.Menu, null, h(R.MenuItem, null, "x"))));`);
const lastPopover = (host, doc) => { const all = doc.querySelectorAll(".react-aria-Popover"); return all[all.length - 1]?.outerHTML ?? null; };
const clickSub = (label) => new Function("host", "doc", `return (async () => { const items = [...doc.querySelectorAll('[role=menuitem]')]; const it = items.find((e) => e.textContent.trim() === ${JSON.stringify(label)}); it?.click(); })();`);

async function compare(page, label, previewSide, referenceSide) {
  const p = await structure(page, dropAnchors(previewSide));
  const r = await structure(page, referenceSide ?? "");
  const d = diff(p, r);
  return { label, structure: d ? { pass: false, d } : { pass: true } };
}

export async function run(page) {
  const edits = [];
  // (a) Text slots + Keyboard
  const a = await place(page, "lib:definition:origin-component-menu");
  let m = await menuOf(page, a);
  edits.push(await setText(page, m.button, "Permissions"));
  const aItems = await childrenOf(page, m.menu, "MenuItem");
  for (const [i, item] of aItems.entries()) {
    edits.push(await rename(page, item, SLOTS[i][0]));
    edits.push(await edit(page, (c, ws, h, [item, d, k]) => [
      // (Appended: the origin's own parts before them — icon · shortcut · description — are absent while empty.)
      h.insert(item, [h.node(h.newId(), "lib:definition:text", { slot: "description", children: d })]),
      h.later(() => h.insert(item, [h.node(h.newId(), "lib:definition:type-Keyboard", { children: k })])),
    ], [item, SLOTS[i][1], SLOTS[i][2]]));
  }
  // (b) Submenus — the Design "+" adds SubmenuTrigger (MenuItem + Popover > Menu > MenuItem).
  const b = await place(page, "lib:definition:origin-component-menu");
  m = await menuOf(page, b);
  edits.push(await setText(page, m.button, "Actions"));
  for (const [i, item] of (await childrenOf(page, m.menu, "MenuItem")).entries()) edits.push(await rename(page, item, ["Cut", "Copy", "Delete"][i]));
  edits.push(await plus(page, m.menu, "SubmenuTrigger"));
  const subOf = async (menuId) => {
    const [trigger] = (await childrenOf(page, menuId, "SubmenuTrigger")).slice(-1);
    const [item] = await childrenOf(page, trigger, "MenuItem");
    const [pop] = await childrenOf(page, trigger, "Popover");
    const [menu] = await childrenOf(page, pop, "Menu");
    return { trigger, item, menu };
  };
  const share = await subOf(m.menu);
  edits.push(await rename(page, share.item, "Share"));
  edits.push(await rename(page, (await childrenOf(page, share.menu, "MenuItem"))[0], "SMS"));
  edits.push(await plus(page, share.menu, "MenuItem"));
  edits.push(await rename(page, (await childrenOf(page, share.menu, "MenuItem"))[1], "Instagram"));
  edits.push(await plus(page, share.menu, "SubmenuTrigger"));
  const email = await subOf(share.menu);
  edits.push(await rename(page, email.item, "Email"));
  edits.push(await rename(page, (await childrenOf(page, email.menu, "MenuItem"))[0], "Work"));
  edits.push(await plus(page, email.menu, "MenuItem"));
  edits.push(await rename(page, (await childrenOf(page, email.menu, "MenuItem"))[1], "Personal"));
  // (c) Separators
  const cc = await place(page, "lib:definition:origin-component-menu");
  m = await menuOf(page, cc);
  edits.push(await setText(page, m.button, "Actions"));
  for (let i = 0; i < 4; i++) edits.push(await plus(page, m.menu, "MenuItem"));
  for (const [i, item] of (await childrenOf(page, m.menu, "MenuItem")).entries()) edits.push(await rename(page, item, SEPARATED[i]));
  edits.push(await edit(page, (c, ws, h, menu) => [
    h.insert(menu, [h.node(h.newId(), "lib:definition:type-Separator")], 2),
    h.later(() => h.insert(menu, [h.node(h.newId(), "lib:definition:type-Separator")], 6)),
  ], m.menu));

  const reopened = await reopen(page);
  const out = [];
  for (const [source, ref, label, trigger] of [[a, refSlots, "slots", "Permissions"], [b, refSub, "submenu", "Actions"], [cc, refSep, "separators", "Actions"]]) {
    const id = await recordOf(page, source);
    // closed: the trigger
    const closedHtml = await previewHtml(page, id);
    const closedRef = await refMount(page, refClosed(trigger));
    out.push({ ...(await compare(page, `${label} closed (as is)`, closedHtml, closedRef)), canvas: await canvasVsPreview(page, id) });
    out.push(await compare(page, `${label} closed (ADR-255 trigger wrapper out)`, unwrapTrigger(closedHtml), closedRef));
    // open: the menu's popover
    await press(page, `[data-catalog-id="${id}"] button`);
    const opened = await lastHtml(page, ".react-aria-Popover");
    let subs = [];
    if (label === "submenu") {
      await press(page, `.react-aria-Popover [role=menuitem][aria-haspopup]`);
      subs.push(await lastHtml(page, ".react-aria-Popover"));
      await page.frameLocator("#previewFrame").locator(".react-aria-Popover").last().locator("[role=menuitem][aria-haspopup]").first().dispatchEvent("click");
      await page.waitForTimeout(800);
      subs.push(await lastHtml(page, ".react-aria-Popover"));
    }
    await closeOverlays(page);
    out.push(await compare(page, `${label} open`, opened, await refMount(page, ref, { pick: lastPopover })));
    if (label === "submenu") {
      out.push(await compare(page, "submenu Share open", subs[0], await refMount(page, ref, { act: clickSub("Share"), pick: lastPopover })));
      const both = new Function("host", "doc", `return (async () => { const f = ${clickSub("Share").toString()}; await f(host, doc); await new Promise((r) => setTimeout(r, 400)); const g = ${clickSub("Email").toString()}; await g(host, doc); })();`);
      out.push(await compare(page, "submenu Email open", subs[1], await refMount(page, ref, { act: both, pick: lastPopover })));
    }
  }
  return { edits: edits.filter((e) => !e.ok), editCount: edits.length, reopened, out };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { browser, page, errors } = await launch();
  await newProject(page, `g5-ex02-${Date.now()}`);
  const r = await run(page);
  console.log(JSON.stringify(r, null, 1));
  console.log("errors", JSON.stringify(errors.slice(0, 6)));
  await browser.close();
}
