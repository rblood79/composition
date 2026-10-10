// @vitest-environment jsdom
/**
 * S2 강조 축 전환 3 (2026-10-10 — 조사 §4.2 B): Tree `variant`(accent) → `isEmphasized`
 * (design-data Tree view — S2 TreeView 에 없는 축), TableView `variant`(quiet) → `isQuiet`
 * (2026-06-15 흡수의 역전환). 내부 variant 는 resolver 파생 운반 값, 옛 문서는 로드 시 1회
 * 전환 (`migrateCatalogEntriesS2`).
 */
import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { insertNodes } from "../../../../../../packages/shared/src/catalog/commands";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import { migrateCatalogEntriesS2 } from "../../../../../../packages/shared/src/catalog/document/s2PropAlignment";
import type {
  CatalogEntry,
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { renderCatalogDom } from "../domBinding";
import { catalogSemanticContracts } from "../editContract";
import { catalogPaletteDefinitionId } from "../paletteInsert";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

const OWNER = "project:node:owner" as NodeId;

async function open(type: string, props: Record<string, unknown>) {
  const library = await buildCodeCatalogLibrary();
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:tree-tv" as const,
        name: "Tree TableView",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, `tree-tv-${Math.random()}`),
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
          props: Object.fromEntries(
            Object.entries(props).map(([key, value]) => [
              key,
              { kind: "set", value },
            ]),
          ),
          visual: {},
          sizing: {},
          descendantOverrides: [],
        } as NodeEntry,
      ],
      rootIds: [OWNER],
      newId: workspace.newId,
    }),
  );
  const root = workspace.root;
  const record = [...root.domInputs.values()].find(
    (item) => item.sourceId === OWNER,
  )!;
  const html = renderToStaticMarkup(renderCatalogDom(root, record.id));
  return { library, record, html };
}

describe("S2 Tree isEmphasized · TableView isQuiet", () => {
  it("the Design panel offers the booleans and hides the variant carriers", async () => {
    const library = await buildCodeCatalogLibrary();
    const tree = catalogSemanticContracts(
      catalogPaletteDefinitionId(library, "Tree") as Parameters<
        typeof catalogSemanticContracts
      >[0],
      "Tree",
    );
    expect(tree.isEmphasized).toMatchObject({ kind: "boolean" });
    expect(tree.isEmphasized.editorHidden).not.toBe(true);
    expect(tree.variant).toMatchObject({ editorHidden: true });
    const tableView = catalogSemanticContracts(
      catalogPaletteDefinitionId(library, "TableView") as Parameters<
        typeof catalogSemanticContracts
      >[0],
      "TableView",
    );
    expect(tableView.isQuiet).toMatchObject({ kind: "boolean" });
    expect(tableView.variant).toMatchObject({ editorHidden: true });
  });

  it("an emphasized Tree derives the rule's emphasized variant (the renamed accent)", async () => {
    const { record } = await open("Tree", { isEmphasized: true });
    expect(record.props.variant).toBe("emphasized");
    const plain = await open("Tree", {});
    expect(plain.record.props.variant).toBe("default");
  });

  it("a quiet TableView derives the quiet variant — data-variant in the DOM", async () => {
    const { record, html } = await open("TableView", { isQuiet: true });
    expect(record.props.variant).toBe("quiet");
    expect(html).toContain('data-variant="quiet"');
    const plain = await open("TableView", {});
    expect(plain.html).toContain('data-variant="default"');
  });

  it("load migration: Tree accent → isEmphasized, TableView quiet → isQuiet", async () => {
    const library = await buildCodeCatalogLibrary();
    const entry = (id: string, type: string, variant: string) =>
      ({
        kind: "node",
        id: id as NodeId,
        definitionId: catalogPaletteDefinitionId(library, type),
        children: [],
        props: { variant: { kind: "set", value: variant } },
        visual: {},
        sizing: {},
        descendantOverrides: [],
      }) as NodeEntry;
    const entries: Record<string, CatalogEntry> = {
      a: entry("a", "Tree", "accent"),
      b: entry("b", "TableView", "quiet"),
      c: entry("c", "TableView", "default"),
    };
    expect(migrateCatalogEntriesS2(entries, library)).toBe(true);
    expect((entries.a as NodeEntry).props).toEqual({
      isEmphasized: { kind: "set", value: true },
    });
    expect((entries.b as NodeEntry).props).toEqual({
      isQuiet: { kind: "set", value: true },
    });
    expect((entries.c as NodeEntry).props).toEqual({});
  });
});
