// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  copyNodes,
  createComponent,
  detachInstances,
  duplicateNodes,
  insertNodes,
  moveNodes,
  pasteNodes,
  setFields,
  setShowWhen,
  ungroupNodes,
} from "../../../../../../packages/shared/src/catalog/commands";
import {
  catalogShowWhenHolds,
  catalogStateOwner,
} from "../../../../../../packages/shared/src/catalog/runtime/presence";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  CatalogShowWhen,
  EntryId,
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { validateCatalogEntry } from "../../../../../../packages/shared/src/catalog/document/validation";
import { renderCatalogDom } from "../domBinding";
import { CatalogCompositionRoot } from "../../../../../../packages/shared/src/catalog/runtime/compositionRoot";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

/**
 * ADR-256 Decision 7 (Phase 4a, G3) — a node's `showWhen`: it is there only in the states its
 * conditions name, read from each condition's state owner (the nearest ancestor that gives the key,
 * the nearest of a `type`, or one ancestor by its address). The Canvas reads the owner's resting
 * values (record props · display state · derived values); the DOM reads RAC's render props where the
 * owner passes them, else the record. An owner that is not linked makes the condition false.
 */
const BODY = "project:node:home-body" as NodeId;
const set = <T,>(value: T) => ({ kind: "set" as const, value });
const id = (name: string) => `project:node:${name}` as NodeId;
const node = (
  name: string,
  type: string,
  children: string[],
  props: Record<string, unknown> = {},
  showWhen?: CatalogShowWhen,
) =>
  ({
    kind: "node",
    id: id(name),
    // (A primitive's definition is `lib:definition:<name>` — group · text.)
    definitionId: /^[a-z]/.test(type) && type !== "frame"
      ? `lib:definition:${type}`
      : `lib:definition:type-${type}`,
    children: children.map(id),
    props: Object.fromEntries(
      Object.entries(props).map(([key, value]) => [key, set(value)]),
    ),
    visual: {},
    sizing: {},
    descendantOverrides: [],
    ...(showWhen ? { showWhen } : {}),
  }) as unknown as NodeEntry;

async function open(entries: NodeEntry[], rootId: string) {
  const library = await buildCodeCatalogLibrary();
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:adr256-show-when" as EntryId<"project">,
        name: "Show when",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, `adr256-show-when-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1200, height: 800 },
      autosaveSchedule: () => {},
    },
  );
  // (`root.execute`: no automatic HTML ids.)
  workspace.root.execute(
    insertNodes({
      parent: { kind: "node", id: BODY },
      entries,
      rootIds: [id(rootId)],
      newId: workspace.newId,
    }),
  );
  const root = workspace.root;
  const record = (name: string) =>
    [...root.canvasInputs.values()].find((r) => r.sourceId === id(name))!;
  /** Canvas: whether the node is shown (its record is not hidden). */
  const canvas = (name: string) => record(name).hidden !== true;
  const dom = () =>
    renderToStaticMarkup(
      renderCatalogDom(
        root,
        [...root.domInputs.values()].find((r) => r.sourceId === id(rootId))!.id,
      ),
    );
  /** DOM: whether the node's element is drawn. */
  const drawn = (name: string) => dom().includes(`::${id(name)}"`);
  const edit = (name: string, props: Record<string, boolean>) =>
    workspace.root.execute(
      setFields({
        targets: [{ kind: "node", id: id(name) }],
        props: Object.fromEntries(
          Object.entries(props).map(([key, value]) => [key, set(value)]),
        ),
      }),
    );
  return { workspace, root, record, canvas, dom, drawn, edit };
}

/** Reference example 7: the check while selected and not indeterminate, the dash while indeterminate. */
const checkbox = (props: Record<string, unknown>) => [
  node("box", "Checkbox", ["box-button"], props),
  node("box-button", "CheckboxButton", [
    "box-indicator",
    "check",
    "dash",
    "box-text",
  ]),
  node("box-indicator", "CheckboxIndicator", []),
  node(
    "check",
    "Icon",
    [],
    { iconName: "check" },
    {
      all: ["isSelected", { not: "isIndeterminate" }],
    },
  ),
  node("dash", "Icon", [], { iconName: "minus" }, { all: ["isIndeterminate"] }),
  node("box-text", "Label", [], { children: "Own" }),
];

