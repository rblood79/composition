import { describe, expect, it } from "vitest";
import { resolveCatalogNode } from "../../resolution/resolver";
import { applyCatalogTransaction } from "../../transactions/transaction";
import { CatalogGraph } from "../graph";
import { buildCatalogLibrary } from "../library";
import type {
  CatalogDocument,
  CatalogFillLayer,
  LibraryDefinition,
  NodeEntry,
} from "../types";
import { CatalogValidationError, validateCatalogEntry } from "../validation";

/**
 * ADR-248 Phase 4a: the node authoring surface the Builder Style panel writes today —
 * box layout, typography/effect/per-side keys, fill layers, fill sizing intent, tablet/mobile
 * layers with a desktop-first cascade, per-breakpoint visibility and a node theme override.
 */
const frame: LibraryDefinition = {
  id: "lib:definition:frame",
  name: "frame",
  mode: "native",
  bindingId: "frame",
  accepts: {},
  defaults: {},
  visual: {},
  layout: { display: "block" },
  stateRules: {},
};
const library = () =>
  buildCatalogLibrary({
    contractVersion: 3,
    revision: "node-authoring",
    bindingIds: ["frame"],
    actionOpCodes: [],
    definitions: [frame],
    templates: [],
    tokens: [],
  });
const node = (id: string, patch: Partial<NodeEntry> = {}): NodeEntry => ({
  kind: "node",
  id: `project:node:${id}`,
  definitionId: "lib:definition:frame",
  children: [],
  props: {},
  visual: {},
  sizing: {},
  descendantOverrides: [],
  ...patch,
});
function graph(nodes: NodeEntry[], roots = nodes.map((item) => item.id)) {
  const document: CatalogDocument = {
    format: "composition-catalog",
    schemaVersion: 1,
    libraryContractVersion: 3,
    revision: 0,
    projectId: "project:project:p",
    rootId: "project:project:p",
    entries: {
      "project:project:p": {
        kind: "project",
        id: "project:project:p",
        name: "p",
        pageIds: ["project:page:main"],
        definitionIds: [],
        overrideIds: [],
        themeIds: [],
        tokenIds: [],
        stateVariableIds: [],
        interactionIds: [],
        assetIds: [],
      },
      "project:page:main": {
        kind: "page",
        id: "project:page:main",
        route: "/",
        name: "main",
        children: roots,
      },
      ...Object.fromEntries(nodes.map((item) => [item.id, item])),
    },
  };
  return new CatalogGraph(document, library());
}
const code = (run: () => unknown): string => {
  try {
    run();
  } catch (error) {
    if (error instanceof CatalogValidationError) return error.code;
    throw error;
  }
  return "ACCEPTED";
};
const set = <T>(value: T) => ({ kind: "set" as const, value });
const gradient: CatalogFillLayer = {
  kind: "linear-gradient",
  id: "fill-1",
  enabled: true,
  opacity: 1,
  blendMode: "normal",
  stops: [
    { color: "#ff0000ff", position: 0 },
    { color: "#0000ffff", position: 1 },
  ],
  rotation: 90,
};

