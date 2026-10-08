// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { act, fireEvent, render } from "@testing-library/react";
import { createElement, type ElementType } from "react";
import {
  Autocomplete,
  Input,
  Label,
  ListBox,
  ListBoxItem,
  SearchField,
  useFilter,
} from "react-aria-components";
import { afterEach, describe, expect, it } from "vitest";
import { renderCatalogDom } from "../domBinding";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  EntryId,
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { insertNodes } from "../../../../../../packages/shared/src/catalog/commands";
import type { CatalogConsumerNode } from "../compositionRoot";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * ADR-256 Phase 6g (G2) — Autocomplete is RAC `Autocomplete` (react-aria.adobe.com Autocomplete,
 * "ListBox example": `Autocomplete > SearchField + ListBox`). It has no element of its own: the
 * Preview puts its children in its parent's flow, and the Canvas lays it out as `display:
 * contents` (the engine — its children are its parent's items, its box is their union). RAC gives
 * the text field the collection's input props and the collection the filter: typing filters the
 * items (the reference's `useFilter({sensitivity: "base"}).contains`).
 */
const BODY = "project:node:home-body" as NodeId;
const ROOT = "project:node:autocomplete" as NodeId;
const set = <T,>(value: T) => ({ kind: "set" as const, value });

const entry = (
  id: string,
  definitionId: string,
  props: Record<string, unknown> = {},
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

const cleanups: Array<() => void> = [];
afterEach(() => {
  for (const cleanup of cleanups.splice(0).reverse()) cleanup();
});

async function open(entries: NodeEntry[], rootIds = [entries[0]!.id]) {
  const library = await buildCodeCatalogLibrary();
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:adr256-autocomplete" as EntryId<"project">,
        name: "Autocomplete",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, `adr256-autocomplete-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1200, height: 800 },
      autosaveSchedule: () => {},
    },
  );
  workspace.execute(
    insertNodes({
      parent: { kind: "node", id: BODY },
      entries,
      rootIds: rootIds as NodeId[],
      newId: workspace.newId,
    }),
  );
  const root = workspace.root;
  const recordOf = (
    records: ReadonlyMap<string, CatalogConsumerNode>,
    sourceId: string,
  ) => [...records.values()].find((record) => record.sourceId === sourceId)!;
  /** Page coordinates of a Canvas record — the parents' rects added, as the Canvas does. */
  const pageRect = (id: string) => {
    let rect = root.getGeometry([id]).get(id)!;
    let x = rect.x;
    let y = rect.y;
    for (
      let parent = root.canvasInputs.get(root.canvasInputs.get(id)!.parentId);
      parent;
      parent = root.canvasInputs.get(parent.parentId)
    ) {
      const own = root.getGeometry([parent.id]).get(parent.id);
      if (!own) break;
      x += own.x;
      y += own.y;
    }
    rect = { ...rect, x, y };
    return rect;
  };
  return { workspace, root, recordOf, pageRect };
}

const mount = (element: ReturnType<typeof renderCatalogDom>) => {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  (globalThis as { ResizeObserver?: unknown }).ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  const view = render(element);
  cleanups.push(view.unmount);
  return view;
};

/** Element kinds of a host's top level (focus-scope markers and templates are RAC's own). */
const topLevel = (host: Element) =>
  [...host.children]
    .filter((child) => !["SPAN", "TEMPLATE"].includes(child.tagName))
    .map(
      (child) =>
        `${child.tagName.toLowerCase()}${child.getAttribute("role") ? `[${child.getAttribute("role")}]` : ""}`,
    );

/** The text field's attributes RAC Autocomplete gives (the collection link as a position). */
const inputLink = (host: Element) => {
  const input = host.querySelector("input")!;
  const listbox = host.querySelector('[role="listbox"]')!;
  return {
    autocomplete: input.getAttribute("aria-autocomplete"),
    controlsList: input.getAttribute("aria-controls") === listbox.id,
  };
};

const options = (host: Element) =>
  [...host.querySelectorAll('[role="option"]')].map((option) =>
    option.querySelector('[slot="label"]')
      ? option.querySelector('[slot="label"]')!.textContent
      : option.textContent,
  );

