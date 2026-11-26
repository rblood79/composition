import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { useDataStore } from "../../../stores/data";
import type { DataTable } from "../../../../types/builder/data.types";
import { SettingsEditor, TableSettings } from "./TableSettingsPopover";

/**
 * 사용자 결정 2026-11-26 — a collection with no execution policy is shown as 「Auto」 (it loads when
 * the app opens); 「Manual」 is shown only when stored. Before: no policy showed 「Manual」.
 */
const editor = (executionPolicy?: {
  mode: "auto" | "manual" | "interval";
  intervalSec?: number;
}) => (
  <SettingsEditor
    name="Orders"
    useMockData={false}
    executionPolicy={executionPolicy}
    endpoints={[]}
    linkedEndpointId=""
    onNameChange={vi.fn()}
    onUseMockDataChange={vi.fn()}
    onEndpointChange={vi.fn()}
    onPolicyChange={vi.fn()}
  />
);

describe("Data panel — execution policy shown", () => {
  it("no policy shows Auto", () => {
    render(editor());
    expect(screen.getAllByText("Auto").length).toBeGreaterThan(0);
    expect(screen.queryByText("Manual")).toBeNull();
  });

  it("a stored manual shows Manual", () => {
    render(editor({ mode: "manual" }));
    expect(screen.getAllByText("Manual").length).toBeGreaterThan(0);
  });
});

describe("Data panel — execution policy stored", () => {
  it("choosing Manual stores the manual policy (not 「no policy」)", async () => {
    const initial = useDataStore.getState();
    const applyDataChange = vi.fn(async () => undefined);
    useDataStore.setState({
      applyDataChange,
      apiEndpoints: new Map(),
    } as unknown as Partial<typeof initial>);
    try {
      const user = userEvent.setup();
      render(
        <TableSettings
          table={
            { id: "orders", name: "Orders", useMockData: false } as DataTable
          }
        />,
      );
      await user.click(screen.getByRole("button", { name: /Auto/ }));
      await user.click(await screen.findByRole("option", { name: "Manual" }));
      expect(applyDataChange).toHaveBeenCalledWith({
        ops: [
          {
            op: "set_execution_policy",
            collectionId: "orders",
            policy: { mode: "manual" },
          },
        ],
        origin: "user",
      });
    } finally {
      useDataStore.setState(initial, true);
    }
  });
});
