// @vitest-environment jsdom
/**
 * 2026-10-15 Control drag · Position toggle: an absolutely placed node sits at its `placement` from
 * its parent's padding box. The layout engine places it from the parent (its containing block), so
 * the DOM parent must be a positioned box too — without it the Preview placed it from the nearest
 * positioned ancestor (the page body) and Canvas and Preview disagreed.
 */
import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  insertNodes,
  setWholeField,
} from "../../../../../../packages/shared/src/catalog/commands";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { renderCatalogDom } from "../domBinding";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

const FRAME = "project:node:frame" as NodeId;
const CHILD = "project:node:child" as NodeId;
const entry = (
  id: NodeId,
  definitionId: string,
  children: NodeId[] = [],
): NodeEntry => ({
  kind: "node",
  id,
  definitionId: definitionId as NodeEntry["definitionId"],
  children,
  props: {},
  visual: {},
  sizing: {},
  descendantOverrides: [],
});

async function open() {
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:absolute-child" as const,
        name: "Absolute child",
      }),
      await buildCodeCatalogLibrary(),
    ),
    new CatalogStorage(indexedDB, `absolute-child-${Math.random()}`),
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
        entry(FRAME, "lib:definition:type-frame", [CHILD]),
        entry(CHILD, "lib:definition:type-frame"),
      ],
      rootIds: [FRAME],
      newId: workspace.newId,
    }),
  );
  const frameHtml = () => {
    const record = workspace.root.recordsOfSource(FRAME)[0]!;
    const html = renderToStaticMarkup(renderCatalogDom(workspace.root, record));
    return html.slice(0, html.indexOf(">") + 1);
  };
  return { workspace, frameHtml };
}

describe("absolute child — the DOM parent is its containing block", () => {
  it("a container with an absolutely placed child is position: relative; without one it is not", async () => {
    const { workspace, frameHtml } = await open();
    expect(frameHtml()).not.toContain("position:relative");
    // The parent's record does not change: its DOM listener hears the child's placement anyway
    // (the Preview re-renders the parent with its containing block).
    let parentNotified = 0;
    workspace.root.subscribeDom(
      workspace.root.recordsOfSource(FRAME)[0]!,
      () => parentNotified++,
    );
    workspace.execute(
      setWholeField({
        targets: [{ kind: "node", id: CHILD }],
        field: "placement",
        value: { kind: "absolute", x: 12, y: 30 },
      }),
    );
    expect(frameHtml()).toContain("position:relative");
    expect(parentNotified).toBeGreaterThan(0);
  });
});
