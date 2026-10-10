// @vitest-environment jsdom
/**
 * ADR-257 후속 — S2 `overflowMode` beyond the Table: ListView's (GridList — default truncate, the
 * items' label · description Text) and Badge's (default wrap, its own text). Both consumers read
 * one resolved record: the Canvas (layout measure · paint) and the DOM.
 */
import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
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
import { getSkiaNode } from "../../workspace/canvas/skia/useSkiaNode";
import { bindCatalogCanvas } from "../canvasBinding";
import { renderCatalogDom } from "../domBinding";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

const id = (name: string) => `project:node:${name}` as NodeId;
const LONG =
  "a long label that does not fit in its card at all, not even close";

const cleanups: Array<() => void> = [];
afterEach(() => {
  for (const cleanup of cleanups.splice(0).reverse()) cleanup();
});

/** A workspace with one palette instance of `origin` (its props set) on the home page. */
async function openOrigin(
  origin: string,
  props: Record<string, string | number> = {},
) {
  const library = await buildCodeCatalogLibrary();
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:adr257-overflow" as const,
        name: "ADR-257 overflow",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, `adr257-overflow-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1000, height: 800 },
      autosaveSchedule: () => {},
    },
  );
  workspace.root.execute(
    insertNodes({
      parent: { kind: "node", id: "project:node:home-body" as NodeId },
      entries: [
        {
          kind: "node",
          id: id("x"),
          definitionId:
            `lib:definition:origin-component-${origin}` as NodeEntry["definitionId"],
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
      rootIds: [id("x")],
      newId: workspace.newId,
    }),
  );
  return workspace;
}

function ofType(workspace: CatalogWorkspace, type: string) {
  const root = workspace.root;
  return [...root.domInputs.values()].filter((r) => root.typeOf(r) === type);
}

function setOn(
  workspace: CatalogWorkspace,
  recordId: string,
  props: Record<string, string | number>,
  visual: Record<string, number> = {},
) {
  workspace.execute(
    setFields({
      targets: [workspace.positionOfRecord(recordId)!.target],
      props: Object.fromEntries(
        Object.entries(props).map(([key, value]) => [
          key,
          { kind: "set" as const, value },
        ]),
      ),
      ...(Object.keys(visual).length
        ? {
            visual: Object.fromEntries(
              Object.entries(visual).map(([key, value]) => [
                key,
                { kind: "set" as const, value },
              ]),
            ),
          }
        : {}),
    }),
  );
}

function dom(workspace: CatalogWorkspace, recordId: string) {
  return renderToStaticMarkup(renderCatalogDom(workspace.root, recordId));
}

/** The inline style of the element carrying `data-catalog-id` of `recordId`. */
function styleOf(html: string, recordId: string) {
  const key = recordId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(`<[^>]*data-catalog-id="${key}"[^>]*>`).exec(html);
  return /\sstyle="([^"]*)"/.exec(match?.[0] ?? "")?.[1] ?? "";
}

describe("ADR-257 후속 — GridList overflowMode (S2 ListView, default truncate)", () => {
  it("truncate (default): each item's label · description Text is one line clipped with an ellipsis — Canvas and DOM", async () => {
    const workspace = await openOrigin("gridlist");
    const list = ofType(workspace, "GridList")[0]!;
    expect(list.props.overflowMode).toBe("truncate");
    const item = ofType(workspace, "GridListItem")[0]!;
    expect(item.props.overflowMode).toBe("truncate");
    const texts = ofType(workspace, "Text").filter(
      (text) => text.parentId === item.id,
    );
    expect(texts.length).toBeGreaterThan(0);
    for (const text of texts) {
      expect(text.visual.whiteSpace).toBe("nowrap");
      expect(text.visual.textOverflow).toBe("ellipsis");
      expect(text.visual.overflow).toBe("hidden");
    }
    const html = dom(workspace, list.id);
    const style = styleOf(html, texts[0]!.id);
    expect(style).toContain("white-space:nowrap");
    expect(style).toContain("text-overflow:ellipsis");
    expect(style).toContain("overflow:hidden");
    // (The Canvas text leaf paints the ellipsis at its box and clips there.)
    const canvas = bindCatalogCanvas(
      workspace.root,
      workspace.root.pageRootRecords(),
    );
    cleanups.push(() => canvas.dispose());
    const paint = getSkiaNode(texts[0]!.id)?.text;
    expect(paint?.textOverflow).toBe("ellipsis");
    expect(paint?.clipText).toBe(true);
  });

  // (The unit layout has no text measure — the heights a wrapped label gives are live checks.)
  it("wrap: the label · description wrap in the card — right after the edit, and undo", async () => {
    const workspace = await openOrigin("gridlist");
    const item = ofType(workspace, "GridListItem")[0]!;
    const label = ofType(workspace, "Text").find(
      (text) => text.parentId === item.id && text.props.slot !== "description",
    )!;
    setOn(workspace, label.id, { children: LONG });
    const list = ofType(workspace, "GridList")[0]!;
    setOn(workspace, list.id, { overflowMode: "wrap" });
    const wrapped = ofType(workspace, "Text").find((t) => t.id === label.id)!;
    expect(wrapped.visual.whiteSpace).toBe("normal");
    expect(wrapped.visual.textOverflow).toBeUndefined();
    expect(wrapped.visual.overflow).toBeUndefined();
    expect(styleOf(dom(workspace, list.id), label.id)).toContain(
      "white-space:normal",
    );
    workspace.undo();
    expect(
      ofType(workspace, "Text").find((t) => t.id === label.id)!.visual
        .whiteSpace,
    ).toBe("nowrap");
  });
});

describe("ADR-257 후속 — Badge overflowMode (S2 default wrap)", () => {
  it("wrap (default): the text wraps at the badge width — the record, the Canvas paint, the DOM", async () => {
    const workspace = await openOrigin("badge", { children: LONG });
    const badge = ofType(workspace, "Badge")[0]!;
    expect(badge.props.overflowMode).toBe("wrap");
    expect(badge.visual.whiteSpace).toBe("normal");
    setOn(workspace, badge.id, {}, { width: 120 });
    const rect = workspace.root.getGeometry([badge.id]).get(badge.id)!;
    expect(rect.width).toBe(120);
    const html = dom(workspace, badge.id);
    expect(html).toContain('data-overflow-mode="wrap"');
    expect(html).toContain('class="badge-text"');
    const canvas = bindCatalogCanvas(
      workspace.root,
      workspace.root.pageRootRecords(),
    );
    cleanups.push(() => canvas.dispose());
    const texts = (getSkiaNode(badge.id)?.children ?? []).filter(
      (child) => child.type === "text",
    );
    expect(texts.length).toBe(1);
    expect(texts[0]!.text?.whiteSpace).not.toBe("nowrap");
    expect(texts[0]!.text?.textOverflow).toBeUndefined();
    // (Box text: centered lines — `Badge.css` gives the DOM text box the same.)
    expect(texts[0]!.text?.align).toBe("center");
  });

  it("truncate: one line cut with an ellipsis at the badge width — right after the edit", async () => {
    const workspace = await openOrigin("badge", { children: LONG });
    const badge = ofType(workspace, "Badge")[0]!;
    setOn(workspace, badge.id, {}, { width: 120 });
    const canvas = bindCatalogCanvas(
      workspace.root,
      workspace.root.pageRootRecords(),
    );
    cleanups.push(() => canvas.dispose());
    setOn(workspace, badge.id, { overflowMode: "truncate" });
    expect(canvas.update().status).toBe("patched");
    const record = ofType(workspace, "Badge")[0]!;
    expect(record.visual.whiteSpace).toBe("nowrap");
    const text = (getSkiaNode(badge.id)?.children ?? []).find(
      (child) => child.type === "text",
    )?.text;
    expect(text?.whiteSpace).toBe("nowrap");
    expect(text?.textOverflow).toBe("ellipsis");
    expect(text?.clipText).toBe(true);
    const html = dom(workspace, badge.id);
    expect(html).toContain('data-overflow-mode="truncate"');
    expect(styleOf(html, badge.id)).toContain("white-space:nowrap");
  });
});
