import { act, fireEvent } from "@testing-library/react";
import { User } from "@react-aria/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { NodeId } from "../../../../../../packages/shared/src/catalog/document/types";
import { tableBinding } from "../../../../../../packages/shared/src/catalog/bindings/Table.binding";
import { openAdr280Preview } from "./support/adr280Harness";

/**
 * S2 TableView `disallowEmptySelection` (2026-10-28 — design-data 차이 보고서 후보 1: GridList ·
 * ListBox · TagGroup · ToggleButtonGroup · Tree binding 은 받는데 Table 만 없었다). The prop reaches
 * RAC's Table (the user cannot clear the last selected row) and the rules' guard (`clearSelection`
 * is refused and reported, as on the other collections).
 */
afterEach(() => {
  vi.restoreAllMocks();
});

const user = new User({ interactionType: "mouse" });
const warnings = () =>
  (console.warn as unknown as { mock?: { calls: unknown[][] } }).mock?.calls
    .map((call) => String(call[0]))
    .filter((message) => message.startsWith("[interactions]")) ?? [];

async function table(declare: Record<string, unknown>) {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  const h = await openAdr280Preview(["Table", "Button"]);
  const [target, button] = h.ids as [NodeId, NodeId];
  h.declare(target, declare as Record<string, never>);
  const tester = user.createTester("Table", {
    root: h.element(target)!.matches("[role=grid]")
      ? h.element(target)!
      : h.element(target)!.querySelector<HTMLElement>("[role=grid]")!,
  });
  const selected = () =>
    tester
      .getRows()
      .filter((row) => row.getAttribute("aria-selected") === "true").length;
  return { ...h, target, button, tester, selected };
}

describe("Table disallowEmptySelection", () => {
  it("the binding declares it (S2 TableView's boolean, in the state section)", () => {
    expect(tableBinding.props.accepts.disallowEmptySelection).toMatchObject({
      kind: "boolean",
      section: "state",
    });
  });

  it("on: the user's second press on the selected row keeps it selected", async () => {
    const h = await table({
      selectionMode: "single",
      disallowEmptySelection: true,
    });
    await h.tester.toggleRowSelection({ row: 0, checkboxSelection: false });
    await h.tester.toggleRowSelection({ row: 0, checkboxSelection: false });
    expect(h.selected()).toBe(1);
    h.view.unmount();
  });

  it("off (control): the second press clears it", async () => {
    const h = await table({ selectionMode: "single" });
    await h.tester.toggleRowSelection({ row: 0, checkboxSelection: false });
    await h.tester.toggleRowSelection({ row: 0, checkboxSelection: false });
    expect(h.selected()).toBe(0);
    h.view.unmount();
  });

  it("on: a rule's clearSelection is refused and reported; the row stays selected", async () => {
    const h = await table({
      selectionMode: "single",
      disallowEmptySelection: true,
    });
    await h.tester.toggleRowSelection({ row: 0, checkboxSelection: false });
    h.rule(h.button, "onPress", {
      opcode: "capability",
      target: { nodeId: h.target },
      capabilityId: "clearSelection",
    });
    act(() => {
      fireEvent.click(h.element(h.button)!);
    });
    expect(h.selected()).toBe(1);
    expect(warnings().some((m) => m.includes("disallowEmptySelection"))).toBe(
      true,
    );
    h.view.unmount();
  });
});
