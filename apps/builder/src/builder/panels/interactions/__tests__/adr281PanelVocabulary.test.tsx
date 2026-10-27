/**
 * ADR-281 G1 — the Interactions panel's vocabulary: When in concept groups with only what RAC
 * fires now, hidden RAC events behind the "More events" toggle (never keyboard — Q3), and a
 * rule the declared props stop kept with a marker (the value source is `valueField.test.tsx`).
 */
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/i18n";
import type {
  InteractionEntry,
  NodeId,
} from "../../../../../../../packages/shared/src/catalog/document/types";
import { TriggerPicker } from "../TriggerPicker";
import { CatalogEventRow } from "../catalog/CatalogEventRow";
import { CatalogInheritedRuleRow } from "../catalog/CatalogInheritedRuleRow";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

afterEach(cleanup);

const wrap = (ui: React.ReactNode) =>
  render(<I18nProvider initialLocale="en-US">{ui}</I18nProvider>);

/** The option labels and section headers of an open PropertySelect. */
function openSelect(label: string) {
  fireEvent.click(
    within(screen.getByRole("group", { name: label })).getByRole("button"),
  );
  const listbox = screen.getByRole("listbox");
  return {
    options: within(listbox)
      .getAllByRole("option")
      .map((option) => option.textContent),
    headers: [...listbox.querySelectorAll("header")].map(
      (header) => header.textContent,
    ),
  };
}

describe("ADR-281 G1 — When groups and the hidden-event toggle", () => {
  it("a Button offers the Press group; the toggle opens press side events, hover and focus — never keyboard", () => {
    wrap(
      <TriggerPicker
        componentType="Button"
        value="onPress"
        exposure={{ props: {} }}
        onChange={() => {}}
      />,
    );
    const shown = openSelect("When");
    expect(shown.headers).toEqual(["Press"]);
    expect(shown.options).toEqual(["On press"]);
    fireEvent.keyDown(screen.getByRole("listbox"), { key: "Escape" });
    fireEvent.click(screen.getByRole("switch", { name: "More events" }));
    const all = openSelect("When");
    expect(all.headers).toEqual(["Press", "Hover", "Focus"]);
    expect(all.options).toContain("On hover start");
    expect(all.options).toContain("On press start");
    expect(all.options.join()).not.toMatch(/key/i);
  });

  it("a disabled Button offers no When — except the one its rule uses", () => {
    wrap(
      <TriggerPicker
        componentType="Button"
        value="onPress"
        exposure={{ props: { isDisabled: true } }}
        onChange={() => {}}
      />,
    );
    expect(openSelect("When").options).toEqual(["On press"]);
    cleanup();
    wrap(
      <TriggerPicker
        componentType="Checkbox"
        value="onFocus"
        exposure={{ props: { isReadOnly: true } }}
        onChange={() => {}}
      />,
    );
    // (A rule on a hidden event keeps the toggle on; the read-only Checkbox's onChange is gone.)
    expect(
      (
        screen.getByRole("switch", {
          name: "More events",
        }) as HTMLInputElement
      ).checked,
    ).toBe(true);
    expect(openSelect("When").options).not.toContain("On check change");
  });
});

describe("ADR-281 G1 — a rule the declared props stop is kept, with a marker", () => {
  const rule: InteractionEntry = {
    kind: "interaction",
    id: "project:interaction:r1" as InteractionEntry["id"],
    ownerId: "project:node:b" as NodeId,
    trigger: "onPress",
    actions: [
      {
        opcode: "capability",
        target: { nodeId: "project:node:list" as NodeId },
        capabilityId: "selectItem",
        value: "a",
      },
    ],
  };
  const context = {
    pages: [],
    currentPageId: undefined,
    variables: [],
    targets: () => [],
  };
  const row = (targetProps: Record<string, unknown>) =>
    wrap(
      <CatalogEventRow
        rule={rule}
        componentType="Button"
        context={context}
        choices={["capability"]}
        describeTarget={() => ({
          key: "list",
          ref: { nodeId: "project:node:list" as NodeId },
          edit: { kind: "node", id: "project:node:list" as NodeId },
          type: "ListBox",
          path: [],
          group: "page",
          shortId: "list",
        })}
        targetNotice={() => undefined}
        onTargetHover={() => {}}
        exposure={{ props: {} }}
        targetExposure={() => ({ props: targetProps })}
        expanded={false}
        onToggle={() => {}}
        onChange={() => {}}
        onRemove={() => {}}
      />,
    );

  it("selectionMode none on the target marks the rule; the rule stays", () => {
    row({ selectionMode: "none" });
    expect(
      screen.getByText("RAC does not take this now (selectionMode: none)"),
    ).toBeTruthy();
    expect(screen.getAllByRole("button", { name: /select/i })).toHaveLength(1);
  });

  it("control: a single-selection target has no marker", () => {
    row({ selectionMode: "single" });
    expect(screen.queryByText(/RAC does not take this now/)).toBeNull();
  });
});

describe("ADR-281 G3 — the inherited rule row", () => {
  const rule: InteractionEntry = {
    kind: "interaction",
    id: "project:interaction:origin" as InteractionEntry["id"],
    ownerId: "project:node:template" as NodeId,
    trigger: "onPress",
    actions: [{ opcode: "toast", message: "hi" }],
  };

  it("a summary, an on/off switch and Replace in this instance", () => {
    const onEnabledChange = vi.fn();
    const onReplace = vi.fn();
    wrap(
      <CatalogInheritedRuleRow
        rule={rule}
        status="on"
        componentType="Button"
        onEnabledChange={onEnabledChange}
        onReplace={onReplace}
      />,
    );
    expect(screen.getByText("On press → Show a toast")).toBeTruthy();
    fireEvent.click(
      screen.getByRole("switch", { name: "Runs in this instance" }),
    );
    expect(onEnabledChange).toHaveBeenCalledWith(false);
    fireEvent.click(
      screen.getByRole("button", { name: "Replace in this instance" }),
    );
    expect(onReplace).toHaveBeenCalled();
  });

  it("a replaced rule says its own rule runs instead (no switch)", () => {
    wrap(
      <CatalogInheritedRuleRow
        rule={rule}
        status={{
          replacedBy: "project:interaction:mine" as InteractionEntry["id"],
        }}
        componentType="Button"
        onEnabledChange={() => {}}
        onReplace={() => {}}
      />,
    );
    expect(
      screen.getByText("This instance's own rule runs instead"),
    ).toBeTruthy();
    expect(screen.queryByRole("switch")).toBeNull();
  });

  it("one reading: effectiveInteractionsOf is called by the panel and the Preview only (grep gate)", () => {
    const read = (path: string) =>
      readFileSync(resolve(import.meta.dirname, path), "utf8");
    const callers = [
      "../../../catalogRuntime/interactions.ts",
      "../../../../../../../packages/shared/src/catalog/runtime/catalogPreviewInteractions.ts",
    ];
    for (const path of callers)
      expect(read(path)).toMatch(/effectiveInteractionsOf\(/);
  });
});