describe("ADR-256 Phase 4a — showWhen: the check and the dash (reference example 7)", () => {
  it.each([
    [{}, false, false],
    [{ isSelected: true }, true, false],
    [{ isSelected: true, isIndeterminate: true }, false, true],
    [{ isIndeterminate: true }, false, true],
  ])(
    "%j: check %s · dash %s on the Canvas and in the DOM",
    async (props, check, dash) => {
      const { canvas, drawn } = await open(checkbox(props), "box");
      expect([canvas("check"), canvas("dash")]).toEqual([check, dash]);
      expect([drawn("check"), drawn("dash")]).toEqual([check, dash]);
    },
  );

  it("the Canvas follows an edit of the owner (incremental), as a fresh open", async () => {
    const { canvas, edit } = await open(checkbox({}), "box");
    edit("box", { isSelected: true });
    expect([canvas("check"), canvas("dash")]).toEqual([true, false]);
    edit("box", { isIndeterminate: true });
    expect([canvas("check"), canvas("dash")]).toEqual([false, true]);
    edit("box", { isIndeterminate: false, isSelected: false });
    expect([canvas("check"), canvas("dash")]).toEqual([false, false]);
  });

  it("a click in the Preview: RAC's state (the button's render props) shows the check", async () => {
    const { root } = await open(checkbox({}), "box");
    const host = document.createElement("div");
    document.body.append(host);
    const mounted = createRoot(host);
    await act(async () =>
      mounted.render(
        renderCatalogDom(
          root,
          [...root.domInputs.values()].find((r) => r.sourceId === id("box"))!
            .id,
        ),
      ),
    );
    const shown = (name: string) =>
      !!host.querySelector(`[data-catalog-id$="::${id(name)}"]`);
    expect([shown("check"), shown("dash")]).toEqual([false, false]);
    await act(async () => host.querySelector("input")!.click());
    expect([shown("check"), shown("dash")]).toEqual([true, false]);
    await act(async () => host.querySelector("input")!.click());
    expect(shown("check")).toBe(false);
    act(() => mounted.unmount());
    host.remove();
  });
});

describe("ADR-256 Phase 4a — showWhen: the state owner", () => {
  /**
   * Disclosure A > Disclosure B (in A's panel) > B's header > Text: the Text's conditions name B
   * (nearest), A (its address), or a type — the G3 「nested Group A/B」 case with a type the catalog
   * has today (RAC `Group` joins with Decision 8 — breakdown Phase 6); both stay expanded.
   */
  const groups = (a: boolean, b: boolean, showWhen: CatalogShowWhen) => [
    node("a", "Disclosure", ["a-header", "b"], { isExpanded: true, isDisabled: a }),
    node("a-header", "DisclosureHeader", ["a-title"]),
    node("a-title", "text", [], { children: "A" }),
    node("b", "Disclosure", ["b-header"], { isExpanded: true, isDisabled: b }),
    node("b-header", "DisclosureHeader", ["b-title", "text"]),
    node("b-title", "text", [], { children: "B" }),
    node("text", "text", [], { children: "Off" }, showWhen),
  ];
  const combos = [
    [false, false],
    [false, true],
    [true, false],
    [true, true],
  ] as const;

  it.each(combos)(
    "A %s · B %s: the default owner is the nearest (B)",
    async (a, b) => {
      const { canvas, drawn } = await open(
        groups(a, b, { all: ["isDisabled"] }),
        "a",
      );
      expect(canvas("text")).toBe(b);
      expect(drawn("text")).toBe(b);
    },
  );

  it.each(combos)("A %s · B %s: `from` A's address reads A", async (a, b) => {
    const { canvas, drawn } = await open(
      groups(a, b, {
        all: ["isDisabled"],
        from: { ancestor: { nodeId: id("a") } },
      }),
      "a",
    );
    expect(canvas("text")).toBe(a);
    expect(drawn("text")).toBe(a);
  });

  it.each(combos)(
    "A %s · B %s: A and not B (each condition its own owner)",
    async (a, b) => {
      const { canvas, drawn } = await open(
        groups(a, b, {
          all: [
            { key: "isDisabled", from: { ancestor: { nodeId: id("a") } } },
            { not: "isDisabled", from: { ancestor: { nodeId: id("b") } } },
          ],
        }),
        "a",
      );
      expect(canvas("text")).toBe(a && !b);
      expect(drawn("text")).toBe(a && !b);
    },
  );

  it("`from: { type }` is the nearest of that type that gives the key", async () => {
    const { canvas } = await open(
      groups(true, false, { all: ["isDisabled"], from: { type: "Disclosure" } }),
      "a",
    );
    expect(canvas("text")).toBe(false);
  });

  it("a reference that is not linked: authoring it is refused; an external one reads false", async () => {
    for (const showWhen of [
      { all: ["isDisabled"], from: { ancestor: { nodeId: id("elsewhere") } } },
      {
        all: [{ not: "isDisabled" }],
        from: { ancestor: { nodeId: id("elsewhere") } },
      },
      // A Disclosure gives no isSelected: an address naming a part without the key is not linked.
      { all: ["isSelected"], from: { ancestor: { nodeId: id("a") } } },
    ] as CatalogShowWhen[]) {
      let code: string | undefined;
      try {
        await open(groups(true, true, showWhen), "a");
      } catch (error) {
        code = (error as { code?: string }).code;
      }
      expect(code).toBe("STATE_OWNER_UNLINKED");
      // An external document's reference (no command ran): the condition is false — even negated
      // — and no other ancestor stands in.
      const records = new Map(
        [
          { id: "x::project:node:a", parentId: "", children: ["x::project:node:t"], props: { isDisabled: true } },
          { id: "x::project:node:t", parentId: "x::project:node:a", children: [], props: {}, showWhen },
        ].map((r) => [r.id, { ...r, bindingId: "x" } as never]),
      );
      const get = (key: string) => records.get(key);
      expect(
        catalogShowWhenHolds(get("x::project:node:t")!, get, () => "Disclosure"),
      ).toBe(false);
    }
  });

});

