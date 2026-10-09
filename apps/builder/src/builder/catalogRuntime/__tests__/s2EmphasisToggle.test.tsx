// @vitest-environment jsdom
/**
 * S2 1.8.0 Checkbox · Switch `isEmphasized` (2026-10-10 — 조사 §4.2 B): 공개 축은 boolean 이고
 * variant 는 resolver 가 파생하는 내부 운반 값 (`CATALOG_BOOLEAN_VARIANTS` — Canvas 는 rule 의
 * emphasized 변형을 칠하고 DOM 은 `data-emphasized` 로 수동 시트를 켠다). 옛 문서의
 * `variant: "emphasized"` 는 로드 시 1회 전환 (`migrateCatalogEntriesS2` — `createCatalogGraph`).
 */
import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { insertNodes } from "../../../../../../packages/shared/src/catalog/commands";
import {
  CatalogGraph,
  createCatalogGraph,
} from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import { migrateCatalogEntriesS2 } from "../../../../../../packages/shared/src/catalog/document/s2PropAlignment";
import type {
  CatalogEntry,
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { resolveCatalogVariantName } from "../../../../../../packages/shared/src/catalog/resolvers/resolveCatalogVariantName";
import type { ComponentRule } from "../../../../../../packages/shared/src/types/catalog-style.types";
import { getSkiaNode } from "../../workspace/canvas/skia/useSkiaNode";
import { bindCatalogCanvas } from "../canvasBinding";
import { renderCatalogDom } from "../domBinding";
import { catalogSemanticContracts } from "../editContract";
import { catalogPaletteDefinitionId } from "../paletteInsert";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

const OWNER = "project:node:toggle" as NodeId;

async function open(
  type: "Checkbox" | "Switch",
  props: Record<string, unknown>,
) {
  const library = await buildCodeCatalogLibrary();
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:emphasis" as const,
        name: "Emphasis",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, `emphasis-${Math.random()}`),
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
  const indicator = [...root.canvasInputs.values()].find((item) =>
    root.typeOf(item).endsWith("Indicator"),
  );
  const canvas = bindCatalogCanvas(root, root.pageRootRecords());
  const painted = indicator
    ? (getSkiaNode(indicator.id) as unknown as {
        box?: { fillColor?: Float32Array | number[] };
      })
    : undefined;
  canvas.dispose();
  return { workspace, library, record, html, painted };
}

describe("S2 Checkbox · Switch isEmphasized", () => {
  it("the Design panel offers Emphasized and hides the variant carrier", async () => {
    const { record } = await open("Checkbox", {});
    const contracts = catalogSemanticContracts(
      record.definitionId as Parameters<typeof catalogSemanticContracts>[0],
      "Checkbox",
    );
    expect(contracts.isEmphasized).toMatchObject({ kind: "boolean" });
    expect(contracts.variant).toMatchObject({ editorHidden: true });
  });

  it("emphasized Checkbox: data-emphasized in the DOM, the rule's emphasized variant on the record, the accent indicator", async () => {
    const emphasized = await open("Checkbox", {
      isEmphasized: true,
      isSelected: true,
    });
    expect(emphasized.html).toContain('data-emphasized="true"');
    expect(emphasized.record.props.variant).toBe("emphasized");
    const plain = await open("Checkbox", { isSelected: true });
    expect(plain.html).not.toContain("data-emphasized");
    expect(plain.record.props.variant).toBe("default");
    // Both consumers: the selected indicator paints the emphasized variant's accent, not neutral.
    expect([
      ...(emphasized.painted!.box!.fillColor as Float32Array),
    ]).not.toEqual([...(plain.painted!.box!.fillColor as Float32Array)]);
  });

  it("emphasized Switch: data-emphasized and the emphasized variant", async () => {
    const { html, record } = await open("Switch", {
      isEmphasized: true,
      isSelected: true,
    });
    expect(html).toContain('data-emphasized="true"');
    expect(record.props.variant).toBe("emphasized");
  });

  it("load migration: an old document's variant becomes isEmphasized once", async () => {
    const { workspace, library } = await open("Checkbox", {});
    const document = workspace.root.runtime.graph.exportDocument();
    const entries = JSON.parse(JSON.stringify(document.entries)) as Record<
      string,
      CatalogEntry
    >;
    const node = entries[OWNER] as NodeEntry & {
      props: Record<string, { kind: string; value?: unknown }>;
    };
    node.props.variant = { kind: "set", value: "emphasized" };
    const graph = createCatalogGraph({ ...document, entries }, library);
    const migrated = graph.getEntry(OWNER) as NodeEntry;
    expect(migrated.props.variant).toBeUndefined();
    expect(migrated.props.isEmphasized).toEqual({ kind: "set", value: true });
  });

  it("load migration: variant default is simply dropped", async () => {
    const { workspace, library } = await open("Checkbox", {});
    const document = workspace.root.runtime.graph.exportDocument();
    const entries = JSON.parse(JSON.stringify(document.entries)) as Record<
      string,
      CatalogEntry
    >;
    const node = entries[OWNER] as NodeEntry & {
      props: Record<string, { kind: string; value?: unknown }>;
    };
    node.props.variant = { kind: "set", value: "default" };
    migrateCatalogEntriesS2(entries, library);
    expect((entries[OWNER] as NodeEntry).props.variant).toBeUndefined();
    expect((entries[OWNER] as NodeEntry).props.isEmphasized).toBeUndefined();
  });

  it("a stale variant a rule no longer has falls back to the default variant", () => {
    const rule = {
      defaultVariant: "default",
      variants: { default: {} },
    } as unknown as ComponentRule;
    expect(resolveCatalogVariantName(rule, { variant: "accent" })).toBe(
      "default",
    );
    expect(resolveCatalogVariantName(rule, { variant: "default" })).toBe(
      "default",
    );
  });
});
