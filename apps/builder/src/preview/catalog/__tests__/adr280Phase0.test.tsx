import { act, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { NodeId } from "../../../../../../packages/shared/src/catalog/document/types";
import { openAdr280Preview } from "./support/adr280Harness";

/**
 * ADR-280 Phase 0 (G0) — the defects the ADR fixes, reproduced on the whole Preview path before
 * any fix. Each `it.fails` states the behavior Phase 2 must reach: it fails today (the defect is
 * real) and turns into a failing test the moment the defect is fixed, so Phase 2 flips it to `it`.
 * Phase 2 fixed RED 1 · 4 · 5 (now `it`).
 * Measurement: jsdom + the Builder workspace → channel → Preview session, RAC 1.22.1 — only
 * "does the rule reach RAC", no distribution claim (synthetic fixture, breakdown §1b).
 */
const warnings = () =>
  (console.warn as unknown as { mock: { calls: unknown[][] } }).mock.calls
    .map((call) => String(call[0]))
    .filter((message) => message.startsWith("[interactions]"));

afterEach(() => {
  vi.restoreAllMocks();
});

const press = (element: HTMLElement | null) =>
  act(() => {
    fireEvent.click(element!);
  });

describe("ADR-280 Phase 0 — RED 1: a collection's selection capability does not reach RAC", () => {
  it("Button → ListBox selectItem selects the item", async () => {
    const { ids, rule, element, view } = await openAdr280Preview([
      "ListBox",
      "Button",
    ]);
    const [listBox, button] = ids as [NodeId, NodeId];
    rule(button, "onPress", {
      opcode: "capability",
      target: { nodeId: listBox },
      capabilityId: "selectItem",
      value: "starred",
    });
    press(element(button));
    expect(
      view.container
        .querySelector('[role="option"][data-key="starred"]')
        ?.getAttribute("aria-selected"),
    ).toBe("true");
    view.unmount();
  });

  it("Button → GridList selectItem selects the row", async () => {
    const { ids, rule, declare, element, view } = await openAdr280Preview([
      "GridList",
      "Button",
    ]);
    const [gridList, button] = ids as [NodeId, NodeId];
    // (The palette GridList selects nothing — `selectionMode: "none"`.)
    declare(gridList, { selectionMode: "single" });
    const key = view.container
      .querySelector('[role="row"]:not([aria-selected="true"])')
      ?.getAttribute("data-key");
    expect(key).toBeTruthy();
    rule(button, "onPress", {
      opcode: "capability",
      target: { nodeId: gridList },
      capabilityId: "selectItem",
      value: key!,
    });
    press(element(button));
    expect(
      view.container
        .querySelector(`[role="row"][data-key="${key}"]`)
        ?.getAttribute("aria-selected"),
    ).toBe("true");
    view.unmount();
  });
});

describe("ADR-280 Phase 0 — RED 2: the I18nProvider wrapper drops a When handler", () => {
  // (A Calendar with a locale is drawn inside `withI18n`'s I18nProvider — `withRuntime` clones the
  // provider, not the RAC Calendar, so the rule's handler never reaches RAC.)
  const pick = async (locale: string | undefined) => {
    const harness = await openAdr280Preview(["Calendar"]);
    const [calendar] = harness.ids as [NodeId];
    if (locale) harness.declare(calendar, { locale });
    harness.rule(calendar, "onChange", { opcode: "toast", message: "picked" });
    const cell = [
      ...harness.view.container.querySelectorAll(
        '.react-aria-CalendarCell[role="button"]:not([aria-disabled="true"])',
      ),
    ].find((item) => item.textContent?.trim() === "15") as HTMLElement;
    act(() => {
      fireEvent.click(cell);
    });
    harness.view.unmount();
    return harness.toasts;
  };

  it("control: a Calendar without a locale runs its onChange rule", async () => {
    expect(await pick(undefined)).toEqual(["picked"]);
  });

  it("a Calendar with a locale runs its onChange rule", async () => {
    expect(await pick("ko-KR")).toEqual(["picked"]);
  });
});

describe("ADR-280 Phase 0 — RED 4: a capability write ignores RAC's constraints", () => {
  it("(a) Button → disabled Checkbox check leaves it unchecked and reports", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const { ids, rule, declare, element, view } = await openAdr280Preview([
      "Checkbox",
      "Button",
    ]);
    const [checkbox, button] = ids as [NodeId, NodeId];
    declare(checkbox, { isSelected: false, isDisabled: true });
    rule(button, "onPress", {
      opcode: "capability",
      target: { nodeId: checkbox },
      capabilityId: "check",
    });
    press(element(button));
    expect(
      (element(checkbox)?.querySelector("input") as HTMLInputElement).checked,
    ).toBe(false);
    expect(warnings()).toHaveLength(1);
    view.unmount();
  });
});

describe("ADR-280 Phase 0 — RED 5: Form submit / reset do not run", () => {
  it("Button → Form submit fires the Form's onSubmit rule", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const { ids, rule, element, view, toasts } = await openAdr280Preview([
      "Form",
      "Button",
    ]);
    const [form, button] = ids as [NodeId, NodeId];
    // (The palette Form's fields are required and empty: make them optional so the submit
    // passes validation — the rule, not validation, is under test.)
    for (const input of view.container.querySelectorAll("form input"))
      input.removeAttribute("required");
    rule(form, "onSubmit", { opcode: "toast", message: "submitted" });
    rule(button, "onPress", {
      opcode: "capability",
      target: { nodeId: form },
      capabilityId: "submit",
    });
    press(element(button));
    expect(warnings()).toEqual([]);
    expect(toasts).toEqual(["submitted"]);
    view.unmount();
  });
});