describe("ADR-256 Phase 6g — Autocomplete", () => {
  it("has the reference's structure: no element of its own — the SearchField and the ListBox in its parent's flow, the input controlling the list", async () => {
    const { root, recordOf } = await open([
      entry(ROOT, "lib:definition:origin-component-autocomplete"),
    ]);
    const view = mount(
      renderCatalogDom(root, recordOf(root.domInputs, ROOT).id),
    );
    // react-aria.adobe.com Autocomplete "ListBox example" (installed RAC).
    const Reference = () => {
      const { contains } = useFilter({ sensitivity: "base" });
      return createElement(
        Autocomplete as ElementType,
        { filter: contains },
        createElement(
          SearchField,
          null,
          createElement(Label, null, "Search"),
          createElement(Input, { placeholder: "Search items" }),
        ),
        createElement(
          ListBox,
          { "aria-label": "List" },
          createElement(ListBoxItem, { id: "inbox" }, "Inbox"),
          createElement(ListBoxItem, { id: "starred" }, "Starred"),
          createElement(ListBoxItem, { id: "archive" }, "Archive"),
        ),
      );
    };
    const reference = mount(createElement(Reference));
    expect(topLevel(view.container)).toEqual(topLevel(reference.container));
    expect(topLevel(view.container)).toEqual(["div", "div[listbox]"]);
    expect(inputLink(view.container)).toEqual(inputLink(reference.container));
    expect(inputLink(view.container)).toEqual({
      autocomplete: "list",
      controlsList: true,
    });
  });

  it("filters the list by the text field's value (the reference's `contains`, case-insensitive)", async () => {
    const { root, recordOf } = await open([
      entry(ROOT, "lib:definition:origin-component-autocomplete"),
    ]);
    const view = mount(
      renderCatalogDom(root, recordOf(root.domInputs, ROOT).id),
    );
    const input = view.container.querySelector("input")!;
    expect(options(view.container)).toEqual(["Inbox", "Starred", "Archive"]);
    await act(async () => {
      fireEvent.change(input, { target: { value: "AR" } });
    });
    expect(options(view.container)).toEqual(["Starred", "Archive"]);
    await act(async () => {
      fireEvent.change(input, { target: { value: "" } });
    });
    expect(options(view.container)).toEqual(["Inbox", "Starred", "Archive"]);
  });

  it("starts from `defaultInputValue` (RAC prop — the origin's own prop)", async () => {
    const { root, recordOf } = await open([
      entry(ROOT, "lib:definition:origin-component-autocomplete", {
        defaultInputValue: "inb",
      }),
    ]);
    const view = mount(
      renderCatalogDom(root, recordOf(root.domInputs, ROOT).id),
    );
    expect(view.container.querySelector("input")!.value).toBe("inb");
    expect(options(view.container)).toEqual(["Inbox"]);
  });

  it("Canvas: its children stand where they would stand directly in its parent (`display: contents` — the parent's row and gap); its box is their union", async () => {
    const FRAME = "project:node:row";
    const SEARCH = "project:node:search";
    const LIST = "project:node:list";
    // A row with a gap: a box of its own would stack the two in a column inside one row item.
    const row = (children: string[]) =>
      ({
        ...entry(FRAME, "lib:definition:type-frame"),
        children,
        layout: {
          display: set("flex"),
          flexDirection: set("row"),
          columnGap: set("24px"),
        },
        sizing: { width: set(1000) },
      }) as NodeEntry;
    const nested = await open([
      row([ROOT]),
      entry(ROOT, "lib:definition:origin-component-autocomplete"),
    ]);
    const flat = await open([
      row([SEARCH, LIST]),
      entry(SEARCH, "lib:definition:origin-component-searchfield", {
        label: "Search",
        placeholder: "Search items",
      }),
      entry(LIST, "lib:definition:origin-component-listbox"),
    ]);
    const autocomplete = nested.recordOf(nested.root.canvasInputs, ROOT);
    expect(nested.root.typeOf(autocomplete)).toBe("Autocomplete");
    const [search, list] = autocomplete.children;
    const flatSearch = flat.recordOf(flat.root.canvasInputs, SEARCH).id;
    const flatList = flat.recordOf(flat.root.canvasInputs, LIST).id;
    expect(nested.pageRect(search!)).toEqual(flat.pageRect(flatSearch));
    expect(nested.pageRect(list!)).toEqual(flat.pageRect(flatList));
    const first = nested.pageRect(search!);
    const last = nested.pageRect(list!);
    // Side by side, the parent's gap between them.
    expect(last.x).toBe(first.x + first.width + 24);
    const box = nested.pageRect(autocomplete.id);
    expect({
      x: box.x,
      y: box.y,
      width: box.width,
      height: box.height,
    }).toEqual({
      x: first.x,
      y: Math.min(first.y, last.y),
      width: last.x + last.width - first.x,
      height:
        Math.max(first.y + first.height, last.y + last.height) -
        Math.min(first.y, last.y),
    });
  });
});
