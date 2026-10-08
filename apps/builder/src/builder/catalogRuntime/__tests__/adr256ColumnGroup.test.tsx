// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { act, render } from "@testing-library/react";
import { createElement } from "react";
import { Group } from "react-aria-components/Group";
import {
  Cell,
  Column,
  Row,
  Table,
  TableBody,
  TableHeader,
} from "react-aria-components/Table";
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
 * ADR-256 Phase 6h (G2) — a Column's name sits in a RAC `Group` (react-aria.adobe.com Table: the
 * starter Column is `Column > Group[role=presentation].column-name > children`; G0 inventory
 * `Column > Group > …`). The Column origin is `Column > Group[role=presentation] > Text`, the Text
 * bound to the origin's `children` (the column's name — what Insert Column, the Properties "Text"
 * and the data columns read). A TableView keeps plain Columns (its own S2 grid).
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
  const ofType = (type: string) =>
    [...root.canvasInputs.values()].filter((r) => root.typeOf(r) === type);
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

/** A column header as roles and its name: `columnheader > presentation "Name"`. */
const headers = (grid: Element) =>
  [...grid.querySelectorAll("[role=columnheader]")].map((header) => {
    const roles = (element: Element): string[] =>
      [...element.children].flatMap((child) => [
        ...(child.getAttribute("role") ? [child.getAttribute("role")!] : []),
        ...roles(child),
      ]);
    return `columnheader > ${roles(header).join(" > ")} "${header.textContent}"`;
  });

describe("ADR-256 Phase 6h — the Column's name in a Group", () => {
  it("the reference's column header: the name in a `Group[role=presentation]`", async () => {
    const { insert, draw } = await open();
    insert("Column");
    insert("Column");
    insert("Row");
    // RAC Table with the starter Column's name group (the starter's `.column-header` div is its
    // look — here the Column's own rule).
    const view = render(
      createElement(
        Table,
        { "aria-label": "Table" },
        createElement(
          TableHeader,
          null,
          ...["Column 1", "Column 2"].map((name, index) =>
            createElement(
              Column,
              { key: name, isRowHeader: index === 0 },
              createElement(
                Group,
                { role: "presentation", tabIndex: -1 },
                name,
              ),
            ),
          ),
        ),
        createElement(
          TableBody,
          null,
          createElement(
            Row,
            null,
            createElement(Cell, null, "Cell"),
            createElement(Cell, null, "Cell"),
          ),
        ),
      ),
    );
    cleanups.push(() => view.unmount());
    const reference = view.container.querySelector("[role=grid]")!;
    expect(headers(draw())).toEqual(headers(reference));
    expect(headers(reference)).toEqual([
      'columnheader > presentation "Column 1"',
      'columnheader > presentation "Column 2"',
    ]);
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
        props: { children: set("Name") },
      }),
    );
    expect(
      [...draw().querySelectorAll("[role=columnheader]")].map(
        (header) => header.textContent,
      ),
    ).toEqual(["Name", "Column 2"]);
    // The Canvas text is the name Text's; the data columns read the same label.
    expect(
      ofType("Column").map(
        (column) =>
          root.canvasInputs.get(
            root.canvasInputs.get(column.children[0]!)!.children[0]!,
          )!.props.children,
      ),
    ).toEqual(["Name", "Column 2"]);
    expect(
      tableHeaderColumns(
        workspace.runtime.graph,
        workspace.positionOfRecord(part("TableHeader").id)!.target,
      ).map((column) => column.label),
    ).toEqual(["Name", "Column 2"]);
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
    expect(root.typeOf(group)).toBe("Group");
    expect(texts(getSkiaNode(column!.id))).toEqual([]);
    // (A text leaf is its own text node.)
    const text = getSkiaNode(name.id);
    expect(text?.text?.content).toBe("Column 1");
    expect(String(text?.text?.fontWeight)).toBe("600");
    const span = draw().querySelector(
      "[role=columnheader] [role=presentation] > *",
    ) as HTMLElement;
    expect(span.style.fontWeight).toBe("600");
  });

  it("a TableView keeps plain Columns (its own grid — no name group)", async () => {
    const { ofType } = await open("lib:definition:origin-component-tableview");
    const columns = ofType("Column");
    expect(columns.map((column) => column.props.children)).toEqual([
      "Name",
      "Type",
      "Status",
    ]);
    expect(columns.every((column) => column.children.length === 0)).toBe(true);
  });
});
