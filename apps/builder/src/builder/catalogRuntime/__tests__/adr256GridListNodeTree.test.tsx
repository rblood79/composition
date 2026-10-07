// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CheckboxButton, CheckboxField } from "react-aria-components/Checkbox";
import { GridList, GridListItem, Text } from "react-aria-components/GridList";
import { describe, expect, it } from "vitest";
import { insertNodes } from "../../../../../../packages/shared/src/catalog/commands";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  EntryId,
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { renderCatalogDom } from "../domBinding";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * ADR-256 Phase 5f (G2) — a GridList item's selection checkbox is a node (react-aria.adobe.com
 * GridList, G0 example 10): `GridListItem > (Checkbox[slot=selection] + children)`. The author puts
 * the Checkbox in (G0 ④-1b — no `selectionMode` condition); RAC connects it to the item's
 * selection (`CheckboxFieldContext` slot `selection`). No item draws one of its own.
 */
const BODY = "project:node:home-body" as NodeId;
const LIST = "project:node:grid" as NodeId;
const set = <T,>(value: T) => ({ kind: "set" as const, value });

async function open(props: Record<string, string> = {}) {
  const library = await buildCodeCatalogLibrary();
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:adr256-gridlist" as EntryId<"project">,
        name: "GridList",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, `adr256-gridlist-${Math.random()}`),
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
          id: LIST,
          definitionId: "lib:definition:origin-component-gridlist",
          children: [],
          props: Object.fromEntries(
            Object.entries(props).map(([key, value]) => [key, set(value)]),
          ),
          visual: {},
          sizing: {},
          descendantOverrides: [],
        } as NodeEntry,
      ],
      rootIds: [LIST],
      newId: workspace.newId,
    }),
  );
  const root = workspace.root;
  const html = () =>
    renderToStaticMarkup(
      renderCatalogDom(
        root,
        [...root.domInputs.values()].find((r) => r.sourceId === LIST)!.id,
      ),
    );
  const of = (type: string) =>
    [...root.canvasInputs.values()].filter((r) => root.typeOf(r) === type);
  /**
   * The author's edit (G0 example 10): a selection Checkbox first in each item, through the item's
   * position as the Builder's insert does — the item's content (its label · description) stays.
   */
  const addCheckboxes = (slot: string | null = "selection") => {
    const added: NodeId[] = [];
    for (const item of of("GridListItem")) {
      const box = workspace.newId("node") as NodeId;
      added.push(box);
      // (Through the root: the static markup cannot show RAC merging an automatic HTML id into
      // the ids its context links — the browser does, the live check.)
      workspace.root.execute(
        insertNodes({
          parent: workspace.positionOfRecord(item.id)!.target as never,
          index: 0,
          entries: [
            node(box, "lib:definition:origin-component-checkbox", {
              children: "",
              ...(slot === null ? {} : { slot }),
            }),
          ],
          rootIds: [box],
          newId: workspace.newId,
        }),
      );
    }
    return added;
  };
  return { workspace, root, html, of, addCheckboxes };
}

/** Decision 11 structure of the grid: tag · role · slot · aria (links as positions) · text. */
function gridStructure(html: string): string {
  const host = document.createElement("div");
  host.innerHTML = html;
  const grid = host.querySelector("[role=grid]")!;
  const all = [...grid.querySelectorAll("*")];
  const position = (id: string) => {
    const index = all.findIndex((element) => element.id === id);
    return index < 0 ? "outside" : `#${index}`;
  };
  const walk = (element: Element): string => {
    const attributes = [...element.attributes]
      .filter((attribute) => /^(role|slot|type|aria-.*)$/.test(attribute.name))
      .map((attribute) =>
        /^aria-(labelledby|describedby|controls)$/.test(attribute.name)
          ? `${attribute.name}=${attribute.value.split(" ").map(position).join(",")}`
          : `${attribute.name}=${attribute.value}`,
      )
      .sort();
    const content = [...element.childNodes].map((child) =>
      child.nodeType === 1
        ? walk(child as Element)
        : (child.textContent ?? "").trim(),
    );
    return `<${element.tagName.toLowerCase()} ${attributes.join(" ")}>${content.join("")}</>`;
  };
  return walk(grid);
}

