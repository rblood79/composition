// @vitest-environment jsdom
/**
 * S2 TableView 구조 (사용자 2026-11-19 「table 도 S2 (TableView) 와 같은 구조로」) — 설치된 S2 1.8.2
 * - ActionBar (`ActionBar.tsx`): DOM 순서 = 동작 묶음 (`div` > ActionButtonGroup `aria-label="Actions"`)
 *   먼저, 지우기 · 개수 묶음 뒤 — 화면은 지우기 · 개수가 왼쪽 (S2 `order`; 엔진에 `order` 가 없어 root
 *   `row-reverse`). 지우기 버튼 이름 · 묶음 이름은 S2 intl.
 * - SegmentedControl (`SegmentedControl.tsx`): 기본 선택 = 첫 항목 (비활성이어도), 글자 없는 항목은 Text 없음.
 * - Avatar (`Avatar.tsx`): `alt` 기본 `''` (장식).
 * - Image (`Image.tsx`): 늘 `div > img`.
 * - Link (`Link.tsx`): quiet 의 밑줄 없음은 단독 링크만 — 문단 안 링크는 밑줄 유지, hover · focus 에 다시 밑줄.
 */
import "fake-indexeddb/auto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { act, createElement } from "react";
import { I18nProvider } from "react-aria-components/I18nProvider";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
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
import { catalogAbsentByValue } from "../../../../../../packages/shared/src/catalog/runtime/presence";
import { catalogGroupSelection } from "../../../../../../packages/shared/src/catalog/runtime/groupSelection";
import { renderCatalogDom } from "../domBinding";
import { catalogPaletteDefinitionId } from "../paletteInsert";
import { newCatalogProjectDocument } from "../project";
import { catalogTextDecoration } from "../ruleShapes";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

const GENERATED = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../../../../packages/shared/src/components/styles/generated",
);

const cleanups: Array<() => Promise<void> | void> = [];
afterEach(async () => {
  while (cleanups.length) await cleanups.pop()!();
});

const ID = "project:node:placed" as NodeId;

