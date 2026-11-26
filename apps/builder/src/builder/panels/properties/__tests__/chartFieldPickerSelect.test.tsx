/**
 * 2026-11-26 (사용자 지시 — Selected · Disabled keys 와 같은 비용 문제): the Chart value-field picker
 * (Series source → Value columns) is a select that takes several, not a check list of one RAC
 * Checkbox per source column. Closed, RAC is given the picked columns only; the picked order is
 * the order the fields join (`valueFields`).
 */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ResolvedField } from "@composition/shared";
import { I18nProvider } from "@/i18n";
import { ChartDataMappingControls } from "../ChartDataMappingControls";

afterEach(cleanup);

const field = (key: string, currentValue: unknown) =>
  ({
    key,
    currentValue,
    origin: "semantic",
    kind: "value",
    isOverridden: true,
  }) as unknown as ResolvedField;

const COLUMNS = Array.from({ length: 120 }, (_, i) => ({
  key: `col${i}`,
  type: "number" as const,
}));

function openPicker(onPatch = vi.fn()) {
  const ui = render(
    <I18nProvider initialLocale="en-US">
      <ChartDataMappingControls
        elementId="chart-1"
        fields={[field("chartType", "bar"), field("dataMode", "group")]}
        columns={COLUMNS}
        onPatch={onPatch}
      />
    </I18nProvider>,
  );
  // Series source → Value columns opens the picker (no write yet).
  fireEvent.click(screen.getByRole("button", { name: /Series source/ }));
  fireEvent.click(screen.getByRole("option", { name: /Value columns/ }));
  return { ui, onPatch };
}

// (While the list is open, RAC hides the rest of the page from assistive tech — read the DOM.)
const pickerTrigger = () =>
  document.querySelector(
    "fieldset.chart-field-picker button.react-aria-Button",
  ) as HTMLElement;

describe("Chart value-field picker — a multiple select", () => {
  it("closed: no control per column, nothing picked shows —", () => {
    const { ui, onPatch } = openPicker();
    expect(onPatch).not.toHaveBeenCalled();
    expect(ui.container.querySelectorAll(".react-aria-Checkbox")).toHaveLength(
      0,
    );
    expect(pickerTrigger().textContent).toContain("—");
  });

  it("two picks show the count (S2 Picker), Apply writes them in the picked order", () => {
    const { onPatch } = openPicker();
    fireEvent.click(pickerTrigger());
    expect(screen.getAllByRole("option")).toHaveLength(COLUMNS.length);
    fireEvent.click(screen.getByRole("option", { name: /^col7(?!\d)/ }));
    fireEvent.click(screen.getByRole("option", { name: /^col2(?!\d)/ }));
    expect(pickerTrigger().textContent).toContain("2 items selected");
    fireEvent.click(
      screen.getByRole("button", { name: "Apply", hidden: true }),
    );
    expect(onPatch).toHaveBeenLastCalledWith({
      dataMode: "columns",
      valueFields: ["col7", "col2"],
    });
  });
});
