/**
 * ADR-300 G1 — the SideNav family's place-derived state (Decision 3 · 4 · 5): the `isCollapsed` ·
 * `isCurrent` conditions, the panel → descendant collapse, the effective expanded keys and the
 * dependents a panel · nav change re-derives.
 */
import { describe, expect, it } from "vitest";
import {
  compileConditionTree,
  evaluateConditionTree,
} from "../../rule/conditionTree";
import type { CatalogConsumerNode } from "../compositionRoot";
import {
  catalogDerivedProps,
  catalogHiddenAtRest,
  catalogPresenceDependents,
  catalogPresenceScope,
} from "../presence";
import {
  catalogSideNavDependents,
  catalogSideNavEffectiveKeys,
  catalogSideNavPanelCollapsed,
  catalogSideNavStoredKeys,
} from "../sideNav";

type Spec = {
  type: string;
  props?: Record<string, unknown>;
  children?: string[];
  displayState?: string;
};

function tree(specs: Record<string, Spec>) {
  const parents = new Map<string, string>();
  for (const [id, spec] of Object.entries(specs))
    for (const child of spec.children ?? []) parents.set(child, id);
  const records = new Map<string, CatalogConsumerNode>();
  for (const [id, spec] of Object.entries(specs))
    records.set(id, {
      id,
      sourceId: id,
      definitionId: `lib:definition:type-${spec.type}`,
      bindingId: spec.type.toLowerCase(),
      parentId: parents.get(id) ?? "",
      children: spec.children ?? [],
      props: (spec.props ?? {}) as CatalogConsumerNode["props"],
      visual: {},
      layout: {},
      sizing: {},
      ...(spec.displayState ? { displayState: spec.displayState } : {}),
    } as unknown as CatalogConsumerNode);
  const types = new Map(Object.entries(specs).map(([id, s]) => [id, s.type]));
  const get = (id: string) => records.get(id);
  const typeOf = (node: CatalogConsumerNode) => types.get(node.id) ?? "";
  const set = (id: string, props: Record<string, unknown>) => {
    const node = records.get(id)!;
    records.set(id, {
      ...node,
      props: { ...node.props, ...props },
    } as CatalogConsumerNode);
  };
  return { get, typeOf, set, node: (id: string) => records.get(id)! };
}

/** The reference tree (§4): Guides > Color > Background Layers, a parent without link, a panel. */
function sample(panel: Record<string, unknown> = {}) {
  const item = (id: string, href: string | undefined, kids: string[] = []) => ({
    [id]: {
      type: "SideNavItem",
      props: { id, textValue: id, ...(href ? { href } : {}) },
      children: [`${id}-content`, ...kids],
    },
    [`${id}-content`]: {
      type: "SideNavItemContent",
      children: [`${id}-icon`, `${id}-link`, `${id}-chevron`],
    },
    [`${id}-icon`]: { type: "Icon", props: { iconName: "house" } },
    [`${id}-link`]: { type: "SideNavItemLink", children: [`${id}-text`] },
    [`${id}-text`]: { type: "Text", props: { children: id } },
    [`${id}-chevron`]: {
      type: "Button",
      props: { slot: "chevron" },
      children: [`${id}-glyph`],
    },
    [`${id}-glyph`]: { type: "Icon", props: { iconName: "chevron-right" } },
  });
  return tree({
    panel: {
      type: "SideNavPanel",
      props: panel,
      children: ["nav", "collapse"],
    },
    collapse: { type: "Button", props: { slot: "collapse" } },
    nav: {
      type: "SideNav",
      props: {
        selectedRoute: "/background-layers",
        expandedKeys: ["guidelines", "color"],
      },
      children: ["guidelines", "section"],
    },
    ...item("guidelines", "/guidelines", ["style", "color"]),
    ...item("style", "/style"),
    ...item("color", "/color", ["background-layers"]),
    ...item("background-layers", "/background-layers"),
    section: { type: "SideNavSection", children: ["header", "support"] },
    header: { type: "SideNavHeader", children: ["header-text"] },
    "header-text": { type: "Text", props: { children: "More" } },
    ...item("support", undefined, ["contact-us"]),
    ...item("contact-us", "/contact-us"),
  });
}

describe("ADR-300 G1 — conditions", () => {
  it("`isCollapsed` · `isCurrent` evaluate without CONDITION_TREE_UNKNOWN_KEY", () => {
    const tree = { default: "block", isCollapsed: "none" };
    expect(evaluateConditionTree(tree, { isCollapsed: true })).toBe("none");
    expect(evaluateConditionTree(tree, {})).toBe("block");
    expect(
      evaluateConditionTree(
        { default: 400, isCurrent: 700 },
        { isCurrent: true },
      ),
    ).toBe(700);
  });

  it("the DOM selector is S2's panel ancestor (`[data-side-panel-collapsed]`)", () => {
    const [, collapsed] = compileConditionTree(
      { default: "block", isCollapsed: "none" },
      ".react-aria-Text",
      "display",
    );
    expect(collapsed!.selector).toBe(
      ".react-aria-Text:where(:is([data-side-panel-collapsed], [data-side-panel-collapsed] *))",
    );
  });
});

