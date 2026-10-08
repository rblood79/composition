// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { act, fireEvent, render } from "@testing-library/react";
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Button } from "react-aria-components/Button";
import { CheckboxButton, CheckboxField } from "react-aria-components/Checkbox";
import { Tree, TreeItem, TreeItemContent } from "react-aria-components/Tree";
import { afterEach, describe, expect, it } from "vitest";
import {
  insertNodes,
  removeTargets,
  setFields,
} from "../../../../../../packages/shared/src/catalog/commands";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  EntryId,
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { renderCatalogDom } from "../domBinding";
import { catalogPaletteDefinitionId } from "../paletteInsert";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * ADR-256 Phase 5h (G2) — a TreeItem's row is the reference's (react-aria.adobe.com Tree, the
 * starter's `TreeItem` / `TreeItemContent`): `TreeItem > TreeItemContent > Button[slot=chevron] >
 * ChevronRight + title`, the child items after the content. The content is free (RAC
 * `ChildrenOrFunction`): the chevron is an authored Button RAC gives the item's expand props, not a
 * part the shared Tree adds.
 */
const BODY = "project:node:home-body" as NodeId;
const OWNER = "project:node:tree" as NodeId;
const set = <T,>(value: T) => ({ kind: "set" as const, value });

const cleanups: Array<() => void> = [];
afterEach(() => {
  for (const cleanup of cleanups.splice(0).reverse()) cleanup();
});

/** The palette's Tree (the Tree origin: Node 1 > Node 1.1, Node 2). */
async function open(props: Record<string, unknown> = {}) {
  const library = await buildCodeCatalogLibrary();
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:adr256-tree" as EntryId<"project">,
        name: "Tree",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, `adr256-tree-${Math.random()}`),
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
          definitionId: catalogPaletteDefinitionId(library, "Tree"),
          children: [],
          props: Object.fromEntries(
            Object.entries(props).map(([key, value]) => [key, set(value)]),
          ),
          visual: {},
          sizing: {},
          descendantOverrides: [],
        } as unknown as NodeEntry,
      ],
      rootIds: [OWNER],
      newId: workspace.newId,
    }),
  );
  cleanups.push(() => act(() => workspace.dispose()));
  const root = workspace.root;
  const tree = [...root.canvasInputs.values()].find(
    (record) => record.bindingId === "tree",
  )!;
  const of = (type: string) =>
    [...root.canvasInputs.values()].filter((r) => root.typeOf(r) === type);
  const html = () => renderToStaticMarkup(renderCatalogDom(root, tree.id));
  return { workspace, root, tree, of, html };
}

/** The RAC Tree element of rendered markup (SSR also writes RAC's collection template). */
function treeOf(html: string): Element {
  const host = document.createElement("div");
  host.innerHTML = html;
  // Known differences collapsed: our Icon is `div.react-aria-Icon > svg` (the reference's glyph is
  // the svg), our title is a Text node (a span around the reference's text).
  for (const icon of [...host.querySelectorAll("div.react-aria-Icon")])
    icon.replaceWith(...icon.childNodes);
  for (const svg of [...host.querySelectorAll("svg")]) svg.innerHTML = "";
  for (const span of [...host.querySelectorAll("[role=gridcell] > span")])
    span.replaceWith(...span.childNodes);
  return host.querySelector("[role=treegrid]")!;
}

/** Decision 11 structure: tag · role · slot · aria (links as positions) · text. */
function structure(tree: Element): string {
  const all = [...tree.querySelectorAll("*")];
  const position = (id: string) => {
    const index = all.findIndex((element) => element.id === id);
    return index < 0 ? "outside" : `#${index}`;
  };
  const LINKS = new Set(["aria-labelledby", "aria-describedby"]);
  const walk = (element: Element): string => {
    const attributes = [...element.attributes]
      .filter(
        (attribute) =>
          /^(role|slot|aria-(?!labelledby|describedby).*)$/.test(
            attribute.name,
          ) || LINKS.has(attribute.name),
      )
      .map((attribute) =>
        LINKS.has(attribute.name)
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
  return [...tree.children].map(walk).join("");
}

/** The reference's selection checkbox (the starter `<Checkbox slot="selection" />`). */
let withCheckbox = false;
const checkbox = () =>
  createElement(
    CheckboxField,
    { key: "selection", slot: "selection" },
    createElement(
      CheckboxButton,
      null,
      createElement("div", { className: "indicator" }),
    ),
  );

/** The reference's item (the starter `TreeItem` with a `title`). */
const item = (
  id: string,
  title: string,
  ...children: ReactElement[]
): ReactElement =>
  createElement(TreeItem, {
    key: id,
    id,
    textValue: title,
    children: [
      createElement(TreeItemContent, {
        key: "content",
        children: [
          ...(withCheckbox ? [checkbox()] : []),
          createElement(
            Button,
            { key: "chevron", slot: "chevron" },
            createElement("svg", { "aria-hidden": "true" }),
          ),
          title,
        ],
      }),
      ...children,
    ],
  });

const reference = (
  expandedKeys: string[],
  selection: { mode: string; behavior: string } = {
    mode: "single",
    behavior: "replace",
  },
) =>
  renderToStaticMarkup(
    createElement(
      Tree,
      {
        "aria-label": "Tree",
        selectionMode: selection.mode as "single",
        selectionBehavior: selection.behavior as "replace",
        expandedKeys,
      },
      item("item-1", "Node 1", item("item-1-1", "Node 1.1")),
      item("item-2", "Node 2"),
    ),
  );

describe("ADR-256 Phase 5h — TreeItem is the reference's node tree", () => {
  it.each([[[]], [["item-1"]]])(
    "the Tree origin has the reference structure (expandedKeys %j)",
    async (expandedKeys) => {
      const { html, of } = await open({ expandedKeys });
      expect(structure(treeOf(html()))).toBe(
        structure(treeOf(reference(expandedKeys))),
      );
      // Each item holds its row content, the content its chevron Button and title.
      const content = of("TreeItemContent");
      expect(content).toHaveLength(3);
      expect(of("TreeItemChevron")).toHaveLength(0);
    },
  );

  it("the chevron is the item's RAC expand button: a plain RAC Button (no filled button paint), one per item", async () => {
    const { html } = await open({ expandedKeys: ["item-1"] });
    const tree = treeOf(html());
    const buttons = [...tree.querySelectorAll("button[slot=chevron]")];
    expect(buttons).toHaveLength(3);
    for (const button of buttons) {
      // (RAC's `expandButtonProps` — an excluded-from-tab-order button named by the row.)
      expect(button.getAttribute("tabindex")).toBe("-1");
      expect(button.getAttribute("aria-label")).toBeTruthy();
      expect(button.className).toBe("react-aria-Button");
      // (`Tree.css` styles it — no inline box of the Button type; its glyph takes the button's
      // color, the row's: no inline color.)
      expect(button.getAttribute("style") ?? "").not.toMatch(
        /padding-left|box-sizing|font-size/,
      );
      expect(button.querySelector("svg")?.getAttribute("stroke")).toBe(
        "currentColor",
      );
    }
    // (The shared Tree's info button and its own chevron are gone.)
    expect(tree.querySelectorAll("button:not([slot])")).toHaveLength(0);
  });

  it("the content is free: without its chevron Button the row draws none (Canvas and DOM)", async () => {
    const { workspace, root, html, of } = await open();
    const [first] = of("TreeItemContent");
    const chevron = root.canvasInputs.get(first.children[0])!;
    expect(chevron.props.slot).toBe("chevron");
    workspace.execute(
      removeTargets({
        targets: [workspace.positionOfRecord(chevron.id)!.target],
      }),
    );
    expect(
      treeOf(html()).querySelectorAll("button[slot=chevron]"),
    ).toHaveLength(1);
    const content = of("TreeItemContent")[0];
    expect(
      content.children.map((id) => root.typeOf(root.canvasInputs.get(id)!)),
    ).toEqual(["Text"]);
  });

  it("a row's title names the RAC item (textValue = the content's Text)", async () => {
    const { workspace, root, html, of } = await open();
    const label = of("Text").find((text) => text.props.children === "Node 2")!;
    workspace.execute(
      setFields({
        targets: [workspace.positionOfRecord(label.id)!.target],
        props: { children: set("Docs") },
      }),
    );
    expect(root.canvasInputs.get(label.id)!.props.children).toBe("Docs");
    const rows = [...treeOf(html()).querySelectorAll("[role=row]")];
    expect(rows.map((row) => row.textContent)).toEqual(["Node 1", "Docs"]);
  });
});

/**
 * ADR-256 Phase 5h-2 — a TreeItem's selection checkbox is the author's `Checkbox[slot=selection]` in
 * its row content (the reference's `<Checkbox slot="selection" />` — G0 ④-1b: no `selectionMode`
 * condition, the author puts it in). RAC's TreeItem connects it to the item's selection
 * (`CheckboxFieldContext` slot `selection`); no item draws one of its own.
 */
describe("ADR-256 Phase 5h-2 — a TreeItem's selection checkbox is a Checkbox[selection] node", () => {
  const MULTIPLE = { selectionMode: "multiple", selectionStyle: "checkbox" };
  /** The author's edit: a selection Checkbox first in each item's row content. */
  const addCheckboxes = (
    workspace: Awaited<ReturnType<typeof open>>["workspace"],
    contents: readonly { id: string }[],
  ) => {
    for (const content of contents) {
      const box = workspace.newId("node") as NodeId;
      workspace.root.execute(
        insertNodes({
          parent: workspace.positionOfRecord(content.id)!.target as never,
          index: 0,
          entries: [
            {
              kind: "node",
              id: box,
              definitionId: "lib:definition:origin-component-checkbox",
              children: [],
              props: { children: set(""), slot: set("selection") },
              visual: {},
              sizing: {},
              descendantOverrides: [],
            } as unknown as NodeEntry,
          ],
          rootIds: [box],
          newId: workspace.newId,
        }),
      );
    }
  };

  it("without the node no row has a checkbox (the item does not add one)", async () => {
    const { html } = await open(MULTIPLE);
    expect(treeOf(html()).querySelector("[slot=selection]")).toBeNull();
  });

  it("the author's Checkbox[selection] node: the reference structure, connected to the item", async () => {
    const { workspace, html, of } = await open({
      ...MULTIPLE,
      expandedKeys: ["item-1"],
    });
    addCheckboxes(workspace, of("TreeItemContent"));
    withCheckbox = true;
    try {
      expect(structure(treeOf(html()))).toBe(
        structure(
          treeOf(
            reference(["item-1"], { mode: "multiple", behavior: "toggle" }),
          ),
        ),
      );
    } finally {
      withCheckbox = false;
    }
  });

  it("on the Canvas it is drawn in the row content, as the item is selected and selectable — and follows the Tree's selectionMode", async () => {
    const { workspace, root, of } = await open(MULTIPLE);
    addCheckboxes(workspace, of("TreeItemContent"));
    // (One per row content — the collapsed child item's too, in its hidden subtree.)
    const boxes = () => of("Checkbox");
    expect(boxes()).toHaveLength(3);
    for (const box of boxes()) {
      expect(root.typeOf(root.canvasInputs.get(box.parentId)!)).toBe(
        "TreeItemContent",
      );
      expect(box.derivedProps?._isSelected).toBe(false);
      expect(box.derivedProps?.isDisabled).toBeUndefined();
    }
    // A Tree that selects nothing: the checkboxes are disabled (RAC `canSelectItem`) — re-derived
    // through the row content on the Tree's edit.
    const tree = of("Tree")[0];
    workspace.execute(
      setFields({
        targets: [workspace.positionOfRecord(tree.id)!.target],
        props: { selectionMode: set("none") },
      }),
    );
    expect(boxes().every((box) => box.derivedProps?.isDisabled === true)).toBe(
      true,
    );
  });

  it("in the Preview it selects its row (RAC's selection — the Tree's run state), and the row press follows the Tree's selectionStyle", async () => {
    const rowsSelected = (container: HTMLElement) =>
      [...container.querySelectorAll("[role=row]")].map(
        (row) => row.getAttribute("aria-selected") === "true",
      );
    for (const [style, afterRows] of [
      ["checkbox", [true, true]],
      ["highlight", [false, true]],
    ] as const) {
      const { workspace, root, tree, of } = await open({
        selectionMode: "multiple",
        selectionStyle: style,
      });
      addCheckboxes(workspace, of("TreeItemContent"));
      const view = render(renderCatalogDom(root, tree.id));
      cleanups.push(() => view.unmount());
      const boxes = [
        ...view.container.querySelectorAll("[role=row] input[type=checkbox]"),
      ];
      expect(boxes).toHaveLength(2);
      fireEvent.click(boxes[0]!);
      expect(rowsSelected(view.container)).toEqual([true, false]);
      fireEvent.click(boxes[0]!);
      expect(rowsSelected(view.container)).toEqual([false, false]);
      // A row press: a checkbox Tree toggles each row (RAC `toggle`), a highlight Tree replaces.
      const rows = [...view.container.querySelectorAll("[role=row]")];
      for (const row of rows) {
        fireEvent.pointerDown(row, {
          pointerType: "mouse",
          button: 0,
          pointerId: 1,
        });
        fireEvent.pointerUp(row, {
          pointerType: "mouse",
          button: 0,
          pointerId: 1,
        });
        fireEvent.click(row, { detail: 1 });
      }
      expect(rowsSelected(view.container), style).toEqual(afterRows);
    }
  });
});
