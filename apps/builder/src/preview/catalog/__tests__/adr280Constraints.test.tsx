import { act, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { NodeId } from "../../../../../../packages/shared/src/catalog/document/types";
import { openAdr280Preview } from "./support/adr280Harness";

/**
 * ADR-280 G2 — Decision 8 on the whole Preview path: a capability starts from the state RAC shows
 * (the items' declared selection included — review round 2 h1), computes the result, and RAC's
 * constraints refuse it before anything is written (round 1 h2). Plus `!event.<arg>` (Decision 6)
 * and R2 — no render switches a RAC component between uncontrolled and controlled.
 */
type Harness = Awaited<ReturnType<typeof openAdr280Preview>>;

afterEach(() => {
  vi.restoreAllMocks();
});

const reports = () =>
  (console.warn as unknown as { mock: { calls: unknown[][] } }).mock.calls
    .map((call) => String(call[0]))
    .filter((message) => message.startsWith("[interactions]"));

/** The owned item nodes of a type in the document (a palette instance's slot contents). */
const ownedNodes = (h: Harness, bindingId: string) =>
  [...h.session.root!.domInputs.values()]
    .filter(
      (record) =>
        record.bindingId === bindingId &&
        record.sourceId.startsWith("project:node:"),
    )
    .map((record) => record.sourceId as NodeId);

const selectedKeys = (h: Harness) =>
  [...h.view.container.querySelectorAll('[role="option"]')]
    .filter((option) => option.getAttribute("aria-selected") === "true")
    .map((option) => option.getAttribute("data-key"));

async function listBoxRule(
  capabilityId: string,
  value: string | undefined,
  declare: Record<string, unknown>,
  selectFirst: boolean,
) {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  const h = await openAdr280Preview(["ListBox", "Button"]);
  const [listBox, button] = h.ids as [NodeId, NodeId];
  h.declare(listBox, declare as Record<string, never>);
  if (selectFirst)
    h.declare(ownedNodes(h, "listboxitem")[0]!, { isSelected: true });
  h.rule(button, "onPress", {
    opcode: "capability",
    target: { nodeId: listBox },
    capabilityId,
    ...(value !== undefined ? { value } : {}),
  });
  const press = () =>
    act(() => {
      fireEvent.click(h.element(button)!);
    });
  return { ...h, press };
}

describe("ADR-280 G2 — a set operation starts from what RAC shows (round 2 h1)", () => {
  it("(f) multiple ListBox with inbox Selected ← selectItem(archive): {inbox, archive}", async () => {
    const h = await listBoxRule(
      "selectItem",
      "archive",
      { selectionMode: "multiple" },
      true,
    );
    expect(selectedKeys(h)).toEqual(["inbox"]);
    h.press();
    expect(selectedKeys(h)).toEqual(["inbox", "archive"]);
    expect(reports()).toEqual([]);
    h.view.unmount();
  });

  it("(g) disallowEmptySelection multiple ListBox with only inbox ← deselectItem(inbox): kept, reported", async () => {
    const h = await listBoxRule(
      "deselectItem",
      "inbox",
      { selectionMode: "multiple", disallowEmptySelection: true },
      true,
    );
    h.press();
    expect(selectedKeys(h)).toEqual(["inbox"]);
    expect(reports()).toEqual([
      expect.stringContaining("disallowEmptySelection"),
    ]);
    h.view.unmount();
  });

  it("single ListBox ← selectItem replaces the selection", async () => {
    const h = await listBoxRule(
      "selectItem",
      "archive",
      { selectionMode: "single" },
      true,
    );
    h.press();
    expect(selectedKeys(h)).toEqual(["archive"]);
    h.view.unmount();
  });
});

describe("ADR-280 G2 — RAC's constraints refuse the write (round 1 h2)", () => {
  it("(d) disallowEmptySelection ListBox ← clearSelection: kept, reported", async () => {
    const h = await listBoxRule(
      "clearSelection",
      undefined,
      { selectionMode: "multiple", disallowEmptySelection: true },
      true,
    );
    h.press();
    expect(selectedKeys(h)).toEqual(["inbox"]);
    expect(reports()).toHaveLength(1);
    h.view.unmount();
  });

  it("(e) a disabled item ← selectItem: not selected, reported", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const h = await listBoxRule(
      "selectItem",
      "archive",
      { selectionMode: "single" },
      false,
    );
    h.declare(ownedNodes(h, "listboxitem").at(-1)!, { isDisabled: true });
    h.press();
    expect(selectedKeys(h)).toEqual([]);
    expect(reports()).toEqual([expect.stringContaining("disabledKeys")]);
    h.view.unmount();
  });

  it("(c) readOnly TextField ← setValue: unchanged, reported", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const h = await openAdr280Preview(["TextField", "Button"]);
    const [field, button] = h.ids as [NodeId, NodeId];
    h.declare(field, { isReadOnly: true, value: "kept" });
    h.rule(button, "onPress", {
      opcode: "capability",
      target: { nodeId: field },
      capabilityId: "setValue",
      value: "changed",
    });
    act(() => {
      fireEvent.click(h.element(button)!);
    });
    expect(
      (h.view.container.querySelector("input") as HTMLInputElement).value,
    ).toBe("kept");
    expect(reports()).toEqual([expect.stringContaining("isReadOnly")]);
    h.view.unmount();
  });

  it("(b) a Checkbox in a disabled CheckboxGroup ← check: unchanged, reported", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const h = await openAdr280Preview(["CheckboxGroup", "Button"]);
    const [group, button] = h.ids as [NodeId, NodeId];
    h.declare(group, { isDisabled: true });
    const box = ownedNodes(h, "checkbox").at(-1)!;
    h.declare(box, { isSelected: false });
    h.rule(button, "onPress", {
      opcode: "capability",
      target: { nodeId: box },
      capabilityId: "check",
    });
    act(() => {
      fireEvent.click(h.element(button)!);
    });
    const inputs = [
      ...h.view.container.querySelectorAll<HTMLInputElement>(
        "input[type=checkbox]",
      ),
    ];
    expect(inputs.at(-1)!.checked).toBe(false);
    expect(reports()).toEqual([expect.stringContaining("isDisabled")]);
    h.view.unmount();
  });
});

