import { cleanup, fireEvent, render, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { CatalogRacSlotSection } from "../CatalogRacSlotSection";
import type { CatalogWorkspace } from "../../../../catalogRuntime/workspace";
import {
  segmentedControlBinding,
  segmentedControlItemBinding,
} from "../../../../../../../../packages/shared/src/catalog/bindings/SegmentedControl.binding";

vi.mock("../../../../catalogRuntime/react", () => ({
  useCatalogStepReading: (_workspace: unknown, read: () => unknown) => read(),
}));

afterEach(cleanup);

for (const [type, binding] of [
  ["SegmentedControl", segmentedControlBinding],
  ["SegmentedControlItem", segmentedControlItemBinding],
] as const) {
  it(`${type}의 Slot은 문자열 input 대신 공통 선택·해제 UI를 사용한다`, () => {
    expect(binding.props?.accepts.slot.editorHidden).toBe(true);
    const record = {
      id: "part",
      parentId: "page",
      type,
      props: { slot: "existing" },
    };
    const root = {
      canvasInputs: new Map([[record.id, record]]),
      typeOf: (node: typeof record) => node.type,
    } as unknown as CatalogWorkspace["root"];
    const ui = render(
      <CatalogRacSlotSection
        identity="part"
        workspace={{} as CatalogWorkspace}
        root={root}
      />,
    );
    const group = ui.getByRole("group", { name: "Slot" });
    expect(within(group).queryByRole("textbox")).toBeNull();
    fireEvent.click(within(group).getByRole("button"));
    expect(ui.getByRole("option", { name: "existing" })).toBeTruthy();
    expect(ui.getByRole("option", { name: "Unset" })).toBeTruthy();
    expect(
      ui.getByRole("option", { name: "Detach (slot = null)" }),
    ).toBeTruthy();
  });
}
