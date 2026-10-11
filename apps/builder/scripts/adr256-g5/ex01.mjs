// G5 example 1 — ListBox: Text slots (Permissions) · Sections (Sandwich contents).
import { canvasVsPreview, diff, edit, launch, newProject, place, previewHtml, recordOf, referenceHtml, reopen, structure } from "./harness.mjs";

export async function run(page) {
  const results = [];
  // (a) Permissions: ListBox origin → its items' texts (Read · Write · Admin) → the icons out.
  const a = await place(page, "lib:definition:origin-component-listbox");
  const rows = [["Read", "Read only"], ["Write", "Read and write only"], ["Admin", "Full access"]];
  const ra = await edit(page, (c, ws, h, [source, rows]) => {
    const list = h.bySource(source);
    const items = h.within(list.id, "ListBoxItem");
    const steps = [h.ariaLabel(list.id, "Permissions"), h.props(list.id, { selectionMode: "single" })];
    items.forEach((item, i) => {
      const texts = h.within(item.id, "Text");
      const label = texts.find((t) => t.props.slot === "label");
      const description = texts.find((t) => t.props.slot === "description");
      steps.push(h.props(label.id, { children: rows[i][0] }));
      steps.push(h.props(description.id, { children: rows[i][1] }));
      for (const icon of h.within(item.id, "Icon"))
        steps.push(h.later(() => c.removeTargets({ targets: [h.target(icon.id)] })));
    });
    return steps;
  }, [a, rows]);
  // (b) Sections: an empty ListBox + three ListBoxSection originals (Header + items).
  const b = await place(page, "lib:definition:type-ListBox");
  const sections = [["Veggies", ["Lettuce", "Tomato", "Onion"]], ["Protein", ["Ham", "Tuna", "Tofu"]], ["Condiments", ["Mayonaise", "Mustard", "Ranch"]]];
  const rb1 = await edit(page, (c, ws, h, [source, sections]) => {
    const list = h.bySource(source);
    return [
      h.ariaLabel(list.id, "Sandwich contents"), h.props(list.id, { selectionMode: "multiple" }),
      ...sections.map(() => h.later(() => h.insert(list.id, [h.node(h.newId(), "lib:definition:origin-component-listbox-section")]))),
    ];
  }, [b, sections]);
  const rb2 = await edit(page, (c, ws, h, [source, sections]) => {
    const list = h.bySource(source);
    const steps = [];
    h.within(list.id, "ListBoxSection").forEach((section, s) => {
      const header = h.within(section.id, "Header")[0];
      steps.push(h.props(header.id, { children: sections[s][0] }));
      const items = h.within(section.id, "ListBoxItem");
      // (The section original has two items — the third is a ListBoxItem original.)
      if (items.length < 3)
        steps.push(h.later(() => h.insert(section.id, [h.node(h.newId(), "lib:definition:origin-component-listbox-item-default")])));
    });
    return steps;
  }, [b, sections]);
  const rb3 = await edit(page, (c, ws, h, [source, sections]) => {
    const list = h.bySource(source);
    const steps = [];
    h.within(list.id, "ListBoxSection").forEach((section, s) => {
      h.within(section.id, "ListBoxItem").forEach((item, i) => {
        const label = h.within(item.id, "Text").find((t) => t.props.slot === "label") ?? h.within(item.id, "Text")[0];
        if (label) steps.push(h.props(label.id, { children: sections[s][1][i] }));
        for (const t of h.within(item.id, "Text")) if (t !== label) steps.push(h.later(() => c.removeTargets({ targets: [h.target(t.id)] })));
        for (const icon of h.within(item.id, "Icon")) steps.push(h.later(() => c.removeTargets({ targets: [h.target(icon.id)] })));
      });
    });
    return steps;
  }, [b, sections]);
  const reopened = await reopen(page);
  const out = [];
  for (const [source, ref, label] of [
    [a, (h, R) => h(R.ListBox, { "aria-label": "Permissions", selectionMode: "single" },
      ...[["Read", "Read only"], ["Write", "Read and write only"], ["Admin", "Full access"]].map(([l, d]) =>
        h(R.ListBoxItem, { key: l, id: l, textValue: l }, h(R.Text, { slot: "label" }, l), h(R.Text, { slot: "description" }, d)))), "Permissions"],
    [b, (h, R) => h(R.ListBox, { "aria-label": "Sandwich contents", selectionMode: "multiple" },
      ...[["Veggies", ["Lettuce", "Tomato", "Onion"]], ["Protein", ["Ham", "Tuna", "Tofu"]], ["Condiments", ["Mayonaise", "Mustard", "Ranch"]]].map(([head, items]) =>
        h(R.ListBoxSection, { key: head, id: head }, h(R.Header, null, head),
          ...items.map((t) => h(R.ListBoxItem, { key: t, id: t, textValue: t }, h(R.Text, { slot: "label" }, t)))))), "Sections"],
  ]) {
    const id = await recordOf(page, source);
    const p = await structure(page, (await previewHtml(page, id)) ?? "");
    const r = await structure(page, await referenceHtml(page, ref));
    const d = diff(p, r);
    const cv = await canvasVsPreview(page, id);
    out.push({ label, structure: d ? { pass: false, d } : { pass: true }, canvas: cv });
  }
  return { edits: [ra, rb1, rb2, rb3], reopened, out };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { browser, page, errors } = await launch();
  await newProject(page, `g5-ex01-${Date.now()}`);
  const r = await run(page);
  console.log(JSON.stringify(r, null, 1));
  console.log("errors", errors.slice(0, 5));
  await browser.close();
}
