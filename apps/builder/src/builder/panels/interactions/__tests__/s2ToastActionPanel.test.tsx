/**
 * 295 후속 C8 — the toast Do's action button in the Interactions panel (S2 `ToastOptions`
 * `actionLabel` · `shouldCloseOnAction` · `onAction`): a label field; with a label the timeout goes
 * (S2: an actionable toast stays), a 「close on action」 switch and the button's own Do list (the same
 * editor, nested — no When).
 */
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { I18nProvider } from "@/i18n";
import type {
  InteractionEntry,
  NodeId,
} from "../../../../../../../packages/shared/src/catalog/document/types";
import { CatalogEventRow } from "../catalog/CatalogEventRow";

afterEach(cleanup);

const start: InteractionEntry = {
  kind: "interaction",
  id: "project:interaction:t" as InteractionEntry["id"],
  ownerId: "project:node:b" as NodeId,
  trigger: "onPress",
  actions: [{ opcode: "toast", message: "Deleted", timeout: 6000 }],
};

let latest: InteractionEntry = start;

function Harness() {
  const [rule, setRule] = useState(start);
  latest = rule;
  return (
    <I18nProvider initialLocale="en-US">
      <CatalogEventRow
        rule={rule}
        componentType="Button"
        context={{
          pages: [],
          currentPageId: undefined,
          variables: [],
          targets: () => [],
        }}
        choices={["toast", "navigate"]}
        describeTarget={() => undefined}
        targetNotice={() => undefined}
        onTargetHover={() => {}}
        exposure={{ props: {} }}
        targetExposure={() => ({ props: {} })}
        expanded
        onToggle={() => {}}
        onChange={setRule}
        onRemove={() => {}}
      />
    </I18nProvider>
  );
}

const input = (name: string) =>
  within(screen.getByRole("group", { name })).getByRole("textbox");

describe("toast Do — the action button", () => {
  it("a label replaces the timeout; close switch · nested Do list edit the Do; clearing the label removes the button", () => {
    render(<Harness />);
    expect(screen.getByRole("group", { name: "Timeout (ms)" })).toBeTruthy();
    fireEvent.change(input("Action label"), { target: { value: "Undo" } });
    fireEvent.blur(input("Action label"));
    expect(latest.actions[0]).toEqual({
      opcode: "toast",
      message: "Deleted",
      actionLabel: "Undo",
    });
    expect(screen.queryByRole("group", { name: "Timeout (ms)" })).toBeNull();

    fireEvent.click(screen.getByRole("switch", { name: "Close on action" }));
    expect(latest.actions[0]).toMatchObject({ shouldCloseOnAction: true });

    fireEvent.click(
      screen.getByRole("button", { name: "Add action button Do" }),
    );
    const nested = screen.getByRole("group", { name: "Action button Do" });
    // (The nested editor has no When: it runs in the rule's event.)
    expect(within(nested).queryByRole("group", { name: "When" })).toBeNull();
    const first = (latest.actions[0] as { onAction?: unknown[] }).onAction;
    expect(first).toHaveLength(1);

    // (The nested list's last Do can be removed — the button then has no Dos.)
    fireEvent.click(
      within(nested).getByRole("button", { name: "Remove this Do" }),
    );
    expect(latest.actions[0]).not.toHaveProperty("onAction");

    fireEvent.change(input("Action label"), { target: { value: "" } });
    fireEvent.blur(input("Action label"));
    expect(latest.actions[0]).toEqual({ opcode: "toast", message: "Deleted" });
  });
});