describe("ADR-280 G2 — `!event.<arg>` (Decision 6)", () => {
  it("ListBox A onSelectionChange → ListBox B selectItem(!event.keys)", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const h = await openAdr280Preview(["ListBox", "ListBox"]);
    const [a, b] = h.ids as [NodeId, NodeId];
    h.declare(a, { selectionMode: "single" });
    h.declare(b, { selectionMode: "multiple" });
    h.rule(a, "onSelectionChange", {
      opcode: "capability",
      target: { nodeId: b },
      capabilityId: "selectItem",
      value: "!event.keys",
    });
    const lists = () => [
      ...h.view.container.querySelectorAll<HTMLElement>('[role="listbox"]'),
    ];
    act(() => {
      fireEvent.click(lists()[0]!.querySelector('[data-key="starred"]')!);
    });
    expect(
      lists()[1]!
        .querySelector('[data-key="starred"]')
        ?.getAttribute("aria-selected"),
    ).toBe("true");
    expect(reports()).toEqual([]);
    h.view.unmount();
  });
});

describe("ADR-280 R2 — no uncontrolled ↔ controlled switch", () => {
  it("a session of edits and rules logs no React controlled-mode warning", async () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const h = await openAdr280Preview([
      "TextField",
      "NumberField",
      "Checkbox",
      "Switch",
      "Slider",
      "ListBox",
      "Tabs",
      "Select",
      "ComboBox",
      "DateField",
      "Calendar",
      "Button",
    ]);
    const button = h.ids.at(-1) as NodeId;
    h.rule(button, "onPress", {
      opcode: "capability",
      target: { nodeId: h.ids[0]! },
      capabilityId: "setValue",
      value: "x",
    });
    act(() => {
      fireEvent.change(h.view.container.querySelector("input")!, {
        target: { value: "typed" },
      });
    });
    act(() => {
      fireEvent.click(h.element(button)!);
    });
    h.declare(h.ids[0]!, { value: "declared" });
    expect(
      errors.mock.calls
        .map((call) => String(call[0]))
        .filter((message) =>
          /uncontrolled to controlled|controlled to uncontrolled|changing an? (un)?controlled/i.test(
            message,
          ),
        ),
    ).toEqual([]);
    h.view.unmount();
  });
});
