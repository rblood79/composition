import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  InteractionAction,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import {
  catalogCodeViewPlan,
  catalogCodeViewSession,
} from "../../../builder/catalogRuntime/codeViewEdit";
import { HOME, openAdr296, type Adr296Harness } from "./support/adr296Harness";

/**
 * ADR-295 후속 C5 — a rule's toast Do in the code view carries its S2 options (C2: `variant` ·
 * `timeout`) as RAC's queue takes them: `queue.add({title, variant}, {timeout})` (RAC
 * `UNSTABLE_ToastQueue.add(content, options)` — S2 `ToastQueue.<variant>(message, {timeout})` is the
 * same queue). The code reads back to the same Do, and an edit of either option is that Do's edit.
 */
afterEach(() => vi.restoreAllMocks());

const actions = (h: Adr296Harness, owner: string) =>
  h.rulesOf(owner).flatMap((rule) => rule.actions);

async function open(action: InteractionAction) {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  const h = await openAdr296();
  const button = h.add("Button") as NodeId;
  h.rules(button, [{ trigger: "onPress", actions: [action] }]);
  return { h, button };
}

function strictRejected(h: Adr296Harness) {
  const data = h.dataOf();
  const session = catalogCodeViewSession(h.graph(), HOME, data)!;
  return catalogCodeViewPlan({
    reader: h.workspace.runtime.graph.commandReader,
    session,
    edited: session.baseline.code,
    changes: [],
    data,
    newId: h.workspace.newId,
    strict: true,
  }).rejected;
}

describe("S2 toast options in the code view", () => {
  it("variant · timeout are in the code (the queue's content type names the variant)", async () => {
    const { h } = await open({
      opcode: "toast",
      message: "Saved",
      variant: "positive",
      timeout: 6000,
    });
    const code = h.code();
    expect(code).toContain(
      "queue.add({title: 'Saved', variant: 'positive'}, {timeout: 6000});",
    );
    // (User 2026-11-01 — the app's one queue lives in `src/Toast.tsx`; the page imports it.)
    expect(code).toContain("import {queue} from '../Toast';");
    expect(code).not.toContain("UNSTABLE_ToastQueue");
    expect(strictRejected(h)).toEqual([]);
  });

  it("a toast without options keeps the plain form", async () => {
    const { h } = await open({ opcode: "toast", message: "Hi" });
    const code = h.code();
    expect(code).toContain("queue.add({title: 'Hi'});");
    expect(code).toContain("import {queue} from '../Toast';");
  });

  it("an edit of the variant · timeout is the Do's edit; removing them clears them", async () => {
    const { h, button } = await open({
      opcode: "toast",
      message: "Saved",
      variant: "positive",
      timeout: 6000,
    });
    let result = h.apply(
      h
        .code()
        .replace("variant: 'positive'", "variant: 'negative'")
        .replace("{timeout: 6000}", "{timeout: 8000}"),
    );
    expect(result.rejected).toEqual([]);
    expect(actions(h, button)).toEqual([
      { opcode: "toast", message: "Saved", variant: "negative", timeout: 8000 },
    ]);
    result = h.apply(
      h
        .code()
        .replace(
          "queue.add({title: 'Saved', variant: 'negative'}, {timeout: 8000});",
          "queue.add({title: 'Saved'});",
        ),
    );
    expect(result.rejected).toEqual([]);
    expect(actions(h, button)).toEqual([{ opcode: "toast", message: "Saved" }]);
  });

  it("a plain toast gains options by an edit; an option S2 refuses is refused", async () => {
    const { h, button } = await open({ opcode: "toast", message: "Hi" });
    const result = h.apply(
      h
        .code()
        .replace(
          "queue.add({title: 'Hi'});",
          "queue.add({title: 'Hi', variant: 'info'}, {timeout: 5000});",
        ),
    );
    expect(result.rejected).toEqual([]);
    expect(actions(h, button)).toEqual([
      { opcode: "toast", message: "Hi", variant: "info", timeout: 5000 },
    ]);
    const refused = h.apply(
      h.code().replace("variant: 'info'", "variant: 'warning'"),
    );
    expect(refused.rejected.length).toBeGreaterThan(0);
    expect(actions(h, button)[0]).toMatchObject({ variant: "info" });
  });
});

/**
 * 295 후속 C8 — S2 `ToastOptions` `actionLabel` · `shouldCloseOnAction` · `onAction`: the action
 * button's Dos are the arrow's body (a closure over the handler's event); they read back to the
 * same nested Dos, and an edit inside the arrow is their edit.
 */
describe("S2 toast action button in the code view", () => {
  const actionToast: InteractionAction = {
    opcode: "toast",
    message: "Deleted",
    variant: "neutral",
    actionLabel: "Undo",
    shouldCloseOnAction: true,
    onAction: [{ opcode: "toast", message: "Restored", variant: "positive" }],
  };

  it("actionLabel · shouldCloseOnAction · onAction are in the code; the queue's type names them", async () => {
    const { h } = await open(actionToast);
    const code = h.code();
    expect(code).toContain(
      "queue.add({title: 'Deleted', variant: 'neutral', actionLabel: 'Undo', shouldCloseOnAction: true, onAction: () => {",
    );
    expect(code).toContain(
      "queue.add({title: 'Restored', variant: 'positive'});",
    );
    expect(code).toContain("import {queue} from '../Toast';");
    expect(strictRejected(h)).toEqual([]);
  });

  it("an edit inside onAction is the nested Do's edit; removing the arrow removes them", async () => {
    const { h, button } = await open(actionToast);
    let result = h.apply(
      h.code().replace("title: 'Restored'", "title: 'Back again'"),
    );
    expect(result.rejected).toEqual([]);
    expect(actions(h, button)).toEqual([
      {
        ...actionToast,
        onAction: [
          { opcode: "toast", message: "Back again", variant: "positive" },
        ],
      },
    ]);
    const code = h.code();
    const start = code.indexOf(", onAction: () => {");
    const end = code.indexOf("}});", start);
    result = h.apply(code.slice(0, start) + "});" + code.slice(end + 4));
    expect(result.rejected).toEqual([]);
    const { onAction: _dos, ...withoutDos } = actionToast;
    expect(actions(h, button)).toEqual([withoutDos]);
  });

  it("a button label with a timeout is refused (S2: an actionable toast stays)", async () => {
    const { h, button } = await open({ opcode: "toast", message: "Hi" });
    const refused = h.apply(
      h
        .code()
        .replace(
          "queue.add({title: 'Hi'});",
          "queue.add({title: 'Hi', actionLabel: 'Undo'}, {timeout: 6000});",
        ),
    );
    expect(refused.rejected.length).toBeGreaterThan(0);
    expect(actions(h, button)).toEqual([{ opcode: "toast", message: "Hi" }]);
  });
});
