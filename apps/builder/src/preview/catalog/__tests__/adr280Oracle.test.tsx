import { act, fireEvent } from "@testing-library/react";
import { User } from "@react-aria/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { NodeId } from "../../../../../../packages/shared/src/catalog/document/types";
import { openAdr280Preview } from "./support/adr280Harness";

/**
 * ADR-280 G3 — the independent oracle (measurement-validity Q5): RAC's own testers
 * (`@react-aria/test-utils` 1.0.0-rc.1, user decision 6) read the state a rule left on the Preview.
 * The dispatcher's success is not the judge — what RAC shows is. Six rules (breakdown §4).
 */
type Harness = Awaited<ReturnType<typeof openAdr280Preview>>;

const user = new User({ interactionType: "mouse" });

afterEach(() => {
  vi.restoreAllMocks();
});

const reports = () =>
  (console.warn as unknown as { mock: { calls: unknown[][] } }).mock.calls
    .map((call) => String(call[0]))
    .filter((message) => message.startsWith("[interactions]"));

function pressButton(h: Harness, button: NodeId) {
  act(() => {
    fireEvent.click(h.element(button)!);
  });
}

describe("ADR-280 G3 — RAC testers observe the rules", () => {
  it("(1) Button press → Select selectItem: the Select tester reads the chosen option", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const h = await openAdr280Preview(["Select", "Button"]);
    const [select, button] = h.ids as [NodeId, NodeId];
    const items = [...h.session.root!.domInputs.values()].filter(
      (record) => record.bindingId === "listboxitem",
    );
    const last = items.at(-1)!;
    h.rule(button, "onPress", {
      opcode: "capability",
      target: { nodeId: select },
      capabilityId: "selectItem",
      // (A static item's RAC key is its `id`, else its record id — `resolveStaticItemKey`.)
      value: typeof last.props.id === "string" ? last.props.id : last.id,
    });
    pressButton(h, button);
    const tester = user.createTester("Select", {
      root: h.element(select)!,
    });
    expect(tester.getTrigger().textContent).toContain(
      String(
        [...h.session.root!.domInputs.values()].find(
          (record) =>
            record.parentId === last.id && record.props.slot === "label",
        )?.props.children ?? "",
      ),
    );
    expect(reports()).toEqual([]);
    h.view.unmount();
  });

  it("(2) ListBox A onSelectionChange(keys) → ListBox B selectItem(!event.keys)", async () => {
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
    const [listA, listB] = [
      ...h.view.container.querySelectorAll<HTMLElement>('[role="listbox"]'),
    ];
    await user
      .createTester("ListBox", { root: listA! })
      .toggleOptionSelection({ option: 1 });
    const testerB = user.createTester("ListBox", { root: listB! });
    expect(
      testerB
        .getOptions()
        .map((option) => option.getAttribute("aria-selected")),
    ).toEqual(["false", "true", "false"]);
    expect(reports()).toEqual([]);
    h.view.unmount();
  });

  it("(3) Button press → MenuTrigger open: the Menu tester finds the open menu", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const h = await openAdr280Preview(["Menu", "Button"]);
    const [trigger, button] = h.ids as [NodeId, NodeId];
    h.rule(button, "onPress", {
      opcode: "capability",
      target: { nodeId: trigger },
      capabilityId: "open",
    });
    const triggerButton = h.view.container.querySelector<HTMLElement>(
      `[data-catalog-id*="${trigger}"] button, button[aria-haspopup]`,
    )!;
    const tester = user.createTester("Menu", { root: triggerButton });
    expect(tester.getMenu()).toBeNull();
    pressButton(h, button);
    expect(tester.getMenu()).not.toBeNull();
    expect(reports()).toEqual([]);
    h.view.unmount();
  });

  it("(4) Button press → DatePicker setValue: its date segments show the date", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const h = await openAdr280Preview(["DatePicker", "Button"]);
    const [picker, button] = h.ids as [NodeId, NodeId];
    h.rule(button, "onPress", {
      opcode: "capability",
      target: { nodeId: picker },
      capabilityId: "setValue",
      value: "2026-10-22",
    });
    pressButton(h, button);
    const segments = [
      ...h.element(picker)!.querySelectorAll('[role="spinbutton"]'),
    ].map((segment) => segment.textContent);
    expect(segments).toEqual(expect.arrayContaining(["10", "22", "2026"]));
    expect(reports()).toEqual([]);
    h.view.unmount();
  });

  it("(5) Button press → Table sort: the Table tester reads the sorted column", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const h = await openAdr280Preview(["Table", "Button"]);
    const [table, button] = h.ids as [NodeId, NodeId];
    // (RAC reports a sort only on a sortable Column — S2 `allowsSorting`.)
    const column = [...h.session.root!.domInputs.values()].find(
      (record) =>
        record.bindingId === "column" &&
        record.sourceId.startsWith("project:node:"),
    )!;
    h.declare(column.sourceId as NodeId, { allowsSorting: true });
    const tester = () =>
      user.createTester("Table", {
        root: h.view.container.querySelector<HTMLElement>('[role="grid"]')!,
      });
    const key = tester().getColumns()[0]!.getAttribute("data-key") ?? "";
    h.rule(button, "onPress", {
      opcode: "capability",
      target: { nodeId: table },
      capabilityId: "sort",
      value: `${key}:descending`,
    });
    pressButton(h, button);
    expect(tester().getColumns()[0]!.getAttribute("aria-sort")).toBe(
      "descending",
    );
    expect(reports()).toEqual([]);
    h.view.unmount();
  });

  it("(6) Button press → Form submit → Form onSubmit → toast", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const h = await openAdr280Preview(["Form", "Button"]);
    const [form, button] = h.ids as [NodeId, NodeId];
    for (const input of h.view.container.querySelectorAll("form input"))
      input.removeAttribute("required");
    h.rule(form, "onSubmit", { opcode: "toast", message: "submitted" });
    h.rule(button, "onPress", {
      opcode: "capability",
      target: { nodeId: form },
      capabilityId: "submit",
    });
    pressButton(h, button);
    expect(h.toasts).toEqual(["submitted"]);
    expect(reports()).toEqual([]);
    h.view.unmount();
  });
});
