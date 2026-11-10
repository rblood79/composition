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

  // 2026-11-10 사용자 결정 (Figma 방식): 숫자 칸은 늘 칸 안 앞 표시를 둔다 — 지정이 없으면 `#`.
  it("puts the default number glyph in front of the field when no icon is given", () => {
    const { container } = render(
      <PropertyNumberInput label="Row count" value={3} onChange={() => {}} />,
    );
    expect(
      container.querySelector(".react-aria-Group > .control-label svg"),
    ).toBeTruthy();
  });
});
