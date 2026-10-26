import { act, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { NodeId } from "../../../../../../packages/shared/src/catalog/document/types";
import { openAdr280Preview } from "./support/adr280Harness";

/**
 * ADR-280 G2 — Decision 9: a rule submits · resets a Form through the form element (RAC
 * delegates to it). A Form without an authored destination does not leave the page; an authored
 * `action` or `method="dialog"` keeps HTML's own submission (review round 2 h2).
 */
afterEach(() => {
  vi.restoreAllMocks();
});

const warnings = () =>
  (console.warn as unknown as { mock: { calls: unknown[][] } }).mock.calls
    .map((call) => String(call[0]))
    .filter((message) => message.startsWith("[interactions]"));

async function formWithButton(capabilityId: "submit" | "reset") {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  // (jsdom reports a submission it cannot navigate as "not implemented" — not under test.)
  vi.spyOn(console, "error").mockImplementation(() => {});
  const harness = await openAdr280Preview(["Form", "Button"]);
  const [form, button] = harness.ids as [NodeId, NodeId];
  harness.rule(form, "onSubmit", { opcode: "toast", message: "submitted" });
  harness.rule(button, "onPress", {
    opcode: "capability",
    target: { nodeId: form },
    capabilityId,
  });
  /** Each submit event's `defaultPrevented`, read after the Preview's handlers ran. */
  const submits: boolean[] = [];
  const listen = (event: Event) => submits.push(event.defaultPrevented);
  window.addEventListener("submit", listen);
  const press = () =>
    act(() => {
      fireEvent.click(harness.element(button)!);
    });
  const inputs = () => [
    ...harness.view.container.querySelectorAll<HTMLInputElement>("form input"),
  ];
  const done = () => {
    window.removeEventListener("submit", listen);
    harness.view.unmount();
  };
  return { ...harness, form, press, submits, inputs, done };
}

const optional = (inputs: HTMLInputElement[]) =>
  inputs.forEach((input) => input.removeAttribute("required"));

describe("ADR-280 G2 — Form submit · reset (Decision 9)", () => {
  it("submit runs the Form's onSubmit rule once and stays on the page", async () => {
    const h = await formWithButton("submit");
    optional(h.inputs());
    h.press();
    expect(h.toasts).toEqual(["submitted"]);
    expect(h.submits).toEqual([true]);
    expect(warnings()).toEqual([]);
    h.done();
  });

  it("submit with an empty required field: no onSubmit, RAC shows it invalid", async () => {
    const h = await formWithButton("submit");
    h.press();
    expect(h.toasts).toEqual([]);
    expect(h.submits).toEqual([]);
    expect(
      h.view.container.querySelector('[data-invalid="true"], [data-invalid]'),
    ).not.toBeNull();
    h.done();
  });

  it("reset brings a controlled field back to its declared value", async () => {
    const h = await formWithButton("reset");
    const [first] = h.inputs();
    act(() => {
      fireEvent.change(first!, { target: { value: "typed" } });
    });
    expect(first!.value).toBe("typed");
    h.press();
    expect(h.inputs()[0]!.value).toBe("");
    expect(warnings()).toEqual([]);
    h.done();
  });

  it("control: an authored action keeps HTML's submission (not prevented)", async () => {
    const h = await formWithButton("submit");
    h.declare(h.form, { action: "/thanks" });
    optional(h.inputs());
    h.press();
    expect(h.toasts).toEqual(["submitted"]);
    expect(h.submits).toEqual([false]);
    h.done();
  });

  it('control: method="dialog" keeps HTML\'s submission (not prevented)', async () => {
    const h = await formWithButton("submit");
    h.declare(h.form, { method: "dialog" });
    optional(h.inputs());
    h.press();
    expect(h.submits).toEqual([false]);
    h.done();
  });
});
