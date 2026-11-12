import { fireEvent } from "@testing-library/react";

/**
 * Pick an item in a panel `PanelSelect` — open it from its trigger, then press the option with that
 * key. A closed panel Select holds its selected item only (`PanelSelect` `closedItems`), so the
 * hidden `<select>` cannot be driven directly.
 */
export function pickPanelSelectOption(trigger: Element, key: string): void {
  fireEvent.click(trigger);
  fireEvent.click(
    document.querySelector(`[role="option"][data-key="${key}"]`)!,
  );
}
