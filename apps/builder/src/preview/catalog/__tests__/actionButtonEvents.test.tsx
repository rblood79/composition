import { act, fireEvent } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { NodeId } from "../../../../../../packages/shared/src/catalog/document/types";
import { openAdr280Preview } from "./support/adr280Harness";

const click = async (element: HTMLElement) =>
  act(async () => fireEvent.click(element));

describe("ActionButton Preview events", () => {
  it("runs Press and suppresses it while pending or disabled", async () => {
    const h = await openAdr280Preview(["ActionButton"]);
    const id = h.ids[0]!;
    h.rule(id, "onPress", { opcode: "toast", message: "Pressed" });
    await click(h.element(id)!);
    expect(h.toasts).toEqual(["Pressed"]);
    await act(async () => h.declare(id, { isPending: true }));
    await click(h.element(id)!);
    expect(h.toasts).toHaveLength(1);
    await act(async () =>
      h.declare(id, { isPending: false, isDisabled: true }),
    );
    await click(h.element(id)!);
    expect(h.toasts).toHaveLength(1);
    await act(async () => h.declare(id, { isDisabled: false }));
    await click(h.element(id)!);
    expect(h.toasts).toHaveLength(2);
    h.view.unmount();
    h.workspace.dispose();
  });

  it("group disabled guards dispatch and preserves an explicitly enabled child", async () => {
    const h = await openAdr280Preview(["ActionButtonGroup"]);
    const group = h.ids[0]!;
    const buttons = [...h.session.root!.domInputs.values()].filter(
      (n) => n.bindingId === "actionbutton",
    );
    const first = buttons[0]!.sourceId as NodeId;
    h.rule(first, "onPress", { opcode: "toast", message: "Copy" });
    await click(h.element(first)!);
    expect(h.toasts).toEqual(["Copy"]);
    await act(async () => h.declare(group, { isDisabled: true }));
    await click(h.element(first)!);
    expect(h.toasts).toHaveLength(1);
    await act(async () => h.declare(first, { isDisabled: false }));
    await click(h.element(first)!);
    expect(h.toasts).toHaveLength(2);
    h.view.unmount();
    h.workspace.dispose();
  });
});
