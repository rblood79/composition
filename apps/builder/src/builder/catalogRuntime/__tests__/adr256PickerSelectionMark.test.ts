// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  EntryId,
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import {
  insertNodes,
} from "../../../../../../packages/shared/src/catalog/commands";
import type { CatalogConsumerNode } from "../compositionRoot";
import { renderCatalogDom } from "../domBinding";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * ADR-256 Phase 6f (G2 동작): a picker's item shows its selection as the reference's DropdownItem
 * does (`isSelected && <Check />`). By default the sheet's glyph (`ListBox.css` — the picker
 * Popover's `[data-selected]::before`) is the mark; an author's node shown while the item is
 * selected (`showWhen isSelected`) follows RAC's selection (the item's render props) and stands in
 * for the glyph (`data-selection-mark` — the two do not both show), as a MenuItem's (Phase 5g).
 */
const BODY = "project:node:home-body" as NodeId;
const FIELD = "project:node:field" as NodeId;
const MARK = "project:node:mark" as NodeId;
const set = <T>(value: T) => ({ kind: "set" as const, value });
const TYPES = ["select", "combobox"] as const;

async function open(type: (typeof TYPES)[number]) {
  const library = await buildCodeCatalogLibrary();
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:adr256-picker-mark" as EntryId<"project">,
        name: "Picker mark",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, `adr256-picker-mark-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1200, height: 800 },
      autosaveSchedule: () => {},
    },
  );
  workspace.execute(
    insertNodes({
      parent: { kind: "node", id: BODY },
      entries: [
        {
          kind: "node",
          id: FIELD,
          definitionId: `lib:definition:origin-component-${type}`,
          children: [],
          props: { label: set("Animal") },
          visual: {},
          sizing: {},
          descendantOverrides: [],
        } as NodeEntry,
      ],
      rootIds: [FIELD],
      newId: workspace.newId,
    }),
  );
  const root = workspace.root;
  const field = () =>
    [...root.domInputs.values()].find((record) => record.sourceId === FIELD)!;
  const childOf = (
    records: ReadonlyMap<string, CatalogConsumerNode>,
    parent: CatalogConsumerNode,
    type: string,
  ) =>
    parent.children
      .map((id) => records.get(id)!)
      .find((record) => root.typeOf(record) === type)!;
  /** The items of the picker's ListBox (in its Popover) on one side. */
  const items = (records: ReadonlyMap<string, CatalogConsumerNode>) => {
    const picker = records.get(field().id)!;
    const list = childOf(
      records,
      childOf(records, picker, "Popover"),
      "ListBox",
    );
    return list.children.map((id) => records.get(id)!);
  };
  /** The author's mark — a check Icon shown while the item is selected — put first in an item. */
  const putMark = (item: CatalogConsumerNode) =>
    workspace.execute(
      insertNodes({
        parent: workspace.positionOfRecord(item.id)!.target as never,
        index: 0,
        entries: [
          {
            kind: "node",
            id: MARK,
            definitionId: "lib:definition:type-Icon",
            children: [],
            props: { iconName: set("check"), size: set("xs") },
            visual: {},
            sizing: {},
            descendantOverrides: [],
            showWhen: { all: ["isSelected"] },
          } as NodeEntry,
        ],
        rootIds: [MARK],
        newId: workspace.newId,
      }),
    );
  const mounted = async () => {
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    (globalThis as { ResizeObserver?: unknown }).ResizeObserver ??= class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
    const host = document.body.appendChild(document.createElement("div"));
    const reactRoot = createRoot(host);
    await act(async () => {
      reactRoot.render(renderCatalogDom(root, field().id));
    });
    const trigger = host.querySelector<HTMLElement>("button")!;
    const options = () => [
      ...document.body.querySelectorAll<HTMLElement>(
        '.react-aria-Popover [role="option"]',
      ),
    ];
    return {
      press: () => act(async () => trigger.click()),
      options,
      choose: (index: number) => act(async () => options()[index]!.click()),
      mark: () => {
        const record = [...root.domInputs.values()].find(
          (entry) => entry.sourceId === MARK,
        );
        return record
          ? document.body.querySelector(
              `.react-aria-Popover [data-catalog-id="${record.id}"]`,
            )
          : null;
      },
      unmount: async () => {
        await act(async () => reactRoot.unmount());
        host.remove();
      },
    };
  };
  return { workspace, root, field, items, putMark, mounted };
}

describe("ADR-256 Phase 6f — a picker's item shows its selection", () => {
  it.each(TYPES)(
    "%s: without an author's mark the sheet's glyph is the mark — the selected item carries no `data-selection-mark`",
    async (type) => {
      const picker = await open(type);
      const view = await picker.mounted();
      await view.press();
      await view.choose(1);
      await view.press();
      const option = view.options()[1]!;
      expect(option.hasAttribute("data-selected")).toBe(true);
      expect(
        view.options().some((o) => o.hasAttribute("data-selection-mark")),
      ).toBe(false);
      await view.unmount();
    },
  );

  it.each(TYPES)(
    "%s: an author's mark (`showWhen isSelected`) follows RAC's selection and stands in for the glyph",
    async (type) => {
      const picker = await open(type);
      picker.putMark(picker.items(picker.root.domInputs)[1]!);
      // (The Canvas: the closed picker's list is not drawn — the mark with it.)
      const canvasMark = [...picker.root.canvasInputs.values()].find(
        (record) => record.sourceId === MARK,
      )!;
      expect(picker.root.typeOf(canvasMark)).toBe("Icon");
      const view = await picker.mounted();
      await view.press();
      // The marked item yields the glyph; the others keep it.
      expect(
        view.options().map((o) => o.hasAttribute("data-selection-mark")),
      ).toEqual([false, true, false, false]);
      // Not selected yet: RAC's `isSelected` is false — no mark.
      expect(view.mark()).toBeNull();
      await view.choose(1);
      await view.press();
      expect(view.options()[1]!.hasAttribute("data-selected")).toBe(true);
      expect(view.mark()).not.toBeNull();
      expect(view.options()[1]!.contains(view.mark())).toBe(true);
      // Another item chosen: the mark leaves with the selection.
      await view.choose(2);
      await view.press();
      expect(view.mark()).toBeNull();
      await view.unmount();
    },
  );
});