async function open(type: string, props: Record<string, unknown> = {}) {
  const library = await buildCodeCatalogLibrary();
  const measure = (text: string, font: { fontSize: number }) => ({
    width: (text.length * font.fontSize) / 2,
    height: font.fontSize * 1.5,
  });
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:s2-uncompared" as const,
        name: "S2 uncompared",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, `s2-uncompared-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1000, height: 800 },
      autosaveSchedule: () => {},
      textMeasure: measure as never,
    },
  );
  cleanups.push(() => workspace.dispose());
  const definitionId =
    type === "Image"
      ? "lib:definition:type-Image"
      : catalogPaletteDefinitionId(library, type);
  workspace.execute(
    insertNodes({
      parent: { kind: "node", id: "project:node:home-body" as NodeId },
      entries: [
        {
          kind: "node",
          id: ID,
          definitionId,
          children: [],
          props: Object.fromEntries(
            Object.entries(props).map(([k, v]) => [
              k,
              { kind: "set", value: v },
            ]),
          ),
          visual: {},
          sizing: {},
          descendantOverrides: [],
        } as NodeEntry,
      ],
      rootIds: [ID],
      newId: workspace.newId,
    }),
  );
  const root = workspace.root;
  const records = () => [...root.canvasInputs.values()];
  const ofType = (t: string) => records().filter((r) => root.typeOf(r) === t);
  const render = async (locale = "en-US") => {
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    const host = document.body.appendChild(document.createElement("div"));
    const reactRoot = createRoot(host);
    await act(async () =>
      reactRoot.render(
        createElement(I18nProvider, {
          locale,
          children: renderCatalogDom(root, ofType(type)[0]!.id),
        }),
      ),
    );
    cleanups.push(async () => {
      await act(async () => reactRoot.unmount());
      host.remove();
    });
    return host;
  };
  return { workspace, root, records, ofType, render };
}

const geometryOf = (
  root: Awaited<ReturnType<typeof open>>["root"],
  id: string,
) => root.getGeometry([id]).get(id)!;

describe("S2 TableView — Column content (`ColumnContents`)", () => {
  it("node tree: Column > frame (S2 `columnContentWrapper` — flex · centered · full width) > Text", async () => {
    const { root, ofType } = await open("Table");
    const column = ofType("Column").find((c) => c.props.children === "Name")!;
    const wrapper = root.canvasInputs.get(column.children[0]!)!;
    expect(root.typeOf(wrapper)).toBe("frame");
    expect(wrapper.props.role).toBeUndefined();
    expect(wrapper.layout).toMatchObject({
      display: "flex",
      alignItems: "center",
    });
    const text = root.canvasInputs.get(wrapper.children[0]!)!;
    expect(root.typeOf(text)).toBe("Text");
    expect(text.props.children).toBe("Name");
  });

  it("DOM: th > div (no role) > span — S2 `ColumnContents`", async () => {
    const { render } = await open("Table");
    const host = await render();
    const header = [...host.querySelectorAll("[role=columnheader]")].find(
      (h) => h.textContent === "Name",
    )!;
    const wrapper = header.firstElementChild as HTMLElement;
    expect(wrapper.tagName).toBe("DIV");
    expect(wrapper.hasAttribute("role")).toBe(false);
    expect(wrapper.style.display).toBe("flex");
    expect(wrapper.firstElementChild!.tagName).toBe("SPAN");
    expect(wrapper.firstElementChild!.textContent).toBe("Name");
    // (no ⋮ — the column has no menu)
    expect(wrapper.children).toHaveLength(1);
  });

  it("Canvas: a sortable column keeps no box for a sort icon at rest (S2 draws one only while sorted)", async () => {
    const { root, ofType, workspace } = await open("Table");
    const column = ofType("Column").find((c) => c.props.children === "Name")!;
    const wrapperId = column.children[0]!;
    const before = geometryOf(root, wrapperId).width;
    workspace.execute(
      setFields({
        targets: [workspace.itemOfRecord(column.id)!.target],
        props: { allowsSorting: { kind: "set", value: true } },
      }),
    );
    expect(geometryOf(root, wrapperId).width).toBe(before);
    const columnBox = geometryOf(root, column.id);
    // (The wrapper fills the column's content box — S2 16 each side.)
    expect(before).toBeCloseTo(columnBox.width - 32, 0);
  });

  it("align end: the name sits at the column's end (S2 wrapper `justifyContent`) — Canvas = DOM", async () => {
    const { root, ofType, workspace, render } = await open("Table");
    const column = ofType("Column").find((c) => c.props.children === "Name")!;
    workspace.execute(
      setFields({
        targets: [workspace.itemOfRecord(column.id)!.target],
        props: { align: { kind: "set", value: "end" } },
      }),
    );
    const wrapperId = column.children[0]!;
    const textId = root.canvasInputs.get(wrapperId)!.children[0]!;
    const wrapper = geometryOf(root, wrapperId);
    const text = geometryOf(root, textId);
    expect(text.x + text.width).toBeCloseTo(wrapper.width, 0);
    const host = await render();
    const header = [...host.querySelectorAll("[role=columnheader]")].find(
      (h) => h.textContent === "Name",
    )!;
    expect(
      (header.firstElementChild as HTMLElement).style.justifyContent,
    ).toMatch(/^(flex-)?end$/);
  });
});

describe("S2 TableView — Cell content (`cellContent` span)", () => {
  const dataCells = (
    root: Awaited<ReturnType<typeof open>>["root"],
    ofType: Awaited<ReturnType<typeof open>>["ofType"],
  ) =>
    ofType("Cell").filter(
      (cell) =>
        !cell.children.some(
          (id) => root.typeOf(root.canvasInputs.get(id)!) === "Checkbox",
        ),
    );

  it("node tree: Cell > Text — the Text reads the Cell's `children`", async () => {
    const { root, ofType } = await open("Table");
    const cells = dataCells(root, ofType);
    expect(cells.map((cell) => cell.props.children)).toEqual([
      "Item 1",
      "File",
      "Active",
    ]);
    for (const cell of cells) {
      expect(cell.children).toHaveLength(1);
      const text = root.canvasInputs.get(cell.children[0]!)!;
      expect(root.typeOf(text)).toBe("Text");
      expect(text.props.children).toBe(cell.props.children);
    }
  });

  it("DOM: td > span — S2 `cellContent`, truncating (one line, ellipsis) by default", async () => {
    const { render } = await open("Table");
    const host = await render();
    const cell = [
      ...host.querySelectorAll("[role=rowheader], [role=gridcell]"),
    ].find((td) => td.textContent === "Item 1")!;
    expect(cell.children).toHaveLength(1);
    const span = cell.firstElementChild as HTMLElement;
    expect(span.tagName).toBe("SPAN");
    expect(span.textContent).toBe("Item 1");
    expect(span.style.whiteSpace).toBe("nowrap");
    expect(span.style.textOverflow).toBe("ellipsis");
  });

  it("Canvas: the Cell paints no text of its own — its Text does", async () => {
    const { root, ofType } = await open("Table");
    const [cell] = dataCells(root, ofType);
    const text = root.canvasInputs.get(cell!.children[0]!)!;
    expect(text.visual.whiteSpace).toBe("nowrap");
    const cellBox = geometryOf(root, cell!.id);
    const textBox = geometryOf(root, text.id);
    // (S2 `cellContent` `width: full` — the Text spans the cell's content box.)
    expect(textBox.width).toBeCloseTo(cellBox.width - 32, 0);
  });

  it("align end: the Text's alignment (S2 `cellContent` textAlign) — Canvas = DOM", async () => {
    const { root, ofType, workspace, render } = await open("Table");
    const [cell] = dataCells(root, ofType);
    workspace.execute(
      setFields({
        targets: [workspace.itemOfRecord(cell!.id)!.target],
        props: { align: { kind: "set", value: "end" } },
      }),
    );
    const text = root.canvasInputs.get(
      ofType("Cell").find((c) => c.id === cell!.id)!.children[0]!,
    )!;
    expect(text.visual.textAlign).toMatch(/^(right|end)$/);
    const host = await render();
    const span = [
      ...host.querySelectorAll(
        "[role=rowheader] > span, [role=gridcell] > span",
      ),
    ].find((s) => s.textContent === "Item 1") as HTMLElement;
    expect(span.style.textAlign).toMatch(/^(right|end)$/);
  });

  it("a new Row's cells are Cell > Text (the Table's + Row)", async () => {
    const { root, ofType, workspace } = await open("Table");
    const before = dataCells(root, ofType).length;
    const { catalogItemInsertChoices } = await import("../itemInsert");
    const body = ofType("TableBody")[0]!;
    workspace.execute(
      catalogItemInsertChoices(
        {
          graph: workspace.runtime.graph,
          readModel: workspace.readModel,
          newId: workspace.newId,
        },
        workspace.positionOfRecord(body.id)!,
      )
        .find((choice) => choice.type === "Row")!
        .build(),
    );
    const cells = dataCells(root, ofType);
    expect(cells.length).toBe(before * 2);
    for (const cell of cells.slice(before))
      expect(root.typeOf(root.canvasInputs.get(cell.children[0]!)!)).toBe(
        "Text",
      );
  });
});

describe("S2 TableView — a Column with a menu (`ColumnWithMenu`: allowsResizing)", () => {
  it("Canvas: the ⋮ after the name only while the column has its menu; the column's side padding moves to its button (S2 `isMenu` 0 · button 16) and it gets an end line", async () => {
    const { root, ofType, workspace } = await open("Table");
    const column = () =>
      ofType("Column").find((c) => c.props.children === "Name")!;
    const wrapper = () => root.canvasInputs.get(column().children[0]!)!;
    const icon = () =>
      wrapper()
        .children.map((id) => root.canvasInputs.get(id)!)
        .find((child) => root.typeOf(child) === "Icon")!;
    expect(icon().props.iconName).toBe("ellipsis-vertical");
    expect(icon().hidden).toBe(true);
    workspace.execute(
      setFields({
        targets: [workspace.itemOfRecord(column().id)!.target],
        props: { allowsResizing: { kind: "set", value: true } },
      }),
    );
    expect(icon().hidden).toBeFalsy();
    const columnBox = geometryOf(root, column().id);
    const wrapperBox = geometryOf(root, wrapper().id);
    const iconBox = geometryOf(root, icon().id);
    expect(wrapperBox.x).toBe(0);
    // (the end line: 1px)
    expect(wrapperBox.width).toBeCloseTo(columnBox.width - 1, 0);
    // (the button's 16 padding, then the name, then the ⋮ — S2 `moreVerticalIcon`
    // `marginStart: text-to-visual` (6 at 14px) right after it: the button packs its content at
    // the start)
    const text = root.canvasInputs.get(wrapper().children[0]!)!;
    const textBox = geometryOf(root, text.id);
    expect(textBox.x).toBe(16);
    expect(iconBox.x).toBeCloseTo(textBox.x + textBox.width + 6, 0);
  });
});