describe("ADR-248 Phase 4a node authoring schema", () => {
  it("accepts the Style panel surface as typed node fields", () => {
    expect(
      code(() =>
        validateCatalogEntry(
          node("full", {
            layout: {
              display: set("flex"),
              flexDirection: set("row"),
              position: set("absolute"),
              insetRight: set("4px"),
              insetBottom: set("0"),
              marginTop: set("8px"),
            },
            visual: {
              fontFamily: set("Inter"),
              fontStyle: set("italic"),
              letterSpacing: set(0.5),
              textAlign: set("center"),
              textTransform: set("uppercase"),
              textDecoration: set("underline"),
              whiteSpace: set("nowrap"),
              wordBreak: set("break-all"),
              overflowWrap: set("break-word"),
              textOverflow: set("ellipsis"),
              boxShadow: set("0 1px 2px rgba(0,0,0,0.2)"),
              filter: set("blur(2px)"),
              transform: set("rotate(10deg)"),
              zIndex: set(2),
              aspectRatio: set("16 / 9"),
              backgroundImage: set("url(a.png)"),
              backgroundSize: set("cover"),
              radiusTopLeft: set(4),
              borderTopWidth: set(1),
            },
            fills: [gradient],
            fillSizing: { width: { factor: 1 }, height: null },
            responsive: {
              tablet: {
                layout: { flexDirection: set("column") },
                visual: { fontSize: set(14) },
              },
              mobile: { sizing: { width: set(320) } },
            },
            visibility: { mobile: false },
            themeOverride: { mode: "dark", tint: "blue" },
          }),
        ),
      ),
    ).toBe("ACCEPTED");
  });

  it("rejects unknown keys, invalid values and a desktop responsive layer", () => {
    expect(
      code(() =>
        validateCatalogEntry(node("a", { layout: { display: set("table") } })),
      ),
    ).toBe("INVALID_LAYOUT_VALUE");
    expect(
      code(() =>
        validateCatalogEntry(
          node("b", {
            visual: { textAlign: set("middle") } as NodeEntry["visual"],
          }),
        ),
      ),
    ).toBe("VISUAL_VALUE_CHOICE");
    expect(
      code(() =>
        validateCatalogEntry(
          node("b2", {
            visual: { textOverflow: set("fade") } as NodeEntry["visual"],
          }),
        ),
      ),
    ).toBe("VISUAL_VALUE_CHOICE");
    expect(
      code(() =>
        validateCatalogEntry(
          node("c", {
            responsive: { desktop: {} } as NodeEntry["responsive"],
          }),
        ),
      ),
    ).toBe("RESPONSIVE_BREAKPOINT");
    expect(
      code(() =>
        validateCatalogEntry(
          node("d", {
            fills: [{ ...gradient, opacity: 2 }],
          }),
        ),
      ),
    ).toBe("FILL_OPACITY_RANGE");
    expect(
      code(() =>
        validateCatalogEntry(
          node("e", {
            fillSizing: { width: { factor: 0 } },
          }),
        ),
      ),
    ).toBe("FILL_FACTOR_RANGE");
    expect(
      code(() =>
        validateCatalogEntry(
          node("f", {
            themeOverride: {
              mode: "sepia",
            } as unknown as NodeEntry["themeOverride"],
          }),
        ),
      ),
    ).toBe("THEME_OVERRIDE_VALUE");
  });

  it("resolves node layout over the definition layout and cascades desktop → tablet → mobile", () => {
    const g = graph([
      node("box", {
        layout: { display: set("flex"), flexDirection: set("row") },
        visual: { fontSize: set(16), color: set("#111111") },
        sizing: { width: set(800) },
        responsive: {
          tablet: {
            layout: { flexDirection: set("column") },
            visual: { fontSize: set(14) },
          },
          mobile: { sizing: { width: set(320) } },
        },
        fills: [gradient],
        fillSizing: { width: { factor: 1 } },
        themeOverride: { mode: "dark" },
      }),
    ]);
    const desktop = resolveCatalogNode(g, "project:node:box");
    expect(desktop.layout).toEqual({ display: "flex", flexDirection: "row" });
    expect(desktop.visual).toMatchObject({ fontSize: 16, color: "#111111" });
    expect(desktop.sizing).toEqual({ width: 800 });
    expect(desktop.fills).toEqual([gradient]);
    expect(desktop.fillSizing).toEqual({ width: { factor: 1 } });
    expect(desktop.themeOverride).toEqual({ mode: "dark" });

    const tablet = resolveCatalogNode(
      g,
      "project:node:box",
      undefined,
      undefined,
      "tablet",
    );
    expect(tablet.layout.flexDirection).toBe("column");
    expect(tablet.visual.fontSize).toBe(14);
    expect(tablet.sizing.width).toBe(800);

    // mobile inherits tablet (desktop-first cascade) and adds its own layer.
    const mobile = resolveCatalogNode(
      g,
      "project:node:box",
      undefined,
      undefined,
      "mobile",
    );
    expect(mobile.layout.flexDirection).toBe("column");
    expect(mobile.visual.fontSize).toBe(14);
    expect(mobile.sizing.width).toBe(320);
  });

  it("hides a node at a breakpoint where visibility is false, cascading like other layers", () => {
    const g = graph(
      [
        node("root", {
          children: ["project:node:child"],
        }),
        node("child", { visibility: { tablet: false } }),
      ],
      ["project:node:root"],
    );
    const resolve = (breakpoint?: "desktop" | "tablet" | "mobile") =>
      resolveCatalogNode(
        g,
        "project:node:root",
        undefined,
        undefined,
        breakpoint,
      ).children.map((item) => item.sourceId);
    expect(resolve()).toEqual(["project:node:child"]);
    expect(resolve("tablet")).toEqual([]);
    expect(resolve("mobile")).toEqual([]);
  });

  it("patches layout, a breakpoint layer and whole fields with exact inverses", () => {
    const g = graph([node("box")]);
    const before = g.getEntry("project:node:box");
    const result = applyCatalogTransaction(g, {
      projectId: "project:project:p",
      expectedRevision: 0,
      history: { kind: "record", label: "style" },
      ops: [
        {
          kind: "patchNodeLayout",
          id: "project:node:box",
          key: "flexDirection",
          write: set("column"),
        },
        {
          kind: "patchNodeVisual",
          id: "project:node:box",
          key: "fontSize",
          write: set(12),
          breakpoint: "mobile",
        },
        {
          kind: "setNodeField",
          id: "project:node:box",
          field: "fills",
          value: [gradient],
        },
        {
          kind: "setNodeField",
          id: "project:node:box",
          field: "visibility",
          value: { mobile: false },
        },
      ],
    });
    const after = g.getEntry("project:node:box") as NodeEntry;
    expect(after.layout).toEqual({ flexDirection: set("column") });
    expect(after.responsive).toEqual({
      mobile: { visual: { fontSize: set(12) } },
    });
    expect(after.fills).toEqual([gradient]);
    expect(after.visibility).toEqual({ mobile: false });
    expect([...result.changedIds]).toEqual(["project:node:box"]);
    // Leaf patches stay on the leaf path: no whole-graph validation.
    expect(g.metrics.transactionEntriesTraversed).toBe(0);

    applyCatalogTransaction(g, {
      projectId: "project:project:p",
      expectedRevision: 1,
      history: { kind: "record", label: "undo" },
      ops: result.inverse,
    });
    expect(g.getEntry("project:node:box")).toEqual(before);
  });
});
