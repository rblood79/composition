import { act, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { NodeId } from "../../../../../../packages/shared/src/catalog/document/types";
import { openAdr280Preview } from "./support/adr280Harness";

/**
 * S2 체크리스트 부록 D.3 `guides/forms.md` (2026-11-23 1단계 — 구현은 있고 장면 테스트가 없던 것):
 *   - Form `validationBehavior="aria"` reaches its fields through RAC's Form context — a required
 *     field is `aria-required` only (no native `required`), and an empty one does not block submit
 *     (S2 「Realtime validation」: "aria … will not prevent form submission")
 *   - native (the default): a field's `pattern` blocks submit until the value conforms, and the
 *     field shows invalid (S2 「Constraint validation」)
 */
afterEach(() => {
  vi.restoreAllMocks();
});

async function form() {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  const harness = await openAdr280Preview(["Form", "Button"]);
  const [formId, button] = harness.ids as [NodeId, NodeId];
  harness.rule(formId, "onSubmit", { opcode: "toast", message: "submitted" });
  harness.rule(button, "onPress", {
    opcode: "capability",
    target: { nodeId: formId },
    capabilityId: "submit",
  });
  const inputs = () => [
    ...harness.view.container.querySelectorAll<HTMLInputElement>("form input"),
  ];
  const press = () =>
    act(() => {
      fireEvent.click(harness.element(button)!);
    });
  return { ...harness, formId, inputs, press };
}

describe("S2 D.3 forms — validation behavior · constraint rules", () => {
  it("Form aria: fields are aria-required, not native required; an empty required field submits", async () => {
    const h = await form();
    const required = h.inputs().filter((input) => input.required);
    expect(required.length).toBeGreaterThan(0);
    h.declare(h.formId, { validationBehavior: "aria" });
    const fields = h.inputs();
    expect(fields.some((input) => input.required)).toBe(false);
    expect(
      fields.filter((input) => input.getAttribute("aria-required") === "true")
        .length,
    ).toBe(required.length);
    h.press();
    expect(h.toasts).toEqual(["submitted"]);
    h.view.unmount();
  });

  it("native: a field's pattern blocks submit until the value conforms", async () => {
    const h = await form();
    const [first] = h.inputs();
    const field = first!.closest(".react-aria-TextField") as HTMLElement;
    const fieldId = field
      .getAttribute("data-catalog-id")!
      .split("::")
      .pop() as NodeId;
    expect(fieldId.startsWith("project:node:")).toBe(true);
    h.declare(fieldId, { pattern: "[0-9]+" });
    expect(h.inputs()[0]!.getAttribute("pattern")).toBe("[0-9]+");
    act(() => {
      fireEvent.change(h.inputs()[0]!, { target: { value: "abc" } });
    });
    h.inputs()
      .slice(1)
      .forEach((input) => input.removeAttribute("required"));
    h.press();
    expect(h.toasts).toEqual([]);
    expect(h.inputs()[0]!.getAttribute("aria-invalid")).toBe("true");
    act(() => {
      fireEvent.change(h.inputs()[0]!, { target: { value: "123" } });
    });
    h.press();
    expect(h.toasts).toEqual(["submitted"]);
    h.view.unmount();
  });
});
