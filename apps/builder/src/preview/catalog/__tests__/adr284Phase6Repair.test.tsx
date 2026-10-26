import { act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  EntryId,
  NodeId,
  StateVariableEntry,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { addRecord } from "../../../../../../packages/shared/src/catalog/commands/project";
import { catalogBindingRef } from "../../../builder/catalogRuntime/dataBinding";
import { catalogBindingCommand } from "../../../builder/catalogRuntime/dataBindingCommand";
import {
  catalogInteractionsCommand,
  catalogNewInteraction,
} from "../../../builder/catalogRuntime/interactions";
import {
  catalogPropFollowCommand,
  catalogPropFollows,
} from "../../../builder/catalogRuntime/propFollow";
import { openAdr280Preview } from "./support/adr280Harness";
import { DROP_ITEM, DROP_ROW, dropRects, racDrag } from "./support/racDrag";

/**
 * ADR-284 Phase 6 — the acceptance set's ios-list (연구 §2.5) in the document: a text variable
 * `selectionMode` the GridList reads (`{{ }}`) and Edit toggles (none ↔ multiple), the GridList's
 * selection named (`selectedKeys` — a named RAC state) and Delete's `isDisabled` a value condition
 * on it (`selectedKeys.size === 0`), Delete → `removeSelectedItems`, Edit also clears the selection
 * (a capability — the named state follows it).
 */
afterEach(() => {
  vi.restoreAllMocks();
});

const HOME = "project:page:home" as EntryId<"page">;
const ROWS = [
  { id: "m1", subject: "Hello" },
  { id: "m2", subject: "Invoice" },
  { id: "m3", subject: "Lunch" },
];
const settle = () =>
  act(async () => {
    for (let i = 0; i < 10; i += 1) await new Promise((r) => setTimeout(r, 0));
  });

async function iosList() {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  const h = await openAdr280Preview(["GridList", "Button", "Button"]);
  act(() => {
    h.session.receive({
      type: "CATALOG_DATA",
      version: 1,
      collections: [
        {
          id: "emails",
          name: "Emails",
          schema: [
            { id: "f-id", key: "id", type: "string" },
            { id: "f-subject", key: "subject", type: "string" },
          ],
          mockData: ROWS,
          runtimeData: [],
          useMockData: true,
        },
      ],
      variables: [],
      apiEndpoints: [],
    } as never);
  });
  const [list, del, edit] = h.ids as [NodeId, NodeId, NodeId];
  h.workspace.execute(
    catalogBindingCommand(
      [{ kind: "node", id: list }],
      catalogBindingRef({
        source: "dataTable",
        collectionId: "emails",
        name: "Emails",
      })!,
    ),
  );
  const mode = "project:stateVariable:mode" as EntryId<"stateVariable">;
  const selected = "project:stateVariable:sel" as EntryId<"stateVariable">;
  h.workspace.execute(
    addRecord({
      entry: {
        kind: "stateVariable",
        id: mode,
        ownerId: HOME,
        name: "selectionMode",
        valueType: "string",
        defaultValue: "none",
      } satisfies StateVariableEntry,
    }),
  );
  h.workspace.execute(
    addRecord({
      entry: {
        kind: "stateVariable",
        id: selected,
        ownerId: HOME,
        name: "selectedKeys",
        valueType: "string[]",
        defaultValue: [],
        source: { nodeId: list, prop: "selectedKeys" },
      } satisfies StateVariableEntry,
    }),
  );
  h.flush();
  h.declare(list, { selectionMode: "{{ selectionMode }}" });
  h.declare(del, {
    label: "Delete",
    isDisabled: { kind: "when", subject: `!var.${selected}`, op: "notExists" },
  });
  h.declare(edit, { label: "Edit" });
  h.rule(del, "onPress", [
    { opcode: "removeSelectedItems", collectionId: "data:collection:emails" },
  ] as never);
  h.rule(edit, "onPress", [
    { opcode: "setState", variableId: mode, op: "toggle", value: "multiple" },
    {
      opcode: "capability",
      target: { nodeId: list },
      capabilityId: "clearSelection",
    },
  ] as never);
  await settle();
  const rows = () => [...h.element(list)!.querySelectorAll('[role="row"]')];
  const keys = () => rows().map((row) => row.getAttribute("data-key"));
  const disabled = (id: NodeId) =>
    h.element(id)!.hasAttribute("data-disabled") ||
    (h.element(id) as HTMLButtonElement).disabled;
  return { ...h, list, del, edit, rows, keys, disabled };
}

describe("ADR-284 Phase 6 — ios-list: a value condition, a text toggle, a named selection", () => {
  it("「변수로 정하기」 reads the follows back and writes them in one step each", async () => {
    const h = await iosList();
    const graph = () => h.workspace.runtime.graph;
    expect(catalogPropFollows(graph(), h.list)).toEqual([
      {
        prop: "selectionMode",
        kind: "variable",
        variableId: "project:stateVariable:mode",
      },
    ]);
    expect(catalogPropFollows(graph(), h.del)).toEqual([
      {
        prop: "isDisabled",
        kind: "when",
        variableId: "project:stateVariable:sel",
        path: "",
        op: "notExists",
      },
    ]);
    // (The selection count instead: Delete enabled from 1 — `selectedKeys.size === 0`.)
    const depth = h.workspace.runtime.historyDepth.undo;
    h.workspace.execute(
      catalogPropFollowCommand(graph(), h.del, "isDisabled", {
        prop: "isDisabled",
        kind: "when",
        variableId: "project:stateVariable:sel",
        path: "size",
        op: "equals",
        value: 0,
      }),
    );
    expect(h.workspace.runtime.historyDepth.undo).toBe(depth + 1);
    h.flush();
    await settle();
    const node = graph().getEntry(h.del);
    expect(node?.kind === "node" && node.props.isDisabled).toEqual({
      kind: "set",
      value: {
        kind: "when",
        subject: "!var.project:stateVariable:sel.size",
        op: "equals",
        value: 0,
      },
    });
    const user = userEvent.setup();
    expect(h.disabled(h.del)).toBe(true);
    await user.click(h.element(h.edit)!);
    await user.click(h.rows()[1]!);
    await settle();
    expect(h.disabled(h.del)).toBe(false);
    // (Removed: the prop returns to its default — enabled.)
    h.workspace.execute(
      catalogPropFollowCommand(graph(), h.del, "isDisabled", undefined),
    );
    h.flush();
    await settle();
    expect(catalogPropFollows(graph(), h.del)).toEqual([]);
    h.view.unmount();
  });

  it("Edit turns selection on; a selection enables Delete; Delete removes it; Edit again clears", async () => {
    const h = await iosList();
    const user = userEvent.setup();
    // (selectionMode "none": no selection; Delete is disabled — nothing selected.)
    expect(h.element(h.list)!.getAttribute("aria-multiselectable")).toBeNull();
    expect(h.disabled(h.del)).toBe(true);
    await user.click(h.element(h.edit)!);
    await settle();
    expect(h.element(h.list)!.getAttribute("aria-multiselectable")).toBe(
      "true",
    );
    expect(h.disabled(h.del)).toBe(true);
    await user.click(h.rows()[0]!);
    await user.click(h.rows()[2]!);
    await settle();
    expect(h.disabled(h.del)).toBe(false);
    await user.click(h.element(h.del)!);
    await settle();
    expect(h.keys()).toEqual(["m2"]);
    expect(h.disabled(h.del)).toBe(true);
    // (Select again, then Edit (Cancel): mode none and the selection cleared — Delete disabled.)
    await user.click(h.rows()[0]!);
    await settle();
    expect(h.disabled(h.del)).toBe(false);
    await user.click(h.element(h.edit)!);
    await settle();
    expect(h.element(h.list)!.getAttribute("aria-multiselectable")).toBeNull();
    expect(h.disabled(h.del)).toBe(true);
    h.view.unmount();
  });
});

/**
 * photos (연구 §2.2): the album Tree's selection writes `album` (a single selection's key into a
 * text variable — the reference's `[...keys][0]`), the photo grid's view keeps `album = $album`
 * unless it is `library`; a photo dropped on an album (`onItemDrop`) updates its album and selects
 * that album — the Tree accepts the photos collection its rule writes, the grid drags only.
 */
async function photos() {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  const h = await openAdr280Preview(["Tree", "GridList"]);
  act(() => {
    h.session.receive({
      type: "CATALOG_DATA",
      version: 1,
      collections: [
        {
          id: "albums",
          name: "Albums",
          schema: [
            { id: "f-aid", key: "id", type: "string" },
            { id: "f-aname", key: "name", type: "string" },
          ],
          mockData: [
            { id: "library", name: "Library" },
            { id: "travel", name: "Travel" },
            { id: "food", name: "Food" },
          ],
          runtimeData: [],
          useMockData: true,
        },
        {
          id: "photos",
          name: "Photos",
          schema: [
            { id: "f-pid", key: "id", type: "string" },
            { id: "f-album", key: "album", type: "string" },
          ],
          mockData: [
            { id: "p1", album: "travel" },
            { id: "p2", album: "food" },
            { id: "p3", album: "travel" },
          ],
          runtimeData: [],
          useMockData: true,
        },
      ],
      variables: [],
      apiEndpoints: [],
    } as never);
  });
  const [tree, grid] = h.ids as [NodeId, NodeId];
  const album = "project:stateVariable:album" as EntryId<"stateVariable">;
  h.workspace.execute(
    addRecord({
      entry: {
        kind: "stateVariable",
        id: album,
        ownerId: HOME,
        name: "album",
        valueType: "string",
        defaultValue: "library",
      } satisfies StateVariableEntry,
    }),
  );
  h.workspace.execute(
    catalogBindingCommand(
      [{ kind: "node", id: tree }],
      catalogBindingRef({
        source: "dataTable",
        collectionId: "albums",
        name: "Albums",
      })!,
    ),
  );
  const photosRef = catalogBindingRef({
    source: "dataTable",
    collectionId: "photos",
    name: "Photos",
  })!;
  h.workspace.execute(
    catalogBindingCommand([{ kind: "node", id: grid }], {
      ...photosRef,
      view: {
        where: {
          id: "where",
          op: "and",
          items: [
            {
              id: "by-album",
              fields: [["data:field:f-album"]],
              op: "equals",
              value: `!var.${album}`,
              skip: "library",
            },
          ],
        },
      },
    } as never),
  );
  h.flush();
  h.declare(tree, { selectionMode: "single" });
  // (Both rules in one list — the panel's command replaces the owner's rules.)
  const owner = { ownerId: tree };
  h.workspace.execute(
    catalogInteractionsCommand(
      owner,
      [
        catalogNewInteraction(
          owner,
          "onSelectionChange",
          [
            {
              opcode: "setState",
              variableId: album,
              op: "set",
              value: "!event.keys",
            },
          ] as never,
          h.workspace.newId,
        ),
        catalogNewInteraction(
          owner,
          "onItemDrop",
          [
            {
              opcode: "update",
              collectionId: "data:collection:photos",
              key: "!event.keys",
              field: "data:field:f-album",
              value: "!event.target.key",
            },
            {
              opcode: "setState",
              variableId: album,
              op: "set",
              value: "!event.target.key",
            },
          ] as never,
          h.workspace.newId,
        ),
      ],
      "Rules",
    ),
  );
  h.flush();
  await settle();
  const keys = (id: NodeId) =>
    [...h.element(id)!.querySelectorAll('[role="row"]')]
      .map((row) => row.getAttribute("data-key"))
      // (An empty list draws its empty state as a row without a key.)
      .filter((key) => key !== null);
  return { ...h, tree, grid, keys };
}

describe("ADR-284 Phase 6 — photos: Tree selection → album condition, photo → album drop", () => {
  it("library shows every photo; an album filters; a drop on an album moves the photo there", async () => {
    const h = await photos();
    const user = userEvent.setup();
    expect(h.keys(h.grid)).toEqual(["p1", "p2", "p3"]);
    const travel = [
      ...h.element(h.tree)!.querySelectorAll('[role="row"]'),
    ].find((row) => row.getAttribute("data-key") === "travel")!;
    await user.click(travel);
    await settle();
    expect(h.keys(h.grid)).toEqual(["p1", "p3"]);
    // (p2 dropped on Travel: its album becomes travel and Travel stays the album shown.)
    const recordId = h.element(h.tree)!.getAttribute("data-catalog-id")!;
    await act(async () => {
      h.runtime.handlersOf(recordId).onItemDrop!({
        keys: ["p2"],
        items: [],
        dropOperation: "move",
        target: { type: "item", key: "travel", dropPosition: "on" },
      });
    });
    await settle();
    expect(h.keys(h.grid)).toEqual(["p1", "p2", "p3"]);
    h.view.unmount();
  });

  it("RAC's own drag: a photo row dropped on the Travel album row moves the photo (the Tree accepts photos)", async () => {
    const h = await photos();
    await act(async () => {
      await import("../../../../../../packages/shared/src/catalog/runtime/catalogDragAndDrop.components");
    });
    await settle();
    const user = userEvent.setup();
    const albumRows = () => [...h.element(h.tree)!.querySelectorAll(DROP_ITEM)];
    await user.click(
      albumRows().find((row) => row.getAttribute("data-key") === "travel")!,
    );
    await settle();
    expect(h.keys(h.grid)).toEqual(["p1", "p3"]);
    // (Library again: every photo; then p2 (food) dragged onto Travel.)
    await user.click(
      albumRows().find((row) => row.getAttribute("data-key") === "library")!,
    );
    await settle();
    dropRects();
    h.element(h.grid)!.setAttribute("data-drop-left", "300");
    const p2 = [...h.element(h.grid)!.querySelectorAll(DROP_ITEM)].find(
      (row) => row.getAttribute("data-key") === "p2",
    )!;
    const travelIndex = albumRows().findIndex(
      (row) => row.getAttribute("data-key") === "travel",
    );
    await racDrag(
      p2,
      albumRows()[travelIndex]!,
      100,
      travelIndex * DROP_ROW + DROP_ROW / 2,
    );
    await settle();
    // (The drop's rules: p2's album is travel, and Travel is the album shown.)
    expect(h.keys(h.grid)).toEqual(["p1", "p2", "p3"]);
    await user.click(
      albumRows().find((row) => row.getAttribute("data-key") === "food")!,
    );
    await settle();
    expect(h.keys(h.grid)).toEqual([]);
    h.view.unmount();
  });

  it("the grid drags (its photos are what the Tree's drop rule writes); the album rows do not", async () => {
    const h = await photos();
    await act(async () => {
      await import("../../../../../../packages/shared/src/catalog/runtime/catalogDragAndDrop.components");
    });
    await settle();
    const rows = (id: NodeId) => [
      ...h.element(id)!.querySelectorAll('[role="row"]'),
    ];
    expect(
      rows(h.grid).every((row) => row.getAttribute("draggable") === "true"),
    ).toBe(true);
    expect(
      rows(h.tree).some((row) => row.getAttribute("draggable") === "true"),
    ).toBe(false);
    h.view.unmount();
  });
});
