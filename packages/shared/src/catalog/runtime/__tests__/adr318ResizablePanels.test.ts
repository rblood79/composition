/**
 * ADR-318 G1 — the Resizable split view's size formula (Decision 3 · breakdown §5.2): the Panels'
 * shares (sum 100), their min · max on the Group's axis, the Handle's axis (the re-derive on a Group ·
 * Panel edit and its undo is the real root's — `adr318ResizableWiring.test.tsx`). The expected values are written out (Q5 — not computed by the code).
 */
import { describe, expect, it } from "vitest";
import type { CatalogConsumerNode } from "../compositionRoot";
import { catalogDerivedProps } from "../presence";
import {
  catalogResizableDisplay,
  catalogResizablePanelDomId,
  catalogResizableLength,
  catalogResizableLayout,
  catalogResizablePanelShares,
} from "../resizablePanels";
import {
  catalogResizableMoveCollapsing,
  catalogResizableLimits,
  catalogResizableMove,
  catalogResizableRange,
  catalogResizableShareValue,
} from "../resizableDrag";
import {
  catalogResizableRemembered,
  catalogStoreResizablePanels,
  catalogStoredResizablePanels,
} from "../resizableStorage";

type Spec = {
  type: string;
  props?: Record<string, unknown>;
  children?: string[];
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
    } as unknown as CatalogConsumerNode);
  const types = new Map(Object.entries(specs).map(([id, s]) => [id, s.type]));
  const get = (id: string) => records.get(id);
  const typeOf = (node: CatalogConsumerNode) => types.get(node.id) ?? "";
  const derived = (id: string) => catalogDerivedProps(get(id)!, get, typeOf);
  return { get, typeOf, derived };
}

const split = (
  orientation: string | undefined,
  panels: Record<string, unknown>[],
) => {
  const specs: Record<string, Spec> = {};
  const children: string[] = [];
  panels.forEach((props, i) => {
    if (i > 0) {
      specs[`h${i}`] = { type: "ResizableHandle" };
      children.push(`h${i}`);
    }
    specs[`p${i}`] = { type: "ResizablePanel", props };
    children.push(`p${i}`);
  });
  specs.g = {
    type: "ResizablePanelGroup",
    props: orientation ? { orientation } : {},
    children,
  };
  return tree(specs);
};

describe("ADR-318 — Resizable shares (sum 100)", () => {
  it("unset sizes share equally", () => {
    expect(catalogResizablePanelShares([{}, {}])).toEqual([50, 50]);
  });
  it("an authored size keeps its own; the rest share what remains", () => {
    expect(
      catalogResizablePanelShares([
        { defaultSize: 25 },
        {},
        { defaultSize: 25 },
      ]),
    ).toEqual([25, 50, 25]);
  });
  it("a `%` text is a % (reui example 4)", () => {
    expect(
      catalogResizablePanelShares([
        { defaultSize: "30%" },
        { defaultSize: 70 },
      ]),
    ).toEqual([30, 70]);
  });
  it("a sum that is not 100 is scaled to 100", () => {
    expect(
      catalogResizablePanelShares([{ defaultSize: 30 }, { defaultSize: 30 }]),
    ).toEqual([50, 50]);
    // (the authored ones over 100 leave nothing to the unset one)
    expect(
      catalogResizablePanelShares([
        { defaultSize: 80 },
        { defaultSize: 40 },
        {},
      ]).map((v) => Math.round(v * 100) / 100),
    ).toEqual([66.67, 33.33, 0]);
  });
  it("lengths: a number or unitless · % text is a %, Npx stays px, else none", () => {
    expect(catalogResizableLength(20)).toBe("20%");
    expect(catalogResizableLength("20")).toBe("20%");
    expect(catalogResizableLength("20%")).toBe("20%");
    expect(catalogResizableLength("200px")).toBe("200px");
    expect(catalogResizableLength("200em")).toBeUndefined();
    expect(catalogResizableLength(-1)).toBeUndefined();
  });
});

describe("ADR-318 — Panel · Handle derived values", () => {
  it("a horizontal Group's Panels: share · min · max on the row axis", () => {
    const t = split(undefined, [
      { defaultSize: 30, minSize: "200px", maxSize: 60 },
      {},
    ]);
    expect(t.derived("p0")).toEqual({
      _panelGrow: 30,
      _panelShare: 30,
      _panelAxis: "row",
      _panelMin: "200px",
      _panelMax: "60%",
    });
    expect(t.derived("p1")).toEqual({
      _panelGrow: 70,
      _panelShare: 70,
      _panelAxis: "row",
    });
    expect(t.derived("h1")).toEqual({
      orientation: "horizontal",
      _resizableHandleAxis: "row",
    });
    expect(catalogResizableLayout(t.derived("h1"))).toEqual({ width: "1px" });
    expect(catalogResizableLayout(t.derived("g"))).toEqual({
      flexDirection: "row",
    });
    expect(catalogResizableLayout(t.derived("p0"))).toEqual({
      flexGrow: 30,
      flexShrink: 1,
      flexBasis: "0px",
      minWidth: "200px",
      maxWidth: "60%",
    });
  });
  it("a vertical Group: the column axis · the Handle takes the Group's axis", () => {
    const t = split("vertical", [{ minSize: "25%" }, {}]);
    expect(catalogResizableLayout(t.derived("p0"))).toEqual({
      flexGrow: 50,
      flexShrink: 1,
      flexBasis: "0px",
      minHeight: "25%",
    });
    expect(t.derived("h1")).toEqual({
      orientation: "vertical",
      _resizableHandleAxis: "column",
    });
    expect(catalogResizableLayout(t.derived("h1"))).toEqual({ height: "1px" });
    expect(catalogResizableLayout(t.derived("g"))).toEqual({
      flexDirection: "column",
    });
  });
  it("a record that is not a Panel writes no flex values", () => {
    expect(catalogResizableLayout(undefined)).toEqual({});
    expect(catalogResizableLayout({ _justified: true })).toEqual({});
  });
});

