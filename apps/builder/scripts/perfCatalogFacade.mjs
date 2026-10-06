// The perf harness (`perf-baseline.mjs`, ADR-246 ratchet) drives the Builder through the old element
// store API (`window.__composition_STORE__`). ADR-248 replaced that store with the catalog workspace
// (`window.__COMPOSITION_CATALOG__`, a dev / harness-build handle). This init script keeps one
// harness for both apps: when the page assigns a real store (the old app) it is used as is; when
// only the catalog handle exists, `__composition_STORE__` is a harness-side view that maps the calls
// the frame/leak lanes make onto catalog commands:
//
//   currentPageId · pages · setPage           → session page
//   elements · elementsMap                    → a snapshot of the page bodies and seeded nodes (taken
//                                               when the harness seeds; kept current by the facade's
//                                               own edits — no whole-graph read while measuring)
//   setSelectedElement(s) · selectedElementId → session selection
//   updateElementProps                        → setFields (style width/height/backgroundColor/
//                                               fontSize, `children` text)
//   addComplexElement (mixed Text/frame)      → insertNodes (absolute placement)
//   appendPageShell                           → createPage (+ body)
//   undo · redo                               → workspace undo / redo
//
// Element ids are catalog node ids without the `project:node:` prefix (`perf-seed-3`); page ids are
// catalog page ids. The `fields` fixture places palette field instances the same way. Other
// fixture kinds (refs, forms …) are old-app only and throw here.
export const CATALOG_STORE_FACADE_SCRIPT = `(() => {
  let real;
  let facade;
  const NODE = "project:node:";
  const px = (v) => (typeof v === "number" ? v : v === undefined ? undefined : parseFloat(String(v)));
  const set = (value) => ({ kind: "set", value });
  function build() {
    const h = window.__COMPOSITION_CATALOG__;
    const ws = () => h.workspace;
    const cmd = () => h.commands;
    const graph = () => ws().runtime.graph;
    const elements = [];
    const byId = new Map();
    const add = (el) => { if (!byId.has(el.id)) { elements.push(el); byId.set(el.id, el); } };
    const syncBodies = () => {
      for (const pageId of graph().getEntry(graph().projectId).pageIds) {
        const page = graph().getEntry(pageId);
        for (const body of page.children) {
          add({ id: body.slice(NODE.length), type: "body", page_id: pageId, parent_id: null, props: { style: {} } });
          // Nodes a previous load seeded (the snapshot starts empty after a reload).
          for (const child of graph().getEntry(body)?.children ?? [])
            if (child.startsWith(NODE + "perf-seed-")) add({ id: child.slice(NODE.length), type: "seed", page_id: pageId, parent_id: body.slice(NODE.length), props: { style: {} } });
        }
      }
    };
    const select = (ids) => {
      if (!ids.length) return ws().session.clearSelection();
      ws().session.select(ids.map((id) => ({ target: { kind: "node", id: NODE + id }, identity: ws().root.recordsOfSource(NODE + id)[0] })));
    };
    const writesOf = (props) => {
      const style = props?.style ?? {};
      const sizing = {}, visual = {}, out = {};
      if (style.width !== undefined) sizing.width = set(px(style.width));
      if (style.height !== undefined) sizing.height = set(px(style.height));
      if (style.backgroundColor !== undefined) visual.backgroundColor = set(style.backgroundColor);
      if (style.fontSize !== undefined) visual.fontSize = set(px(style.fontSize));
      if (Object.keys(sizing).length) out.sizing = sizing;
      if (Object.keys(visual).length) out.visual = visual;
      if (props && "children" in props && typeof props.children === "string") out.props = { children: set(props.children) };
      return out;
    };
    // (Palette types the fixtures place: the mixed Text / frame grid and the fields grid.)
    const FIXTURE_TYPES = ["Text", "frame", "TextField", "NumberField", "Select", "ComboBox", "SearchField", "DatePicker"];
    const entryOf = (el) => {
      if (!FIXTURE_TYPES.includes(el.type)) throw new Error("catalog facade: fixture type " + el.type + " is old-app only");
      const style = el.props?.style ?? {};
      const w = writesOf(el.props);
      return {
        kind: "node", id: NODE + el.id,
        definitionId: h.palette.catalogPaletteDefinitionId(graph().library, el.type),
        children: [], props: w.props ?? {}, visual: w.visual ?? {}, sizing: w.sizing ?? {},
        ...(style.position === "absolute" ? { placement: { kind: "absolute", x: px(style.left) ?? 0, y: px(style.top) ?? 0 } } : {}),
        descendantOverrides: [],
      };
    };
    syncBodies();
    const state = {
      get currentPageId() { return ws().session.getSnapshot().pageId; },
      get pages() { return graph().getEntry(graph().projectId).pageIds.map((id) => ({ id })); },
      get elements() { return elements; },
      get elementsMap() { return byId; },
      get selectedElementId() { const s = ws().session.getSnapshot().selection[0]; return s && s.target.kind === "node" ? s.target.id.slice(NODE.length) : null; },
      get selectedElementIds() { return ws().session.getSnapshot().selection.flatMap((s) => (s.target.kind === "node" ? [s.target.id.slice(NODE.length)] : [])); },
      setSelectedElement(id) { select(id ? [id] : []); },
      setSelectedElements(ids) { select(ids ?? []); },
      activatePage(id) { ws().session.setPage(id); },
      async updateElementProps(id, props) {
        const w = writesOf(props);
        if (Object.keys(w).length) ws().execute(cmd().setFields({ targets: [{ kind: "node", id: NODE + id }], ...w }));
        const el = byId.get(id);
        if (el) el.props = props;
      },
      async addComplexElement(first, rest = []) {
        const all = [first, ...rest];
        const parent = all[0].parent_id;
        const entries = all.map(entryOf);
        ws().execute(cmd().insertNodes({ parent: { kind: "node", id: NODE + parent }, entries, rootIds: entries.map((e) => e.id), newId: ws().newId, label: "Seed" }));
        ws().session.clearSelection();
        for (const el of all) add({ ...el });
      },
      appendPageShell(page, body) {
        const pageId = page.id.startsWith("project:page:") ? page.id : "project:page:" + page.id;
        const bodyId = NODE + body.id;
        ws().execute(cmd().createPage({
          page: { kind: "page", id: pageId, route: page.slug, name: page.title, children: [bodyId] },
          entries: [{ kind: "node", id: bodyId, definitionId: "lib:definition:type-body", name: "Body", children: [], props: {}, visual: {}, sizing: {}, descendantOverrides: [] }],
        }));
        syncBodies();
      },
      undo() { ws().undo(); },
      redo() { ws().redo(); },
    };
    return { getState: () => state };
  }
  Object.defineProperty(window, "__composition_STORE__", {
    configurable: true,
    get() {
      if (real) return real;
      if (!window.__COMPOSITION_CATALOG__?.workspace || !window.__COMPOSITION_CATALOG__?.palette) return undefined;
      return (facade ??= build());
    },
    set(value) { real = value; },
  });
})();`;
