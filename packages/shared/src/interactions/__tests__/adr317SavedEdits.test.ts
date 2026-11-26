import { describe, expect, it } from "vitest";
import {
  CATALOG_EVENT_EDITS,
  buildInteractionIndex,
  createElementHandlers,
} from "../bindings";
import type { DispatchDeps } from "../dispatcher";
import type { InteractionRule } from "../interactionRule.types";
import { resolveTriggers } from "../capabilityRegistry";
import { codeExecutionVocabulary } from "../../catalog/document/executionVocabulary";

/**
 * ADR-317 Phase 4 (사용자 결정 1 · 6) · ADR-325 Decision 3 — what a save sends waits for its answer:
 * the edits its event carries (`CATALOG_EVENT_EDITS` — a Table 「Cells change」 write, an Editable
 * cell's save) and the edits its own Dos made before the save are sent when it goes, and settled
 * when it is answered (confirmed · rejected). A rule without a save sends nothing.
 */
function deps(answer: () => Promise<{ ok: boolean; reason?: string }>) {
  let seq = 10;
  const sent: (readonly number[])[] = [];
  const saved: string[] = [];
  const d = {
    editSeq: () => seq,
    beginSave: (seqs: readonly number[]) => {
      sent.push(seqs);
      return (ok: boolean) => saved.push(`${seqs.join(",")} ${ok}`);
    },
    append: () => ((seq += 1), { ok: true }),
    callEndpoint: () => ({ ok: true, settled: answer() }),
  } as unknown as DispatchDeps;
  return { d, sent, saved };
}
const rule = (
  trigger: string,
  actions: InteractionRule["actions"],
): InteractionRule => ({
  id: "r",
  type: "interaction",
  elementId: "table",
  trigger,
  actions,
});
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("ADR-317 Phase 4 — a save's edits sent and settled", () => {
  it("a Table offers 「Cells change」 and a document may name it", () => {
    expect(resolveTriggers("Table")).toContain("onCellsChange");
    expect(codeExecutionVocabulary().triggerIds).toContain("onCellsChange");
  });

  it("a save that succeeds: the event's edits and the Dos' before it — sent when it goes, confirmed when answered", async () => {
    const { d, sent, saved } = deps(async () => ({ ok: true }));
    const handlers = createElementHandlers(
      "table",
      buildInteractionIndex([
        rule("onCellsChange", [
          { kind: "append", collectionId: "users", value: { name: "A" } },
          { kind: "append", collectionId: "users", value: { name: "B" } },
          { kind: "callEndpoint", endpointId: "save", body: "!event.items" },
        ]),
      ]),
      d,
    );
    handlers.onCellsChange!({
      keys: ["p1"],
      items: [{ id: "p1" }],
      cells: [{ key: "p1", field: "name" }],
      [CATALOG_EVENT_EDITS]: [7],
    });
    expect(sent).toEqual([[7, 11, 12]]);
    expect(saved).toEqual([]);
    await flush();
    expect(saved).toEqual(["7,11,12 true"]);
  });

  it("a save that fails is rejected · a rule that saves nothing sends nothing", async () => {
    const failed = deps(async () => ({ ok: false, reason: "500" }));
    createElementHandlers(
      "table",
      buildInteractionIndex([
        rule("onCellsChange", [{ kind: "callEndpoint", endpointId: "save" }]),
      ]),
      failed.d,
    ).onCellsChange!({ [CATALOG_EVENT_EDITS]: [7] });
    await flush();
    expect(failed.saved).toEqual(["7 false"]);

    const local = deps(async () => ({ ok: true }));
    createElementHandlers(
      "table",
      buildInteractionIndex([
        rule("onCellsChange", [
          { kind: "append", collectionId: "users", value: { name: "A" } },
        ]),
      ]),
      local.d,
    ).onCellsChange!({ [CATALOG_EVENT_EDITS]: [7] });
    await flush();
    expect(local.sent).toEqual([]);
    expect(local.saved).toEqual([]);
  });
});
