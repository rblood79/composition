import { act, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { NodeId } from "../../../../../../packages/shared/src/catalog/document/types";
import { openAdr280Preview } from "./support/adr280Harness";

/**
 * ADR-308 G2 (e) — a Do on an item whose selection · expansion is its group's (check · uncheck on a
 * grouped Checkbox · ToggleButton, expand · collapse on an Accordion's Disclosure) reads and writes
 * the group's keys: the dispatcher's receiver is the group and its value the item's key put in or
 * taken out (F20 — a receiver change alone wrote a boolean on the group). One key while the group
 * holds one.
 */
type Harness = Awaited<ReturnType<typeof openAdr280Preview>>;

afterEach(() => {
  vi.restoreAllMocks();
});

const reports = () =>
  (console.warn as unknown as { mock: { calls: unknown[][] } }).mock.calls
    .map((call) => String(call[0]))
    .filter((message) => message.startsWith("[interactions]"));

const ownedNodes = (h: Harness, bindingId: string) =>
  [...h.session.root!.domInputs.values()]
    .filter(
      (record) =>
        record.bindingId === bindingId &&
        record.sourceId.startsWith("project:node:"),
    )
    .map((record) => record.sourceId as NodeId);

/** Buttons whose press runs one Do each on the given item nodes. */
function wire(
  h: Harness,
  buttons: readonly NodeId[],
  dos: readonly [NodeId, string][],
) {
  dos.forEach(([target, capabilityId], index) =>
    h.rule(buttons[index]!, "onPress", {
      opcode: "capability",
      target: { nodeId: target },
      capabilityId,
    }),
  );
  return (index: number) =>
    act(() => {
      fireEvent.click(h.element(buttons[index]!)!);
    });
}

describe("ADR-308 G2 (e) — an item's Do writes its group's keys", () => {
  it("CheckboxGroup: check · uncheck a Checkbox puts its value in the group's and takes it out", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const h = await openAdr280Preview([
      "CheckboxGroup",
      "Button",
      "Button",
      "Button",
    ]);
    const [, ...buttons] = h.ids as NodeId[];
    const [first, second] = ownedNodes(h, "checkbox");
    const press = wire(h, buttons, [
      [second!, "check"],
      [first!, "check"],
      [second!, "uncheck"],
    ]);
    const checked = () =>
      [
        ...h.view.container.querySelectorAll<HTMLInputElement>(
          "input[type=checkbox]",
        ),
      ].map((input) => input.checked);
    expect(checked()).toEqual([false, false]);
    press(0);
    expect(checked()).toEqual([false, true]);
    press(1);
    expect(checked()).toEqual([true, true]);
    press(2);
    expect(checked()).toEqual([true, false]);
    expect(reports()).toEqual([]);
    h.view.unmount();
  });

  it("ToggleButtonGroup single: check one ToggleButton, then another — one key", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const h = await openAdr280Preview([
      "ToggleButtonGroup",
      "Button",
      "Button",
    ]);
    const [, ...buttons] = h.ids as NodeId[];
    const [first, second] = ownedNodes(h, "togglebutton");
    const press = wire(h, buttons, [
      [first!, "check"],
      [second!, "check"],
    ]);
    const pressed = () =>
      [
        ...h.view.container.querySelectorAll(
          ".react-aria-ToggleButtonGroup button, [role=radiogroup] [role=radio]",
        ),
      ].map(
        (button) =>
          (button.getAttribute("aria-pressed") ??
            button.getAttribute("aria-checked")) === "true",
      );
    press(0);
    expect(pressed()).toEqual([true, false]);
    press(1);
    expect(pressed()).toEqual([false, true]);
    expect(reports()).toEqual([]);
    h.view.unmount();
  });

  it("Accordion: expand · collapse a Disclosure writes the group's expanded keys (one while it expands one)", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const h = await openAdr280Preview(["Accordion", "Button", "Button"]);
    const [, ...buttons] = h.ids as NodeId[];
    const [, second] = ownedNodes(h, "disclosure");
    const press = wire(h, buttons, [
      [second!, "expand"],
      [second!, "collapse"],
    ]);
    const expanded = () =>
      [...h.view.container.querySelectorAll("button[slot=trigger]")].map(
        (button) => button.getAttribute("aria-expanded") === "true",
      );
    // (The origin opens `section-1` — the group's `expandedKeys`.)
    expect(expanded()).toEqual([true, false]);
    press(0);
    expect(expanded()).toEqual([false, true]);
    press(1);
    expect(expanded()).toEqual([false, false]);
    expect(reports()).toEqual([]);
    h.view.unmount();
  });
});
