import "fake-indexeddb/auto";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import { definitionTypeName } from "../../../../../../packages/shared/src/catalog/commands/context";
import type {
  DefinitionId,
  EntryId,
  LibraryDefinitionId,
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import {
  insertNodes,
  removeTargets,
  setFields,
  setLibraryDefault,
} from "../../../../../../packages/shared/src/catalog/commands";
import type { CatalogConsumerNode } from "../compositionRoot";
import { renderCatalogDom } from "../domBinding";
import { catalogItemInsertChoices } from "../itemInsert";
import { newCatalogProjectDocument } from "../project";
import { catalogRowTemplateId, catalogRowTemplateOwner } from "../rowTemplate";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * ADR-253 Phase 4 (G4): a Select · ComboBox holds its items in its ListBox — an instance of the
 * ListBox origin whose slot the picker's items fill. The Canvas and the Preview read the same
 * nodes: the Preview's option list is the ListBox node's element inside the picker's Popover
 * (before, the Preview had no options at all and the picker did not open — F11).
 */
const BODY = "project:node:home-body" as NodeId;
const FIELD = "project:node:field" as NodeId;
const LISTBOX_ORIGIN =
  "lib:definition:origin-component-listbox" as LibraryDefinitionId;
const set = <T>(value: T) => ({ kind: "set" as const, value });

async function open(type: string, patch: Partial<NodeEntry> = {}) {
  const library = await buildCodeCatalogLibrary();
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:adr253-picker" as EntryId<"project">,
        name: "ADR-253 picker",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, `adr253-picker-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1200, height: 800 },
      autosaveSchedule: () => {},
    },
  );
  const node: NodeEntry = {
    kind: "node",
    id: FIELD,
    definitionId:
      `lib:definition:origin-component-${type}` as LibraryDefinitionId,
    children: [],
    props: {},
    visual: {},
    sizing: {},
    descendantOverrides: [],
    ...patch,
  };
  workspace.execute(
    insertNodes({
      parent: { kind: "node", id: BODY },
      entries: [node],
      rootIds: [FIELD],
      newId: workspace.newId,
    }),
  );
  const typeOf = (record: CatalogConsumerNode) =>
    definitionTypeName(
      workspace.runtime.graph,
      record.definitionId as DefinitionId,
    );
  /**
   * The picker's records on one side: the field, its ListBox and the items in it (a Select's
   * ListBox is in its Popover — ADR-256 Phase 6c; `closed` = the node the closed picker hides).
   */
  const side = (records: ReadonlyMap<string, CatalogConsumerNode>) => {
    const field = records.get(workspace.root.recordsOfSource(FIELD)[0]!)!;
    const children = field.children.map((id) => records.get(id)!);
    const popover = children.find((child) => typeOf(child) === "Popover");
    const list = (
      popover ? popover.children.map((id) => records.get(id)!) : children
    ).find((child) => typeOf(child) === "ListBox")!;
    const items = list.children.map((id) => records.get(id)!);
    const labelOf = (item: CatalogConsumerNode) =>
      item.children
        .map((id) => records.get(id)!)
        .find((part) => typeOf(part) === "Text" && part.props.slot === "label")
        ?.props.children;
    return {
      field,
      popover,
      closed: popover ?? list,
      list,
      items,
      childTypes: children.map(typeOf),
      itemTypes: items.map(typeOf),
      labels: items.map(labelOf),
      all: [...records.values()],
    };
  };
  const canvas = () => side(workspace.root.canvasInputs);
  const dom = () => side(workspace.root.domInputs);
  /**
   * The Preview's picker, mounted: press its trigger and read the open list (RAC renders the
   * Popover into the document body).
   */
  const mounted = async () => {
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    // (jsdom has no ResizeObserver; the shared pickers size their Popover with one.)
    (globalThis as { ResizeObserver?: unknown }).ResizeObserver ??= class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
    const host = document.body.appendChild(document.createElement("div"));
    const reactRoot = createRoot(host);
    await act(async () => {
      reactRoot.render(renderCatalogDom(workspace.root, dom().field.id));
    });
    const trigger = host.querySelector("button")!;
    const listbox = () => document.body.querySelector('[role="listbox"]');
    return {
      host,
      trigger,
      listbox,
      press: () => act(async () => trigger.click()),
      options: () =>
        [...document.body.querySelectorAll('[role="option"]')].map((option) =>
          (option.textContent ?? "").trim(),
        ),
      unmount: async () => {
        await act(async () => reactRoot.unmount());
        host.remove();
      },
    };
  };
  const choices = (record: CatalogConsumerNode) =>
    catalogItemInsertChoices(
      {
        graph: workspace.runtime.graph,
        readModel: workspace.readModel,
        newId: workspace.newId,
      },
      workspace.positionOfRecord(record.id)!,
    );
  return { workspace, canvas, dom, mounted, choices, typeOf };
}

describe("ADR-253 Phase 4 — a Select · ComboBox holds its items in its ListBox", () => {
  for (const type of ["select", "combobox"]) {
    const LABELS = ["Aardvark", "Cat", "Dog", "Kangaroo"];

    it(`${type}: the ListBox holds the picker's items on the Canvas and in the Preview`, async () => {
      const picker = await open(type);
      for (const read of [picker.canvas, picker.dom]) {
        const { childTypes, itemTypes, labels, closed, popover, items, all } =
          read();
        // The items are inside the ListBox — none beside it, none of the ListBox origin's own. The
        // ListBox is in the picker's Popover (the reference's `Popover > ListBox`, ADR-256 Phase
        // 6c · 6d).
        expect(childTypes.filter((name) => name === "ListBox")).toEqual([]);
        expect(popover).toBeDefined();
        expect(childTypes).not.toContain("ListBoxItem");
        expect(itemTypes).toEqual(items.map(() => "ListBoxItem"));
        expect(labels).toEqual(LABELS);
        expect(items.map((item) => item.sourceId)).toEqual(
          [1, 2, 3, 4].map((n) => `lib:template:component-${type}__item-${n}`),
        );
        expect(
          all.filter((record) =>
            record.sourceId.startsWith("lib:template:component-listbox__item-"),
          ),
        ).toEqual([]);
        // The closed list is not drawn on the Canvas (its subtree follows it).
        expect(closed.hidden).toBe(true);
      }
    });

    it(`${type}: "+" on the picker or its ListBox adds an item to the list on both sides`, async () => {
      const picker = await open(type);
      const { workspace } = picker;
      const offered = (record: CatalogConsumerNode) =>
        picker.choices(record).map((choice) => choice.type);
      expect(offered(picker.dom().field)).toEqual([
        "ListBoxItem",
        "ListBoxSection",
      ]);
      expect(offered(picker.dom().list)).toEqual([
        "ListBoxItem",
        "ListBoxSection",
      ]);
      const steps = () => workspace.history.getSnapshot().labels.length;
      const before = steps();
      workspace.execute(picker.choices(picker.dom().field)[0]!.build());
      expect(steps()).toBe(before + 1);
      for (const read of [picker.canvas, picker.dom]) {
        expect(read().labels).toEqual([...LABELS, "Item 5"]);
        expect(read().childTypes).not.toContain("ListBoxItem");
      }
      // … and from the ListBox row itself (now the instance's own fill).
      workspace.execute(picker.choices(picker.dom().list)[0]!.build());
      for (const read of [picker.canvas, picker.dom])
        expect(read().labels).toEqual([...LABELS, "Item 5", "Item 6"]);
      workspace.undo();
      workspace.undo();
      for (const read of [picker.canvas, picker.dom])
        expect(read().labels).toEqual(LABELS);
    });

    it(`${type}: an item's text edit and removal reach the list on both sides`, async () => {
      const picker = await open(type);
      const { workspace } = picker;
      const second = picker.dom().items[1]!;
      const label = second.children
        .map((id) => workspace.root.domInputs.get(id)!)
        .find((part) => part.props.slot === "label")!;
      workspace.execute(
        setFields({
          targets: [workspace.itemOfRecord(label.id)!.target],
          props: { children: set("Capybara") },
        }),
      );
      for (const read of [picker.canvas, picker.dom])
        expect(read().labels).toEqual([
          "Aardvark",
          "Capybara",
          "Dog",
          "Kangaroo",
        ]);
      workspace.execute(
        removeTargets({
          targets: [workspace.itemOfRecord(picker.dom().items[2]!.id)!.target],
        }),
      );
      for (const read of [picker.canvas, picker.dom])
        expect(read().labels).toEqual(["Aardvark", "Capybara", "Kangaroo"]);
    });

    it(`${type}: the ListBox origin's style reaches the picker's list`, async () => {
      const picker = await open(type);
      const { workspace } = picker;
      for (const color of ["#ff0000", "#0000ff"]) {
        workspace.execute(
          setLibraryDefault({
            definitionId: LISTBOX_ORIGIN,
            scope: "visual",
            key: "backgroundColor",
            write: set(color),
            newId: workspace.newId,
          }),
        );
        expect(picker.canvas().list.visual.backgroundColor).toBe(color);
        expect(picker.dom().list.visual.backgroundColor).toBe(color);
      }
    });

    it(`${type}: a bound picker's row template is the first item of its ListBox`, async () => {
      const picker = await open(type, {
        binding: { collectionId: "data:collection:rows", fieldMap: {} },
      });
      const { workspace } = picker;
      const graph = workspace.runtime.graph;
      expect(catalogRowTemplateId(graph, FIELD)).toBe(
        `lib:template:component-${type}__item-1`,
      );
      // (No rows loaded: the template items stay.) The first item and what is inside it edit
      // every row; the sample items do not.
      const [first, second] = picker.dom().items;
      const targetOf = (record: CatalogConsumerNode) =>
        workspace.itemOfRecord(record.id)!.target;
      expect(catalogRowTemplateOwner(graph, targetOf(first!))).toBe(FIELD);
      const label = workspace.root.domInputs.get(first!.children[0]!)!;
      expect(catalogRowTemplateOwner(graph, targetOf(label))).toBe(FIELD);
      expect(catalogRowTemplateOwner(graph, targetOf(second!))).toBeUndefined();
      expect(
        catalogRowTemplateOwner(graph, targetOf(picker.dom().list)),
      ).toBeUndefined();
    });

    it(`${type}: its Popover node takes RAC's place for the picker — \`bottom start\` below the trigger (ADR-256 Phase 6c · 6d)`, async () => {
      const picker = await open(type);
      // A trigger at x 100 (50 wide) and a wider list (200): the picker's place starts the list
      // at the trigger's start edge (a centred list would start at x 25). A Select's trigger is
      // its Button; a ComboBox's is its control Group (RAC's `GroupContext` ref).
      const triggerSelector =
        type === "select" ? "button" : ".react-aria-Group";
      const rect = (x: number, y: number, width: number, height: number) =>
        ({
          x,
          y,
          left: x,
          top: y,
          width,
          height,
          right: x + width,
          bottom: y + height,
          toJSON: () => ({}),
        }) as DOMRect;
      const rects = vi
        .spyOn(Element.prototype, "getBoundingClientRect")
        .mockImplementation(function (this: Element) {
          if (this.matches(triggerSelector)) return rect(100, 40, 50, 30);
          if (this.classList.contains("react-aria-Popover"))
            return rect(0, 0, 200, 120);
          return rect(0, 0, 1000, 800);
        });
      const sizes = ["clientWidth", "clientHeight"].map((key) =>
        vi
          .spyOn(document.documentElement, key as "clientWidth", "get")
          .mockReturnValue(key === "clientWidth" ? 1000 : 800),
      );
      try {
        const preview = await picker.mounted();
        await preview.press();
        const popover = preview
          .listbox()!
          .closest<HTMLElement>(".react-aria-Popover")!;
        expect(popover.style.left).toBe("100px");
        await preview.unmount();
      } finally {
        rects.mockRestore();
        for (const size of sizes) size.mockRestore();
      }
    });

    it(`${type}: the Preview's picker opens with the list's items`, async () => {
      const picker = await open(type);
      const { workspace } = picker;
      workspace.execute(picker.choices(picker.dom().field)[0]!.build());
      const preview = await picker.mounted();
      // Closed: no list in the document.
      expect(preview.listbox()).toBeNull();
      expect(preview.trigger.getAttribute("aria-expanded")).toBe("false");
      await preview.press();
      expect(preview.trigger.getAttribute("aria-expanded")).toBe("true");
      // The open list is the ListBox node's element, holding the item nodes' elements, in its
      // Popover node's element — RAC's Popover in the picker's context, no arrow (the reference's
      // `hideArrow`).
      const list = preview.listbox()!;
      const popover = list.closest(".react-aria-Popover")!;
      expect(popover.getAttribute("data-catalog-id")).toBe(
        picker.dom().popover!.id,
      );
      expect(popover.getAttribute("data-trigger")).toBe(
        type === "select" ? "Select" : "ComboBox",
      );
      expect(popover.querySelector(".react-aria-OverlayArrow")).toBeNull();
      expect(list.getAttribute("data-catalog-id")).toBe(picker.dom().list.id);
      expect(list.className).toBe("react-aria-ListBox");
      expect(list.getAttribute("data-size")).toBe("M");
      expect(preview.options()).toEqual([...LABELS, "Item 5"]);
      expect(
        [...list.querySelectorAll('[role="option"]')].map((option) =>
          option.getAttribute("data-catalog-id"),
        ),
      ).toEqual(picker.dom().items.map((item) => item.id));
      // Choosing an option: RAC shows it as the picker's value (the item's text is its label
      // part's) and closes the list.
      await act(async () =>
        (list.querySelectorAll('[role="option"]')[1] as HTMLElement).click(),
      );
      expect(preview.listbox()).toBeNull();
      if (type === "select")
        expect(preview.trigger.textContent).toContain("Cat");
      else expect(preview.host.querySelector("input")!.value).toBe("Cat");
      await preview.unmount();
    });
  }
});