const ITEMS = [
  ["documents", "Documents", "12 files"],
  ["images", "Images", "48 files"],
  ["downloads", "Downloads", "5 files"],
] as const;

function reference(withCheckbox: boolean): string {
  return renderToStaticMarkup(
    createElement(
      GridList,
      { "aria-label": "Grid List", selectionMode: "multiple", layout: "grid" },
      ...ITEMS.map(([id, label, description]) =>
        createElement(
          GridListItem,
          { key: id, id, textValue: label },
          ...(withCheckbox
            ? [
                createElement(
                  CheckboxField,
                  { key: "selection", slot: "selection" },
                  createElement(
                    CheckboxButton,
                    null,
                    createElement("div", { className: "indicator" }),
                  ),
                ),
              ]
            : []),
          // (Our item label is a Text node — the reference's plain text in a span.)
          createElement("span", { key: "label" }, label),
          createElement(
            Text,
            { key: "description", slot: "description" },
            description,
          ),
        ),
      ),
    ),
  );
}

describe("ADR-256 Phase 5f — a GridList item's selection checkbox is a Checkbox[selection] node", () => {
  it("multiple selection without the node: no checkbox (the item does not add one)", async () => {
    const { html } = await open({ selectionMode: "multiple" });
    expect(gridStructure(html())).toBe(gridStructure(reference(false)));
  });

  it("the author's Checkbox[selection] node: the reference structure, connected to the item", async () => {
    const { html, addCheckboxes } = await open({ selectionMode: "multiple" });
    addCheckboxes();
    expect(gridStructure(html())).toBe(gridStructure(reference(true)));
  });

  it("on the Canvas the node is drawn in the item, unselected as the item is", async () => {
    const { root, of, addCheckboxes } = await open({
      selectionMode: "multiple",
    });
    addCheckboxes();
    const boxes = of("Checkbox");
    expect(boxes).toHaveLength(3);
    expect(boxes.every((box) => box.hidden !== true)).toBe(true);
    for (const box of boxes) {
      expect(root.typeOf(root.canvasInputs.get(box.parentId)!)).toBe(
        "GridListItem",
      );
      // RAC's context value: the item's selection (none in the document — the Checkbox origin's
      // own selected display state gives way), selectable in a multiple-selection list.
      expect(box.derivedProps?._isSelected).toBe(false);
      expect(box.derivedProps?.isDisabled).toBeUndefined();
    }
    // (Its label is empty — absent, as the reference's `<Checkbox slot="selection" />`.)
    expect(
      of("Label")
        .filter((label) =>
          boxes.some(
            (box) => root.canvasInputs.get(label.parentId)?.parentId === box.id,
          ),
        )
        .every((label) => label.hidden === true),
    ).toBe(true);
  });

  it("a list that selects nothing: the checkbox is disabled (RAC `canSelectItem`) — Canvas and DOM", async () => {
    const { html, of, addCheckboxes } = await open();
    addCheckboxes();
    expect(
      of("Checkbox").every((box) => box.derivedProps?.isDisabled === true),
    ).toBe(true);
    expect(html().match(/<input[^>]*type="checkbox"[^>]*>/g)).toHaveLength(3);
    expect(
      html()
        .match(/<input[^>]*type="checkbox"[^>]*>/g)!
        .every((input) => input.includes("disabled")),
    ).toBe(true);
  });

  it("a Checkbox without the slot name is the item's plain content (RAC's default slot)", async () => {
    const { html, of, addCheckboxes } = await open({
      selectionMode: "multiple",
    });
    addCheckboxes(null);
    expect(html()).not.toContain('slot="selection"');
    expect(html()).not.toContain('aria-label="Select"');
    expect(of("Checkbox").every((box) => box.derivedProps?._isSelected === undefined)).toBe(true);
  });
});

const node = (
  id: NodeId,
  definitionId: string,
  props: Record<string, string>,
): NodeEntry =>
  ({
    kind: "node",
    id,
    definitionId,
    children: [],
    props: Object.fromEntries(
      Object.entries(props).map(([key, value]) => [key, set(value)]),
    ),
    visual: {},
    sizing: {},
    descendantOverrides: [],
  }) as NodeEntry;