describe("ADR-256 Phase 4a — showWhen: Disclosure expansion", () => {
  it.each([true, false])(
    "expanded %s: an Icon in the header shows with the Disclosure's isExpanded",
    async (expanded) => {
      const { canvas, drawn } = await open(
        [
          node("d", "Disclosure", ["d-header"], { isExpanded: expanded }),
          node("d-header", "DisclosureHeader", ["open-icon", "d-title"]),
          node(
            "open-icon",
            "Icon",
            [],
            { iconName: "chevron-down" },
            {
              all: ["isExpanded"],
            },
          ),
          node("d-title", "text", [], { children: "Title" }),
        ],
        "d",
      );
      expect(canvas("open-icon")).toBe(expanded);
      expect(drawn("open-icon")).toBe(expanded);
    },
  );
});

describe("ADR-256 Phase 4a — showWhen: the document form", () => {
  const entry = (showWhen: unknown) => ({
    ...node("t", "text", []),
    showWhen,
  });
  it.each([
    [{ all: ["isSelected"] }, true],
    [{ all: [{ not: "isSelected" }], from: { type: "Checkbox" } }, true],
    [
      { all: [{ key: "isOpen", from: { ancestor: { nodeId: id("x") } } }] },
      true,
    ],
    [{ all: [] }, false],
    [{ all: ["isSelected", "isInvalid", "isDisabled", "isOpen"] }, false],
    [{ all: ["isActive"] }, false],
    [{ all: [{ key: "isSelected" }] }, false],
    [{ any: ["isSelected"] }, false],
  ])("%j valid = %s", (showWhen, valid) => {
    const check = () => validateCatalogEntry(entry(showWhen));
    if (valid) expect(check).not.toThrow();
    else expect(check).toThrow();
  });
});

describe("ADR-256 Phase 4b — a stored state owner stays linked (breakdown §1-1)", () => {
  /** Disclosure A > [header > title, Text ⟵ isDisabled from A's address (A's panel)]; a frame F beside A. */
  const tree = () => [
    node("a", "Disclosure", ["a-header", "mark"], { isExpanded: true, isDisabled: true }),
    node("a-header", "DisclosureHeader", ["a-title"]),
    node("a-title", "text", [], { children: "A" }),
    node("mark", "text", [], { children: "Off" }, {
      all: ["isDisabled"],
      from: { ancestor: { nodeId: id("a") } },
    }),
  ];
  const code = (run: () => void) => {
    try {
      run();
    } catch (error) {
      return (error as { code?: string }).code;
    }
    return undefined;
  };
  const withFrame = async () => {
    const opened = await open(tree(), "a");
    opened.workspace.root.execute(
      insertNodes({
        parent: { kind: "node", id: BODY },
        entries: [node("f", "frame", [])],
        rootIds: [id("f")],
        newId: opened.workspace.newId,
      }),
    );
    return opened;
  };

  it("moving the node out of its owner is refused", async () => {
    const { workspace } = await withFrame();
    expect(
      code(() =>
        workspace.root.execute(
          moveNodes({
            ids: [id("mark")],
            parent: { kind: "node", id: id("f") },
            newId: workspace.newId,
          }),
        ),
      ),
    ).toBe("STATE_OWNER_UNLINKED");
  });

  it("moving the owner with the node, or wrapping the node in a frame, keeps the link", async () => {
    const { workspace, canvas } = await withFrame();
    workspace.root.execute(
      moveNodes({
        ids: [id("a")],
        parent: { kind: "node", id: id("f") },
        newId: workspace.newId,
      }),
    );
    expect(canvas("mark")).toBe(true);
    workspace.root.execute(
      insertNodes({
        parent: { kind: "node", id: id("a") },
        entries: [node("wrap", "frame", [])],
        rootIds: [id("wrap")],
        newId: workspace.newId,
      }),
    );
    workspace.root.execute(
      moveNodes({
        ids: [id("mark")],
        parent: { kind: "node", id: id("wrap") },
        newId: workspace.newId,
      }),
    );
    expect(canvas("mark")).toBe(true);
  });

  it("ungrouping the owner (the node is released) is refused; ungrouping a wrapper is not", async () => {
    const { workspace, canvas } = await open(tree(), "a");
    workspace.root.execute(
      insertNodes({
        parent: { kind: "node", id: id("a") },
        entries: [node("wrap", "frame", [])],
        rootIds: [id("wrap")],
        newId: workspace.newId,
      }),
    );
    workspace.root.execute(
      moveNodes({
        ids: [id("mark")],
        parent: { kind: "node", id: id("wrap") },
        newId: workspace.newId,
      }),
    );
    workspace.root.execute(
      ungroupNodes({ ids: [id("wrap")], newId: workspace.newId }),
    );
    expect(canvas("mark")).toBe(true);
    // A ToggleButton owner (free content) ungrouped: its node is released past it.
    const toggle = await open(
      [
        node("tb", "ToggleButton", ["on"], { isSelected: true }),
        node("on", "text", [], { children: "On" }, {
          all: ["isSelected"],
          from: { ancestor: { nodeId: id("tb") } },
        }),
      ],
      "tb",
    );
    expect(toggle.canvas("on")).toBe(true);
    expect(
      code(() =>
        toggle.workspace.root.execute(
          ungroupNodes({ ids: [id("tb")], newId: toggle.workspace.newId }),
        ),
      ),
    ).toBe("STATE_OWNER_UNLINKED");
  });


  it("inserting a node whose address names no ancestor is refused", async () => {
    const { workspace } = await withFrame();
    expect(
      code(() =>
        workspace.root.execute(
          insertNodes({
            parent: { kind: "node", id: id("f") },
            entries: [
              node("stray", "text", [], { children: "x" }, {
                all: ["isDisabled"],
                from: { ancestor: { nodeId: id("a") } },
              }),
            ],
            rootIds: [id("stray")],
            newId: workspace.newId,
          }),
        ),
      ),
    ).toBe("STATE_OWNER_UNLINKED");
  });

  it("a duplicate's node reads the duplicate's owner (the copy's ids)", async () => {
    const { workspace, root, edit } = await open(tree(), "a");
    workspace.root.execute(
      duplicateNodes({ ids: [id("a")], newId: workspace.newId }),
    );
    const marks = [...root.canvasInputs.values()].filter(
      (r) => r.props.children === "Off",
    );
    expect(marks).toHaveLength(2);
    const copy = marks.find((r) => r.sourceId !== id("mark"))!;
    const from = copy.showWhen!.from as { ancestor: { nodeId: string } };
    expect(from.ancestor.nodeId).not.toBe(id("a"));
    // The original's owner turns off: only the original hides.
    edit("a", { isDisabled: false });
    const shown = (sourceId: string) =>
      [...root.canvasInputs.values()].find((r) => r.sourceId === sourceId)!
        .hidden !== true;
    expect([shown(id("mark")), shown(copy.sourceId!)]).toEqual([false, true]);
  });

  it("pasting the node alone where its owner is not an ancestor is refused", async () => {
    const { workspace } = await withFrame();
    const clipboard = copyNodes(workspace.runtime.graph, [id("mark")]);
    expect(
      code(() =>
        workspace.root.execute(
          pasteNodes({
            clipboard,
            parent: { kind: "node", id: id("f") },
            newId: workspace.newId,
          }),
        ),
      ),
    ).toBe("STATE_OWNER_UNLINKED");
  });
});

