import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { PropertyNumberInput } from "./PropertyNumberInput";

afterEach(cleanup);

/**
 * 2026-10-22 (user: selecting a Popover in Layers → "Too many re-renders"): the render-time sync
 * compared the `value` prop with `!==`, so a NaN value (the generic renderer's `Number()` of a
 * non-numeric prop) re-synced on every render. The field now compares with `Object.is`.
 */
describe("PropertyNumberInput", () => {
  it("renders a NaN value without re-rendering forever", () => {
    let container: HTMLElement | undefined;
    expect(() => {
      container = render(
        <PropertyNumberInput label="Offset" value={NaN} onChange={() => {}} />,
      ).container;
    }).not.toThrow();
    expect(container?.querySelector("input")).toBeTruthy();
  });
});
