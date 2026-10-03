import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  EntryId,
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import {
  insertNodes,
  setFields,
} from "../../../../../../packages/shared/src/catalog/commands";
import { newCatalogProjectDocument } from "../project";
import {
  BORDER_COMPANION_COLOR,
  catalogAuthoredValues,
  CatalogStyleValueError,
  catalogStyleView,
  catalogStyleWrites,
  catalogStyleWritesOf,
} from "../styleFields";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * ADR-248 Phase 4e-4d: the Styles panel's CSS keys ↔ the catalog node's typed fields — each key in
 * its typed field and unit, an empty value removes, and the typed writes draw what the CSS said.
 */
const set = (value: unknown) => ({ kind: "set", value });
const REMOVE = { kind: "remove" };

describe("ADR-248 Phase 4e-4d style fields", () => {
  it("maps each CSS key to its typed field and unit", () => {
    expect(catalogStyleWrites("paddingTop", "12px")).toEqual({
      visual: { paddingTop: set(12) },
    });
    expect(catalogStyleWrites("borderRadius", "8px")).toEqual({
      visual: { radius: set(8) },
    });
    expect(catalogStyleWrites("borderTopLeftRadius", 4)).toEqual({
      visual: { radiusTopLeft: set(4) },
    });
    expect(catalogStyleWrites("gap", "16px")).toEqual({
      visual: { gap: set(16) },
    });
    expect(catalogStyleWrites("rowGap", 8)).toEqual({
      layout: { rowGap: set("8px") },
    });
    expect(catalogStyleWrites("flexDirection", "column")).toEqual({
      layout: { flexDirection: set("column") },
    });
    expect(catalogStyleWrites("left", "10px")).toEqual({
      layout: { insetLeft: set("10px") },
    });
    expect(catalogStyleWrites("opacity", "50%")).toEqual({
      visual: { opacity: set(0.5) },
    });
    expect(catalogStyleWrites("fontWeight", "bold")).toEqual({
      visual: { fontWeight: set(700) },
    });
    // A px line height is the ratio to the node's font size; unitless is the ratio itself.
    expect(catalogStyleWrites("lineHeight", "24px", { fontSize: 16 })).toEqual({
      visual: { lineHeight: set(1.5) },
    });
    expect(catalogStyleWrites("lineHeight", "1.25")).toEqual({
      visual: { lineHeight: set(1.25) },
    });
    // width: px = fixed sizing; other CSS text = visual length; auto = neither.
    expect(catalogStyleWrites("width", "120px")).toEqual({
      visual: { width: REMOVE },
      sizing: { width: set(120) },
    });
    expect(catalogStyleWrites("width", "50%")).toEqual({
      visual: { width: set("50%") },
      sizing: { width: REMOVE },
    });
    expect(catalogStyleWrites("height", "auto")).toEqual({
      visual: { height: REMOVE },
      sizing: { height: REMOVE },
    });
    // min: px = fixed sizing; a relative or viewport length = visual length; others refused.
    expect(catalogStyleWrites("minWidth", "50%")).toEqual({
      visual: { minWidth: set("50%") },
      sizing: { minWidth: REMOVE },
    });
    expect(catalogStyleWrites("minHeight", "10vh")).toEqual({
      visual: { minHeight: set("10vh") },
      sizing: { minHeight: REMOVE },
    });
    expect(catalogStyleWrites("minWidth", "24px")).toEqual({
      visual: { minWidth: REMOVE },
      sizing: { minWidth: set(24) },
    });
    expect(() => catalogStyleWrites("minWidth", "wide")).toThrow(
      CatalogStyleValueError,
    );
    expect(catalogStyleWrites("maxWidth", "none")).toEqual({
      sizing: { maxWidth: REMOVE },
      layout: { maxWidth: REMOVE },
    });
    expect(catalogStyleWrites("padding", "4px 8px")).toEqual({
      visual: {
        paddingTop: set(4),
        paddingRight: set(8),
        paddingBottom: set(4),
        paddingLeft: set(8),
      },
      layout: {},
      sizing: {},
    });
    expect(catalogStyleWrites("color", "")).toEqual({
      visual: { color: REMOVE },
    });
    expect(() => catalogStyleWrites("fontSize", "large")).toThrow(
      CatalogStyleValueError,
    );
    expect(() => catalogStyleWrites("cursor", "pointer")).toThrow(
      CatalogStyleValueError,
    );
    // A batch's own font size is the one its px line height relates to.
    expect(
      catalogStyleWritesOf({ fontSize: "20px", lineHeight: "30px" }).visual,
    ).toEqual({ fontSize: set(20), lineHeight: set(1.5) });
  });

  it("reads typed fields back as the CSS view", () => {
    expect(
      catalogStyleView({
        visual: {
          paddingTop: 12,
          radius: 8,
          fontSize: 16,
          lineHeight: 1.5,
          fontWeight: 600,
          opacity: 0.5,
          width: "50%",
          color: "#ff0000",
        },
        layout: { flexDirection: "column", insetLeft: "10px", rowGap: "8px" },
        sizing: { height: 40, minWidth: 20 },
      }),
    ).toEqual({
      paddingTop: "12px",
      borderRadius: "8px",
      fontSize: "16px",
      lineHeight: "24px",
      fontWeight: 600,
      opacity: 0.5,
      width: "50%",
      color: "#ff0000",
      flexDirection: "column",
      left: "10px",
      rowGap: "8px",
      height: "40px",
      minWidth: "20px",
    });
  });

  it("the typed writes draw what the CSS said (layout box of a node)", async () => {
    const workspace = new CatalogWorkspace(
      new CatalogGraph(
        newCatalogProjectDocument({
          projectId: "project:project:style" as EntryId<"project">,
          name: "Style",
        }),
        await buildCodeCatalogLibrary(),
      ),
      new CatalogStorage(indexedDB, `adr248-phase4e-style-${Math.random()}`),
      {
        engine: await nodeLayoutEngine(),
        viewport: { width: 1000, height: 800 },
        autosaveSchedule: () => {},
      },
    );
    const body = "project:node:home-body" as NodeId;
    const box: NodeEntry = {
      kind: "node",
      id: "project:node:box" as NodeId,
      definitionId: "lib:definition:type-frame",
      children: [],
      props: {},
      visual: {},
      sizing: {},
      descendantOverrides: [],
    };
    workspace.execute(
      insertNodes({
        parent: { kind: "node", id: body },
        entries: [box],
        rootIds: [box.id],
        newId: workspace.newId,
      }),
    );
    const apply = (styles: Record<string, string>) =>
      workspace.execute(
        setFields({
          targets: [{ kind: "node", id: box.id }],
          ...catalogStyleWritesOf(styles),
        } as Parameters<typeof setFields>[0]),
      );
    const style = () =>
      workspace.root.domInputs.get(workspace.root.recordsOfSource(box.id)[0])
        ?.sizing;
    // A % minimum resolves against the parent (the page body, 1920 wide); px still wins below it.
    const record = workspace.root.recordsOfSource(box.id)[0]!;
    const width = () => workspace.root.getGeometry([record]).get(record)?.width;
    apply({ width: "10px", minWidth: "100px" });
    expect(width()).toBe(100);
    apply({ minWidth: "50%" });
    expect(width()).toBe(960);
    apply({ minWidth: "" });
    apply({ width: "120px", height: "40px" });
    expect(style()).toMatchObject({ width: 120, height: 40 });
    apply({ width: "auto" });
    expect(style()?.width).toBe(undefined);
    const entry = workspace.runtime.graph.getEntry(box.id) as NodeEntry;
    expect(
      catalogStyleView({
        visual: catalogAuthoredValues(entry.visual),
        layout: catalogAuthoredValues(entry.layout),
        sizing: catalogAuthoredValues(entry.sizing),
      }),
    ).toEqual({ height: "40px" });
  });

  // The old store's border companion (2026-07-15): CSS draws no border until style, width and
  // color are all set, and the Canvas stroke refuses a width without a color. Live 2026-10-03: a
  // width-only edit on a Frame blanked the page (`CATALOG_CANVAS_STROKE_COLOR_REQUIRED`).
  it("a border edit fills in the border axes the node still lacks", () => {
    expect(
      catalogStyleWritesOf({ borderWidth: "3px" }, { visual: {} }),
    ).toEqual({
      visual: {
        borderStyle: set("solid"),
        borderColor: set(BORDER_COMPANION_COLOR),
        borderWidth: set(3),
      },
      layout: {},
      sizing: {},
    });
    expect(
      catalogStyleWritesOf({ borderColor: "#ff0000" }, { visual: {} }).visual,
    ).toEqual({
      borderStyle: set("solid"),
      borderWidth: set(1),
      borderColor: set("#ff0000"),
    });
    // Axes the node already has (resolved visual) are left alone.
    expect(
      catalogStyleWritesOf(
        { borderColor: "#ff0000" },
        { visual: { borderWidth: 2, borderStyle: "dashed" } },
      ).visual,
    ).toEqual({ borderColor: set("#ff0000") });
    // Side longhands count as a width; the shorthand is not added over them.
    expect(
      catalogStyleWritesOf(
        { borderTopWidth: "2px", borderRightWidth: "0px" },
        { visual: { borderColor: "#000000" } },
      ).visual,
    ).toEqual({
      borderStyle: set("solid"),
      borderTopWidth: set(2),
      borderRightWidth: set(0),
    });
    // `none` hides the border: nothing is added. A removal adds nothing either.
    expect(
      catalogStyleWritesOf({ borderStyle: "none" }, { visual: {} }).visual,
    ).toEqual({ borderStyle: set("none") });
    expect(
      catalogStyleWritesOf({ borderColor: "" }, { visual: {} }).visual,
    ).toEqual({ borderColor: REMOVE });
    // A non-border edit is untouched.
    expect(catalogStyleWritesOf({ opacity: "0.5" }, { visual: {} })).toEqual({
      visual: { opacity: set(0.5) },
      layout: {},
      sizing: {},
    });
  });
});
