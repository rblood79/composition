import { describe, expect, it } from "vitest";
import {
  catalogActionsDeep,
  filterCatalogActionsDeep,
  mapCatalogActionsDeep,
} from "../interactionActions";
import type { InteractionAction } from "../types";

/** 295 후속 C8 — a toast's `onAction` Dos are walked with the rule's (S2 `ToastOptions.onAction`). */
const nested: InteractionAction = { opcode: "toast", message: "inner" };
const list: InteractionAction[] = [
  {
    opcode: "toast",
    message: "outer",
    actionLabel: "Undo",
    onAction: [nested],
  },
  { opcode: "toast", message: "plain" },
];

describe("interactionActions", () => {
  it("catalogActionsDeep: each Do then its nested Dos", () => {
    expect(
      catalogActionsDeep(list).map((a) => (a as { message: string }).message),
    ).toEqual(["outer", "inner", "plain"]);
  });

  it("mapCatalogActionsDeep: maps nested Dos; unchanged Dos keep their identity", () => {
    const same = mapCatalogActionsDeep(list, (a) => a);
    expect(same.every((a, i) => a === list[i])).toBe(true);
    const renamed = mapCatalogActionsDeep(list, (a) =>
      a.opcode === "toast" && a.message === "inner"
        ? { ...a, message: "changed" }
        : a,
    );
    expect(renamed[0]).not.toBe(list[0]);
    expect(renamed[1]).toBe(list[1]);
    expect(
      (renamed[0] as unknown as { onAction: InteractionAction[] }).onAction,
    ).toEqual([{ opcode: "toast", message: "changed" }]);
  });

  it("filterCatalogActionsDeep: drops nested Dos; an emptied onAction goes; unchanged = same array", () => {
    expect(filterCatalogActionsDeep(list, () => true)).toBe(list);
    const out = filterCatalogActionsDeep(list, (a) => a !== nested);
    expect(out[0]).toEqual({
      opcode: "toast",
      message: "outer",
      actionLabel: "Undo",
    });
  });
});
