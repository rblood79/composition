// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { act, render } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, describe, expect, it } from "vitest";
import {
  insertNodes,
  setFields,
} from "../../../../../../packages/shared/src/catalog/commands";
import { tableHeaderColumns } from "../../../../../../packages/shared/src/catalog/commands/collections";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  EntryId,
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import type { SkiaNodeData } from "../../workspace/canvas/skia/nodeRendererTypes";
import { getSkiaNode } from "../../workspace/canvas/skia/useSkiaNode";
import { bindCatalogCanvas } from "../canvasBinding";
import { renderCatalogDom } from "../domBinding";
import { catalogItemInsertChoices } from "../itemInsert";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * ADR-256 Phase 6h (G2) → S2 TableView (2026-11-19, 사용자 「table 도 S2 (TableView) 와 같은 구조로」):
 * a Column's name sits in S2 `ColumnContents`' wrapper `div` — the Column origin is
 * `Column > frame > Text` (was the RAC starter's `Group[role=presentation]`), the Text reading the
 * Column's `children` (`{children}`), bold as the column header.
 */
const BODY = "project:node:home-body" as NodeId;
const OWNER = "project:node:table" as NodeId;
const set = <T,>(value: T) => ({ kind: "set" as const, value });

const cleanups: Array<() => void> = [];
afterEach(() => {
  for (const cleanup of cleanups.splice(0).reverse()) cleanup();
});

/** A palette instance (`origin`) on the page, its header given two columns and a row by "+". */
async function open(origin = "lib:definition:origin-component-table") {
  const library = await buildCodeCatalogLibrary();
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:adr256-column" as EntryId<"project">,
        name: "Column",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, `adr256-column-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1200, height: 800 },
      autosaveSchedule: () => {},
    },
  );
  workspace.root.execute(
    insertNodes({
      parent: { kind: "node", id: BODY },
      entries: [
        {
          kind: "node",
          id: OWNER,
          definitionId: origin,
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
  cleanups.push(() => act(() => workspace.dispose()));
  const root = workspace.root;
  const record = (sourceId: string) =>
    [...root.domInputs.values()].find((r) => r.sourceId === sourceId)!;
  // (Columns: the data columns — not S2's selection column, the origin's first since 2026-11-18;
  //  its name is no Group but the selection Checkbox.)
  const ofType = (type: string) =>
    [...root.canvasInputs.values()].filter(
      (r) =>
        root.typeOf(r) === type &&
        !(
          type === "Column" &&
          r.children.some(
            (child) => root.canvasInputs.get(child)?.props.slot === "selection",
          )
        ),
    );
  const part = (type: "TableHeader" | "TableBody") =>
    [...root.domInputs.values()].find(
      (r) => r.parentId === record(OWNER).id && root.typeOf(r) === type,
    )!;
  /** The Design panel's "+" on the header (a column) or the body (a row). */
  const insert = (type: "Column" | "Row") =>
    workspace.execute(
      catalogItemInsertChoices(
        {
          graph: workspace.runtime.graph,
          readModel: workspace.readModel,
          newId: workspace.newId,
        },
        workspace.positionOfRecord(
          part(type === "Column" ? "TableHeader" : "TableBody").id,
        )!,
      )
        .find((choice) => choice.type === type)!
        .build(),
    );
  const draw = () => {
    const view = render(renderCatalogDom(root, record(OWNER).id));
    cleanups.push(() => view.unmount());
    return view.container.querySelector("[role=grid]")!;
  };
  return { workspace, root, record, ofType, part, insert, draw };
}

/** A column header as its element path and its name: `th > div > span "Name"`. */
const headers = (grid: Element) =>
  [...grid.querySelectorAll("[role=columnheader]")].map((header) => {
    const path: string[] = [header.tagName.toLowerCase()];
    for (let at = header.firstElementChild; at; at = at.firstElementChild)
      path.push(
        `${at.tagName.toLowerCase()}${at.getAttribute("role") ? `[role=${at.getAttribute("role")}]` : ""}`,
      );
    return `${path.join(" > ")} "${header.textContent}"`;
  });

describe("S2 TableView — the Column's name in its content wrapper", () => {
  it("S2 `ColumnContents`: th > div (no role) > span", async () => {
    const { insert, draw } = await open();
    insert("Column");
    insert("Column");
    insert("Row");
    // ADR-277: the palette Table starts with three columns.
    const names = ["Name", "Type", "Status", "Column 4", "Column 5"];
    expect(headers(draw())).toEqual(
      names.map((name) => `th > div > span "${name}"`),
    );
  });

  it("the name is the Column's `children` (Insert Column, the Properties 'Text', the data columns)", async () => {
    const { workspace, root, record, ofType, part, insert, draw } =
      await open();
    insert("Column");
    insert("Column");
    const [first] = ofType("Column");
    workspace.execute(
      setFields({
        targets: [workspace.positionOfRecord(first!.id)!.target],
        props: { children: set("Title") },
      }),
    );
    const expected = ["Title", "Type", "Status", "Column 4", "Column 5"];
    expect(
      [...draw().querySelectorAll("[role=columnheader]")].map(
        (header) => header.textContent,
      ),
    ).toEqual(expected);
    // The Canvas text is the name Text's; the data columns read the same label.
    expect(
      ofType("Column").map(
        (column) =>
          root.canvasInputs.get(
            root.canvasInputs.get(column.children[0]!)!.children[0]!,
          )!.props.children,
      ),
    ).toEqual(expected);
    expect(
      tableHeaderColumns(
        workspace.runtime.graph,
        workspace.positionOfRecord(part("TableHeader").id)!.target,
      ).map((column) => column.label),
    ).toEqual(expected);
    expect(record(OWNER)).toBeDefined();
  });

  it("Canvas: the Column paints no text of its own — its name Text paints it, bold as the column header (`font-weight: 600` on both sides)", async () => {
    const { root, ofType, insert, draw } = await open();
    insert("Column");
    const canvas = bindCatalogCanvas(root, root.pageRootRecords());
    cleanups.push(() => canvas.dispose());
    const texts = (node: SkiaNodeData | null | undefined) =>
      (node?.children ?? []).filter((child) => child.type === "text");
    const [column] = ofType("Column");
    const group = root.canvasInputs.get(column!.children[0]!)!;
    const name = root.canvasInputs.get(group.children[0]!)!;
    expect(root.typeOf(group)).toBe("frame");
    expect(texts(getSkiaNode(column!.id))).toEqual([]);
    // (A text leaf is its own text node.)
    const text = getSkiaNode(name.id);
    // (ADR-277: the first Column is the starter's "Name".)
    expect(text?.text?.content).toBe("Name");
    expect(String(text?.text?.fontWeight)).toBe("600");
    const span = draw().querySelector(
      "[role=columnheader] > div > span",
    ) as HTMLElement;
    expect(span.style.fontWeight).toBe("600");
  });

  it("the palette Table's starter columns are Column origin instances (ADR-277 — their name in the content wrapper)", async () => {
    const { root, ofType } = await open();
    const columns = ofType("Column");
    expect(columns.map((column) => column.props.children)).toEqual([
      "Name",
      "Type",
      "Status",
    ]);
    for (const column of columns) {
      const group = root.canvasInputs.get(column.children[0]!)!;
      expect(root.typeOf(group)).toBe("frame");
      expect(root.canvasInputs.get(group.children[0]!)!.props.children).toBe(
        column.props.children,
      );
    }
  });
});
