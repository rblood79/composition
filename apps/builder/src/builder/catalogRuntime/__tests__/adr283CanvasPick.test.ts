import { describe, expect, it } from "vitest";
import { insertNodes } from "../../../../../../packages/shared/src/catalog/commands";
import type {
  InteractionEntry,
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { catalogPaletteDefinitionId } from "../paletteInsert";
import { catalogCanvasTargetPick } from "../targetPick";
import {
  BODY,
  CARD,
  SAVE,
  TOGGLE,
  ROW_TEXT,
  openAdr283Fixture,
} from "./support/adr283Fixture";

/**
 * ADR-283 G3 — the Canvas target pick (Decision 5): the session state (no document), the click's
 * rule patch (one history step, the selection unchanged) and the two raises (a field part → its
 * field, an overlay body → its trigger).
 */
async function withRule() {
  const h = await openAdr283Fixture();
  const ruleId = h.rule(TOGGLE, "onPress", {
    opcode: "capability",
    target: { nodeId: ROW_TEXT },
    capabilityId: "hide",
  });
  const target = () => {
    const rule = h.graph.getEntry(ruleId as never) as InteractionEntry;
    return rule.actions[0].opcode === "capability" ? rule.actions[0].target : undefined;
  };
  return { ...h, ruleId, target };
}

describe("ADR-283 G3 — Canvas target pick", () => {
  it("aim → the session holds the pick (no step) · Esc ends it (no step)", async () => {
    const h = await withRule();
    const depth = h.workspace.runtime.historyDepth.undo;
    h.workspace.session.setTargetPick(h.ruleId as never);
    expect(h.workspace.session.getSnapshot().targetPick).toEqual({
      ruleId: h.ruleId,
    });
    h.workspace.session.setTargetPick(undefined);
    expect(h.workspace.session.getSnapshot().targetPick).toBeUndefined();
    expect(h.workspace.runtime.historyDepth.undo).toBe(depth);
  });

  it("a click inside an instance writes `{ address }` in one step; the selection stays; ⌘Z takes it back", async () => {
    const h = await withRule();
    const [toggle] = h.recordsOf(TOGGLE);
    h.workspace.selectRecords([toggle!.id]);
    const selection = h.workspace.session.getSnapshot().selection;
    const save = h.recordUnder(SAVE, h.recordsOf(h.first)[0]!.id)!;
    const pick = catalogCanvasTargetPick(h.workspace, h.ruleId, save.id)!;
    expect(pick.raisedFrom).toBeUndefined();
    const depth = h.workspace.runtime.historyDepth.undo;
    h.workspace.execute(pick.write!.command);
    expect(h.workspace.runtime.historyDepth.undo).toBe(depth + 1);
    expect(h.target()).toEqual({
      address: { instances: [h.first], templatePath: [CARD, SAVE] },
    });
    expect(h.workspace.session.getSnapshot().selection).toBe(selection);
    h.workspace.undo();
    expect(h.target()).toEqual({ nodeId: ROW_TEXT });
  });

  it("the same target writes nothing", async () => {
    const h = await withRule();
    const text = h.recordsOf(ROW_TEXT)[0]!;
    expect(
      catalogCanvasTargetPick(h.workspace, h.ruleId, text.id)?.write,
    ).toBeUndefined();
  });

  it("raises: a TextField's Input → the TextField · a Dialog's Modal → its trigger", async () => {
    const h = await withRule();
    const field = "project:node:field" as NodeId;
    const dialog = "project:node:dialog" as NodeId;
    h.workspace.execute(
      insertNodes({
        parent: { kind: "node", id: BODY },
        entries: (
          [
            [field, "TextField"],
            [dialog, "Dialog"],
          ] as const
        ).map(
          ([id, type]) =>
            ({
              kind: "node",
              id,
              definitionId: catalogPaletteDefinitionId(h.library, type),
              children: [],
              props: {},
              visual: {},
              sizing: {},
              descendantOverrides: [],
            }) as unknown as NodeEntry,
        ),
        rootIds: [field, dialog],
        newId: h.workspace.newId,
      }),
    );
    const records = [...h.workspace.root.domInputs.values()];
    const input = records.find(
      (record) => record.id.includes(field) && record.sourceId.endsWith("__2"),
    )!;
    const fieldPick = catalogCanvasTargetPick(h.workspace, h.ruleId, input.id)!;
    expect(fieldPick.recordId).toBe(h.recordsOf(field)[0]!.id);
    expect(fieldPick.raisedFrom).toBe("Input");
    expect(fieldPick.write).toBeDefined();
    // (The tag's `#` = the raised record's DOM id — the Accessibility ID the Preview renders.)
    expect(fieldPick.htmlId).toBe(h.recordsOf(field)[0]!.htmlId);
    expect(fieldPick.htmlId).toBeTruthy();
    const modal = records.find(
      (record) =>
        record.id.includes(dialog) && record.sourceId.endsWith("__modal"),
    )!;
    const bodyPick = catalogCanvasTargetPick(h.workspace, h.ruleId, modal.id)!;
    expect(bodyPick.recordId).toBe(h.recordsOf(dialog)[0]!.id);
    expect(bodyPick.raisedFrom).toBe("Modal");
    // (Not raised: the clicked component itself — a Save Button.)
    const save = h.recordUnder(SAVE, h.recordsOf(h.first)[0]!.id)!;
    expect(
      catalogCanvasTargetPick(h.workspace, h.ruleId, save.id)?.recordId,
    ).toBe(save.id);
  });
});