describe("ADR-318 G2 — the drag · key calculation (written-out answers)", () => {
  const free = { min: [0, 0, 0], max: [100, 100, 100] };
  it("a move changes only the two Panels beside the Handle (사용자 결정 4)", () => {
    expect(catalogResizableMove([25, 50, 25], 0, 10, free)).toEqual([
      35, 40, 25,
    ]);
    expect(catalogResizableMove([25, 50, 25], 1, -20, free)).toEqual([
      25, 30, 45,
    ]);
  });
  it("it stops where either Panel reaches its min or max — not passing it on", () => {
    const limits = { min: [20, 30, 0], max: [60, 100, 100] };
    // front min 20
    expect(catalogResizableMove([40, 40, 20], 0, -50, limits)).toEqual([
      20, 60, 20,
    ]);
    // back min 30 → front max 50
    expect(catalogResizableMove([40, 40, 20], 0, 50, limits)).toEqual([
      50, 30, 20,
    ]);
    // front max 60 over a wide back Panel
    expect(
      catalogResizableMove([40, 60], 0, 50, { min: [0, 0], max: [60, 100] }),
    ).toEqual([60, 40]);
  });
  it("no move returns the same sizes (no write)", () => {
    const sizes = [20, 80];
    expect(
      catalogResizableMove(sizes, 0, -5, { min: [20, 0], max: [100, 100] }),
    ).toBe(sizes);
  });
  it("Home · End go to the range ends; the range is the separator's min · max", () => {
    const limits = { min: [10, 20], max: [70, 100] };
    expect(catalogResizableMove([50, 50], 0, -100, limits)).toEqual([10, 90]);
    expect(catalogResizableMove([50, 50], 0, 100, limits)).toEqual([70, 30]);
    expect(catalogResizableRange([50, 50], 0, limits)).toEqual({
      lo: 10,
      hi: 70,
    });
  });
  it("limits: px over the shared space; % of the whole Group (CSS) over the shared space", () => {
    // Group 600, two 1px Handles → space 598.
    const limits = catalogResizableLimits(
      [{ _panelMin: "200px" }, { _panelMax: "50%" }, undefined],
      600,
      598,
    );
    expect(limits.min[0]).toBeCloseTo((200 / 598) * 100, 6);
    expect(limits.max[1]).toBeCloseTo((50 * 600) / 598, 6);
    expect([limits.min[2], limits.max[2]]).toEqual([0, 100]);
  });
  it("a Panel's DOM id is stable per record and a valid id", () => {
    const a = catalogResizablePanelDomId({
      id: "project:node:x/lib:template:y::z",
    });
    expect(a).toBe(
      catalogResizablePanelDomId({ id: "project:node:x/lib:template:y::z" }),
    );
    expect(a).toMatch(/^resizable-panel-[0-9a-z]+$/);
    expect(a).not.toBe(
      catalogResizablePanelDomId({ id: "project:node:x/other" }),
    );
    // (its HTML id when it has one — the id the DOM writes)
    expect(
      catalogResizablePanelDomId({ id: "x", htmlId: "resizablepanel_1" }),
    ).toBe("resizablepanel_1");
  });
});