describe("ADR-256 Phase 4b — an origin's reference follows its instances and a detach", () => {
  it("made into a component: each instance reads its own owner; detached: the new owner's id", async () => {
    const { workspace, root } = await open(
      [
        node("tb", "ToggleButton", ["on"], { isSelected: true }),
        node("on", "text", [], { children: "On" }, {
          all: ["isSelected"],
          from: { ancestor: { nodeId: id("tb") } },
        }),
      ],
      "tb",
    );
    workspace.root.execute(
      createComponent({ id: id("tb"), name: "Toggle", newId: workspace.newId }),
    );
    const instance = [...root.canvasInputs.values()].find(
      (r) => r.sourceId !== id("tb") && root.typeOf(r) === "ToggleButton",
    )!;
    const on = () =>
      [...root.canvasInputs.values()].filter((r) => r.props.children === "On");
    expect(on().every((r) => r.hidden !== true)).toBe(true);
    workspace.root.execute(
      detachInstances({
        ids: [instance.sourceId as NodeId],
        newId: workspace.newId,
      }),
    );
    const detached = on().find((r) => !r.id.includes("::project:node:on"))!;
    const from = detached.showWhen!.from as { ancestor: { nodeId: string } };
    expect(from.ancestor.nodeId).not.toBe(id("tb"));
    expect(detached.hidden).not.toBe(true);
    // The detached owner turns off: its node hides.
    workspace.root.execute(
      setFields({
        targets: [{ kind: "node", id: from.ancestor.nodeId as NodeId }],
        props: { isSelected: set(false) },
      }),
    );
    expect(
      on().find((r) => r.sourceId === detached.sourceId)!.hidden,
    ).toBe(true);
  });
});

