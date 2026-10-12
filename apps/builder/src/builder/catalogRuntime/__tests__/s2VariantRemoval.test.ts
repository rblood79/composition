import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import {
  insertNodes,
  setFields,
} from "../../../../../../packages/shared/src/catalog/commands";
import {
  CatalogGraph,
  createCatalogGraph,
} from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import { migrateCatalogEntriesS2 } from "../../../../../../packages/shared/src/catalog/document/s2PropAlignment";
import type {
  CatalogEntry,
  LibraryDefinitionId,
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { COMPONENT_RULES_TABLE } from "../../../../../../packages/shared/src/catalog/generated/componentRulesTable";
import { REUSABLE_ORIGIN_TEMPLATES } from "../../../../../../packages/shared/src/catalog/document/generated/reusableOriginLibrary";
import { catalogPaletteDefinitionId } from "../paletteInsert";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * 조사 §4.2 F (사용자 결정 2026-10-12 「S2 · RAC · v3 어디에도 없으면 지워」): these types' `variant`
 * is in none of the references, so the axis is gone — the binding accepts none, the rule keeps its
 * default variant only (the paint every instance already had), the origins write none, and an
 * old document's write is dropped once on load (`migrateCatalogEntriesS2`).
 */
const REMOVED = [
  "ProgressBar",
  "ProgressBarFill",
  "ProgressBarTrack",
  "Table",
  "Separator",
  "Calendar",
  "RangeCalendar",
  "CalendarGrid",
  "ListBox",
  "GridList",
  "DisclosureGroup",
  "Toolbar",
  "FileTrigger",
  "Skeleton",
  "Pagination",
  "Nav",
  "ColorSwatchPicker",
  "Section",
  "ColorPicker",
  "Chart",
  "Tabs",
] as const;

const OWNER = "project:node:owner" as NodeId;
const set = <T>(value: T) => ({ kind: "set" as const, value });

async function open(type: string) {
  const library = await buildCodeCatalogLibrary();
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:s2-variant" as const,
        name: "Variant",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, `s2-variant-${Math.random()}`),
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

describe("S2 정렬 F — the variant axis no reference has is gone", () => {
  it("each type: no variant accepted, the rule keeps its default variant only", async () => {
    const library = await buildCodeCatalogLibrary();
    for (const type of REMOVED) {
      const definition = library.definitions.get(
        `lib:definition:type-${type}` as LibraryDefinitionId,
      )!;
      expect(definition, type).toBeDefined();
      expect(definition.accepts.variant, type).toBeUndefined();
      const rule =
        COMPONENT_RULES_TABLE[type as keyof typeof COMPONENT_RULES_TABLE];
      expect(Object.keys(rule.variants ?? {}), type).toEqual(["default"]);
      expect(rule.defaultVariant, type).toBe("default");
    }
  });

  it("no origin template writes a variant on these types", async () => {
    const library = await buildCodeCatalogLibrary();
    const typeOf = (definitionId: string) =>
      library.definitions.get(definitionId as LibraryDefinitionId)?.name;
    const writes = REUSABLE_ORIGIN_TEMPLATES.filter(
      (template) =>
        (REMOVED as readonly string[]).includes(
          typeOf(template.definitionId) ?? "",
        ) && "variant" in (template.props ?? {}),
    ).map((template) => template.id);
    expect(writes).toEqual([]);
  });

  it("a variant write is refused now — revision unchanged", async () => {
    for (const type of ["Separator", "Section", "ProgressBar", "Toolbar"]) {
      const { workspace } = await open(type);
      const revision = workspace.runtime.graph.revision;
      expect(
        () =>
          workspace.execute(
            setFields({
              targets: [{ kind: "node", id: OWNER }],
              props: { variant: set("accent") },
            }),
          ),
        type,
      ).toThrow();
      expect(workspace.runtime.graph.revision, type).toBe(revision);
    }
  });

  it("load migration: an old document's variant (own · template position · definition default) is dropped once", async () => {
    const { library, workspace } = await open("Table");
    const document = workspace.root.runtime.graph.exportDocument();
    const entries = JSON.parse(JSON.stringify(document.entries)) as Record<
      string,
      CatalogEntry
    >;
    type Writes = Record<string, { kind: string; value?: unknown }>;
    const owner = entries[OWNER] as NodeEntry & { props: Writes };
    // (An old Table instance: the origin's root position carried `variant: striped` — its template
    // position is the origin's `component-table` root.)
    owner.props.variant = set("striped");
    (
      owner as unknown as {
        descendantOverrides: Array<Record<string, unknown>>;
      }
    ).descendantOverrides.push({
      kind: "patch",
      address: {
        instanceId: OWNER,
        templatePath: ["lib:template:component-table"],
      },
      props: { variant: set("bordered"), size: set("L") },
    });
    entries["project:definitionOverride:section"] = {
      kind: "definitionOverride",
      id: "project:definitionOverride:section",
      targetId: "lib:definition:type-Section",
      defaults: { variant: set("purple") },
    } as unknown as CatalogEntry;
    expect(migrateCatalogEntriesS2(entries, library)).toBe(true);
    const migrated = entries[OWNER] as NodeEntry & { props: Writes };
    expect(migrated.props.variant).toBeUndefined();
    const patch = (
      migrated as unknown as {
        descendantOverrides: Array<{ props?: Writes }>;
      }
    ).descendantOverrides.at(-1)!;
    expect(patch.props?.variant).toBeUndefined();
    expect(patch.props?.size).toEqual(set("L"));
    expect(
      (
        entries["project:definitionOverride:section"] as unknown as {
          defaults: Writes;
        }
      ).defaults.variant,
    ).toBeUndefined();
  });

  it("an old document with a variant on these types opens (createCatalogGraph runs the migration)", async () => {
    for (const type of [
      "Separator",
      "Section",
      "ProgressBar",
      "Calendar",
      "Chart",
    ]) {
      const { library, workspace } = await open(type);
      const document = workspace.root.runtime.graph.exportDocument();
      const entries = JSON.parse(JSON.stringify(document.entries)) as Record<
        string,
        CatalogEntry
      >;
      (
        entries[OWNER] as unknown as { props: Record<string, unknown> }
      ).props.variant = set("accent");
      // Without the migration the graph refuses it (the binding no longer accepts a variant).
      expect(
        () => new CatalogGraph({ ...document, entries }, library),
        type,
      ).toThrow();
      const graph = createCatalogGraph({ ...document, entries }, library);
      expect(
        (graph.getEntry(OWNER) as NodeEntry).props.variant,
        type,
      ).toBeUndefined();
    }
  });
});
