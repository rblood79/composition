import { act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { NodeId } from "../../../../../../packages/shared/src/catalog/document/types";
import { catalogDragAndDropOptions } from "../../../../../../packages/shared/src/catalog/runtime/catalogDragAndDrop.components";
import { catalogBindingRef } from "../../../builder/catalogRuntime/dataBinding";
import { catalogBindingCommand } from "../../../builder/catalogRuntime/dataBindingCommand";
import { catalogListDataEventDefaults } from "../../../builder/catalogRuntime/interactions";
import { catalogGroupColumnsCommand } from "../../../builder/catalogRuntime/viewAuthoring";
import { openAdr280Preview } from "./support/adr280Harness";

/**
 * ADR-284 G5 — kanban task ⑫ (연구 §2.4): 「묶기로 열 만들기」 makes the columns and their drop
 * rules in one action; a card dropped on another column takes its value and lands next to the
 * target (`onInsert` → [`update`, `moveBefore`/`After` by the drop's side]), on an empty column it
 * takes the value (`onRootDrop`), in its own column it moves (`onReorder`) — the headings' counts
 * follow. The drop events are the ones RAC's `useDragAndDrop` gives the rules
 * (`catalogDragAndDropOptions` — the Preview's lazy chunk).
 */
afterEach(() => {
  vi.restoreAllMocks();
});

const ROWS = [
  { id: "u1", name: "Kim", gender: "male" },
  { id: "u2", name: "Park", gender: "female" },
  { id: "u3", name: "Lee", gender: "male" },
];
const GENDER = { id: "f-gender", key: "gender", type: "string" };
const NAMES = /Kim|Park|Lee/;
const settle = () =>
  act(async () => {
    for (let i = 0; i < 10; i += 1) await new Promise((r) => setTimeout(r, 0));
  });

async function kanban(values = ["male", "female"], types = ["GridList"]) {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  const h = await openAdr280Preview(types);
  act(() => {
    h.session.receive({
      type: "CATALOG_DATA",
      version: 1,
      collections: [
        {
          id: "users",
          name: "Users",
          schema: [
            { id: "f-id", key: "id", type: "string" },
            { id: "f-name", key: "name", type: "string" },
            GENDER,
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
  const list = h.ids[0] as NodeId;
  h.workspace.execute(
    catalogBindingCommand(
      [{ kind: "node", id: list }],
      catalogBindingRef({
        source: "dataTable",
        collectionId: "users",
        name: "Users",
      })!,
    ),
  );
  h.flush();
  await settle();
  const { command, created } = catalogGroupColumnsCommand(
    h.workspace.runtime.graph,
    { listId: list, viewName: "Users view", field: GENDER, values },
    h.workspace.newId,
  );
  h.workspace.execute(command);
  h.flush();
  await settle();
  const text = (id: NodeId) => h.element(id)?.textContent?.trim();
  const names = (id: NodeId) =>
    [...(h.element(id)?.querySelectorAll('[role="row"]') ?? [])]
      .map((item) => NAMES.exec(item.textContent ?? "")?.[0])
      .filter(Boolean);
  /** RAC's drop on a column, as `useDragAndDrop` hands it to the column's rules. */
  const drop = async (
    id: NodeId,
    name: "onInsert" | "onRootDrop" | "onReorder",
    event: Record<string, unknown>,
  ) => {
    const recordId = h.element(id)!.getAttribute("data-catalog-id")!;
    const handlers = h.runtime.handlersOf(recordId);
    await act(async () => {
      handlers[name]!(event);
    });
    await settle();
  };
  return { ...h, created, text, names, drop };
}

describe("ADR-284 G5 — drag and drop with a Do list", () => {
  it("「묶기로 열 만들기」 gives each column its drop rules; a drop moves the card and the counts", async () => {
    const h = await kanban();
    const [male, female] = h.created.columns;
    expect(male!.ruleIds).toHaveLength(3);
    expect(h.names(male!.listId)).toEqual(["Kim", "Lee"]);
    // Lee onto the female column, before Park: its gender changes and it lands before Park.
    await h.drop(female!.listId, "onInsert", {
      keys: ["u3"],
      items: [],
      dropOperation: "move",
      target: { type: "item", key: "u2", dropPosition: "before" },
    });
    expect(h.names(male!.listId)).toEqual(["Kim"]);
    expect(h.names(female!.listId)).toEqual(["Lee", "Park"]);
    expect(h.text(male!.headingId)).toBe("male · 1");
    expect(h.text(female!.headingId)).toBe("female · 2");
    // Kim after Park (the drop's side picks `moveAfter`).
    await h.drop(female!.listId, "onInsert", {
      keys: ["u1"],
      items: [],
      dropOperation: "move",
      target: { type: "item", key: "u2", dropPosition: "after" },
    });
    expect(h.names(female!.listId)).toEqual(["Lee", "Park", "Kim"]);
    expect(h.text(male!.headingId)).toBe("male · 0");
    // The empty male column takes Park (`onRootDrop` — the value only).
    await h.drop(male!.listId, "onRootDrop", {
      keys: ["u2"],
      items: [],
      dropOperation: "move",
    });
    expect(h.names(male!.listId)).toEqual(["Park"]);
    // In its own column a card moves (`onReorder`): Kim before Lee.
    await h.drop(female!.listId, "onReorder", {
      keys: ["u1"],
      dropOperation: "move",
      target: { type: "item", key: "u3", dropPosition: "before" },
    });
    expect(h.names(female!.listId)).toEqual(["Kim", "Lee"]);
    expect(h.text(female!.headingId)).toBe("female · 2");
    h.view.unmount();
  });

  it("ios-list bulk delete: Delete removes the selected rows, then the next Do runs", async () => {
    const h = await kanban(["male", "female"], ["GridList", "Button"]);
    const [list, button] = h.ids as [NodeId, NodeId];
    h.declare(list, { selectionMode: "multiple" });
    h.rule(button, "onPress", [
      { opcode: "removeSelectedItems", collectionId: "data:collection:users" },
      { opcode: "toast", message: "Deleted" },
    ] as never);
    await settle();
    const user = userEvent.setup();
    const rows = () => [...h.element(list)!.querySelectorAll('[role="row"]')];
    await user.click(rows()[0]!);
    await user.click(rows()[2]!);
    await user.click(h.element(button)!);
    await settle();
    expect(h.toasts).toContain("Deleted");
    expect(h.names(list)).toEqual(["Park"]);
    h.view.unmount();
  });

  it("the columns' lists drag: their rows carry RAC's drag (`dragAndDropHooks` from the lazy chunk)", async () => {
    const h = await kanban();
    const [male] = h.created.columns;
    await act(async () => {
      await import("../../../../../../packages/shared/src/catalog/runtime/catalogDragAndDrop.components");
    });
    await settle();
    const rows = [
      ...(h.element(male!.listId)?.querySelectorAll('[role="row"]') ?? []),
    ];
    expect(rows.length).toBe(2);
    expect(rows.every((row) => row.getAttribute("draggable") === "true")).toBe(
      true,
    );
    h.view.unmount();
  });

  it("the panel's new move · update Do on a drop When reads the drop (target · side · keys)", () => {
    const collectionId = "data:collection:users" as const;
    const args = ["keys", "items", "target", "dropOperation"];
    expect(
      catalogListDataEventDefaults({ opcode: "moveAfter", collectionId }, args),
    ).toEqual({
      opcode: "moveAfter",
      collectionId,
      key: "!event.target.key",
      keys: "!event.keys",
      dropPosition: "!event.target.dropPosition",
    });
    expect(
      catalogListDataEventDefaults({ opcode: "update", collectionId }, args),
    ).toEqual({ opcode: "update", collectionId, key: "!event.keys" });
  });

  it("the options: drops read the dragged keys back from the collection's type; only handled drops are offered", async () => {
    const type = "application/x-composition-item+data:collection:users";
    const fired: [string, Record<string, unknown>][] = [];
    const options = catalogDragAndDropOptions(
      { onInsert: () => {}, onReorder: () => {} },
      type,
      (name, event) => fired.push([name, event as Record<string, unknown>]),
    );
    expect(options.acceptedDragTypes).toEqual([type]);
    expect(options.onRootDrop).toBeUndefined();
    expect(options.onItemDrop).toBeUndefined();
    expect(options.getItems!(new Set(["u1"]), [])).toEqual([
      { [type]: "u1", "text/plain": "u1" },
    ]);
    const item = (key: string, types: string[]) => ({
      kind: "text" as const,
      types: new Set(types),
      getText: async () => key,
    });
    await options.onInsert!({
      items: [item("u1", [type, "text/plain"]), item("x", ["text/plain"])],
      dropOperation: "move",
      target: { type: "item", key: "u2", dropPosition: "after" },
    });
    options.onReorder!({
      keys: new Set(["u3"]),
      dropOperation: "move",
      target: { type: "item", key: "u2", dropPosition: "before" },
    });
    expect(fired.map(([name, event]) => [name, event.keys])).toEqual([
      ["onInsert", ["u1"]],
      ["onReorder", ["u3"]],
    ]);
  });
});