describe("ADR-256 Phase 4a — an origin-local address names the position in the nearest instance", () => {
  it("`local` is the ancestor whose record is that template position of the same instance", () => {
    // An outer instance (root > group) holding an inner instance of the same origin (root > group >
    // leaf): each record id is `instance path::template id`.
    const outer = "p/outer";
    const inner = "p/outer/lib:template:t-inner";
    const records = new Map(
      [
        { id: `${outer}::lib:template:t-root`, parentId: "", children: [`${outer}::lib:template:t-group`] },
        { id: `${outer}::lib:template:t-group`, parentId: `${outer}::lib:template:t-root`, children: [`${inner}::lib:template:t-root`] },
        { id: `${inner}::lib:template:t-root`, parentId: `${outer}::lib:template:t-group`, children: [`${inner}::lib:template:t-group`] },
        { id: `${inner}::lib:template:t-group`, parentId: `${inner}::lib:template:t-root`, children: ["leaf"] },
        { id: "leaf", parentId: `${inner}::lib:template:t-group`, children: [] },
      ].map((r) => [r.id, { ...r, props: {}, bindingId: "x" } as never]),
    );
    const get = (key: string) => records.get(key);
    const typeOf = () => "Disclosure";
    const owner = (local: { instances: string[]; templatePath: string[] }) =>
      catalogStateOwner(
        get("leaf")!,
        "isExpanded",
        { ancestor: { local: local as never } },
        get,
        typeOf,
      )?.id;
    // The nearest instance's position (the inner one), and through a nested instance step too.
    expect(
      owner({ instances: [], templatePath: ["lib:template:t-root", "lib:template:t-group"] }),
    ).toBe(`${inner}::lib:template:t-group`);
    expect(
      owner({
        instances: ["lib:template:t-inner"],
        templatePath: ["lib:template:t-root", "lib:template:t-group"],
      }),
    ).toBe(`${inner}::lib:template:t-group`);
    // m6 (round 10): a path that does not exist names nothing — not the position its last id is.
    expect(
      owner({ instances: [], templatePath: ["lib:template:missing", "lib:template:t-group"] }),
    ).toBeUndefined();
  });

});

describe("ADR-256 Phase 4d — setShowWhen (the Design panel's command)", () => {
  it("sets, refuses an unlinked owner or a fourth condition, and clears", async () => {
    const { workspace, canvas } = await open(checkbox({}), "box");
    const run = (showWhen: CatalogShowWhen | null) =>
      workspace.root.execute(setShowWhen({ id: id("box-text"), showWhen }));
    const code = (showWhen: CatalogShowWhen) => {
      try {
        run(showWhen);
      } catch (error) {
        return (error as { code?: string }).code;
      }
    };
    run({ all: ["isSelected"] });
    expect(canvas("box-text")).toBe(false);
    run({ all: [{ not: "isSelected" }], from: { ancestor: { nodeId: id("box") } } });
    expect(canvas("box-text")).toBe(true);
    expect(
      code({ all: ["isSelected"], from: { ancestor: { nodeId: id("elsewhere") } } }),
    ).toBe("STATE_OWNER_UNLINKED");
    expect(
      code({ all: ["isSelected", "isDisabled", "isInvalid", "isRequired"] }),
    ).toBe("SHOW_WHEN_CONDITION_COUNT");
    // The DOM is told even where the Canvas's resting judgment stays the same (the record changed).
    let notified = 0;
    const stop = workspace.root.subscribeDom(
      [...workspace.root.domInputs.values()].find(
        (r) => r.sourceId === id("box-text"),
      )!.id,
      () => (notified += 1),
    );
    run(null);
    stop();
    expect(notified).toBeGreaterThan(0);
    expect(canvas("box-text")).toBe(true);
    expect(workspace.runtime.graph.getEntry(id("box-text"))).not.toHaveProperty(
      "showWhen",
    );
  });
});

