import { describe, expect, it } from "vitest";
import { createElementHandlers, buildInteractionIndex } from "../bindings";
import { executeInteractionRule, type DispatchDeps } from "../dispatcher";
import type { InteractionRule } from "../interactionRule.types";
import { resolveTriggers } from "../capabilityRegistry";

/**
 * ADR-284 Phase 5 — a drop's Do list: `update` of one field over the dropped keys, `moveBefore` ·
 * `moveAfter` by the drop's side, and the drop event's fields as the rule's arguments.
 */
function deps() {
  const calls: unknown[][] = [];
  const d: DispatchDeps = {
    update: (...args) => (calls.push(["update", ...args]), { ok: true }),
    move: (...args) => (calls.push(["move", ...args]), { ok: true }),
  } as DispatchDeps;
  return { d, calls };
}
const rule = (actions: InteractionRule["actions"]): InteractionRule => ({
  id: "r",
  type: "interaction",
  elementId: "list",
  trigger: "onInsert",
  actions,
});
const drop = {
  keys: ["u1", "u3"],
  target: { type: "item", key: "u2", dropPosition: "after" },
  dropOperation: "move",
};

describe("ADR-284 Phase 5 — drop Do list", () => {
  it("collection lists offer RAC's drag and drop events", () => {
    for (const type of ["ListBox", "GridList", "Tree", "Table"])
      expect(resolveTriggers(type)).toEqual(
        expect.arrayContaining([
          "onReorder",
          "onInsert",
          "onRootDrop",
          "onItemDrop",
          "onDragEnd",
        ]),
      );
  });

  it("a drop handler names its event's fields (`!event.target.key`) and runs the Dos in order", () => {
    const { d, calls } = deps();
    const handlers = createElementHandlers(
      "list",
      buildInteractionIndex([
        rule([
          {
            kind: "update",
            collectionId: "users",
            key: "!event.keys",
            field: "f-gender",
            value: "female",
          },
          {
            kind: "moveBefore",
            collectionId: "users",
            key: "!event.target.key",
            keys: "!event.keys",
            dropPosition: "!event.target.dropPosition",
          },
        ]),
      ]),
      d,
    );
    handlers.onInsert!(drop);
    expect(calls).toEqual([
      ["update", "users", "u1", { "f-gender": "female" }, "f-gender"],
      ["update", "users", "u3", { "f-gender": "female" }, "f-gender"],
      ["move", "users", ["u1", "u3"], { after: "u2" }],
    ]);
  });

  it("the drop's side picks the method; a side that is not before · after stops the rule", () => {
    const { d, calls } = deps();
    const move = {
      kind: "moveAfter" as const,
      collectionId: "users",
      key: "!event.target.key",
      keys: "!event.keys",
      dropPosition: "!event.target.dropPosition",
    };
    const before = executeInteractionRule(rule([move]), d, {
      event: { ...drop, target: { ...drop.target, dropPosition: "before" } },
    });
    expect(before.ok).toBe(true);
    expect(calls.at(-1)).toEqual([
      "move",
      "users",
      ["u1", "u3"],
      { before: "u2" },
    ]);
    const on = executeInteractionRule(rule([move]), d, {
      event: { ...drop, target: { ...drop.target, dropPosition: "on" } },
    });
    expect(on.ok).toBe(false);
    // (No side: the opcode's.)
    const { dropPosition: _side, ...plain } = move;
    executeInteractionRule(rule([plain]), d, { event: drop });
    expect(calls.at(-1)).toEqual([
      "move",
      "users",
      ["u1", "u3"],
      { after: "u2" },
    ]);
  });

  it("a failing update stops the move (Do N: reason)", () => {
    const calls: unknown[][] = [];
    const d = {
      update: () => ({ ok: false, reason: "항목 없음: u1" }),
      move: (...args: unknown[]) => (calls.push(args), { ok: true }),
    } as unknown as DispatchDeps;
    const outcome = executeInteractionRule(
      rule([
        {
          kind: "update",
          collectionId: "users",
          key: "!event.keys",
          field: "f-gender",
          value: "female",
        },
        {
          kind: "moveBefore",
          collectionId: "users",
          key: "!event.target.key",
          keys: "!event.keys",
        },
      ]),
      d,
      { event: drop },
    );
    expect(outcome.ok).toBe(false);
    expect(calls).toEqual([]);
  });

  it("a field update refuses a record value", () => {
    const { d } = deps();
    const outcome = executeInteractionRule(
      rule([
        {
          kind: "update",
          collectionId: "users",
          key: "u1",
          field: "f-gender",
          value: "!event.target",
        },
      ]),
      d,
      { event: drop },
    );
    expect(outcome.ok).toBe(false);
  });
});
