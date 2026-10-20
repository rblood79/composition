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
      // (ADR-276: the label is a Text child — measured like `mixedButtonText`.)
      textMeasure: (text, font, available) => {
        const width = (text.length * font.fontSize) / 2;
        const minWidth = Math.max(
          ...text.split(" ").map((word) => (word.length * font.fontSize) / 2),
        );
        return {
          width,
          exactWidth: width,
          minWidth,
          height:
            font.fontSize *
            font.lineHeight *
            (available !== undefined && available < width - 0.5 ? 2 : 1),
        };
      },
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
          props: { label: set("Save changes"), size: set("M") },
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
  // ADR-276: the label is the Button's Text{label} child — its box, not a painted inset.
  const label = () =>
    [...root.canvasInputs.values()].find(
      (item) =>
        item.sourceId === "lib:template:component-button__label" &&
        item.instancePath.includes(BUTTON),
    )!;
  const boxes = () => {
    const rects = root.getGeometry([record().id, label().id]);
    return { box: rects.get(record().id)!, text: rects.get(label().id)! };
  };
  return { workspace, boxes };
}

describe("Canvas Button label — the authored padding sides", () => {
  it("padding 4 on every side: the label keeps the box's inset and width (no spill)", async () => {
    const { workspace, boxes } = await open();
    const rest = boxes();
    // The rule's M padding (12) plus the 1px border until the document writes sides.
    const border = 1;
    expect(rest.text.x - rest.box.x).toBe(12 + border);
    expect(rest.text.width).toBeLessThanOrEqual(rest.box.width - 24 - border * 2);
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
    const padded = boxes();
    // The box shrank by 16 (12 → 4 each side) and the label follows the sides the layout used.
    expect(padded.box.width).toBeCloseTo(rest.box.width - 16, 3);
    expect(padded.text.x - padded.box.x).toBe(4 + border);
    expect(padded.text.width).toBeCloseTo(rest.text.width, 3);
    expect(padded.text.x + padded.text.width).toBeLessThanOrEqual(
      padded.box.x + padded.box.width - 4 - border,
    );
  });
});