describe("ADR-256 Phase 4 review (round 10)", () => {
  const code = (run: () => void) => {
    try {
      run();
    } catch (error) {
      return (error as { code?: string }).code;
    }
    return undefined;
  };

  it("m1 a ToggleButton's own selection (a click in the Preview) reaches its conditioned child", async () => {
    const { root } = await open(
      [
        node("tb", "ToggleButton", ["on"], { isSelected: false }),
        node("on", "text", [], { children: "On" }, { all: ["isSelected"] }),
      ],
      "tb",
    );
    const host = document.createElement("div");
    document.body.append(host);
    const mounted = createRoot(host);
    await act(async () =>
      mounted.render(
        renderCatalogDom(
          root,
          [...root.domInputs.values()].find((r) => r.sourceId === id("tb"))!.id,
        ),
      ),
    );
    const shown = () =>
      !!host.querySelector(`[data-catalog-id$="::${id("on")}"]`);
    expect(shown()).toBe(false);
    await act(async () => host.querySelector("button")!.click());
    expect(host.querySelector("button")!.getAttribute("aria-pressed")).toBe(
      "true",
    );
    expect(shown()).toBe(true);
    act(() => mounted.unmount());
    host.remove();
  });

  it("m2 a group item's state includes its group's (a RadioGroup's value · a CheckboxGroup's disabled)", async () => {
    const radio = await open(
      [
        node("g", "RadioGroup", ["r"], { value: "a" }),
        node("r", "Radio", ["r-button"], { value: "a" }),
        node("r-button", "RadioButton", ["r-ind", "mark"]),
        node("r-ind", "RadioIndicator", []),
        node("mark", "text", [], { children: "Picked" }, { all: ["isSelected"] }),
      ],
      "g",
    );
    expect(radio.canvas("mark")).toBe(true);
    expect(radio.drawn("mark")).toBe(true);
    const box = await open(
      [
        node("g", "CheckboxGroup", ["c"], { isDisabled: true }),
        node("c", "Checkbox", ["c-button"]),
        node("c-button", "CheckboxButton", ["c-ind", "mark"]),
        node("c-ind", "CheckboxIndicator", []),
        node("mark", "text", [], { children: "Off" }, { all: ["isDisabled"] }),
      ],
      "g",
    );
    expect(box.canvas("mark")).toBe(true);
    expect(box.drawn("mark")).toBe(true);
  });

  it("m3 a Tab's conditioned child follows the selection (first open and an edit), as the derived value", async () => {
    const { canvas, edit } = await open(
      [
        node("tabs", "Tabs", ["list", "panels"]),
        node("list", "TabList", ["ta", "tb"]),
        node("ta", "Tab", ["ma"], { id: "a" }),
        node("ma", "text", [], { children: "A" }, { all: ["isSelected"] }),
        node("tb", "Tab", ["mb"], { id: "b" }),
        node("mb", "text", [], { children: "B" }, { all: ["isSelected"] }),
        node("panels", "TabPanels", ["pa", "pb"]),
        node("pa", "TabPanel", []),
        node("pb", "TabPanel", []),
      ],
      "tabs",
    );
    expect([canvas("ma"), canvas("mb")]).toEqual([true, false]);
    edit("tabs", { defaultSelectedKey: "b" } as never);
    expect([canvas("ma"), canvas("mb")]).toEqual([false, true]);
  });

  it("m4 an instance whose template reads an outside owner cannot leave it; a reorder still can", async () => {
    const { workspace, root } = await open(
      [
        node("tb", "ToggleButton", ["f"], { isSelected: true }),
        node("f", "frame", ["on"]),
        node("on", "text", [], { children: "On" }, {
          all: ["isSelected"],
          from: { ancestor: { nodeId: id("tb") } },
        }),
      ],
      "tb",
    );
    workspace.root.execute(
      createComponent({ id: id("f"), name: "Inner", newId: workspace.newId }),
    );
    const instance = [...root.canvasInputs.values()].find(
      (r) => r.parentId && root.canvasInputs.get(r.parentId)?.sourceId === id("tb"),
    )!;
    expect(
      code(() =>
        workspace.root.execute(
          moveNodes({
            ids: [instance.sourceId as NodeId],
            parent: { kind: "node", id: BODY },
            newId: workspace.newId,
          }),
        ),
      ),
    ).toBe("STATE_OWNER_UNLINKED");
  });

  /** A component R > TB (ToggleButton) > S (slot); an instance I with a Text in S reading TB. */
  const slotted = async (templatePath: (rootId: string) => string[]) => {
    const opened = await open(
      [
        node("r", "frame", ["tb"]),
        node("tb", "ToggleButton", ["s"], { isSelected: true }),
        { ...node("s", "frame", []), slot: { name: "content", required: false } } as NodeEntry,
      ],
      "r",
    );
    const { workspace, root } = opened;
    workspace.root.execute(
      createComponent({ id: id("r"), name: "Holder", newId: workspace.newId }),
    );
    const instanceId = [...root.canvasInputs.values()].find(
      (r) => r.sourceId !== id("r") && r.collapsedIds?.some((c) => c.endsWith("::" + id("r"))),
    )!.sourceId as NodeId;
    const showWhen: CatalogShowWhen = {
      all: ["isSelected"],
      from: {
        ancestor: {
          address: {
            instances: [instanceId],
            templatePath: templatePath(id("r")) as never,
          },
        },
      },
    };
    const insert = () =>
      workspace.root.execute(
        insertNodes({
          parent: {
            kind: "descendant",
            ownerId: instanceId,
            address: {
              instances: [instanceId],
              templatePath: [id("r"), id("tb"), id("s")],
            },
          } as never,
          entries: [node("in-slot", "text", [], { children: "In" }, showWhen)],
          rootIds: [id("in-slot")],
          newId: workspace.newId,
        }),
      );
    return { ...opened, instanceId, insert };
  };

  it("m5 a detach maps a slot child's address of an inner position to that position's new node", async () => {
    const { workspace, instanceId, insert, root } = await slotted((r) => [r, id("tb")]);
    insert();
    const inSlot = () =>
      [...root.canvasInputs.values()].find((r) => r.sourceId === id("in-slot"))!;
    expect(inSlot().hidden).not.toBe(true);
    workspace.root.execute(
      detachInstances({ ids: [instanceId], newId: workspace.newId }),
    );
    const from = workspace.runtime.graph.getEntry(id("in-slot"))!;
    expect(
      "showWhen" in from &&
        from.showWhen?.from &&
        "ancestor" in from.showWhen.from &&
        "nodeId" in from.showWhen.from.ancestor,
    ).toBe(true);
    expect(inSlot().hidden).not.toBe(true);
  });

  it("m6 an address whose path does not exist is not linked (refused; read false, even negated)", async () => {
    const { insert } = await slotted(() => [id("missing-root"), id("tb")]);
    expect(code(insert)).toBe("STATE_OWNER_UNLINKED");
  });
});

