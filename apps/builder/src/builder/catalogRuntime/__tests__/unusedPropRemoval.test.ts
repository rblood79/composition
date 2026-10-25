import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { insertNodes } from "../../../../../../packages/shared/src/catalog/commands";
import {
  CatalogGraph,
  createCatalogGraph,
} from "../../../../../../packages/shared/src/catalog/document/graph";
import { componentCatalog } from "../../../../../../packages/shared/src/catalog/componentCatalog";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import { REUSABLE_ORIGIN_TEMPLATES } from "../../../../../../packages/shared/src/catalog/document/generated/reusableOriginLibrary";
import { migrateCatalogEntriesS2 } from "../../../../../../packages/shared/src/catalog/document/s2PropAlignment";
import type {
  CatalogEntry,
  LibraryDefinitionId,
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { catalogPaletteDefinitionId } from "../paletteInsert";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * 2026-10-14 (사용자 「모든컴퍼넌트와 컴퍼넌트 자식들 전수조사후 불필요하게 등록된 프러퍼티 제거」 ·
 * S2 에 있지만 구현이 없는 것은 「지금은 제거」): props no consumer read — the Design panel showed
 * them, the Canvas and the Preview did not change. They are gone from the bindings and the origins,
 * and an old document's write is dropped on load (`migrateCatalogEntriesS2`).
 */
const REMOVED: ReadonlyArray<readonly [string, string, unknown]> = [
  ["CardView", "density", "compact"],
  ["CardView", "selectionStyle", "highlight"],
  ["ColorSwatchPicker", "density", "compact"],
  ["ColorSwatchPicker", "rounding", "full"],
  ["ColorPicker", "defaultValue", "#ff0000"],
  ["ToggleButtonGroup", "isQuiet", true],
  ["GridListItem", "children", "Old"],
  ["Tag", "children", "Old"],
  // (2026-10-14 「한쪽만 반영되는 칸 고쳐」 · 「지금은 제거」: the DOM re-tinted the Card's subtree, the
  // Canvas could not.)
  ["Card", "accentColor", "red"],
];

/** An item's text is its Text node's — the item's own is carried for an internal reader only. */
const HIDDEN_ITEM_TEXT = ["ListBoxItem", "TreeItem"];

const OWNER = "project:node:owner" as NodeId;
const set = <T>(value: T) => ({ kind: "set" as const, value });

async function open(type: string) {
  const library = await buildCodeCatalogLibrary();
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:unused-props" as const,
        name: "Unused props",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, `unused-props-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1000, height: 800 },
      autosaveSchedule: () => {},
    },
  );
  workspace.execute(
    insertNodes({
      parent: { kind: "node", id: "project:node:home-body" as NodeId },
      entries: [
        {
          kind: "node",
          id: OWNER,
          definitionId: catalogPaletteDefinitionId(library, type),
          children: [],
          props: {},
          visual: {},
          sizing: {},
          descendantOverrides: [],
        } as NodeEntry,
      ],
      rootIds: [OWNER],
      newId: workspace.newId,
    }),
  );
  return { library, workspace };
}

describe("props no consumer read are not registered", () => {
  it("the bindings accept none of them; an item's own text is hidden", async () => {
    const library = await buildCodeCatalogLibrary();
    const accepts = (type: string) =>
      library.definitions.get(
        `lib:definition:type-${type}` as LibraryDefinitionId,
      )!.accepts;
    expect(
      REMOVED.filter(([type, key]) => key in accepts(type)).map(
        ([type, key]) => `${type}.${key}`,
      ),
    ).toEqual([]);
    for (const type of HIDDEN_ITEM_TEXT) {
      const entry = componentCatalog.find(
        (candidate) => candidate.kind === "primitive" && candidate.type === type,
      );
      expect(
        entry?.kind === "primitive" &&
          entry.binding.props.accepts?.children?.editorHidden,
        type,
      ).toBe(true);
    }
  });

  it("no origin template writes them", async () => {
    const library = await buildCodeCatalogLibrary();
    const typeOf = (definitionId: string) =>
      library.definitions.get(definitionId as LibraryDefinitionId)?.name;
    const writes = REUSABLE_ORIGIN_TEMPLATES.flatMap((template) =>
      REMOVED.filter(
        ([type, key]) =>
          typeOf(template.definitionId) === type &&
          key in (template.props ?? {}),
      ).map(([, key]) => `${template.id}.${key}`),
    );
    expect(writes).toEqual([]);
  });

  it("an old document with them opens — the write is dropped on load", async () => {
    for (const type of [
      "CardView",
      "ColorSwatchPicker",
      "ColorPicker",
      "ToggleButtonGroup",
      "Card",
    ]) {
      const { library, workspace } = await open(type);
      const document = workspace.root.runtime.graph.exportDocument();
      const entries = JSON.parse(JSON.stringify(document.entries)) as Record<
        string,
        CatalogEntry
      >;
      const props = (
        entries[OWNER] as unknown as {
          props: Record<string, unknown>;
        }
      ).props;
      for (const [owner, key, value] of REMOVED)
        if (owner === type) props[key] = set(value);
      // Without the migration the graph refuses it (the binding no longer accepts it).
      expect(
        () => new CatalogGraph({ ...document, entries }, library),
        type,
      ).toThrow();
      const graph = createCatalogGraph({ ...document, entries }, library);
      const after = (graph.getEntry(OWNER) as NodeEntry).props;
      for (const [owner, key] of REMOVED)
        if (owner === type)
          expect(after[key], `${type}.${key}`).toBeUndefined();
    }
  });

  it("an item's old text default is dropped on load", async () => {
    const library = await buildCodeCatalogLibrary();
    const entries: Record<string, CatalogEntry> = {};
    for (const type of ["GridListItem", "Tag"])
      entries[`project:definitionOverride:${type}`] = {
        kind: "definitionOverride",
        id: `project:definitionOverride:${type}`,
        targetId: `lib:definition:type-${type}`,
        defaults: { children: set("Old"), size: set("L") },
      } as unknown as CatalogEntry;
    expect(migrateCatalogEntriesS2(entries, library)).toBe(true);
    for (const type of ["GridListItem", "Tag"]) {
      const { defaults } = entries[
        `project:definitionOverride:${type}`
      ] as unknown as { defaults: Record<string, unknown> };
      expect(defaults.children, type).toBeUndefined();
      expect(defaults.size, type).toEqual(set("L"));
    }
  });

  it("a CardView's S2 variant survives a reload; only the old `default` is dropped", async () => {
    const { library, workspace } = await open("CardView");
    const document = workspace.root.runtime.graph.exportDocument();
    for (const [written, loaded] of [
      ["secondary", "secondary"],
      ["quiet", "quiet"],
      ["default", undefined],
    ] as const) {
      const entries = JSON.parse(JSON.stringify(document.entries)) as Record<
        string,
        CatalogEntry
      >;
      (
        entries[OWNER] as unknown as { props: Record<string, unknown> }
      ).props.variant = set(written);
      const graph = createCatalogGraph({ ...document, entries }, library);
      expect((graph.getEntry(OWNER) as NodeEntry).props.variant).toEqual(
        loaded === undefined ? undefined : set(loaded),
      );
    }
  });
});
