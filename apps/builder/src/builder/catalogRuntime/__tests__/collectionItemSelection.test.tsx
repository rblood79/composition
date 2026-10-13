// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import {
  insertNodes,
  setFields,
} from "../../../../../../packages/shared/src/catalog/commands";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  DefinitionId,
  EntryId,
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { catalogStateValue } from "../../../../../../packages/shared/src/catalog/runtime/presence";
import { renderCatalogDom } from "../domBinding";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * 2026-10-13 (사용자 「static으로 추가된 listboxitem 인경우 상태 선택 selected, default 등을
 * 선택할수있어야하지않나」 → 「권장안 1진행해. listbox만 문제가 아니라 동일한 패턴 이더 있다 모두
 * 수정해」): a static collection item picks its selection in the Design panel — its Selected
 * (`isSelected`, as a Tag's) starts its collection's RAC selection (`defaultSelectedKeys`; a Tabs'
 * `defaultSelectedKey`), and the Canvas paints the same items selected. Before, ListBox read a
 * `selectedKey` nothing could write, and GridList · Tree · Table · Menu started from none.
 */
const BODY = "project:node:home-body" as NodeId;
const OWNER = "project:node:collection" as NodeId;
const set = <T,>(value: T) => ({ kind: "set" as const, value });

async function open(
  definition: string,
  item: string,
  ownerProps: Record<string, unknown> = {},
) {
  const library = await buildCodeCatalogLibrary();
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:item-selection" as EntryId<"project">,
        name: "Item selection",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, `item-selection-${Math.random()}`),
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
          id: OWNER,
          definitionId:
            `lib:definition:origin-component-${definition}` as DefinitionId,
          children: [],
          props: Object.fromEntries(
            Object.entries(ownerProps).map(([key, value]) => [key, set(value)]),
          ),
          visual: {},
          sizing: {},
          descendantOverrides: [],
        } as NodeEntry,
      ],
      rootIds: [OWNER],
      newId: workspace.newId,
    }),
  );
  const root = workspace.root;
  const of = (type: string) =>
    [...root.canvasInputs.values()].filter((r) => root.typeOf(r) === type);
  const items = () => of(item);
  const target = (id: string) => workspace.positionOfRecord(id)!.target;
  const select = (index: number, value = true) =>
    workspace.execute(
      setFields({
        targets: [target(items()[index]!.id)],
        props: { isSelected: set(value) },
      }),
    );
  const canvasSelected = () =>
    items().map((record) =>
      catalogStateValue(
        record,
        "isSelected",
        (id) => root.canvasInputs.get(id),
        (record) => root.typeOf(record),
      ),
    );
  // (The Table origin's body is empty — rows come from its "+", as the author adds them.)
  const addRows = async (count: number) => {
    const { catalogItemInsertChoices } = await import("../itemInsert");
    for (let index = 0; index < count; index++) {
      const choice = catalogItemInsertChoices(
        {
          graph: workspace.runtime.graph,
          readModel: workspace.readModel,
          newId: workspace.newId,
        },
        workspace.positionOfRecord(of("TableBody")[0]!.id)!,
      ).find((option) => option.type === "Row")!;
      workspace.execute(choice.build());
    }
  };
  return { workspace, root, of, items, select, canvasSelected, addRows };
}

async function mount(
  root: Awaited<ReturnType<typeof open>>["root"],
  type: string,
) {
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
  const record = [...root.domInputs.values()].find(
    (r) => root.typeOf(r) === type,
  )!;
  await act(async () => reactRoot.render(renderCatalogDom(root, record.id)));
  const close = async () => {
    await act(async () => reactRoot.unmount());
    host.remove();
  };
  return { host, close };
}

const selectedOf = (elements: Iterable<Element>, attribute = "aria-selected") =>
  [...elements].map((element) => element.getAttribute(attribute) === "true");

describe("a collection item's Selected starts its collection's selection (Canvas = Preview)", () => {
  it.each([
    {
      definition: "listbox",
      owner: "ListBox",
      item: "ListBoxItem",
      rows: '[role="option"]',
    },
    {
      definition: "gridlist",
      owner: "GridList",
      item: "GridListItem",
      rows: '[role="row"]',
    },
    {
      definition: "table",
      owner: "Table",
      item: "Row",
      rows: 'tbody [role="row"]',
    },
  ])(
    "$owner: the items set Selected, while it selects",
    async ({ definition, owner, item, rows }) => {
      const { root, items, select, canvasSelected, addRows } = await open(
        definition,
        item,
        { selectionMode: "multiple" },
      );
      if (owner === "Table") await addRows(3);
      expect(items().length).toBeGreaterThanOrEqual(2);
      select(1);
      const expected = items().map((_, index) => index === 1);
      expect(canvasSelected()).toEqual(expected);
      const dom = await mount(root, owner);
      expect(selectedOf(dom.host.querySelectorAll(rows))).toEqual(expected);
      await dom.close();
    },
  );

  it.each([
    { definition: "listbox", owner: "ListBox", item: "ListBoxItem" },
    { definition: "gridlist", owner: "GridList", item: "GridListItem" },
  ])(
    "$owner selecting nothing shows no selected item (RAC), on the Canvas too",
    async ({ definition, owner, item }) => {
      const { root, items, select, canvasSelected } = await open(
        definition,
        item,
        { selectionMode: "none" },
      );
      select(0);
      expect(canvasSelected()).toEqual(items().map(() => false));
      const dom = await mount(root, owner);
      expect(dom.host.querySelectorAll('[aria-selected="true"]')).toHaveLength(
        0,
      );
      await dom.close();
    },
  );

  it("Tree: a TreeItem set Selected (its default single selection)", async () => {
    const { root, items, select, canvasSelected } = await open(
      "tree",
      "TreeItem",
    );
    // (The first row — the top-level `item-1`; `items()` lists its nested item first.)
    const first = items().findIndex((record) => record.props.id === "item-1");
    select(first);
    expect(canvasSelected()).toEqual(
      items().map((_, index) => index === first),
    );
    const dom = await mount(root, "Tree");
    const rows = [...dom.host.querySelectorAll('[role="row"]')];
    expect(rows[0]!.getAttribute("data-key")).toBe("item-1");
    expect(selectedOf(rows)).toEqual(rows.map((_, index) => index === 0));
    await dom.close();
  });

  it("Menu: a MenuItem set Selected is checked while the Menu selects", async () => {
    const { root, items, select, canvasSelected } = await open(
      "menu",
      "MenuItem",
      { selectionMode: "multiple" },
    );
    select(1);
    const expected = items().map((_, index) => index === 1);
    expect(canvasSelected()).toEqual(expected);
    const dom = await mount(root, "Menu");
    expect(
      selectedOf(
        dom.host.querySelectorAll('[role="menuitemcheckbox"]'),
        "aria-checked",
      ),
    ).toEqual(expected);
    await dom.close();
  });

  it("Tabs: the first Tab set Selected is the selected Tab (single)", async () => {
    const { root, items, select, canvasSelected } = await open("tabs", "Tab");
    select(1);
    const expected = items().map((_, index) => index === 1);
    expect(canvasSelected()).toEqual(expected);
    const dom = await mount(root, "Tabs");
    expect(selectedOf(dom.host.querySelectorAll('[role="tab"]'))).toEqual(
      expected,
    );
    await dom.close();
  });
});