describe("ADR-256 Phase 4 review (round 10) m7 — the panel keeps an owner it does not show", () => {
  it("a stored type · address owner round-trips; an added row leaves the others' owners", async () => {
    const { showWhenOf, showWhenViews } = await import(
      "../../panels/properties/catalog/showWhenView"
    );
    const stored: CatalogShowWhen = {
      all: [
        "isDisabled",
        {
          key: "isSelected",
          from: {
            ancestor: {
              address: {
                instances: [id("i")],
                templatePath: ["lib:template:r", "lib:template:t"] as never,
              },
            },
          },
        },
      ],
      from: { type: "Disclosure" },
    };
    const views = showWhenViews(stored);
    expect(showWhenOf(views)).toEqual({
      all: [
        { key: "isDisabled", from: { type: "Disclosure" } },
        stored.all[1],
      ],
    });
    // Add condition (the panel's button): the stored rows keep their owners.
    const added = showWhenOf([
      ...views,
      { key: "isSelected", not: false, owner: "nearest" },
    ])!;
    expect(added.all.slice(0, 2)).toEqual([
      { key: "isDisabled", from: { type: "Disclosure" } },
      stored.all[1],
    ]);
    expect(added.all[2]).toBe("isSelected");
  });
});

describe("ADR-256 Phase 4 repair check (round 11)", () => {
  const code = (run: () => void) => {
    try {
      run();
    } catch (error) {
      return (error as { code?: string }).code;
    }
    return undefined;
  };
  const shown = (root: CatalogWorkspace["root"], name: string) =>
    [...root.canvasInputs.values()].find((r) => r.sourceId === id(name))!
      .hidden !== true;

  it("rv-m1 a Checkbox does not take its group's isRequired (RAC reads its own); a Radio does", async () => {
    const box = await open(
      [
        node("g", "CheckboxGroup", ["c"], { isRequired: true }),
        node("c", "Checkbox", ["c-button"]),
        node("c-button", "CheckboxButton", ["c-ind", "mark"]),
        node("c-ind", "CheckboxIndicator", []),
        node("mark", "text", [], { children: "Req" }, { all: ["isRequired"] }),
      ],
      "g",
    );
    expect([box.canvas("mark"), box.drawn("mark")]).toEqual([false, false]);
    const radio = await open(
      [
        node("g", "RadioGroup", ["r"], { isRequired: true }),
        node("r", "Radio", ["r-button"], { value: "a" }),
        node("r-button", "RadioButton", ["r-ind", "mark"]),
        node("r-ind", "RadioIndicator", []),
        node("mark", "text", [], { children: "Req" }, { all: ["isRequired"] }),
      ],
      "g",
    );
    expect([radio.canvas("mark"), radio.drawn("mark")]).toEqual([true, true]);
  });

  it("rv-m2 a refresh that changes a conditioned node and its owner together re-judges the node", async () => {
    const { workspace } = await open(
      [
        node("g", "RadioGroup", ["r"], { value: "{{ choice }}" }),
        node("r", "Radio", ["r-button"], { value: "a" }),
        node("r-button", "RadioButton", ["r-ind", "mark"]),
        node("r-ind", "RadioIndicator", []),
        node("mark", "text", [], { children: "{{ label }}" }, { all: ["isSelected"] }),
      ],
      "g",
    );
    let values: Record<string, string> = { choice: "b", label: "Before" };
    const root = new CatalogCompositionRoot(
      workspace.runtime,
      await nodeLayoutEngine(),
      { width: 1200, height: 800 },
      undefined,
      undefined,
      undefined,
      undefined,
      {
        state: {
          projectVariables: () =>
            Object.entries(values).map(([name, value], index) => ({
              id: `v${index}`,
              name,
              type: "string",
              defaultValue: value,
            })),
        },
      },
    );
    expect(shown(root, "mark")).toBe(false);
    values = { choice: "a", label: "After" };
    root.refreshState(new Set(["choice", "label"]));
    expect(shown(root, "mark")).toBe(true);
  });

  /** A component R > [TB (ToggleButton) > S (slot), B (slot)]; an instance I. */
  const twoSlots = async () => {
    const opened = await open(
      [
        node("r", "frame", ["tb", "b"]),
        node("tb", "ToggleButton", ["s"], { isSelected: true }),
        { ...node("s", "frame", []), slot: { name: "inner", required: false } } as NodeEntry,
        { ...node("b", "frame", []), slot: { name: "outer", required: false } } as NodeEntry,
      ],
      "r",
    );
    const { workspace, root } = opened;
    workspace.root.execute(
      createComponent({ id: id("r"), name: "Holder", newId: workspace.newId }),
    );
    const instanceId = [...root.canvasInputs.values()].find(
      (r) => r.sourceId !== id("r") && r.collapsedIds?.some((c) => c.endsWith("::" + id("r"))),
    )!.sourceId as NodeId;
    return { ...opened, instanceId };
  };

  it("rv-m3 moving a slot child to another slot of the same instance, out of its addressed owner, is refused", async () => {
    const { workspace, instanceId } = await twoSlots();
    workspace.root.execute(
      insertNodes({
        parent: {
          kind: "descendant",
          ownerId: instanceId,
          address: { instances: [instanceId], templatePath: [id("r"), id("tb"), id("s")] },
        } as never,
        entries: [
          node("in-slot", "text", [], { children: "In" }, {
            all: ["isSelected"],
            from: {
              ancestor: {
                address: { instances: [instanceId], templatePath: [id("r"), id("tb")] as never },
              },
            },
          }),
        ],
        rootIds: [id("in-slot")],
        newId: workspace.newId,
      }),
    );
    expect(
      code(() =>
        workspace.root.execute(
          moveNodes({
            ids: [id("in-slot")],
            parent: {
              kind: "descendant",
              ownerId: instanceId,
              address: { instances: [instanceId], templatePath: [id("r"), id("b")] },
            } as never,
            newId: workspace.newId,
          }),
        ),
      ),
    ).toBe("STATE_OWNER_UNLINKED");
  });

  it("rv-m4 a nested component's template reading an outside owner: its outer instance cannot leave it", async () => {
    const { workspace, root } = await open(
      [
        node("tb", "ToggleButton", ["outer"], { isSelected: true }),
        node("outer", "frame", ["inner"]),
        node("inner", "frame", ["on"]),
        node("on", "text", [], { children: "On" }, {
          all: ["isSelected"],
          from: { ancestor: { nodeId: id("tb") } },
        }),
      ],
      "tb",
    );
    workspace.root.execute(
      createComponent({ id: id("inner"), name: "Inner", newId: workspace.newId }),
    );
    workspace.root.execute(
      createComponent({ id: id("outer"), name: "Outer", newId: workspace.newId }),
    );
    const outer = [...root.canvasInputs.values()].find(
      (r) => r.parentId && root.canvasInputs.get(r.parentId)?.sourceId === id("tb"),
    )!;
    expect(
      code(() =>
        workspace.root.execute(
          moveNodes({
            ids: [outer.sourceId as NodeId],
            parent: { kind: "node", id: BODY },
            newId: workspace.newId,
          }),
        ),
      ),
    ).toBe("STATE_OWNER_UNLINKED");
  });

  /** Inner = R > TB > S (slot); Outer = O > Inner instance; an Outer instance with a Text in S. */
  const nested = async (templatePath: (rootId: string) => string[], extra?: string) => {
    const opened = await open(
      [
        node("o", "frame", ["r"]),
        node("r", "frame", ["tb"]),
        node("tb", "ToggleButton", ["s"], { isSelected: true }),
        { ...node("s", "frame", []), slot: { name: "content", required: false } } as NodeEntry,
      ],
      "o",
    );
    const { workspace, root } = opened;
    workspace.root.execute(
      createComponent({ id: id("r"), name: "Inner", newId: workspace.newId }),
    );
    const innerInstance = (workspace.runtime.graph.getEntry(id("o")) as NodeEntry)
      .children[0]!;
    workspace.root.execute(
      createComponent({ id: id("o"), name: "Outer", newId: workspace.newId }),
    );
    const outerInstance = [...root.canvasInputs.values()].find(
      (r) => r.sourceId !== id("o") && r.collapsedIds?.some((c) => c.endsWith("::" + id("o"))),
    )!.sourceId as NodeId;
    const instances = [outerInstance, innerInstance, ...(extra ? [extra] : [])];
    const insert = () =>
      workspace.root.execute(
        insertNodes({
          parent: {
            kind: "descendant",
            ownerId: outerInstance,
            address: {
              instances: [outerInstance, innerInstance],
              templatePath: [id("r"), id("tb"), id("s")],
            },
          } as never,
          entries: [
            node("in-slot", "text", [], { children: "In" }, {
              all: ["isSelected"],
              from: {
                ancestor: {
                  address: { instances: instances as never, templatePath: templatePath(id("r")) as never },
                },
              },
            }),
          ],
          rootIds: [id("in-slot")],
          newId: workspace.newId,
        }),
      );
    return { ...opened, outerInstance, insert };
  };

  it("rv-m5 detaching the outer instance maps a nested slot child's address to the inner instance's new node", async () => {
    const { workspace, root, outerInstance, insert } = await nested((r) => [r, id("tb")]);
    insert();
    expect(shown(root, "in-slot")).toBe(true);
    workspace.root.execute(
      detachInstances({ ids: [outerInstance], newId: workspace.newId }),
    );
    expect(shown(root, "in-slot")).toBe(true);
  });

  it("rv-m6 a nested address whose instance step or path does not exist is refused", async () => {
    const missingStep = await nested((r) => [r, id("tb")], "project:node:missing");
    expect(code(missingStep.insert)).toBe("STATE_OWNER_UNLINKED");
    const missingRoot = await nested(() => [id("missing-root"), id("tb")]);
    expect(code(missingRoot.insert)).toBe("STATE_OWNER_UNLINKED");
  });
});