describe("ADR-300 G1 — panel → descendants (Decision 3)", () => {
  it("every part below a collapsed panel derives `_sideNavCollapsed`; an open panel none", () => {
    const open = sample();
    expect(
      catalogDerivedProps(open.node("style-text"), open.get, open.typeOf)
        ?._sideNavCollapsed,
    ).toBeUndefined();
    const collapsed = sample({ isCollapsed: true });
    for (const id of ["panel", "nav", "style", "style-content", "style-text"])
      expect(
        catalogDerivedProps(collapsed.node(id), collapsed.get, collapsed.typeOf)
          ?._sideNavCollapsed,
      ).toBe(true);
    // (`defaultCollapsed` while `isCollapsed` is unset; an own `false` wins.)
    expect(
      catalogDerivedProps(
        sample({ defaultCollapsed: true }).node("nav"),
        sample({ defaultCollapsed: true }).get,
        sample().typeOf,
      )?._sideNavCollapsed,
    ).toBe(true);
    const own = sample({ defaultCollapsed: true, isCollapsed: false });
    expect(
      catalogDerivedProps(own.node("nav"), own.get, own.typeOf)
        ?._sideNavCollapsed,
    ).toBeUndefined();
  });

  it("a collapsed panel hides the row text · chevrons · headers, not the icons", () => {
    const t = sample({ isCollapsed: true });
    const hidden = (id: string) =>
      catalogHiddenAtRest(t.node(id), t.get, t.typeOf);
    expect(hidden("guidelines-text")).toBe(true);
    expect(hidden("guidelines-chevron")).toBe(true);
    expect(hidden("header")).toBe(true);
    expect(hidden("guidelines-icon")).toBe(false);
    expect(hidden("guidelines")).toBe(false);
    expect(hidden("collapse")).toBe(false);
    const open = sample();
    expect(
      catalogHiddenAtRest(open.node("guidelines-text"), open.get, open.typeOf),
    ).toBe(false);
  });

  it("the panel's change re-derives every part below it (⑤ dependents)", () => {
    const t = sample();
    const ids = catalogSideNavDependents(t.node("panel"), t.get, t.typeOf).map(
      (node) => node.id,
    );
    expect(ids).toEqual(
      expect.arrayContaining(["nav", "background-layers-text", "header"]),
    );
    expect(catalogPresenceScope(t.node("panel"), t.get, t.typeOf)?.id).toBe(
      "panel",
    );
    expect(
      catalogPresenceDependents(t.node("panel"), t.get, t.typeOf).map(
        (n) => n.id,
      ),
    ).toEqual(expect.arrayContaining(["style-text", "color-chevron"]));
  });
});

describe("ADR-300 G1 — effective expanded keys (Decision 4)", () => {
  it("a collapsed panel gives RAC no keys and keeps the stored ones", () => {
    const t = sample({ isCollapsed: true });
    const nav = t.node("nav");
    expect(catalogSideNavStoredKeys(nav)).toEqual(["guidelines", "color"]);
    expect(catalogSideNavEffectiveKeys(nav, t.get, t.typeOf)).toEqual([]);
    expect(catalogHiddenAtRest(t.node("style"), t.get, t.typeOf)).toBe(true);
    // (expanded again — the stored keys come back)
    t.set("panel", { isCollapsed: false });
    expect(catalogSideNavEffectiveKeys(t.node("nav"), t.get, t.typeOf)).toEqual(
      ["guidelines", "color"],
    );
    expect(catalogHiddenAtRest(t.node("style"), t.get, t.typeOf)).toBe(false);
  });

  it("a closed item's child items are hidden; a leaf's chevron glyph is not drawn", () => {
    const t = sample();
    const hidden = (id: string) =>
      catalogHiddenAtRest(t.node(id), t.get, t.typeOf);
    expect(hidden("contact-us")).toBe(true); // support is closed
    expect(hidden("background-layers")).toBe(false);
    expect(hidden("style-glyph")).toBe(true); // a leaf
    expect(hidden("color-glyph")).toBe(false);
  });
});

describe("ADR-300 G1 — current route (Decision 5)", () => {
  it("the current row and a closed current ancestor carry `_sideNavCurrent`", () => {
    const t = sample();
    const current = (id: string) =>
      catalogDerivedProps(t.node(id), t.get, t.typeOf)?._sideNavCurrent ===
      true;
    expect(current("background-layers")).toBe(true);
    // (open ancestors are not marked)
    expect(current("guidelines")).toBe(false);
    expect(current("color")).toBe(false);
    // collapsed: every item is closed → the top current ancestor shows the mark (S2 `:464`)
    const rail = sample({ isCollapsed: true });
    expect(
      catalogDerivedProps(rail.node("guidelines"), rail.get, rail.typeOf)
        ?._sideNavCurrent,
    ).toBe(true);
  });

  it("an item's level (1 = the nav's or a section's child)", () => {
    const t = sample();
    const level = (id: string) =>
      catalogDerivedProps(t.node(id), t.get, t.typeOf)?._sideNavLevel;
    expect(level("guidelines")).toBe(1);
    expect(level("background-layers")).toBe(3);
    expect(level("support")).toBe(1);
    expect(level("color-content")).toBe(2);
  });
});

describe("ADR-300 Phase 4 — a Library card's state samples (displayState)", () => {
  const lone = (type: string, displayState?: string) =>
    tree({ sample: { type, displayState } });

  it("a row drawn alone in the Current sample is current (no SideNav, no route)", () => {
    const current = lone("SideNavItem", "current");
    const rest = lone("SideNavItem");
    expect(
      catalogDerivedProps(current.node("sample"), current.get, current.typeOf)
        ?._sideNavCurrent,
    ).toBe(true);
    expect(
      catalogDerivedProps(rest.node("sample"), rest.get, rest.typeOf)
        ?._sideNavCurrent,
    ).toBeUndefined();
  });

  it("a panel in the Collapsed sample is collapsed (no prop)", () => {
    expect(
      catalogSideNavPanelCollapsed(
        lone("SideNavPanel", "collapsed").node("sample"),
      ),
    ).toBe(true);
    expect(
      catalogSideNavPanelCollapsed(lone("SideNavPanel").node("sample")),
    ).toBe(false);
  });
});