describe("ADR-318 G3 — collapse (written-out answers)", () => {
  it("display: a % collapsed Panel draws its size, the others share the rest in their ratio", () => {
    expect(
      catalogResizableDisplay(
        [30, 50, 20],
        [true, false, false],
        ["10%", undefined, undefined],
      ),
    ).toEqual([
      { grow: 10 },
      { grow: 64.28571428571429 },
      { grow: 25.714285714285715 },
    ]);
  });
  it("display: a px collapsed Panel is a basis with no share; nothing collapsed = the shares", () => {
    expect(
      catalogResizableDisplay([30, 70], [true, false], ["48px", undefined]),
    ).toEqual([{ grow: 0, basis: "48px" }, { grow: 100 }]);
    expect(
      catalogResizableDisplay([30, 70], [false, false], ["0%", undefined]),
    ).toEqual([{ grow: 30 }, { grow: 70 }]);
  });
  it("a start-collapsed collapsible Panel draws collapsed on the Canvas; a non-collapsible one ignores it", () => {
    const t = split(undefined, [
      {
        defaultSize: 30,
        collapsible: true,
        collapsedSize: "5%",
        isCollapsed: true,
        minSize: 20,
      },
      {},
    ]);
    expect(t.derived("p0")).toMatchObject({
      _panelGrow: 5,
      _panelShare: 30,
      _panelCollapsed: true,
      _panelCollapsedSize: "5%",
    });
    expect(t.derived("p0")).not.toHaveProperty("_panelMin");
    expect(t.derived("p1")).toMatchObject({ _panelGrow: 95 });
    const u = split(undefined, [{ defaultSize: 30, isCollapsed: true }, {}]);
    expect(u.derived("p0")).toMatchObject({ _panelGrow: 30 });
    expect(u.derived("p0")).not.toHaveProperty("_panelCollapsed");
  });
  const limits = { min: [20, 20], max: [100, 100] };
  const info = { collapsible: [true, true], collapsedShare: [0, 0] };
  it("a drag below the middle of min and collapsed size collapses; above it stays at min", () => {
    // min 20, collapsed 0 → the middle is 10.
    expect(
      catalogResizableMoveCollapsing(
        [50, 50],
        [false, false],
        0,
        -41,
        limits,
        info,
      ),
    ).toEqual({
      sizes: [0, 100],
      collapsed: [true, false],
    });
    expect(
      catalogResizableMoveCollapsing(
        [50, 50],
        [false, false],
        0,
        -39,
        limits,
        info,
      ),
    ).toEqual({
      sizes: [20, 80],
      collapsed: [false, false],
    });
  });
  it("a collapsed Panel pulled past the middle expands to its min", () => {
    expect(
      catalogResizableMoveCollapsing(
        [0, 100],
        [true, false],
        0,
        11,
        limits,
        info,
      ),
    ).toEqual({
      sizes: [20, 80],
      collapsed: [false, false],
    });
    const stay = { sizes: [0, 100], collapsed: [true, false] };
    const result = catalogResizableMoveCollapsing(
      stay.sizes,
      stay.collapsed,
      0,
      9,
      limits,
      info,
    );
    expect(result.sizes).toBe(stay.sizes);
  });
  it("the back Panel collapses the same way; a non-collapsible Panel stops at its min", () => {
    expect(
      catalogResizableMoveCollapsing(
        [50, 50],
        [false, false],
        0,
        41,
        limits,
        info,
      ),
    ).toEqual({
      sizes: [100, 0],
      collapsed: [false, true],
    });
    expect(
      catalogResizableMoveCollapsing([50, 50], [false, false], 0, -45, limits, {
        collapsible: [false, false],
        collapsedShare: [0, 0],
      }).sizes,
    ).toEqual([20, 80]);
  });
});

describe("ADR-318 Phase 5 — 「Remember sizes」 storage (사용자 결정 5)", () => {
  const memory = () => {
    const map = new Map<string, string>();
    return {
      map,
      getItem: (key: string) => map.get(key) ?? null,
      setItem: (key: string, value: string) => void map.set(key, value),
      removeItem: (key: string) => void map.delete(key),
    };
  };
  it("keeps only a Panel's share (0 ~ 100) and collapse — nothing else", () => {
    expect(
      catalogResizableRemembered({
        size: 33.33,
        isCollapsed: true,
        style: { width: 1 },
        selectedKeys: ["a"],
      }),
    ).toEqual({ size: 33.33, isCollapsed: true });
    expect(catalogResizableRemembered({ size: 140 })).toEqual({});
    expect(catalogResizableRemembered({ size: Number.NaN })).toEqual({});
    expect(catalogResizableRemembered({ isCollapsed: "yes" })).toEqual({});
  });
  it("stores per project and reads back what it stored; empty = the key is removed", () => {
    const storage = memory();
    catalogStoreResizablePanels(storage, "p1", {
      a: { size: 40 },
      b: { isCollapsed: true },
    });
    expect(catalogStoredResizablePanels(storage, "p1")).toEqual({
      a: { size: 40 },
      b: { isCollapsed: true },
    });
    expect(catalogStoredResizablePanels(storage, "p2")).toEqual({});
    catalogStoreResizablePanels(storage, "p1", {});
    expect(storage.map.size).toBe(0);
  });
  it("a broken · foreign stored value reads as none (no throw)", () => {
    const storage = memory();
    storage.setItem("composition:resizable:v1:p1", "{not json");
    expect(catalogStoredResizablePanels(storage, "p1")).toEqual({});
    storage.setItem(
      "composition:resizable:v1:p1",
      JSON.stringify({ a: { size: "wide" }, b: 3, c: { size: 25 } }),
    );
    expect(catalogStoredResizablePanels(storage, "p1")).toEqual({
      c: { size: 25 },
    });
    expect(catalogStoredResizablePanels(null, "p1")).toEqual({});
  });
  it("a share is kept to 0.01 % (the sub-pixel rest of a drag)", () => {
    expect(catalogResizableShareValue(45.62030956)).toBe(45.62);
  });
});
