// @vitest-environment jsdom
/**
 * (2026-11-14, 사용자 「IllustratedMessage 의 Illustration stroke-width: 1」) The picture's line is the
 * Illustration's `strokeWidth` — default 1 (the Icon's is 2), the same value in the Canvas glyph
 * and the DOM svg; an authored value wins in both.
 */
import "fake-indexeddb/auto";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
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
import { catalogPaletteDefinitionId } from "../paletteInsert";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

const OWNER = "project:node:message" as NodeId;

async function open() {
  const library = await buildCodeCatalogLibrary();
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:illustration-stroke" as const,
        name: "Illustration stroke",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, `illustration-stroke-${Math.random()}`),
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
          definitionId: catalogPaletteDefinitionId(
            library,
            "IllustratedMessage",
          ),
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
  const root = workspace.root;
  const read = () => {
    const record = [...root.canvasInputs.values()].find(
      (item) => root.typeOf(item) === "Illustration",
    )!;
    const host = document.createElement("div");
    host.innerHTML = renderToStaticMarkup(renderCatalogDom(root, record.id));
    return {
      record,
      // (The Canvas `icon_font` primitive draws the record's `strokeWidth` — `skiaPrimitives.ts`.)
      canvas: record.props.strokeWidth,
      dom: host.querySelector("svg")?.getAttribute("stroke-width"),
    };
  };
  return { workspace, read };
}

describe("Illustration stroke width", () => {
  it("draws a 1 line by default in the Canvas glyph and the DOM svg", async () => {
    const { workspace, read } = await open();
    try {
      expect(read()).toMatchObject({ canvas: 1, dom: "1" });
    } finally {
      workspace.dispose();
    }
  });

  it("an authored strokeWidth wins in both", async () => {
    const { workspace, read } = await open();
    try {
      workspace.execute(
        setFields({
          targets: [workspace.itemOfRecord(read().record.id)!.target],
          props: { strokeWidth: { kind: "set", value: 2.5 } },
        }),
      );
      expect(read()).toMatchObject({ canvas: 2.5, dom: "2.5" });
    } finally {
      workspace.dispose();
    }
  });
});
