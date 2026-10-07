// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  insertNodes,
  setFields,
} from "../../../../../../packages/shared/src/catalog/commands";
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
    definitionId: /^[a-z]/.test(type)
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

  it("a reference that is not linked is false — never another ancestor, even negated", async () => {
    for (const showWhen of [
      { all: ["isDisabled"], from: { ancestor: { nodeId: id("elsewhere") } } },
      {
        all: [{ not: "isDisabled" }],
        from: { ancestor: { nodeId: id("elsewhere") } },
      },
      // A Disclosure gives no isSelected: an address naming a part without the key is not linked.
      { all: ["isSelected"], from: { ancestor: { nodeId: id("a") } } },
    ] as CatalogShowWhen[]) {
      const { canvas, drawn } = await open(groups(true, true, showWhen), "a");
      expect(canvas("text")).toBe(false);
      expect(drawn("text")).toBe(false);
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
