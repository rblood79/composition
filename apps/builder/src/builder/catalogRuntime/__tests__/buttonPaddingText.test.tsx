// @vitest-environment jsdom
/**
 * 2026-10-14 (사용자 「button 에 padding 을 모두 4 로 했을 때 글자가 button 밖으로 나간다 — CSS 정상,
 * Canvas 버그」): the Canvas Button binding placed its label by the rule's `visual.paddingX` (12)
 * while the layout (and the DOM) used the authored sides (`catalogBoxModel` — paddingLeft >
 * paddingX > padding). With `padding: 4` the box shrank to the text + 8 but the text got a
 * 12px inset and a `maxWidth` 24px narrower than the box — the label wrapped and spilled out.
 */
import "fake-indexeddb/auto";
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
import { getSkiaNode } from "../../workspace/canvas/skia/useSkiaNode";
import { bindCatalogCanvas } from "../canvasBinding";
import { catalogPaletteDefinitionId } from "../paletteInsert";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

const BUTTON = "project:node:button" as NodeId;
const set = <T,>(value: T) => ({ kind: "set" as const, value });

async function open() {
  const library = await buildCodeCatalogLibrary();
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:button-padding" as const,
        name: "Button padding",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, `button-padding-${Math.random()}`),
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
          id: BUTTON,
          definitionId: catalogPaletteDefinitionId(library, "Button"),
          children: [],
          props: { children: set("Save changes"), size: set("M") },
          visual: {},
          sizing: {},
          descendantOverrides: [],
        } as NodeEntry,
      ],
      rootIds: [BUTTON],
      newId: workspace.newId,
    }),
  );
  const root = workspace.root;
  const record = () =>
    [...root.canvasInputs.values()].find((item) => item.sourceId === BUTTON)!;
  const painted = () => {
    const canvas = bindCatalogCanvas(root, root.pageRootRecords());
    const data = getSkiaNode(record().id) as unknown as {
      width: number;
      text: { paddingLeft: number; maxWidth: number };
    };
    canvas.dispose();
    const box = root.getGeometry([record().id]).get(record().id)!;
    return { ...data, box };
  };
  return { workspace, painted };
}

describe("Canvas Button label — the authored padding sides", () => {
  it("padding 4 on every side: the label keeps the box's inset and width (no spill)", async () => {
    const { workspace, painted } = await open();
    const rest = painted();
    // The rule's M padding (12) plus the 1px border until the document writes sides.
    const border = 1;
    expect(rest.text.paddingLeft).toBe(12 + border);
    expect(rest.text.maxWidth).toBeCloseTo(rest.box.width - 24 - border * 2, 3);
    workspace.execute(
      setFields({
        targets: [{ kind: "node", id: BUTTON }],
        visual: {
          paddingTop: set(4),
          paddingRight: set(4),
          paddingBottom: set(4),
          paddingLeft: set(4),
        },
      }),
    );
    const padded = painted();
    // The box shrank by 16 (12 → 4 each side) and the label follows the sides the layout used.
    expect(padded.box.width).toBeCloseTo(rest.box.width - 16, 3);
    expect(padded.text.paddingLeft).toBe(4 + border);
    expect(padded.text.maxWidth).toBeCloseTo(
      padded.box.width - 8 - border * 2,
      3,
    );
  });
});
