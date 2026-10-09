// @vitest-environment jsdom
/**
 * S2 1.8.0 Table `density` (2026-10-10 — 조사 §6.1 ③): compact · regular · spacious — Table 의
 * 값이 그 안의 Column · Cell 에 전파된다 (resolver `CATALOG_DENSITY_PROPAGATION_OWNER`;
 * Column · Cell 의 densities 채널이 paddingY 4 · 8 · 12 → 행 높이 32 · 40 · 48). Card 의
 * density 는 Card S2 재편 보류 (사용자 결정 2026-09-29) 와 함께 그 ADR 로 미룬다.
 */
import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  insertNodes,
  setFields,
} from "../../../../../../packages/shared/src/catalog/commands";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
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

async function openTable(props: Record<string, unknown>) {
  const library = await buildCodeCatalogLibrary();
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:s2-density-table" as const,
        name: "S2 density table",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, `s2-density-table-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1000, height: 800 },
      autosaveSchedule: () => {},
    },
  );
  const node = (
    id: string,
    type: string,
    children: string[],
    nodeProps: Record<string, unknown> = {},
  ) =>
    ({
      kind: "node",
      id: id as NodeId,
      // (The parts are type definitions — a RAC Table collection needs plain Column · Cell
      // elements; the root is the palette's Table origin.)
      definitionId: `lib:definition:type-${type}` as NodeEntry["definitionId"],
      children: children as NodeId[],
      props: Object.fromEntries(
        Object.entries(nodeProps).map(([key, value]) => [
          key,
          { kind: "set", value },
        ]),
      ),
      visual: {},
      sizing: {},
      descendantOverrides: [],
    }) as NodeEntry;
  workspace.execute(
    insertNodes({
      parent: { kind: "node", id: "project:node:home-body" as NodeId },
      entries: [
        node("project:node:t", "Table", [
          "project:node:th",
          "project:node:tb",
        ], props),
        node("project:node:th", "TableHeader", [
          "project:node:c1",
          "project:node:c2",
        ]),
        node("project:node:c1", "Column", [], { children: "Name" }),
        node("project:node:c2", "Column", [], { children: "Kind" }),
        node("project:node:tb", "TableBody", ["project:node:r1"]),
        node("project:node:r1", "Row", [
          "project:node:d1",
          "project:node:d2",
        ]),
        node("project:node:d1", "Cell", [], { children: "A" }),
        node("project:node:d2", "Cell", [], { children: "B" }),
      ],
      rootIds: ["project:node:t" as NodeId],
      newId: workspace.newId,
    }),
  );
  return { root: workspace.root, workspace };
}

async function open(type: string, props: Record<string, unknown>) {
  const library = await buildCodeCatalogLibrary();
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:s2-density" as const,
        name: "S2 density",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, `s2-density-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1000, height: 800 },
      autosaveSchedule: () => {},
    },
  );
  const definitionId = catalogPaletteDefinitionId(library, type);
  workspace.execute(
    insertNodes({
      parent: { kind: "node", id: "project:node:home-body" as NodeId },
      entries: [
        {
          kind: "node",
          id: OWNER,
          definitionId,
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
  return { root, record, html, definitionId };
}

describe("S2 Table density", () => {
  const cells = (root: {
    domInputs: ReadonlyMap<
      string,
      { bindingId?: string; visual: Record<string, unknown> }
    >;
  }) =>
    [...root.domInputs.values()].filter(
      (item) => item.bindingId === "cell" || item.bindingId === "column",
    );

  it("the Design panel offers Density on a Table", async () => {
    const { definitionId } = await open("Table", {});
    void definitionId;
    expect(
      catalogSemanticContracts(definitionId, "Table").density,
    ).toMatchObject({ kind: "enum", default: "regular" });
  });

  it("compact: every Column · Cell tightens to paddingY 4", async () => {
    const { root } = await openTable({ density: "compact" });
    const parts = cells(root);
    expect(parts.length).toBeGreaterThan(3);
    expect(parts.every((part) => part.visual.paddingY === 4)).toBe(true);
  });

  it("spacious: paddingY 12", async () => {
    const { root } = await openTable({ density: "spacious" });
    const parts = cells(root);
    expect(parts.every((part) => part.visual.paddingY === 12)).toBe(true);
  });

  it("toggling density after insert re-resolves the parts (live path)", async () => {
    const { root, workspace } = await openTable({});
    workspace.execute(
      setFields({
        targets: [{ kind: "node", id: "project:node:t" as NodeId }],
        props: { density: { kind: "set", value: "compact" } },
      }),
    );
    const parts = cells(root);
    expect(parts.length).toBeGreaterThan(3);
    expect(parts.every((part) => part.visual.paddingY === 4)).toBe(true);
  });

  it("default: the regular paddingY 8 stays", async () => {
    const { root } = await openTable({});
    const parts = cells(root);
    expect(parts.length).toBeGreaterThan(3);
    expect(parts.every((part) => part.visual.paddingY === 8)).toBe(true);
  });
});
